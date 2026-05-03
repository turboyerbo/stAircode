'use client'

/**
 * CameraScanner.tsx
 *
 * Camera screen with:
 *  1. Real edge detection (vision-engine.ts pipeline)
 *  2. Tap-to-draw measurement: user taps point A, drags to point B.
 *     Two filled endpoint circles connected by a dashed line with a
 *     dimension label badge — distinct from Apple Measure's 3D ray-cast
 *     approach (ours is 2D pixel-space with calibrated mm estimation).
 *  3. Small stair-part diagram in the corner showing which dimension
 *     is currently being measured.
 *  4. Manual override input at the bottom.
 */

import { useEffect, useRef, useState, useCallback, CSSProperties } from 'react'
import { analyzeFrame, drawOverlay, VisionResult, estimateRiserMm } from '@/lib/vision-engine'
import { StairPartIndicator } from './InstructionScreen'
import { CalibrationResult } from './CardCalibration'

export interface CameraField {
  key:   string
  label: string
  hint:  string
  icon:  string
}

interface Props {
  field:         CameraField
  fieldIndex:    number
  totalFields:   number
  onCapture:     (valueMm: number) => void
  onSkip:        () => void
  onBack:        () => void
  calibration?:  CalibrationResult | null   // if present, use card-derived mmPerPixel
}

interface Point { x: number; y: number }

export default function CameraScanner({
  field, fieldIndex, totalFields, onCapture, onSkip, onBack, calibration,
}: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const overlayRef    = useRef<HTMLCanvasElement>(null)   // vision overlay
  const drawRef       = useRef<HTMLCanvasElement>(null)   // user tap-to-draw layer
  const hiddenRef     = useRef<HTMLCanvasElement>(null)   // off-screen vision processing
  const rafRef        = useRef<number>(0)
  const streamRef     = useRef<MediaStream | null>(null)
  const tiltRef       = useRef<number>(45)

  const [cameraReady,  setCameraReady]  = useState(false)
  const [cameraError,  setCameraError]  = useState(false)
  const [manualValue,  setManualValue]  = useState('')
  const [confirmed,    setConfirmed]    = useState(false)

  // Vision auto-detect state
  const [visionResult, setVisionResult] = useState<VisionResult | null>(null)
  const [suggestedMm,  setSuggestedMm]  = useState<number | null>(null)
  const [confidence,   setConfidence]   = useState(0)
  const [stableCount,  setStableCount]  = useState(0)
  const [autoFilled,   setAutoFilled]   = useState(false)

  // Tap-to-draw state
  const [drawMode,     setDrawMode]     = useState<'idle' | 'drawing' | 'done'>('idle')
  const [pointA,       setPointA]       = useState<Point | null>(null)
  const [pointB,       setPointB]       = useState<Point | null>(null)
  const [drawnMm,      setDrawnMm]      = useState<number | null>(null)

  // Which value to show / use
  const manRaw     = parseFloat(manualValue)
  const hasManual  = !isNaN(manRaw) && manRaw > 0
  const activeMm   = hasManual ? manRaw : drawnMm ?? suggestedMm
  const isReady    = hasManual || drawnMm !== null || (confidence > 0.5 && stableCount >= 20)

  // ── Device orientation ────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => { tiltRef.current = Math.abs(e.beta ?? 45) }
    window.addEventListener('deviceorientation', h)
    return () => window.removeEventListener('deviceorientation', h)
  }, [])

  // ── Camera lifecycle ──────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch { setCameraError(true) }
  }, [])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  useEffect(() => { startCamera(); return () => stopCamera() }, [startCamera, stopCamera])

  // ── Vision loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraReady) return
    const video   = videoRef.current
    const overlay = overlayRef.current
    const hidden  = hiddenRef.current
    if (!video || !overlay || !hidden) return
    const hiddenCtx  = hidden.getContext('2d', { willReadFrequently: true })
    const overlayCtx = overlay.getContext('2d')
    if (!hiddenCtx || !overlayCtx) return

    let stableFrames = 0
    let lastSuggested: number | null = null
    let cardFrameCount = 0   // rolling count of frames where card-like rect detected

    // Simple card detection: look for a rectangular region with credit-card aspect ratio (~1.586)
    function detectCard(ctx2d: CanvasRenderingContext2D, cw: number, ch: number): boolean {
      try {
        const d = ctx2d.getImageData(0, 0, cw, ch).data
        let darkPx = 0
        // Count pixels that are significantly darker than surroundings (card edge heuristic)
        for (let i = 0; i < d.length; i += 16) {
          const r = d[i], g = d[i+1], b = d[i+2]
          const brightness = (r + g + b) / 3
          if (brightness < 80) darkPx++
        }
        const darkRatio = darkPx / (cw * ch / 16)
        // A card in frame creates a rectangular dark/contrasting region — ratio 0.05-0.35
        return darkRatio > 0.04 && darkRatio < 0.4
      } catch { return false }
    }

    const loop = () => {
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return }
      const vw = video.videoWidth  || 640
      const vh = video.videoHeight || 480
      if (overlay.width !== vw || overlay.height !== vh) { overlay.width = vw; overlay.height = vh }
      const hw = Math.round(vw * 0.25), hh = Math.round(vh * 0.25)
      if (hidden.width !== hw || hidden.height !== hh) { hidden.width = hw; hidden.height = hh }

      const result = analyzeFrame(hiddenCtx, video, tiltRef.current, field.key, 0.25)
      if (result.suggestedMm !== null) {
        if (lastSuggested !== null && Math.abs(result.suggestedMm - lastSuggested) < 8) {
          stableFrames = Math.min(stableFrames + 1, 60)
        } else { stableFrames = 0 }
        lastSuggested = result.suggestedMm
      } else { stableFrames = 0; lastSuggested = null }

      // Card detection — check every 10 frames for performance
      if (stableFrames % 10 === 0) {
        const cardSeen = detectCard(hiddenCtx, hw, hh)
        cardFrameCount = cardSeen ? Math.min(cardFrameCount + 3, 30) : Math.max(cardFrameCount - 1, 0)
      }
      const cardDetected = cardFrameCount > 10

      setVisionResult(result); setConfidence(result.confidence)
      setSuggestedMm(result.suggestedMm); setStableCount(stableFrames)

      if (stableFrames >= 30 && result.confidence > 0.55 && result.suggestedMm !== null) {
        setAutoFilled(prev => {
          if (!prev) { setManualValue(String(result.suggestedMm)); return true }
          return prev
        })
      }
      drawOverlay(overlayCtx, vw, vh, result, result.suggestedMm, result.confidence, field.key, cardDetected)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [cameraReady, field.key])

  // ── Draw tap-to-draw layer ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = drawRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!pointA) return

    const end = pointB ?? pointA
    const color = '#ffffff'
    const accentColor = '#4A90E2'

    // Dashed measurement line
    ctx.beginPath()
    ctx.moveTo(pointA.x, pointA.y)
    ctx.lineTo(end.x, end.y)
    ctx.setLineDash([10, 6])
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.setLineDash([])

    // Draw endpoint markers — filled circles with outer ring
    // Distinct from Apple Measure's AR sphere markers: ours are flat 2D crosshair circles
    const drawEndpoint = (p: Point, label: string) => {
      // Outer ring
      ctx.beginPath()
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2)
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 2
      ctx.stroke()
      // Crosshair lines (not in Apple Measure which uses AR dots)
      ctx.beginPath()
      ctx.moveTo(p.x - 8, p.y); ctx.lineTo(p.x + 8, p.y)
      ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y + 8)
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      // Inner dot
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = accentColor
      ctx.fill()
      // Label tag
      const tw = ctx.measureText(label).width
      const bw = tw + 14, bh = 18
      const bx = p.x + 18, by = p.y - bh / 2
      ctx.fillStyle = 'rgba(13,43,69,0.75)'
      ctx.beginPath()
      ctx.roundRect(bx, by, bw, bh, 4)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px monospace'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, bx + 7, p.y)
    }

    drawEndpoint(pointA, 'A')
    if (pointB) drawEndpoint(pointB, 'B')

    // Midpoint dimension badge (shown when both points set)
    if (pointB && drawnMm !== null) {
      const mx = (pointA.x + pointB.x) / 2
      const my = (pointA.y + pointB.y) / 2
      const label = `${drawnMm} mm`
      ctx.font = 'bold 15px monospace'
      const tw = ctx.measureText(label).width
      const bw = tw + 20, bh = 28
      const bx = mx - bw / 2, by = my - bh / 2

      // Background pill
      ctx.beginPath()
      ctx.roundRect(bx, by, bw, bh, 8)
      ctx.fillStyle = 'rgba(14,70,160,0.92)'
      ctx.fill()
      ctx.strokeStyle = '#4A90E2'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Text
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, bx + 10, my)
    }
  }, [pointA, pointB, drawnMm])

  // ── Resize draw canvas to match video ────────────────────────────────────
  useEffect(() => {
    if (!cameraReady) return
    const video  = videoRef.current
    const canvas = drawRef.current
    if (!video || !canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width
      canvas.height = rect.height
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [cameraReady])

  // ── Touch / pointer events for tap-to-draw ────────────────────────────────
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = drawRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawMode === 'done') {
      // Second tap resets
      setPointA(null); setPointB(null); setDrawnMm(null); setDrawMode('idle'); return
    }
    if (drawMode === 'idle') {
      setPointA(getCanvasPoint(e)); setPointB(null); setDrawnMm(null); setDrawMode('drawing')
    }
  }, [drawMode])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawMode !== 'drawing') return
    setPointB(getCanvasPoint(e))
  }, [drawMode])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawMode !== 'drawing') return
    const end = getCanvasPoint(e)
    setPointB(end)
    setDrawMode('done')

    // Compute pixel distance → mm
    if (pointA) {
      const dx = end.x - pointA.x
      const dy = end.y - pointA.y
      const pixelDist = Math.sqrt(dx * dx + dy * dy)
      const video = videoRef.current
      const canvas = drawRef.current
      if (video && canvas) {
        let mm: number
        if (calibration && calibration.mmPerPixel > 0) {
          // ── CALIBRATED path: use card-derived mmPerPixel (accurate) ──
          // Scale CSS pixels to video pixels, then apply calibrated scale
          const scaleX = video.videoWidth  / canvas.clientWidth
          const scaleY = video.videoHeight / canvas.clientHeight
          const avgScale = (scaleX + scaleY) / 2
          const videoPxDist = pixelDist * avgScale
          mm = Math.round(videoPxDist * calibration.mmPerPixel)
          // Clamp to reasonable range for the field
          const ranges: Record<string, [number, number]> = {
            riser: [100, 220], tread: [200, 380], nosing: [10, 60],
            headroom: [1800, 2500], width: [600, 1500],
            handrail: [700, 1200], variation: [2, 20], landing: [600, 1500],
          }
          const r = ranges[field.key] || [10, 3000]
          mm = Math.max(r[0], Math.min(r[1], mm))
        } else {
          // ── UNCALIBRATED path: FOV estimation (existing behaviour) ──
          const scaleX = video.videoWidth  / canvas.clientWidth
          const scaleY = video.videoHeight / canvas.clientHeight
          const avgScale = (scaleX + scaleY) / 2
          const videoPxDist = pixelDist * avgScale
          mm = estimateRiserMm(videoPxDist, video.videoHeight, tiltRef.current, field.key)
        }
        setDrawnMm(mm)
        setManualValue(String(mm))
        setAutoFilled(false)
      }
    }
  }, [drawMode, pointA, field.key, calibration])

  // Reset on field change
  useEffect(() => {
    setManualValue(''); setAutoFilled(false); setConfirmed(false)
    setSuggestedMm(null); setConfidence(0); setStableCount(0)
    setPointA(null); setPointB(null); setDrawnMm(null); setDrawMode('idle')
  }, [field.key])

  // ── Capture ───────────────────────────────────────────────────────────────
  const capture = useCallback(() => {
    if (confirmed || !activeMm) return
    setConfirmed(true)
    setTimeout(() => onCapture(activeMm), 500)
  }, [confirmed, activeMm, onCapture])

  // ── Status text ───────────────────────────────────────────────────────────
  const statusColor = confirmed ? 'green' : isReady ? 'green' : confidence > 0.25 ? 'amber' : 'grey'
  const statusText  = confirmed
    ? 'Captured ✓'
    : drawMode === 'done' && drawnMm
    ? `Drawn: ${drawnMm} mm — tap capture`
    : drawMode === 'drawing'
    ? 'Drag to point B…'
    : confidence > 0.55 && stableCount >= 30
    ? `Detected ~${suggestedMm} mm`
    : confidence > 0.3
    ? 'Hold steady — detecting…'
    : 'Aim at stair — or tap to draw'

  const drawHint = drawMode === 'idle'
    ? 'Tap the screen to place point A, drag to point B'
    : drawMode === 'drawing'
    ? 'Release to set point B'
    : 'Tap anywhere to redraw · tap capture to confirm'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#EEF3F9',
      display: 'flex', flexDirection: 'column',
      maxWidth: 430, margin: '0 auto', zIndex: 50,
    }}>
      {/* Video */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Vision overlay canvas (drawn by vision-engine) */}
      <canvas ref={overlayRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
      />

      {/* Tap-to-draw interactive canvas (on top of everything, receives touch) */}
      <canvas ref={drawRef}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          cursor: drawMode === 'idle' ? 'crosshair' : drawMode === 'drawing' ? 'crosshair' : 'default',
          touchAction: 'none',
          // Only catch events when vision area is in the middle — bottom panel handles its own events
          zIndex: 5,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Hidden vision-processing canvas */}
      <canvas ref={hiddenRef} style={{ display: 'none' }} />

      {/* Camera loading */}
      {!cameraReady && !cameraError && (
        <div style={{ position: 'absolute', inset: 0, background: '#111', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
            STARTING CAMERA…
          </span>
        </div>
      )}

      {/* Camera error */}
      {cameraError && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: '1.2rem', color: '#fff', fontStyle: 'italic' }}>
            Camera access needed
          </div>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, maxWidth: 260 }}>
            Allow camera access in your browser settings, then tap Retry.
          </p>
          <button onClick={startCamera} style={btnStyle('#1565C0')}>Retry Camera</button>
          <button onClick={onBack} style={btnStyle('rgba(21,101,192,0.20)', true)}>← Go Back</button>
        </div>
      )}

      {/* ── HUD overlay ── */}
      {!cameraError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'none', zIndex: 10 }}>

          {/* Top bar */}
          <div style={{
            padding: '2.5rem 1rem 0.75rem',
            background: 'linear-gradient(to bottom, rgba(13,43,69,0.7) 0%, transparent 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            pointerEvents: 'all',
          }}>
            <button onClick={() => { stopCamera(); onBack() }} style={iconBtnStyle()}>←</button>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontFamily: 'var(--display)', fontSize: '1rem', fontWeight: 700,
                fontStyle: 'italic', color: '#fff', textShadow: '0 1px 8px rgba(13,43,69,0.5)' }}>
                {field.label}
              </span>
            </div>
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)',
              background: 'rgba(21,101,192,0.22)', padding: '0.2rem 0.6rem',
              borderRadius: 20, backdropFilter: 'blur(8px)', fontFamily: 'monospace' }}>
              {fieldIndex + 1} / {totalFields}
            </span>
          </div>

          {/* Center — draw hint, readout, status */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem',
            paddingBottom: '0.5rem', pointerEvents: 'none' }}>

            {/* Draw mode hint */}
            <div style={{
              background: 'rgba(13,43,69,0.6)', backdropFilter: 'blur(8px)',
              borderRadius: 20, padding: '0.3rem 0.9rem',
              fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)',
              fontFamily: 'monospace', letterSpacing: '0.05em',
              border: drawMode === 'drawing' ? '1px solid rgba(74,144,226,0.4)' : '1px solid rgba(255,255,255,0.1)',
              transition: 'border-color 0.3s',
            }}>
              {drawHint}
            </div>

            {/* Big readout */}
            {activeMm && (
              <div style={{
                fontFamily: 'var(--display)', fontSize: '3.2rem', fontWeight: 900, lineHeight: 1,
                color: isReady ? '#93c5fd' : '#ef9a9a',
                textShadow: '0 2px 20px rgba(13,43,69,0.7)', transition: 'color 0.3s',
              }}>
                {Math.round(activeMm)}
                <span style={{ fontSize: '1rem', fontWeight: 400, opacity: 0.8, marginLeft: 4 }}>mm</span>
              </div>
            )}

            {/* Confidence bar (vision auto-detect) */}
            {!drawnMm && cameraReady && (
              <div style={{ width: 120, height: 3, background: 'rgba(21,101,192,0.20)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.round(confidence * 100)}%`,
                  background: confidence > 0.5 ? '#4A90E2' : confidence > 0.25 ? '#ffb74d' : '#ef5350',
                  transition: 'width 0.2s, background 0.3s', borderRadius: 3,
                }}/>
              </div>
            )}

            {/* Calibration badge — shown when card calibration is active */}
            {calibration && (
              <div style={{
                display:'flex', alignItems:'center', gap:'0.4rem',
                padding:'0.3rem 0.8rem', borderRadius:16,
                background:'rgba(21,101,192,0.85)', backdropFilter:'blur(8px)',
                border:'1px solid rgba(66,165,245,0.4)',
                fontSize:'0.62rem', fontFamily:'monospace', letterSpacing:'0.08em', color:'#fff',
              }}>
                <span style={{ fontSize:'0.7rem' }}>📏</span>
                {calibration.confidence === 'high' ? '✓' : '~'} CALIBRATED ·{' '}
                {(calibration.mmPerPixel).toFixed(3)}mm/px ·{' '}
                {calibration.confidence.toUpperCase()}
              </div>
            )}

            {/* Status badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.45rem 1.1rem', borderRadius: 22,
              fontSize: '0.75rem', fontWeight: 600,
              backdropFilter: 'blur(10px)',
              background: statusColor === 'green' ? 'rgba(14,70,160,0.85)'
                        : statusColor === 'amber' ? 'rgba(230,81,0,0.85)'
                        : 'rgba(13,43,69,0.55)',
              border: `1px solid ${statusColor === 'green' ? 'rgba(74,144,226,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: '#fff', transition: 'background 0.3s',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%',
                background: statusColor === 'green' ? '#4A90E2' : statusColor === 'amber' ? '#ffb74d' : 'rgba(255,255,255,0.4)' }}/>
              {statusText}
            </div>

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {Array.from({ length: totalFields }).map((_, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: i < fieldIndex ? '#1976D2' : i === fieldIndex ? '#fff' : 'rgba(21,101,192,0.25)',
                  transform: i === fieldIndex ? 'scale(1.35)' : 'none',
                  transition: 'all 0.2s',
                }}/>
              ))}
            </div>
          </div>

          {/* Bottom panel */}
          <div style={{
            width: '100%', padding: '0.75rem 1.25rem 2.2rem',
            background: 'linear-gradient(to top, rgba(13,43,69,0.85) 0%, transparent 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7rem',
            pointerEvents: 'all',
          }}>
            {/* Manual / detected input */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(21,101,192,0.25)', borderRadius: 12,
              padding: '0.45rem 0.7rem', width: '100%',
            }}>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)',
                whiteSpace: 'nowrap', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                {drawnMm && !hasManual ? '✦ DRAWN:' : autoFilled && !hasManual ? '✦ AUTO:' : 'MANUAL:'}
              </span>
              <input
                type="number"
                placeholder={suggestedMm ? `~${suggestedMm}` : 'type value…'}
                value={manualValue}
                onChange={e => { setManualValue(e.target.value); setAutoFilled(false) }}
                inputMode="decimal"
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700,
                  color: '#fff', width: '100%', minWidth: 0,
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>mm</span>
              {manualValue && (
                <button onClick={() => { setManualValue(''); setAutoFilled(false); setDrawnMm(null); setDrawMode('idle'); setPointA(null); setPointB(null) }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px' }}>
                  ✕
                </button>
              )}
            </div>

            {/* Capture button row */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {/* Capture button — large round shutter */}
              <button onClick={capture} disabled={!activeMm} style={{
                width: 68, height: 68, borderRadius: '50%',
                border: `3px solid ${confirmed ? '#4A90E2' : 'rgba(255,255,255,0.85)'}`,
                background: confirmed ? 'rgba(14,70,160,0.7)' : 'rgba(21,101,192,0.22)',
                backdropFilter: 'blur(8px)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', opacity: !activeMm ? 0.4 : 1,
              }}>
                <div style={{
                  width: 48, height: 48,
                  background: confirmed ? '#4A90E2' : '#fff',
                  borderRadius: '50%', transition: 'all 0.2s',
                }}/>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <button onClick={onSkip} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)',
                fontSize: '0.68rem', cursor: 'pointer', textDecoration: 'underline',
                fontFamily: 'monospace', letterSpacing: '0.05em',
              }}>Skip</button>
              {visionResult?.debugInfo && (
                <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                  {visionResult.debugInfo}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stair part indicator — corner diagram */}
      {!cameraError && cameraReady && (
        <StairPartIndicator fieldKey={field.key} />
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function btnStyle(bg: string, ghost?: boolean): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 200, padding: '0.85rem',
    background: bg, color: '#fff',
    fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    border: ghost ? '1px solid rgba(21,101,192,0.25)' : 'none',
    borderRadius: 12, cursor: 'pointer',
  }
}

function iconBtnStyle(): CSSProperties {
  return {
    width: 36, height: 36,
    background: 'rgba(21,101,192,0.22)', border: 'none',
    borderRadius: '50%', color: '#fff', fontSize: '1rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', backdropFilter: 'blur(8px)',
  }
}
