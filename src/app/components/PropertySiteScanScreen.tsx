'use client'
/**
 * PropertySiteScanScreen.tsx
 *
 * Camera scan for the Property Setup phase.
 * User photographs the building exterior; Claude Vision analyses the image and
 * auto-fills: building type, estimated age, wall construction, roof covering,
 * footing type, stories, and general condition notes.
 *
 * User reviews and adjusts AI pre-fills before saving.
 * Mirrors the scan/analysing/result/review pattern of FoundationScanScreen.
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import type { BuildingType, RoofCovering, FootingType, WallConstruction } from '@/lib/inspection-types'

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const GREEN  = '#27A96B'
const AMBER  = '#FA741F'
const WHITE  = '#E8F4FF'
const WHITE2 = '#93BAD4'
const BORDER = 'rgba(147,186,212,0.15)'

export interface PropertyScanResult {
  buildingType:      BuildingType
  buildingTypeLabel: string
  estimatedAge:      string
  wallConstruction:  WallConstruction
  wallLabel:         string
  roofCovering:      RoofCovering
  roofLabel:         string
  footingType:       FootingType
  internalWalls:     string
  windows:           string
  stories:           number
  overallCondition:  string
  aiNotes:           string
  confidence:        number
  photoB64:          string
}

interface Props {
  onResult: (result: PropertyScanResult) => void
  onSkip:   () => void
  address:  string
}

type Stage = 'intro' | 'ready' | 'hold' | 'capture' | 'analysing' | 'result'

const AI_PROMPT = (address: string) => `You are an experienced building inspector analysing a residential property exterior photo.

Property address: ${address || 'Not provided'}

Analyse this building photo and extract construction details. Use every visible clue: cladding material, window type, roof profile, brick colour, mortar style, construction era cues.

IDENTIFY:
1. Building type (choose one exactly):
   single_storey_residential | two_storey_residential | semi_detached | townhouse | multi_unit_residential | commercial | mixed_use | other

2. Estimated age (descriptive string, e.g. "Approx. 1960s–1970s" or "Post-2000 construction"):
   Use architectural style, materials, window profiles, brick pattern as clues.

3. Wall construction (choose one):
   brick_veneer | double_brick | timber_frame | concrete_block | icf | steel_frame | other | unknown

4. Roof covering (choose one, if visible):
   concrete_tiles | clay_tiles | metal_deck | asphalt_shingles | flat_membrane | other | unknown

5. Footing type (infer from building age, type, and region):
   concrete_slab | piers_stumps | strip_footing | unknown

6. Stories (count above grade): integer 1–4+

7. Window type (e.g. "Aluminium double-hung", "Vinyl casement", "Wood frame")

8. Internal walls (typical for building era: "Plasterboard", "Plaster on lath", "Drywall")

9. Overall condition (choose one): above_average | good | typical | fair | poor

10. Notes (1-2 sentences of notable observations: cracks, efflorescence, maintenance state, additions, etc.)

Reply ONLY with valid JSON, no markdown:
{
  "buildingType": "string",
  "buildingTypeLabel": "human-readable label",
  "estimatedAge": "string",
  "wallConstruction": "string",
  "wallLabel": "human-readable label",
  "roofCovering": "string",
  "roofLabel": "human-readable label",
  "footingType": "string",
  "stories": number,
  "windows": "string",
  "internalWalls": "string",
  "overallCondition": "string",
  "aiNotes": "string",
  "confidence": 0.0–1.0
}`

function PositionIllustration() {
  return (
    <div style={{ width:'100%', borderRadius:10, overflow:'hidden', border:`1px solid ${BORDER}` }}>
      <svg width="100%" height="180" viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="180" fill="#0A1C2E"/>
        {/* House outline */}
        <path d="M80 140V90L140 50L200 90V140H80Z" fill="rgba(65,124,164,0.12)" stroke="rgba(65,124,164,0.6)" strokeWidth="1.5"/>
        {/* Roof */}
        <path d="M70 92L140 45L210 92" stroke="rgba(65,124,164,0.8)" strokeWidth="2" strokeLinecap="round"/>
        {/* Door */}
        <rect x="125" y="110" width="30" height="30" fill="rgba(65,124,164,0.2)" stroke="rgba(65,124,164,0.5)" strokeWidth="1"/>
        {/* Windows */}
        <rect x="85" y="105" width="28" height="22" fill="rgba(65,124,164,0.15)" stroke="rgba(65,124,164,0.5)" strokeWidth="1"/>
        <rect x="167" y="105" width="28" height="22" fill="rgba(65,124,164,0.15)" stroke="rgba(65,124,164,0.5)" strokeWidth="1"/>
        {/* Ground line */}
        <line x1="50" y1="140" x2="270" y2="140" stroke="rgba(147,186,212,0.3)" strokeWidth="1.5" strokeDasharray="4,3"/>
        {/* Person / phone icon */}
        <rect x="228" y="100" width="28" height="48" rx="4" fill="rgba(242,147,55,0.15)" stroke={AMBER} strokeWidth="1.5"/>
        <circle cx="242" cy="113" r="4" fill={AMBER} fillOpacity="0.6"/>
        {/* Arrow toward house */}
        <path d="M224 124H205" stroke={AMBER} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M210 120L204 124L210 128" fill={AMBER}/>
        {/* Labels */}
        <text x="160" y="160" textAnchor="middle" fontSize="9" fill="rgba(147,186,212,0.7)" fontFamily="monospace">STAND BACK — FULL BUILDING VISIBLE</text>
        <text x="160" y="172" textAnchor="middle" fontSize="8" fill="rgba(147,186,212,0.45)" fontFamily="monospace">INCLUDE ROOF, WALLS, GROUND LEVEL</text>
      </svg>
    </div>
  )
}

export default function PropertySiteScanScreen({ onResult, onSkip, address }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const busyRef     = useRef(false)

  const [stage,     setStage]   = useState<Stage>('intro')
  const [countdown, setCountdown] = useState(0)
  const [camReady,  setCamReady] = useState(false)
  const [camWarm,   setCamWarm]  = useState(false)
  const [camError,  setCamError] = useState(false)
  const [aiResult,  setAiResult] = useState<PropertyScanResult | null>(null)
  const [aiError,   setAiError]  = useState<string | null>(null)
  const [capturedB64, setCapturedB64] = useState<string | null>(null)

  // ── Camera ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    async function start(attempt = 0) {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
      if (attempt > 0) await new Promise(r => setTimeout(r, 300 * attempt))
      const constraints: MediaStreamConstraints[] = [
        { video: { facingMode: 'environment' }, audio: false },
        { video: true, audio: false },
      ]
      let stream: MediaStream | null = null
      for (const c of constraints) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break }
        catch (e: any) { if (e?.name === 'NotReadableError' && attempt < 3) return start(attempt + 1) }
      }
      if (!stream) { if (alive) setCamError(true); return }
      if (!alive)  { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      const attach = () => {
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream!; v.muted = true; v.playsInline = true; v.play().catch(() => {})
      }
      attach()
      let waited = 0
      const poll = setInterval(() => {
        if (!alive) { clearInterval(poll); return }
        waited += 100
        const v = videoRef.current
        if (v && !v.srcObject && streamRef.current) attach()
        if (v && v.videoWidth > 0) { clearInterval(poll); if (alive) setCamReady(true) }
        if (waited > 8000) { clearInterval(poll); if (alive) setCamReady(true) }
      }, 100)
    }
    start()
    return () => { alive = false; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  // Re-attach on active stages
  useEffect(() => {
    if (['hold','capture','analysing','result'].includes(stage)) {
      const v = videoRef.current
      if (v && streamRef.current && !v.srcObject) { v.srcObject = streamRef.current; v.muted = true; v.play().catch(() => {}) }
    }
  }, [stage])

  // Countdown
  useEffect(() => {
    if (stage !== 'hold' || countdown <= 0) {
      if (stage === 'hold' && countdown <= 0) setStage('capture')
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  function captureFrame(): string | null {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c || v.videoWidth === 0 || v.readyState < 2) return null
    const MAX = 1600
    const ratio = Math.min(1, MAX / Math.max(v.videoWidth, v.videoHeight))
    c.width  = Math.round(v.videoWidth  * ratio)
    c.height = Math.round(v.videoHeight * ratio)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const probe = ctx.getImageData(c.width >> 1, c.height >> 1, 4, 4).data
    if (Array.from(probe).every((_, i) => i % 4 === 3 || probe[i] < 8)) return null
    return c.toDataURL('image/jpeg', 0.88).split(',')[1]
  }

  const handleCapture = useCallback(async () => {
    if (busyRef.current) return
    let b64: string | null = null
    for (let i = 0; i < 6; i++) { b64 = captureFrame(); if (b64) break; await new Promise(r => setTimeout(r, 250)) }
    if (!b64) { setStage('capture'); return }
    busyRef.current = true
    setCapturedB64(b64)
    setStage('analysing')

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageB64: b64, prompt: AI_PROMPT(address) }),
      })
      if (!res.ok) throw new Error('Vision API error')
      const data = await res.json()
      const raw  = data.text ?? ''
      const m    = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (!m) throw new Error('Could not parse AI response')
      const parsed = JSON.parse(m[0])
      const result: PropertyScanResult = {
        buildingType:      (parsed.buildingType ?? 'single_storey_residential') as BuildingType,
        buildingTypeLabel: parsed.buildingTypeLabel ?? 'Single Storey Residential',
        estimatedAge:      parsed.estimatedAge ?? '',
        wallConstruction:  (parsed.wallConstruction ?? 'unknown') as WallConstruction,
        wallLabel:         parsed.wallLabel ?? '',
        roofCovering:      (parsed.roofCovering ?? 'unknown') as RoofCovering,
        roofLabel:         parsed.roofLabel ?? '',
        footingType:       (parsed.footingType ?? 'unknown') as FootingType,
        internalWalls:     parsed.internalWalls ?? '',
        windows:           parsed.windows ?? '',
        stories:           parsed.stories ?? 1,
        overallCondition:  parsed.overallCondition ?? 'typical',
        aiNotes:           parsed.aiNotes ?? '',
        confidence:        parsed.confidence ?? 0.7,
        photoB64:          b64,
      }
      setAiResult(result)
      setStage('result')
    } catch (err) {
      setAiError('Could not analyse the image. Please retake or skip.')
      setStage('result')
    }
    busyRef.current = false
  }, [address])

  // Trigger capture when stage hits 'capture'
  useEffect(() => {
    if (stage === 'capture' && camWarm) handleCapture()
  }, [stage, camWarm, handleCapture])

  if (camError) return (
    <div style={{ position:'fixed', inset:0, background:NAVY, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'2rem', fontFamily:"inherit" }}>
      <p style={{ color:WHITE, textAlign:'center', lineHeight:1.6 }}>Camera access is required to scan the property. Please allow camera access in your browser settings, then try again.</p>
      <button onClick={onSkip} style={{ padding:'0.8rem 2rem', background:AMBER, border:'none', borderRadius:12, color:'#fff', fontWeight:700, cursor:'pointer' }}>Skip AI Scan — Fill Manually</button>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'#000', overflow:'hidden', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <video ref={videoRef} autoPlay playsInline muted
        // @ts-ignore
        webkit-playsinline="true"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}/>
      <canvas ref={canvasRef} style={{ display:'none' }}/>

      {/* ── Top bar ── */}
      <div style={{ position:'absolute', top:0, left:0, right:0, paddingTop:'max(env(safe-area-inset-top,0px),1rem)', paddingBottom:'0.75rem', paddingLeft:'1rem', paddingRight:'1rem', background:'linear-gradient(to bottom,rgba(10,28,46,0.95),transparent)', zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <button onClick={onSkip} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', fontSize:'0.85rem', cursor:'pointer' }}>← Skip</button>
          <div style={{ flex:1, textAlign:'center', fontSize:'0.78rem', fontWeight:600, color:WHITE2 }}>Property AI Scan</div>
          <div style={{ fontSize:'0.62rem', color:'rgba(255,255,255,0.35)', padding:'0.15rem 0.5rem', border:'1px solid rgba(255,255,255,0.15)', borderRadius:4 }}>SITE PHOTO</div>
        </div>
      </div>

      {/* ── Bottom panel ── */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, paddingBottom:'max(env(safe-area-inset-bottom,0px),1.25rem)', paddingLeft:'1.25rem', paddingRight:'1.25rem', paddingTop:'0.85rem', background:'linear-gradient(to top,rgba(10,28,46,0.99) 70%,rgba(10,28,46,0.6))', zIndex:50, display:'flex', flexDirection:'column', gap:'0.65rem' }}>

        {/* INTRO */}
        {stage === 'intro' && <>
          <PositionIllustration />
          <div style={{ background:'rgba(65,124,164,0.12)', borderRadius:12, padding:'0.75rem 1rem', border:`1px solid ${BORDER}` }}>
            <div style={{ fontSize:'0.65rem', color:BLUE, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' as const, marginBottom:'0.25rem' }}>AI Property Analysis</div>
            <div style={{ fontSize:'0.78rem', color:WHITE2, lineHeight:1.65 }}>
              Stand back so the full building is visible — roof to ground level. The AI will identify building type, construction materials, estimated age, and condition. You can review and adjust all fields before saving.
            </div>
          </div>
          <button onClick={() => { setCamWarm(false); setStage('ready') }}
            style={{ width:'100%', padding:'1.05rem', background:`linear-gradient(135deg,${BLUE},#2C5A7A)`, border:'none', borderRadius:14, color:'#fff', fontSize:'0.95rem', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 20px rgba(65,124,164,0.45)' }}>
            Scan Building Exterior →
          </button>
          <button onClick={onSkip} style={{ background:'none', border:'none', color:WHITE2, fontSize:'0.75rem', cursor:'pointer', textAlign:'center' as const }}>Skip — fill in manually</button>
        </>}

        {/* READY */}
        {stage === 'ready' && <>
          <div style={{ background:'rgba(65,124,164,0.1)', borderRadius:12, padding:'0.75rem 1rem', border:`1px solid ${BORDER}` }}>
            <div style={{ fontSize:'0.78rem', color:WHITE2, lineHeight:1.55 }}>Frame the full building — roof to ground level, all walls visible. Step back far enough to capture the whole structure.</div>
          </div>
          <button onClick={() => { setCamWarm(false); setStage('hold'); setCountdown(4); setTimeout(() => setCamWarm(true), 2500) }}
            style={{ width:'100%', padding:'1.1rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:14, color:'#fff', fontSize:'1rem', fontWeight:700, cursor:'pointer', boxShadow:'0 6px 28px rgba(39,169,107,0.5)' }}>
            Building in frame — Capture →
          </button>
        </>}

        {/* HOLD */}
        {stage === 'hold' && <>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{ position:'relative', width:56, height:56, flexShrink:0 }}>
              <svg width="56" height="56" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4"/>
                <circle cx="28" cy="28" r="22" fill="none" stroke={GREEN} strokeWidth="4"
                  strokeDasharray={`${2*Math.PI*22}`}
                  strokeDashoffset={`${2*Math.PI*22*(countdown/4)}`}
                  strokeLinecap="round" style={{ transition:'stroke-dashoffset 0.9s linear' }}/>
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', fontWeight:700, color:WHITE }}>{countdown}</div>
            </div>
            <div>
              <div style={{ fontSize:'0.9rem', fontWeight:700, color:GREEN, marginBottom:'0.15rem' }}>Hold still</div>
              <div style={{ fontSize:'0.72rem', color:WHITE2 }}>Keep phone steady — capturing full building</div>
            </div>
          </div>
        </>}

        {/* CAPTURE — auto-triggers handleCapture */}
        {stage === 'capture' && <>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:GREEN, animation:'pulse 0.8s ease infinite' }}/>
            <div style={{ fontSize:'0.82rem', color:WHITE2 }}>Capturing image…</div>
            <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}`}</style>
          </div>
        </>}

        {/* ANALYSING */}
        {stage === 'analysing' && <>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <div style={{ width:36, height:36, borderRadius:'50%', border:`3px solid rgba(65,124,164,0.2)`, borderTopColor:BLUE, animation:'spin 0.8s linear infinite', flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:'0.88rem', color:WHITE, fontWeight:600, marginBottom:'0.1rem' }}>Analysing building…</div>
              <div style={{ fontSize:'0.72rem', color:WHITE2 }}>AI identifying construction type, age, materials</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        </>}

        {/* RESULT */}
        {stage === 'result' && <>
          {aiError ? (
            <>
              <div style={{ background:'rgba(232,69,69,0.1)', border:'1px solid rgba(232,69,69,0.3)', borderRadius:10, padding:'0.75rem 1rem', fontSize:'0.78rem', color:'#ff9999' }}>{aiError}</div>
              <button onClick={() => { busyRef.current=false; setCamWarm(false); setAiError(null); setStage('ready') }}
                style={{ width:'100%', padding:'0.85rem', background:`rgba(65,124,164,0.15)`, border:`1px solid ${BORDER}`, borderRadius:12, color:WHITE2, fontSize:'0.85rem', fontWeight:600, cursor:'pointer' }}>↺ Retake</button>
              <button onClick={onSkip} style={{ background:'none', border:'none', color:WHITE2, fontSize:'0.75rem', cursor:'pointer', textAlign:'center' as const }}>Skip — fill in manually</button>
            </>
          ) : aiResult ? (
            <>
              {/* Preview of what AI found */}
              <div style={{ background:'rgba(39,169,107,0.1)', border:'1px solid rgba(39,169,107,0.3)', borderRadius:12, padding:'0.9rem 1rem' }}>
                <div style={{ fontSize:'0.62rem', color:GREEN, fontWeight:700, letterSpacing:'0.08em', marginBottom:'0.45rem' }}>AI ANALYSIS COMPLETE — {Math.round(aiResult.confidence * 100)}% confidence</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.35rem 0.75rem', fontSize:'0.75rem', color:WHITE2, lineHeight:1.5 }}>
                  <div><span style={{ color:WHITE2 }}>Type: </span><span style={{ color:WHITE, fontWeight:600 }}>{aiResult.buildingTypeLabel}</span></div>
                  <div><span style={{ color:WHITE2 }}>Age: </span><span style={{ color:WHITE, fontWeight:600 }}>{aiResult.estimatedAge}</span></div>
                  <div><span style={{ color:WHITE2 }}>Walls: </span><span style={{ color:WHITE, fontWeight:600 }}>{aiResult.wallLabel}</span></div>
                  <div><span style={{ color:WHITE2 }}>Roof: </span><span style={{ color:WHITE, fontWeight:600 }}>{aiResult.roofLabel}</span></div>
                </div>
                {aiResult.aiNotes && <div style={{ fontSize:'0.7rem', color:'rgba(147,186,212,0.7)', marginTop:'0.5rem', lineHeight:1.55, borderTop:`1px solid ${BORDER}`, paddingTop:'0.4rem' }}>{aiResult.aiNotes}</div>}
              </div>
              <button onClick={() => onResult(aiResult)}
                style={{ width:'100%', padding:'1rem', background:`linear-gradient(135deg,${GREEN},#1A7A50)`, border:'none', borderRadius:14, color:'#fff', fontSize:'0.95rem', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 20px rgba(39,169,107,0.45)' }}>
                Use AI Results — Review & Adjust →
              </button>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => { busyRef.current=false; setCamWarm(false); setAiResult(null); setAiError(null); setStage('ready') }}
                  style={{ flex:1, padding:'0.72rem', background:'rgba(255,255,255,0.07)', border:`1px solid ${BORDER}`, borderRadius:11, color:WHITE2, fontSize:'0.75rem', cursor:'pointer' }}>↺ Retake</button>
                <button onClick={onSkip}
                  style={{ flex:1, padding:'0.72rem', background:'rgba(255,255,255,0.05)', border:`1px solid ${BORDER}`, borderRadius:11, color:WHITE2, fontSize:'0.75rem', cursor:'pointer' }}>Skip manual →</button>
              </div>
            </>
          ) : null}
        </>}

      </div>
    </div>
  )
}
