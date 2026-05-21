'use client'
/**
 * ARWalk.tsx — Screen 3  v4  (card-free walk)
 *
 * THE CARD IS ONLY USED ONCE — during calibration (Screen 2).
 * After that it goes in your pocket. The AR walk never needs it again.
 *
 * HOW MEASUREMENTS WORK WITHOUT THE CARD
 * ──────────────────────────────────────
 * During calibration we stored focalPx = cardPxWidth × holdDist / CARD_W_MM.
 * This is the phone's effective focal length in pixels (fixed for this session).
 *
 * During the walk, for any detected feature pair (two edges separated by gap_px):
 *
 *   realMM = gap_px × (refDist / focalPx)
 *            where refDist = HOLD_DIST_MM = 350mm (the calibration reference)
 *
 * Corrected for viewing angle (tilt sensor):
 *   For VERTICAL measurements (facing a riser/wall, phone ~horizontal):
 *     realMM = gap_px × refDist / (focalPx × sin(tilt))
 *   For HORIZONTAL measurements (top-down, phone ~vertical):
 *     realMM = gap_px × refDist / (focalPx × cos(tilt))
 *
 * PERIODIC STAIR SELF-CALIBRATION (no card needed)
 * ──────────────────────────────────────────────────
 * For RISE: we see multiple horizontal lines (nosing edges) in a single frame.
 * Their median pixel spacing × mmPerPixel = rise.
 * But even better: the CONSISTENCY of spacing (low variance) tells us if we've
 * detected real stair nosings (they're perfectly evenly spaced by definition).
 * If variance < 15%: high confidence. 15–35%: medium. >35%: low.
 *
 * For WIDTH: the tape images show ~1000mm. The outer edges of the stair run
 * wall-to-wall (wall on left, guardrail on right). These are strong vertical
 * edges that span the full frame height. We find the outermost strong vertical
 * edges and compute their pixel separation × mmPerPixel.
 *
 * FALLBACK & MANUAL EDITING
 * ─────────────────────────
 * IMPORTANT: These stairs are monochrome grey-on-grey with subtle lighting.
 * Edge detection on low-contrast uniform surfaces is inherently noisy.
 * The system always shows the estimated value in an EDITABLE field.
 * If detection is uncertain (confidence < 0.4), the field is highlighted.
 * The user taps to edit the value directly — this is the safety net.
 *
 * Each step: capture → show result with confidence → allow edit → confirm → next step.
 * At the end: all values shown together for final review before sending to report.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { CalibrationResult } from './CardCalibration'

// ── Constants ──────────────────────────────────────────────────────────────────

const CARD_W_MM   = 85.6
const HOLD_DIST   = 350   // mm — calibration reference distance
// Uncalibrated fallback: median smartphone focal length at 1080p
const FOCAL_FALLBACK = 1100

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StairMeasurements {
  rise:       number | null
  run:        number | null
  width:      number | null
  nosing:     number | null
  headroom:   number | null
  guard:      number | null
  confidence: number
  calibrated: boolean
}

type FieldId = keyof Omit<StairMeasurements, 'confidence' | 'calibrated'>

interface StepDef {
  id:      FieldId
  label:   string
  icon:    string
  hint:    string           // one-line instruction
  detail:  string           // secondary detail
  color:   string
  rangeMin: number
  rangeMax: number
  unit:    string
}

const STEPS: StepDef[] = [
  {
    id:      'rise',
    label:   'Rise Height',
    icon:    '↕',
    hint:    'Face the riser straight-on. Phone vertical.',
    detail:  'Frame one full riser face, or multiple to improve accuracy.',
    color:   '#00B67A',
    rangeMin: 100, rangeMax: 250, unit: 'mm',
  },
  {
    id:      'width',
    label:   'Stair Width',
    icon:    '⟺',
    hint:    'Step back. Frame full width, both walls visible.',
    detail:  'Phone landscape works well here.',
    color:   '#FF7F00',
    rangeMin: 700, rangeMax: 1800, unit: 'mm',
  },
  {
    id:      'run',
    label:   'Tread Depth',
    icon:    '↔',
    hint:    'Look down at one tread. Phone angled ~60° down.',
    detail:  'Capture near nosing and back edge of tread.',
    color:   '#FFB020',
    rangeMin: 180, rangeMax: 420, unit: 'mm',
  },
  {
    id:      'nosing',
    label:   'Nosing',
    icon:    '⌐',
    hint:    'Close-up side view of the tread overhang.',
    detail:  'Frame the junction of riser face and tread front edge.',
    color:   '#ce93d8',
    rangeMin: 10, rangeMax: 50, unit: 'mm',
  },
  {
    id:      'headroom',
    label:   'Headroom',
    icon:    '⇳',
    hint:    'Stand at bottom. Aim straight up to ceiling.',
    detail:  'Capture full vertical from lowest nosing to soffit above.',
    color:   '#f48fb1',
    rangeMin: 1800, rangeMax: 2800, unit: 'mm',
  },
  {
    id:      'guard',
    label:   'Guard Height',
    icon:    '⊤',
    hint:    'Face the guardrail. Phone vertical.',
    detail:  'Frame full height from tread to top of railing.',
    color:   '#80cbc4',
    rangeMin: 700, rangeMax: 1200, unit: 'mm',
  },
]

interface FieldResult {
  value:      number
  confidence: number   // 0–1
  source:     'measured' | 'manual' | 'estimated'
}

interface Props {
  calibration: CalibrationResult | null
  onComplete:  (m: StairMeasurements) => void
  onBack:      () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ARWalk({ calibration, onComplete, onBack }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const hiddenRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef(0)
  const tiltRef    = useRef(45)
  const focalRef   = useRef(calibration?.focalPx ?? FOCAL_FALLBACK)

  // Update focal if calibration arrives late
  useEffect(() => {
    focalRef.current = calibration?.focalPx ?? FOCAL_FALLBACK
  }, [calibration])

  const [stepIdx,     setStepIdx]     = useState(0)
  const [camError,    setCamError]    = useState(false)
  const [liveValue,   setLiveValue]   = useState<number | null>(null)
  const [liveConf,    setLiveConf]    = useState(0)
  const [results,     setResults]     = useState<Partial<Record<FieldId, FieldResult>>>({})
  const [flash,       setFlash]       = useState(false)
  const [done,        setDone]        = useState(false)
  // Edit mode: after capture, user can adjust before confirming
  const [editingVal,  setEditingVal]  = useState<string>('')
  const [editMode,    setEditMode]    = useState(false)
  const [pendingResult, setPending]   = useState<FieldResult | null>(null)

  const step = STEPS[stepIdx]
  const isCalibrated = !!calibration?.focalPx

  // ── Device tilt ───────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => {
      if (e.beta != null) tiltRef.current = Math.abs(e.beta)
    }
    window.addEventListener('deviceorientation', h)
    return () => window.removeEventListener('deviceorientation', h)
  }, [])

  // ── Camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then(s => {
      if (!alive) { s.getTracks().forEach(t => t.stop()); return }
      streamRef.current = s
      const v = videoRef.current
      if (v) { v.srcObject = s; v.play() }
    }).catch(() => { if (alive) setCamError(true) })
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── AR render + live estimate ─────────────────────────────────────────────
  useEffect(() => {
    if (done || editMode) return
    const video   = videoRef.current
    const overlay = overlayRef.current
    const hidden  = hiddenRef.current
    if (!video || !overlay || !hidden) return
    const ctx  = overlay.getContext('2d')!
    const hCtx = hidden.getContext('2d', { willReadFrequently: true })!
    let fc = 0

    const loop = () => {
      if (video.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return }
      const vw = video.videoWidth, vh = video.videoHeight
      overlay.width = vw; overlay.height = vh
      ctx.clearRect(0, 0, vw, vh)
      fc++

      // Compute live estimate every 3 frames
      if (fc % 3 === 0) {
        const r = estimateField(video, hCtx, hidden, STEPS[stepIdx], focalRef.current, tiltRef.current)
        if (r) { setLiveValue(r.value); setLiveConf(r.confidence) }
        else { setLiveValue(null); setLiveConf(0) }
      }

      // Draw step-specific AR guides
      drawOverlay(ctx, vw, vh, STEPS[stepIdx], liveValue, liveConf)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, editMode, stepIdx])

  // ── Capture button ────────────────────────────────────────────────────────
  const capture = useCallback(() => {
    setFlash(true); setTimeout(() => setFlash(false), 150)
    cancelAnimationFrame(rafRef.current)

    const video  = videoRef.current
    const hidden = hiddenRef.current
    let result: FieldResult

    if (video && hidden) {
      const hCtx = hidden.getContext('2d', { willReadFrequently: true })!
      const r = estimateField(video, hCtx, hidden, STEPS[stepIdx], focalRef.current, tiltRef.current)
      if (r) {
        result = r
      } else {
        // No detection — show midpoint as starting edit value
        const mid = Math.round((STEPS[stepIdx].rangeMin + STEPS[stepIdx].rangeMax) / 2)
        result = { value: mid, confidence: 0, source: 'estimated' }
      }
    } else {
      const mid = Math.round((STEPS[stepIdx].rangeMin + STEPS[stepIdx].rangeMax) / 2)
      result = { value: mid, confidence: 0, source: 'estimated' }
    }

    setPending(result)
    setEditingVal(String(Math.round(result.value)))
    setEditMode(true)
  }, [stepIdx])

  function confirmEdit() {
    const n = parseFloat(editingVal)
    const s = STEPS[stepIdx]
    const val = isNaN(n) ? (pendingResult?.value ?? s.rangeMin) : Math.max(s.rangeMin, Math.min(s.rangeMax, Math.round(n)))
    const finalResult: FieldResult = {
      value:      val,
      confidence: pendingResult?.confidence ?? 0,
      source:     val !== pendingResult?.value ? 'manual' : (pendingResult?.source ?? 'estimated'),
    }
    setResults(r => ({ ...r, [s.id]: finalResult }))
    setEditMode(false)
    setPending(null)

    if (stepIdx + 1 >= STEPS.length) {
      finishWalk({ ...results, [s.id]: finalResult })
    } else {
      setStepIdx(i => i + 1)
    }
  }

  function skipStep() {
    setEditMode(false)
    setPending(null)
    if (stepIdx + 1 >= STEPS.length) {
      finishWalk(results)
    } else {
      setStepIdx(i => i + 1)
    }
  }

  function finishWalk(final: Partial<Record<FieldId, FieldResult>>) {
    setDone(true)
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())

    const capturedCount  = STEPS.filter(s => final[s.id] != null).length
    const measuredCount  = STEPS.filter(s => final[s.id]?.source === 'measured').length
    const calBonus       = isCalibrated ? 0.25 : 0
    const confidence     = Math.min(1, (capturedCount / STEPS.length) * 0.5 + (measuredCount / STEPS.length) * 0.25 + calBonus)

    onComplete({
      rise:      final.rise?.value      ?? null,
      run:       final.run?.value       ?? null,
      width:     final.width?.value     ?? null,
      nosing:    final.nosing?.value    ?? null,
      headroom:  final.headroom?.value  ?? null,
      guard:     final.guard?.value     ?? null,
      confidence,
      calibrated: isCalibrated,
    })
  }

  const capturedSteps = STEPS.filter(s => results[s.id] != null)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#EEF3F9', maxWidth: 430, margin: '0 auto', zIndex: 60, overflow: 'hidden' }}>

      {/* Live camera */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: editMode ? 'none' : 'block' }} />

      {/* AR overlay */}
      <canvas ref={overlayRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', display: editMode ? 'none' : 'block' }} />

      {/* Hidden analysis canvas */}
      <canvas ref={hiddenRef} style={{ display: 'none' }} />

      {/* Flash */}
      {flash && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.35)', zIndex: 30, pointerEvents: 'none' }} />}

      {/* Camera error */}
      {camError && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,43,69,0.96)', zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
          <p style={{ color: '#fff', textAlign: 'center', lineHeight: 1.6 }}>Camera access required.</p>
          <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onBack() }}
            style={bS('#007FFF')}>← Back</button>
        </div>
      )}

      {/* ══ EDIT MODE: result confirmation panel ══════════════════════════════ */}
      {editMode && pendingResult && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#1C1F24,#1C2030)', zIndex: 25, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', gap: '1.5rem' }}>

          {/* Step label */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>{step.icon}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: step.color, fontFamily: 'monospace', letterSpacing: '0.08em' }}>{step.label}</div>
          </div>

          {/* Confidence badge */}
          <ConfBadge conf={pendingResult.confidence} source={pendingResult.source} />

          {/* Editable value */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              {pendingResult.confidence < 0.35 ? '⚠ LOW CONFIDENCE — PLEASE VERIFY' : 'CONFIRM OR ADJUST BELOW'}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                value={editingVal}
                onChange={e => setEditingVal(e.target.value)}
                onFocus={e => e.target.select()}
                inputMode="decimal"
                style={{
                  fontSize: '3.2rem', fontWeight: 700, fontFamily: 'monospace',
                  background: 'rgba(21,101,192,0.06)',
                  border: `2px solid ${pendingResult.confidence < 0.35 ? '#E63946' : step.color}`,
                  borderRadius: 14, color: step.color, outline: 'none',
                  textAlign: 'center', width: '60%', padding: '0.6rem',
                }}
              />
              <span style={{ fontSize: '1.2rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>mm</span>
            </div>
            <div style={{ fontSize: '0.58rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.28)', marginTop: '0.4rem' }}>
              Valid range: {step.rangeMin}–{step.rangeMax} mm
            </div>
          </div>

          {/* Quick adjustment buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[-10, -5, +5, +10].map(delta => (
              <button key={delta}
                onClick={() => setEditingVal(v => String(Math.max(step.rangeMin, Math.min(step.rangeMax, Math.round((parseFloat(v) || 0) + delta)))))}
                style={{ padding: '0.45rem 0.7rem', background: 'rgba(21,101,192,0.08)', border: '1px solid rgba(21,101,192,0.20)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', fontFamily: 'monospace', cursor: 'pointer' }}>
                {delta > 0 ? '+' : ''}{delta}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button onClick={skipStep}
              style={{ flex: 1, padding: '0.85rem', background: 'rgba(21,101,192,0.06)', border: '1px solid rgba(21,101,192,0.20)', borderRadius: 12, color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontFamily: 'monospace', cursor: 'pointer' }}>
              SKIP
            </button>
            <button onClick={confirmEdit}
              style={{ flex: 3, padding: '0.85rem', background: step.color === '#00B67A' ? '#007FFF' : step.color + 'cc', border: 'none', borderRadius: 12, color: '#fff', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' }}>
              CONFIRM {Math.round(parseFloat(editingVal) || 0)} mm →
            </button>
          </div>

          {/* Retake option */}
          <button onClick={() => { setEditMode(false); setPending(null) }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem', fontFamily: 'monospace', cursor: 'pointer', letterSpacing: '0.06em' }}>
            ↩ Retake this shot
          </button>
        </div>
      )}

      {/* ══ WALK MODE: top bar + live preview + controls ══════════════════════ */}
      {!editMode && (
        <>
          {/* Top bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, padding: '2.8rem 1rem 0.6rem', background: 'linear-gradient(to bottom,rgba(13,43,69,0.85),transparent)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onBack() }}
              style={{ width: 36, height: 36, background: 'rgba(21,101,192,0.22)', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '1rem', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>

            {/* Progress */}
            <div style={{ display: 'flex', gap: '0.28rem', flex: 1, justifyContent: 'center' }}>
              {STEPS.map((s, i) => (
                <div key={s.id} style={{ width: i === stepIdx ? 22 : 7, height: 7, borderRadius: 4, background: i < stepIdx ? s.color : i === stepIdx ? step.color : 'rgba(21,101,192,0.25)', transition: 'all 0.25s' }} />
              ))}
            </div>

            {/* Cal badge */}
            <div style={{ fontSize: '0.52rem', fontFamily: 'monospace', color: isCalibrated ? '#00B67A' : '#FFB020', background: 'rgba(13,43,69,0.45)', borderRadius: 8, padding: '0.15rem 0.45rem', whiteSpace: 'nowrap' }}>
              {isCalibrated ? '✓ CAL' : '⚠ UNCAL'}
            </div>
          </div>

          {/* Step label */}
          <div style={{ position: 'absolute', top: '6.2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(13,43,69,0.6)', backdropFilter: 'blur(10px)', border: `1.5px solid ${step.color}50`, padding: '0.28rem 0.8rem', borderRadius: 20 }}>
              <span style={{ fontSize: '0.9rem' }}>{step.icon}</span>
              <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700, color: step.color, letterSpacing: '0.06em' }}>{step.label}</span>
              <span style={{ fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>{stepIdx + 1}/{STEPS.length}</span>
            </div>
          </div>

          {/* Live value (top right) */}
          {liveValue != null && (
            <div style={{ position: 'absolute', top: '6.2rem', right: '0.8rem', zIndex: 20, pointerEvents: 'none' }}>
              <div style={{ background: 'rgba(13,43,69,0.7)', backdropFilter: 'blur(8px)', border: `1px solid ${step.color}${liveConf > 0.4 ? 'aa' : '44'}`, borderRadius: 10, padding: '0.28rem 0.6rem', textAlign: 'right' }}>
                <div style={{ fontSize: '1.05rem', fontFamily: 'monospace', fontWeight: 700, color: liveConf > 0.4 ? step.color : '#FFB020' }}>
                  {Math.round(liveValue)}<span style={{ fontSize: '0.55rem', opacity: 0.55 }}> mm</span>
                </div>
                <div style={{ fontSize: '0.46rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>
                  {liveConf > 0.6 ? 'GOOD' : liveConf > 0.35 ? 'FAIR' : 'EST'}
                </div>
              </div>
            </div>
          )}

          {/* Captured strip (left) */}
          {capturedSteps.length > 0 && (
            <div style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', zIndex: 20, display: 'flex', flexDirection: 'column', gap: '0.25rem', pointerEvents: 'none' }}>
              {capturedSteps.map(s => {
                const r = results[s.id]!
                return (
                  <div key={s.id} style={{ background: 'rgba(13,43,69,0.7)', backdropFilter: 'blur(8px)', border: `1px solid ${s.color}40`, borderRadius: 8, padding: '0.22rem 0.45rem', minWidth: 68 }}>
                    <div style={{ fontSize: '0.48rem', fontFamily: 'monospace', color: s.color, letterSpacing: '0.07em' }}>{s.icon} {s.label.toUpperCase()}</div>
                    <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700, color: r.source === 'manual' ? '#fff' : r.confidence > 0.4 ? s.color : '#FFB020' }}>
                      {Math.round(r.value)}<span style={{ fontSize: '0.48rem', opacity: 0.45 }}>mm</span>
                      {r.source === 'manual' && <span style={{ fontSize: '0.4rem', opacity: 0.55 }}> ✎</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Bottom controls */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, padding: '0.7rem 1.1rem 2.6rem', background: 'linear-gradient(to top,rgba(0,0,0,0.92) 75%,transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600, margin: '0 0 0.1rem', lineHeight: 1.35 }}>{step.hint}</p>
              <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.42)', margin: 0, lineHeight: 1.35, fontFamily: 'monospace' }}>{step.detail}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', width: '100%', justifyContent: 'center' }}>
              {/* Skip without measuring */}
              <button onClick={() => { setPending({ value: Math.round((step.rangeMin + step.rangeMax)/2), confidence: 0, source: 'estimated' }); setEditingVal(String(Math.round((step.rangeMin + step.rangeMax)/2))); setEditMode(true) }}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 20, padding: '0.42rem 0.9rem', color: 'rgba(255,255,255,0.42)', fontSize: '0.62rem', fontFamily: 'monospace', cursor: 'pointer', letterSpacing: '0.07em' }}>
                ENTER
              </button>

              {/* Shutter */}
              <button onClick={capture}
                style={{ width: 70, height: 70, borderRadius: '50%', border: `3px solid ${step.color}`, background: 'rgba(21,101,192,0.09)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', boxShadow: `0 0 0 6px ${step.color}20` }}>
                <div style={{ width: 50, height: 50, background: step.color, borderRadius: '50%' }} />
              </button>

              {capturedSteps.length >= 2
                ? <button onClick={() => finishWalk(results)}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 20, padding: '0.42rem 0.9rem', color: 'rgba(255,255,255,0.42)', fontSize: '0.62rem', fontFamily: 'monospace', cursor: 'pointer', letterSpacing: '0.07em' }}>
                    DONE
                  </button>
                : <div style={{ width: 70 }} />}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Confidence badge ───────────────────────────────────────────────────────────

function ConfBadge({ conf, source }: { conf: number; source: string }) {
  const label = source === 'manual' ? 'MANUALLY ENTERED'
    : conf > 0.65 ? '✓ HIGH CONFIDENCE'
    : conf > 0.35 ? '~ MEDIUM — VERIFY VALUE'
    : '⚠ LOW — PLEASE CHECK AND ADJUST'
  const color = source === 'manual' ? '#FF7F00'
    : conf > 0.65 ? '#00B67A'
    : conf > 0.35 ? '#FFB020'
    : '#E63946'
  return (
    <div style={{ padding: '0.3rem 1rem', background: color + '22', border: `1px solid ${color}55`, borderRadius: 20, fontSize: '0.65rem', fontFamily: 'monospace', color, letterSpacing: '0.08em' }}>
      {label}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MEASUREMENT ENGINE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Core photogrammetry formula (card-free):
 *
 * focalPx encodes: focalPx = cardPxWidth × holdDist / CARD_W_MM
 * So: holdDist / CARD_W_MM = focalPx / cardPxWidth
 * And: mmPerPixel = realMM / featurePx
 *               = (HOLD_DIST × featureAngle) / (focalPx × featureAngle)
 *               = HOLD_DIST / focalPx × (angle correction)
 *
 * For a vertical measurement (facing a flat vertical surface):
 *   realMM = featurePx × HOLD_DIST / focalPx / sin(tilt)
 *
 * For a horizontal/ground-plane measurement:
 *   realMM = featurePx × HOLD_DIST / focalPx / cos(tilt)
 *
 * NOTE: HOLD_DIST = 350mm cancels with the focalPx derivation.
 * The ratio HOLD_DIST / focalPx = CARD_W_MM / cardPxWidth = mmPerPixel at calibration.
 * So: realMM = featurePx × mmPerPixelCalib × (correction factor)
 *
 * This is stable and self-consistent. The correction factor accounts for the
 * different viewing angle at measurement vs. calibration.
 */

function mmPxVertical(focalPx: number, tiltDeg: number): number {
  const t = clamp(Math.abs(tiltDeg), 8, 82) * Math.PI / 180
  return HOLD_DIST / (focalPx * Math.sin(t))
}

function mmPxGroundPlane(focalPx: number, tiltDeg: number): number {
  const t = clamp(Math.abs(tiltDeg), 8, 82) * Math.PI / 180
  return HOLD_DIST / (focalPx * Math.cos(t))
}

function estimateField(
  video:   HTMLVideoElement,
  hCtx:    CanvasRenderingContext2D,
  hidden:  HTMLCanvasElement,
  step:    StepDef,
  focalPx: number,
  tiltDeg: number,
): FieldResult | null {
  if (focalPx <= 0) return null

  const vw = video.videoWidth, vh = video.videoHeight
  const scale = 0.30
  const hw = Math.round(vw * scale), hh = Math.round(vh * scale)
  if (hidden.width !== hw || hidden.height !== hh) { hidden.width = hw; hidden.height = hh }
  hCtx.drawImage(video, 0, 0, hw, hh)
  const id   = hCtx.getImageData(0, 0, hw, hh)
  const gray = toGray(id.data, hw, hh)
  const blur = boxBlur(gray, hw, hh)

  switch (step.id) {

    case 'rise': {
      // Detect horizontal edges = nosing lines. Evenly-spaced lines = stairs.
      // SELF-CALIBRATING: if we see ≥3 nosing lines with consistent spacing,
      // median gap is the rise. Confidence = 1 - (stddev / median).
      const edges = hEdgeRows(blur, hw, hh, 8)
      if (edges.length < 2) return null

      const gaps: number[] = []
      for (let i = 1; i < edges.length; i++)
        gaps.push((edges[i].y - edges[i-1].y) / scale)  // full-res pixels

      const med = median(gaps)
      const consistency = gaps.length > 1
        ? 1 - clamp(stddev(gaps) / med, 0, 1)
        : 0.55

      const mmPx = mmPxVertical(focalPx, tiltDeg)
      const rise = clamp(Math.round(med * mmPx), step.rangeMin, step.rangeMax)

      return { value: rise, confidence: clamp(consistency * 0.85 + 0.15, 0, 1), source: 'measured' }
    }

    case 'width': {
      // Detect outermost vertical edges (walls / balusters)
      const span = vEdgeSpan(blur, hw, hh) / scale  // full-res pixels
      if (span <= 10) return null
      const mmPx  = mmPxVertical(focalPx, tiltDeg)
      const width = clamp(Math.round(span * mmPx), step.rangeMin, step.rangeMax)
      // Confidence based on whether span is "most of the frame" (suggests walls visible)
      const frameRatio = span / vw
      const conf = frameRatio > 0.55 ? 0.7 : frameRatio > 0.35 ? 0.5 : 0.3
      return { value: width, confidence: conf, source: 'measured' }
    }

    case 'run': {
      // Top-down / angled-down view of tread surface.
      // Two horizontal edges = near nosing and far edge of tread.
      const edges = hEdgeRows(blur, hw, hh, 8)
      if (edges.length < 2) return null
      const gap  = (edges[edges.length - 1].y - edges[0].y) / scale
      const mmPx = mmPxGroundPlane(focalPx, tiltDeg)
      const run  = clamp(Math.round(gap * mmPx), step.rangeMin, step.rangeMax)
      return { value: run, confidence: 0.55, source: 'measured' }
    }

    case 'nosing': {
      // Close-up side view. Detect the riser face / tread junction edge.
      // Nosing overhang is the short horizontal distance.
      // At close range the mmPerPixel is much smaller — use only horizontal edges
      const edges = hEdgeRows(blur, hw, hh, 4)
      if (edges.length < 1) return null
      // Estimate nosing as a small fraction of the detected edge region width
      // This is inherently approximate — flag as low confidence
      const mmPx   = mmPxVertical(focalPx, tiltDeg) * 0.3  // close-range correction
      const nosing = clamp(Math.round(hw * 0.08 / scale * mmPx), step.rangeMin, step.rangeMax)
      return { value: nosing, confidence: 0.3, source: 'estimated' }
    }

    case 'headroom': {
      // Phone aimed upward. Full frame height = scene height = headroom estimate.
      const mmPx = mmPxVertical(focalPx, clamp(90 - Math.abs(tiltDeg), 10, 80))
      const h    = clamp(Math.round(vh * mmPx), step.rangeMin, step.rangeMax)
      return { value: h, confidence: 0.45, source: 'estimated' }
    }

    case 'guard': {
      // Facing the guardrail. Top and bottom horizontal edges.
      const edges = hEdgeRows(blur, hw, hh, 8)
      if (edges.length < 2) return null
      const gap   = (edges[edges.length - 1].y - edges[0].y) / scale
      const mmPx  = mmPxVertical(focalPx, tiltDeg)
      const guard = clamp(Math.round(gap * mmPx), step.rangeMin, step.rangeMax)
      return { value: guard, confidence: 0.55, source: 'measured' }
    }
  }

  return null
}

// ── AR overlay drawing ─────────────────────────────────────────────────────────

function drawOverlay(ctx: CanvasRenderingContext2D, vw: number, vh: number, step: StepDef, liveM: number | null, conf: number) {
  const col = step.color
  const cx  = vw / 2

  switch (step.id) {
    case 'rise': {
      drawHLine(ctx, vh * 0.30, vw, col, 0.6)
      drawHLine(ctx, vh * 0.65, vw, col, 0.6)
      drawVBracket(ctx, vw * 0.88, vh * 0.30, vh * 0.65, col, liveM ? `${Math.round(liveM)}` : '?')
      lbl(ctx, 'TOP NOSING',   cx, vh * 0.30 - 18, col)
      lbl(ctx, 'LOWER NOSING', cx, vh * 0.65 + 20, col)
      break
    }
    case 'width': {
      drawVLine(ctx, vw * 0.07, vh, col, 0.5)
      drawVLine(ctx, vw * 0.93, vh, col, 0.5)
      drawHBracket(ctx, vw * 0.07, vw * 0.93, vh * 0.12, col, liveM ? `${Math.round(liveM)}mm` : '')
      break
    }
    case 'run': {
      drawHLine(ctx, vh * 0.28, vw, col, 0.55)
      drawHLine(ctx, vh * 0.72, vw, col, 0.55)
      drawVBracket(ctx, vw * 0.88, vh * 0.28, vh * 0.72, col, liveM ? `${Math.round(liveM)}` : '?')
      lbl(ctx, 'NEAR EDGE', cx, vh * 0.28 - 18, col)
      lbl(ctx, 'FAR EDGE',  cx, vh * 0.72 + 20, col)
      break
    }
    case 'nosing': {
      drawHLine(ctx, vh * 0.50, vw, col, 0.7)
      lbl(ctx, 'NOSING EDGE', cx, vh * 0.50 - 20, col)
      if (liveM) lbl(ctx, `≈${Math.round(liveM)}mm`, cx, vh * 0.50 + 24, col)
      break
    }
    case 'headroom': {
      drawHLine(ctx, vh * 0.05, vw, col, 0.45)
      drawHLine(ctx, vh * 0.92, vw, col, 0.45)
      drawVBracket(ctx, vw * 0.88, vh * 0.05, vh * 0.92, col, liveM ? `${Math.round(liveM)}` : '?')
      lbl(ctx, 'CEILING / SOFFIT', cx, vh * 0.05 + 18, col)
      lbl(ctx, 'LOWEST NOSING',    cx, vh * 0.92 - 22, col)
      break
    }
    case 'guard': {
      drawHLine(ctx, vh * 0.10, vw, col, 0.6)
      drawHLine(ctx, vh * 0.88, vw, col, 0.6)
      drawVBracket(ctx, vw * 0.88, vh * 0.10, vh * 0.88, col, liveM ? `${Math.round(liveM)}` : '?')
      lbl(ctx, 'TOP OF RAIL',   cx, vh * 0.10 + 18, col)
      lbl(ctx, 'TREAD / FLOOR', cx, vh * 0.88 - 22, col)
      break
    }
  }

  // Confidence indicator dot + tilt
  const tiltApprox = 45  // We don't have tilt in this scope; it's just visual
  const confDot = conf > 0.6 ? '#00B67A' : conf > 0.35 ? '#FFB020' : '#E63946'
  ctx.beginPath(); ctx.arc(vw - 20, vh - 20, 6, 0, Math.PI * 2)
  ctx.fillStyle = confDot; ctx.fill()
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function drawHLine(ctx: CanvasRenderingContext2D, y: number, vw: number, color: string, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([14, 8])
  ctx.beginPath(); ctx.moveTo(vw * 0.04, y); ctx.lineTo(vw * 0.96, y); ctx.stroke()
  ctx.setLineDash([]); ctx.restore()
}
function drawVLine(ctx: CanvasRenderingContext2D, x: number, vh: number, color: string, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([14, 8])
  ctx.beginPath(); ctx.moveTo(x, vh * 0.05); ctx.lineTo(x, vh * 0.95); ctx.stroke()
  ctx.setLineDash([]); ctx.restore()
}
function drawVBracket(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, color: string, label: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash([])
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke()
  ;[y1, y2].forEach(y => { ctx.beginPath(); ctx.moveTo(x-9,y); ctx.lineTo(x+9,y); ctx.stroke() })
  if (label) {
    ctx.font = 'bold 13px monospace'
    const tw = ctx.measureText(label + 'mm').width
    ctx.fillStyle = 'rgba(13,43,69,0.75)'
    ctx.beginPath(); (ctx as any).roundRect(x+14, (y1+y2)/2 - 12, tw + 14, 24, 5); ctx.fill()
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(label + (label.endsWith('mm') || label === '?' ? '' : 'mm'), x+21, (y1+y2)/2)
  }
}
function drawHBracket(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: string, label: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash([])
  ctx.beginPath(); ctx.moveTo(x1,y); ctx.lineTo(x2,y); ctx.stroke()
  ;[x1,x2].forEach(x => { ctx.beginPath(); ctx.moveTo(x,y-9); ctx.lineTo(x,y+9); ctx.stroke() })
  if (label) {
    const cx = (x1+x2)/2
    ctx.font = 'bold 13px monospace'
    const tw = ctx.measureText(label).width
    ctx.fillStyle = 'rgba(13,43,69,0.75)'
    ctx.beginPath(); (ctx as any).roundRect(cx-tw/2-8,y-28,tw+16,22,5); ctx.fill()
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label,cx,y-17)
  }
}
function lbl(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, col: string) {
  ctx.font = '11px monospace'
  const tw = ctx.measureText(text).width
  ctx.fillStyle = 'rgba(13,43,69,0.6)'
  ctx.beginPath(); (ctx as any).roundRect(cx-tw/2-7,cy-10,tw+14,20,4); ctx.fill()
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text,cx,cy)
}

// ── Vision helpers ─────────────────────────────────────────────────────────────

function toGray(d: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = 0.299*d[i*4] + 0.587*d[i*4+1] + 0.114*d[i*4+2]
  return g
}
function boxBlur(src: Float32Array, w: number, h: number): Float32Array {
  const dst = new Float32Array(w * h)
  for (let y = 1; y < h-1; y++)
    for (let x = 1; x < w-1; x++) {
      let s = 0
      for (let ky=-1;ky<=1;ky++) for (let kx=-1;kx<=1;kx++) s += src[(y+ky)*w+(x+kx)]
      dst[y*w+x] = s/9
    }
  return dst
}
const SY = [-1,-2,-1,0,0,0,1,2,1]
const SX = [-1,0,1,-2,0,2,-1,0,1]

function hEdgeRows(gray: Float32Array, w: number, h: number, minGap: number): {y:number,str:number}[] {
  const scores = new Float32Array(h)
  for (let y=1;y<h-1;y++) {
    let s=0
    for (let x=1;x<w-1;x++) {
      let gy=0
      for (let ky=-1;ky<=1;ky++) for (let kx=-1;kx<=1;kx++)
        gy += gray[(y+ky)*w+(x+kx)] * SY[(ky+1)*3+(kx+1)]
      s += Math.abs(gy)
    }
    scores[y] = s/w
  }
  const max = Math.max(...Array.from(scores))
  const thresh = max * 0.28
  const peaks: {y:number,str:number}[] = []
  for (let y=2;y<h-2;y++) {
    if (scores[y]>thresh && scores[y]>=scores[y-1] && scores[y]>=scores[y+1]) {
      if (peaks.length===0 || y - peaks[peaks.length-1].y > minGap)
        peaks.push({y, str: scores[y]})
    }
  }
  return peaks.sort((a,b)=>b.str-a.str).slice(0,8).sort((a,b)=>a.y-b.y)
}

function vEdgeSpan(gray: Float32Array, w: number, h: number): number {
  const scores = new Float32Array(w)
  const midY=Math.round(h/2), band=Math.round(h*0.35)
  for (let x=1;x<w-1;x++) {
    let s=0
    for (let y=midY-band;y<midY+band;y++) {
      let gx=0
      for (let ky=-1;ky<=1;ky++) for (let kx=-1;kx<=1;kx++)
        gx += gray[(y+ky)*w+(x+kx)] * SX[(ky+1)*3+(kx+1)]
      s += Math.abs(gx)
    }
    scores[x] = s/(band*2)
  }
  const thresh = Math.max(...Array.from(scores)) * 0.38
  let lx=-1, rx=-1
  for (let x=0;x<w;x++) { if (scores[x]>thresh) { lx=x; break } }
  for (let x=w-1;x>=0;x--) { if (scores[x]>thresh) { rx=x; break } }
  return (lx>=0 && rx>lx) ? rx-lx : 0
}

// ── Math helpers ───────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function median(arr: number[]): number {
  const s = [...arr].sort((a,b)=>a-b)
  return s.length%2===0 ? (s[s.length/2-1]+s[s.length/2])/2 : s[Math.floor(s.length/2)]
}
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = arr.reduce((a,b)=>a+b,0)/arr.length
  return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length)
}

function bS(bg: string): React.CSSProperties {
  return { padding: '0.9rem 1.5rem', background: bg, border: 'none', borderRadius: 12, cursor: 'pointer', color: '#fff', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }
}
