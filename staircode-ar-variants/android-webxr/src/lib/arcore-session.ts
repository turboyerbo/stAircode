/**
 * arcore-session.ts — Android WebXR + ARCore measurement engine
 *
 * This module replaces the AI Vision fallback with real WebXR plane detection
 * when running as a TWA (Trusted Web Activity) on Android with ARCore.
 *
 * Requirements:
 *   - Chrome for Android 81+
 *   - ARCore installed and supported on device
 *   - HTTPS context (staircode.app qualifies)
 *   - 'immersive-ar' WebXR session with plane-detection feature
 *
 * Integration:
 *   Import ARCoreSession in ScanReadyScreen.
 *   When arSupported === true, use measureWithARCore() instead of callVision().
 */

export type ARMeasurementMode = 'riser' | 'tread' | 'width' | 'handrail' | 'headroom'

export interface ARMeasurement {
  estimatedMm: number
  confidence:  number   // 0.0–1.0
  method:      'arcore-plane' | 'arcore-hittest' | 'arcore-depth'
  message:     string
}

// ── Session state ─────────────────────────────────────────────────────────────
let xrSession:    XRSession | null = null
let xrRefSpace:   XRReferenceSpace | null = null
let detectedPlanes: XRPlane[] = []

/**
 * Request an ARCore WebXR session.
 * Must be called in response to a user gesture (e.g. button tap).
 */
export async function startARSession(overlayElement: HTMLElement): Promise<boolean> {
  if (!navigator.xr) return false

  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['plane-detection', 'hit-test'],
      optionalFeatures: ['depth-sensing', 'dom-overlay', 'anchors'],
      domOverlay:        { root: overlayElement },
    } as any)

    xrRefSpace = await (xrSession as any).requestReferenceSpace('local-floor')

    // Listen for plane detection events
    xrSession.addEventListener('planesdetected', (e: any) => {
      detectedPlanes = Array.from(e.planes as Set<XRPlane>)
    })

    xrSession.addEventListener('end', () => {
      xrSession     = null
      xrRefSpace    = null
      detectedPlanes = []
    })

    return true
  } catch (err) {
    console.warn('[ARCore] Session request failed:', err)
    return false
  }
}

export async function stopARSession(): Promise<void> {
  if (xrSession) {
    try { await xrSession.end() } catch {}
    xrSession = null
  }
}

/**
 * Measure a stair dimension using detected ARCore planes.
 *
 * Strategy per measurement:
 *   riser   — find vertical plane facing camera, measure height
 *   tread   — find horizontal plane at foot level, measure depth  
 *   width   — find two vertical planes on left/right, measure separation
 *   handrail — find vertical plane + hit-test at rail height
 *   headroom — find highest horizontal plane above user head
 */
export async function measureWithARCore(
  mode:        ARMeasurementMode,
  priorResults: Record<string, number | string>
): Promise<ARMeasurement | null> {

  if (!xrSession || detectedPlanes.length === 0) return null

  try {
    switch (mode) {

      case 'riser': {
        // Find best vertical plane in the stair riser range
        const candidates = detectedPlanes.filter(p => {
          const dims = getPlaneExtent(p)
          return p.orientation === 'vertical'
            && dims.height >= 0.08 && dims.height <= 0.32   // 80–320mm
        })
        if (candidates.length === 0) return null

        const best    = pickLargestPlane(candidates)
        const dims    = getPlaneExtent(best)
        const mm      = Math.round(dims.height * 1000)
        const inRange = mm >= 125 && mm <= 220

        return {
          estimatedMm: mm,
          confidence:  inRange ? 0.92 : 0.65,
          method:      'arcore-plane',
          message:     `ARCore detected riser at ${mm}mm${inRange ? ' ✓' : ' — outside typical range'}`,
        }
      }

      case 'tread': {
        // Measure depth of closest horizontal floor-level plane
        const riserH   = (priorResults.rise as number) ?? 175
        const candidates = detectedPlanes.filter(p => {
          const dims = getPlaneExtent(p)
          return p.orientation === 'horizontal'
            && dims.depth >= 0.18 && dims.depth <= 0.55     // 180–550mm
        })
        if (candidates.length === 0) return null

        const best = pickLargestPlane(candidates)
        const dims = getPlaneExtent(best)
        const mm   = Math.round(dims.depth * 1000)
        void riserH  // used for scale validation in future

        return {
          estimatedMm: mm,
          confidence:  mm >= 220 && mm <= 420 ? 0.92 : 0.70,
          method:      'arcore-plane',
          message:     `ARCore measured tread depth at ${mm}mm`,
        }
      }

      case 'width': {
        // Find two vertical planes perpendicular to viewing direction — left and right stringers
        const verticals = detectedPlanes.filter(p => p.orientation === 'vertical')
        if (verticals.length < 2) return null

        // Sort by X position to find left-most and right-most
        const sorted = verticals
          .map(p => ({ plane: p, x: getPlaneCenter(p).x }))
          .sort((a, b) => a.x - b.x)

        const leftMm  = sorted[0].x * 1000
        const rightMm = sorted[sorted.length - 1].x * 1000
        const mm      = Math.round(Math.abs(rightMm - leftMm))

        return {
          estimatedMm: mm,
          confidence:  mm >= 700 && mm <= 1500 ? 0.88 : 0.60,
          method:      'arcore-plane',
          message:     `ARCore measured stair width at ${mm}mm`,
        }
      }

      case 'handrail': {
        // Find horizontal plane nearest to handrail height (865–1070mm above tread)
        const treadPlanes = detectedPlanes.filter(p =>
          p.orientation === 'horizontal'
        )
        if (treadPlanes.length < 2) return null

        // Find lowest horizontal plane (tread surface)
        const sorted    = treadPlanes.sort((a, b) =>
          getPlaneCenter(a).y - getPlaneCenter(b).y
        )
        const treadY    = getPlaneCenter(sorted[0]).y
        const railPlane = sorted.find(p => {
          const height = (getPlaneCenter(p).y - treadY) * 1000
          return height >= 700 && height <= 1200
        })
        if (!railPlane) return null

        const mm = Math.round((getPlaneCenter(railPlane).y - treadY) * 1000)
        return {
          estimatedMm: mm,
          confidence:  mm >= 865 && mm <= 1070 ? 0.90 : 0.65,
          method:      'arcore-plane',
          message:     `ARCore measured handrail at ${mm}mm`,
        }
      }

      case 'headroom': {
        // Find ceiling plane and measure vertical clearance from stair
        const horizontals = detectedPlanes.filter(p => p.orientation === 'horizontal')
        if (horizontals.length < 2) return null

        const sorted  = horizontals.sort((a, b) => getPlaneCenter(a).y - getPlaneCenter(b).y)
        const floorY  = getPlaneCenter(sorted[0]).y
        const ceilY   = getPlaneCenter(sorted[sorted.length - 1]).y
        const mm      = Math.round((ceilY - floorY) * 1000)

        if (mm > 3000 || mm < 1500) return null  // not a real headroom measurement
        return {
          estimatedMm: mm,
          confidence:  0.85,
          method:      'arcore-plane',
          message:     `ARCore measured headroom clearance at ${mm}mm`,
        }
      }

      default:
        return null
    }

  } catch (err) {
    console.error('[ARCore] Measurement error:', err)
    return null
  }
}

// ── Plane helpers ─────────────────────────────────────────────────────────────

function getPlaneExtent(plane: XRPlane): { width: number; height: number; depth: number } {
  const pts = Array.from(plane.polygon)
  const xs  = pts.map(p => p.x)
  const ys  = pts.map(p => p.y)
  const zs  = pts.map(p => p.z)
  return {
    width:  Math.abs(Math.max(...xs) - Math.min(...xs)),
    height: Math.abs(Math.max(...ys) - Math.min(...ys)),
    depth:  Math.abs(Math.max(...zs) - Math.min(...zs)),
  }
}

function getPlaneCenter(plane: XRPlane): { x: number; y: number; z: number } {
  const pts = Array.from(plane.polygon)
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
  }
}

function pickLargestPlane(planes: XRPlane[]): XRPlane {
  return planes.reduce((best, p) =>
    p.polygon.length > best.polygon.length ? p : best
  )
}

// ── TWA detection ─────────────────────────────────────────────────────────────
/**
 * Returns true when running inside a Trusted Web Activity (Android TWA).
 * TWAs set a custom referrer or can be detected via display-mode.
 */
export function isTWA(): boolean {
  if (typeof window === 'undefined') return false
  // Android TWA sets display-mode to standalone or fullscreen
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || (window.navigator as any).standalone === true
  // Additional: TWA sets document.referrer to the app package
  const hasTWAReferrer = document.referrer.includes('android-app://')
  return isStandalone || hasTWAReferrer
}
