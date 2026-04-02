'use client'
/**
 * ScanReadyScreen.tsx — ARAI_11  "Deliberate Position Flow"
 *
 * 7 guided positions — user places phone, holds still, AI reads, advances.
 *
 * Pos 1 — OVERVIEW    : Stand back, full stair → step count + headroom
 * Pos 2 — RISER FRONT : Phone on nosing facing kickplate → riser height
 * Pos 3 — ROTATE 90   : Rotate phone 90° same spot → nosing overhang
 * Pos 4 — NOSING      : Close-up tread front edge → nosing confirm
 * Pos 5 — HANDRAIL    : Frame tread-to-top → guard height + offset
 * Pos 6 — ALT ANGLE   : Reposition for stair width
 * Pos 7 — TREAD TOP   : Phone horizontal above step camera down → tread depth
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { checkXRSupport } from '@/lib/xr-measure'
import type { UserRole } from './AuthScreen'
import { Analytics } from '@/lib/analytics'
import type { ScanMode } from '@/app/components/ScanModeSelect'

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY   = '#0A1C2E'
const GREEN  = '#27A96B'
const AMBER  = '#FA741F'
const WHITE  = '#E8F4FF'
const WHITE2 = '#93BAD4'
const BLUE   = '#4A90E2'
const BORDER = 'rgba(147,186,212,0.15)'

// ── Position definitions ──────────────────────────────────────────────────────
type Position = 'overview'|'riser_front'|'rotate_90'|'nosing'|'handrail'|'alt_angle'|'tread_top'

interface PosConfig {
  id:           Position
  step:         number
  label:        string
  image:        string
  headline:     string
  detail:       string
  holdSeconds:  number
  positionTime: number
  captures:     string[]
  optional:     boolean
  aiPrompt:     (prior: Record<string, number|string>) => string
}

const POSITIONS: PosConfig[] = [
  {
    id: 'overview', step: 1, label: 'Full Stair View',
    image: '/Clear_headroom.png',
    headline: 'Step back — capture the full staircase',
    detail: 'Stand 2–3 metres away. Hold the phone level at chest height so the entire stair flight is visible. Hold still for 3 seconds.',
    holdSeconds: 3, positionTime: 8, optional: false,
    captures: ['riserCount','headroom'],
    aiPrompt: (_p) => `Analyse this staircase image for a compliance inspection.

Determine:
1. Count the visible steps/risers carefully
2. Is headroom restricted? Look for a ceiling or soffit above the stair flight.
   - "clear" = no ceiling, open above
   - number in mm if ceiling is visible (use riser as scale ≈175mm each)
3. Residential (≤1000mm wide) or commercial?

Reply ONLY with valid JSON — no markdown:
{"stepCount":number|null,"headroom":"clear"|number,"isResidential":true|false|null,"confident":true|false,"message":"one sentence for the user"}`,
  },
  {
    id: 'riser_front', step: 2, label: 'Riser Height',
    image: '/Measure_Riser_front.png',
    headline: 'Place phone on the nosing, camera facing the riser',
    detail: 'Set the phone upright on the tread nosing with the camera pointing directly at the vertical riser face. Centre the riser in frame. Hold still for 3 seconds.',
    holdSeconds: 3, positionTime: 10, optional: false,
    captures: ['rise'],
    aiPrompt: (_p) => `Measure RISER HEIGHT. The phone is upright on the nosing pointing at the vertical riser face.

The riser face should fill most of the frame vertically. Use the phone body (~70mm wide) as a scale reference if visible.

Reply ONLY with valid JSON:
{"estimatedMm":number|null,"confidence":0.0-1.0,"message":"one sentence","locked":true|false}

Lock if confidence >= 0.65. Residential riser range: 125–200mm. Avoid round numbers.`,
  },
  {
    id: 'rotate_90', step: 3, label: 'Tread Edge / Nosing',
    image: '/Rotate_Phone_90.png',
    headline: 'Rotate phone 90° — same spot on the nosing',
    detail: 'Without moving, rotate the phone so it lies flat on the tread with the camera facing along the tread surface toward the nosing edge. Hold still for 2 seconds.',
    holdSeconds: 2, positionTime: 7, optional: false,
    captures: ['nosing'],
    aiPrompt: (_p) => `The phone is rotated 90° lying on the tread, camera looking along the tread surface from the nosing edge.

Check for NOSING — a physical lip overhanging the riser face below the tread.
Look at the tread front edge. Is there an overhang more than ~15mm?

Reply ONLY with valid JSON:
{"hasNosing":true|false,"estimatedMm":number|null,"confidence":0.0-1.0,"message":"one sentence"}`,
  },
  {
    id: 'nosing', step: 4, label: 'Nosing Close-Up',
    image: '/Nosing.png',
    headline: 'Point at the front edge of a tread',
    detail: 'Hold the phone close to the tread front edge so the nosing overhang (or lack of one) is clearly visible. Hold still for 2 seconds.',
    holdSeconds: 2, positionTime: 6, optional: true,
    captures: ['nosing'],
    aiPrompt: (p) => `Close-up nosing check. Previous reading: ${p.nosing ?? 'none yet'}.

Is there a physical nosing (overhang) at the tread front edge beyond the riser face?
Estimate the projection in mm if visible.

Reply ONLY with valid JSON:
{"hasNosing":true|false,"estimatedMm":number|null,"confidence":0.0-1.0,"message":"one sentence"}`,
  },
  {
    id: 'handrail', step: 5, label: 'Handrail Height',
    image: '/Handrail_height_offset.png',
    headline: 'Frame the handrail — tread to top of rail',
    detail: 'Stand beside the stair. Frame both the tread surface at the bottom and the top of the handrail in the same shot. Hold still for 3 seconds.',
    holdSeconds: 3, positionTime: 10, optional: false,
    captures: ['guard'],
    aiPrompt: (_p) => `Measure HANDRAIL HEIGHT — vertical from tread nosing to top of rail.

Also check for HANDRAIL OFFSET — horizontal distance from stringer/wall to the handrail centre.

Default to 915mm height at confidence 0.60 if any rail is visible.

Reply ONLY with valid JSON:
{"estimatedMm":number|null,"offsetMm":number|null,"confidence":0.0-1.0,"message":"one sentence","locked":true|false}

Lock if confidence >= 0.55. Height range: 865–1070mm residential.`,
  },
  {
    id: 'alt_angle', step: 6, label: 'Stair Width',
    image: '/Change_angles.png',
    headline: 'Step back — capture full stair width',
    detail: 'Move to a position where both left and right edges of the stair are clearly visible in frame. Hold still for 3 seconds.',
    holdSeconds: 3, positionTime: 8, optional: true,
    captures: ['width'],
    aiPrompt: (p) => `Measure STAIR WIDTH — horizontal distance between both stringers or walls.
Both left AND right edges must be visible. Use riser height (${p.rise ?? 175}mm) as scale.

Reply ONLY with valid JSON:
{"estimatedMm":number|null,"confidence":0.0-1.0,"message":"one sentence","locked":true|false}

Width range: 800–1400mm residential. Lock if confidence >= 0.60.`,
  },
  {
    id: 'tread_top', step: 7, label: 'Tread Depth',
    image: '/Measure_tread.png',
    headline: 'Hold phone above tread, camera facing straight down',
    detail: 'Hold the phone flat and parallel to the tread, 20–30cm above it, camera facing straight down. Keep it as still as possible for 3 seconds.',
    holdSeconds: 3, positionTime: 10, optional: false,
    captures: ['run'],
    aiPrompt: (p) => `Phone held horizontal above a stair tread, camera facing straight down.

Measure TREAD DEPTH — horizontal distance from front nosing to back riser.
Use phone width (~70mm) or riser height (${p.rise ?? 175}mm) as scale reference.

Reply ONLY with valid JSON:
{"estimatedMm":number|null,"confidence":0.0-1.0,"message":"one sentence","locked":true|false}

Lock if confidence >= 0.60. Tread range: 220–420mm.`,
  },
]

// ── Vision helper ─────────────────────────────────────────────────────────────
async function callVision(b64: string, prompt: string, ms = 18000): Promise<string|null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch('/api/vision', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({imageB64:b64, prompt}), signal:ctrl.signal })
    clearTimeout(t)
    if (!r.ok) return null
    const d = await r.json()
    return d.text ?? null
  } catch { clearTimeout(t); return null }
}

function parseJSON(s: string|null): any {
  if (!s) return null
  try { const m = s.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null } catch { return null }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  userRole?: UserRole
  scanMode?: ScanMode
  onSuccess: (m: Record<string,number|string>) => void
  onBack: () => void
}

type Stage = 'position'|'hold'|'analysing'|'result'|'paused'

export default function ScanReadyScreen({ userRole='diy', scanMode='accuracy', onSuccess, onBack }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream|null>(null)
  const busyRef    = useRef(false)
  const timerRef   = useRef<ReturnType<typeof setTimeout>|null>(null)

  const [posIdx,     setPosIdx]     = useState(0)
  const [stage,      setStage]      = useState<Stage>('position')
  const [countdown,  setCountdown]  = useState(0)
  const [camReady,   setCamReady]   = useState(false)
  const [camError,   setCamError]   = useState(false)
  const [aiMessage,  setAiMessage]  = useState<string|null>(null)
  const [results,    setResults]    = useState<Record<string,number|string>>({})
  const [reviewVals, setReviewVals] = useState<Record<string,number|string>>({})
  const [nosingMm,   setNosingMm]   = useState(0)
  const [arSupported,setArSupported]= useState(false)
  const [showReview, setShowReview] = useState(false)

  const isSpeed    = scanMode === 'speed'
  const currentPos = POSITIONS[posIdx] ?? POSITIONS[0]

  // ── Camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:1920}, height:{ideal:1080} }, audio:false })
      .then(stream => {
        if (!alive) { stream.getTracks().forEach(t=>t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
        setTimeout(() => { if (alive) setCamReady(true) }, 600)
      }).catch(() => { if (alive) setCamError(true) })
    checkXRSupport().then(s => setArSupported(s.immersiveAR && s.planeDetection)).catch(()=>{})
    return () => { alive=false; streamRef.current?.getTracks().forEach(t=>t.stop()) }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function captureB64(scale=0.65): string|null {
    const v=videoRef.current, c=captureRef.current
    if (!v||!c||v.readyState<2) return null
    c.width=Math.round(v.videoWidth*scale); c.height=Math.round(v.videoHeight*scale)
    c.getContext('2d')!.drawImage(v,0,0,c.width,c.height)
    return c.toDataURL('image/jpeg',0.82).split(',')[1]
  }

  function sched(fn:()=>void, ms:number) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(fn, ms)
  }

  // ── Go to position ────────────────────────────────────────────────────────
  const goTo = useCallback((idx: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (idx >= POSITIONS.length) { finishScan(); return }
    busyRef.current = false
    setPosIdx(idx)
    setStage('position')
    setAiMessage(null)
    const secs = isSpeed ? Math.max(4, POSITIONS[idx].positionTime-3) : POSITIONS[idx].positionTime
    setCountdown(secs)
  }, [isSpeed]) // eslint-disable-line

  // ── Initialise first position once camera ready ───────────────────────────
  useEffect(() => { if (camReady) goTo(0) }, [camReady]) // eslint-disable-line

  // ── Position countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'position') return
    if (countdown <= 0) { setStage('hold'); setCountdown(isSpeed ? Math.max(1, currentPos.holdSeconds-1) : currentPos.holdSeconds); return }
    const t = setTimeout(() => setCountdown(c=>c-1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown, currentPos.holdSeconds, isSpeed])

  // ── Hold countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'hold') return
    if (countdown <= 0) { setStage('analysing'); return }
    const t = setTimeout(() => setCountdown(c=>c-1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  // ── Analyse ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'analysing' || busyRef.current) return
    busyRef.current = true

    async function run() {
      const b64 = captureB64()
      if (!b64) { busyRef.current=false; sched(()=>setStage('analysing'),1000); return }

      // Snapshot results at call time for the prompt
      let priorSnap: Record<string,number|string> = {}
      setResults(prev => { priorSnap = prev; return prev })

      const raw = await callVision(b64, currentPos.aiPrompt(priorSnap), isSpeed ? 10000 : 18000)
      busyRef.current = false
      const r = parseJSON(raw)

      if (!r) {
        setAiMessage("Could not read the image clearly. Hold still and try again.")
        setStage('result')
        return
      }

      // Extract measurements
      setResults(prev => {
        const next = { ...prev }
        const p = currentPos.id
        if (p === 'overview') {
          if (r.stepCount)           next.riserCount   = r.stepCount
          if (r.headroom != null)    next.headroom     = r.headroom
          if (r.isResidential!=null) next.isResidential= r.isResidential ? 1 : 0
        }
        if (p === 'riser_front' && r.estimatedMm && r.confidence>=0.55) next.rise = Math.round(r.estimatedMm)
        if ((p==='rotate_90'||p==='nosing') && r.confidence>=0.55) {
          next.nosing = r.hasNosing ? (r.estimatedMm ?? 30) : 'none'
          if (r.estimatedMm) setNosingMm(r.estimatedMm)
        }
        if (p==='handrail' && r.estimatedMm && r.confidence>=0.50) {
          next.guard = Math.round(r.estimatedMm)
          if (r.offsetMm) next.handrailOffset = Math.round(r.offsetMm)
        }
        if (p==='alt_angle' && r.estimatedMm && r.confidence>=0.55) next.width = Math.round(r.estimatedMm)
        if (p==='tread_top' && r.estimatedMm && r.confidence>=0.55) next.run = Math.round(r.estimatedMm)
        return next
      })

      setAiMessage(r.message ?? null)
      setStage('result')

      if (isSpeed || r.locked || r.confident) {
        sched(() => goTo(posIdx+1), isSpeed ? 1200 : 2000)
      }
    }

    run()
  }, [stage]) // eslint-disable-line

  // ── Pause / resume ────────────────────────────────────────────────────────
  function pause()  { if(timerRef.current) clearTimeout(timerRef.current); setStage('paused') }
  function resume() { setStage('position'); setCountdown(currentPos.positionTime) }

  // ── Finish ────────────────────────────────────────────────────────────────
  function finishScan() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setResults(prev => {
      const final = { ...prev }
      if (!final.headroom) final.headroom = 'clear'
      setReviewVals(final)
      return final
    })
    setShowReview(true)
  }

  function submitReview() {
    Analytics.scanCompleted({ role: userRole, measurementCount: Object.keys(reviewVals).length, hasFailed: false })
    onSuccess(reviewVals)
  }

  // ── Camera error ──────────────────────────────────────────────────────────
  if (camError) return (
    <div style={{position:'fixed',inset:0,background:NAVY,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1rem',padding:'2rem',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{fontSize:'2rem'}}>📷</div>
      <p style={{color:WHITE,textAlign:'center'}}>Camera access is required to scan stairs.</p>
      <button onClick={onBack} style={{padding:'0.8rem 2rem',background:AMBER,border:'none',borderRadius:12,color:'#fff',fontWeight:700,cursor:'pointer'}}>← Go Back</button>
    </div>
  )

  // ── Review screen ─────────────────────────────────────────────────────────
  if (showReview) return (
    <div style={{position:'fixed',inset:0,background:NAVY,overflowY:'auto',padding:'max(env(safe-area-inset-top,0px),3rem) 1.25rem 3rem',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{maxWidth:440,margin:'0 auto',display:'flex',flexDirection:'column',gap:'1rem'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'1.5rem',marginBottom:'0.3rem'}}>📐</div>
          <div style={{fontSize:'1.1rem',fontWeight:800,color:WHITE}}>Review Measurements</div>
          <div style={{fontSize:'0.72rem',color:WHITE2,marginTop:'0.2rem'}}>Tap any number to correct it</div>
        </div>

        {([
          {key:'rise',     label:'Riser Height',    unit:'mm', type:'number'},
          {key:'run',      label:'Tread Depth',     unit:'mm', type:'number'},
          {key:'width',    label:'Stair Width',     unit:'mm', type:'number'},
          {key:'guard',    label:'Handrail Height', unit:'mm', type:'number'},
          {key:'nosing',   label:'Nosing',          unit:'',   type:'nosing'},
          {key:'headroom', label:'Headroom',        unit:'',   type:'headroom'},
        ] as const).map(({key,label,unit,type}) => (
          <div key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'0.65rem 1rem',border:`1px solid ${BORDER}`,gap:'0.75rem'}}>
            <div style={{fontSize:'0.82rem',color:WHITE2,flexShrink:0}}>{label}</div>
            {type==='number' && (
              <div style={{display:'flex',alignItems:'center',gap:'0.3rem'}}>
                <input type="number" inputMode="numeric"
                  value={reviewVals[key]!=null && reviewVals[key]!=='clear' && reviewVals[key]!=='none' ? String(reviewVals[key]) : ''}
                  placeholder="—"
                  onChange={e=>{ const v=parseInt(e.target.value,10); if(!isNaN(v)&&v>0) setReviewVals(p=>({...p,[key]:v})) }}
                  style={{width:70,padding:'0.35rem 0.5rem',background:'rgba(255,255,255,0.10)',border:`1px solid ${BORDER}`,borderRadius:8,color:WHITE,fontFamily:'monospace',fontWeight:700,fontSize:'1rem',textAlign:'right'}}
                />
                <span style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.4)',fontFamily:'monospace'}}>mm</span>
              </div>
            )}
            {type==='nosing' && (
              <div style={{display:'flex',gap:'0.4rem'}}>
                {(['none','yes'] as const).map(opt=>(
                  <button key={opt} onClick={()=>setReviewVals(p=>({...p,nosing:opt==='yes'?(nosingMm||30):'none'}))}
                    style={{padding:'0.3rem 0.65rem',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'monospace',fontSize:'0.72rem',fontWeight:700,
                      background:(opt==='none'?reviewVals[key]==='none':reviewVals[key]!=='none'&&reviewVals[key]!=null)?AMBER+'33':'rgba(255,255,255,0.06)',
                      color:(opt==='none'?reviewVals[key]==='none':reviewVals[key]!=='none'&&reviewVals[key]!=null)?AMBER:'rgba(255,255,255,0.5)'}}>
                    {opt==='none'?'None':'Present'}
                  </button>
                ))}
              </div>
            )}
            {type==='headroom' && (
              <div style={{display:'flex',gap:'0.4rem'}}>
                {(['clear','low'] as const).map(opt=>(
                  <button key={opt} onClick={()=>setReviewVals(p=>({...p,headroom:opt==='clear'?'clear':(p.headroom!=='clear'?p.headroom:1950)}))}
                    style={{padding:'0.3rem 0.65rem',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'monospace',fontSize:'0.72rem',fontWeight:700,
                      background:(opt==='clear'?reviewVals[key]==='clear':reviewVals[key]!=='clear'&&reviewVals[key]!=null)?GREEN+'33':'rgba(255,255,255,0.06)',
                      color:(opt==='clear'?reviewVals[key]==='clear':reviewVals[key]!=='clear'&&reviewVals[key]!=null)?GREEN:'rgba(255,255,255,0.5)'}}>
                    {opt==='clear'?'✓ Clear':'⚠ Low'}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <button onClick={submitReview} style={{width:'100%',padding:'1.1rem',background:`linear-gradient(135deg,${GREEN},#1A7A50)`,border:'none',borderRadius:16,color:'#fff',fontFamily:'monospace',fontSize:'0.95rem',fontWeight:900,letterSpacing:'0.08em',cursor:'pointer',boxShadow:'0 4px 24px rgba(39,169,107,0.4)',marginTop:'0.5rem'}}>
          Generate Report →
        </button>
        <button onClick={()=>setShowReview(false)} style={{background:'none',border:'none',color:WHITE2,fontSize:'0.68rem',fontFamily:'monospace',cursor:'pointer',alignSelf:'center'}}>
          ← Back to scan
        </button>
      </div>
    </div>
  )

  // ── Scan UI ───────────────────────────────────────────────────────────────
  const showIllustration = stage==='position'||stage==='paused'
  const showCamera       = stage==='hold'||stage==='analysing'||stage==='result'
  const progressPct      = (posIdx/POSITIONS.length)*100

  return (
    <div style={{position:'fixed',inset:0,background:'#000',overflow:'hidden',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>

      {/* Camera feed */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:showCamera?1:0,transition:'opacity 0.5s ease'}}/>
      <canvas ref={captureRef} style={{display:'none'}}/>

      {/* Illustration */}
      {showIllustration && (
        <div style={{position:'absolute',inset:0,zIndex:10}}>
          <img src={currentPos.image} alt={currentPos.headline}
            style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}}/>
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:'60%',
            background:'linear-gradient(to top,rgba(10,28,46,0.98) 0%,rgba(10,28,46,0.65) 50%,transparent 100%)'}}/>
        </div>
      )}

      {/* Analyse overlay */}
      {stage==='analysing' && (
        <div style={{position:'absolute',inset:0,zIndex:15,background:'rgba(10,28,46,0.45)',backdropFilter:'blur(2px)'}}/>
      )}

      {/* ── TOP BAR ── */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:50,
        paddingTop:'max(env(safe-area-inset-top,0px),1.5rem)',paddingBottom:'0.75rem',
        paddingLeft:'1rem',paddingRight:'1rem',
        background:'linear-gradient(to bottom,rgba(10,28,46,0.92),transparent)',
        display:'flex',alignItems:'center',gap:'0.75rem'}}>

        <button onClick={onBack} style={{width:36,height:36,borderRadius:'50%',background:'rgba(0,0,0,0.5)',border:`1px solid ${BORDER}`,color:WHITE,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</button>

        <div style={{flex:1,display:'flex',flexDirection:'column',gap:'0.28rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'0.62rem',fontFamily:'monospace',letterSpacing:'0.1em',color:WHITE2}}>STEP {currentPos.step} / {POSITIONS.length}</span>
            <span style={{fontSize:'0.75rem',fontWeight:700,color:WHITE}}>{currentPos.label}</span>
          </div>
          <div style={{height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${progressPct}%`,background:`linear-gradient(90deg,${GREEN},${BLUE})`,borderRadius:2,transition:'width 0.4s ease'}}/>
          </div>
        </div>

        <div style={{background:arSupported?'rgba(74,144,226,0.15)':'rgba(242,147,55,0.15)',border:`1px solid ${arSupported?'rgba(74,144,226,0.4)':'rgba(242,147,55,0.4)'}`,borderRadius:12,padding:'0.2rem 0.55rem',flexShrink:0}}>
          <span style={{fontSize:'0.5rem',fontFamily:'monospace',letterSpacing:'0.1em',color:arSupported?BLUE:AMBER,fontWeight:700}}>{arSupported?'AR':'AI'}</span>
        </div>
      </div>

      {/* ══════════ POSITION STAGE ══════════ */}
      {(stage==='position'||stage==='paused') && (
        <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:50,
          paddingBottom:'max(env(safe-area-inset-bottom,0px),2rem)',
          paddingLeft:'1.25rem',paddingRight:'1.25rem',
          display:'flex',flexDirection:'column',gap:'0.65rem'}}>

          <div style={{background:'rgba(10,28,46,0.97)',border:`1px solid ${BORDER}`,borderRadius:18,padding:'1.1rem 1.25rem',backdropFilter:'blur(12px)'}}>
            <div style={{fontSize:'1rem',fontWeight:800,color:WHITE,lineHeight:1.3,marginBottom:'0.4rem'}}>{currentPos.headline}</div>
            <div style={{fontSize:'0.78rem',color:WHITE2,lineHeight:1.65,marginBottom:'0.75rem'}}>{currentPos.detail}</div>

            {stage==='position' && (
              <div style={{display:'flex',alignItems:'center',gap:'0.55rem',background:'rgba(255,255,255,0.05)',borderRadius:24,padding:'0.4rem 0.85rem',border:`1px solid ${BORDER}`,width:'fit-content'}}>
                {/* Circular countdown */}
                <svg width="22" height="22" viewBox="0 0 36 36" style={{transform:'rotate(-90deg)',flexShrink:0}}>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="14" fill="none" stroke={AMBER} strokeWidth="3"
                    strokeDasharray={`${2*Math.PI*14}`}
                    strokeDashoffset={`${2*Math.PI*14*(countdown/currentPos.positionTime)}`}
                    strokeLinecap="round" style={{transition:'stroke-dashoffset 0.9s linear'}}/>
                </svg>
                <span style={{fontSize:'0.82rem',fontFamily:'monospace',fontWeight:700,color:WHITE}}>{countdown}s</span>
                <span style={{fontSize:'0.68rem',color:WHITE2}}>to get in position</span>
              </div>
            )}

            {stage==='paused' && (
              <div style={{background:'rgba(250,116,31,0.12)',border:'1px solid rgba(250,116,31,0.3)',borderRadius:10,padding:'0.45rem 0.8rem',textAlign:'center'}}>
                <span style={{fontSize:'0.78rem',color:AMBER,fontWeight:700}}>⏸ Paused — take your time</span>
              </div>
            )}
          </div>

          <div style={{display:'flex',gap:'0.5rem'}}>
            {stage==='position'
              ? <button onClick={pause} style={{flex:1,padding:'0.82rem',background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:14,color:WHITE2,fontFamily:'monospace',fontSize:'0.8rem',fontWeight:600,cursor:'pointer'}}>⏸ Pause</button>
              : <button onClick={resume} style={{flex:1,padding:'0.82rem',background:`rgba(39,169,107,0.15)`,border:`1px solid rgba(39,169,107,0.4)`,borderRadius:14,color:GREEN,fontFamily:'monospace',fontSize:'0.8rem',fontWeight:700,cursor:'pointer'}}>▶ Resume</button>
            }
            {currentPos.optional && (
              <button onClick={()=>goTo(posIdx+1)} style={{flex:1,padding:'0.82rem',background:'rgba(255,255,255,0.05)',border:`1px solid ${BORDER}`,borderRadius:14,color:WHITE2,fontFamily:'monospace',fontSize:'0.8rem',cursor:'pointer'}}>Skip →</button>
            )}
            <button onClick={finishScan} style={{flex:1,padding:'0.82rem',background:`linear-gradient(135deg,${AMBER},#C4721E)`,border:'none',borderRadius:14,color:'#fff',fontFamily:'monospace',fontSize:'0.8rem',fontWeight:700,cursor:'pointer'}}>Finish ✓</button>
          </div>
        </div>
      )}

      {/* ══════════ HOLD STAGE ══════════ */}
      {stage==='hold' && (
        <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:50,
          paddingBottom:'max(env(safe-area-inset-bottom,0px),2rem)',
          paddingLeft:'1.25rem',paddingRight:'1.25rem',
          display:'flex',flexDirection:'column',alignItems:'center',gap:'0.75rem'}}>

          <div style={{position:'relative',width:88,height:88}}>
            <svg width="88" height="88" style={{transform:'rotate(-90deg)'}}>
              <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5"/>
              <circle cx="44" cy="44" r="36" fill="none" stroke={GREEN} strokeWidth="5"
                strokeDasharray={`${2*Math.PI*36}`}
                strokeDashoffset={`${2*Math.PI*36*(countdown/currentPos.holdSeconds)}`}
                strokeLinecap="round" style={{transition:'stroke-dashoffset 0.9s linear'}}/>
            </svg>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',fontWeight:900,color:WHITE,fontFamily:'monospace'}}>{countdown}</div>
          </div>

          <div style={{background:'rgba(10,28,46,0.95)',border:`1px solid ${GREEN}55`,borderRadius:14,padding:'0.55rem 1.25rem'}}>
            <span style={{fontSize:'0.85rem',fontWeight:800,color:GREEN,fontFamily:'monospace',letterSpacing:'0.1em'}}>HOLD STILL</span>
          </div>

          <div style={{display:'flex',gap:'0.5rem',width:'100%',maxWidth:380}}>
            <button onClick={pause} style={{flex:1,padding:'0.8rem',background:'rgba(255,255,255,0.08)',border:`1px solid ${BORDER}`,borderRadius:14,color:WHITE2,fontFamily:'monospace',fontSize:'0.78rem',cursor:'pointer'}}>⏸ Pause</button>
            <button onClick={finishScan} style={{flex:1,padding:'0.8rem',background:`linear-gradient(135deg,${AMBER},#C4721E)`,border:'none',borderRadius:14,color:'#fff',fontFamily:'monospace',fontSize:'0.8rem',fontWeight:700,cursor:'pointer'}}>Finish ✓</button>
          </div>
        </div>
      )}

      {/* ══════════ ANALYSING STAGE ══════════ */}
      {stage==='analysing' && (
        <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:50,
          paddingBottom:'max(env(safe-area-inset-bottom,0px),2.5rem)',
          paddingLeft:'1.25rem',paddingRight:'1.25rem',
          display:'flex',flexDirection:'column',alignItems:'center',gap:'0.75rem'}}>
          <div style={{width:44,height:44,borderRadius:'50%',border:'3px solid rgba(242,147,55,0.2)',borderTopColor:AMBER,animation:'spin 0.8s linear infinite'}}/>
          <div style={{background:'rgba(10,28,46,0.96)',border:`1px solid ${BORDER}`,borderRadius:14,padding:'0.7rem 1.25rem',backdropFilter:'blur(8px)'}}>
            <span style={{fontSize:'0.88rem',color:WHITE,fontWeight:600}}>Reading image…</span>
          </div>
          <button onClick={finishScan} style={{padding:'0.65rem 1.5rem',background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:12,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>
            Finish &amp; generate report →
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ══════════ RESULT STAGE ══════════ */}
      {stage==='result' && (
        <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:50,
          paddingBottom:'max(env(safe-area-inset-bottom,0px),2rem)',
          paddingLeft:'1.25rem',paddingRight:'1.25rem',
          display:'flex',flexDirection:'column',gap:'0.65rem'}}>

          {aiMessage && (
            <div style={{background:'rgba(10,28,46,0.97)',border:`1px solid ${BORDER}`,borderRadius:16,padding:'0.9rem 1.1rem',backdropFilter:'blur(12px)'}}>
              <div style={{fontSize:'0.58rem',color:AMBER,fontFamily:'monospace',letterSpacing:'0.12em',marginBottom:'0.3rem'}}>AI READING</div>
              <div style={{fontSize:'0.92rem',fontWeight:600,color:WHITE,lineHeight:1.5,marginBottom:'0.5rem'}}>{aiMessage}</div>
              <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
                {currentPos.captures.map(cap => {
                  const val = results[cap]
                  if (val==null) return null
                  return (
                    <div key={cap} style={{fontSize:'0.62rem',fontFamily:'monospace',color:GREEN,background:'rgba(39,169,107,0.12)',border:'1px solid rgba(39,169,107,0.3)',borderRadius:8,padding:'0.15rem 0.5rem'}}>
                      ✓ {cap}: {typeof val==='number'?`${val}mm`:String(val)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{display:'flex',gap:'0.5rem'}}>
            <button onClick={()=>{ busyRef.current=false; setStage('hold'); setCountdown(currentPos.holdSeconds) }}
              style={{flex:1,padding:'0.85rem',background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:14,color:WHITE2,fontFamily:'monospace',fontSize:'0.8rem',cursor:'pointer'}}>
              ↺ Retry
            </button>
            <button onClick={()=>goTo(posIdx+1)}
              style={{flex:2,padding:'0.85rem',background:`linear-gradient(135deg,${GREEN},#1A7A50)`,border:'none',borderRadius:14,color:'#fff',fontFamily:'monospace',fontSize:'0.88rem',fontWeight:800,cursor:'pointer',letterSpacing:'0.05em',boxShadow:'0 4px 20px rgba(39,169,107,0.4)'}}>
              Next Position →
            </button>
          </div>

          <button onClick={finishScan} style={{background:'none',border:'none',color:WHITE2,fontSize:'0.68rem',fontFamily:'monospace',cursor:'pointer',alignSelf:'center',letterSpacing:'0.06em'}}>
            Finish &amp; generate report →
          </button>
        </div>
      )}
    </div>
  )
}
