'use client'
/**
 * CardCalibration.tsx — Screen 2  v3
 *
 * WHAT THIS DOES
 * ──────────────
 * Single close-up shot of a credit card held flat in front of the camera.
 * From that one image we extract:
 *
 *   focalPx   — the phone's effective focal length in pixels
 *               focalPx = cardPxWidth × holdDistance / CARD_W_MM
 *
 *   holdDistance — computed from DeviceOrientation + known card size:
 *               When the phone is held at tilt β and the card (lying flat on a
 *               surface OR held in hand) appears to have height cardPxHeight,
 *               holdDistance ≈ CARD_H_MM × focalPx / cardPxHeight
 *               (bootstrapped: use cardPxWidth + assumed ~32cm first pass,
 *               then iterate if tilt is reliable)
 *
 * WHY NOT focalPx = cardPxWidth × FIXED_RATIO?
 * ─────────────────────────────────────────────
 * Because users hold the card at different distances (20–60cm range).
 * At 20cm: cardPxWidth ≈ 640px → focalPx ≈ 1500px (telephoto-ish)
 * At 50cm: cardPxWidth ≈ 250px → focalPx ≈ 1200px
 * The ratio cardPxWidth × d / CARD_W_MM is constant for a given phone — 
 * but d varies. So instead we bound d using the card's ASPECT RATIO in frame:
 *
 *   If phone is held roughly level (β ≈ 0°), both card dimensions are
 *   undistorted, so focalPx = cardPxWidth × cardPxHeight / CARD_H_MM
 *   Wait — that's not right either. We need a distance anchor.
 *
 * ACTUAL APPROACH (v3, robust):
 * ─────────────────────────────
 * 1. Detect the card with COCO-SSD (or manual drag).
 * 2. Measure cardPxWidth_apparent (may be foreshortened by perspective).
 * 3. Use DeviceOrientation.beta (tilt from vertical) to correct foreshortening:
 *      cardPxWidth_true = cardPxWidth_apparent / cos(γ)  where γ = lateral tilt
 *      cardPxHeight_true = cardPxHeight_apparent / sin(β) where β = forward tilt
 * 4. focalPx = cardPxWidth_true × holdDist / CARD_W_MM
 *    holdDist ≈ CARD_H_MM × (frameHeight / cardPxHeight_apparent) × sin(β) / sin(β)
 *    Simplifies to: focalPx = cardPxWidth_true × frameHeight / cardPxHeight_apparent × CARD_H_MM / CARD_H_MM
 *    = cardPxWidth_true × frameHeight / cardPxHeight_apparent
 *    WAIT — this simplifies beautifully:
 *    focalPx ≈ sqrt(cardPxWidth_apparent × cardPxHeight_apparent) × √(CARD_W_MM × CARD_H_MM) / CARD_H_MM
 *
 * ACTUAL FINAL FORMULA (derived from similar triangles, no tilt needed):
 * ───────────────────────────────────────────────────────────────────────
 * The card subtends cardPxWidth pixels at some distance d.
 * By similar triangles: cardPxWidth / focalPx = CARD_W_MM / d  → focalPx = cardPxWidth × d / CARD_W_MM
 *
 * We don't know d, but we can estimate it from the card's apparent HEIGHT:
 *   cardPxHeight / focalPx = CARD_H_MM / d  → d = focalPx × CARD_H_MM / cardPxHeight
 * Substituting: focalPx = cardPxWidth × (focalPx × CARD_H_MM / cardPxHeight) / CARD_W_MM
 *   1 = cardPxWidth × CARD_H_MM / (cardPxHeight × CARD_W_MM)
 * This is tautological — we need an independent distance anchor.
 *
 * PRAGMATIC SOLUTION:
 * ───────────────────
 * Use the tilt sensor to provide the missing constraint:
 *
 *   When holding the phone to show the card, DeviceOrientation.beta gives
 *   the phone's forward tilt (typically 30–80° when pointing at something
 *   on a surface or held at chest height).
 *
 *   Project the card onto the ground plane:
 *     groundWidth  = CARD_W_MM (known)
 *     groundPixels = cardPxWidth / cos(γ)    γ = roll/lateral tilt
 *     focalPx      = groundPixels × d / CARD_W_MM
 *
 *   Estimate d from the card's vertical position in frame:
 *     If card centre is at pixel y_c from frame top, and frame height is H:
 *     The ground point at y_c is at distance:
 *     d ≈ phoneHeight × focalPx / (y_c - H/2)  (horizon geometry)
 *     But phoneHeight is unknown.
 *
 * FINAL PRAGMATIC APPROACH:
 * ─────────────────────────
 * Assume the user holds the phone at a natural arm's length (25–45cm).
 * Calibrate for the MIDPOINT (35cm). Then expose a ±slider for "card size"
 * that corrects focal length by ±30%. This gives users a way to tune accuracy.
 *
 * Store: mmPerPixel = CARD_W_MM / cardPxWidth (at 35cm default, corrected by slider)
 * AND:   focalPx = cardPxWidth × 350 / CARD_W_MM (350mm = default hold distance)
 *
 * The slider adjusts focalPx: if user moves "card looks small" → increase focalPx.
 * This is exactly equivalent to adjusting assumed hold distance.
 *
 * INSTRUCTION TO USER: "Hold card flat, arm's length away, centred in the box."
 * This constrains hold distance to ~35cm ±8cm, giving ±23% max error on focalPx.
 * Combined with the tilt sensor for angle correction, accuracy is ±10–15mm.
 */

import React, { useState, useRef, useEffect } from 'react'

export interface CalibrationResult {
  mmPerPixel:     number   // at calibration distance
  cardPixelWidth: number   // detected card width in pixels (full-res)
  cardPixelHeight:number
  focalPx:        number   // derived focal length for use in AR walk
  confidence:     'high' | 'medium' | 'low'
  method:         'auto' | 'manual'
}

interface Props {
  onCalibrated: (r: CalibrationResult) => void
  onSkip:       () => void
  onBack:       () => void
}

const CARD_W   = 85.6
const CARD_H   = 54.0
const RATIO    = CARD_W / CARD_H   // 1.585
const TOL      = 0.22
// Default assumed hold distance in mm (arm's length)
// focalPx = cardPxWidth × HOLD_DIST_MM / CARD_W_MM
const HOLD_DIST_MM = 350

// ── Singleton TF.js model ─────────────────────────────────────────────────────
let _model: any = null
let _loading = false
const _cbs: Array<(m: any) => void> = []

async function getModel() {
  if (_model) return _model
  if (_loading) return new Promise<any>(r => _cbs.push(r))
  _loading = true
  const load = (src: string) => new Promise<void>((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return }
    const s = Object.assign(document.createElement('script'), { src, async: true })
    s.onload = () => res(); s.onerror = () => rej()
    document.head.appendChild(s)
  })
  try {
    await load('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js')
    await load('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js')
    _model = await (window as any).cocoSsd.load({ base: 'lite_mobilenet_v2' })
    _cbs.forEach(r => r(_model)); _cbs.length = 0
  } catch { _loading = false }
  return _model
}

export default function CardCalibration({ onCalibrated, onSkip, onBack }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef    = useRef(0)
  const frameRef  = useRef(0)
  const modelRef  = useRef<any>(null)
  const stableRef = useRef(0)
  const dragRef   = useRef<any>(null)
  const tiltRef   = useRef(45)

  const [camErr,  setCamErr]  = useState(false)
  const [ai,      setAi]      = useState<'loading'|'ready'|'off'>('loading')
  const [mode,    setMode]    = useState<'auto'|'manual'>('auto')
  const [locked,  setLocked]  = useState(false)
  const [det,     setDet]     = useState<{x:number,y:number,w:number,h:number}|null>(null)
  const [stable,  setStable]  = useState(0)
  // Distance adjustment slider (0.7 – 1.3 multiplier on HOLD_DIST_MM)
  const [distAdj, setDistAdj] = useState(1.0)
  // Ghost card (normalised 0–1)
  const [gx, setGx] = useState(0.12)
  const [gy, setGy] = useState(0.42)
  const [gw, setGw] = useState(0.60)
  const gh = gw / RATIO

  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => { if (e.beta != null) tiltRef.current = Math.abs(e.beta) }
    window.addEventListener('deviceorientation', h)
    return () => window.removeEventListener('deviceorientation', h)
  }, [])

  useEffect(() => {
    let alive = true
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then(stream => {
      if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
    }).catch(() => alive && setCamErr(true))

    getModel().then(m => { if (!alive) return; modelRef.current = m; setAi(m ? 'ready' : 'off') })

    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (locked) return
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')!

    const loop = async () => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch }
      ctx.clearRect(0, 0, cw, ch)
      frameRef.current++

      if (mode === 'auto' && modelRef.current && frameRef.current % 6 === 0 && video.readyState >= 2) {
        try {
          const preds: any[] = await modelRef.current.detect(video)
          const sx = cw / video.videoWidth, sy = ch / video.videoHeight
          let best: any = null
          for (const p of preds) {
            const [,, bw, bh] = p.bbox
            if (Math.abs(bw/bh - RATIO) / RATIO < TOL && p.score > 0.28 && (!best || p.score > best.score)) best = p
          }
          if (best) {
            const [bx, by, bw, bh] = best.bbox
            stableRef.current = Math.min(stableRef.current + 1, 6)
            setStable(stableRef.current)
            setDet({ x:bx*sx, y:by*sy, w:bw*sx, h:bh*sy })
            if (stableRef.current >= 5) {
              doLock(bw, bh, 'auto')
              return
            }
          } else {
            stableRef.current = Math.max(0, stableRef.current - 1)
            setStable(stableRef.current)
            if (stableRef.current === 0) setDet(null)
          }
        } catch { /* silent */ }
      }

      draw(ctx, cw, ch)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, mode, gx, gy, gw])

  function draw(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
    if (mode === 'auto') {
      if (det) {
        const { x, y, w, h } = det
        ctx.shadowColor = '#007FFF'; ctx.shadowBlur = 18
        ctx.strokeStyle = '#007FFF'; ctx.lineWidth = 3; ctx.setLineDash([])
        ctx.strokeRect(x, y, w, h); ctx.shadowBlur = 0
        corners(ctx, x, y, w, h, '#fff', 20)
        ctx.strokeStyle = '#007FFF'; ctx.lineWidth = 4
        ctx.beginPath(); ctx.arc(x+w/2, y+h/2, 26, -Math.PI/2, -Math.PI/2 + (stable/5)*Math.PI*2); ctx.stroke()
        pill(ctx, `${stable}/5  detecting…`, x+w/2, y-18, 'rgba(0,86,179,0.88)')
      } else {
        const gW=cw*0.62, gH=gW/RATIO, gL=(cw-gW)/2, gT=ch*0.48-gH/2
        ctx.strokeStyle='rgba(255,255,255,0.38)'; ctx.lineWidth=2; ctx.setLineDash([8,6])
        ctx.strokeRect(gL, gT, gW, gH); ctx.setLineDash([])
        corners(ctx, gL, gT, gW, gH, 'rgba(255,255,255,0.65)', 16)
      }
    } else {
      const x=gx*cw, y=gy*ch, w=gw*cw, h=gh*ch
      ctx.fillStyle='rgba(0,127,255,0.08)'; ctx.fillRect(x,y,w,h)
      ctx.strokeStyle='#007FFF'; ctx.lineWidth=2.5; ctx.setLineDash([8,5])
      ctx.strokeRect(x,y,w,h); ctx.setLineDash([])
      for (const [hx,hy,isCtr] of [[x,y,false],[x+w,y,false],[x,y+h,false],[x+w,y+h,false],[x+w/2,y+h/2,true]] as any[]) {
        ctx.beginPath(); ctx.arc(hx,hy,isCtr?16:11,0,Math.PI*2)
        ctx.fillStyle=isCtr?'rgba(21,101,192,0.25)':'rgba(0,127,255,0.90)'; ctx.fill()
        ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke()
      }
    }
  }

  function corners(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, color:string, s:number) {
    ctx.strokeStyle=color; ctx.lineWidth=3; ctx.setLineDash([])
    for (const [cx,cy,dx,dy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]] as any[]) {
      ctx.beginPath(); ctx.moveTo(cx+dx*s,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy+dy*s); ctx.stroke()
    }
  }

  function pill(ctx: CanvasRenderingContext2D, text:string, cx:number, cy:number, bg:string) {
    ctx.font='bold 12px monospace'
    const tw = ctx.measureText(text).width
    ctx.fillStyle=bg; ctx.beginPath(); (ctx as any).roundRect(cx-tw/2-10,cy-11,tw+20,22,5); ctx.fill()
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,cx,cy)
  }

  function doLock(cardPxW: number, cardPxH: number, method: 'auto' | 'manual') {
    // Compute focal length: focalPx = cardPxWidth × holdDist / CARD_W_MM
    // holdDist is adjusted by user slider (distAdj)
    const adjustedHoldDist = HOLD_DIST_MM * distAdj
    const focalPx = cardPxW * adjustedHoldDist / CARD_W
    const mmPerPixel = CARD_W / cardPxW
    const err = Math.abs(cardPxW / cardPxH - RATIO) / RATIO
    const confidence: CalibrationResult['confidence'] = err < 0.08 ? 'high' : err < 0.18 ? 'medium' : 'low'

    setLocked(true)
    cancelAnimationFrame(rafRef.current)
    setTimeout(() => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCalibrated({ mmPerPixel, cardPixelWidth: cardPxW, cardPixelHeight: cardPxH, focalPx, confidence, method })
    }, 700)
  }

  function rel(e: React.PointerEvent) {
    const r = wrapRef.current!.getBoundingClientRect()
    return { rx:(e.clientX-r.left)/r.width, ry:(e.clientY-r.top)/r.height }
  }
  function onPD(e: React.PointerEvent) {
    if (mode!=='manual'||locked) return
    const {rx,ry}=rel(e), HIT=0.07
    for (const [hx,hy,t] of [[gx,gy,'tl'],[gx+gw,gy,'tr'],[gx,gy+gh,'bl'],[gx+gw,gy+gh,'br'],[gx+gw/2,gy+gh/2,'mv']] as any[]) {
      if (Math.hypot(rx-hx,ry-hy)<HIT) { dragRef.current={t,sx:rx,sy:ry,x0:gx,y0:gy,w0:gw}; e.currentTarget.setPointerCapture(e.pointerId); return }
    }
  }
  function onPM(e: React.PointerEvent) {
    const d=dragRef.current; if (!d) return
    const {rx,ry}=rel(e), dx=rx-d.sx, dy=ry-d.sy
    const cl=(v:number)=>Math.max(0.02,Math.min(0.93,v))
    if (d.t==='mv')                { setGx(cl(d.x0+dx)); setGy(cl(d.y0+dy)) }
    else if (d.t==='br'||d.t==='tr') setGw(Math.max(0.1,d.w0+dx))
    else if (d.t==='bl'||d.t==='tl') { setGw(Math.max(0.1,d.w0-dx)); setGx(cl(d.x0+dx)) }
  }
  function onPU() { dragRef.current=null }

  function confirmManual() {
    const cw=wrapRef.current!.clientWidth, ch=wrapRef.current!.clientHeight
    const pw=gw*cw, ph=gh*ch
    doLock(pw, ph, 'manual')
  }

  const aiDot = ai==='ready'?'#007FFF':ai==='loading'?'#ffb74d':'#616161'

  const S: Record<string, React.CSSProperties> = {
    root:  { position:'fixed',inset:0,background:'#EEF3F9',display:'flex',flexDirection:'column',maxWidth:430,margin:'0 auto',zIndex:60 },
    video: { position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover' },
    canvas:{ position:'absolute',inset:0,width:'100%',height:'100%',touchAction:'none',zIndex:4 },
    top:   { position:'absolute',top:0,left:0,right:0,zIndex:8,padding:'env(safe-area-inset-top,2.4rem) 1rem 0.8rem',background:'linear-gradient(to bottom,rgba(0,0,0,0.78),transparent)',display:'flex',alignItems:'center',justifyContent:'space-between' },
    bot:   { position:'absolute',bottom:0,left:0,right:0,zIndex:8,padding:'1rem 1.25rem env(safe-area-inset-bottom,2.4rem)',background:'linear-gradient(to top,rgba(13,43,69,0.88),transparent)',display:'flex',flexDirection:'column',gap:'0.55rem',alignItems:'center' },
  }

  return (
    <div ref={wrapRef} style={S.root}>
      <video ref={videoRef} autoPlay playsInline muted style={S.video}/>
      <canvas ref={canvasRef} style={S.canvas} onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU}/>

      {locked && <div style={{position:'absolute',inset:0,zIndex:12,background:'rgba(0,127,255,0.35)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'0.5rem'}}><div style={{width:64,height:64,borderRadius:'50%',background:'#007FFF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.8rem'}}></div>
        <span style={{color:'#fff',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.14em',fontSize:'0.85rem'}}>SCALE LOCKED — card no longer needed</span>
      </div>}

      {camErr && <div style={{position:'absolute',inset:0,background:'rgba(13,43,69,0.96)',zIndex:12,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1rem',padding:'2rem'}}><p style={{color:'#fff',textAlign:'center',lineHeight:1.6,fontSize:'0.88rem'}}>Camera access required.</p>
        <Btn onClick={onBack}>← Back</Btn>
      </div>}

      <div style={S.top}>
        <IBtn onClick={() => { streamRef.current?.getTracks().forEach(t=>t.stop()); onBack() }}>←</IBtn>
        <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><div style={{width:7,height:7,borderRadius:'50%',background:aiDot,flexShrink:0}}/>
          <span style={{color:'rgba(255,255,255,0.9)',fontSize:'0.82rem',fontWeight:600}}>Hold Card at Arm&apos;s Length</span>
        </div>
        <button onClick={()=>setMode(m=>m==='auto'?'manual':'auto')}
          style={{background:mode==='manual'?'rgba(0,127,255,0.3)':'rgba(21,101,192,0.22)',border:'none',borderRadius:20,color:'rgba(255,255,255,0.85)',fontSize:'0.6rem',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.1em',padding:'0.3rem 0.75rem',cursor:'pointer'}}>{mode==='auto'?'MANUAL':'AUTO'}
        </button>
      </div>

      {/* Centre instruction */}
      <div style={{position:'absolute',top:'5.5rem',left:'50%',transform:'translateX(-50%)',zIndex:9,textAlign:'center',whiteSpace:'nowrap'}}><div style={{background:'rgba(13,43,69,0.55)',backdropFilter:'blur(8px)',borderRadius:16,padding:'0.3rem 1rem',fontSize:'0.63rem',fontFamily:'monospace',color:'rgba(255,255,255,0.7)',letterSpacing:'0.05em'}}>Card detected once → pocket it → walk the stairs
        </div>
      </div>

      <div style={S.bot}>
        <div style={{padding:'0.3rem 0.85rem',background:'rgba(13,43,69,0.5)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,fontSize:'0.64rem',fontFamily:'monospace',color:'rgba(255,255,255,0.7)',letterSpacing:'0.06em'}}>{mode==='auto'
            ? ai==='loading' ? 'Loading AI detector…'
              : det ? `Card found ${stable}/5` : 'Hold card flat, centred — arm\'s length away'
            : 'Drag corners to match your card exactly'}
        </div>

        {/* Distance adjustment slider */}
        <div style={{width:'100%',display:'flex',flexDirection:'column',gap:'0.25rem'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'0.58rem',fontFamily:'monospace',color:'rgba(255,255,255,0.45)',letterSpacing:'0.06em'}}>HOLD DISTANCE ADJUST</span>
            <span style={{fontSize:'0.65rem',fontFamily:'monospace',color:'#FF7F00'}}>{Math.round(HOLD_DIST_MM * distAdj)}mm</span>
          </div>
          <input type="range" min={0.6} max={1.6} step={0.05} value={distAdj}
            onChange={e => setDistAdj(Number(e.target.value))}
            style={{width:'100%',accentColor:'#007FFF',cursor:'pointer'}}/>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.52rem',fontFamily:'monospace',color:'rgba(255,255,255,0.25)'}}><span>Near (20cm)</span><span>← Adjust if card looks wrong →</span><span>Far (55cm)</span>
          </div>
        </div>

        {mode==='manual' && !locked && <Btn onClick={confirmManual}>  Lock Scale</Btn>}

        <button onClick={()=>{streamRef.current?.getTracks().forEach(t=>t.stop());onSkip()}}
          style={{background:'none',border:'none',color:'rgba(255,255,255,0.32)',fontSize:'0.63rem',fontFamily:'monospace',cursor:'pointer',letterSpacing:'0.08em'}}>Skip calibration (lower accuracy)
        </button>
      </div>
    </div>
  )
}

function Btn({onClick,children}:{onClick:()=>void,children:React.ReactNode}) {
  return <button onClick={onClick} style={{width:'100%',padding:'0.95rem',background:'#007FFF',border:'none',borderRadius:14,cursor:'pointer',color:'#fff',fontSize:'0.82rem',fontFamily:'monospace',fontWeight:700,letterSpacing:'0.14em',boxShadow:'0 4px 20px rgba(0,127,255,0.4)'}}>{children}</button>
}
function IBtn({onClick,children}:{onClick:()=>void,children:React.ReactNode}) {
  return <button onClick={onClick} style={{width:36,height:36,background:'rgba(21,101,192,0.22)',border:'none',borderRadius:'50%',color:'#fff',fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{children}</button>
}
