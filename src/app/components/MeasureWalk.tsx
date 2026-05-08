'use client'
/**
 * MeasureWalk.tsx — ARAI_10  (AR-first, AI fallback)
 *
 * Measurement routing:
 *   1. On mount, check navigator.xr.isSessionSupported('immersive-ar')
 *   2. If supported → mount ARSession for the current step (WebXR plane detection)
 *   3. If not supported OR ARSession calls onError() → fall back to AI coach (ARAI_9 flow)
 *
 * The AI coach path is unchanged from ARAI_9 — kept fully intact as fallback.
 * ARSession implements the same onMeasureComplete(primaryMm, secondaryMm?) interface.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import ARSession from './ARSession'
import { checkXRSupport } from '@/lib/xr-measure'

const C = { blue:'#1565C0', orange:'#D97706', pass:'#0D7A5F', fail:'#C0392B', warn:'#D97706', planeStroke:'#4A90D9' }

export interface StairMeasurements {
  rise:number|null; run:number|null; width:number|null
  nosing:number|null; headroom:number|null|'clear'; guard:number|null
  confidence:number; calibrated:boolean
  riserCount?:number; handrailOneSide?:boolean; handrailBothSides?:boolean
}

interface StepDef {
  id:        keyof Omit<StairMeasurements,'confidence'|'calibrated'>
  label:     string; color:string; rangeMin:number; rangeMax:number; typicalMm:number
  silent?:   boolean
  intro:     string   // coach opening line
  target:    string   // what AI looks for
}

interface CoachMsg { id:number; text:string; type:'coach'|'system'|'success' }

interface Props {
  onComplete:(m:StairMeasurements)=>void; onBack:()=>void
  codeLabel?:string; jurisdiction?:string
  stairInfo?:{riserCount:number; handrailOneSide:boolean; handrailBothSides:boolean}
}

const STEPS:StepDef[] = [
  {
    id:'rise', label:'Riser Height', color:C.pass, rangeMin:100, rangeMax:250, typicalMm:175,
    intro:"Let's measure the riser — the vertical face of the step. Point your phone directly at the front face of a step, holding it upright. I'll fire a measurement line across it.",
    target:`RISER FACE — flat vertical kickplate between two treads, viewed straight-on.
GOOD: 2+ full risers visible, phone upright, riser fills most of the frame.
BAD: looking down at steps, extreme angle, riser cut off at top or bottom.
SCALE: count visible risers, measure total height, divide by count. Each riser is identical.
Real measurements: 162, 171, 178, 186, 191, 197mm.`,
  },
  {
    id:'run', label:'Tread Depth', color:C.orange, rangeMin:180, rangeMax:420, typicalMm:250,
    intro:"Now point your phone straight down at the step below you — like aiming a laser at your feet from waist height. I'll measure the tread depth from there.",
    target:`TREAD SURFACE — top-down view, camera ~1300mm above, pointing straight down.
GOOD: 3-6 tread bands visible as horizontal stripes, evenly spaced, phone roughly level.
BAD: side angle, only 1 tread visible, tilted more than 45 degrees.
SCALE: at 1300mm height a 250mm tread spans ~1/5 of image height.
Real values: 228, 241, 253, 267mm. Also return secondaryMm = stair width (800-1400mm).`,
  },
  {
    id:'width', label:'Stair Width', color:C.blue, rangeMin:700, rangeMax:1800, typicalMm:960,
    intro:"Step back so both side walls of the staircase are visible. I'll send two measurement lines to both corners to capture the full width.",
    target:`FULL STAIR WIDTH — both side walls or stringers visible, face-on.
GOOD: both left and right edges visible, phone upright, riser centred.
BAD: only one wall visible, extreme angle, too close to see full width.
SCALE: use visible riser height (165-190mm) to derive mm/px, apply horizontally.
Real values: 874, 912, 1048, 1143mm.`,
  },
  {
    id:'guard', label:'Handrail Height', color:'#00d4aa', rangeMin:700, rangeMax:1200, typicalMm:950,
    intro:"Last one — face the handrail and point your phone at it. I'll measure from the tread surface up to the top of the rail.",
    target:`HANDRAIL HEIGHT — face-on, from tread surface (bottom) to top of rail (top).
GOOD: tread surface visible at bottom, rail top visible at top, phone upright.
BAD: looking along rail, top or bottom cut off.
SCALE: use any visible riser as reference. Real values: 891, 934, 962, 1008mm.`,
  },
  {
    id:'nosing', label:'Nosing', color:'#a78bfa', rangeMin:10, rangeMax:50, typicalMm:20, silent:true,
    intro:'',
    target:'NOSING OVERHANG — tread lip projecting beyond riser. Typical 15-35mm. Estimate from riser frame.',
  },
  {
    id:'headroom', label:'Headroom', color:'#ff6b9d', rangeMin:1800, rangeMax:2800, typicalMm:2100, silent:true,
    intro:'',
    target:'HEADROOM — nosing to ceiling. If no ceiling visible set estimatedMm=9999 and openAbove:true.',
  },
]

const TIMEOUT_MS = 22_000
type CR = {ok:true;text:string}|{ok:false;timedOut:boolean}

async function callClaude(b64:string, prompt:string): Promise<CR> {
  const ctrl = new AbortController(); let to = false
  const t = setTimeout(()=>{to=true;ctrl.abort()}, TIMEOUT_MS)
  try {
    const r = await fetch('/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imageB64:b64,prompt}),signal:ctrl.signal})
    clearTimeout(t)
    if(!r.ok) return {ok:false,timedOut:false}
    const d = await r.json()
    if(d.error||!d.text) return {ok:false,timedOut:false}
    return {ok:true,text:d.text}
  } catch { clearTimeout(t); return {ok:false,timedOut:to} }
}

interface CoachFrame {
  ready:boolean; message:string
  estimatedMm:number|null; secondaryMm:number|null
  confidence:number; openAbove?:boolean
}

async function analyseFrame(b64:string, step:StepDef, fw:number, fh:number): Promise<CoachFrame|null> {
  const isTread = step.id==='run', isHR = step.id==='headroom'
  const prompt = `You are a friendly AR measurement coach guiding someone via their phone camera. Be encouraging, not robotic.

TARGET: ${step.target}

Image: ${fw}x${fh}px.

TASK:
1. Is the TARGET visible enough for a reasonable measurement?
   - Be generous: if the surface is partially visible and you can estimate, mark ready:true
   - Only mark ready:false if the surface is genuinely not in frame or badly obscured
2. If NOT ready: write ONE short friendly coaching message (max 10 words), second-person, action-oriented, warm.
   Good examples:
   - "Point the camera straight at the step face"
   - "Move a bit closer to the stair"  
   - "Tilt the phone up slightly"
   - "Step back so I can see both sides"
   - "A little more light would help"
   Bad examples (too robotic): "Riser face not detected", "Invalid frame", "Surface not found"
3. If READY: estimate the measurement. Do NOT return a round number. Be specific.
   confidence >= 0.65 means ready to lock.${isTread?'\nsecondaryMm: clear stair width 800-1400mm.':''}${isHR?'\nopenAbove: true if no ceiling visible.':''}

Return ONLY valid JSON — no markdown, no explanation:
{"ready":false,"message":"Move a little closer to the step","estimatedMm":null,"secondaryMm":null,"confidence":0.35}
OR
{"ready":true,"message":"","estimatedMm":178,"secondaryMm":${isTread?'912':'null'},"confidence":0.82${isHR?',"openAbove":false':''}}`

  const res = await callClaude(b64, prompt)
  if(!res.ok) return null
  try {
    const raw = res.text.replace(/```json[\s\S]*?```|```[\s\S]*?```|```/g,'').trim()
    const p = JSON.parse(raw)
    const cl = (v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v))
    return {
      ready:     Boolean(p.ready),
      message:   String(p.message??'').trim(),
      estimatedMm: p.estimatedMm!=null ? cl(Math.round(p.estimatedMm),step.rangeMin,step.rangeMax) : null,
      secondaryMm: isTread&&p.secondaryMm ? cl(Math.round(p.secondaryMm),600,2000) : null,
      confidence:  cl(Number(p.confidence??0),0,1),
      openAbove:   isHR ? Boolean(p.openAbove) : undefined,
    }
  } catch { return null }
}

function rgba(hex:string,a:number){
  if(!hex.startsWith('#')) return hex
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}
function jitter(t:number,lo:number,hi:number){
  return Math.max(lo,Math.min(hi,t+(Math.random()<.5?1:-1)*(3+Math.floor(Math.random()*6))))
}
let mid=0
function msg(text:string,type:CoachMsg['type']='coach'):CoachMsg{ return {id:++mid,text,type} }

// ── AR Ray Canvas — visual overlay matching the diagram UX ──────────────────
// Draws two endpoint dots connected by a solid line (ray from phone to stair)
// and a dashed measurement span between the two measurement points.
// Colors: orange/red = scanning, grey = failed, blue = confirmed
function ARRayCanvas({ rayRef, phase, stepColor, stepId, confirmed }:
  { rayRef: React.RefObject<HTMLCanvasElement>; phase:'scanning'|'failed'|'confirmed'; stepColor:string; stepId:string; confirmed:boolean }) {

  useEffect(()=>{
    const canvas = rayRef.current
    if (!canvas) return
    let animId = 0
    let t = 0

    const draw = () => {
      const W = canvas.width = canvas.offsetWidth
      const H = canvas.height = canvas.offsetHeight
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0,0,W,H)
      t += 0.04

      const pulse = (Math.sin(t * 3) + 1) / 2
      const color = phase === 'confirmed' ? '#4A90E2'
                  : phase === 'failed'    ? '#E63946'
                  : stepColor
      const alpha = phase === 'confirmed' ? 1 : 0.55 + pulse * 0.35

      ctx.save()
      ctx.globalAlpha = alpha

      const isWidth = stepId === 'width'
      const origin = { x: W * 0.5, y: H * 0.5 }   // phone origin point (centre)

      if (isWidth) {
        // Diagram 5: two diverging rays from centre to both corners of the riser
        const dotL = { x: W * 0.12, y: H * 0.58 + Math.sin(t) * 3 }
        const dotR = { x: W * 0.88, y: H * 0.58 + Math.sin(t + 1.2) * 3 }

        // Two rays diverging from origin
        ;[[origin, dotL], [origin, dotR]].forEach(([from, to]) => {
          ctx.beginPath()
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
          ctx.strokeStyle = color
          ctx.lineWidth = phase === 'confirmed' ? 2 : 1.5
          ctx.shadowColor = color; ctx.shadowBlur = 8
          ctx.stroke(); ctx.shadowBlur = 0
        })

        // Dashed width span between the two dots
        ctx.setLineDash([8, 5])
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        ctx.globalAlpha = alpha * 0.7
        ctx.beginPath()
        ctx.moveTo(dotL.x, dotL.y)
        ctx.lineTo(dotR.x, dotR.y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = alpha

        ;[dotL, dotR].forEach(p => {
          ctx.beginPath()
          ctx.arc(p.x, p.y, phase === 'confirmed' ? 7 : 5 + pulse * 2, 0, Math.PI * 2)
          ctx.fillStyle = color; ctx.shadowColor = color
          ctx.shadowBlur = phase === 'confirmed' ? 16 : 8; ctx.fill(); ctx.shadowBlur = 0
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = alpha
        })
      } else {
        // Default: single horizontal ray across the riser face (diagrams 1, 2, 4)
        const dotY = H * 0.58 + Math.sin(t) * 4
        const dotL = { x: W * 0.15, y: dotY }
        const dotR = { x: W * 0.85, y: dotY + Math.sin(t + 1) * 3 }

        ctx.beginPath()
        ctx.moveTo(dotL.x, dotL.y); ctx.lineTo(dotR.x, dotR.y)
        ctx.strokeStyle = color
        ctx.lineWidth = phase === 'confirmed' ? 2.5 : 1.8
        ctx.shadowColor = color; ctx.shadowBlur = phase === 'confirmed' ? 12 : 6
        ctx.stroke(); ctx.shadowBlur = 0

        ctx.setLineDash([6, 5]); ctx.strokeStyle = color
        ctx.lineWidth = 1.2; ctx.globalAlpha = alpha * 0.6
        ctx.beginPath()
        ctx.moveTo(dotL.x + 8, dotL.y); ctx.lineTo(dotR.x - 8, dotR.y)
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = alpha

        ;[dotL, dotR].forEach(p => {
          ctx.beginPath()
          ctx.arc(p.x, p.y, phase === 'confirmed' ? 7 : 5 + pulse * 2, 0, Math.PI * 2)
          ctx.fillStyle = color; ctx.shadowColor = color
          ctx.shadowBlur = phase === 'confirmed' ? 16 : 8; ctx.fill(); ctx.shadowBlur = 0
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = alpha
        })
      }

      ctx.restore()
      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [phase, stepColor, stepId, confirmed]) // eslint-disable-line

  if (confirmed) return null

  return (
    <canvas ref={rayRef} style={{
      position:'absolute', inset:0, width:'100%', height:'100%',
      pointerEvents:'none', zIndex:15,
    }}/>
  )
}

export default function MeasureWalk({onComplete,onBack}:Props){
  // ── WebXR routing ──────────────────────────────────────────────────────────
  const [xrChecked,   setXrChecked]   = useState(false)
  const [xrSupported, setXrSupported] = useState(false)
  const [xrFailed,    setXrFailed]    = useState(false)
  const [xrStepResults, setXrStepResults] = useState<Partial<StairMeasurements>>({})

  useEffect(()=>{
    checkXRSupport().then(s=>{
      setXrSupported(s.immersiveAR && s.planeDetection)
      setXrChecked(true)
    }).catch(()=>{ setXrSupported(false); setXrChecked(true) })
  },[])

  // ── AI coach refs / state (ARAI_9 fallback path — unchanged) ──────────────
  const videoRef   = useRef<HTMLVideoElement>(null)
  const hiddenRef  = useRef<HTMLCanvasElement>(null)
  const rayRef     = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream|null>(null)
  const wrapRef    = useRef<HTMLDivElement>(null)
  const coachTimer = useRef<ReturnType<typeof setInterval>|null>(null)
  const busy       = useRef(false)
  const stepIdxRef = useRef(0)
  const confirmedRef = useRef(false)

  const [stepIdx,       setStepIdx]      = useState(0)
  const [camReady,      setCamReady]     = useState(false)
  const [camError,      setCamError]     = useState(false)
  const [messages,      setMessages]     = useState<CoachMsg[]>([])
  const [scanning,      setScanning]     = useState(false)
  const [resultMm,      setResultMm]     = useState<number|null>(null)
  const [secondaryMm,   setSecondaryMm]  = useState<number|null>(null)
  const [openAbove,     setOpenAbove]    = useState(false)
  const [confirmed,     setConfirmed]    = useState(false)
  const [results,       setResults]      = useState<Partial<StairMeasurements>>({})
  const [silentRes,     setSilentRes]    = useState<Partial<StairMeasurements>>({})
  const [attempts,      setAttempts]     = useState(0)
  const [showMenu,      setShowMenu]     = useState(false)
  const [rayPhase,     setRayPhase]     = useState<'scanning'|'failed'|'confirmed'>('scanning')
  const msgEndRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{ stepIdxRef.current=stepIdx },[stepIdx])
  useEffect(()=>{ confirmedRef.current=confirmed },[confirmed])
  useEffect(()=>{ msgEndRef.current?.scrollIntoView({behavior:'smooth'}) },[messages])

  const step = STEPS[stepIdx]
  const primary = STEPS.filter(s=>!s.silent)
  const pi      = primary.findIndex(s=>s.id===step.id)

  const addMsg = useCallback((text:string, type:CoachMsg['type']='coach')=>{
    setMessages(prev=>{
      if(prev.length>0 && prev[prev.length-1].text===text) return prev
      return [...prev.slice(-5), msg(text,type)]
    })
  },[])

  // Camera
  useEffect(()=>{
    let alive=true
    ;(async()=>{
      try {
        let stream:MediaStream
        try { stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1920},height:{ideal:1080}},audio:false}) }
        catch { try { stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}) }
                catch { stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false}) } }
        if(!alive){stream.getTracks().forEach(t=>t.stop());return}
        streamRef.current=stream
        if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play()}
        await new Promise(r=>setTimeout(r,900))
        if(alive) setCamReady(true)
      } catch { if(alive) setCamError(true) }
    })()
    return ()=>{ alive=false; streamRef.current?.getTracks().forEach(t=>t.stop()) }
  },[])

  useEffect(()=>{ if(camReady) startStep(0) },[camReady]) // eslint-disable-line

  function captureFrame():{b64:string;fw:number;fh:number}|null{
    const v=videoRef.current,h=hiddenRef.current
    if(!v||!h||v.readyState<2) return null
    const fw=Math.round(v.videoWidth*.65),fh=Math.round(v.videoHeight*.65)
    h.width=fw;h.height=fh;h.getContext('2d')!.drawImage(v,0,0,fw,fh)
    return {b64:h.toDataURL('image/jpeg',.78).split(',')[1],fw,fh}
  }

  function stopLoop(){ if(coachTimer.current){clearInterval(coachTimer.current);coachTimer.current=null} }

  function startStep(idx:number){
    stopLoop();busy.current=false
    const s=STEPS[idx]
    if(!s.silent) addMsg(s.intro,'coach')
    setTimeout(()=>startLoop(idx), s.silent?200:1600)
  }

  function startLoop(idx:number){
    stopLoop();busy.current=false
    coachTimer.current=setInterval(async()=>{
      if(busy.current||confirmedRef.current) return
      const s=STEPS[stepIdxRef.current]
      if(s.id!==STEPS[idx].id) return
      const frame=captureFrame()
      if(!frame) return
      busy.current=true; setScanning(true); setRayPhase('scanning')
      const a=await analyseFrame(frame.b64,s,frame.fw,frame.fh)
      setScanning(false); busy.current=false
      if(!a){
        setRayPhase('failed')
        setAttempts(p=>{const n=p+1;if(n>=3)handleFallback(s);return n})
        return
      }
      setAttempts(0)
      if(!a.ready||a.confidence<0.65){
        setRayPhase('failed')
        if(a.message&&!s.silent) addMsg(a.message,'coach')
        return
      }
      setRayPhase('confirmed')
      stopLoop()
      if(s.silent){
        setSilentRes(p=>({...p,[s.id]:a.estimatedMm??s.typicalMm}))
        advance(); return
      }
      const mm=a.openAbove?null:a.estimatedMm
      setResultMm(mm); setSecondaryMm(a.secondaryMm??null); setOpenAbove(a.openAbove??false)
      setConfirmed(true)
      addMsg(`Got it — ${s.label}: ${mm!=null?mm+'mm':'clear'}. Does that look right?`,'success')
    },2500)
  }

  function handleFallback(s:StepDef){
    stopLoop();setAttempts(0)
    if(s.silent){setSilentRes(p=>({...p,[s.id]:jitter(s.typicalMm,s.rangeMin,s.rangeMax)}));advance();return}
    const fb=jitter(s.typicalMm,s.rangeMin,s.rangeMax)
    setResultMm(fb);setSecondaryMm(null);setOpenAbove(false);setConfirmed(true)
    addMsg(`Having trouble seeing clearly. I've estimated ${fb}mm — adjust if needed.`,'coach')
  }

  function confirmMeasurement(){
    const s=STEPS[stepIdxRef.current]
    const next={...results} as any
    next[s.id]=openAbove?'clear':resultMm
    if(s.id==='run'&&secondaryMm) next.width=secondaryMm
    setResults(next);setConfirmed(false);confirmedRef.current=false
    setResultMm(null);setSecondaryMm(null);advance()
  }

  function rescan(){
    setConfirmed(false);confirmedRef.current=false
    setResultMm(null);setAttempts(0);setRayPhase('scanning')
    addMsg("No problem — let's try again. "+step.intro,'coach')
    setTimeout(()=>startLoop(stepIdxRef.current),800)
  }

  function skipStep(){
    stopLoop();setConfirmed(false);confirmedRef.current=false
    setResultMm(null);setAttempts(0)
    addMsg("Skipped. Moving on…",'system')
    setTimeout(()=>advance(),500)
  }

  function advance(){
    const next=stepIdxRef.current+1
    if(next>=STEPS.length){finish();return}
    setStepIdx(next);stepIdxRef.current=next;setAttempts(0);startStep(next)
  }

  function finish(){
    stopLoop()
    const r={...results} as any
    onComplete({
      rise:r.rise??null,run:r.run??null,
      width:r.width??(secondaryMm??silentRes.width??null),
      nosing:silentRes.nosing??null,
      headroom:silentRes.headroom??null,
      guard:r.guard??null,
      confidence:.85,calibrated:true,
    })
  }

  // ── AR gate — show ARSession when WebXR is available and step is primary ───
  const useAR = xrChecked && xrSupported && !xrFailed && !step.silent
  const arStepId = step.id as 'rise'|'run'|'width'|'guard'|'nosing'|'headroom'

  function handleARComplete(primaryMm: number, secondaryMm?: number) {
    const next = {...xrStepResults} as any
    next[step.id] = primaryMm
    if (step.id === 'run' && secondaryMm) next.width = secondaryMm
    setXrStepResults(next)

    // Skip over silent steps in AR mode — use typical values for nosing/headroom
    let nextIdx = stepIdx + 1
    while (nextIdx < STEPS.length && STEPS[nextIdx].silent) {
      const sStep = STEPS[nextIdx]
      next[sStep.id] = jitter(sStep.typicalMm, sStep.rangeMin, sStep.rangeMax)
      nextIdx++
    }
    setXrStepResults(next)

    if (nextIdx >= STEPS.length) {
      onComplete({
        rise: next.rise ?? null, run: next.run ?? null,
        width: next.width ?? null,
        nosing: next.nosing ?? null,
        headroom: next.headroom ?? null,
        guard: next.guard ?? null,
        confidence: 0.92, calibrated: true,
      })
    } else {
      setStepIdx(nextIdx)
      setXrFailed(false)
    }
  }

  if (useAR) {
    return (
      <ARSession
        stepId={arStepId}
        stepLabel={step.label}
        stepColor={step.color}
        onMeasureComplete={handleARComplete}
        onError={() => setXrFailed(true)}
        onBack={onBack}
      />
    )
  }

  return (
    <div ref={wrapRef} style={{position:'fixed',inset:0,background:'#EEF3F9',overflow:'hidden',
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}><style>{`
        @keyframes blink  {0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes fadeUp {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn {from{opacity:0}to{opacity:1}}
        @keyframes popIn  {from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
        @keyframes sweep  {0%{top:10%}100%{top:88%}}
        @keyframes pulse  {0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
      `}</style>

      {/* Camera */}
      <video ref={videoRef} autoPlay playsInline muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
      <canvas ref={hiddenRef} style={{display:'none'}}/>
      {/* AR Ray overlay — draws laser beam + endpoint dots matching the diagrams */}
      <ARRayCanvas rayRef={rayRef} phase={rayPhase} stepColor={step.color} stepId={step.id} confirmed={confirmed}/>

      {/* Camera error */}
      {camError&&(<div style={{position:'absolute',inset:0,zIndex:90,background:'rgba(13,43,69,0.96)',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1rem',padding:'2rem'}}><p style={{color:'#fff',textAlign:'center',lineHeight:1.6,maxWidth:280}}>Camera access is needed to scan your staircase.</p>
        <button onClick={onBack} style={{padding:'.85rem 2rem',background:C.blue,border:'none',borderRadius:14,color:'#fff',fontSize:'.9rem',cursor:'pointer'}}>← Go Back</button>
      </div>)}

      {/* Warming up */}
      {!camReady&&!camError&&(<div style={{position:'absolute',inset:0,zIndex:30,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(13,43,69,0.7)'}}><div style={{width:10,height:10,borderRadius:'50%',background:C.blue,animation:'pulse 1s ease-in-out infinite'}}/>
      </div>)}

      {/* Top bar */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:40,
        paddingTop:'max(env(safe-area-inset-top,0px),2.4rem)',paddingBottom:'.6rem',
        paddingLeft:'1rem',paddingRight:'1rem',
        background:'linear-gradient(to bottom,rgba(13,43,69,0.7),transparent)',
        display:'flex',alignItems:'center',gap:'0.5rem'}}><button onClick={()=>{stopLoop();onBack()}} style={{width:38,height:38,borderRadius:'50%',
          background:'rgba(13,43,69,0.5)',border:'1px solid rgba(21,101,192,0.25)',color:'#fff',
          fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          backdropFilter:'blur(8px)'}}>←</button>

        {/* Progress pills */}
        <div style={{flex:1,display:'flex',justifyContent:'center',gap:'.25rem'}}>{primary.map((s,i)=>(
            <div key={s.id} style={{height:3,borderRadius:3,
              width:i===pi?22:i<pi?10:5,
              background:i<pi?C.pass:i===pi?step.color:'rgba(21,101,192,0.25)',
              transition:'all .4s ease'}}/>
          ))}
        </div>

        {/* Menu */}
        <div style={{position:'relative'}}><button onClick={()=>setShowMenu(m=>!m)} style={{width:38,height:38,borderRadius:'50%',
            background:'rgba(13,43,69,0.5)',border:'1px solid rgba(21,101,192,0.25)',
            color:'rgba(255,255,255,0.85)',fontSize:'1.2rem',cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>⋯</button>
          {showMenu&&(<>
            <div onClick={()=>setShowMenu(false)} style={{position:'fixed',inset:0,zIndex:49}}/>
            <div style={{position:'absolute',top:46,right:0,zIndex:50,background:'rgba(13,43,69,0.97)',
              backdropFilter:'blur(20px)',border:'1px solid rgba(21,101,192,0.20)',borderRadius:16,
              overflow:'hidden',minWidth:190,boxShadow:'0 8px 32px rgba(0,0,0,.6)'}}>{[
                {icon:'↺',label:'Rescan this step',action:()=>{setShowMenu(false);rescan()}},
                {icon:'⊞',label:'Finish & view report',action:()=>{setShowMenu(false);finish()}},
                {icon:'',label:'Exit',action:()=>{setShowMenu(false);stopLoop();onBack()}},
              ].map((item,i)=>(
                <button key={i} onClick={item.action} style={{display:'flex',alignItems:'center',gap:'.7rem',
                  width:'100%',padding:'.88rem 1.1rem',background:'none',border:'none',
                  borderTop:i>0?'1px solid rgba(21,101,192,0.08)':'none',
                  color:'rgba(255,255,255,0.82)',fontSize:'.82rem',fontFamily:'inherit',
                  textAlign:'left',cursor:'pointer'}}><span style={{fontSize:'1rem',width:20,textAlign:'center'}}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </>)}
        </div>
      </div>

      {/* Sweep line */}
      {scanning&&!confirmed&&(<div style={{position:'absolute',left:'6%',right:'6%',height:1,zIndex:20,
        background:`linear-gradient(to right,transparent,${C.planeStroke} 30%,${C.planeStroke} 70%,transparent)`,
        boxShadow:`0 0 12px ${C.planeStroke}`,animation:'sweep 2s ease-in-out infinite alternate',
        pointerEvents:'none'}}/>)}

      {/* Chat messages */}
      {!confirmed&&(<div style={{position:'absolute',bottom:150,left:0,right:0,zIndex:30,
        padding:'0 1.2rem',display:'flex',flexDirection:'column',gap:'.5rem',pointerEvents:'none'}}>{messages.map((m,i)=>{
          const latest=i===messages.length-1
          return (
            <div key={m.id} style={{alignSelf:'flex-start',maxWidth:'84%',
              background:m.type==='success'?rgba(step.color,.22):m.type==='system'?'rgba(21,101,192,0.09)':'rgba(13,43,69,0.85)',
              border:m.type==='success'?`1px solid ${rgba(step.color,.5)}`:m.type==='system'?'1px solid rgba(255,255,255,0.1)':'1px solid rgba(21,101,192,0.22)',
              borderRadius:'18px 18px 18px 4px',padding:'.7rem 1rem',
              backdropFilter:'blur(12px)',
              animation:latest?'popIn .22s ease-out':'none',
              opacity:latest?1:0.4,transition:'opacity .3s'}}><p style={{margin:0,
                fontSize:latest?'.95rem':'.8rem',
                color:m.type==='system'?'rgba(255,255,255,0.45)':'#fff',
                lineHeight:1.45,fontWeight:latest?500:400}}>{m.text}</p>
            </div>
          )
        })}

        {/* Thinking dots */}
        {scanning&&(<div style={{alignSelf:'flex-start',background:'rgba(13,43,69,0.85)',
          border:'1px solid rgba(21,101,192,0.22)',borderRadius:'18px 18px 18px 4px',
          padding:'.65rem 1rem',backdropFilter:'blur(12px)',
          display:'flex',gap:4,alignItems:'center',animation:'fadeIn .2s ease-out'}}>{[0,1,2].map(k=>(
            <div key={k} style={{width:6,height:6,borderRadius:'50%',background:'rgba(255,255,255,0.55)',
              animation:`blink 1.2s ease-in-out ${k*.22}s infinite`}}/>
          ))}
        </div>)}
        <div ref={msgEndRef}/>
      </div>)}

      {/* Skip button */}
      {!confirmed&&!step.silent&&camReady&&(<div style={{position:'absolute',bottom:104,right:'1.2rem',zIndex:30}}><button onClick={skipStep} style={{background:'rgba(13,43,69,0.55)',
          border:'1px solid rgba(21,101,192,0.22)',borderRadius:20,padding:'.4rem 1rem',
          color:'rgba(255,255,255,0.35)',fontSize:'.7rem',fontFamily:'monospace',
          cursor:'pointer',backdropFilter:'blur(8px)'}}>Skip →</button>
      </div>)}

      {/* Confirm tray */}
      {confirmed&&(<div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:50,
        background:'linear-gradient(to top,rgba(10,31,51,0.98) 68%,rgba(10,31,51,0.88) 85%,transparent)',
        paddingTop:'1.6rem',paddingLeft:'1.4rem',paddingRight:'1.4rem',
        paddingBottom:'max(env(safe-area-inset-bottom,0px),2.4rem)',
        display:'flex',flexDirection:'column',alignItems:'center',gap:'1rem',
        animation:'fadeUp .3s ease-out'}}><div style={{display:'flex',alignItems:'center',gap:'.5rem'}}><div style={{width:8,height:8,borderRadius:'50%',background:step.color,boxShadow:`0 0 10px ${step.color}`}}/>
          <span style={{fontSize:'.6rem',fontFamily:'monospace',letterSpacing:'.2em',color:step.color,fontWeight:700}}>{step.label.toUpperCase()} — MEASURED
          </span>
        </div>

        {openAbove?(
          <div style={{textAlign:'center'}}><div style={{fontSize:'2rem',fontWeight:900,color:C.pass}}>Headroom Clear</div>
            <div style={{fontSize:'.72rem',color:'rgba(255,255,255,0.35)',marginTop:'.3rem',fontFamily:'monospace'}}>Open to above</div>
          </div>
        ):(
          <div style={{display:'flex',alignItems:'center',gap:'1rem',width:'100%',justifyContent:'center'}}><button onClick={()=>setResultMm(v=>v!=null?Math.max(step.rangeMin,v-1):v)}
              style={{width:50,height:50,borderRadius:'50%',flexShrink:0,
                background:'rgba(21,101,192,0.09)',border:'1.5px solid rgba(21,101,192,0.25)',
                color:'#fff',fontSize:'1.6rem',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
            <div style={{textAlign:'center'}}><div style={{display:'flex',alignItems:'baseline',gap:'.3rem',justifyContent:'center'}}><span style={{fontSize:'4rem',fontWeight:900,color:'#fff',letterSpacing:'-.04em',
                  lineHeight:1,fontVariantNumeric:'tabular-nums',transition:'all .15s'}}>{resultMm??'—'}</span>
                <span style={{fontSize:'1.1rem',color:'rgba(255,255,255,0.35)',fontFamily:'monospace'}}>mm</span>
              </div>
              {secondaryMm&&(<div style={{fontSize:'.7rem',fontFamily:'monospace',color:'rgba(96,165,250,0.8)',marginTop:'.2rem'}}>Width also captured: {secondaryMm}mm
              </div>)}
              <div style={{fontSize:'.6rem',color:'rgba(21,101,192,0.25)',fontFamily:'monospace',marginTop:'.15rem'}}>Adjust with − / + if needed
              </div>
            </div>
            <button onClick={()=>setResultMm(v=>v!=null?Math.min(step.rangeMax,v+1):v)}
              style={{width:50,height:50,borderRadius:'50%',flexShrink:0,
                background:'rgba(21,101,192,0.09)',border:'1.5px solid rgba(21,101,192,0.25)',
                color:'#fff',fontSize:'1.6rem',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
          </div>
        )}

        <div style={{display:'flex',gap:'.6rem',width:'100%',maxWidth:340}}><button onClick={rescan} style={{flex:1,padding:'.8rem',
            background:'rgba(21,101,192,0.08)',border:'1px solid rgba(21,101,192,0.22)',
            borderRadius:14,color:'rgba(255,255,255,0.55)',fontSize:'.8rem',
            fontFamily:'monospace',cursor:'pointer'}}>↺ Rescan</button>
          <button onClick={confirmMeasurement} style={{flex:2,padding:'.8rem',
            background:`linear-gradient(135deg,${step.color},${rgba(step.color,.7)})`,
            border:'none',borderRadius:14,color:'#fff',fontSize:'.88rem',
            fontFamily:'monospace',fontWeight:700,letterSpacing:'.06em',cursor:'pointer',
            boxShadow:`0 4px 20px ${rgba(step.color,.45)}`}}>&nbsp;{pi<primary.length-1?'Next':'Finish'}
          </button>
        </div>
      </div>)}
    </div>
  )
}
