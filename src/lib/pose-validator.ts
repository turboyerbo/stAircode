/**
 * src/lib/pose-validator.ts
 *
 * Geometric validation and correction layer for stair measurements.
 *
 * Solves three distinct problems:
 *
 * 1. AR MODE — Phone orthogonality to measured plane
 *    ARCore gives us the plane's world-space normal vector.
 *    The phone's viewing direction (camera forward = -Z in camera space)
 *    must be perpendicular to the normal (i.e. parallel to the surface)
 *    for `heightM`/`depthM` to be accurate.
 *    If the angle between camera-forward and the plane normal deviates
 *    from 90° by more than ~15°, we correct the measurement and flag it.
 *
 * 2. AI VISION MODE — Perspective foreshortening correction
 *    When the camera is tilted downward (tread surface visible), the
 *    riser face appears shorter than reality. We apply a 1/cos(θ) correction.
 *    θ is estimated from: (a) explicit tilt metadata from the AI response,
 *    (b) DeviceOrientationEvent, or (c) visual heuristics in the AI prompt.
 *
 * 3. MULTI-SAMPLE AVERAGING
 *    For AR mode: collect readings over a short window (500–1000ms),
 *    discard outliers (>2σ), return the trimmed mean. This reduces noise
 *    from tracking jitter without requiring the user to hold still for long.
 *
 * Accuracy targets:
 *   AR + orthogonal:   ±5–8mm
 *   AR + corrected:    ±8–15mm
 *   AI + tape visible: ±5–10mm
 *   AI + perspective:  ±10–18mm
 *   AI + no ref:       ±25–40mm
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type MeasurementMode = 'riser' | 'tread' | 'width' | 'handrail' | 'headroom'

export interface PoseQuality {
  /** 0–1: 1 = perfectly orthogonal/level, 0 = unusable */
  score:        number
  /** Degrees off from ideal viewing angle */
  angleDeg:     number
  /** Whether the angle is within acceptable tolerance */
  acceptable:   boolean
  /** Short guidance string shown in real-time UI */
  guidance:     string
  /** Which correction was applied (if any) */
  correction:   'none' | 'tilt-cosine' | 'ar-normal' | 'triangulation'
  /** Correction factor applied to raw measurement */
  correctionFactor: number
}

export interface ValidatedMeasurement {
  rawMm:        number
  correctedMm:  number
  pose:         PoseQuality
  method:       'arcore-orthogonal' | 'arcore-corrected' | 'ai-tape' | 'ai-corrected' | 'ai-estimated'
  confidenceMm: number  // ±Nmm expected accuracy
  samples?:     number  // how many AR readings were averaged
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Max acceptable angle deviation from ideal (degrees) */
const ANGLE_TOLERANCE = {
  riser:    15,  // riser: camera must face riser face — tolerate 15° tilt
  tread:    12,  // tread: camera must face straight down — tolerate 12° off-nadir
  width:    20,  // width: more forgiving since it's a horizontal sweep
  handrail: 18,
  headroom: 25,
}

/** Expected accuracy at each quality tier (±mm) */
const ACCURACY_MM = {
  'arcore-orthogonal': 6,
  'arcore-corrected':  12,
  'ai-tape':           8,
  'ai-corrected':      15,
  'ai-estimated':      35,
}

// ── Real-time guidance strings ─────────────────────────────────────────────────

export function getAngleGuidance(
  mode: MeasurementMode,
  angleDeg: number,
  direction: 'up' | 'down' | 'left' | 'right' | 'level'
): string {
  if (angleDeg <= 5) return '✓ Perfect angle — hold still'
  if (angleDeg <= 10) return '✓ Good — tap to capture'

  const tiltVerb = direction === 'down' ? 'Tilt up' : direction === 'up' ? 'Tilt down'
                 : direction === 'left' ? 'Rotate right' : direction === 'right' ? 'Rotate left'
                 : 'Level the phone'

  const modeInstructions: Record<MeasurementMode, string> = {
    riser:    `${tiltVerb} — face the riser face straight-on`,
    tread:    `${tiltVerb} — hold phone directly above the tread`,
    width:    `${tiltVerb} — scan across the full stair width`,
    handrail: `${tiltVerb} — frame the full height from tread to rail top`,
    headroom: `${tiltVerb} — point up toward the ceiling/soffit`,
  }

  if (angleDeg <= 20) return `⚠ ${modeInstructions[mode]} (${Math.round(angleDeg)}° off)`
  return `✗ ${modeInstructions[mode]} — too angled (${Math.round(angleDeg)}° off, max ${ANGLE_TOLERANCE[mode]}°)`
}

// ── Cosine perspective correction (AI Vision mode) ─────────────────────────────

/**
 * Apply perspective correction to a raw pixel-based measurement.
 *
 * When the camera is tilted by angle θ relative to the surface normal,
 * the apparent size is rawMm * cos(θ). Therefore:
 *   correctedMm = rawMm / cos(θ)
 *
 * θ is estimated from DeviceOrientationEvent (phone tilt) when available,
 * falling back to the AI-reported tilt angle from the vision response.
 *
 * @param rawMm         Raw measurement from pixel analysis
 * @param mode          What is being measured
 * @param deviceGamma   DeviceOrientationEvent.gamma (left-right tilt, degrees)
 * @param deviceBeta    DeviceOrientationEvent.beta  (front-back tilt, degrees)
 * @param aiTiltDeg     Tilt angle reported by AI vision model (fallback)
 */
export function applyPerspectiveCorrection(
  rawMm: number,
  mode: MeasurementMode,
  deviceGamma?: number | null,
  deviceBeta?: number | null,
  aiTiltDeg?: number | null,
): ValidatedMeasurement {
  let tiltDeg = 0
  let tiltSource: string = 'none'
  let correctionFactor = 1.0

  // For riser measurement: beta (front-back) is the relevant axis
  // Beta = 90° means phone is upright/facing forward (ideal for riser)
  // Beta < 90° means phone is tilted downward (sees top of tread = foreshortening)
  if (deviceBeta != null && mode === 'riser') {
    // Ideal: beta = 90 (phone vertical, facing riser)
    // Tilted down: beta < 90. Tilt angle from ideal = 90 - beta
    const betaDeg = Math.abs(deviceBeta)
    tiltDeg = Math.max(0, 90 - betaDeg)
    tiltSource = 'device-sensor'
  } else if (deviceGamma != null && (mode === 'tread')) {
    // For tread (camera pointing down), gamma deviation from 0
    tiltDeg = Math.abs(deviceGamma ?? 0)
    tiltSource = 'device-sensor'
  } else if (aiTiltDeg != null && aiTiltDeg > 0) {
    tiltDeg = aiTiltDeg
    tiltSource = 'ai-vision'
  }

  // Clamp to reasonable range
  tiltDeg = Math.min(tiltDeg, 50)

  const tolerance = ANGLE_TOLERANCE[mode]
  const acceptable = tiltDeg <= tolerance

  if (tiltDeg > 3) {
    // Apply cosine correction: corrected = raw / cos(θ)
    const tiltRad = (tiltDeg * Math.PI) / 180
    correctionFactor = 1 / Math.cos(tiltRad)
    // Cap correction factor — beyond 50° the geometry is too distorted to trust
    correctionFactor = Math.min(correctionFactor, 1.55)
  }

  const correctedMm = Math.round(rawMm * correctionFactor)

  const direction: 'up' | 'down' | 'left' | 'right' | 'level' =
    (deviceBeta ?? 90) < 85 ? 'down' : (deviceBeta ?? 90) > 95 ? 'up' : 'level'

  const pose: PoseQuality = {
    score:       Math.max(0, 1 - tiltDeg / 90),
    angleDeg:    tiltDeg,
    acceptable,
    guidance:    getAngleGuidance(mode, tiltDeg, direction),
    correction:  tiltDeg > 3 ? 'tilt-cosine' : 'none',
    correctionFactor,
  }

  const method: ValidatedMeasurement['method'] =
    tiltDeg <= 5  ? 'ai-estimated'   // no meaningful correction needed
    : tiltDeg <= tolerance ? 'ai-corrected'
    : 'ai-estimated'  // too much tilt, lower confidence

  return {
    rawMm,
    correctedMm,
    pose,
    method,
    confidenceMm: ACCURACY_MM[method],
    samples:      1,
  }
}

// ── AR Normal-vector orthogonality check ──────────────────────────────────────

/**
 * Validate and correct an ARCore plane measurement using the plane's
 * world-space normal vector and the camera's viewing direction.
 *
 * The plane normal (from ARCore) tells us which way the surface faces.
 * The camera forward vector (from XRViewerPose) tells us where the phone points.
 * For accurate measurement, these must be perpendicular (dot product ≈ 0).
 *
 * @param rawMm           Measurement from ARCore plane geometry (heightM * 1000)
 * @param planeNormal     World-space normal vector of the detected plane
 * @param cameraForward   World-space forward vector of the camera (-Z axis from pose)
 * @param mode            What dimension is being measured
 */
export function validateARMeasurement(
  rawMm: number,
  planeNormal: { x: number; y: number; z: number },
  cameraForward: { x: number; y: number; z: number },
  mode: MeasurementMode
): ValidatedMeasurement {
  // Normalise vectors
  const n = normalise(planeNormal)
  const f = normalise(cameraForward)

  // Dot product of normal and camera forward
  // = cos(angle between them)
  // For perpendicular (ideal): dot = 0, angle = 90°
  const dot = n.x * f.x + n.y * f.y + n.z * f.z

  // Angle between them
  const angleBetween = (Math.acos(Math.abs(dot)) * 180) / Math.PI
  // Deviation from 90° (ideal for viewing a surface face-on)
  const deviationDeg = Math.abs(90 - angleBetween)

  const tolerance = ANGLE_TOLERANCE[mode]
  const acceptable = deviationDeg <= tolerance

  // Correction: if camera is not perpendicular to the plane,
  // the plane polygon projection is foreshortened.
  // The true extent = measured / sin(angleBetween)
  // At 90° (ideal): sin(90°) = 1, no correction
  // At 75°: sin(75°) = 0.966, correction factor = 1.035
  // At 60°: sin(60°) = 0.866, correction factor = 1.155
  let correctionFactor = 1.0
  if (deviationDeg > 5) {
    const angleRad = (angleBetween * Math.PI) / 180
    correctionFactor = Math.min(1 / Math.sin(Math.max(angleRad, 0.1)), 1.5)
  }

  const correctedMm = Math.round(rawMm * correctionFactor)

  // Determine guidance direction based on which component of normal
  // deviates most from ideal for this mode
  let direction: 'up' | 'down' | 'left' | 'right' | 'level' = 'level'
  if (mode === 'riser') {
    // For riser: normal should be horizontal (ny ≈ 0). If ny > 0.2, camera is too high
    direction = n.y > 0.2 ? 'up' : n.y < -0.2 ? 'down' : 'level'
  } else if (mode === 'tread') {
    direction = n.y < 0.8 ? 'down' : 'level'
  }

  const pose: PoseQuality = {
    score:            Math.max(0, 1 - deviationDeg / 90),
    angleDeg:         deviationDeg,
    acceptable,
    guidance:         getAngleGuidance(mode, deviationDeg, direction),
    correction:       deviationDeg > 5 ? 'ar-normal' : 'none',
    correctionFactor,
  }

  const method: ValidatedMeasurement['method'] =
    deviationDeg <= 8  ? 'arcore-orthogonal'
    : deviationDeg <= tolerance ? 'arcore-corrected'
    : 'arcore-corrected'  // still use it, just lower confidence

  return {
    rawMm,
    correctedMm,
    pose,
    method,
    confidenceMm: ACCURACY_MM[method],
    samples:      1,
  }
}

// ── Multi-sample averaging for AR ─────────────────────────────────────────────

interface Sample { mm: number; score: number; ts: number }

/**
 * Collect AR plane readings over a short window and return the best estimate.
 * Discards outliers (beyond 1.5 IQR), returns trimmed mean of remaining samples.
 *
 * @param samples     Array of { mm, score, ts } readings
 * @param windowMs    Max age of samples to include (default 800ms)
 * @param minSamples  Minimum samples before returning a result (default 3)
 */
export function averageARSamples(
  samples: Sample[],
  windowMs = 800,
  minSamples = 3
): { mm: number; sampleCount: number; stdDevMm: number } | null {
  const now = Date.now()
  const recent = samples
    .filter(s => now - s.ts < windowMs && s.score > 0.5)
    .sort((a, b) => a.mm - b.mm)

  if (recent.length < minSamples) return null

  // IQR outlier removal
  const q1 = recent[Math.floor(recent.length * 0.25)].mm
  const q3 = recent[Math.floor(recent.length * 0.75)].mm
  const iqr = q3 - q1
  const filtered = recent.filter(s => s.mm >= q1 - 1.5 * iqr && s.mm <= q3 + 1.5 * iqr)

  if (filtered.length < 2) return null

  const mean = filtered.reduce((sum, s) => sum + s.mm, 0) / filtered.length
  const variance = filtered.reduce((sum, s) => sum + (s.mm - mean) ** 2, 0) / filtered.length
  const stdDev = Math.sqrt(variance)

  return {
    mm:          Math.round(mean),
    sampleCount: filtered.length,
    stdDevMm:    Math.round(stdDev),
  }
}

// ── Device orientation hook helper ────────────────────────────────────────────

export interface DeviceOrientation {
  alpha: number | null  // compass heading
  beta:  number | null  // front-back tilt (-180 to 180, 90 = upright)
  gamma: number | null  // left-right tilt (-90 to 90)
}

/**
 * Get a single device orientation reading.
 * Returns null if DeviceOrientationEvent is not available (iOS requires permission).
 */
export function getDeviceOrientation(): Promise<DeviceOrientation | null> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) {
      resolve(null)
      return
    }
    const handler = (e: DeviceOrientationEvent) => {
      window.removeEventListener('deviceorientation', handler)
      resolve({ alpha: e.alpha, beta: e.beta, gamma: e.gamma })
    }
    window.addEventListener('deviceorientation', handler, { once: true })
    // Timeout if no event in 300ms
    setTimeout(() => resolve(null), 300)
  })
}

// ── Triangulation for tread depth ─────────────────────────────────────────────

/**
 * Estimate tread depth using two-point triangulation.
 * Used when the camera can't see the full tread depth in a single frame.
 *
 * The user is shown a dot at the nosing edge and instructed to align it,
 * then move the phone back. The change in camera position (from ARCore
 * frame delta) combined with the angle change gives us the depth.
 *
 * @param pos1    Camera world position at point 1 (nose of tread)
 * @param pos2    Camera world position at point 2 (back of tread)
 * @param angle1  Camera pitch angle at pos1 (degrees from horizontal)
 * @param angle2  Camera pitch angle at pos2
 */
export function triangulateTreadDepth(
  pos1: { x: number; y: number; z: number },
  pos2: { x: number; y: number; z: number },
  angle1: number,
  angle2: number
): number | null {
  // Distance moved by camera (in metres)
  const dx = pos2.x - pos1.x
  const dz = pos2.z - pos1.z
  const cameraMoveM = Math.sqrt(dx * dx + dz * dz)

  if (cameraMoveM < 0.01) return null  // not enough movement

  const a1Rad = (angle1 * Math.PI) / 180
  const a2Rad = (angle2 * Math.PI) / 180

  // Simple triangulation: depth = cameraMove * sin(a1) * sin(a2) / sin(a2 - a1)
  const sinDiff = Math.sin(a2Rad - a1Rad)
  if (Math.abs(sinDiff) < 0.01) return null

  const depthM = (cameraMoveM * Math.sin(a1Rad) * Math.sin(a2Rad)) / sinDiff
  const depthMm = Math.round(Math.abs(depthM) * 1000)

  // Sanity check: typical tread depth 200–420mm
  if (depthMm < 150 || depthMm > 600) return null
  return depthMm
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalise(v: { x: number; y: number; z: number }) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (len < 0.0001) return { x: 0, y: 0, z: 1 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

/** Rough polygon area (shoelace formula) on ScreenPlane vertices */
export function polygonArea(plane: { screenPoly: Array<{ x: number; y: number }> }): number {
  const pts = plane.screenPoly
  if (pts.length < 3) return 0
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    area += pts[i].x * pts[j].y
    area -= pts[j].x * pts[i].y
  }
  return Math.abs(area) / 2
}
