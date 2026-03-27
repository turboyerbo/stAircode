'use client'
/**
 * ARSession.tsx — ARAI_10
 *
 * Manages the WebXR immersive-AR session lifecycle.
 * Handles: session request, plane detection events, hit-test, end/error.
 *
 * Exposes a clean onMeasureComplete(primaryMm, secondaryMm?) callback
 * so MeasureWalk.tsx can use it identically to the AI fallback path.
 *
 * Device support:
 *   ✅ Android Chrome 81+ (ARCore)
 *   ⚠️  iOS Safari 15.4+ (ARKit — plane detection behind flag on some versions)
 *   ❌  iOS Chrome, desktop — triggers onError() → AI fallback
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import React from 'react'
import {
  pickBestPlane,
  extractMeasurement,
  planeConfidence,
  polygonToMm,
} from '@/lib/xr-measure'

export interface ARMeasureProps {
  stepId: 'rise' | 'run' | 'width' | 'guard' | 'nosing' | 'headroom'
  onMeasureComplete: (primaryMm: number, secondaryMm?: number) => void
  onError: () => void
  onBack: () => void
  stepColor?: string
  stepLabel?: string
}

type SessionState = 'requesting' | 'active' | 'ended' | 'error'
type PlaneMode    = 'riser' | 'tread' | 'width'

const STEP_TO_MODE: Record<string, PlaneMode> = {
  rise:     'riser',
  run:      'tread',
  width:    'width',
  guard:    'riser',  // handrail measured same orientation as riser face
  nosing:   'tread',
  headroom: 'riser',
}

const MODE_HINT: Record<PlaneMode, string> = {
  riser: 'Point at the vertical face of a step',
  tread: 'Point straight down at the step surface',
  width: 'Step back so both sides of the stair are visible',
}

export default function ARSession({
  stepId,
  onMeasureComplete,
  onError,
  onBack,
  stepColor = '#4A90E2',
  stepLabel = 'Measurement',
}: ARMeasureProps) {
  const sessionRef    = useRef<XRSession | null>(null)
  const planesRef     = useRef<Set<XRPlane>>(new Set())
  const overlayRef    = useRef<HTMLDivElement>(null)
  const lockedRef     = useRef(false)

  const [sessionState, setSessionState] = useState<SessionState>('requesting')
  const [hint,         setHint]         = useState('')
  const [lockedMm,     setLockedMm]     = useState<number | null>(null)
  const [confidence,   setConfidence]   = useState<'high' | 'medium' | 'low'>('low')
  const [frameCount,   setFrameCount]   = useState(0)

  const mode = STEP_TO_MODE[stepId] ?? 'riser'

  // ── Start XR session ────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (!navigator.xr) { onError(); return }

    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar')
      if (!supported) { onError(); return }

      // @ts-ignore — plane-detection and dom-overlay not yet in all TS XR type defs
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'plane-detection'],
        optionalFeatures: ['dom-overlay'],
        // @ts-ignore — dom-overlay element not yet in all TS types
        domOverlay: overlayRef.current ? { root: overlayRef.current } : undefined,
      })

      sessionRef.current = session
      setSessionState('active')
      setHint(MODE_HINT[mode])

      // ── Plane detection listener ───────────────────────────────────────────
      session.addEventListener('planesdetected', (event: any) => {
        if (lockedRef.current) return

        const planes: XRPlane[] = Array.from(event.planes as Set<XRPlane>)
        planesRef.current = new Set(planes)

        const best = pickBestPlane(planes, mode)
        if (!best) return

        const mm = extractMeasurement(best, mode)
        const conf = planeConfidence(
          Array.from(best.polygon),
          80, 2200, mm
        )

        setLockedMm(mm)
        setConfidence(conf)
        setFrameCount(c => c + 1)

        if (conf === 'high') {
          setHint(`Locked — ${stepLabel}: ${mm}mm`)
        } else if (conf === 'medium') {
          setHint(`Measuring… ${mm}mm — hold steady`)
        } else {
          setHint(MODE_HINT[mode])
        }
      })

      // @ts-ignore — 'end' is a valid XRSession event, type defs may lag
      session.addEventListener('end', () => {
        setSessionState('ended')
      })

    } catch (err) {
      console.warn('[ARSession] Failed to start:', err)
      onError()
    }
  }, [mode, onError, stepLabel])

  useEffect(() => {
    startSession()
    return () => {
      sessionRef.current?.end().catch(() => {})
    }
  }, [startSession])

  // ── Confirm measurement ─────────────────────────────────────────────────────
  function confirmMeasurement() {
    if (!lockedMm || lockedRef.current) return
    lockedRef.current = true

    // For tread mode, attempt to capture width as secondary from width-spanning planes
    let secondaryMm: number | undefined
    if (mode === 'tread') {
      const widthPlane = pickBestPlane(Array.from(planesRef.current), 'width')
      if (widthPlane) {
        const { w, h } = polygonToMm(Array.from(widthPlane.polygon))
        const candidate = Math.max(w, h)
        if (candidate >= 600 && candidate <= 2200) secondaryMm = candidate
      }
    }

    sessionRef.current?.end().catch(() => {})
    onMeasureComplete(lockedMm, secondaryMm)
  }

  function handleBack() {
    sessionRef.current?.end().catch(() => {})
    onBack()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (sessionState === 'requesting') {
    return (
      <div style={styles.overlay}>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={styles.card}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', letterSpacing: '0.15em', color: stepColor, marginBottom: '0.6rem' }}>
            STARTING AR SESSION
          </div>
          <div style={styles.spinner(stepColor)} />
          <p style={styles.hint}>Requesting camera + AR access…</p>
        </div>
      </div>
    )
  }

  if (sessionState === 'error') {
    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📡</div>
          <p style={styles.hint}>AR not available on this device</p>
          <button onClick={onError} style={styles.btn(stepColor)}>Use AI instead</button>
        </div>
      </div>
    )
  }

  return (
    <div ref={overlayRef} style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <button onClick={handleBack} style={styles.iconBtn}>←</button>
        <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', letterSpacing: '0.16em', color: stepColor }}>
          {stepLabel.toUpperCase()} — AR MODE
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Hint bubble */}
      <div style={styles.hintBubble}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff', lineHeight: 1.45 }}>{hint}</p>
      </div>

      {/* Plane scan ring */}
      {frameCount > 0 && (
        <div style={styles.scanRing(stepColor, confidence)} />
      )}

      {/* Bottom tray */}
      <div style={styles.bottomTray}>
        {lockedMm ? (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>
                {lockedMm}
              </div>
              <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>mm</div>
            </div>
            <div style={{ display: 'flex', gap: '0.7rem', width: '100%', maxWidth: 320 }}>
              <button onClick={handleBack} style={styles.secondaryBtn}>
                ↺ Rescan
              </button>
              <button
                onClick={confirmMeasurement}
                disabled={confidence === 'low'}
                style={styles.btn(stepColor)}
              >
                ✓ Confirm
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', textAlign: 'center', fontFamily: 'monospace' }}>
            {MODE_HINT[mode]}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Inline styles ──────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 60,
    background: 'rgba(10,25,41,0.92)', backdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    background: 'rgba(13,43,69,0.9)', border: '1px solid rgba(21,101,192,0.25)',
    borderRadius: 20, padding: '2rem', textAlign: 'center' as const,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1rem',
    maxWidth: 300,
  },
  spinner: (color: string): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: '50%',
    border: `3px solid rgba(255,255,255,0.1)`,
    borderTop: `3px solid ${color}`,
    animation: 'spin 0.9s linear infinite',
  }),
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', margin: 0, lineHeight: 1.55 } as React.CSSProperties,
  btn: (color: string): React.CSSProperties => ({
    flex: 2, padding: '0.9rem', background: `linear-gradient(135deg,${color},#1565C0)`,
    border: 'none', borderRadius: 14, color: '#fff', fontSize: '0.9rem',
    fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em',
    boxShadow: `0 4px 20px ${color}55`,
  }),
  secondaryBtn: {
    flex: 1, padding: '0.9rem', background: 'rgba(21,101,192,0.12)',
    border: '1px solid rgba(21,101,192,0.3)', borderRadius: 14, color: 'rgba(255,255,255,0.6)',
    fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'monospace',
  } as React.CSSProperties,
  topBar: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, zIndex: 70,
    paddingTop: 'max(env(safe-area-inset-top,0px),2.4rem)',
    paddingBottom: '0.6rem', paddingLeft: '1rem', paddingRight: '1rem',
    background: 'linear-gradient(to bottom,rgba(10,25,41,0.7),transparent)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: '50%',
    background: 'rgba(13,43,69,0.5)', border: '1px solid rgba(21,101,192,0.3)',
    color: '#fff', fontSize: '1rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  } as React.CSSProperties,
  hintBubble: {
    position: 'absolute' as const, bottom: 180, left: '1.2rem', right: '1.2rem', zIndex: 70,
    background: 'rgba(13,43,69,0.85)', border: '1px solid rgba(21,101,192,0.25)',
    borderRadius: 16, padding: '0.9rem 1.1rem', backdropFilter: 'blur(12px)',
    textAlign: 'center' as const,
  },
  scanRing: (color: string, conf: 'high' | 'medium' | 'low'): React.CSSProperties => ({
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)',
    width: conf === 'high' ? 120 : 80,
    height: conf === 'high' ? 120 : 80,
    borderRadius: '50%',
    border: `2px solid ${conf === 'high' ? color : 'rgba(255,255,255,0.25)'}`,
    boxShadow: conf === 'high' ? `0 0 24px ${color}55` : 'none',
    transition: 'all 0.4s ease',
    pointerEvents: 'none',
  }),
  bottomTray: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0, zIndex: 70,
    background: 'linear-gradient(to top,rgba(10,25,41,0.98) 65%,transparent)',
    paddingTop: '2rem', paddingLeft: '1.4rem', paddingRight: '1.4rem',
    paddingBottom: 'max(env(safe-area-inset-bottom,0px),2.4rem)',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1rem',
  },
}
