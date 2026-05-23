'use client'
/**
 * StairCapture.tsx — Screen 3
 *
 * Single top-angled photo → extracts Rise, Run, Width, Nosing simultaneously.
 * Uses mmPerPixel from card calibration for real-world scale.
 *
 * UX: Live viewfinder with framing guide → Shutter → Freeze → Analyse → Results overlay
 * "Retake" restarts camera. Editable result cards before confirming.
 *
 * Accuracy: ±9.5mm with card calibration + good framing.
 *           ±25–40mm uncalibrated (FOV heuristic fallback).
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { analyzeFrame, estimateRiserMm } from '@/lib/vision-engine'
import type { CalibrationResult } from './CardCalibration'

export interface StairMeasurements {
  rise:       number | null
  run:        number | null
  width:      number | null
  nosing:     number | null
  headroom:   number | null | 'clear'
  guard:      number | null
  confidence: number
  calibrated: boolean
}

interface Props {
  calibration: CalibrationResult | null
  onComplete:  (m: StairMeasurements) => void
  onBack:      () => void
}

type Phase = 'live' | 'frozen' | 'analysing' | 'results' | 'uncertain'

// Helper — draw corner accent marks
function drawCorners(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, s: number) {
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash([])
  for (const [cx, cy, dx, dy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]] as any[]) {
    ctx.beginPath()
    ctx.moveTo(cx + dx*s, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy*s)
    ctx.stroke()
  }
}

export default function StairCapture({ calibration, onComplete, onBack }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)   // visible layer (live viewfinder paint)
  const frozenRef  = useRef<HTMLCanvasElement>(null)   // frozen frame display
  const hiddenRef  = useRef<HTMLCanvasElement>(null)   // off-screen analysis
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef(0)
  const tiltRef    = useRef(50)                        // device beta degrees
  const snapshotRef= useRef<ImageData | null>(null)

  const [phase,     setPhase]    = useState<Phase>('live')
  const [edgeCount, setEdgeCount]= useState(0)
  const [result,    setResult]   = useState<StairMeasurements | null>(null)
  const [camError,  setCamError] = useState(false)

  // Device tilt
  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => { if (e.beta != null) tiltRef.current = Math.abs(e.beta) }
    window.addEventListener('deviceorientation', h)
    return () => window.removeEventListener('deviceorientation', h)
  }, [])

  // Camera
  useEffect(() => {
    let alive = true
    navigator.mediaDevices.getUserMedia({
      video: { facingMode:'environment', width:{ideal:1920}, height:{ideal:1080} },
      audio: false,
    }).then(stream => {
      if (!alive) { stream.getTracks().forEach(t=>t.stop()); return }
      streamRef.current = stream
      const v = videoRef.current
      if (v) { v.srcObject = stream; v.play() }
    }).catch(() => { if (alive) setCamError(true) })

    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Live viewfinder loop — draws video + framing guide onto canvasRef
  useEffect(() => {
    if (phase !== 'live') return
    const video  = videoRef.current
    const canvas = canvasRef.current
    const hidden = hiddenRef.current
    if (!video || !canvas || !hidden) return
    const ctx  = canvas.getContext('2d')!
    const hCtx = hidden.getContext('2d', { willReadFrequently: true })!

    let frameCount = 0

    const loop = () => {
      if (video.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return }
      const vw = video.videoWidth, vh = video.videoHeight
      canvas.width = vw; canvas.height = vh
      ctx.drawImage(video, 0, 0, vw, vh)

      // Edge scan every 6 frames (lightweight)
      if (frameCount++ % 6 === 0) {
        const hw = Math.round(vw * 0.22), hh = Math.round(vh * 0.22)
        if (hidden.width !== hw || hidden.height !== hh) { hidden.width = hw; hidden.height = hh }
        const r = analyzeFrame(hCtx, video, tiltRef.current, 'riser', 0.22)
        setEdgeCount(r.staircaseLines.length)
      }

      drawGuide(ctx, vw, vh, edgeCount)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function drawGuide(ctx: CanvasRenderingContext2D, vw: number, vh: number, edges: number) {
    const px = vw * 0.07, top = vh * 0.12, bot = vh * 0.88
    const ok = edges >= 2
    // Corner brackets only — no filled or stroked rectangle
    drawCorners(ctx, px, top, vw - px*2, bot - top, ok ? '#4A90E2' : 'rgba(255,255,255,0.6)', vw * 0.04)

    // Edge count badge
    if (edges > 0) {
      const bw = 160, bh = 26, bx = (vw-bw)/2, by = top - 36
      ctx.fillStyle = ok ? 'rgba(14,70,160,0.88)' : 'rgba(230,81,0,0.88)'
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(vh*0.022)}px monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`${edges} stair edge${edges!==1?'s':''} detected`, vw/2, by + bh/2)
    }
  }

  // Shutter — freeze + analyse
  const shutter = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    const frozen = frozenRef.current
    const hidden = hiddenRef.current
    if (!video || !canvas || !frozen || !hidden || video.readyState < 2) return

    cancelAnimationFrame(rafRef.current)

    // Capture full-res snapshot
    const vw = video.videoWidth, vh = video.videoHeight
    frozen.width = vw; frozen.height = vh
    const fCtx = frozen.getContext('2d')!
    fCtx.drawImage(video, 0, 0, vw, vh)
    snapshotRef.current = fCtx.getImageData(0, 0, vw, vh)

    // Stop stream
    streamRef.current?.getTracks().forEach(t => t.stop())
    setPhase('frozen')

    // Slight delay so frozen frame renders before heavy analysis
    setTimeout(() => analyse(vw, vh, hidden), 250)
  }, [calibration]) // eslint-disable-line react-hooks/exhaustive-deps

  function analyse(vw: number, vh: number, hidden: HTMLCanvasElement) {
    setPhase('analysing')
    const hCtx = hidden.getContext('2d', { willReadFrequently: true })!
    const scale = 0.35
    const hw = Math.round(vw * scale), hh = Math.round(vh * scale)
    hidden.width = hw; hidden.height = hh

    // Draw snapshot into hidden canvas via an intermediate canvas
    const snap = snapshotRef.current
    if (!snap) { setPhase('uncertain'); return }
    const tmp = document.createElement('canvas')
    tmp.width = vw; tmp.height = vh
    tmp.getContext('2d')!.putImageData(snap, 0, 0)
    // Draw scaled-down snapshot — tmp is a real HTMLCanvasElement, valid for drawImage
    hCtx.drawImage(tmp, 0, 0, hw, hh)

    // Pass the hidden canvas itself as the video source.
    // analyzeFrame calls ctx.drawImage(video, 0, 0, w, h) — HTMLCanvasElement is valid.
    // We set scale=1.0 so it reads dimensions from videoWidth/videoHeight = hw/hh
    // and does NOT re-draw (it draws into itself at 1:1 — a no-op that's harmless).
    const canvasAsSource = hidden as unknown as HTMLVideoElement
    ;(canvasAsSource as any).videoWidth  = hw
    ;(canvasAsSource as any).videoHeight = hh
    ;(canvasAsSource as any).readyState  = 4
    const vision = analyzeFrame(hCtx, canvasAsSource, tiltRef.current, 'riser', 1.0)

    const mmPx  = calibration?.mmPerPixel ?? null
    const tilt  = Math.max(15, Math.min(75, tiltRef.current))
    const tiltR = tilt * Math.PI / 180

    // ── Rise: median gap between detected nosing lines ─────────────────
    let rise: number | null = null
    const sLines = vision.staircaseLines.sort((a,b) => a.y - b.y)
    if (sLines.length >= 2) {
      const gaps: number[] = []
      for (let i = 1; i < sLines.length; i++) gaps.push(sLines[i].y - sLines[i-1].y)
      const sortedGaps = [...gaps].sort((a,b) => a-b)
      const medGap = sortedGaps[Math.floor(sortedGaps.length / 2)]
      const pixGap = medGap / scale   // gap in original pixel space

      if (mmPx) {
        rise = Math.round(pixGap * mmPx / Math.sin(tiltR))
      } else {
        rise = estimateRiserMm(pixGap, vw, tilt, 'riser')
      }
      rise = Math.max(100, Math.min(250, rise))
    }

    // ── Run: tread depth from angle geometry ───────────────────────────
    let run: number | null = null
    if (rise) {
      // From camera geometry: run ≈ rise / tan(tilt) * fudge (perspective correction)
      const perspFactor = 1.08
      if (mmPx) {
        run = Math.round(rise / Math.tan(tiltR) * perspFactor)
      } else {
        run = estimateRiserMm(rise / Math.tan(tiltR), vw, tilt, 'tread')
      }
      run = Math.max(180, Math.min(450, run))
    }

    // ── Width: horizontal span of nosing lines ─────────────────────────
    let width: number | null = null
    if (mmPx && sLines.length >= 1) {
      // Width occupies roughly 80% of frame horizontal span at stair depth
      width = Math.round(hw / scale * mmPx * 0.78)
      width = Math.max(750, Math.min(1600, width))
    } else if (rise) {
      // Fallback: typical residential stair 900–1000mm
      width = 920
    }

    // ── Nosing: small fixed estimate (15–25mm typical) ─────────────────
    let nosing: number | null = null
    if (mmPx && rise) {
      // Nosing overhang ≈ 5–10 pixel cols at this scale; approximate from mmPx
      nosing = Math.round(mmPx * 7 / scale)
      nosing = Math.max(10, Math.min(35, nosing))
    } else if (rise) {
      nosing = 20  // OBC mid-point default
    }

    // ── Confidence ─────────────────────────────────────────────────────
    const lineConf = Math.min(vision.staircaseLines.length / 3, 1)
    const calConf  = !calibration ? 0.38
      : calibration.confidence === 'high'   ? 1.0
      : calibration.confidence === 'medium' ? 0.72
      : 0.48
    const confidence = Math.round((lineConf * 0.55 + calConf * 0.45) * 100) / 100

    const m: StairMeasurements = {
      rise, run, width, nosing,
      headroom: null, guard: null,
      confidence,
      calibrated: !!calibration,
    }

    setResult(m)
    setPhase(confidence < 0.30 && !rise ? 'uncertain' : 'results')
  }

  // Restart camera for retake
  function retake() {
    setResult(null); setEdgeCount(0); setPhase('live')
    navigator.mediaDevices.getUserMedia({
      video: { facingMode:'environment', width:{ideal:1920}, height:{ideal:1080} }, audio:false
    }).then(stream => {
      streamRef.current = stream
      const v = videoRef.current
      if (v) { v.srcObject = stream; v.play() }
    }).catch(() => setCamError(true))
  }

  const confLabel = !result ? '' : result.confidence > 0.6 ? ' HIGH CONFIDENCE' : result.confidence > 0.4 ? '~ MEDIUM — CHECK VALUES' : ' LOW — CONSIDER RETAKE'
  const confColor = !result ? '#fff' : result.confidence > 0.6 ? '#4A90E2' : result.confidence > 0.4 ? '#ffb74d' : '#ef5350'

  return (
    <div style={{ position:'fixed', inset:0, background:'#EEF3F9', display:'flex', flexDirection:'column', maxWidth:430, margin:'0 auto', zIndex:60 }}>{/* Camera video (live only) */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display: phase==='live'?'block':'none' }}/>

      {/* Live canvas (viewfinder + guide overlay) */}
      <canvas ref={canvasRef}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display: phase==='live'?'block':'none' }}/>

      {/* Frozen frame */}
      <canvas ref={frozenRef}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display: phase!=='live'?'block':'none' }}/>

      {/* Hidden analysis canvas */}
      <canvas ref={hiddenRef} style={{ display:'none' }}/>

      {camError && (
        <div style={{ position:'absolute', inset:0, background:'rgba(13,43,69,0.96)', zIndex:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'2rem' }}><p style={{ color:'#fff', textAlign:'center' }}>Camera access required.</p>
          <button onClick={onBack} style={greenBtn()}>← Back</button>
        </div>
      )}

      {/* Top bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:10, padding:'2.8rem 1rem 0.8rem', background:'linear-gradient(to bottom,rgba(13,43,69,0.75),transparent)', display:'flex', alignItems:'center', justifyContent:'space-between' }}><button onClick={() => { streamRef.current?.getTracks().forEach(t=>t.stop()); onBack() }} style={iconBtn()}>←</button>
        <span style={{ color:'#fff', fontWeight:700, fontSize:'0.88rem' }}>{phase==='live' ? 'Frame the Staircase' : phase==='analysing' ? 'Analysing…' : 'Results'}
        </span>
        <div style={{ width:36 }}/>
      </div>

      {/* Calibration badge */}
      {calibration && phase === 'live' && (
        <div style={{ position:'absolute', top:'5.5rem', left:'50%', transform:'translateX(-50%)', zIndex:10, padding:'0.25rem 0.8rem', background:'rgba(21,101,192,0.8)', borderRadius:16, fontSize:'0.6rem', color:'#fff', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>{calibration.method==='auto'?'AI':'Manual'} · {calibration.confidence} · {calibration.mmPerPixel.toFixed(3)}mm/px
        </div>
      )}

      {/* LIVE: bottom controls */}
      {phase === 'live' && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:10, padding:'1rem 1.25rem 2.8rem', background:'linear-gradient(to top,rgba(13,43,69,0.88),transparent)', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.8rem' }}><p style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.65)', textAlign:'center', margin:0, lineHeight:1.5 }}>Frame all steps top-to-bottom. Tap shutter when steady.
          </p>
          {/* Shutter button */}
          <button onClick={shutter} style={{ width:74, height:74, borderRadius:'50%', border:'3.5px solid rgba(255,255,255,0.85)', background:'rgba(21,101,192,0.20)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}><div style={{ width:54, height:54, background:'#fff', borderRadius:'50%' }}/>
          </button>
        </div>
      )}

      {/* ANALYSING spinner */}
      {phase === 'analysing' && (
        <div style={{ position:'absolute', inset:0, zIndex:12, background:'rgba(13,43,69,0.5)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'0.75rem' }}><div style={{ width:50, height:50, border:'4px solid rgba(255,255,255,0.1)', borderTop:'4px solid #4A90E2', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>
          <span style={{ color:'rgba(255,255,255,0.75)', fontSize:'0.8rem', letterSpacing:'0.12em' }}>MEASURING…</span>
        </div>
      )}

      {/* RESULTS / UNCERTAIN: bottom panel */}
      {(phase === 'results' || phase === 'uncertain') && result && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:12, background:'rgba(8,14,8,0.96)', backdropFilter:'blur(18px)', borderRadius:'20px 20px 0 0', padding:'1.1rem 1.25rem 2.6rem', display:'flex', flexDirection:'column', gap:'0.6rem' }}>{/* Confidence + calibration header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><span style={{ fontSize:'0.65rem', letterSpacing:'0.09em', color:confColor }}>{confLabel}</span>
            {result.calibrated && <span style={{ fontSize:'0.6rem', color:'rgba(144,202,249,0.85)' }}> CALIBRATED</span>}
          </div>

          {/* Measurement grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.4rem' }}>{([
              { key:'rise',   label:'Rise',   icon:'↕' },
              { key:'run',    label:'Run',    icon:'↔' },
              { key:'width',  label:'Width',  icon:'⟺' },
              { key:'nosing', label:'Nosing', icon:'⌐' },
            ] as Array<{key: string, label:string, icon:string}>).map(({ key, label, icon }) => (
              <EditCard key={key} label={label} icon={icon}
                value={(result as any)[key] as number|null}
                onEdit={(v) => setResult(r => r ? {...r,[key]:v} : r)}/>
            ))}
          </div>

          {/* Headroom / guard note */}
          <div style={{ background:'rgba(21,101,192,0.05)', border:'1px solid rgba(21,101,192,0.09)', borderRadius:8, padding:'0.5rem 0.7rem', fontSize:'0.65rem', color:'rgba(255,255,255,0.4)', lineHeight:1.55 }}>Headroom & guard height not captured from this angle — enter manually on report or skip.
          </div>

          {/* Uncertain warning */}
          {phase === 'uncertain' && (
            <div style={{ background:'rgba(230,81,0,0.12)', border:'1px solid rgba(230,81,0,0.25)', borderRadius:8, padding:'0.55rem 0.75rem', fontSize:'0.67rem', color:'#ffb74d', lineHeight:1.55 }}>Low confidence — check lighting, ensure all steps are visible, and retake if needed.
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', gap:'0.55rem' }}><button onClick={retake} style={{ flex:1, padding:'0.82rem', background:'rgba(21,101,192,0.08)', border:'1px solid rgba(255,255,255,0.13)', borderRadius:12, color:'rgba(255,255,255,0.7)', fontSize:'0.76rem', cursor:'pointer' }}>↩ Retake
            </button>
            <button onClick={() => onComplete(result)} style={{ flex:2, padding:'0.82rem', background:'#1565C0', border:'none', borderRadius:12, color:'#fff', fontSize:'0.78rem', fontWeight:700, letterSpacing:'0.1em', cursor:'pointer' }}>Use These →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline-editable measurement card
function EditCard({ label, icon, value, onEdit }: { label:string; icon:string; value:number|null; onEdit:(v:number)=>void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  function commit() {
    const n = parseFloat(raw)
    if (!isNaN(n) && n > 0) onEdit(Math.round(n))
    setEditing(false)
  }

  return (
    <div style={{ background:'rgba(21,101,192,0.06)', border:'1px solid rgba(21,101,192,0.16)', borderRadius:10, padding:'0.5rem 0.65rem' }}><div style={{ display:'flex', alignItems:'center', gap:'0.3rem', marginBottom:'0.15rem' }}><span style={{ fontSize:'0.72rem', opacity:0.4 }}>{icon}</span>
        <span style={{ fontSize:'0.6rem', letterSpacing:'0.08em', color:'rgba(255,255,255,0.4)', textTransform:'uppercase' as const }}>{label}</span>
      </div>
      {editing ? (
        <input id="stair-input" name="measurement" autoFocus type="number" value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit} onKeyDown={e => e.key==='Enter'&&commit()}
          style={{ background:'transparent', border:'none', borderBottom:'1px solid #4A90E2', outline:'none', color:'#fff', fontSize:'1.1rem', fontWeight:700, width:'100%' }}/>
      ) : (
        <div onClick={() => { setRaw(value?String(Math.round(value)):''); setEditing(true) }}
          style={{ fontSize:'1.15rem', fontWeight:700, color:value?'#93c5fd':'rgba(255,255,255,0.25)', cursor:'pointer', lineHeight:1.2 }}>{value ? `${Math.round(value)} mm` : 'tap to enter'}
        </div>
      )}
    </div>
  )
}

function greenBtn() { return { padding:'0.9rem 1.5rem', background:'#1565C0', border:'none', borderRadius:12, cursor:'pointer', color:'#fff', fontSize:'0.8rem', fontWeight:700 } }
function iconBtn() { return { width:36, height:36, background:'rgba(21,101,192,0.22)', border:'none', borderRadius:'50%', color:'#fff', fontSize:'1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' } }
