/**
 * AngleGuidanceOverlay.tsx
 *
 * Real-time guidance overlay shown during scan positioning.
 * Shows phone orientation quality and directs user to correct angle.
 *
 * Place inside the camera view container (position: relative parent):
 *   <AngleGuidanceOverlay mode="riser" isActive={stage === 'position'} />
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import type { MeasurementMode, PoseQuality } from '@/lib/pose-validator'

interface Props {
  mode:       MeasurementMode
  isActive:   boolean
  /** Called when angle is good enough to capture */
  onReady?:   (quality: PoseQuality) => void
}

const MODE_IDEAL: Record<MeasurementMode, string> = {
  riser:    'Face the riser straight-on — phone vertical, parallel to the step face',
  tread:    'Hold phone directly above the tread, pointing straight down',
  width:    'Stand at the bottom, point phone across the full stair width',
  handrail: 'Frame from tread nosing to the top of the rail in one shot',
  headroom: 'Point phone upward toward the ceiling/soffit above the stair',
}

const MODE_ICON: Record<MeasurementMode, string> = {
  riser: '↕', tread: '↔', width: '⟺', handrail: '⊤', headroom: '⇳',
}

export default function AngleGuidanceOverlay({ mode, isActive, onReady }: Props) {
  const [beta,   setBeta]   = useState<number | null>(null)
  const [gamma,  setGamma]  = useState<number | null>(null)
  const [quality, setQuality] = useState<PoseQuality | null>(null)
  const readyFiredRef = useRef(false)

  useEffect(() => {
    if (!isActive) {
      readyFiredRef.current = false
      return
    }

    const handler = (e: DeviceOrientationEvent) => {
      setBeta(e.beta)
      setGamma(e.gamma)
    }

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handler)
    }
    return () => window.removeEventListener('deviceorientation', handler)
  }, [isActive])

  useEffect(() => {
    if (!isActive || beta == null) return

    // Compute quality score based on mode and device orientation
    const { angleDeg, guidance, score, acceptable } = computeQuality(mode, beta, gamma ?? 0)
    const q: PoseQuality = {
      score, angleDeg, acceptable, guidance,
      correction: 'none', correctionFactor: 1.0,
    }
    setQuality(q)

    if (acceptable && !readyFiredRef.current) {
      readyFiredRef.current = true
      onReady?.(q)
    }
    if (!acceptable) readyFiredRef.current = false
  }, [beta, gamma, mode, isActive, onReady])

  if (!isActive || quality == null) return null

  const { score, guidance, acceptable } = quality
  const color = score > 0.85 ? '#4ade80' : score > 0.6 ? '#F29337' : '#ff6b6b'
  const barW  = Math.round(score * 100)

  return (
    <div style={{
      position:   'absolute',
      top:        52,
      left:       12,
      right:      12,
      zIndex:     25,
      background: 'rgba(8,16,35,0.88)',
      border:     `1px solid ${color}55`,
      borderRadius: 10,
      padding:    '8px 12px',
      backdropFilter: 'blur(8px)',
      pointerEvents: 'none',
    }}>{/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}><span style={{ fontSize: 14, color }}>{MODE_ICON[mode]}</span>
        <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{acceptable ? ' ANGLE OK — HOLD STILL' : 'ADJUST ANGLE'}
        </span>
        <div style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>{Math.round(score * 100)}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}><div style={{
          height: '100%', width: `${barW}%`,
          background: `linear-gradient(to right, #ff6b6b, ${color})`,
          borderRadius: 2,
          transition: 'width 0.15s, background 0.15s',
        }} />
      </div>

      {/* Guidance text */}
      {!acceptable && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{guidance}
        </div>
      )}

      {/* Ideal position reminder */}
      {acceptable && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, fontStyle: 'italic' }}>{MODE_IDEAL[mode]}
        </div>
      )}
    </div>
  )
}

// ── Compute orientation quality from DeviceOrientationEvent ───────────────────
function computeQuality(
  mode: MeasurementMode,
  beta: number,
  gamma: number
): { angleDeg: number; score: number; acceptable: boolean; guidance: string } {
  let angleDeg = 0
  let guidance = ''

  switch (mode) {
    case 'riser': {
      // Ideal: beta ≈ 90 (phone vertical, facing forward)
      // beta = 90 means the phone back is parallel to the ground = perfectly upright
      const idealBeta = 90
      angleDeg = Math.abs(beta - idealBeta)
      const gammaOff = Math.abs(gamma)   // left-right tilt should be 0
      const totalOff = Math.sqrt(angleDeg * angleDeg + gammaOff * gammaOff)
      angleDeg = totalOff
      guidance = totalOff > 20
        ? beta < 70 ? 'Tilt phone upward — face it toward the riser'
          : beta > 110 ? 'Tilt phone downward slightly'
          : gamma > 15 ? 'Rotate phone to the right'
          : gamma < -15 ? 'Rotate phone to the left'
          : 'Straighten the phone'
        : totalOff > 10 ? `Almost there — fine-tune angle (${Math.round(totalOff)}° off)`
        : ' Good angle'
      break
    }
    case 'tread': {
      // Ideal: beta ≈ 0 (phone flat, pointing straight down)
      angleDeg = Math.abs(beta)
      guidance = angleDeg > 20
        ? 'Hold phone flat above the tread, camera pointing straight down'
        : angleDeg > 10 ? 'Flatten phone a little more'
        : ' Good angle'
      break
    }
    case 'width':
    case 'handrail':
    case 'headroom': {
      // More forgiving — just check for extreme tilt
      angleDeg = Math.abs(gamma)
      guidance = angleDeg > 25
        ? 'Level the phone horizontally'
        : ' Good angle'
      break
    }
  }

  const maxTol = mode === 'riser' ? 15 : mode === 'tread' ? 12 : 25
  const acceptable = angleDeg <= maxTol
  const score = Math.max(0, 1 - angleDeg / 90)

  return { angleDeg, score, acceptable, guidance }
}
