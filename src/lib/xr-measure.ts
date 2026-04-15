/**
 * src/lib/xr-measure.ts — ARAI_10
 *
 * Converts WebXR plane geometry (XRPlane.polygon) into stair measurements in mm.
 * Also provides device capability detection for AR/fallback routing.
 */

export interface MeasurementResult {
  primaryMm: number
  secondaryMm?: number
  confidence: 'high' | 'medium' | 'low'
  method: 'webxr' | 'ai-fallback'
}

/** Derive bounding-box width/height from an XRPlane polygon (metres → mm). */
export function polygonToMm(polygon: DOMPointReadOnly[]): { w: number; h: number } {
  if (!polygon || polygon.length < 3) throw new Error('Invalid polygon: need at least 3 points')
  const xs = polygon.map((p) => p.x)
  const zs = polygon.map((p) => p.z)
  return {
    w: Math.round((Math.max(...xs) - Math.min(...xs)) * 1000),
    h: Math.round((Math.max(...zs) - Math.min(...zs)) * 1000),
  }
}

export function planeConfidence(
  polygon: DOMPointReadOnly[],
  expectedMinMm: number,
  expectedMaxMm: number,
  measuredMm: number
): 'high' | 'medium' | 'low' {
  const inRange = measuredMm >= expectedMinMm && measuredMm <= expectedMaxMm
  if (!inRange) return 'low'
  if (polygon.length >= 8) return 'high'
  if (polygon.length >= 4) return 'medium'
  return 'low'
}

/** Filter planes by orientation and plausible stair dimensions. */
export function filterStairPlanes(planes: XRPlane[], mode: 'riser' | 'tread' | 'width'): XRPlane[] {
  return planes.filter((plane) => {
    const { w, h } = polygonToMm(Array.from(plane.polygon))
    const larger = Math.max(w, h)
    const smaller = Math.min(w, h)
    if (mode === 'riser')  return plane.orientation === 'vertical'   && smaller >= 80  && smaller <= 320 && larger >= 150
    if (mode === 'tread')  return plane.orientation === 'horizontal' && smaller >= 150 && smaller <= 550 && larger >= 250
    if (mode === 'width')  return larger >= 500 && larger <= 2200
    return false
  })
}

export function pickBestPlane(planes: XRPlane[], mode: 'riser' | 'tread' | 'width'): XRPlane | null {
  const filtered = filterStairPlanes(planes, mode)
  if (filtered.length === 0) return null
  return filtered.reduce((best, p) => (p.polygon.length > best.polygon.length ? p : best))
}

export function extractMeasurement(plane: XRPlane, mode: 'riser' | 'tread' | 'width'): number {
  const { w, h } = polygonToMm(Array.from(plane.polygon))
  if (mode === 'tread') return Math.min(w, h)
  return Math.max(w, h)
}

export async function checkXRSupport(): Promise<{
  immersiveAR: boolean; planeDetection: boolean; hitTest: boolean; domOverlay: boolean
}> {
  if (!navigator.xr) return { immersiveAR: false, planeDetection: false, hitTest: false, domOverlay: false }
  let immersiveAR = false
  try { immersiveAR = await navigator.xr.isSessionSupported('immersive-ar') } catch {}
  if (!immersiveAR) return { immersiveAR: false, planeDetection: false, hitTest: false, domOverlay: false }
  return { immersiveAR: true, planeDetection: true, hitTest: true, domOverlay: true }
}

// ── WebXR type augmentations (not in all TS lib versions) ──────────────────
declare global {
  interface XRPlane {
    orientation: 'horizontal' | 'vertical'
    polygon: DOMPointReadOnly[]
    planeSpace: object
    lastChangedTime: number
  }
  interface XRPlanesDetectedEvent extends Event { planes: Set<XRPlane> }
  interface XRSession {
    end(): Promise<void>
    addEventListener(type: 'planesdetected', listener: (e: XRPlanesDetectedEvent) => void): void
    addEventListener(type: 'end' | 'visibilitychange' | 'framespersecondsupport', listener: (e: Event) => void): void
    addEventListener(type: string, listener: (e: Event) => void): void
    removeEventListener(type: 'planesdetected', listener: (e: XRPlanesDetectedEvent) => void): void
    removeEventListener(type: string, listener: (e: Event) => void): void
  }
  interface Navigator { xr?: XRSystem }
  interface XRSystem {
    isSessionSupported(mode: string): Promise<boolean>
    requestSession(mode: string, options?: object): Promise<XRSession>
  }
}
