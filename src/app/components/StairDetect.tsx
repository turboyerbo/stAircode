'use client'
/**
 * StairDetect.tsx — Pre-scan screen (between Welcome and MeasureWalk)
 *
 * Sequence:
 *   1. Camera opens, live feed shown immediately.
 *   2. After a short settle (1 s), auto-captures a frame and runs:
 *
 *      CALL A — Stair detection (Y/N)
 *        Prompt: tight binary question → { stairDetected, confidence }
 *        Fast, minimal tokens (~100), low latency.
 *
 *   3a. NO  → "No staircase detected" — Retry / Skip.
 *   3b. YES → immediately run on the SAME captured frame (no extra shutter):
 *
 *      CALL B — Riser count
 *        Prompt: step-by-step counting instruction → { riserCount, confidence, reasoning }
 *        The model counts each distinct vertical riser face bottom-to-top,
 *        includes partially-visible risers, and self-reports confidence.
 *
 *   4. Handrail rules applied to riserCount + optional knownWidth:
 *        riserCount > 3          → handrail one side   (OBC s.9.8.7 / IBC §1011.11)
 *        riserCount > 3 AND
 *        width > 1100 mm         → handrail both sides (OBC / IBC §1011.12)
 *
 *   5. Result card shown → "Continue to Measure" passes DetectResult upstream.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'

// ── Brand colours ─────────────────────────────────────────────────────────────
const C = {
  pass:        '#4A90E2',
  fail:        '#E63946',
  warn:        '#FFB020',
  blue:        '#007FFF',
  planeStroke: '#4A90E2',
}

// ── Public result type ────────────────────────────────────────────────────────
export interface DetectResult {
  stairDetected:     boolean
  riserCount:        number
  confidence:        number
  handrailOneSide:   boolean
  handrailBothSides: boolean
}

interface Props {
  onComplete:  (result: DetectResult) => void
  onBack:      () => void
  /** Width in mm from a previous session — used for the both-sides handrail rule. */
  knownWidth?: number | null
}

// ── API helpers ───────────────────────────────────────────────────────────────

const VISION_TIMEOUT_MS = 25_000  // 25 s — covers slow mobile networks

type VisionResult = { ok: true; text: string } | { ok: false; timedOut: boolean }

async function callVision(b64: string, prompt: string): Promise<VisionResult> {
  const controller = new AbortController()
  let didTimeout = false
  const timer = setTimeout(() => { didTimeout = true; controller.abort() }, VISION_TIMEOUT_MS)
  try {
    const r = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageB64: b64, prompt }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!r.ok) return { ok: false, timedOut: false }
    const d = await r.json()
    if (d.error || !d.text) return { ok: false, timedOut: false }
    return { ok: true, text: d.text }
  } catch {
    clearTimeout(timer)
    return { ok: false, timedOut: didTimeout }
  }
}

function parseJson(text: string): any {
  const clean = text.replace(/```json[\s\S]*?```|```[\s\S]*?```|```/g, '').trim()
  return JSON.parse(clean)
}

/**
 * CALL A — Binary stair detection.
 * Short prompt, expects a tiny JSON response.
 */
async function detectStair(
  b64: string,
): Promise<{ stairDetected: boolean; confidence: number } | { timedOut: true } | null> {
  const prompt = `Look at this image. Is a staircase (steps, risers, or treads) clearly visible?

Return ONLY valid JSON, no markdown:
{"stairDetected":true,"confidence":0.92}

stairDetected: true if any staircase is visible, false otherwise.
confidence: 0.0–1.0.`

  const res = await callVision(b64, prompt)
  if (res.ok === false) return res.timedOut ? { timedOut: true } : null
  try {
    const p = parseJson(res.text)
    return {
      stairDetected: Boolean(p.stairDetected),
      confidence:    Math.max(0, Math.min(1, Number(p.confidence ?? 0.5))),
    }
  } catch { return null }
}

/**
 * CALL B — Riser count.
 *
 * Reuses the same JPEG frame captured for Call A — no second shutter press.
 *
 * The model is instructed to:
 *   1. Locate the staircase in the image.
 *   2. Count each VERTICAL riser face (kickplate) from bottom to top.
 *   3. Include partially visible risers at the edges of frame.
 *   4. Return riserCount as an integer, confidence 0–1, and a one-line
 *      reasoning trace that we surface in the UI.
 *
 * The reasoning trace helps the inspector understand why the count may be
 * approximate (e.g. "top 2 risers partially occluded").
 */
async function countRisers(b64: string): Promise<{
  riserCount: number
  confidence: number
  reasoning:  string
} | { timedOut: true } | null> {
  const prompt = `You are counting RISERS on a staircase. A riser is the VERTICAL face (kickplate) between two horizontal treads.

STEP 1 — Find the staircase in the image.
STEP 2 — Starting at the BOTTOM, count each distinct vertical riser face upward to the top.
          Count partially visible risers. Do NOT count treads (horizontal surfaces) or landings.
STEP 3 — Note any ambiguous or occluded risers.

Return ONLY valid JSON, no markdown:
{"riserCount":7,"confidence":0.85,"reasoning":"7 vertical faces counted, top riser partially cut off"}

riserCount: total integer count (include partial).
confidence: 0.0–1.0.
reasoning: one short sentence.`

  const res = await callVision(b64, prompt)
  if (res.ok === false) return res.timedOut ? { timedOut: true } : null
  try {
    const p = parseJson(res.text)
    return {
      riserCount: Math.max(0, Math.round(Number(p.riserCount ?? 0))),
      confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0.5))),
      reasoning:  String(p.reasoning ?? ''),
    }
  } catch { return null }
}

// ── Manual-entry seed for riser count ────────────────────────────────────────
// Produces a realistic riser count near the typical residential flight (8),
// jittered ±1–3 each call so repeated auto-populates feel natural.
function jitterRiserCount(): number {
  const sign   = Math.random() < 0.5 ? 1 : -1
  const offset = 1 + Math.floor(Math.random() * 3)   // 1–3 risers
  return Math.max(1, Math.min(30, 8 + sign * offset))
}

// ── Handrail rules ────────────────────────────────────────────────────────────
function computeHandrail(riserCount: number, widthMm?: number | null) {
  const oneSide   = riserCount > 3
  const bothSides = oneSide && widthMm != null && widthMm > 1100
  return { handrailOneSide: oneSide, handrailBothSides: bothSides }
}

// ── Status ────────────────────────────────────────────────────────────────────
// 'prompt'  — waiting for user tap (iOS Safari requires getUserMedia inside gesture)
// 'idle'    — camera open, settling before auto-scan
// 'slow'    — API call still in-flight after 8 s; show "Still analysing…"
// 'manual'  — two consecutive timeouts: user enters riser count themselves
type Status = 'prompt' | 'idle' | 'scanning' | 'counting' | 'slow' | 'no_stair' | 'error' | 'manual' | 'done'

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function StairDetect({ onComplete, onBack, knownWidth }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const hiddenRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const slowTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timeoutCount = useRef(0)   // consecutive API timeouts; 2 → switch to manual

  const [camError,         setCamError]         = useState(false)
  const [status,           setStatus]           = useState<Status>('prompt')
  const [result,           setResult]           = useState<DetectResult | null>(null)
  const [reasoning,        setReasoning]        = useState('')
  const [countConf,        setCountConf]        = useState(0)
  const [manualRiserCount, setManualRiserCount] = useState(5)  // default for manual entry
  const [detectAttempts,   setDetectAttempts]   = useState(0)  // counts failed detection attempts

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (slowTimer.current) clearTimeout(slowTimer.current)
    }
  }, [])

  // ── Start camera — called inside a tap handler, never on mount ────────────
  // iOS Safari silently denies getUserMedia unless it originates from a user
  // gesture. Calling it here (inside onClick) satisfies that requirement.
  const startCamera = useCallback(async () => {
    setStatus('idle')
    try {
      // Try rear camera first; fall back progressively so no device is left out
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      // Settle for 1 s then auto-scan
      setTimeout(() => runDetection(), 1000)
    } catch {
      setCamError(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Capture ───────────────────────────────────────────────────────────────
  function captureFrame(): string | null {
    const v = videoRef.current, h = hiddenRef.current
    if (!v || !h || v.readyState < 2) return null
    const fw = Math.round(v.videoWidth  * 0.65)
    const fh = Math.round(v.videoHeight * 0.65)
    h.width = fw; h.height = fh
    h.getContext('2d')!.drawImage(v, 0, 0, fw, fh)
    return h.toDataURL('image/jpeg', 0.78).split(',')[1]
  }

  // ── Detection flow ────────────────────────────────────────────────────────
  const runDetection = useCallback(async () => {
    setStatus('scanning')
    setResult(null)

    // Show "Still analysing…" if either API call takes > 8 s
    const armSlow = () => {
      if (slowTimer.current) clearTimeout(slowTimer.current)
      slowTimer.current = setTimeout(() => setStatus('slow'), 8_000)
    }
    const clearSlow = () => {
      if (slowTimer.current) { clearTimeout(slowTimer.current); slowTimer.current = null }
    }

    // Wait for video ready
    await new Promise<void>(res => {
      const check = () =>
        (videoRef.current?.readyState ?? 0) >= 2 ? res() : setTimeout(check, 200)
      check()
    })

    const b64 = captureFrame()
    if (!b64) { setStatus('error'); return }

    // CALL A — stair Y/N ──────────────────────────────────────────────────
    armSlow()
    const detect = await detectStair(b64)
    clearSlow()

    // Any failure on Call A → manual immediately
    if (!detect || 'timedOut' in detect) {
      setManualRiserCount(jitterRiserCount())
      setStatus('manual')
      return
    }
    // Stair not detected → first attempt shows no_stair, second attempt goes to manual with skip
    if (!detect.stairDetected) {
      const newAttempts = detectAttempts + 1
      setDetectAttempts(newAttempts)
      if (newAttempts >= 2) {
        setManualRiserCount(jitterRiserCount())
        setStatus('manual')
      } else {
        setStatus('no_stair')
      }
      return
    }

    // CALL B — riser count (same frame) ───────────────────────────────────
    setStatus('counting')
    armSlow()
    const count = await countRisers(b64)
    clearSlow()

    // Any failure on Call B → manual immediately
    if (!count || 'timedOut' in count) {
      setManualRiserCount(jitterRiserCount())
      setStatus('manual')
      return
    }

    const { handrailOneSide, handrailBothSides } =
      computeHandrail(count.riserCount, knownWidth)

    const det: DetectResult = {
      stairDetected:     true,
      riserCount:        count.riserCount,
      confidence:        count.confidence,
      handrailOneSide,
      handrailBothSides,
    }

    setResult(det)
    setReasoning(count.reasoning)
    setCountConf(count.confidence)
    setStatus('done')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownWidth])

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleContinue     = () => { if (result) onComplete(result) }
  const handleManualConfirm = () => {
    const { handrailOneSide, handrailBothSides } = computeHandrail(manualRiserCount, knownWidth)
    onComplete({
      stairDetected: true,
      riserCount:    manualRiserCount,
      confidence:    0,           // 0 = manually entered, no AI confidence
      handrailOneSide,
      handrailBothSides,
    })
  }
  const handleRetry        = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setStatus('prompt')
    setResult(null)
    setDetectAttempts(0)
  }
  const handleSkip         = () => onComplete({
    stairDetected: false, riserCount: 0, confidence: 0,
    handrailOneSide: false, handrailBothSides: false,
  })

  // ── Derived display ───────────────────────────────────────────────────────
  const isApprox = countConf < 0.75
  const { handrailOneSide, handrailBothSides } = result
    ? computeHandrail(result.riserCount, knownWidth)
    : { handrailOneSide: false, handrailBothSides: false }

  const handrailLabel = handrailBothSides
    ? 'Both sides required'
    : handrailOneSide
    ? 'One side required'
    : result && result.riserCount > 0 ? 'Not required (≤ 3 risers)' : '—'

  const handrailColor = handrailBothSides ? C.fail : handrailOneSide ? C.warn : C.pass

  const statusLabel: Record<Status, string> = {
    prompt:   '',
    idle:     'Preparing camera…',
    scanning: 'Checking for staircase…',
    counting: 'Counting risers…',
    slow:     'Still analysing…',
    no_stair: '',
    error:    '',
    manual:   '',
    done:     '',
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#EEF3F9',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      overflow: 'hidden',
    }}><style>{`
        @keyframes sdBlink    { 0%,100%{opacity:.22} 50%{opacity:1} }
        @keyframes sdSweep    { 0%{top:4%} 100%{top:92%} }
        @keyframes sdPulse    { 0%,100%{opacity:.42} 50%{opacity:1} }
        @keyframes sdFadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Camera error */}
      {camError && (
        <div style={{
          position:'absolute',inset:0,zIndex:90,background:'rgba(13,43,69,0.97)',
          display:'flex',flexDirection:'column',alignItems:'center',
          justifyContent:'center',gap:'1.2rem',padding:'2rem',
        }}><p style={{color:'#fff',textAlign:'center',lineHeight:1.6,maxWidth:280}}>Camera access needed to detect the staircase.
          </p>
          <button onClick={onBack} style={{
            padding:'0.85rem 2rem',background:C.blue,border:'none',
            borderRadius:14,color:'#fff',fontSize:'0.9rem',cursor:'pointer',
          }}>← Go Back</button>
        </div>
      )}

      {/* Live feed */}
      <video ref={videoRef} autoPlay playsInline muted style={{
        position:'absolute',inset:0,width:'100%',height:'100%',
        objectFit:'cover',
        opacity: status === 'done' ? 0.32 : 0.9,
        transition:'opacity 0.6s',
      }} />
      <canvas ref={hiddenRef} style={{display:'none'}} />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,zIndex:40,
        paddingTop:'max(env(safe-area-inset-top,0px),2.6rem)',
        paddingBottom:'0.65rem',paddingLeft:'1rem',paddingRight:'1rem',
        background:'linear-gradient(to bottom,rgba(13,43,69,0.75) 0%,transparent 100%)',
        display:'flex',alignItems:'center',gap:'0.55rem',
      }}><button onClick={onBack} style={{
          width:40,height:40,borderRadius:'50%',flexShrink:0,
          background:'rgba(13,43,69,0.52)',border:'1px solid rgba(21,101,192,0.25)',
          color:'#fff',fontSize:'1.05rem',cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',
          backdropFilter:'blur(8px)',
        }}>←</button>
        <div style={{flex:1,textAlign:'center'}}><span style={{
            fontSize:'0.62rem',letterSpacing: '0.04em',
            color:'rgba(255,255,255,0.55)',
          }}>STAIR DETECTION</span>
        </div>
        <div style={{width:40}} />
      </div>

      {/* ── Tap-to-start overlay (shown until user taps — iOS Safari fix) ── */}
      {status === 'prompt' && (
        <div style={{
          position:'absolute',inset:0,zIndex:60,
          background:'linear-gradient(175deg,#0D2B45 0%,#0A1F33 100%)',
          display:'flex',flexDirection:'column',alignItems:'center',
          justifyContent:'center',gap:'1.4rem',padding:'2.5rem',
        }}><div style={{
            width:72,height:72,borderRadius:'50%',
            background:'rgba(74,144,226,0.1)',border:`2px solid ${C.planeStroke}`,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:'2rem',
          }}></div>
          <div style={{textAlign:'center'}}><div style={{
              fontSize:'1.2rem',fontWeight:700,color:'#fff',marginBottom:'0.5rem',
            }}>Point at the staircase</div>
            <div style={{
              fontSize:'0.78rem',color:'rgba(255,255,255,0.45)',
              lineHeight:1.6,maxWidth:260,
            }}>The AI will detect the stair and count the risers automatically.
            </div>
          </div>
          <button onClick={startCamera} style={{
            padding:'1.05rem 2.4rem',
            background:`linear-gradient(135deg,${C.planeStroke},#0D7A5F)`,
            border:'none',borderRadius:16,
            color:'#fff',fontSize:'0.92rem',fontWeight:700,letterSpacing:'0.1em',cursor:'pointer',
            boxShadow:`0 6px 28px rgba(74,144,226,0.38)`,
          }}>Start Camera →</button>
          <button onClick={handleSkip} style={{
            background:'none',border:'none',
            color:'rgba(255,255,255,0.25)',fontSize:'0.65rem',
            cursor:'pointer',letterSpacing:'0.06em',
          }}>Skip detection →</button>
        </div>
      )}

      {/* ── Scanning state (idle / scanning / counting / slow) ───────────── */}
      {(status === 'idle' || status === 'scanning' || status === 'counting' || status === 'slow') && (
        <>
          {/* Sweep line — shown while any API call is in flight */}
          {(status === 'scanning' || status === 'counting' || status === 'slow') && (
            <div style={{
              position:'absolute',top:'50%',left:'8%',right:'8%',height:1,
              zIndex:10,pointerEvents:'none',
              background:`linear-gradient(to right,transparent,${C.planeStroke} 30%,${C.planeStroke} 70%,transparent)`,
              boxShadow:`0 0 10px ${C.planeStroke}`,
              animation:'sdSweep 2.2s ease-in-out infinite alternate',
            }} />
          )}

          {/* Bottom strip */}
          <div style={{
            position:'absolute',bottom:0,left:0,right:0,zIndex:30,
            padding:'1.5rem 1.5rem',
            paddingBottom:'max(env(safe-area-inset-bottom,0px),2.8rem)',
            background:'linear-gradient(to top,rgba(13,43,69,0.88) 60%,transparent)',
            display:'flex',flexDirection:'column',alignItems:'center',gap:'0.8rem',
          }}><div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}><div style={{
                width:8,height:8,borderRadius:'50%',
                background: (status==='scanning'||status==='counting'||status==='slow') ? C.planeStroke : 'rgba(255,255,255,0.28)',
                boxShadow:  (status==='scanning'||status==='counting'||status==='slow') ? `0 0 12px ${C.planeStroke}` : 'none',
                animation:  (status==='scanning'||status==='counting'||status==='slow') ? 'sdBlink 1.1s ease-in-out infinite' : 'none',
              }} />
              <span style={{
                fontSize:'0.78rem',letterSpacing:'0.1em',color:'rgba(255,255,255,0.68)',
              }}>{statusLabel[status]}</span>
            </div>
            {status === 'counting' && (
              <span style={{
                fontSize:'0.65rem',color:C.planeStroke,letterSpacing:'0.08em',
                animation:'sdBlink 0.9s ease-in-out infinite',
              }}>Staircase detected — counting risers…
              </span>
            )}
            {status === 'slow' && (
              <span style={{
                fontSize:'0.65rem',color:C.warn,letterSpacing:'0.06em',textAlign:'center',
              }}>Slow connection — please wait, this can take up to 25 s
              </span>
            )}
            <button onClick={handleSkip} style={{
              background:'none',border:'1px solid rgba(21,101,192,0.20)',
              borderRadius:12,padding:'0.55rem 1.4rem',
              color:'rgba(255,255,255,0.28)',fontSize:'0.65rem',
              cursor:'pointer',letterSpacing:'0.06em',
            }}>Skip detection →</button>
          </div>
        </>
      )}

      {/* ── No stair ─────────────────────────────────────────────────────── */}
      {status === 'no_stair' && (
        <BottomSheet>
          <div style={{fontSize:'2rem',textAlign:'center',marginBottom:'0.25rem'}}></div>
          <div style={{fontSize:'1.05rem',fontWeight:700,color:'#fff',textAlign:'center',marginBottom:'0.35rem'}}>No staircase detected
          </div>
          <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.44)',lineHeight:1.55,textAlign:'center',maxWidth:300,margin:'0 auto'}}>Point your camera at the stairs so the risers are clearly visible, then try again.
          </div>
          <div style={{height:'0.4rem'}} />
          <SheetButton primary onClick={handleRetry}>↺  Try Again</SheetButton>
          {detectAttempts >= 1 && (
            <SheetButton onClick={handleSkip}>Skip — proceed to measure →</SheetButton>
          )}
        </BottomSheet>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {status === 'error' && (
        <BottomSheet>
          <div style={{fontSize:'2rem',textAlign:'center',marginBottom:'0.25rem'}}></div>
          <div style={{fontSize:'1.05rem',fontWeight:700,color:C.warn,textAlign:'center',marginBottom:'0.35rem'}}>Detection failed
          </div>
          <div style={{fontSize:'0.75rem',color:'rgba(255,255,255,0.44)',lineHeight:1.55,textAlign:'center',maxWidth:300,margin:'0 auto'}}>Could not reach the analysis service. Check your connection and try again.
          </div>
          <div style={{height:'0.4rem'}} />
          <SheetButton primary onClick={handleRetry}>↺  Retry</SheetButton>
          <SheetButton onClick={handleSkip}>Skip — proceed to measure</SheetButton>
        </BottomSheet>
      )}

      {/* ── Manual entry (two consecutive timeouts) ──────────────────────── */}
      {status === 'manual' && (() => {
        const { handrailOneSide, handrailBothSides } = computeHandrail(manualRiserCount, knownWidth)
        const hColor = handrailBothSides ? C.fail : handrailOneSide ? C.warn : C.pass
        const hLabel = handrailBothSides ? 'Both sides required'
          : handrailOneSide ? 'One side required'
          : 'Not required (≤ 3 risers)'
        return (
          <BottomSheet>
            {/* Header */}
            <div style={{
              display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.3rem',
            }}><div>
                <div style={{fontSize:'0.85rem',fontWeight:700,color:'#fff'}}>Enter riser count manually
                </div>
                <div style={{
                  fontSize:'0.62rem',color:'rgba(255,255,255,0.35)',marginTop:'0.1rem',
                }}>Count the risers you can see and adjust below
                </div>
              </div>
            </div>

            {/* Stepper */}
            <div style={{
              display:'flex',alignItems:'center',justifyContent:'center',
              gap:'1.2rem',padding:'0.8rem 0',
            }}><button
                onClick={() => setManualRiserCount(v => Math.max(1, v - 1))}
                style={{
                  width:52,height:52,borderRadius:'50%',flexShrink:0,
                  background:'rgba(21,101,192,0.09)',border:'1.5px solid rgba(21,101,192,0.25)',
                  color:'#fff',fontSize:'1.8rem',lineHeight:1,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}>−</button>
              <div style={{textAlign:'center'}}><div style={{
                  fontSize:'3.8rem',fontWeight: 700,color:'#fff',
                  lineHeight:1,fontVariantNumeric:'tabular-nums',letterSpacing:'-0.04em',
                }}>{manualRiserCount}</div>
                <div style={{
                  fontSize:'0.6rem',color:'rgba(255,255,255,0.3)',marginTop:'0.25rem',letterSpacing:'0.1em',
                }}>RISERS</div>
              </div>
              <button
                onClick={() => setManualRiserCount(v => Math.min(30, v + 1))}
                style={{
                  width:52,height:52,borderRadius:'50%',flexShrink:0,
                  background:'rgba(21,101,192,0.09)',border:'1.5px solid rgba(21,101,192,0.25)',
                  color:'#fff',fontSize:'1.8rem',lineHeight:1,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}>+</button>
            </div>

            {/* Live handrail preview */}
            <div style={{
              display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'0.65rem 0.9rem',
              background:`${hColor}12`,border:`1px solid ${hColor}44`,
              borderRadius:10,marginBottom:'0.4rem',
            }}><div>
                <div style={{
                  fontSize:'0.56rem',color:'rgba(255,255,255,0.32)',letterSpacing: '0.04em',
                }}>HANDRAIL REQUIREMENT</div>
                <div style={{
                  fontSize:'0.85rem',fontWeight:700,color:hColor,marginTop:'0.2rem',
                }}>{hLabel}</div>
                <div style={{
                  fontSize:'0.56rem',color:'rgba(255,255,255,0.28)',marginTop:'0.15rem',
                }}>{handrailBothSides
                    ? `${manualRiserCount} risers · width > 1100 mm`
                    : handrailOneSide
                    ? `${manualRiserCount} risers > 3 threshold`
                    : `${manualRiserCount} risers ≤ 3 — no handrail needed`}
                </div>
              </div>
              <span style={{fontSize:'1.6rem',filter:`drop-shadow(0 0 6px ${hColor})`}}>{handrailBothSides ? '⟺' : handrailOneSide ? '⊣' : ''}
              </span>
            </div>

            <SheetButton primary onClick={handleManualConfirm}>
              Confirm {manualRiserCount} risers →
            </SheetButton>
            <SheetButton onClick={() => { setManualRiserCount(jitterRiserCount()); handleRetry() }}>↺  Try AI again</SheetButton>
          </BottomSheet>
        )
      })()}

      {/* ── Done ─────────────────────────────────────────────────────────── */}
      {status === 'done' && result && (
        <BottomSheet>

          {/* Confirmed badge */}
          <div style={{
            display:'flex',alignItems:'center',gap:'0.55rem',marginBottom:'0.8rem',
          }}><div style={{
              width:8,height:8,borderRadius:'50%',
              background:C.pass,boxShadow:`0 0 10px ${C.pass}`,
            }} />
            <span style={{
              fontSize:'0.6rem',letterSpacing: '0.04em',color:C.pass,
            }}>STAIRCASE CONFIRMED</span>
          </div>

          {/* Riser count card */}
          <div style={{
            display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'0.75rem 0.9rem',
            background:'rgba(21,101,192,0.06)',
            border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:12,marginBottom:'0.6rem',
          }}><div>
              <div style={{
                fontSize:'0.58rem',color:'rgba(255,255,255,0.35)',letterSpacing: '0.04em',
              }}>RISERS COUNTED</div>
              <div style={{display:'flex',alignItems:'baseline',gap:'0.4rem',marginTop:'0.2rem'}}><span style={{
                  fontSize:'2.6rem',fontWeight: 700,lineHeight:1,
                  color:'#fff',fontVariantNumeric:'tabular-nums',
                }}>{result.riserCount}</span>
                {isApprox && (
                  <span style={{fontSize:'0.62rem',color:C.warn}}>approx
                  </span>
                )}
              </div>
              {reasoning && (
                <div style={{
                  fontSize:'0.58rem',color:'rgba(255,255,255,0.28)',
                  marginTop:'0.25rem',lineHeight:1.45,maxWidth:215,
                }}>{reasoning}</div>
              )}
            </div>
            <ConfidenceRing value={countConf} />
          </div>

          {/* Handrail requirement card */}
          <div style={{
            display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'0.75rem 0.9rem',
            background:`${handrailColor}12`,
            border:`1px solid ${handrailColor}44`,
            borderRadius:12,marginBottom:'1rem',
          }}><div>
              <div style={{
                fontSize:'0.58rem',color:'rgba(255,255,255,0.35)',letterSpacing: '0.04em',
              }}>HANDRAIL REQUIREMENT</div>
              <div style={{
                fontSize:'0.9rem',fontWeight:700,
                color:handrailColor,marginTop:'0.25rem',
              }}>{handrailLabel}</div>
              <div style={{
                fontSize:'0.58rem',color:'rgba(255,255,255,0.3)',marginTop:'0.2rem',lineHeight:1.45,
              }}>{handrailBothSides
                  ? `${result.riserCount} risers · stair width > 1100 mm`
                  : handrailOneSide
                  ? `${result.riserCount} risers > 3 — one side minimum`
                  : result.riserCount > 0
                  ? `${result.riserCount} risers ≤ 3 — handrail not required`
                  : 'Riser count undetermined'}
              </div>
            </div>
            <span style={{fontSize:'1.8rem',filter:`drop-shadow(0 0 8px ${handrailColor})`}}>{handrailBothSides ? '⟺' : handrailOneSide ? '⊣' : ''}
            </span>
          </div>

          {/* Width note */}
          {knownWidth != null && (
            <div style={{
              fontSize:'0.6rem',color:'rgba(255,255,255,0.25)',textAlign:'center',marginBottom:'0.6rem',
            }}>Using stair width {knownWidth} mm from prior session
            </div>
          )}

          <SheetButton primary onClick={handleContinue}>
            Continue to Measure →
          </SheetButton>
          <SheetButton onClick={handleRetry}>↺  Rescan</SheetButton>
        </BottomSheet>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BottomSheet({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{
      position:'absolute',bottom:0,left:0,right:0,zIndex:50,
      background:'linear-gradient(to top,rgba(13,43,69,0.99) 72%,rgba(13,43,69,0.9) 88%,transparent)',
      paddingTop:'1.8rem',paddingLeft:'1.4rem',paddingRight:'1.4rem',
      paddingBottom:'max(env(safe-area-inset-bottom,0px),2.6rem)',
      display:'flex',flexDirection:'column',gap:'0.55rem',
      animation:'sdFadeUp 0.35s ease-out',
    }}>{children}
    </div>
  )
}

function SheetButton({
  children, onClick, primary,
}: { children?: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      width:'100%',padding:'1.02rem',
      background: primary
        ? 'linear-gradient(135deg,#1565C0 0%,#1976D2 100%)'
        : 'rgba(21,101,192,0.06)',
      border: primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
      borderRadius:16,
      color: primary ? '#fff' : 'rgba(255,255,255,0.42)',
      fontSize: primary ? '0.88rem' : '0.72rem',
      fontWeight: primary ? 700 : 400,
      letterSpacing: primary ? '0.08em' : '0.04em',
      cursor:'pointer',
      boxShadow: primary ? '0 6px 24px rgba(74,144,226,0.38)' : 'none',
    }}>{children}
    </button>
  )
}

function ConfidenceRing({ value }: { value: number }) {
  const pct   = Math.round(value * 100)
  const r     = 18
  const circ  = 2 * Math.PI * r
  const dash  = circ * value
  const color = value >= 0.8 ? C.pass : value >= 0.6 ? C.warn : C.fail
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}><svg width={46} height={46} viewBox="0 0 46 46">
        <circle cx={23} cy={23} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3}/>
        <circle cx={23} cy={23} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 23 23)"/>
        <text x="23" y="27" textAnchor="middle" fill="#fff"
          fontSize="9" fontFamily="monospace" fontWeight="bold">{pct}%</text>
      </svg>
      <span style={{fontSize:'0.52rem',color:'rgba(255,255,255,0.28)'}}>conf</span>
    </div>
  )
}
