'use client'
/**
 * ScanReadyScreen.tsx — ARAI_13  "Tap-to-Confirm Flow"
 *
 * EVERY transition requires an explicit user tap. No auto-advances.
 *
 * Stage flow per position:
 *   position  → countdown ticks (7-10s), illustration shown over camera
 *               When countdown hits 0: show "I'm Ready" tap prompt
 *   ready     → user taps big "I'm Ready" button → hold
 *   hold      → camera live, hold-still countdown (3-4s)
 *               When countdown hits 0: show "Tap to Capture" prompt
 *   capture   → user taps → analysing
 *   analysing → AI reads frame → result
 *   result    → AI message + locked values shown
 *               User taps "Next Position" (or Retry / Finish)
 *   paused    → countdown frozen, user resumes
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { checkXRSupport } from '@/lib/xr-measure'
import type { UserRole } from './AuthScreen'
import { Analytics } from '@/lib/analytics'

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY   = '#0A1C2E'
const GREEN  = '#27A96B'
const AMBER  = '#FA741F'
const WHITE  = '#E8F4FF'
const WHITE2 = '#93BAD4'
const BLUE   = '#4A90E2'
const BORDER = 'rgba(147,186,212,0.15)'

// ── Measurement indicator labels ──────────────────────────────────────────────
const indicators: Record<string, { label: string; color: string }> = {
  overview:    { label: 'Step count + headroom', color: BLUE   },
  riser_front: { label: 'Riser height',          color: GREEN  },
  rotate_90:   { label: 'Nosing overhang',       color: AMBER  },
  nosing:      { label: 'Nosing close-up',       color: AMBER  },
  handrail:    { label: 'Handrail height',       color: '#A78BFA' },
  alt_angle:   { label: 'Stair width',           color: BLUE   },
  tread_top:   { label: 'Tread depth',           color: GREEN  },
}

// ── Position definitions ──────────────────────────────────────────────────────
type Position = 'overview'|'riser_front'|'rotate_90'|'nosing'|'handrail'|'alt_angle'|'tread_top'

interface Slide {
  image:   string
  caption: string
  seconds: number   // how long to show this slide (default 5)
}

interface PosConfig {
  id:           Position
  step:         number
  label:        string
  image:        string        // single illustration (used when no slides)
  slides?:      Slide[]       // multi-slide intro sequence (cycles during position stage)
  headline:     string
  detail:       string
  readyLabel:   string
  holdSeconds:  number
  captureLabel: string
  positionTime: number
  captures:     string[]
  optional:     boolean
  aiPrompt:     (prior: Record<string, number|string>) => string
}

const POSITIONS: PosConfig[] = [
  {
    id: 'overview', step: 1, label: 'Full Stair View',
    image: '/Low_headroom_clearance.png',
    headline: 'Step back — fit the full staircase in frame',
    detail: 'Stand 2–3 metres from the stair. Hold the phone level at chest height. Make sure the full flight — top to bottom — is visible.',
    readyLabel: "I'm in position — Start",
    captureLabel: 'Tap to capture step count & headroom',
    holdSeconds: 4, positionTime: 9, optional: false,
    captures: ['riserCount','headroom'],
    aiPrompt: (_p) => `Analyse this staircase image for a compliance inspection.

Determine:
1. Count the visible steps/risers carefully
2. Is headroom restricted? Look for a ceiling or soffit above the stair flight.
   - "clear" = no ceiling, open above
   - number in mm if ceiling is visible (use riser as scale ~175mm each)
3. Residential (<=1000mm wide) or commercial?

Reply ONLY with valid JSON:
{"stepCount":number|null,"headroom":"clear"|number,"isResidential":true|false|null,"confident":true|false,"message":"one sentence for the user"}`,
  },
  {
    id: 'riser_front', step: 2, label: 'Riser Height',
    image: '/Measure_Riser_front.png',
    headline: 'Place phone on the nosing, camera facing the riser',
    detail: 'Set the phone upright on the tread nosing with the camera pointing directly at the vertical riser face. Centre the riser in frame.',
    readyLabel: 'Phone is placed — Start measuring',
    captureLabel: 'Tap to measure riser height',
    holdSeconds: 4, positionTime: 10, optional: false,
    captures: ['rise'],
    aiPrompt: (_p) => `Measure RISER HEIGHT. The phone is upright on the nosing pointing at the vertical riser face.

The riser face should fill most of the frame vertically. Use the phone body (~70mm wide) as a scale reference if visible.

Reply ONLY with valid JSON:
{"estimatedMm":number|null,"confidence":0.0-1.0,"message":"one sentence","locked":true|false}

Lock if confidence >= 0.65. Residential riser range: 125-200mm. Avoid round numbers.`,
  },
  {
    id: 'rotate_90', step: 3, label: 'Nosing Check',
    image: '/Rotate_Phone_90.png',
    headline: 'Rotate phone 90° — stay in the same spot',
    detail: 'Without moving your feet, rotate the phone flat so it lies on the tread with the camera looking along the tread surface toward the nosing edge.',
    readyLabel: 'Phone is rotated — Start measuring',
    captureLabel: 'Tap to check nosing',
    holdSeconds: 3, positionTime: 8, optional: false,
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
    detail: 'Hold the phone close to the tread front edge so the nosing overhang (or lack of one) is clearly visible.',
    readyLabel: "I'm pointing at the nosing",
    captureLabel: 'Tap to confirm nosing',
    holdSeconds: 3, positionTime: 7, optional: true,
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
    detail: 'Stand beside the stair. Hold the phone so both the tread surface at the bottom and the very top of the handrail are in frame at the same time.',
    readyLabel: 'Handrail is framed — Start measuring',
    captureLabel: 'Tap to measure handrail height',
    holdSeconds: 4, positionTime: 10, optional: false,
    captures: ['guard'],
    aiPrompt: (_p) => `Measure HANDRAIL HEIGHT — vertical from tread nosing to top of rail.

Also check for HANDRAIL OFFSET — horizontal distance from stringer/wall to the handrail centre.

Default to 915mm height at confidence 0.60 if any rail is visible.

Reply ONLY with valid JSON:
{"estimatedMm":number|null,"offsetMm":number|null,"confidence":0.0-1.0,"message":"one sentence","locked":true|false}

Lock if confidence >= 0.55. Height range: 865-1070mm residential.`,
  },
  {
    id: 'alt_angle', step: 6, label: 'Stair Width',
    image: '/Change_angles.png',
    headline: 'Step back — both edges of the stair in frame',
    detail: 'Move until both the left and right edges of the staircase are clearly visible. A measurement line will appear across the full width.',
    readyLabel: 'Both edges visible — Start measuring',
    captureLabel: 'Tap to measure stair width',
    holdSeconds: 4, positionTime: 9, optional: true,
    captures: ['width'],
    aiPrompt: (p) => `Measure STAIR WIDTH — horizontal distance between both stringers or walls.
Both left AND right edges must be visible. Use riser height (${p.rise ?? 175}mm) as scale.

Reply ONLY with valid JSON:
{"estimatedMm":number|null,"confidence":0.0-1.0,"message":"one sentence","locked":true|false}

Width range: 800-1400mm residential. Lock if confidence >= 0.60.`,
  },
  {
    id: 'tread_top', step: 7, label: 'Tread Depth',
    image: '/Measure_tread.png',
    slides: [
      {
        image:   '/Tread_slide_1_side.png',
        caption: '① Place phone flat on the tread nosing edge, camera facing down',
        seconds: 5,
      },
      {
        image:   '/Tread_slide_2_top.png',
        caption: '② Phone lies horizontal — camera looks straight down at the tread surface',
        seconds: 5,
      },
      {
        image:   '/Tread_slide_3_capture.png',
        caption: '③ Tap capture — phone emits a depth ray to the tread below for a precise reading',
        seconds: 5,
      },
    ],
    headline: 'Place phone flat on the tread — camera facing down',
    detail: 'Lay the phone face-down on the tread nosing. The camera fires a depth ray straight to the lower tread, measuring the exact riser height. Keep the phone still until you tap Capture.',
    readyLabel: 'Phone is flat on the tread — Start',
    captureLabel: 'Tap to measure tread depth',
    holdSeconds: 4, positionTime: 15, optional: false,
    captures: ['run'],
    aiPrompt: (p) => `Phone held horizontal above a stair tread, camera facing straight down.

Measure TREAD DEPTH — horizontal distance from front nosing to back riser.
Use phone width (~70mm) or riser height (${p.rise ?? 175}mm) as scale reference.

Reply ONLY with valid JSON:
{"estimatedMm":number|null,"confidence":0.0-1.0,"message":"one sentence","locked":true|false}

Lock if confidence >= 0.60. Tread range: 220-420mm.`,
  },
]

// ── Vision helper ─────────────────────────────────────────────────────────────
async function callVision(b64: string, prompt: string, ms = 18000): Promise<string|null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch('/api/vision', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({imageB64:b64, prompt}), signal:ctrl.signal,
    })
    clearTimeout(t)
    if (!r.ok) return null
    const d = await r.json()
    return d.text ?? null
  } catch { clearTimeout(t); return null }
}

function parseJSON(s: string|null): any {
  if (!s) return null
  try {
    const m = s.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

interface Props {
  userRole?: UserRole
  onSuccess: (m: Record<string,number|string>) => void
  onBack: () => void
}

// Stage: what is happening right now
// position  = illustration shown, countdown ticking
// ready     = countdown done, waiting for user tap to confirm ready
// hold      = camera live, hold-still countdown
// capture   = hold countdown done, waiting for user tap to capture
// analysing = AI call in flight
// result    = AI result shown, waiting for user action
// paused    = everything frozen
type Stage = 'position'|'ready'|'hold'|'capture'|'analysing'|'result'|'paused'

export default function ScanReadyScreen({ userRole='diy', onSuccess, onBack }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream|null>(null)
  const busyRef    = useRef(false)
  const timerRef   = useRef<ReturnType<typeof setTimeout>|null>(null)
  const pausedStageRef    = useRef<Stage>('position')
  const rescanReturnRef   = useRef(false)  // when true, result 'Next' returns to review

  const [posIdx,     setPosIdx]     = useState(0)
  const [slideIdx,   setSlideIdx]   = useState(0)   // current slide index during position stage
  const slideTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const [stage,      setStage]      = useState<Stage>('position')
  const [countdown,  setCountdown]  = useState(0)
  const [camReady,   setCamReady]   = useState(false)
  const [camError,   setCamError]   = useState(false)
  const [aiMessage,  setAiMessage]  = useState<string|null>(null)
  const [results,    setResults]    = useState<Record<string,number|string>>({})
  const resultsRef   = useRef<Record<string,number|string>>({})   // closure-safe mirror
  const [reviewVals, setReviewVals] = useState<Record<string,number|string>>({})
  const [nosingMm,   setNosingMm]   = useState(0)
  const [adjustVal,  setAdjustVal]  = useState<number|null>(null)  // user-adjusted value for current result
  // Captured frames: positionId → base64 JPEG (for report images)
  const capturedFrames = useRef<Record<string,string>>({})
  const [arSupported,setArSupported]= useState(false)
  const [showReview, setShowReview] = useState(false)

  const currentPos = POSITIONS[posIdx] ?? POSITIONS[0]
  const indicator  = indicators[currentPos.id]

  // ── Camera init ───────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    // Request highest quality rear camera
    // Advanced constraints: prefer 4K, fall back to 1080p, then anything available
    const tryCamera = async () => {
      const constraints: MediaStreamConstraints[] = [
        // First try: 4K with explicit rear camera preference
        { video: { facingMode: { exact: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 },
            advanced: [{ focusMode: 'continuous' }] as any }, audio: false },
        // Second try: 1080p rear camera
        { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        // Fallback: any camera
        { video: true, audio: false },
      ]
      for (const c of constraints) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(c)
          const track  = stream.getVideoTracks()[0]
          // Apply additional settings if supported
          if (track && track.applyConstraints) {
            try {
              await track.applyConstraints({
                advanced: [
                  { focusMode: 'continuous' } as any,
                  { exposureMode: 'continuous' } as any,
                  { whiteBalanceMode: 'continuous' } as any,
                ],
              })
            } catch { /* not all browsers support these */ }
          }
          return stream
        } catch { continue }
      }
      throw new Error('No camera available')
    }

    tryCamera().then(stream => {
      if (!alive) { stream.getTracks().forEach(t=>t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      // Wait for video to have real dimensions before marking ready
      const waitForSize = setInterval(() => {
        if (!alive) { clearInterval(waitForSize); return }
        const v = videoRef.current
        if (v && v.videoWidth > 0 && v.videoHeight > 0) {
          clearInterval(waitForSize)
          setCamReady(true)
        }
      }, 100)
      // Safety timeout
      setTimeout(() => { if (alive) { clearInterval(waitForSize); setCamReady(true) } }, 3000)
    }).catch(() => { if (alive) setCamError(true) })
    checkXRSupport().then(s => setArSupported(s.immersiveAR && s.planeDetection)).catch(()=>{})
    return () => { alive=false; streamRef.current?.getTracks().forEach(t=>t.stop()) }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function captureB64(scale=1.0): string|null {
    const v = videoRef.current, c = captureRef.current
    if (!v || !c || v.readyState < 2 || v.videoWidth === 0) return null

    // Always capture at native resolution — never downsample the source frame
    const srcW = v.videoWidth
    const srcH = v.videoHeight

    // Cap at 2048px on longest side to stay under Anthropic 5MB limit
    // while preserving maximum detail
    const MAX = 2048
    const ratio = Math.min(1, MAX / Math.max(srcW, srcH)) * scale
    c.width  = Math.round(srcW * ratio)
    c.height = Math.round(srcH * ratio)

    const ctx = c.getContext('2d')!
    // Use high-quality image smoothing
    ctx.imageSmoothingEnabled  = true
    ctx.imageSmoothingQuality  = 'high'
    ctx.drawImage(v, 0, 0, c.width, c.height)

    // JPEG at 0.92 quality — sharp enough for AI analysis, small enough for API
    return c.toDataURL('image/jpeg', 0.92).split(',')[1]
  }

  function captureB64Small(): string|null {
    // Smaller version for email embedding only — 50% of native
    return captureB64(0.5)
  }

  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  // ── Go to a position — always starts at 'position' stage with full countdown ─
  const goTo = useCallback((idx: number) => {
    clearTimer()
    if (idx >= POSITIONS.length) { finishScan(); return }
    busyRef.current = false
    setPosIdx(idx)
    setSlideIdx(0)
    setAdjustVal(null)
    setAiMessage(null)
    setStage('position')
    setCountdown(POSITIONS[idx].positionTime)
  }, []) // eslint-disable-line

  // Init on camera ready
  useEffect(() => { if (camReady) goTo(0) }, [camReady]) // eslint-disable-line

  // ── Stage: position — countdown ticking + slide cycling ─────────────────
  useEffect(() => {
    if (stage !== 'position') return
    if (countdown <= 0) {
      setStage('ready')
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  // Cycle through slides every N seconds while in position stage
  useEffect(() => {
    if (stage !== 'position') return
    const slides = POSITIONS[posIdx]?.slides
    if (!slides || slides.length <= 1) return
    const secs = slides[slideIdx]?.seconds ?? 5
    if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
    slideTimerRef.current = setTimeout(() => {
      setSlideIdx(i => (i + 1) % slides.length)
    }, secs * 1000)
    return () => { if (slideTimerRef.current) clearTimeout(slideTimerRef.current) }
  }, [stage, posIdx, slideIdx])

  // ── Stage: ready — waiting for user tap (no timer) ────────────────────────
  // User taps "I'm Ready" → start hold countdown
  function handleReady() {
    setStage('hold')
    setCountdown(currentPos.holdSeconds)
  }

  // ── Stage: hold — camera live, hold-still countdown ───────────────────────
  useEffect(() => {
    if (stage !== 'hold') return
    if (countdown <= 0) {
      // Hold countdown done → show "Tap to Capture" prompt
      setStage('capture')
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  // ── Stage: capture — user taps, save frame for report, then analyse ────────
  function handleCapture() {
    // Capture and store the frame for this position (used in email report)
    const b64 = captureB64Small()  // smaller for email embedding
    if (b64) capturedFrames.current[currentPos.id] = b64
    busyRef.current = false
    setStage('analysing')
  }

  // ── Stage: analysing — AI call ────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'analysing' || busyRef.current) return
    busyRef.current = true

    async function run() {
      const b64 = captureB64()
      if (!b64) {
        busyRef.current = false
        // No frame available — go back to capture prompt
        setStage('capture')
        return
      }

      let priorSnap: Record<string,number|string> = {}
      setResults(prev => { priorSnap = prev; return prev })

      const raw = await callVision(b64, currentPos.aiPrompt(priorSnap))
      busyRef.current = false
      const r = parseJSON(raw)

      if (!r) {
        setAiMessage("Could not read the image clearly — tap Retry to try again.")
        setStage('result')
        return
      }

      // Extract measurements
      setResults(prev => {
        const next = { ...prev }
        const p = currentPos.id
        if (p === 'overview') {
          if (r.stepCount)             next.riserCount    = r.stepCount
          if (r.headroom != null)      next.headroom      = r.headroom
          if (r.isResidential != null) next.isResidential = r.isResidential ? 1 : 0
        }
        if (p === 'riser_front' && r.estimatedMm && r.confidence >= 0.55)
          next.rise = Math.round(r.estimatedMm)
        if ((p === 'rotate_90' || p === 'nosing') && r.confidence >= 0.55) {
          next.nosing = r.hasNosing ? (r.estimatedMm ?? 30) : 'none'
          if (r.estimatedMm) setNosingMm(r.estimatedMm)
        }
        if (p === 'handrail' && r.estimatedMm && r.confidence >= 0.50) {
          next.guard = Math.round(r.estimatedMm)
          if (r.offsetMm) next.handrailOffset = Math.round(r.offsetMm)
        }
        if (p === 'alt_angle' && r.estimatedMm && r.confidence >= 0.55)
          next.width = Math.round(r.estimatedMm)
        if (p === 'tread_top' && r.estimatedMm && r.confidence >= 0.55)
          next.run = Math.round(r.estimatedMm)
        resultsRef.current = next  // keep ref in sync
        return next
      })

      setAiMessage(r.message ?? null)
      setStage('result')
      // Never auto-advance — user must tap "Next Position"
    }

    run()
  }, [stage]) // eslint-disable-line

  // ── Pause / resume ────────────────────────────────────────────────────────
  function pause() {
    clearTimer()
    pausedStageRef.current = stage
    setStage('paused')
  }

  function resume() {
    const prev = pausedStageRef.current
    if (prev === 'position') {
      // Resume position countdown from where it was
      setStage('position')
    } else if (prev === 'hold') {
      setStage('hold')
    } else {
      // For ready/capture/result just go back to ready
      setStage('ready')
    }
  }

  // ── Finish early ──────────────────────────────────────────────────────────
  function finishScan() {
    clearTimer()
    // Use resultsRef so this always has fresh data even inside stale closures
    const final = { ...resultsRef.current }
    if (!final.headroom) final.headroom = 'clear'
    setResults(final)
    resultsRef.current = final
    setReviewVals(final)
    setShowReview(true)
  }

  function submitReview() {
    Analytics.scanCompleted({ role: userRole, measurementCount: Object.keys(reviewVals).length, hasFailed: false })
    // Attach captured frames to measurements so report generation can embed them
    const withFrames = { ...reviewVals, _frames: JSON.stringify(capturedFrames.current) }
    onSuccess(withFrames)
  }

  // ── Derived display state ─────────────────────────────────────────────────
  // Show illustration: during position/ready/paused
  const showIllustration = stage==='position' || stage==='ready' || stage==='paused'
  // Show camera live: always — camera is always on in background
  // During illustration stages, camera shows at reduced opacity behind the white-bg overlay
  const showCamera = true
  // During scan stages camera is full opacity; during illustration it fades to ~35%
  const cameraOpacity = (stage==='hold' || stage==='capture' || stage==='analysing' || stage==='result') ? 1 : 0.35

  const progressPct   = (posIdx / POSITIONS.length) * 100
  const IMAGE_TOP     = 88
  const BOTTOM_PANEL  = 210  // slightly taller for larger tap targets

  // ── Camera error ──────────────────────────────────────────────────────────
  if (camError) return (
    <div style={{position:'fixed',inset:0,background:NAVY,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1rem',padding:'2rem',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{fontSize:'2rem'}}>📷</div>
      <p style={{color:WHITE,textAlign:'center'}}>Camera access is required to scan stairs.</p>
      <button onClick={onBack} style={{padding:'0.8rem 2rem',background:AMBER,border:'none',borderRadius:12,color:'#fff',fontWeight:700,cursor:'pointer'}}>Back</button>
    </div>
  )

  // ── Review screen ─────────────────────────────────────────────────────────
  function rescanPosition(posId: Position) {
    rescanReturnRef.current = true   // flag: after this scan, go back to review
    setShowReview(false)
    const idx = POSITIONS.findIndex(p => p.id === posId)
    if (idx >= 0) goTo(idx)
  }

  if (showReview) return (
    <div style={{position:'fixed',inset:0,background:NAVY,overflowY:'auto',
      padding:'max(env(safe-area-inset-top,0px),2.5rem) 1.25rem 3rem',
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{maxWidth:440,margin:'0 auto',display:'flex',flexDirection:'column',gap:'0.85rem'}}>

        <div style={{textAlign:'center',marginBottom:'0.25rem'}}>
          <div style={{fontSize:'1.5rem',marginBottom:'0.3rem'}}>📐</div>
          <div style={{fontSize:'1.1rem',fontWeight:800,color:WHITE}}>Review Measurements</div>
          <div style={{fontSize:'0.72rem',color:WHITE2,marginTop:'0.25rem',lineHeight:1.5}}>
            Tap ↺ on any row to rescan that measurement. Tap a value to edit it manually.
          </div>
        </div>

        {([
          {key:'rise',     label:'Riser Height',    unit:'mm', type:'number',   posId:'riser_front' as Position},
          {key:'run',      label:'Tread Depth',     unit:'mm', type:'number',   posId:'tread_top'   as Position},
          {key:'width',    label:'Stair Width',     unit:'mm', type:'number',   posId:'alt_angle'   as Position},
          {key:'guard',    label:'Handrail Height', unit:'mm', type:'number',   posId:'handrail'    as Position},
          {key:'nosing',   label:'Nosing',          unit:'',   type:'nosing',   posId:'nosing'      as Position},
          {key:'headroom', label:'Headroom',        unit:'',   type:'headroom', posId:'overview'    as Position},
        ] as const).map(({key,label,unit,type,posId}) => {
          const hasValue = reviewVals[key] != null
          const isMissing = !hasValue
          return (
            <div key={key} style={{
              borderRadius:14,
              border:`1.5px solid ${isMissing ? 'rgba(250,116,31,0.35)' : BORDER}`,
              background: isMissing ? 'rgba(250,116,31,0.06)' : 'rgba(255,255,255,0.04)',
              overflow:'hidden',
            }}>
              {/* Row header */}
              <div style={{display:'flex',alignItems:'center',padding:'0.7rem 0.9rem',gap:'0.6rem'}}>
                {/* Status dot */}
                <div style={{
                  width:8,height:8,borderRadius:'50%',flexShrink:0,
                  background: isMissing ? AMBER : GREEN,
                  boxShadow: `0 0 6px ${isMissing ? AMBER : GREEN}`,
                }}/>
                {/* Label */}
                <div style={{flex:1,fontSize:'0.85rem',fontWeight:700,color:WHITE}}>{label}</div>
                {/* Rescan button */}
                <button
                  onClick={()=>rescanPosition(posId)}
                  style={{
                    padding:'0.28rem 0.7rem',
                    background:'rgba(255,255,255,0.07)',
                    border:`1px solid ${BORDER}`,
                    borderRadius:8,color:WHITE2,
                    fontFamily:'monospace',fontSize:'0.68rem',
                    fontWeight:600,cursor:'pointer',
                    letterSpacing:'0.05em',
                    whiteSpace:'nowrap',
                  }}
                >↺ Rescan</button>
              </div>

              {/* Value area */}
              <div style={{padding:'0 0.9rem 0.75rem'}}>
                {type==='number' && (
                  <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
                    <input type="number" inputMode="numeric"
                      value={reviewVals[key]!=null && reviewVals[key]!=='clear' && reviewVals[key]!=='none' ? String(reviewVals[key]) : ''}
                      placeholder={isMissing ? 'Not captured — tap ↺ to rescan' : '—'}
                      onChange={e=>{ const v=parseInt(e.target.value,10); if(!isNaN(v)&&v>0) setReviewVals(p=>({...p,[key]:v})) }}
                      style={{
                        flex:1,padding:'0.5rem 0.75rem',
                        background:'rgba(255,255,255,0.06)',
                        border:`1px solid ${isMissing ? 'rgba(250,116,31,0.3)' : BORDER}`,
                        borderRadius:10,color: isMissing ? 'rgba(255,255,255,0.3)' : WHITE,
                        fontFamily:'monospace',fontWeight:700,fontSize:'1rem',
                      }}
                    />
                    <span style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.4)',fontFamily:'monospace',flexShrink:0}}>mm</span>
                  </div>
                )}
                {type==='nosing' && (
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    {(['none','yes'] as const).map(opt=>(
                      <button key={opt} onClick={()=>setReviewVals(p=>({...p,nosing:opt==='yes'?(nosingMm||30):'none'}))}
                        style={{padding:'0.45rem 1rem',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'monospace',fontSize:'0.78rem',fontWeight:700,
                          background:(opt==='none'?reviewVals[key]==='none':reviewVals[key]!=='none'&&reviewVals[key]!=null)?AMBER+'33':'rgba(255,255,255,0.06)',
                          color:(opt==='none'?reviewVals[key]==='none':reviewVals[key]!=='none'&&reviewVals[key]!=null)?AMBER:WHITE2}}>
                        {opt==='none'?'No nosing':'Has nosing'}
                      </button>
                    ))}
                  </div>
                )}
                {type==='headroom' && (
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    {(['clear','low'] as const).map(opt=>(
                      <button key={opt} onClick={()=>setReviewVals(p=>({...p,headroom:opt==='clear'?'clear':(p.headroom!=='clear'?p.headroom:1950)}))}
                        style={{padding:'0.45rem 1rem',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'monospace',fontSize:'0.78rem',fontWeight:700,
                          background:(opt==='clear'?reviewVals[key]==='clear':reviewVals[key]!=='clear'&&reviewVals[key]!=null)?GREEN+'33':'rgba(255,255,255,0.06)',
                          color:(opt==='clear'?reviewVals[key]==='clear':reviewVals[key]!=='clear'&&reviewVals[key]!=null)?GREEN:WHITE2}}>
                        {opt==='clear'?'✓ Clear':'⚠ Low'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Missing items callout */}
        {Object.values(reviewVals).filter(v=>v!=null).length < 4 && (
          <div style={{background:'rgba(250,116,31,0.08)',border:'1px solid rgba(250,116,31,0.25)',borderRadius:12,padding:'0.65rem 0.9rem',fontSize:'0.72rem',color:WHITE2,lineHeight:1.6}}>
            <strong style={{color:AMBER}}>Some measurements are missing.</strong> You can still generate a partial report,
            or tap ↺ Rescan on any row to go back and capture it.
          </div>
        )}

        <button onClick={submitReview} style={{width:'100%',padding:'1.1rem',background:`linear-gradient(135deg,${GREEN},#1A7A50)`,border:'none',borderRadius:16,color:'#fff',fontFamily:'monospace',fontSize:'0.95rem',fontWeight:900,letterSpacing:'0.08em',cursor:'pointer',boxShadow:'0 4px 24px rgba(39,169,107,0.4)',marginTop:'0.25rem'}}>
          Generate Report →
        </button>
      </div>
    </div>
  )

  // ── Main scan UI ──────────────────────────────────────────────────────────
  return (
    <div style={{position:'fixed',inset:0,background:'#111',overflow:'hidden',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>

      {/* Live camera feed */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',
          opacity:cameraOpacity,transition:'opacity 0.4s ease'}}/>
      <canvas ref={captureRef} style={{display:'none'}}/>

      {/* ── IMAGE ZONE — illustration overlaid on camera ─────────────────── */}
      {showIllustration && (() => {
        const slides = currentPos.slides
        const activeSlide = slides ? slides[slideIdx] : null
        const imgSrc = activeSlide ? activeSlide.image : currentPos.image
        return (
          <div style={{
            position:'absolute', top:IMAGE_TOP, left:0, right:0, bottom:BOTTOM_PANEL,
            zIndex:10, overflow:'hidden',
            background: 'transparent',
          }}>
            <img key={imgSrc} src={imgSrc} alt={currentPos.headline}
              style={{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',display:'block',
                animation:'fadeIn 0.4s ease'}}/>

            {/* Slide caption */}
            {activeSlide && (
              <div style={{
                position:'absolute',bottom:slides && slides.length > 1 ? 40 : 12,left:12,right:12,
                background:'rgba(10,28,46,0.88)',backdropFilter:'blur(8px)',
                borderRadius:10,padding:'0.4rem 0.75rem',
                border:`1px solid ${indicator.color}44`,
              }}>
                <div style={{fontSize:'0.7rem',color:WHITE,lineHeight:1.45,fontWeight:600}}>
                  {activeSlide.caption}
                </div>
              </div>
            )}

            {/* Slide dots — bottom centre */}
            {slides && slides.length > 1 && (
              <div style={{position:'absolute',bottom:14,left:0,right:0,display:'flex',justifyContent:'center',gap:'0.4rem'}}>
                {slides.map((_, i) => (
                  <div key={i} onClick={()=>setSlideIdx(i)} style={{
                    width: i===slideIdx ? 20 : 7, height:7,
                    borderRadius: i===slideIdx ? 4 : '50%',
                    background: i===slideIdx ? indicator.color : 'rgba(255,255,255,0.35)',
                    cursor:'pointer',transition:'all 0.3s ease',
                  }}/>
                ))}
              </div>
            )}

            {/* Measurement label badge — bottom left */}
            {!activeSlide && (
              <div style={{position:'absolute',bottom:12,left:12,background:'rgba(10,28,46,0.85)',backdropFilter:'blur(6px)',borderRadius:10,padding:'0.35rem 0.65rem',border:`1px solid ${indicator.color}55`,display:'flex',alignItems:'center',gap:'0.45rem'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:indicator.color,boxShadow:`0 0 6px ${indicator.color}`,flexShrink:0}}/>
                <span style={{fontSize:'0.65rem',color:indicator.color,fontFamily:'monospace',fontWeight:700,letterSpacing:'0.08em'}}>
                  {indicator.label.toUpperCase()}
                </span>
              </div>
            )}

            {/* Position countdown — top right (only while ticking) */}
            {stage === 'position' && (
              <div style={{position:'absolute',top:10,right:12,background:'rgba(10,28,46,0.88)',backdropFilter:'blur(8px)',borderRadius:12,padding:'0.4rem 0.75rem',border:`1px solid ${AMBER}55`,display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <svg width="20" height="20" viewBox="0 0 36 36" style={{transform:'rotate(-90deg)',flexShrink:0}}>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="14" fill="none" stroke={AMBER} strokeWidth="3"
                    strokeDasharray={`${2*Math.PI*14}`}
                    strokeDashoffset={`${2*Math.PI*14*(countdown/currentPos.positionTime)}`}
                    strokeLinecap="round" style={{transition:'stroke-dashoffset 0.9s linear'}}/>
                </svg>
                <span style={{fontSize:'0.8rem',fontFamily:'monospace',fontWeight:800,color:WHITE}}>{countdown}s</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* Dim overlay during analyse */}
      {stage==='analysing' && (
        <div style={{position:'absolute',inset:0,zIndex:15,background:'rgba(10,28,46,0.5)',backdropFilter:'blur(2px)'}}/>
      )}

      {/* ── TOP BAR ── */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,zIndex:50,
        paddingTop:'max(env(safe-area-inset-top,0px),1.5rem)',
        paddingBottom:'0.6rem',paddingLeft:'1rem',paddingRight:'1rem',
        background:'linear-gradient(to bottom,rgba(10,28,46,0.95),rgba(10,28,46,0.6))',
        display:'flex',alignItems:'center',gap:'0.75rem',
        height:IMAGE_TOP,boxSizing:'border-box',
      }}>
        <button onClick={onBack} style={{width:34,height:34,borderRadius:'50%',background:'rgba(0,0,0,0.5)',border:`1px solid ${BORDER}`,color:WHITE,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</button>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:'0.25rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'0.6rem',fontFamily:'monospace',letterSpacing:'0.1em',color:WHITE2}}>STEP {currentPos.step} / {POSITIONS.length}</span>
            <span style={{fontSize:'0.72rem',fontWeight:700,color:WHITE}}>{currentPos.label}</span>
          </div>
          <div style={{height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${progressPct}%`,background:`linear-gradient(90deg,${GREEN},${BLUE})`,borderRadius:2,transition:'width 0.4s ease'}}/>
          </div>
        </div>
        <div
          title={arSupported ? 'ARCore plane detection active' : 'AI Vision mode — ARCore not available on this device/browser'}
          style={{background:arSupported?'rgba(74,144,226,0.15)':'rgba(242,147,55,0.15)',border:`1px solid ${arSupported?'rgba(74,144,226,0.4)':'rgba(242,147,55,0.4)'}`,borderRadius:10,padding:'0.18rem 0.6rem',flexShrink:0,display:'flex',alignItems:'center',gap:'0.3rem'}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:arSupported?BLUE:AMBER,boxShadow:`0 0 4px ${arSupported?BLUE:AMBER}`}}/>
          <span style={{fontSize:'0.5rem',fontFamily:'monospace',letterSpacing:'0.1em',color:arSupported?BLUE:AMBER,fontWeight:700}}>{arSupported?'AR·CORE':'AI·VISION'}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BOTTOM PANEL — fixed height, never overlaps image
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        position:'absolute',bottom:0,left:0,right:0,
        height:BOTTOM_PANEL,zIndex:50,
        background:'linear-gradient(to top,rgba(10,28,46,0.99) 80%,rgba(10,28,46,0.6))',
        paddingBottom:'max(env(safe-area-inset-bottom,0px),1.25rem)',
        paddingLeft:'1.25rem',paddingRight:'1.25rem',paddingTop:'0.85rem',
        display:'flex',flexDirection:'column',gap:'0.6rem',
        boxSizing:'border-box',
      }}>

        {/* ══ POSITION — countdown ticking, read the instructions ══ */}
        {stage==='position' && <>
          <div>
            <div style={{fontSize:'0.92rem',fontWeight:800,color:WHITE,lineHeight:1.3,marginBottom:'0.3rem'}}>{currentPos.headline}</div>
            <div style={{fontSize:'0.73rem',color:WHITE2,lineHeight:1.5}}>{currentPos.detail}</div>
          </div>
          <div style={{display:'flex',gap:'0.45rem'}}>
            <button onClick={pause} style={{flex:1,padding:'0.75rem',background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:13,color:WHITE2,fontFamily:'monospace',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>⏸ Pause</button>
            {currentPos.optional && (
              <button onClick={()=>goTo(posIdx+1)} style={{flex:1,padding:'0.75rem',background:'rgba(255,255,255,0.05)',border:`1px solid ${BORDER}`,borderRadius:13,color:WHITE2,fontFamily:'monospace',fontSize:'0.75rem',cursor:'pointer'}}>Skip</button>
            )}
            <button onClick={finishScan} style={{flex:1,padding:'0.75rem',background:`linear-gradient(135deg,${AMBER},#C4721E)`,border:'none',borderRadius:13,color:'#fff',fontFamily:'monospace',fontSize:'0.75rem',fontWeight:700,cursor:'pointer'}}>Finish ✓</button>
          </div>
        </>}

        {/* ══ READY — countdown done, waiting for user to confirm ══ */}
        {stage==='ready' && <>
          <div style={{fontSize:'0.78rem',color:WHITE2,lineHeight:1.5,marginBottom:'0.1rem'}}>{currentPos.detail}</div>
          <button onClick={handleReady} style={{
            width:'100%',padding:'1.1rem',
            background:`linear-gradient(135deg,${GREEN},#1A7A50)`,
            border:'none',borderRadius:16,color:'#fff',
            fontFamily:'monospace',fontSize:'0.95rem',fontWeight:900,
            letterSpacing:'0.06em',cursor:'pointer',
            boxShadow:'0 6px 28px rgba(39,169,107,0.5)',
          }}>
            ✓ {currentPos.readyLabel}
          </button>
          <div style={{display:'flex',gap:'0.45rem'}}>
            {currentPos.optional && (
              <button onClick={()=>goTo(posIdx+1)} style={{flex:1,padding:'0.65rem',background:'rgba(255,255,255,0.05)',border:`1px solid ${BORDER}`,borderRadius:12,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>Skip this step</button>
            )}
            <button onClick={finishScan} style={{flex:1,padding:'0.65rem',background:'rgba(250,116,31,0.12)',border:`1px solid rgba(250,116,31,0.3)`,borderRadius:12,color:AMBER,fontFamily:'monospace',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>Finish &amp; report →</button>
          </div>
        </>}

        {/* ══ HOLD — camera live, hold-still countdown ══ */}
        {stage==='hold' && <>
          <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
            {/* Countdown ring */}
            <div style={{position:'relative',width:64,height:64,flexShrink:0}}>
              <svg width="64" height="64" style={{transform:'rotate(-90deg)'}}>
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4.5"/>
                <circle cx="32" cy="32" r="26" fill="none" stroke={GREEN} strokeWidth="4.5"
                  strokeDasharray={`${2*Math.PI*26}`}
                  strokeDashoffset={`${2*Math.PI*26*(countdown/currentPos.holdSeconds)}`}
                  strokeLinecap="round" style={{transition:'stroke-dashoffset 0.9s linear'}}/>
              </svg>
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',fontWeight:900,color:WHITE,fontFamily:'monospace'}}>{countdown}</div>
            </div>
            <div>
              <div style={{fontSize:'0.88rem',fontWeight:800,color:GREEN,letterSpacing:'0.05em',marginBottom:'0.2rem'}}>HOLD STILL</div>
              <div style={{fontSize:'0.72rem',color:WHITE2,lineHeight:1.4}}>Keep the phone steady — AI will read when ready to capture</div>
            </div>
          </div>
          <div style={{display:'flex',gap:'0.45rem'}}>
            <button onClick={pause} style={{flex:1,padding:'0.72rem',background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:13,color:WHITE2,fontFamily:'monospace',fontSize:'0.75rem',cursor:'pointer'}}>⏸ Pause</button>
            <button onClick={finishScan} style={{flex:1,padding:'0.72rem',background:`linear-gradient(135deg,${AMBER},#C4721E)`,border:'none',borderRadius:13,color:'#fff',fontFamily:'monospace',fontSize:'0.75rem',fontWeight:700,cursor:'pointer'}}>Finish ✓</button>
          </div>
        </>}

        {/* ══ CAPTURE — hold done, waiting for user to tap ══ */}
        {stage==='capture' && <>
          <div style={{fontSize:'0.78rem',color:WHITE2,lineHeight:1.5}}>
            Phone is steady — tap the button below when you are ready to capture.
          </div>
          <button onClick={handleCapture} style={{
            width:'100%',padding:'1.15rem',
            background:`linear-gradient(135deg,${BLUE},#2C6FBF)`,
            border:'none',borderRadius:16,color:'#fff',
            fontFamily:'monospace',fontSize:'1rem',fontWeight:900,
            letterSpacing:'0.06em',cursor:'pointer',
            boxShadow:'0 6px 28px rgba(74,144,226,0.5)',
          }}>
            📸 {currentPos.captureLabel}
          </button>
          <div style={{display:'flex',gap:'0.45rem'}}>
            <button onClick={()=>{ busyRef.current=false; setStage('hold'); setCountdown(currentPos.holdSeconds) }}
              style={{flex:1,padding:'0.65rem',background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:12,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>
              ↺ Re-steady
            </button>
            <button onClick={finishScan} style={{flex:1,padding:'0.65rem',background:'rgba(250,116,31,0.12)',border:`1px solid rgba(250,116,31,0.3)`,borderRadius:12,color:AMBER,fontFamily:'monospace',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>Finish &amp; report →</button>
          </div>
        </>}

        {/* ══ ANALYSING — spinner ══ */}
        {stage==='analysing' && <>
          <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
            <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid rgba(242,147,55,0.2)',borderTopColor:AMBER,animation:'spin 0.8s linear infinite',flexShrink:0}}/>
            <div>
              <div style={{fontSize:'0.88rem',color:WHITE,fontWeight:700,marginBottom:'0.15rem'}}>Reading image…</div>
              <div style={{fontSize:'0.7rem',color:WHITE2}}>Measuring {indicator.label}</div>
            </div>
          </div>
          <button onClick={finishScan} style={{width:'100%',padding:'0.72rem',background:'rgba(255,255,255,0.06)',border:`1px solid ${BORDER}`,borderRadius:13,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>
            Finish &amp; generate report →
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
        </>}

        {/* ══ RESULT — AI message, wait for user action ══ */}
        {stage==='result' && (() => {
          // Primary captured value for this position
          const capKey   = currentPos.captures[0] as string
          const rawVal   = results[capKey]
          const numVal   = typeof rawVal === 'number' ? rawVal : null
          const dispVal  = adjustVal ?? numVal
          const indColor = indicator.color
          const isMeasured = dispVal !== null

          // Previously confirmed measurements — shown as badges top-right of camera
          const confirmed = Object.entries(results).filter(([k,v]) =>
            !currentPos.captures.includes(k) && typeof v === 'number' && k !== 'riserCount' && k !== 'isResidential'
          ) as [string, number][]

          const capLabels: Record<string,string> = {
            rise:'RISER HEIGHT', run:'TREAD DEPTH', width:'STAIR WIDTH',
            guard:'HANDRAIL', headroom:'HEADROOM', nosing:'NOSING',
          }

          return <>
            {/* ── AR measurement line drawn over camera ── */}
            {isMeasured && (
              <div style={{
                position:'absolute', top:IMAGE_TOP, left:0, right:0, bottom:BOTTOM_PANEL+8,
                zIndex:20, pointerEvents:'none', overflow:'hidden',
              }}>
                {/* Confirmed badges — top right stack */}
                <div style={{position:'absolute',top:8,right:8,display:'flex',flexDirection:'column',gap:'0.3rem',zIndex:25}}>
                  {confirmed.slice(0,4).map(([k,v])=>(
                    <div key={k} style={{
                      background:'rgba(10,28,46,0.88)', backdropFilter:'blur(6px)',
                      borderRadius:8, padding:'0.22rem 0.55rem',
                      border:`1px solid rgba(39,169,107,0.45)`,
                      display:'flex', alignItems:'center', gap:'0.35rem',
                    }}>
                      <span style={{fontSize:'0.55rem',fontFamily:'monospace',fontWeight:700,color:'rgba(39,169,107,0.7)',letterSpacing:'0.06em'}}>{capLabels[k]??k.toUpperCase()}</span>
                      <span style={{fontSize:'0.72rem',fontFamily:'monospace',fontWeight:900,color:'#27A96B'}}>{v}mm</span>
                      <span style={{fontSize:'0.65rem',color:'#27A96B'}}>✓</span>
                    </div>
                  ))}
                </div>

                {/* Measurement line SVG — vertical or horizontal based on position */}
                <svg width="100%" height="100%" style={{position:'absolute',inset:0}}>
                  {/* Vertical line for riser/handrail, horizontal for width/tread */}
                  {['riser_front','handrail','overview'].includes(currentPos.id) ? (
                    // Vertical measurement line — centre of camera
                    <>
                      <line x1="50%" y1="22%" x2="50%" y2="75%"
                        stroke={indColor} strokeWidth="2.5" strokeLinecap="round"
                        style={{filter:`drop-shadow(0 0 4px ${indColor})`}}/>
                      <circle cx="50%" cy="22%" r="5" fill={indColor} style={{filter:`drop-shadow(0 0 5px ${indColor})`}}/>
                      <circle cx="50%" cy="75%" r="5" fill={indColor} style={{filter:`drop-shadow(0 0 5px ${indColor})`}}/>
                      {/* Label box */}
                      <rect x="calc(50% - 42px)" y="calc(48% - 13px)" width="84" height="26" rx="6"
                        fill="rgba(10,28,46,0.85)" stroke={indColor} strokeWidth="1"/>
                      <text x="50%" y="calc(48% + 5px)" textAnchor="middle"
                        fill="white" fontSize="13" fontFamily="monospace" fontWeight="bold">{dispVal}mm</text>
                    </>
                  ) : (
                    // Horizontal measurement line — across the stair width
                    <>
                      <line x1="8%" y1="62%" x2="92%" y2="62%"
                        stroke={indColor} strokeWidth="2.5" strokeLinecap="round"
                        style={{filter:`drop-shadow(0 0 4px ${indColor})`}}/>
                      <circle cx="8%" cy="62%" r="5" fill={indColor} style={{filter:`drop-shadow(0 0 5px ${indColor})`}}/>
                      <circle cx="92%" cy="62%" r="5" fill={indColor} style={{filter:`drop-shadow(0 0 5px ${indColor})`}}/>
                      {/* Label box */}
                      <rect x="calc(50% - 42px)" y="calc(62% - 19px)" width="84" height="26" rx="6"
                        fill="rgba(10,28,46,0.85)" stroke={indColor} strokeWidth="1"/>
                      <text x="50%" y="calc(62% - 3px)" textAnchor="middle"
                        fill="white" fontSize="13" fontFamily="monospace" fontWeight="bold">{dispVal}mm</text>
                    </>
                  )}
                </svg>

                {/* Measured label — bottom centre */}
                <div style={{
                  position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)',
                  background:`rgba(10,28,46,0.88)`, backdropFilter:'blur(6px)',
                  borderRadius:20, padding:'0.25rem 0.9rem',
                  border:`1px solid ${indColor}66`,
                  display:'flex', alignItems:'center', gap:'0.4rem',
                  whiteSpace:'nowrap',
                }}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:indColor,boxShadow:`0 0 5px ${indColor}`}}/>
                  <span style={{fontSize:'0.62rem',fontFamily:'monospace',fontWeight:700,color:indColor,letterSpacing:'0.1em'}}>
                    {capLabels[capKey]??currentPos.label.toUpperCase()} — MEASURED
                  </span>
                </div>
              </div>
            )}

            {/* ── Bottom panel result content ── */}
            {/* Big measurement number + ± adjustment */}
            {isMeasured ? (
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'0.5rem'}}>
                  {/* − button */}
                  <button onClick={()=>setAdjustVal(v => Math.max(1, (v ?? numVal ?? 0) - 5))}
                    style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.1)',border:`1px solid ${BORDER}`,color:WHITE,fontSize:'1.5rem',fontWeight:300,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    −
                  </button>
                  {/* Big number */}
                  <div style={{flex:1,textAlign:'center'}}>
                    <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:'0.2rem'}}>
                      <span style={{fontSize:'3rem',fontWeight:900,color:WHITE,fontFamily:'monospace',lineHeight:1}}>{dispVal}</span>
                      <span style={{fontSize:'1rem',color:WHITE2,fontFamily:'monospace'}}>mm</span>
                    </div>
                    {aiMessage && (
                      <div style={{fontSize:'0.65rem',color:WHITE2,lineHeight:1.4,marginTop:'0.15rem'}}>{aiMessage}</div>
                    )}
                    {adjustVal !== null && (
                      <div style={{fontSize:'0.58rem',color:AMBER,fontFamily:'monospace',marginTop:'0.1rem'}}>ADJUSTED</div>
                    )}
                  </div>
                  {/* + button */}
                  <button onClick={()=>setAdjustVal(v => (v ?? numVal ?? 0) + 5)}
                    style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.1)',border:`1px solid ${BORDER}`,color:WHITE,fontSize:'1.5rem',fontWeight:300,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    +
                  </button>
                </div>
                {adjustVal !== null && (
                  <div style={{fontSize:'0.6rem',color:'rgba(255,255,255,0.3)',textAlign:'center',fontFamily:'monospace'}}>
                    Adjust with − / + if needed · original: {numVal}mm
                  </div>
                )}
              </div>
            ) : (
              <div style={{fontSize:'0.82rem',fontWeight:600,color:WHITE,textAlign:'center',padding:'0.5rem 0'}}>
                {aiMessage ?? 'Could not read — tap Retry to try again.'}
              </div>
            )}

            {/* Confirm & Next — primary */}
            <button onClick={()=>{
              if (adjustVal !== null && capKey) {
                setResults(prev => {
                  const next = { ...prev, [capKey]: adjustVal }
                  resultsRef.current = next
                  return next
                })
                setAdjustVal(null)
              }
              if (rescanReturnRef.current) { rescanReturnRef.current=false; finishScan() }
              else goTo(posIdx+1)
            }} style={{
              width:'100%', padding:'1rem',
              background: isMeasured ? `linear-gradient(135deg,${GREEN},#1A7A50)` : `linear-gradient(135deg,${AMBER},#C4721E)`,
              border:'none', borderRadius:14, color:'#fff',
              fontFamily:'monospace', fontSize:'0.9rem', fontWeight:900,
              cursor:'pointer', letterSpacing:'0.04em',
              boxShadow: isMeasured ? '0 4px 18px rgba(39,169,107,0.45)' : '0 4px 18px rgba(250,116,31,0.35)',
            }}>
              {rescanReturnRef.current ? '← Back to Report' : isMeasured ? '✓ Confirm & Next →' : 'Next Position →'}
            </button>

            {/* Retry / Finish */}
            <div style={{display:'flex',gap:'0.45rem'}}>
              <button onClick={()=>{ setAdjustVal(null); busyRef.current=false; setStage('hold'); setCountdown(currentPos.holdSeconds) }}
                style={{flex:1,padding:'0.65rem',background:'rgba(255,255,255,0.07)',border:`1px solid ${BORDER}`,borderRadius:12,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>
                ↺ Retry
              </button>
              <button onClick={()=>{
                if (adjustVal !== null && capKey) {
                  setResults(prev => {
                    const next = { ...prev, [capKey]: adjustVal }
                    resultsRef.current = next
                    return next
                  })
                }
                finishScan()
              }} style={{flex:1,padding:'0.65rem',background:'rgba(250,116,31,0.12)',border:`1px solid rgba(250,116,31,0.3)`,borderRadius:12,color:AMBER,fontFamily:'monospace',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>
                Finish &amp; report →
              </button>
            </div>
          </>
        })()}

        {/* ══ PAUSED ══ */}
        {stage==='paused' && <>
          <div>
            <div style={{fontSize:'0.88rem',fontWeight:800,color:AMBER,marginBottom:'0.3rem'}}>⏸ Paused — take your time</div>
            <div style={{fontSize:'0.73rem',color:WHITE2,lineHeight:1.5}}>{currentPos.detail}</div>
          </div>
          <button onClick={resume} style={{
            width:'100%',padding:'1rem',
            background:`linear-gradient(135deg,${GREEN},#1A7A50)`,
            border:'none',borderRadius:14,color:'#fff',
            fontFamily:'monospace',fontSize:'0.9rem',fontWeight:900,
            cursor:'pointer',boxShadow:'0 4px 18px rgba(39,169,107,0.4)',
          }}>
            ▶ Resume
          </button>
          <div style={{display:'flex',gap:'0.45rem'}}>
            {currentPos.optional && (
              <button onClick={()=>goTo(posIdx+1)} style={{flex:1,padding:'0.65rem',background:'rgba(255,255,255,0.05)',border:`1px solid ${BORDER}`,borderRadius:12,color:WHITE2,fontFamily:'monospace',fontSize:'0.72rem',cursor:'pointer'}}>Skip step</button>
            )}
            <button onClick={finishScan} style={{flex:1,padding:'0.65rem',background:'rgba(250,116,31,0.12)',border:`1px solid rgba(250,116,31,0.3)`,borderRadius:12,color:AMBER,fontFamily:'monospace',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>Finish &amp; report →</button>
          </div>
        </>}

      </div>
    </div>
  )
}
