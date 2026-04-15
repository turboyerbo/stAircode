'use client'
/**
 * ScanReadyScreen.tsx — ARAI_10  v2 "Guided Phase Flow"
 *
 * PHASE-BASED ARCHITECTURE:
 * ─────────────────────────
 *  Phase 0 — DETECT    : Claude Vision confirms stairs + counts steps
 *                         Non-residential → confirmation prompt
 *  Phase 1 — RISER     : User faces a riser. AR ray-cast measures height.
 *                         Claude Vision checks orthogonality. If tilted,
 *                         AI corrects the reading for perspective distortion.
 *  Phase 2 — TREAD     : Same feedback loop for tread depth.
 *  Phase 3 — WIDTH     : Side-on shot — AI measures stair width.
 *  Phase 4 — NOSING    : Simple Y/N visual check by Claude Vision.
 *  Phase 5 — HANDRAIL  : Optimised: single fast AI call with low threshold.
 *  Phase 6 — REVIEW    : Results confirmed, proceed to report.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { checkXRSupport, pickBestPlane, extractMeasurement, planeConfidence, polygonToMm } from '@/lib/xr-measure'
import type { UserRole } from './AuthScreen'
import { Analytics } from '@/lib/analytics'
import { BetaLogo } from '@/app/components/Logo'
import { getProfile } from '@/lib/profiles'
import type { ScanMode } from '@/app/components/ScanModeSelect'

// ── Palette ───────────────────────────────────────────────────────────────────
const NAVY  = '#0A1C2E'
const GREEN = '#27A96B'
const AMBER = '#FA741F'
const RED   = '#E84545'
const WHITE = '#E8F4FF'
const BLUE  = '#4A90E2'

type Phase = 'detect' | 'riser' | 'tread' | 'width' | 'nosing' | 'handrail' | 'review'

const PHASES: Phase[] = ['detect', 'riser', 'tread', 'width', 'nosing', 'handrail', 'review']

interface PhaseConfig {
  id:           Phase
  label:        string
  instruction:  string   // shown at top of screen
  arUsed:       boolean  // whether to attempt AR ray-cast
  aiPrompt:     (arMm: number | null) => string
  rangeMin:     number
  rangeMax:     number
  typical:      number
}

const PHASE_CONFIG: Record<Exclude<Phase, 'detect' | 'review'>, PhaseConfig> = {
  riser: {
    id: 'riser', label: 'Riser Height', instruction: 'Face the riser — hold phone level, step fills frame',
    arUsed: true, rangeMin: 100, rangeMax: 250, typical: 175,
    aiPrompt: (arMm) => `You are measuring RISER HEIGHT from a phone camera image of a staircase.
${arMm ? `ARCore ray-cast returned ${arMm}mm. Verify this reading.` : 'No AR data available.'}

ORTHOGONALITY CHECK: Is the camera facing the riser face directly (< 15° angle)?
- If YES: the AR/pixel measurement is reliable — use it directly.
- If NO: estimate the perspective distortion angle and CORRECT the reading.
  Formula: corrected = measured / cos(angle). State the angle you estimated.

Reply ONLY with valid JSON:
{"phase":"searching"|"guiding"|"measuring"|"locked","message":"1 short sentence","estimatedMm":number|null,"confidence":0.0-1.0,"orthogonalDeg":number,"correctionApplied":boolean}

Rules: lock if confidence >= 0.60. Residential risers: 125-200mm. No round numbers.`,
  },
  tread: {
    id: 'tread', label: 'Tread Depth', instruction: 'Point camera down at the treads from waist height',
    arUsed: true, rangeMin: 180, rangeMax: 420, typical: 250,
    aiPrompt: (arMm) => `You are measuring TREAD DEPTH from a phone camera image.
${arMm ? `ARCore returned ${arMm}mm. Verify.` : 'No AR data.'}

TREAD = flat horizontal surface from front edge (nosing) to back riser.
Check if camera is pointing straight down (< 20° from vertical). Correct for tilt if needed.

Reply ONLY with valid JSON:
{"phase":"searching"|"guiding"|"measuring"|"locked","message":"1 short sentence","estimatedMm":number|null,"secondaryMm":number|null,"confidence":0.0-1.0,"tiltDeg":number}

secondaryMm = stair width if both edges visible. Tread range: 220-350mm.`,
  },
  width: {
    id: 'width', label: 'Stair Width', instruction: 'Step back — both edges of stair in frame',
    arUsed: false, rangeMin: 600, rangeMax: 2000, typical: 900,
    aiPrompt: (_) => `Measure STAIR WIDTH — horizontal distance between both stringers/walls.
Both left AND right edges must be visible. Use riser height as scale reference.

Reply ONLY with valid JSON:
{"phase":"searching"|"guiding"|"measuring"|"locked","message":"1 short sentence","estimatedMm":number|null,"confidence":0.0-1.0}

Width range: 800-1400mm residential.`,
  },
  nosing: {
    id: 'nosing', label: 'Nosing', instruction: 'Point at the front edge of a tread',
    arUsed: false, rangeMin: 0, rangeMax: 50, typical: 0,
    aiPrompt: (_) => `Check for NOSING — the lip that overhangs the riser below the tread.

Look at the front edge of the tread. Is there a physical overhang MORE THAN 25mm beyond the riser face?
Ignore shadows and carpet edges — only count an actual physical protrusion.

Reply ONLY with valid JSON:
{"hasNosing":true|false,"estimatedMm":number|null,"confidence":0.0-1.0,"message":"1 sentence describing what you see"}`,
  },
  handrail: {
    id: 'handrail', label: 'Handrail Height', instruction: 'Stand beside stair — frame rail from tread to top',
    arUsed: false, rangeMin: 600, rangeMax: 1300, typical: 900,
    aiPrompt: (_) => `Measure HANDRAIL HEIGHT — vertical distance from tread nosing to top of rail.

IMPORTANT: Commit to a measurement immediately. Do NOT return "searching" more than once.
Use any visible portion to extrapolate. Default to 915mm at confidence 0.65 if rail is partially visible.

Reply ONLY with valid JSON:
{"phase":"searching"|"locked","message":"1 short sentence","estimatedMm":number|null,"confidence":0.0-1.0}

Residential range: 865-1070mm. Lock at confidence >= 0.55.`,
  },
}

let msgCounter = 0

async function callVision(b64: string, prompt: string, timeoutMs = 12000): Promise<string | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch('/api/vision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageB64: b64, prompt }), signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!r.ok) return null
    const d = await r.json()
    return d.text ?? null
  } catch { clearTimeout(t); return null }
}

function parseJSON(s: string | null): any {
  if (!s) return null
  try {
    const m = s.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

interface Props {
  userRole?: UserRole
  scanMode?: ScanMode
  onSuccess: (measurements: Record<string, number | string>) => void
  onBack:    () => void
}

interface Message { id: number; text: string; phase: string }

export default function ScanReadyScreen({ userRole = 'diy', scanMode = 'accuracy', onSuccess, onBack }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const captureRef = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const busyRef    = useRef(false)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xrSessionRef = useRef<any>(null)
  const latestPlanesRef = useRef<any[]>([])

  // ── Core state ─────────────────────────────────────────────────────────────
  const [camReady,      setCamReady]      = useState(false)
  const [camError,      setCamError]      = useState(false)
  const [phase,         setPhase]         = useState<Phase>('detect')
  const [messages,      setMessages]      = useState<Message[]>([])
  const [thinking,      setThinking]      = useState(false)
  const [results,       setResults]       = useState<Record<string, number | string>>({})

  // ── Detect phase state ─────────────────────────────────────────────────────
  const [stepCount,         setStepCount]         = useState<number | null>(null)
  const [isResidential,     setIsResidential]      = useState<boolean | null>(null)
  const [needsConfirmation, setNeedsConfirmation]  = useState(false)
  const [countdown,         setCountdown]          = useState(5)
  const [stairDetected,     setStairDetected]      = useState(false)

  // ── Measurement phase state ────────────────────────────────────────────────
  const [lockedMm,      setLockedMm]      = useState<number | null>(null)
  const [arMm,          setArMm]          = useState<number | null>(null)
  const [arActive,      setArActive]      = useState(false)
  const [arSupported,   setArSupported]   = useState(false)
  const [correction,    setCorrection]    = useState<string | null>(null)

  // ── Nosing phase state ─────────────────────────────────────────────────────
  const [nosingResult,  setNosingResult]  = useState<boolean | null>(null)
  const [nosingMm,      setNosingMm]      = useState<number>(0)

  // ── Review ─────────────────────────────────────────────────────────────────
  const [showReview,    setShowReview]    = useState(false)
  const [reviewVals,    setReviewVals]    = useState<Record<string, number | string>>({})

  const isSpeed = scanMode === 'speed'

  // ── Camera init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
        })
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
        setTimeout(() => { if (alive) setCamReady(true) }, 800)
      } catch { if (alive) setCamError(true) }
    }
    startCam()
    return () => { alive = false; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  // ── WebXR check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    checkXRSupport().then(s => setArSupported(s.immersiveAR && s.planeDetection)).catch(() => {})
  }, [])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function captureB64(scale = 0.65): string | null {
    const v = videoRef.current, c = captureRef.current
    if (!v || !c || v.readyState < 2) return null
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.80).split(',')[1]
  }

  function addMsg(text: string, p = 'guiding') {
    if (!text) return
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].text === text) return prev
      return [...prev.slice(-3), { id: ++msgCounter, text, phase: p }]
    })
  }

  function schedule(fn: () => void, ms: number) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(fn, ms)
  }

  // ── AR ray-cast: launch XR session and poll planes ─────────────────────────
  async function startARSession(phaseId: Phase) {
    if (!arSupported || !navigator.xr) return
    try {
      // @ts-ignore
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'plane-detection'],
        optionalFeatures: ['dom-overlay'],
      })
      xrSessionRef.current = session
      setArActive(true)

      session.addEventListener('planesdetected', (event: any) => {
        const planes: any[] = Array.from(event.planes as Set<any>)
        latestPlanesRef.current = planes

        const mode = phaseId === 'riser' ? 'riser' : phaseId === 'tread' ? 'tread' : 'width'
        const best = pickBestPlane(planes, mode)
        if (!best) return

        const mm = extractMeasurement(best, mode)
        const conf = planeConfidence(Array.from(best.polygon), 80, 2200, mm)
        if (conf !== 'low') {
          setArMm(mm)
        }
      })

      session.addEventListener('end', () => {
        setArActive(false)
        xrSessionRef.current = null
      })
    } catch {
      setArActive(false)
    }
  }

  function stopARSession() {
    xrSessionRef.current?.end().catch(() => {})
    xrSessionRef.current = null
    setArActive(false)
    setArMm(null)
    latestPlanesRef.current = []
  }

  // ════════════════════════════════════════════════════════════════
  // PHASE 0 — DETECT
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!camReady || phase !== 'detect') return

    let tick = 5, alive = true, inFlight = false
    setCountdown(5); setStairDetected(false)

    async function detect() {
      if (inFlight || !alive) return
      inFlight = true
      const b64 = captureB64(0.45)
      if (!b64) { inFlight = false; return }

      const raw = await callVision(b64, `Analyse this image of a potential staircase.

Reply ONLY with valid JSON:
{"stairVisible":true|false,"stepCount":number|null,"confident":true|false,"isResidential":true|false|null,"residentialReason":"brief reason"}

Rules:
- stairVisible: true if 2+ steps/risers/treads visible
- stepCount: count of visible steps (null if < 2)
- confident: true if clearly countable
- isResidential: true if typical home stair (under 4m wide, 125-200mm risers), false if commercial/industrial, null if unsure`, 10000)

      const parsed = parseJSON(raw)
      if (parsed?.stairVisible && parsed.confident && parsed.stepCount >= 2 && alive) {
        clearInterval(countdownInterval)
        clearInterval(pollInterval)
        setStepCount(parsed.stepCount)
        setIsResidential(parsed.isResidential)
        setStairDetected(true)
        if (parsed.isResidential === false) {
          setNeedsConfirmation(true)
        }
      }
      inFlight = false
    }

    detect()
    const pollInterval = setInterval(detect, 1500)
    const countdownInterval = setInterval(() => {
      tick -= 1
      if (alive) setCountdown(Math.max(0, tick))
      if (tick <= 0) clearInterval(countdownInterval)
    }, 1000)

    return () => {
      alive = false
      clearInterval(pollInterval)
      clearInterval(countdownInterval)
    }
  }, [camReady, phase]) // eslint-disable-line

  // When detected, advance after 2s (or wait for confirmation)
  useEffect(() => {
    if (!stairDetected || needsConfirmation) return
    const t = setTimeout(() => {
      setPhase('riser')
      addMsg('Great! Now face the riser directly — hold the phone level.', 'guiding')
    }, 2000)
    return () => clearTimeout(t)
  }, [stairDetected, needsConfirmation]) // eslint-disable-line

  // ════════════════════════════════════════════════════════════════
  // PHASES 1-3 — RISER / TREAD / WIDTH  (AI + optional AR)
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (phase !== 'riser' && phase !== 'tread' && phase !== 'width') return
    if (!camReady) return

    const cfg = PHASE_CONFIG[phase]
    busyRef.current = false
    setLockedMm(null)
    setArMm(null)
    setCorrection(null)

    // Start AR for riser/tread in accuracy mode
    if (cfg.arUsed && arSupported && !isSpeed) {
      startARSession(phase)
    }

    let alive = true

    async function analyse() {
      if (busyRef.current || !alive || lockedMm !== null) return
      busyRef.current = true
      setThinking(true)

      const b64 = captureB64()
      if (!b64) { busyRef.current = false; setThinking(false); schedule(analyse, 2000); return }

      const currentArMm = latestPlanesRef.current.length > 0
        ? (() => {
            const best = pickBestPlane(latestPlanesRef.current, phase === 'riser' ? 'riser' : 'tread')
            return best ? extractMeasurement(best, phase === 'riser' ? 'riser' : 'tread') : null
          })()
        : null

      const raw = await callVision(b64, cfg.aiPrompt(currentArMm), isSpeed ? 8000 : 15000)
      setThinking(false)
      busyRef.current = false

      if (!alive) return

      const r = parseJSON(raw)
      if (!r) { schedule(analyse, isSpeed ? 1500 : 3000); return }

      addMsg(r.message, r.phase)

      // Show correction note if AI adjusted for perspective
      if (r.correctionApplied && r.orthogonalDeg > 10) {
        setCorrection(`Corrected ${r.orthogonalDeg}° tilt`)
      }

      const threshold = isSpeed ? 0.50 : (phase === 'width' ? 0.60 : 0.62)
      if ((r.phase === 'locked' || isSpeed) && r.estimatedMm && r.confidence >= threshold) {
        const mm = Math.min(Math.max(Math.round(r.estimatedMm), cfg.rangeMin), cfg.rangeMax)
        setLockedMm(mm)
        if (r.secondaryMm && phase === 'tread') {
          setResults(prev => ({ ...prev, width: Math.round(r.secondaryMm) }))
        }
        stopARSession()
        Analytics.measurementLocked(phase, mm, r.confidence)
      } else {
        schedule(analyse, isSpeed ? 1200 : (r.phase === 'searching' ? 3000 : 2200))
      }
    }

    schedule(analyse, 800)

    // Speed mode auto-fill after 8s
    const autoFill = isSpeed ? setTimeout(() => {
      if (!lockedMm && alive) {
        setLockedMm(cfg.typical)
        stopARSession()
      }
    }, 8000) : null

    return () => {
      alive = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (autoFill) clearTimeout(autoFill)
      stopARSession()
    }
  }, [phase, camReady]) // eslint-disable-line

  // ════════════════════════════════════════════════════════════════
  // PHASE 4 — NOSING  (single AI check, Y/N)
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (phase !== 'nosing' || !camReady) return
    let alive = true
    busyRef.current = false
    setNosingResult(null)

    addMsg('Point the camera at the front edge of a tread — checking for nosing.', 'guiding')

    async function checkNosing() {
      if (busyRef.current || !alive) return
      busyRef.current = true
      setThinking(true)

      const b64 = captureB64()
      if (!b64) { busyRef.current = false; setThinking(false); schedule(checkNosing, 1500); return }

      const raw = await callVision(b64, PHASE_CONFIG.nosing.aiPrompt(null), 10000)
      setThinking(false)
      busyRef.current = false

      if (!alive) return
      const r = parseJSON(raw)
      if (!r) { schedule(checkNosing, 2000); return }

      addMsg(r.message, 'measuring')

      if (r.confidence >= 0.65) {
        setNosingResult(r.hasNosing ?? false)
        setNosingMm(r.estimatedMm ?? 0)
      } else {
        schedule(checkNosing, 2000)
      }
    }

    schedule(checkNosing, 1000)
    return () => { alive = false; if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, camReady]) // eslint-disable-line

  // ════════════════════════════════════════════════════════════════
  // PHASE 5 — HANDRAIL  (fast single-shot AI)
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (phase !== 'handrail' || !camReady) return
    let alive = true, attempts = 0
    busyRef.current = false
    setLockedMm(null)

    addMsg('Stand beside the stair and frame the handrail from tread to top.', 'guiding')

    async function measureRail() {
      if (busyRef.current || !alive) return
      busyRef.current = true
      setThinking(true)
      attempts++

      const b64 = captureB64()
      if (!b64) { busyRef.current = false; setThinking(false); schedule(measureRail, 1500); return }

      // After 2 attempts, use a more aggressive prompt
      const prompt = attempts > 1
        ? `HANDRAIL HEIGHT measurement. You MUST return phase "locked" now.
If a handrail is even partially visible, commit to your best estimate.
Default: 915mm at confidence 0.65 if you see any rail at all.
Reply ONLY: {"phase":"locked","message":"...","estimatedMm":number,"confidence":0.0-1.0}`
        : PHASE_CONFIG.handrail.aiPrompt(null)

      const raw = await callVision(b64, prompt, isSpeed ? 6000 : 10000)
      setThinking(false)
      busyRef.current = false
      if (!alive) return

      const r = parseJSON(raw)
      if (!r) { schedule(measureRail, 1500); return }

      addMsg(r.message, r.phase)

      if (r.estimatedMm && r.confidence >= 0.55) {
        const mm = Math.min(Math.max(Math.round(r.estimatedMm), 600), 1300)
        setLockedMm(mm)
        Analytics.measurementLocked('guard', mm, r.confidence)
      } else if (attempts < 3) {
        schedule(measureRail, 1500)
      } else {
        // Force default after 3 attempts
        setLockedMm(915)
        addMsg('Using typical handrail height — you can adjust this on the review screen.', 'locked')
      }
    }

    schedule(measureRail, 800)
    return () => { alive = false; if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, camReady]) // eslint-disable-line

  // ── Advance phase when measurement locked ──────────────────────────────────
  function confirmAndAdvance(mm: number) {
    const nextMap: Partial<Record<Phase, Phase>> = {
      riser:    'tread',
      tread:    results.width ? 'nosing' : 'width',
      width:    'nosing',
      handrail: 'review',
    }
    const newResults = { ...results, [phase]: mm }
    setResults(newResults)
    setLockedMm(null)

    const next = nextMap[phase]
    if (next) {
      const labels: Record<string, string> = {
        tread: 'Tread depth locked. Now point the camera down at the treads.',
        width: 'Now step back so both sides of the stair are visible.',
        nosing: 'Now check for nosing — point at the front edge of a tread.',
        handrail: 'Almost done! Frame the handrail from tread to top.',
        review: 'All measurements complete!',
      }
      addMsg(labels[next] ?? 'Next step', 'guiding')
      setPhase(next)
    }
  }

  function confirmNosing(hasNosing: boolean) {
    const newResults = { ...results, nosing: hasNosing ? (nosingMm || 30) : 'none' }
    setResults(newResults)
    addMsg('Almost done! Frame the handrail from tread to top.', 'guiding')
    setPhase('handrail')
  }

  function confirmHandrail(mm: number) {
    const newResults: Record<string, number | string> = { ...results, guard: mm }
    setResults(newResults)
    if (!newResults.headroom) newResults.headroom = 'clear'
    setReviewVals(newResults)
    setShowReview(true)
    setPhase('review')
  }

  function finishReview() {
    Analytics.scanCompleted({ role: userRole, measurementCount: Object.keys(reviewVals).length, hasFailed: false })
    onSuccess(reviewVals)
  }

  const profile = getProfile(userRole)
  const GOLD = '#F0B429'

  // ── Camera error ─────────────────────────────────────────────────────────
  if (camError) return (
    <div style={{ position:'fixed', inset:0, background:NAVY, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'2rem' }}>
      <div style={{ fontSize:'2rem' }}>📷</div>
      <p style={{ color:WHITE, textAlign:'center' }}>Camera access required</p>
      <button onClick={onBack} style={{ padding:'0.8rem 2rem', background:AMBER, border:'none', borderRadius:12, color:'#fff', fontWeight:700, cursor:'pointer' }}>← Back</button>
    </div>
  )

  const currentPhaseLabel = phase === 'detect' ? 'Detecting stairs…'
    : phase === 'review' ? 'Review'
    : PHASE_CONFIG[phase]?.label ?? phase

  const phaseInstruction = phase === 'detect' ? 'Point your camera at the staircase'
    : phase === 'review' ? 'Confirm your measurements'
    : PHASE_CONFIG[phase]?.instruction ?? ''

  const lastMsg = messages[messages.length - 1]

  return (
    <div style={{ position:'fixed', inset:0, background:'#000', overflow:'hidden' }}>
      {/* Camera feed */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity: lockedMm ? 0.55 : 1, transition:'opacity 0.4s' }}
      />
      <canvas ref={captureRef} style={{ display:'none' }} />

      {/* Top bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:50,
        paddingTop:'max(env(safe-area-inset-top,0px),2.2rem)', paddingBottom:'0.6rem',
        paddingLeft:'1rem', paddingRight:'1rem',
        background:'linear-gradient(to bottom,rgba(0,0,0,0.8),transparent)',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onBack}
          style={{ width:38, height:38, borderRadius:'50%', background:'rgba(0,0,0,0.5)',
            border:'1px solid rgba(255,255,255,0.2)', color:WHITE, fontSize:'1rem', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center' }}>←</button>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'0.65rem', fontFamily:'monospace', letterSpacing:'0.15em', color:'rgba(255,255,255,0.5)' }}>
            {PHASES.filter(p => p !== 'review').indexOf(phase as Exclude<Phase,'review'>) + 1} / {PHASES.length - 1}
          </div>
          <div style={{ fontSize:'0.75rem', fontWeight:700, color:WHITE }}>{currentPhaseLabel}</div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'0.3rem',
          background: arActive ? 'rgba(39,169,107,0.2)' : arSupported ? 'rgba(74,144,226,0.15)' : 'rgba(242,147,55,0.15)',
          border:`1px solid ${arActive ? 'rgba(39,169,107,0.5)' : arSupported ? 'rgba(74,144,226,0.4)' : 'rgba(242,147,55,0.4)'}`,
          borderRadius:14, padding:'0.2rem 0.6rem' }}>
          <div style={{ width:5, height:5, borderRadius:'50%',
            background: arActive ? GREEN : arSupported ? BLUE : AMBER,
            boxShadow:`0 0 5px ${arActive ? GREEN : arSupported ? BLUE : AMBER}` }}/>
          <span style={{ fontSize:'0.52rem', fontFamily:'monospace', letterSpacing:'0.1em',
            color: arActive ? GREEN : arSupported ? BLUE : AMBER, fontWeight:700 }}>
            {arActive ? 'AR ACTIVE' : arSupported
              ? (/iPad|iPhone|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? 'ARKit' : 'ARCore')
              : 'AI'}
          </span>
        </div>
      </div>

      {/* Phase instruction banner */}
      <div style={{ position:'absolute', top:'5.5rem', right:'1rem', zIndex:45,
        background:'rgba(10,28,46,0.96)', backdropFilter:'blur(10px)',
        border:'1px solid rgba(255,255,255,0.18)', borderRadius:14,
        padding:'0.65rem 0.95rem', maxWidth:220, textAlign:'right',
        boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize:'0.82rem', color:'#FFFFFF', fontWeight:700, lineHeight:1.45 }}>{phaseInstruction}</div>
      </div>

      {/* AR reading indicator */}
      {arMm && (
        <div style={{ position:'absolute', top:'9rem', right:'1rem', zIndex:45,
          background:'rgba(39,169,107,0.15)', border:'1px solid rgba(39,169,107,0.4)',
          borderRadius:10, padding:'0.4rem 0.7rem', textAlign:'right' }}>
          <div style={{ fontSize:'0.55rem', color:GREEN, fontFamily:'monospace', letterSpacing:'0.1em' }}>AR READING</div>
          <div style={{ fontSize:'1rem', fontWeight:900, color:GREEN, fontFamily:'monospace' }}>{arMm}<span style={{ fontSize:'0.6rem' }}>mm</span></div>
          {correction && <div style={{ fontSize:'0.55rem', color:'rgba(39,169,107,0.7)' }}>{correction}</div>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          DETECT PHASE UI
      ══════════════════════════════════════════════════ */}
      {phase === 'detect' && (
        <div style={{ position:'absolute', bottom:'max(env(safe-area-inset-bottom,0px),2.5rem)',
          left:'1rem', right:'1rem', zIndex:50,
          display:'flex', flexDirection:'column', alignItems:'center', gap:'0.8rem' }}>

          {/* Countdown ring */}
          {!stairDetected && (
            <>
              <div style={{ position:'relative', width:72, height:72 }}>
                <svg width="72" height="72" style={{ transform:'rotate(-90deg)' }}>
                  <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5"/>
                  <circle cx="36" cy="36" r="30" fill="none"
                    stroke={countdown === 0 ? RED : AMBER} strokeWidth="5"
                    strokeDasharray={`${2*Math.PI*30}`}
                    strokeDashoffset={`${2*Math.PI*30*(1-countdown/5)}`}
                    strokeLinecap="round"
                    style={{ transition:'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
                  />
                </svg>
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'1.5rem', fontWeight:900, color: countdown===0 ? RED : WHITE, fontFamily:'monospace' }}>
                  {countdown > 0 ? countdown : '!'}
                </div>
              </div>
              <div style={{ background:'rgba(10,28,46,0.88)', backdropFilter:'blur(6px)',
                border:`1px solid ${countdown===0 ? 'rgba(232,69,69,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius:14, padding:'0.6rem 1rem', textAlign:'center', maxWidth:280 }}>
                {countdown > 0
                  ? <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.7)', fontFamily:'monospace', letterSpacing:'0.08em' }}>DETECTING STAIRCASE…</div>
                  : <>
                      <div style={{ fontSize:'0.75rem', color:RED, fontFamily:'monospace', fontWeight:800, letterSpacing:'0.08em', marginBottom:'0.3rem' }}>✕ NO STAIRCASE DETECTED</div>
                      <div style={{ fontSize:'0.68rem', color:WHITE, lineHeight:1.6 }}>Point camera directly at stairs. 2–3 steps must be visible.</div>
                    </>
                }
              </div>
            </>
          )}

          {/* Stair detected — show count */}
          {stairDetected && !needsConfirmation && (
            <div style={{ background:'rgba(10,28,46,0.92)', backdropFilter:'blur(8px)',
              border:'1.5px solid rgba(39,169,107,0.5)', borderRadius:18,
              padding:'1rem 1.25rem', textAlign:'center', maxWidth:300 }}>
              <div style={{ fontSize:'1.5rem', marginBottom:'0.3rem' }}>✓</div>
              <div style={{ fontSize:'0.85rem', fontWeight:800, color:GREEN, marginBottom:'0.2rem' }}>
                {stepCount} steps detected
              </div>
              <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.7)' }}>
                Starting measurements…
              </div>
            </div>
          )}

          {/* Non-residential confirmation */}
          {needsConfirmation && (
            <div style={{ background:'rgba(10,28,46,0.95)', backdropFilter:'blur(12px)',
              border:`1.5px solid ${AMBER}44`, borderRadius:18,
              padding:'1.1rem 1.25rem', textAlign:'center', maxWidth:300, width:'100%' }}>
              <div style={{ fontSize:'0.85rem', fontWeight:700, color:AMBER, marginBottom:'0.4rem' }}>
                ⚠ These may not be residential stairs
              </div>
              <div style={{ fontSize:'0.7rem', color:WHITE, lineHeight:1.6, marginBottom:'0.75rem' }}>
                I detected {stepCount} steps but they look like they may be commercial or industrial.
                Residential codes require different tolerances.
              </div>
              <div style={{ display:'flex', gap:'0.6rem' }}>
                <button onClick={() => { setNeedsConfirmation(false); setPhase('riser') }}
                  style={{ flex:1, padding:'0.7rem', background:GREEN, border:'none', borderRadius:10,
                    color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'monospace', fontSize:'0.78rem' }}>
                  ✓ Residential
                </button>
                <button onClick={() => { setNeedsConfirmation(false); setPhase('riser') }}
                  style={{ flex:1, padding:'0.7rem', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)',
                    borderRadius:10, color:WHITE, fontWeight:600, cursor:'pointer', fontFamily:'monospace', fontSize:'0.78rem' }}>
                  Continue anyway
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MEASUREMENT PHASES (riser / tread / width / handrail)
      ══════════════════════════════════════════════════ */}
      {(phase === 'riser' || phase === 'tread' || phase === 'width' || phase === 'handrail') && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:50,
          background:'linear-gradient(to top, rgba(10,28,46,0.98) 60%, transparent)',
          paddingTop:'2rem', paddingLeft:'1.25rem', paddingRight:'1.25rem',
          paddingBottom:'max(env(safe-area-inset-bottom,0px),2.2rem)',
          display:'flex', flexDirection:'column', gap:'0.75rem' }}>

          {/* AI coach message */}
          {lastMsg && (
            <div style={{
              background: 'rgba(10,28,46,0.95)',
              borderRadius: 16,
              padding: '0.85rem 1.1rem',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#FFFFFF',
                lineHeight: 1.55,
                letterSpacing: '-0.01em',
              }}>{lastMsg.text}</div>
            </div>
          )}

          {thinking && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem',
              background:'rgba(10,28,46,0.85)', borderRadius:10, padding:'0.5rem 0.85rem',
              border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:AMBER, animation:'pulse 1s infinite', flexShrink:0 }}/>
              <span style={{ fontSize:'0.82rem', fontWeight:600, color:'rgba(255,255,255,0.85)' }}>Analysing…</span>
            </div>
          )}

          {/* Locked — confirm button */}
          {lockedMm && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'3rem', fontWeight:900, color:WHITE, letterSpacing:'-0.04em', lineHeight:1 }}>{lockedMm}</div>
                <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.45)', fontFamily:'monospace' }}>mm</div>
                {correction && <div style={{ fontSize:'0.62rem', color:GREEN, marginTop:'0.2rem' }}>📐 {correction}</div>}
              </div>
              <div style={{ display:'flex', gap:'0.6rem' }}>
                <button onClick={() => { setLockedMm(null); schedule(() => {}, 100) }}
                  style={{ flex:1, padding:'0.85rem', background:'rgba(255,255,255,0.08)',
                    border:'1px solid rgba(255,255,255,0.2)', borderRadius:14,
                    color:'rgba(255,255,255,0.6)', fontFamily:'monospace', cursor:'pointer', fontSize:'0.82rem' }}>
                  ↺ Retry
                </button>
                <button onClick={() => phase === 'handrail' ? confirmHandrail(lockedMm) : confirmAndAdvance(lockedMm)}
                  style={{ flex:2, padding:'0.85rem',
                    background:`linear-gradient(135deg,${GREEN},#1A7A50)`,
                    border:'none', borderRadius:14, color:'#fff',
                    fontFamily:'monospace', fontWeight:800, cursor:'pointer',
                    fontSize:'0.9rem', boxShadow:'0 4px 20px rgba(39,169,107,0.45)' }}>
                  ✓ Confirm {lockedMm}mm →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          NOSING PHASE — Y/N
      ══════════════════════════════════════════════════ */}
      {phase === 'nosing' && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:50,
          background:'linear-gradient(to top, rgba(10,28,46,0.98) 60%, transparent)',
          paddingTop:'2rem', paddingLeft:'1.25rem', paddingRight:'1.25rem',
          paddingBottom:'max(env(safe-area-inset-bottom,0px),2.2rem)',
          display:'flex', flexDirection:'column', gap:'0.75rem' }}>

          {lastMsg && (
            <div style={{
              background: 'rgba(10,28,46,0.95)',
              borderRadius: 16,
              padding: '0.85rem 1.1rem',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#FFFFFF',
                lineHeight: 1.55,
                letterSpacing: '-0.01em',
              }}>{lastMsg.text}</div>
            </div>
          )}

          {thinking && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.6rem',
              background:'rgba(10,28,46,0.85)', borderRadius:10, padding:'0.5rem 0.85rem',
              border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:AMBER, animation:'pulse 1s infinite', flexShrink:0 }}/>
              <span style={{ fontSize:'0.82rem', fontWeight:600, color:'rgba(255,255,255,0.85)' }}>Checking for nosing…</span>
            </div>
          )}

          {nosingResult !== null && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:14, padding:'0.85rem 1rem', textAlign:'center' }}>
                <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.6)', marginBottom:'0.25rem' }}>AI detects:</div>
                <div style={{ fontSize:'1.1rem', fontWeight:800, color: nosingResult ? AMBER : GREEN }}>
                  {nosingResult ? `Nosing present (~${nosingMm || 30}mm)` : 'No nosing detected'}
                </div>
              </div>
              <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.5)', textAlign:'center' }}>Is this correct?</div>
              <div style={{ display:'flex', gap:'0.6rem' }}>
                <button onClick={() => confirmNosing(false)}
                  style={{ flex:1, padding:'0.9rem', background:'rgba(39,169,107,0.15)',
                    border:'1.5px solid rgba(39,169,107,0.4)', borderRadius:14,
                    color:GREEN, fontWeight:700, cursor:'pointer', fontFamily:'monospace', fontSize:'0.85rem' }}>
                  ✗ No nosing
                </button>
                <button onClick={() => confirmNosing(true)}
                  style={{ flex:1, padding:'0.9rem', background:'rgba(250,116,31,0.15)',
                    border:'1.5px solid rgba(250,116,31,0.4)', borderRadius:14,
                    color:AMBER, fontWeight:700, cursor:'pointer', fontFamily:'monospace', fontSize:'0.85rem' }}>
                  ✓ Has nosing
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          REVIEW SCREEN
      ══════════════════════════════════════════════════ */}
      {showReview && (
        <div style={{ position:'absolute', inset:0, zIndex:80,
          background:'rgba(10,28,46,0.97)', backdropFilter:'blur(20px)',
          overflowY:'auto', padding:'max(env(safe-area-inset-top,0px),3rem) 1.25rem 2rem' }}>
          <div style={{ maxWidth:440, margin:'0 auto', display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'1.5rem', marginBottom:'0.3rem' }}>📐</div>
              <div style={{ fontSize:'1.1rem', fontWeight:800, color:WHITE }}>Review Measurements</div>
              <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.5)', marginTop:'0.2rem' }}>Tap any value to adjust</div>
            </div>

            {[
              { key:'rise',   label:'Riser Height',   unit:'mm' },
              { key:'run',    label:'Tread Depth',    unit:'mm' },
              { key:'width',  label:'Stair Width',    unit:'mm' },
              { key:'nosing', label:'Nosing',         unit:'' },
              { key:'guard',  label:'Handrail Height', unit:'mm' },
            ].map(({ key, label, unit }) => (
              <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'rgba(255,255,255,0.05)', borderRadius:12, padding:'0.75rem 1rem',
                border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.7)' }}>{label}</div>
                <div style={{ fontSize:'1rem', fontWeight:700, color:WHITE, fontFamily:'monospace' }}>
                  {reviewVals[key] == null ? '—'
                    : key === 'nosing' ? (reviewVals[key] === 'none' ? 'None' : `${reviewVals[key]}mm`)
                    : `${reviewVals[key]}${unit}`}
                </div>
              </div>
            ))}

            <button onClick={finishReview}
              style={{ width:'100%', padding:'1.1rem',
                background:`linear-gradient(135deg,${GOLD},#D97706)`,
                border:'none', borderRadius:16, color:'#000',
                fontFamily:'monospace', fontSize:'0.95rem', fontWeight:900,
                letterSpacing:'0.08em', cursor:'pointer',
                boxShadow:'0 4px 24px rgba(240,180,41,0.4)', marginTop:'0.5rem' }}>
              Generate Report →
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
    </div>
  )
}
