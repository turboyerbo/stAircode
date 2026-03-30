'use client'
/**
 * ScanReadyScreen.tsx — ARAI_10  "AR Coach + Visual Measurement"
 *
 * ARCHITECTURE:
 * ─────────────
 * One persistent camera view. Claude coaches conversationally.
 * A canvas overlay draws animated measurement lines over the live feed
 * as each component is being measured — matching the engineering diagrams:
 *
 *   TREAD    → horizontal line from nose of tread to back edge (riser face)
 *   RISER    → vertical line from top of tread up to underside of next tread
 *   WIDTH    → horizontal line across the full stair width at tread level
 *   HANDRAIL → vertical line from tread surface up to top of rail
 *   NOSING   → small horizontal tick mark at the front edge of the tread
 *
 * Background checks (silent AI, no user action needed):
 *   - Nosing presence/absence
 *   - Baluster spacing estimate
 *   - Tread/riser uniformity
 *   - Open-riser detection
 *   - Headroom estimate
 *
 * FLOW:
 * ─────
 *   1. Camera opens → Claude introduces first measurement
 *   2. Every 3s: capture frame → Claude returns coaching message + readiness
 *   3. When ready: animate measurement line → lock value
 *   4. User reviews locked value (± adjust), confirms
 *   5. Transition to next component
 *   6. After all primary measurements: review panel slides up
 *   7. onSuccess() → ReportScreen
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { checkXRSupport } from '@/lib/xr-measure'
import type { UserRole } from './AuthScreen'
import { Analytics } from '@/lib/analytics'
import { BetaLogo } from '@/app/components/Logo'
import { getProfile } from '@/lib/profiles'
import type { ScanMode } from '@/app/components/ScanModeSelect'

// ── Palette ────────────────────────────────────────────────────────────────────
const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const GREEN  = '#3DB88A'
const AMBER  = '#F29337'
const RED    = '#E85555'
const PURPLE = '#417CA4'
const WHITE  = '#E8F4FF'
const SLATE  = '#93BAD4'

// ── Measurement component definitions ─────────────────────────────────────────
type MeasId = 'rise' | 'run' | 'width' | 'guard' | 'nosing' | 'headroom'

interface MeasDef {
  id:       MeasId
  label:    string
  unit:     string
  color:    string
  rangeMin: number
  rangeMax: number
  typical:  number
  silent:   boolean   // true = measure in background, no user prompt
  lineType: 'vertical' | 'horizontal' | 'tick' | 'none'
  intro:    string    // coach opening line (only for non-silent)
  aiContext: string   // what to look for / how to measure
}

const MEASUREMENTS: MeasDef[] = [
  {
    id: 'rise', label: 'Riser Height', unit: 'mm', color: GREEN,
    rangeMin: 100, rangeMax: 250, typical: 175, silent: false,
    lineType: 'vertical',
    intro: "Let's start with the riser — that's the vertical face of each step, sometimes called a kick plate. On some stairs it's a solid panel; on others it's open (no panel at all). Hold your phone upright and point it straight at the front face of the steps.",
    aiContext: `TARGET: RISER HEIGHT — vertical distance from top of one tread to top of the next. The riser is the vertical face (sometimes called a kick plate). It may be solid/closed or open (no panel — just the structural support).
GOOD FRAME: 2-3 risers fully visible, phone upright and straight-on to the riser face, riser fills 1/3 to 2/3 of frame height.
BAD FRAME: looking down at treads, steep angle, riser cut off at top/bottom, too close or too far.
MEASUREMENT: count visible risers, estimate total height in pixels, divide by count. Each riser should be identical. Note in your message if the risers appear open (no kick plate) or closed.
Real riser heights: 125–200mm. Do not return round numbers (173 not 175, 196 not 200).`,
  },
  {
    id: 'run', label: 'Tread Depth', unit: 'mm', color: AMBER,
    rangeMin: 180, rangeMax: 420, typical: 250, silent: false,
    lineType: 'vertical',
    intro: "Now I need to measure the tread — that's the flat part of the step you actually walk on. It's also called the 'run'. Point the camera straight down at the steps from about waist height, like you're looking down at your feet.",
    aiContext: `TARGET: TREAD DEPTH (also called the "run") — the flat horizontal surface you step on. Measured from the front edge (nosing) to the back riser face.
TERMINOLOGY NOTE: In your message, refer to this as the "tread" (the part you step on) — not "going" or "run" unless the user's role is architect or contractor.
GOOD FRAME: camera pointing DOWN at treads from ~1m above, 3-5 tread bands visible as horizontal stripes, phone roughly level.
BAD FRAME: pointing sideways at the riser, only one tread, heavily tilted, too close or too far.
MEASUREMENT: measure depth of one tread band in pixels, calibrate using riser height if visible.
Real tread depths: 220–350mm. Also check if you can see the stair width — if so include secondaryMm (600–1600mm).`,
  },
  {
    id: 'width', label: 'Stair Width', unit: 'mm', color: BLUE,
    rangeMin: 600, rangeMax: 2000, typical: 960, silent: false,
    lineType: 'horizontal',
    intro: "Perfect. Step back now so I can see the full width of the staircase — both sides need to be in frame.",
    aiContext: `TARGET: STAIR WIDTH — clear horizontal distance from one stringer/wall to the other.
GOOD FRAME: both left AND right edges of the stair visible, camera facing straight-on, at least one riser visible for scale.
BAD FRAME: only one side visible, camera too close, looking along the stair from the side.
MEASUREMENT: measure pixel distance between outer edges, use riser height as scale reference.
Real stair widths: 800–1400mm residential, up to 2000mm commercial.`,
  },
  {
    id: 'guard', label: 'Handrail Height', unit: 'mm', color: PURPLE,
    rangeMin: 600, rangeMax: 1300, typical: 900, silent: false,
    lineType: 'vertical',
    intro: "Last measurement — handrail height. Stand BESIDE the stair, not on it. Hold your phone upright and frame the rail from the tread at the bottom to the top of the handrail. The full rail height needs to be in frame.",
    aiContext: `TARGET: HANDRAIL HEIGHT — vertical distance from tread nosing to top of handrail/guard rail.

CRITICAL: Attempt a measurement from ANY frame showing a stair handrail. Never refuse.

ESTIMATION STRATEGY (use in order):
1. Full rail visible side-on with tread at bottom — measure directly
2. Partial rail — extrapolate using visible portion and typical proportions
3. Use known riser height (175-200mm) as pixel scale, multiply up to rail height
4. Rail partially visible — estimate based on risers visible x riser height x typical ratio
5. LAST RESORT: If any handrail visible, return 915mm at confidence 0.65

RULES:
- NEVER return phase searching more than twice in a row — always attempt a lock
- Lock at confidence 0.62 or higher — be lenient, handrail is hardest to frame
- Residential range 865-1070mm. Default: 900-965mm
- If no handrail at all visible, return estimatedMm: 915, confidence: 0.60`,
  },
  // Silent background measurements
  {
    id: 'nosing', label: 'Nosing Projection', unit: 'mm', color: SLATE,
    rangeMin: 0, rangeMax: 50, typical: 0, silent: true,
    lineType: 'tick',
    intro: '',
    aiContext: `TARGET: NOSING PROJECTION — how far the front edge of the tread overhangs the riser below.

CRITICAL INSTRUCTION: The DEFAULT assumption is NO NOSING (noNosing: true, estimatedMm: 0).
Only set noNosing: false if you can clearly and unambiguously see a physical lip protruding MORE THAN 30mm beyond the riser face.
Shadows, image compression, and carpet edges are NOT nosing. When in doubt, report NO NOSING.
Most residential stairs do NOT have a nosing, especially newer construction.`,
  },
  {
    id: 'headroom', label: 'Headroom', unit: 'mm', color: SLATE,
    rangeMin: 1800, rangeMax: 3000, typical: 2200, silent: true,
    lineType: 'none',
    intro: '',
    aiContext: `TARGET: HEADROOM CLEARANCE — vertical clearance from the nosing line to the ceiling/soffit above.
Look for any ceiling, beam, or soffit visible above the stair. If nothing is visible above, it is likely open/clear — return estimatedMm: 9999 and openAbove: true.
Typical residential headroom: 1950–2400mm.`,
  },
]

// ── AI response shape ──────────────────────────────────────────────────────────
interface CoachResponse {
  phase:       'searching' | 'guiding' | 'measuring' | 'locked'
  message:     string
  estimatedMm: number | null
  secondaryMm: number | null
  confidence:  number
  openAbove?:  boolean
  noNosing?:   boolean
}

// ── Canvas line definitions ────────────────────────────────────────────────────
interface AnimLine {
  type:       'vertical' | 'horizontal' | 'tick'
  color:      string
  label:      string
  valueMm:    number
  progress:   number    // 0 → 1 animation progress
  x1: number; y1: number; x2: number; y2: number  // normalised 0-1 coords
}

interface Props {
  userRole?: UserRole
  scanMode?: ScanMode
  onSuccess: (measurements: Record<string, number | string>) => void
  onBack:    () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
let msgCounter = 0

async function callVision(b64: string, prompt: string): Promise<string | null> {
  const ctrl    = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 22_000)
  try {
    const r = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageB64: b64, prompt }),
      signal: ctrl.signal,
    })
    clearTimeout(timeout)
    if (!r.ok) return null
    const d = await r.json()
    return d.text ?? null
  } catch { clearTimeout(timeout); return null }
}

function parseJSON(s: string): any {
  try { return JSON.parse(s.replace(/```json|```/g, '').trim()) }
  catch { return null }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ScanReadyScreen({ userRole = 'diy', scanMode = 'accuracy', onSuccess, onBack }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const analysisRef2 = useRef<() => Promise<void>>(async () => {})
  const busyRef    = useRef(false)
  const historyRef = useRef<string[]>([])
  const animRef    = useRef<ReturnType<typeof requestAnimationFrame>>(0)
  const linesRef   = useRef<AnimLine[]>([])

  const [camReady,   setCamReady]   = useState(false)
  const [camError,   setCamError]   = useState(false)
  const [stepIdx,    setStepIdx]    = useState(0)
  const stepIdxRef  = useRef(0)
  const [apiError,   setApiError]   = useState<string | null>(null)
  const [messages,   setMessages]   = useState<Array<{id:number; text:string; phase: CoachResponse['phase']}>>([])
  const [thinking,   setThinking]   = useState(false)
  const [lockedMm,   setLockedMm]   = useState<number | null>(null)
  const [pendingSec, setPendingSec] = useState<number | null>(null)
  const [results,    setResults]    = useState<Record<string, number | string>>({})
  const [showReview, setShowReview] = useState(false)
  const [reviewVals, setReviewVals] = useState<Record<string, number | string>>({})
  const [arSupported, setArSupported] = useState(false)
  // Intro overlay — fades out before AI begins
  const [introOpacity, setIntroOpacity]   = useState(1)
  const [introGone,    setIntroGone]      = useState(false)
  // Stuck hint — man-crouching image shown when user appears stuck
  const [showStuck,    setShowStuck]      = useState(false)
  // Nosing not detected overlay
  const [showNoNosing, setShowNoNosing]   = useState(false)
  // Speed mode: auto-fill timer ref — fires after 8s per step if no lock
  const speedAutoFillRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Handrail manual entry fallback — shown after 15s if guard not locked
  const [showHandrailFallback, setShowHandrailFallback] = useState(false)
  const [manualHandrail,       setManualHandrail]       = useState(950)  // typical default
  const handrailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Step count — first thing AI delivers
  const [stepCount,    setStepCount]      = useState<number | null>(null)
  const [showStepCount,setShowStepCount]  = useState(false)
  const [textGone,     setTextGone]       = useState(false)   // text fades 2-3s after image
  // Conditions warning — shown when AI can't get a count
  const [showConditionsWarning, setShowConditionsWarning] = useState(false)
  // Handrail failsafe — count failed attempts, show manual entry after 3
  const [guardAttempts,  setGuardAttempts]  = useState(0)
  const [showGuardHelp,  setShowGuardHelp]  = useState(false)
  const [manualGuardMm,  setManualGuardMm]  = useState(900)
  const stepCountAttemptedRef = useRef(false)
  const stuckTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stuckShownRef  = useRef(false)

  const primarySteps = MEASUREMENTS.filter(m => !m.silent)
  const step = primarySteps[stepIdx]

  // ── AR support check ────────────────────────────────────────────────────────
  useEffect(() => {
    checkXRSupport().then(s => setArSupported(s.immersiveAR && s.planeDetection)).catch(() => {})
  }, [])

  // ── Camera ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        let stream: MediaStream
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }) }
        catch { try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }) }
                catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }) } }
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
        await new Promise(r => setTimeout(r, 700))
        if (alive) {
          setCamReady(true)
          // Quick API health check — verify key is configured on this server
          fetch('/api/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageB64: 'test', prompt: 'ping' }),
          }).then(r => r.json()).then(d => {
            if (d.error === 'API key not configured') {
              setApiError('⚠ AI service not configured — the Anthropic API key is missing from this server. Contact support at info@staircode.app.')
            }
            // Any other response (including "Invalid request body") means the key is present — clear error
            if (!d.error || d.error !== 'API key not configured') {
              setApiError(null)
            }
          }).catch(() => {
            // Network error pinging our own API — don't show error, just let the scan proceed
          })
        }
      } catch { if (alive) setCamError(true) }
    })()
    return () => { alive = false; streamRef.current?.getTracks().forEach(t => t.stop()); if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  // ── Canvas animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let running = true

    function drawFrame() {
      if (!running) return
      const v = videoRef.current
      if (!v || !canvas) { animRef.current = requestAnimationFrame(drawFrame); return }
      const W = canvas.width  = v.offsetWidth  || canvas.offsetWidth
      const H = canvas.height = v.offsetHeight || canvas.offsetHeight
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, W, H)

      linesRef.current = linesRef.current.map(line => ({
        ...line,
        progress: Math.min(1, line.progress + 0.025),
      }))

      for (const line of linesRef.current) {
        const x1 = line.x1 * W, y1 = line.y1 * H
        const x2 = line.x2 * W, y2 = line.y2 * H
        const prog = line.progress

        ctx.save()
        ctx.globalAlpha = Math.min(1, prog * 2)
        ctx.strokeStyle = line.color
        ctx.shadowColor = line.color
        ctx.shadowBlur  = 12
        ctx.lineWidth   = 2.5
        ctx.setLineDash([])

        // Draw the line up to current progress
        const cx = x1 + (x2 - x1) * prog
        const cy = y1 + (y2 - y1) * prog

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(cx, cy)
        ctx.stroke()

        // Endpoint dots
        const dotR = 5
        ;[[x1, y1], [cx, cy]].forEach(([px, py], i) => {
          if (i === 1 && prog < 0.05) return
          ctx.beginPath()
          ctx.arc(px, py, dotR + Math.sin(Date.now() / 400) * (i === 1 ? 2 : 0), 0, Math.PI * 2)
          ctx.fillStyle = line.color
          ctx.shadowBlur = 18
          ctx.fill()
          ctx.beginPath()
          ctx.arc(px, py, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.globalAlpha = 0.9
          ctx.fill()
          ctx.globalAlpha = Math.min(1, prog * 2)
        })

        // Label at midpoint (only when near done)
        if (prog > 0.85) {
          const midX = (x1 + x2) / 2
          const midY = (y1 + y2) / 2
          const offsetX = line.type === 'vertical' ? 18 : 0
          const offsetY = line.type === 'horizontal' ? -14 : 0
          ctx.shadowBlur = 0
          ctx.globalAlpha = (prog - 0.85) / 0.15
          ctx.fillStyle = '#0A1C2E'
          const tag = `${line.valueMm}mm`
          const tw = ctx.measureText(tag).width
          ctx.fillRect(midX + offsetX - tw/2 - 6, midY + offsetY - 10, tw + 12, 20)
          ctx.fillStyle = line.color
          ctx.font = '700 11px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(tag, midX + offsetX, midY + offsetY + 4)
        }

        ctx.restore()
      }

      animRef.current = requestAnimationFrame(drawFrame)
    }

    animRef.current = requestAnimationFrame(drawFrame)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [])

  // ── Add measurement line to canvas ──────────────────────────────────────────
  function showMeasurementLine(def: MeasDef, mm: number) {
    if (def.lineType === 'none') return

    let line: AnimLine
    const cx = 0.5  // horizontal centre

    if (def.id === 'rise') {
      // Vertical line on riser face — centre of frame, spanning one riser height
      // Camera is face-on to the riser, so depth = top-to-bottom in frame
      line = { type: 'vertical', color: def.color, label: def.label, valueMm: mm, progress: 0,
               x1: cx, y1: 0.65, x2: cx, y2: 0.35 }

    } else if (def.id === 'run') {
      // TREAD DEPTH — camera points DOWN at treads from waist height.
      // In this top-down view, tread DEPTH runs front-to-back = TOP to BOTTOM in frame.
      // The line runs vertically in the frame: from the near nosing edge to the far riser.
      // Positioned at ~40% from left so it sits clearly on one tread band.
      line = { type: 'vertical', color: def.color, label: def.label, valueMm: mm, progress: 0,
               x1: 0.40, y1: 0.35, x2: 0.40, y2: 0.65 }

    } else if (def.id === 'width') {
      // STAIR WIDTH — camera is now face-on again, width = left-to-right in frame.
      // Wide horizontal line between the two stringer/wall edges at tread level.
      line = { type: 'horizontal', color: def.color, label: def.label, valueMm: mm, progress: 0,
               x1: 0.06, y1: 0.58, x2: 0.94, y2: 0.58 }

    } else if (def.id === 'guard') {
      // Handrail height — vertical line from tread surface up to top of rail
      line = { type: 'vertical', color: def.color, label: def.label, valueMm: mm, progress: 0,
               x1: cx, y1: 0.78, x2: cx, y2: 0.18 }

    } else if (def.id === 'nosing') {
      // Short horizontal tick at the front lip of the tread
      line = { type: 'tick', color: def.color, label: def.label, valueMm: mm, progress: 0,
               x1: 0.35, y1: 0.50, x2: 0.50, y2: 0.50 }

    } else {
      return
    }

    linesRef.current = [line]  // show one line at a time
    Analytics.measurementLocked(def.id, mm, 0.88)
    // Reset stuck state for next step
    stuckShownRef.current = false
    setShowStuck(false)
  }

  function clearLines() { linesRef.current = [] }

  // ── Messaging ────────────────────────────────────────────────────────────────
  function addMsg(text: string, phase: CoachResponse['phase']) {
    if (!text) return
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length-1].text === text) return prev
      return [...prev.slice(-4), { id: ++msgCounter, text, phase }]
    })
    historyRef.current.push(text)
  }

  // ── Capture helpers ──────────────────────────────────────────────────────────
  const captureRef = useRef<HTMLCanvasElement>(null)
  function captureB64(scale = 0.65): string | null {
    const v = videoRef.current, c = captureRef.current
    if (!v || !c || v.readyState < 2) return null
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.80).split(',')[1]
  }

  // ── Intro image fade — starts when camera is ready ─────────────────────────
  useEffect(() => {
    if (!camReady) return
    // Begin fade after 2s hold — user reads the positioning image
    const holdTimer = setTimeout(() => {
      // Fade over 1.4s
      const start = Date.now()
      const FADE  = 1400
      const tick  = () => {
        const elapsed = Date.now() - start
        const opacity = Math.max(0, 1 - elapsed / FADE)
        setIntroOpacity(opacity)
        if (opacity > 0) { requestAnimationFrame(tick) }
        else {
          setIntroGone(true)
          // Text fades out 2.5 seconds after image gone
          setTimeout(() => setTextGone(true), 2500)
          // AI starts — first task is to count the steps
          historyRef.current = []
          // Show intro to user but don't pollute AI history with it
          setMessages([{ id: 0, text: getProfile(userRole).copy.scanIntro, phase: 'searching' as const }])
          // Run step count immediately as the very first AI call
          countStepsFirst()
          scheduleAnalysis(800)
        }
      }
      requestAnimationFrame(tick)
    }, 2000)
    return () => clearTimeout(holdTimer)
  }, [camReady]) // eslint-disable-line

  // ── Count steps — very first AI call, fires as intro fades ─────────────────
  async function countStepsFirst() {
    if (stepCountAttemptedRef.current) return
    stepCountAttemptedRef.current = true

    // Wait a moment for the camera to stabilise post-intro
    await new Promise(r => setTimeout(r, 1200))

    const b64 = captureB64(0.5)
    if (!b64) {
      setShowConditionsWarning(true)
      return
    }

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageB64: b64,
          prompt: `You are analysing a staircase image to count the number of steps visible.

Look at this image carefully.

1. Count the number of individual steps (treads) you can see.
2. If you can see a partial staircase, estimate the total based on what's visible.
3. Only attempt counting if: the staircase is straight (not spiral), residential-scale, and clearly visible.

Respond ONLY with valid JSON, no other text:
{"stepCount": <number or null>, "confident": <true or false>, "reason": "<brief reason if null>"}

If you cannot confidently count steps because: spiral stair, industrial, no staircase visible, very poor lighting, or image unclear — set stepCount to null and explain in reason.`
        }),
      })

      if (!res.ok) { setShowConditionsWarning(true); return }
      const data = await res.json()

      // Try parsing the JSON from Claude's response
      try {
        const raw = data.text ?? ''
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) { setShowConditionsWarning(true); return }
        const parsed = JSON.parse(match[0])

        if (parsed.stepCount && parsed.stepCount > 0 && parsed.confident) {
          setStepCount(parsed.stepCount)
          setShowStepCount(true)
          // Auto-hide step count after 4 seconds
          setTimeout(() => setShowStepCount(false), 4000)
        } else {
          // Couldn't count — show conditions warning
          setShowConditionsWarning(true)
        }
      } catch {
        setShowConditionsWarning(true)
      }
    } catch {
      // Network error
      setShowConditionsWarning(true)
    }
  }

  // ── Stuck detection — show hint image if no lock after 25s ───────────────
  useEffect(() => {
    if (!introGone || showReview) return
    if (stuckShownRef.current) return
    // Reset timer each time stepIdx changes
    if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current)
    stuckTimerRef.current = setTimeout(() => {
      if (!lockedMm && !showReview) {
        setShowStuck(true)
        stuckShownRef.current = true
        Analytics.stuckHintShown(primarySteps[stepIdxRef.current]?.label ?? 'unknown')
        // Auto-dismiss after 4s
        setTimeout(() => setShowStuck(false), 4000)
      }
    }, isSpeed ? 10000 : 25000)
    return () => { if (stuckTimerRef.current) clearTimeout(stuckTimerRef.current) }
  }, [stepIdx, introGone, lockedMm, showReview])

  // ── Start coaching ────────────────────────────────────────────────────────
  // (coaching now triggered by intro fade completion above — this effect
  //  handles step changes only)

  useEffect(() => {
    stepIdxRef.current = stepIdx
    if (!camReady || showReview) return
    historyRef.current = []
    busyRef.current = false
    clearLines()
    setApiError(null)
    setGuardAttempts(0)
    setShowGuardHelp(false)
    scheduleAnalysis(isSpeed ? 1200 : 2000)

    // Speed mode: auto-fill with typical value after 8s
    if (isSpeed) {
      if (speedAutoFillRef.current) clearTimeout(speedAutoFillRef.current)
      speedAutoFillRef.current = setTimeout(() => {
        // If still no lock on this step, use the typical value and move on
        const cur = primarySteps[stepIdxRef.current]
        if (!cur || lockedMm !== null) return
        const autoVal = cur.typical
        showMeasurementLine(cur, autoVal)
        setLockedMm(autoVal)
        Analytics.measurementLocked(`${cur.id}_autofill`, autoVal, 0.3)
      }, 8000)
    }
  }, [stepIdx]) // eslint-disable-line

  // Speed mode uses faster intervals and lower thresholds
  const isSpeed = scanMode === 'speed'

  function scheduleAnalysis(ms = 3000) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => analysisRef2.current(), ms)
  }

  // Keep analysisRef2 pointing at the latest closure so scheduleAnalysis never goes stale
  useEffect(() => {
    analysisRef2.current = async () => {
      const currentStep = primarySteps[stepIdxRef.current]
      if (busyRef.current || !currentStep) return
      if (!introGone) return  // wait for intro overlay to clear

      const b64 = captureB64()
      if (!b64) { scheduleAnalysis(); return }

      busyRef.current = true
      setThinking(true)
      setApiError(null)

      const recent = historyRef.current.slice(-3).join('\n')
      const prompt = buildPrompt(currentStep, recent)
      const raw = await callVision(b64, prompt)

      setThinking(false)
      busyRef.current = false

      if (!raw) {
        // Silent retry — network blip or timeout, don't alarm the user
        scheduleAnalysis(isSpeed ? 2000 : 5000)
        return
      }

      const r: CoachResponse | null = parseJSON(raw)
      if (!r) {
        // Bad JSON — retry silently
        scheduleAnalysis(isSpeed ? 1500 : 4000)
        return
      }

      setApiError(null)
      addMsg(r.message, r.phase)

      // Handrail gets a lower confidence threshold — it's harder to frame perfectly
      // Speed mode: lower threshold — accept reasonable guesses
      const lockThreshold = isSpeed
        ? (currentStep.id === 'guard' ? 0.45 : 0.50)
        : (currentStep.id === 'guard' ? 0.55 : 0.62)
      if (r.phase === 'locked' && r.estimatedMm !== null && r.confidence >= lockThreshold) {
        const mm = clamp(r.estimatedMm, currentStep.rangeMin, currentStep.rangeMax)
        showMeasurementLine(currentStep, mm)
        setLockedMm(mm)
        // Clear handrail fallback if it was showing
        if (currentStep.id === 'guard') {
          setShowHandrailFallback(false)
          if (handrailTimerRef.current) clearTimeout(handrailTimerRef.current)
        }
        // Clear speed auto-fill timer on any successful lock
        if (speedAutoFillRef.current) clearTimeout(speedAutoFillRef.current)
        if (r.secondaryMm) setPendingSec(clamp(r.secondaryMm, 600, 2000))
        runSilentChecks(b64)
      } else {
        scheduleAnalysis(isSpeed ? (r.phase === 'searching' ? 1800 : 1500) : (r.phase === 'searching' ? 3500 : 2800))
      }
    }
  })  // runs every render — always captures latest state

  async function runSilentChecks(b64: string) {
    // Run nosing + headroom checks from the current frame, silently
    for (const silentDef of MEASUREMENTS.filter(m => m.silent)) {
      const prompt = buildSilentPrompt(silentDef)
      const raw = await callVision(b64, prompt)
      if (!raw) continue
      const r = parseJSON(raw)
      if (!r) continue
      if (silentDef.id === 'nosing') {
        // POLICY: always default to 'none' — AI consistently over-reports nosing
        // from shadows and image artefacts. User can override on the review screen.
        setResults(prev => ({ ...prev, nosing: 'none' }))
        // Only show "detected" overlay if AI is very confident AND estimated > 30mm
        // (near-impossible to false-positive at that magnitude)
        const hasConfidentNosing = !r.noNosing && r.estimatedMm && r.estimatedMm > 30 && r.confidence > 0.85
        if (!hasConfidentNosing) {
          setShowNoNosing(true)
          Analytics.nosingNotDetected()
          setTimeout(() => setShowNoNosing(false), 5000)
        }
      } else if (silentDef.id === 'headroom') {
        setResults(prev => ({ ...prev, headroom: r.openAbove ? 'clear' : (r.estimatedMm ?? 2200) }))
      }
    }
  }

  // ── Role-specific coaching persona (from profile system) ───────────────────
  function getRolePersona(): string {
    return getProfile(userRole).aiPersona
  }

  function buildSpeedPrefix(): string {
    return 'SPEED MODE ACTIVE: You must return phase "locked" on this single frame — do NOT return "searching". Commit to your best estimate even if conditions are imperfect. Confidence of 0.50 or above is acceptable. If truly nothing visible, use the residential typical: rise=175mm, tread=250mm, width=900mm, guard=915mm at confidence=0.50.\n\n'
  }

  function buildPrompt(def: MeasDef, recentHistory: string): string {
    const speedNote = isSpeed ? buildSpeedPrefix() : ''
    return `You are an AI measuring a staircase from a phone camera image.

${speedNote}
${def.aiContext}

RULES:
- Be AGGRESSIVE about locking — if stairs are clearly visible, lock immediately
- Do NOT return "searching" more than twice — attempt a measurement even if imperfect
- Keep message SHORT — 1 sentence max
- Do NOT repeat what you said before: ${recentHistory ? recentHistory.slice(-1)[0] || 'nothing' : 'nothing'}

Return ONLY valid JSON, no other text:
{
  "phase": "searching" | "guiding" | "measuring" | "locked",
  "message": "one short sentence",
  "estimatedMm": null or number,
  "secondaryMm": null or number,
  "confidence": 0.0 to 1.0${def.id === "nosing" ? ",\n  \"noNosing\": true or false" : ""}${def.id === "headroom" ? ",\n  \"openAbove\": true or false" : ""}
}`
  }

  function buildSilentPrompt(def: MeasDef): string {
    return `${def.aiContext}
Analyse the image carefully. Return ONLY this JSON:
{
  "estimatedMm": number or null,
  "confidence": 0.0 to 1.0${def.id === 'nosing' ? ',\n  "noNosing": true or false' : ''}${def.id === 'headroom' ? ',\n  "openAbove": true or false' : ''}
}
Do not include any other text.`
  }

  // ── Confirm measurement ──────────────────────────────────────────────────────
  // Used by the handrail manual entry — bypasses AI lock
  function confirmMeasurementWith(mm: number) {
    const step = primarySteps[stepIdxRef.current]
    if (!step) return
    const newResults: Record<string, number | string> = {
      ...results,
      [step.id]: mm,
    }
    setResults(newResults)
    setLockedMm(null); clearLines()

    let next = stepIdx + 1
    if (next < primarySteps.length && primarySteps[next].id === 'width' && newResults.width) next++

    if (next >= primarySteps.length) {
      const reviewDefaults = { ...newResults, nosing: newResults.nosing ?? 'none' }
      const aiNosing = newResults.nosing
      if (typeof aiNosing === 'number' && aiNosing <= 30) reviewDefaults.nosing = 'none'
      setReviewVals(reviewDefaults)
      setShowReview(true)
    } else {
      const nextDef = primarySteps[next]
      const transition = getTransition(step.id, nextDef.id, mm)
      setStepIdx(next)
      addMsg(transition, 'guiding')
    }
  }

  function confirmMeasurement() {
    if (lockedMm === null || !step) return
    const newResults: Record<string, number | string> = {
      ...results,
      [step.id]: lockedMm,
      ...(step.id === 'run' && pendingSec ? { width: pendingSec } : {}),
    }
    setResults(newResults)
    setLockedMm(null); setPendingSec(null); clearLines()

    // Find next non-silent step, skipping width if already captured
    let next = stepIdx + 1
    if (next < primarySteps.length && primarySteps[next].id === 'width' && newResults.width) next++

    if (next >= primarySteps.length) {
      // All primary measurements done — show review
      // Always default nosing to 'none' — user can change on review screen
      const reviewDefaults = { ...newResults, nosing: newResults.nosing ?? 'none' }
      // If AI reported a nosing value, still override to 'none' unless very large
      const aiNosing = newResults.nosing
      if (typeof aiNosing === 'number' && aiNosing <= 30) {
        reviewDefaults.nosing = 'none'
      }
      setReviewVals(reviewDefaults)
      setShowReview(true)
    } else {
      const nextDef = primarySteps[next]
      const transition = getTransition(step.id, nextDef.id, lockedMm)
      setStepIdx(next)
      addMsg(transition, 'guiding')

    // Start handrail fallback timer when entering guard step
    if (nextDef.id === 'guard') {
      if (handrailTimerRef.current) clearTimeout(handrailTimerRef.current)
      setShowHandrailFallback(false)
      handrailTimerRef.current = setTimeout(() => {
        // Only show fallback if still on guard and not locked
        setShowHandrailFallback(prev => true)
      }, 8000)
    }
    }
  }

  function getTransition(from: MeasId, to: MeasId, mm: number): string {
    const map: Partial<Record<string, string>> = {
      'rise→run':   `${mm}mm riser — nice. Now point straight down at the treads from waist height for the tread depth.`,
      'rise→width': `Got the riser at ${mm}mm. Step back now so I can see both sides of the staircase for the width.`,
      'rise→guard': `Riser at ${mm}mm. Now face the handrail — I need to see from the tread up to the top of the rail.`,
      'run→width':  `Tread depth: ${mm}mm. Now step back so both stair edges are in frame.`,
      'run→guard':  `${mm}mm tread. Last one — angle the phone at the handrail so I can see from the tread up to the top of the rail.`,
      'width→guard':`${mm}mm wide. Last step — point at the handrail from any side angle. I\'ll estimate the height from what I can see.`,
    }
    const key = `${from}→${to}`
    return map[key] ?? `${mm}mm — got it. Now let's get the ${MEASUREMENTS.find(m=>m.id===to)?.label.toLowerCase()}.`
  }

  function adjustValue(key: string, delta: number) {
    setReviewVals(prev => {
      const cur = prev[key]
      if (typeof cur !== 'number') return prev
      const def = MEASUREMENTS.find(m => m.id === key)
      const val = def ? clamp(cur + delta, def.rangeMin, def.rangeMax) : cur + delta
      return { ...prev, [key]: val }
    })
  }

  function finishReview() {
    onSuccess(reviewVals)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const latestMsg = messages[messages.length - 1]
  const phaseColor = latestMsg?.phase === 'locked' ? GREEN
    : latestMsg?.phase === 'measuring' ? BLUE
    : latestMsg?.phase === 'guiding' ? AMBER
    : 'rgba(255,255,255,0.4)'

  const confirmedCount = Object.keys(results).filter(k => !['nosing','headroom'].includes(k)).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes blink  { 0%,100%{opacity:.2} 50%{opacity:1} }
        @keyframes popIn  { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.12);opacity:1} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>

      {/* Camera error */}
      {camError && (
        <div style={{ position:'absolute', inset:0, zIndex:90, background:NAVY, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'2rem' }}>
          <span style={{fontSize:'2.5rem'}}>📷</span>
          <p style={{color:WHITE, textAlign:'center', lineHeight:1.6, maxWidth:280}}>Camera access is required to scan stairs.</p>
          <button onClick={onBack} style={{padding:'0.85rem 2rem', background:BLUE, border:'none', borderRadius:14, color:'#fff', fontSize:'0.9rem', cursor:'pointer'}}>← Go Back</button>
        </div>
      )}

      {/* Live camera feed */}
      <video ref={videoRef} autoPlay playsInline muted style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity: lockedMm !== null ? 0.55 : 1, transition:'opacity 0.4s' }} />

      {/* Measurement line canvas overlay */}
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:15 }} />

      {/* Hidden capture canvas */}
      <canvas ref={captureRef} style={{ display:'none' }} />

      {/* Safety stripe */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:4, zIndex:50, background:'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 4px,rgba(0,0,0,0.6) 4px,rgba(0,0,0,0.6) 10px)', backgroundSize:'16px 16px' }} />

      {/* ── TOP BAR ── */}
      {!showReview && (
        <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:40, paddingTop:'max(env(safe-area-inset-top,0px),2.5rem)', paddingBottom:'0.7rem', paddingLeft:'1rem', paddingRight:'1rem', background:'linear-gradient(to bottom,rgba(0,0,0,0.72),transparent)', display:'flex', alignItems:'center', gap:'0.7rem' }}>
          <button onClick={() => { streamRef.current?.getTracks().forEach(t=>t.stop()); onBack() }} style={{ width:40, height:40, borderRadius:'50%', background:'rgba(0,0,0,0.45)', border:'1px solid rgba(147,186,212,0.25)', color:'#fff', fontSize:'1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', flexShrink:0 }}>←</button>

          {/* Step progress pills */}
          <div style={{ flex:1, display:'flex', justifyContent:'center', gap:'0.4rem', alignItems:'center' }}>
            {primarySteps.map((s, i) => {
              const done    = results[s.id] !== undefined
              const active  = i === stepIdx && !showReview
              return (
                <div key={s.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.2rem' }}>
                  <div style={{ height:3, borderRadius:3, width: active ? 26 : done ? 10 : 6, background: done ? GREEN : active ? phaseColor : 'rgba(255,255,255,0.18)', transition:'all 0.35s', boxShadow: active ? `0 0 6px ${phaseColor}` : 'none' }} />
                  {active && <div style={{ fontSize:'0.48rem', fontFamily:'monospace', color:phaseColor, letterSpacing:'0.08em', textTransform:'uppercase', lineHeight:1 }}>{s.label}</div>}
                </div>
              )
            })}
          </div>

          {/* AR/AI badge */}
          <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', background: arSupported ? 'rgba(65,124,164,0.15)' : 'rgba(242,147,55,0.15)', border:`1px solid ${arSupported ? 'rgba(65,124,164,0.4)' : 'rgba(242,147,55,0.4)'}`, borderRadius:14, padding:'0.2rem 0.6rem', flexShrink:0 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background: arSupported ? BLUE : AMBER, boxShadow:`0 0 5px ${arSupported ? BLUE : AMBER}` }}/>
            <span style={{ fontSize:'0.52rem', fontFamily:'monospace', letterSpacing:'0.1em', color: arSupported ? BLUE : AMBER, fontWeight:700 }}>{arSupported ? 'AR' : 'AI'}</span>
          </div>
        </div>
      )}

      {/* ── INTRO POSITIONING OVERLAY ── */}
      {!introGone && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'flex-start',
          pointerEvents: introOpacity < 0.05 ? 'none' : 'auto',
          opacity: introOpacity,
          transition: 'none',
        }}>
          {/* Text block at TOP — above the image, fully readable */}
          <div style={{
            position: 'relative', zIndex: 2,
            width: '100%',
            padding: 'max(env(safe-area-inset-top,0px),2.5rem) 1.5rem 1.25rem',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.0) 100%)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize:'1.25rem', fontWeight:900, color:'#fff', lineHeight:1.3, marginBottom:'0.5rem', letterSpacing:'-0.01em' }}>
              Stand in front of your staircase
            </div>
            <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.85)', lineHeight:1.65 }}>
              Hold your phone upright, pointing at the steps.
            </div>
            <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.85)', lineHeight:1.65 }}>
              Step back so 2–3 steps are visible in frame.
            </div>
          </div>

          {/* Girl measuring illustration — fills the rest of the screen */}
          <img
            src="/Girl_measuring.png"
            alt="Position yourself in front of the staircase"
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center bottom',
              opacity: 0.88,
              zIndex: 0,
            }}
          />
        </div>
      )}

      {/* ── TEXT FADE AFTER IMAGE — lingers 2-3s then fades ── */}
      {introGone && !textGone && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 58,
          padding: 'max(env(safe-area-inset-top,0px),2.5rem) 1.5rem 1.25rem',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease forwards',
          transition: 'opacity 1s ease',
          opacity: textGone ? 0 : 1,
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize:'1.1rem', fontWeight:800, color:'#fff', lineHeight:1.3, marginBottom:'0.3rem' }}>
            Stand in front of your staircase
          </div>
          <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.75)', lineHeight:1.6 }}>
            Step back so 2–3 steps are in frame
          </div>
        </div>
      )}

      {/* ── STEP COUNT BANNER — first thing AI delivers ── */}
      {showStepCount && stepCount !== null && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 65,
          background: 'rgba(10,28,46,0.95)',
          border: '2px solid #27A96B',
          borderRadius: 20,
          padding: '1.5rem 2rem',
          textAlign: 'center',
          animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(39,169,107,0.3)',
          minWidth: 220,
        }}>
          <div style={{ fontSize:'0.65rem', fontFamily:'monospace', color:'#27A96B', letterSpacing:'0.16em', marginBottom:'0.5rem', fontWeight:700 }}>
            ✓ STAIRCASE DETECTED
          </div>
          <div style={{ fontSize:'3.5rem', fontWeight:900, color:'#E8F4FF', lineHeight:1, marginBottom:'0.3rem' }}>
            {stepCount}
          </div>
          <div style={{ fontSize:'0.85rem', color:'#93BAD4', fontWeight:600 }}>
            {stepCount === 1 ? 'step detected' : 'steps detected'}
          </div>
          <div style={{ fontSize:'0.68rem', color:'#4E7A9B', marginTop:'0.6rem', lineHeight:1.5 }}>
            Starting measurement scan…
          </div>
        </div>
      )}

      {/* ── HANDRAIL MANUAL FALLBACK — shown after 15s if guard not locked ── */}
      {showHandrailFallback && !lockedMm && !showReview && primarySteps[stepIdx]?.id === 'guard' && (
        <>
          {/* Semi-transparent backdrop */}
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.60)', zIndex:67, pointerEvents:'none' }} />

          <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:68 }}>
            <div style={{ background:'#0A1C2E', borderRadius:'22px 22px 0 0', padding:'1.1rem 1.25rem 2rem', boxShadow:'0 -8px 40px rgba(0,0,0,0.7)' }}>

              {/* Handle */}
              <div style={{ width:36, height:4, borderRadius:2, background:'rgba(147,186,212,0.25)', margin:'0 auto 1rem' }} />

              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.75rem' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(250,116,31,0.15)', border:'1.5px solid rgba(250,116,31,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>📏</div>
                <div>
                  <div style={{ fontSize:'0.92rem', fontWeight:900, color:'#E8F4FF', letterSpacing:'-0.01em' }}>Handrail is tricky — here's how</div>
                  <div style={{ fontSize:'0.62rem', color:'#FA741F', fontFamily:'monospace', fontWeight:700 }}>Or enter it manually below</div>
                </div>
              </div>

              {/* Visual diagram — SVG showing correct phone position */}
              <div style={{ background:'rgba(65,124,164,0.08)', border:'1px solid rgba(65,124,164,0.20)', borderRadius:14, padding:'0.75rem', marginBottom:'0.85rem' }}>
                <svg viewBox="0 0 320 130" width="100%" style={{ display:'block' }}>
                  {/* Stair steps */}
                  <rect x="120" y="80" width="50" height="40" fill="#1A3A5C" stroke="#417CA4" strokeWidth="1"/>
                  <rect x="150" y="60" width="50" height="60" fill="#1A3A5C" stroke="#417CA4" strokeWidth="1"/>
                  <rect x="180" y="40" width="50" height="80" fill="#1A3A5C" stroke="#417CA4" strokeWidth="1"/>
                  <rect x="210" y="20" width="50" height="100" fill="#1A3A5C" stroke="#417CA4" strokeWidth="1"/>

                  {/* Handrail */}
                  <line x1="148" y1="50" x2="248" y2="10" stroke="#FA741F" strokeWidth="4" strokeLinecap="round"/>
                  {/* Rail posts */}
                  <line x1="160" y1="60" x2="155" y2="48" stroke="#FA741F" strokeWidth="2"/>
                  <line x1="190" y1="40" x2="185" y2="28" stroke="#FA741F" strokeWidth="2"/>
                  <line x1="220" y1="20" x2="215" y2="9" stroke="#FA741F" strokeWidth="2"/>

                  {/* Height measurement arrow */}
                  <line x1="110" y1="80" x2="110" y2="50" stroke="#27A96B" strokeWidth="2"/>
                  <polygon points="110,46 107,54 113,54" fill="#27A96B"/>
                  <polygon points="110,84 107,76 113,76" fill="#27A96B"/>
                  <text x="86" y="68" fill="#27A96B" fontSize="9" fontFamily="monospace">900mm</text>

                  {/* Person standing beside stair */}
                  {/* Body */}
                  <ellipse cx="60" cy="30" rx="10" ry="10" fill="#93BAD4"/>
                  <rect x="54" y="40" width="12" height="35" rx="4" fill="#93BAD4"/>
                  {/* Arms — one holding phone */}
                  <line x1="66" y1="50" x2="90" y2="58" stroke="#93BAD4" strokeWidth="4" strokeLinecap="round"/>
                  {/* Legs */}
                  <line x1="57" y1="75" x2="52" y2="100" stroke="#93BAD4" strokeWidth="4" strokeLinecap="round"/>
                  <line x1="67" y1="75" x2="72" y2="100" stroke="#93BAD4" strokeWidth="4" strokeLinecap="round"/>
                  {/* Phone */}
                  <rect x="88" y="52" width="14" height="22" rx="3" fill="#E8F4FF" stroke="#417CA4" strokeWidth="1.5"/>
                  <rect x="90" y="54" width="10" height="14" rx="1" fill="#0A1C2E"/>

                  {/* Arrow from phone to rail */}
                  <line x1="102" y1="60" x2="142" y2="55" stroke="#FA741F" strokeWidth="1.5" strokeDasharray="4,3"/>
                  <polygon points="145,55 138,51 138,59" fill="#FA741F"/>

                  {/* Labels */}
                  <text x="28" y="115" fill="#E8F4FF" fontSize="9" fontFamily="sans-serif">Stand BESIDE</text>
                  <text x="28" y="126" fill="#93BAD4" fontSize="8" fontFamily="sans-serif">not on stair</text>
                  <text x="148" y="120" fill="#FA741F" fontSize="9" fontFamily="sans-serif">Frame full rail</text>
                  <text x="148" y="130" fill="#93BAD4" fontSize="8" fontFamily="sans-serif">tread → top</text>
                </svg>
              </div>

              {/* 3 quick tips */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.4rem', marginBottom:'0.85rem' }}>
                {[
                  { icon:'🧍', tip:'Stand BESIDE the stair' },
                  { icon:'📱', tip:'Hold phone upright' },
                  { icon:'↕️', tip:'Show tread to rail top' },
                ].map((item, i) => (
                  <div key={i} style={{ background:'rgba(65,124,164,0.10)', border:'1px solid rgba(65,124,164,0.2)', borderRadius:10, padding:'0.5rem', textAlign:'center' }}>
                    <div style={{ fontSize:'1.2rem', marginBottom:'0.25rem' }}>{item.icon}</div>
                    <div style={{ fontSize:'0.6rem', color:'#93BAD4', lineHeight:1.4 }}>{item.tip}</div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.85rem' }}>
                <div style={{ flex:1, height:1, background:'rgba(147,186,212,0.15)' }} />
                <span style={{ fontSize:'0.62rem', color:'#4E7A9B', fontFamily:'monospace' }}>OR ENTER MANUALLY</span>
                <div style={{ flex:1, height:1, background:'rgba(147,186,212,0.15)' }} />
              </div>

              {/* Manual mm adjuster */}
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.7rem' }}>
                <button onClick={() => setManualHandrail(v => Math.max(700, v - 5))} style={{ width:44, height:44, borderRadius:'50%', background:'rgba(147,186,212,0.15)', border:'1px solid rgba(147,186,212,0.3)', color:'#E8F4FF', fontSize:'1.4rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>−</button>
                <div style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:'2.8rem', fontWeight:900, color:'#E8F4FF', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{manualHandrail}</div>
                  <div style={{ fontSize:'0.68rem', color:'#93BAD4', fontFamily:'monospace' }}>mm</div>
                  <div style={{ fontSize:'0.58rem', color:'#4E7A9B', marginTop:'0.15rem' }}>OBC min 900mm · typical 900–965mm</div>
                </div>
                <button onClick={() => setManualHandrail(v => Math.min(1200, v + 5))} style={{ width:44, height:44, borderRadius:'50%', background:'rgba(147,186,212,0.15)', border:'1px solid rgba(147,186,212,0.3)', color:'#E8F4FF', fontSize:'1.4rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+</button>
              </div>

              {/* Quick-select */}
              <div style={{ display:'flex', gap:'0.35rem', marginBottom:'0.85rem' }}>
                {[865, 900, 915, 950, 965, 1000].map(h => (
                  <button key={h} onClick={() => setManualHandrail(h)} style={{
                    flex:1, padding:'0.4rem 0.1rem',
                    background: manualHandrail === h ? 'rgba(250,116,31,0.25)' : 'rgba(147,186,212,0.07)',
                    border: `1px solid ${manualHandrail === h ? '#FA741F' : 'rgba(147,186,212,0.18)'}`,
                    borderRadius:7, color: manualHandrail === h ? '#FA741F' : '#93BAD4',
                    fontSize:'0.6rem', fontFamily:'monospace', fontWeight:700, cursor:'pointer',
                  }}>{h}</button>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button
                  onClick={() => { setShowHandrailFallback(false) }}
                  style={{ flex:1, padding:'0.8rem', background:'rgba(65,124,164,0.15)', border:'1px solid rgba(65,124,164,0.3)', borderRadius:12, color:'#93BAD4', fontSize:'0.75rem', fontFamily:'monospace', cursor:'pointer', fontWeight:600 }}
                >↺ Try again</button>
                <button
                  onClick={() => {
                    const step = primarySteps[stepIdx]
                    showMeasurementLine(step, manualHandrail)
                    setLockedMm(manualHandrail)
                    setShowHandrailFallback(false)
                    if (handrailTimerRef.current) clearTimeout(handrailTimerRef.current)
                    Analytics.measurementLocked('guard_manual', manualHandrail, 1.0)
                  }}
                  style={{ flex:2, padding:'0.8rem', background:'linear-gradient(135deg,#FA741F,#C4721E)', border:'none', borderRadius:12, color:'#fff', fontSize:'0.88rem', fontFamily:'monospace', cursor:'pointer', fontWeight:800, letterSpacing:'0.05em', boxShadow:'0 4px 16px rgba(250,116,31,0.4)' }}
                >✓ Use {manualHandrail}mm →</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── HANDRAIL HELP PANEL — appears after 3 failed attempts ── */}
      {showGuardHelp && !showReview && primarySteps[stepIdx]?.id === 'guard' && (
        <>
          <div
            onClick={() => setShowGuardHelp(false)}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.72)', zIndex:70 }}
          />
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, zIndex:71,
            background:'#0F2438',
            borderRadius:'22px 22px 0 0',
            padding:'1.25rem 1.25rem 2.5rem',
            boxShadow:'0 -8px 40px rgba(0,0,0,0.6)',
          }}>
            {/* Handle */}
            <div style={{ width:36, height:4, borderRadius:2, background:'rgba(147,186,212,0.25)', margin:'0 auto 1rem' }} />

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.65rem', marginBottom:'1rem' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'rgba(242,147,55,0.15)', border:'1.5px solid rgba(242,147,55,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', flexShrink:0 }}>📏</div>
              <div>
                <div style={{ fontSize:'0.95rem', fontWeight:900, color:'#E8F4FF' }}>Handrail tips</div>
                <div style={{ fontSize:'0.68rem', color:'#F29337', fontFamily:'monospace', fontWeight:700 }}>3 ways to capture it</div>
              </div>
            </div>

            {/* Visual diagram — 3 positions */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem', marginBottom:'1rem' }}>
              {[
                { emoji:'↕️', title:'Side-on', desc:'Stand beside the stair. Point phone at the side of the railing. Tread at bottom, top of rail at top.' },
                { emoji:'📱', title:'Face-on', desc:'Face the rail from the front. Full handrail visible, phone upright.' },
                { emoji:'🔢', title:'Count it', desc:'Count the number of risers the rail rises over. Multiply by riser height.' },
              ].map((tip, i) => (
                <div key={i} style={{ background:'rgba(65,124,164,0.12)', border:'1px solid rgba(65,124,164,0.2)', borderRadius:12, padding:'0.65rem 0.5rem', textAlign:'center' }}>
                  <div style={{ fontSize:'1.4rem', marginBottom:'0.25rem' }}>{tip.emoji}</div>
                  <div style={{ fontSize:'0.68rem', fontWeight:700, color:'#E8F4FF', marginBottom:'0.2rem' }}>{tip.title}</div>
                  <div style={{ fontSize:'0.6rem', color:'#93BAD4', lineHeight:1.45 }}>{tip.desc}</div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ textAlign:'center', fontSize:'0.62rem', color:'#4E7A9B', marginBottom:'0.75rem' }}>— or enter manually —</div>

            {/* Manual entry */}
            <div style={{ background:'rgba(147,186,212,0.07)', border:'1px solid rgba(147,186,212,0.15)', borderRadius:14, padding:'0.85rem 1rem', marginBottom:'0.75rem' }}>
              <div style={{ fontSize:'0.65rem', color:'#93BAD4', fontFamily:'monospace', marginBottom:'0.5rem' }}>HANDRAIL HEIGHT (mm)</div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.7rem' }}>
                <button
                  onClick={() => setManualGuardMm(v => Math.max(700, v - 10))}
                  style={{ width:40, height:40, borderRadius:'50%', background:'rgba(147,186,212,0.15)', border:'1px solid rgba(255,255,255,0.12)', color:'#E8F4FF', fontSize:'1.2rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>−</button>
                <div style={{ flex:1, textAlign:'center' }}>
                  <span style={{ fontSize:'2.4rem', fontWeight:900, color:'#E8F4FF', fontVariantNumeric:'tabular-nums' }}>{manualGuardMm}</span>
                  <span style={{ fontSize:'0.78rem', color:'#93BAD4', marginLeft:'0.25rem', fontFamily:'monospace' }}>mm</span>
                </div>
                <button
                  onClick={() => setManualGuardMm(v => Math.min(1300, v + 10))}
                  style={{ width:40, height:40, borderRadius:'50%', background:'rgba(147,186,212,0.15)', border:'1px solid rgba(255,255,255,0.12)', color:'#E8F4FF', fontSize:'1.2rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+</button>
              </div>
              <div style={{ display:'flex', justifyContent:'center', gap:'0.5rem', marginTop:'0.5rem' }}>
                {[865, 900, 965, 1000, 1070].map(v => (
                  <button key={v} onClick={() => setManualGuardMm(v)} style={{ padding:'0.2rem 0.5rem', background: manualGuardMm === v ? 'rgba(242,147,55,0.25)' : 'rgba(255,255,255,0.05)', border:`1px solid ${manualGuardMm === v ? '#F29337' : 'rgba(255,255,255,0.1)'}`, borderRadius:8, color: manualGuardMm === v ? '#F29337' : '#4E7A9B', fontSize:'0.6rem', fontFamily:'monospace', cursor:'pointer' }}>{v}</button>
                ))}
              </div>
              <div style={{ fontSize:'0.58rem', color:'#4E7A9B', textAlign:'center', marginTop:'0.35rem' }}>Residential code: 865–1070mm · Most common: ~900mm</div>
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {/* Use the manually entered value */}
              <button
                onClick={() => {
                  setLockedMm(manualGuardMm)
                  setShowGuardHelp(false)
                  confirmMeasurementWith(manualGuardMm)
                }}
                style={{ width:'100%', padding:'0.95rem', background:'linear-gradient(135deg,#F29337,#C4721E)', border:'none', borderRadius:14, color:'#fff', fontSize:'0.88rem', fontFamily:'monospace', cursor:'pointer', fontWeight:800, letterSpacing:'0.06em', boxShadow:'0 4px 16px rgba(242,147,55,0.4)' }}
              >
                ✓ Use {manualGuardMm}mm →
              </button>
              {/* Keep trying with AI */}
              <button
                onClick={() => { setShowGuardHelp(false); setGuardAttempts(0); scheduleAnalysis(500) }}
                style={{ width:'100%', padding:'0.8rem', background:'rgba(65,124,164,0.12)', border:'1px solid rgba(65,124,164,0.3)', borderRadius:14, color:'#93BAD4', fontSize:'0.82rem', fontFamily:'monospace', cursor:'pointer', fontWeight:600 }}
              >
                ↺ Keep trying with camera
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── CONDITIONS WARNING — when AI can't count steps ── */}
      {showConditionsWarning && !showReview && (
        <>
          <div
            onClick={() => setShowConditionsWarning(false)}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.78)', zIndex:70 }}
          />
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            zIndex: 71,
            background: '#0F2438',
            borderRadius: '22px 22px 0 0',
            padding: '1.5rem 1.5rem 2.5rem',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
            animation: 'slideUp 0.35s ease forwards',
          }}>
            {/* Handle */}
            <div style={{ width:36, height:4, borderRadius:2, background:'rgba(147,186,212,0.25)', margin:'0 auto 1.25rem' }} />

            {/* Icon + heading */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem' }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'rgba(242,147,55,0.15)', border:'1.5px solid rgba(242,147,55,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', flexShrink:0 }}>
                🚧
              </div>
              <div>
                <div style={{ fontSize:'0.95rem', fontWeight:900, color:'#E8F4FF', letterSpacing:'-0.01em' }}>
                  stAIrcode is under development
                </div>
                <div style={{ fontSize:'0.68rem', color:'#F29337', fontFamily:'monospace', fontWeight:700, marginTop:'0.1rem' }}>
                  BETA — Limited conditions
                </div>
              </div>
            </div>

            {/* Message */}
            <div style={{ fontSize:'0.8rem', color:'#93BAD4', lineHeight:1.75, marginBottom:'1.25rem' }}>
              stAIrcode is designed for{' '}
              <span style={{ color:'#E8F4FF', fontWeight:600 }}>residential indoor straight stairs</span>{' '}
              under good conditions only. For the best results:
            </div>

            {/* Conditions list */}
            {[
              { icon:'✓', text:'Straight stairs only — no spiral or curved', ok:true },
              { icon:'✓', text:'Residential scale — not industrial or commercial', ok:true },
              { icon:'✓', text:'Good indoor lighting — no harsh shadows', ok:true },
              { icon:'✓', text:'Strong internet connection', ok:true },
              { icon:'✗', text:'Spiral or winder stairs — not supported', ok:false },
              { icon:'✗', text:'Outdoor, industrial, or commercial stairs', ok:false },
              { icon:'✗', text:'Poor lighting or extreme angles', ok:false },
            ].map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.35rem 0', borderBottom: i < 6 ? '1px solid rgba(65,124,164,0.10)' : 'none' }}>
                <span style={{ fontSize:'0.8rem', color: item.ok ? '#27A96B' : '#E84545', fontWeight:800, width:16, flexShrink:0 }}>{item.icon}</span>
                <span style={{ fontSize:'0.75rem', color: item.ok ? '#93BAD4' : '#4E7A9B' }}>{item.text}</span>
              </div>
            ))}

            <div style={{ marginTop:'1rem', padding:'0.75rem 1rem', background:'rgba(242,147,55,0.10)', border:'1px solid rgba(242,147,55,0.25)', borderRadius:12 }}>
              <div style={{ fontSize:'0.72rem', color:'#F29337', lineHeight:1.65 }}>
                We are working hard to improve accuracy and expand supported stair types. For beta testing, please use basic indoor residential stairs to validate the core functionality.
              </div>
            </div>

            {/* Dismiss + retry */}
            <div style={{ display:'flex', gap:'0.6rem', marginTop:'1.25rem' }}>
              <button
                onClick={() => { setShowConditionsWarning(false); stepCountAttemptedRef.current = false; countStepsFirst() }}
                style={{ flex:1, padding:'0.85rem', background:'rgba(65,124,164,0.15)', border:'1px solid rgba(65,124,164,0.3)', borderRadius:14, color:'#93BAD4', fontSize:'0.82rem', fontFamily:'monospace', cursor:'pointer', fontWeight:600 }}
              >
                ↺ Try Again
              </button>
              <button
                onClick={() => setShowConditionsWarning(false)}
                style={{ flex:2, padding:'0.85rem', background:'linear-gradient(135deg,#F29337,#C4721E)', border:'none', borderRadius:14, color:'#fff', fontSize:'0.88rem', fontFamily:'monospace', cursor:'pointer', fontWeight:800, letterSpacing:'0.06em' }}
              >
                Continue Anyway →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── STUCK HINT OVERLAY ── */}
      {showStuck && !showReview && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 55,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-end',
          animation: 'fadeInOut 4s ease forwards',
          pointerEvents: 'none',
        }}>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.05) 65%, transparent 100%)' }} />
          <img
            src="/Man_measuring_handrail.png"
            alt="Try crouching to change angle"
            style={{
              position:'absolute', bottom:0, left:'50%',
              transform:'translateX(-50%)',
              width:'100%', maxWidth:500,
              objectFit:'contain', objectPosition:'bottom',
              opacity:0.9,
            }}
          />
          <div style={{ position:'relative', zIndex:2, padding:'0 1.5rem 5rem', textAlign:'center' }}>
            <div style={{ fontSize:'1rem', fontWeight:800, color:'#fff', lineHeight:1.3, marginBottom:'0.4rem', textShadow:'0 2px 12px rgba(0,0,0,0.8)' }}>
              Try a different angle
            </div>
            <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.75)', lineHeight:1.6, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
              Crouch down and hold your phone steady.<br/>Keep the stair edge clearly visible in frame.
            </div>
          </div>
        </div>
      )}

      {/* ── NOSING NOT DETECTED OVERLAY ── */}
      {showNoNosing && !showReview && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 56,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-end',
          animation: 'fadeInOut 5s ease forwards',
          pointerEvents: 'none',
        }}>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.05) 60%, transparent 100%)' }} />
          <img
            src="/nosing_not_detected.png"
            alt="Nosing not detected"
            style={{
              position:'absolute', bottom:0, left:'50%',
              transform:'translateX(-50%)',
              width:'100%', maxWidth:500,
              objectFit:'contain', objectPosition:'bottom',
              opacity:0.95,
            }}
          />
          <div style={{ position:'relative', zIndex:2, padding:'0 1.5rem 5rem', textAlign:'center' }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:'0.5rem',
              background:'rgba(242,147,55,0.92)', backdropFilter:'blur(8px)',
              borderRadius:12, padding:'0.6rem 1.1rem', marginBottom:'0.5rem',
            }}>
              <span style={{ fontSize:'1rem' }}>⚠️</span>
              <span style={{ fontSize:'0.82rem', fontWeight:800, color:'#fff', letterSpacing:'0.06em', fontFamily:'monospace' }}>
                NOSING NOT DETECTED
              </span>
            </div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.80)', lineHeight:1.6, textShadow:'0 1px 8px rgba(0,0,0,0.8)' }}>
              No step lip visible on this staircase.<br/>This will be noted in your compliance report.
            </div>
          </div>
        </div>
      )}

      {/* ── API error banner ── */}
      {apiError && !showReview && (
        <div style={{ position:'absolute', top:'max(env(safe-area-inset-top,0px),5rem)', left:'1rem', right:'1rem', zIndex:45 }}>
          <div style={{ background:'rgba(232,85,85,0.15)', border:'1px solid rgba(232,85,85,0.45)', borderRadius:14, padding:'0.75rem 1rem', backdropFilter:'blur(12px)' }}>
            <p style={{ margin:0, color:'#FFB0B8', fontSize:'0.82rem', lineHeight:1.55 }}>{apiError}</p>
          </div>
        </div>
      )}

      {/* ── CHAT BUBBLES ── */}
      {!showReview && !lockedMm && (
        <div style={{ position:'absolute', bottom:140, left:0, right:0, zIndex:30, padding:'0 1.1rem', display:'flex', flexDirection:'column', gap:'0.5rem', pointerEvents:'none' }}>
          {messages.map((m, i) => {
            const isLatest = i === messages.length - 1
            const bg     = m.phase === 'locked' ? 'rgba(61,184,138,0.2)' : m.phase === 'measuring' ? 'rgba(65,124,164,0.15)' : 'rgba(13,27,42,0.88)'
            const border = m.phase === 'locked' ? 'rgba(61,184,138,0.5)' : m.phase === 'measuring' ? 'rgba(65,124,164,0.4)' : 'rgba(255,255,255,0.1)'
            return (
              <div key={m.id} style={{ alignSelf:'flex-start', maxWidth:'88%', background:bg, border:`1px solid ${border}`, borderRadius:'18px 18px 18px 4px', padding:'0.75rem 1rem', backdropFilter:'blur(14px)', opacity: isLatest ? 1 : 0.3, transition:'opacity 0.3s', animation: isLatest ? 'popIn 0.22s ease-out' : 'none' }}>
                <p style={{ margin:0, color:WHITE, fontSize: isLatest ? '0.95rem' : '0.8rem', lineHeight:1.5, fontWeight: isLatest ? 500 : 400 }}>{m.text}</p>
              </div>
            )
          })}
          {thinking && (
            <div style={{ alignSelf:'flex-start', background:'rgba(13,27,42,0.88)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'18px 18px 18px 4px', padding:'0.65rem 1rem', backdropFilter:'blur(14px)', display:'flex', gap:5, alignItems:'center' }}>
              {[0,1,2].map(k => <div key={k} style={{ width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,0.45)', animation:`blink 1.2s ease-in-out ${k*0.22}s infinite` }} />)}
            </div>
          )}
        </div>
      )}

      {/* Confirmed measurements strip (top right) */}
      {!showReview && Object.keys(results).filter(k=>!['nosing','headroom'].includes(k)).length > 0 && (
        <div style={{ position:'absolute', top:'max(env(safe-area-inset-top,0px),4.5rem)', right:'0.8rem', zIndex:35, display:'flex', flexDirection:'column', gap:'0.28rem', alignItems:'flex-end' }}>
          {(['rise','run','width','guard'] as MeasId[]).filter(k => results[k] !== undefined).map(k => {
            const def = MEASUREMENTS.find(m => m.id === k)!
            return (
              <div key={k} style={{ background:'rgba(0,0,0,0.55)', border:`1px solid ${def.color}55`, borderRadius:10, padding:'0.22rem 0.6rem', display:'flex', gap:'0.45rem', alignItems:'center', backdropFilter:'blur(8px)' }}>
                <span style={{ fontSize:'0.55rem', color:def.color, fontFamily:'monospace', letterSpacing:'0.06em' }}>{def.label.toUpperCase()}</span>
                <span style={{ fontSize:'0.75rem', color:WHITE, fontWeight:700, fontFamily:'monospace' }}>{results[k]}mm</span>
                <span style={{ color:GREEN, fontSize:'0.65rem' }}>✓</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── LOCKED MEASUREMENT CONFIRM TRAY ── */}
      {lockedMm !== null && !showReview && step && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:50, background:'linear-gradient(to top,rgba(10,20,35,0.98) 70%,transparent)', paddingTop:'2rem', paddingLeft:'1.4rem', paddingRight:'1.4rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),2.4rem)', display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', animation:'fadeUp 0.3s ease-out' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:step.color, boxShadow:`0 0 10px ${step.color}` }} />
            <span style={{ fontSize:'0.6rem', fontFamily:'monospace', letterSpacing:'0.18em', color:step.color, fontWeight:700 }}>{step.label.toUpperCase()} — MEASURED</span>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'1rem', width:'100%', justifyContent:'center' }}>
            <button onClick={() => { const cur = lockedMm; setLockedMm(clamp(cur-1, step.rangeMin, step.rangeMax)) }} style={{ width:50, height:50, borderRadius:'50%', background:'rgba(147,186,212,0.12)', border:'1.5px solid rgba(255,255,255,0.14)', color:WHITE, fontSize:'1.5rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>−</button>
            <div style={{ textAlign:'center' }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:'0.3rem', justifyContent:'center' }}>
                <span style={{ fontSize:'4rem', fontWeight:900, color:WHITE, letterSpacing:'-0.04em', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{lockedMm}</span>
                <span style={{ fontSize:'1rem', color:'rgba(255,255,255,0.35)', fontFamily:'monospace' }}>mm</span>
              </div>
              {pendingSec && step.id === 'run' && (
                <div style={{ fontSize:'0.7rem', color:'rgba(65,124,164,0.85)', fontFamily:'monospace', marginTop:'0.2rem' }}>Width also captured: {pendingSec}mm</div>
              )}
              {results.nosing !== undefined && (
                <div style={{ fontSize:'0.68rem', color:SLATE, fontFamily:'monospace', marginTop:'0.2rem' }}>
                  {results.nosing === 'none' || results.nosing === 0 || results.nosing === undefined ? '○ No nosing (default — verify on review screen)' : `Nosing: ~${results.nosing}mm`}
                </div>
              )}
              <div style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.18)', fontFamily:'monospace', marginTop:'0.15rem' }}>Adjust with − / + if needed</div>
            </div>
            <button onClick={() => { const cur = lockedMm; setLockedMm(clamp(cur+1, step.rangeMin, step.rangeMax)) }} style={{ width:50, height:50, borderRadius:'50%', background:'rgba(147,186,212,0.12)', border:'1.5px solid rgba(255,255,255,0.14)', color:WHITE, fontSize:'1.5rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+</button>
          </div>

          <div style={{ display:'flex', gap:'0.6rem', width:'100%', maxWidth:340 }}>
            <button onClick={() => { setLockedMm(null); clearLines(); historyRef.current=[]; addMsg("No problem, let me take another look.", 'guiding'); scheduleAnalysis(1000) }} style={{ flex:1, padding:'0.85rem', background:'rgba(147,186,212,0.12)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, color:'rgba(255,255,255,0.5)', fontSize:'0.82rem', fontFamily:'monospace', cursor:'pointer' }}>↺ Rescan</button>
            <button onClick={confirmMeasurement} style={{ flex:2, padding:'0.85rem', background:`linear-gradient(135deg,${step.color},${step.color}aa)`, border:'none', borderRadius:14, color:'#fff', fontSize:'0.9rem', fontFamily:'monospace', fontWeight:700, letterSpacing:'0.06em', cursor:'pointer', boxShadow:`0 4px 20px ${step.color}44` }}>
              ✓ {stepIdx < primarySteps.length - 1 ? 'Confirm & Next' : 'Finish Scan'}
            </button>
          </div>
        </div>
      )}

      {/* ── IDLE BOTTOM STATUS ── */}
      {!lockedMm && !showReview && step && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:30, paddingBottom:'max(env(safe-area-inset-bottom,0px),1.8rem)', paddingTop:'1rem', background:'linear-gradient(to top,rgba(0,0,0,0.65),transparent)', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.45rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:`${step.color}1A`, border:`1px solid ${step.color}44`, borderRadius:20, padding:'0.3rem 1rem' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:step.color, animation: thinking ? 'pulse 1s ease-in-out infinite' : 'none', boxShadow:`0 0 6px ${step.color}` }}/>
            <span style={{ fontSize:'0.65rem', fontFamily:'monospace', letterSpacing:'0.12em', color:step.color, fontWeight:700 }}>
              {thinking ? 'ANALYSING…' : `SCANNING — ${step.label.toUpperCase()}`}
            </span>
          </div>
          <div style={{ fontSize:'0.58rem', color:'rgba(255,255,255,0.25)', fontFamily:'monospace', letterSpacing:'0.07em' }}>
            {confirmedCount} of {primarySteps.length} measurements done
          </div>
        </div>
      )}

      {/* ── REVIEW PANEL ── */}
      {showReview && (
        <div style={{ position:'absolute', inset:0, zIndex:60, display:'flex', flexDirection:'column', background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }}>
          <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
            {/* Header */}
            <div style={{ padding:'max(env(safe-area-inset-top,0px),2.2rem) 1.25rem 1rem', background:'rgba(13,27,42,0.95)', borderBottom:'1px solid rgba(147,186,212,0.12)' }}>
              <BetaLogo size="xs" onDark />
              <h2 style={{ fontSize:'1.3rem', fontWeight:800, color:WHITE, margin:0, letterSpacing:'-0.02em' }}>Review Measurements</h2>
              <p style={{ fontSize:'0.75rem', color:SLATE, margin:'0.3rem 0 0', lineHeight:1.5 }}>Adjust any value with − / +, then tap Generate Report.</p>
            </div>

            {/* Measurements list */}
            <div style={{ padding:'1rem 1.25rem', background:'rgba(13,27,42,0.92)', display:'flex', flexDirection:'column', gap:'0.5rem', flex:1 }}>
              {MEASUREMENTS.map(def => {
                const val = reviewVals[def.id]
                if (val === undefined) return null
                const isNumber = typeof val === 'number'
                const isSpecial = val === 'none' || val === 'clear'
                const passColor = def.id === 'nosing' && (val === 'none' || val === 0) ? AMBER : GREEN

                return (
                  <div key={def.id} style={{ background:'rgba(147,186,212,0.06)', border:`1px solid ${def.color}33`, borderRadius:14, padding:'0.85rem 1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom: isNumber ? '0.6rem' : 0 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:def.color, flexShrink:0 }} />
                      <span style={{ fontSize:'0.78rem', color:WHITE, fontWeight:600, flex:1 }}>{def.label}</span>
                      {isSpecial && (
                        <span style={{ fontSize:'0.75rem', fontFamily:'monospace', color: val === 'none' ? AMBER : GREEN, fontWeight:700 }}>
                          {val === 'none' ? '⚠ None detected' : '✓ Clear / Open'}
                        </span>
                      )}
                    </div>
                    {isNumber && (
                      <div style={{ display:'flex', alignItems:'center', gap:'0.7rem' }}>
                        <button onClick={() => adjustValue(def.id, -1)} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(147,186,212,0.12)', border:'1px solid rgba(255,255,255,0.1)', color:WHITE, fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>−</button>
                        <div style={{ flex:1, textAlign:'center' }}>
                          <span style={{ fontSize:'2rem', fontWeight:900, color:WHITE, fontVariantNumeric:'tabular-nums' }}>{val}</span>
                          <span style={{ fontSize:'0.75rem', color:SLATE, marginLeft:'0.3rem', fontFamily:'monospace' }}>mm</span>
                        </div>
                        <button onClick={() => adjustValue(def.id, +1)} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(147,186,212,0.12)', border:'1px solid rgba(255,255,255,0.1)', color:WHITE, fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>+</button>
                        <span style={{ fontSize:'0.65rem', color:SLATE, fontFamily:'monospace', width:40, textAlign:'right' }}>
                          {def.rangeMin}–{def.rangeMax}
                        </span>
                      </div>
                    )}
                    {def.id === 'nosing' && (
                      <div style={{ marginTop: isNumber ? '0.5rem' : '0.4rem' }}>
                        {/* Nosing toggle — default is NO NOSING, user can override */}
                        <div style={{ fontSize:'0.6rem', color:AMBER, fontFamily:'monospace', marginBottom:'0.5rem', lineHeight:1.5 }}>
                          ⚠ Default: NO NOSING — change below if nosing is visible
                        </div>
                        <div style={{ display:'flex', gap:'0.4rem' }}>
                          {/* No nosing option */}
                          <button
                            onClick={() => setReviewVals(prev => ({ ...prev, nosing: 'none' }))}
                            style={{
                              flex:1, padding:'0.55rem 0.4rem',
                              background: (val === 'none' || val === 0) ? 'rgba(242,147,55,0.20)' : 'rgba(255,255,255,0.04)',
                              border: `1.5px solid ${(val === 'none' || val === 0) ? '#F29337' : 'rgba(255,255,255,0.1)'}`,
                              borderRadius:10, cursor:'pointer',
                              color: (val === 'none' || val === 0) ? '#F29337' : SLATE,
                              fontSize:'0.68rem', fontFamily:'monospace', fontWeight:700,
                            }}
                          >
                            ✗ No Nosing
                          </button>
                          {/* Has nosing — show mm adjuster */}
                          <button
                            onClick={() => setReviewVals(prev => ({ ...prev, nosing: 20 }))}
                            style={{
                              flex:1, padding:'0.55rem 0.4rem',
                              background: (typeof val === 'number' && val > 0) ? 'rgba(147,186,212,0.15)' : 'rgba(255,255,255,0.04)',
                              border: `1.5px solid ${(typeof val === 'number' && val > 0) ? 'rgba(147,186,212,0.5)' : 'rgba(255,255,255,0.1)'}`,
                              borderRadius:10, cursor:'pointer',
                              color: (typeof val === 'number' && val > 0) ? WHITE : SLATE,
                              fontSize:'0.68rem', fontFamily:'monospace', fontWeight:700,
                            }}
                          >
                            ✓ Has Nosing
                          </button>
                        </div>
                        {/* Show mm adjuster if nosing selected */}
                        {typeof val === 'number' && val > 0 && (
                          <div style={{ display:'flex', alignItems:'center', gap:'0.7rem', marginTop:'0.5rem' }}>
                            <button onClick={() => adjustValue('nosing', -1)} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(147,186,212,0.12)', border:'1px solid rgba(255,255,255,0.1)', color:WHITE, fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                            <div style={{ flex:1, textAlign:'center' }}>
                              <span style={{ fontSize:'1.8rem', fontWeight:900, color:WHITE }}>{val}</span>
                              <span style={{ fontSize:'0.72rem', color:SLATE, marginLeft:'0.25rem', fontFamily:'monospace' }}>mm</span>
                            </div>
                            <button onClick={() => adjustValue('nosing', +1)} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(147,186,212,0.12)', border:'1px solid rgba(255,255,255,0.1)', color:WHITE, fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* AI notes / visual observations */}
              <div style={{ background:'rgba(65,124,164,0.06)', border:'1px solid rgba(65,124,164,0.15)', borderRadius:14, padding:'0.85rem 1rem' }}>
                <div style={{ fontSize:'0.62rem', fontFamily:'monospace', letterSpacing:'0.1em', color:BLUE, marginBottom:'0.4rem', fontWeight:700 }}>AI VISUAL OBSERVATIONS</div>
                <div style={{ fontSize:'0.75rem', color:SLATE, lineHeight:1.65 }}>
                  {reviewVals.nosing === 'none' || reviewVals.nosing === 0
                    ? '• No nosing — stairs classified as open-riser or flush-edge. Some codes require nosing or limit open-riser dimensions.'
                    : `• Nosing projection ~${reviewVals.nosing}mm — verify this is correct; default is no nosing.`}
                  {reviewVals.headroom === 'clear'
                    ? '• Headroom appears open/unobstructed above the stair.'
                    : `• Estimated headroom ~${reviewVals.headroom}mm — verify manually.`}
                </div>
              </div>
            </div>
          </div>

          {/* Sticky bottom actions */}
          <div style={{ padding:'1rem 1.25rem', paddingBottom:'max(env(safe-area-inset-bottom,0px),2rem)', background:'rgba(13,27,42,0.98)', borderTop:'1px solid rgba(147,186,212,0.12)', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            <button onClick={finishReview} style={{ width:'100%', padding:'1rem', background:'linear-gradient(135deg,#1565C0,#4A9FFF)', border:'none', borderRadius:14, color:'#fff', fontSize:'0.92rem', fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em', cursor:'pointer', boxShadow:'0 4px 24px rgba(65,124,164,0.4)' }}>
              Generate Compliance Report →
            </button>
            <button onClick={() => { setShowReview(false); clearLines(); setStepIdx(0); setResults({}); setMessages([]); historyRef.current=[]; addMsg(primarySteps[0].intro, 'searching'); scheduleAnalysis(1500) }} style={{ background:'none', border:'none', color:SLATE, fontSize:'0.72rem', fontFamily:'monospace', cursor:'pointer', letterSpacing:'0.06em', textAlign:'center' }}>
              ↺ Rescan everything
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
