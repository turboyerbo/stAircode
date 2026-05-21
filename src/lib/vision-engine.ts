/**
 * src/lib/vision-engine.ts
 *
 * Browser-side computer vision for stair measurement estimation.
 * Runs entirely on the client — no server round-trip, no external libs.
 *
 * Pipeline per frame:
 *   1. Capture video frame → ImageData (RGBA pixels)
 *   2. Grayscale conversion
 *   3. Gaussian blur (reduces noise before edge detection)
 *   4. Sobel operator (finds intensity gradients = edges)
 *   5. Threshold + NMS (non-maximum suppression → thin edges)
 *   6. Horizontal line scan (find rows with strong horizontal edges)
 *   7. Cluster nearby rows → candidate stair nosing lines
 *   8. Estimate riser height from cluster spacing + device tilt
 *   9. Return overlay data + suggested dimension
 */

export interface DetectedLine {
  y: number           // pixel row in the video frame
  strength: number    // 0–1 confidence of this being a real edge
}

export interface VisionResult {
  lines:         DetectedLine[]   // all detected horizontal edges
  staircaseLines: DetectedLine[]  // lines that look like stair nosings
  suggestedMm:   number | null    // estimated riser height in mm
  confidence:    number           // 0–1 overall confidence
  debugInfo:     string           // human-readable description
}

// ── Gaussian kernel (5×5, σ=1.0) ────────────────────────────────────────────
const GAUSSIAN_5 = [
  2,  4,  5,  4,  2,
  4,  9, 12,  9,  4,
  5, 12, 15, 12,  5,
  4,  9, 12,  9,  4,
  2,  4,  5,  4,  2,
]
const GAUSSIAN_SUM = 159

// ── Sobel kernels ─────────────────────────────────────────────────────────────
const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
const SOBEL_Y = [-1,-2,-1,  0, 0, 0,  1, 2, 1]

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// ── Grayscale ─────────────────────────────────────────────────────────────────
function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }
  return gray
}

// ── Gaussian blur ─────────────────────────────────────────────────────────────
function gaussianBlur(src: Float32Array, w: number, h: number): Float32Array {
  const dst = new Float32Array(w * h)
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      let sum = 0
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          const ki = (ky + 2) * 5 + (kx + 2)
          sum += src[(y + ky) * w + (x + kx)] * GAUSSIAN_5[ki]
        }
      }
      dst[y * w + x] = sum / GAUSSIAN_SUM
    }
  }
  return dst
}

// ── Sobel edge detection ──────────────────────────────────────────────────────
function sobelEdges(src: Float32Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ki  = (ky + 1) * 3 + (kx + 1)
          const val = src[(y + ky) * w + (x + kx)]
          gx += val * SOBEL_X[ki]
          gy += val * SOBEL_Y[ki]
        }
      }
      mag[y * w + x] = Math.sqrt(gx * gx + gy * gy)
    }
  }
  return mag
}

// ── Per-row horizontal edge strength ─────────────────────────────────────────
// Returns a score per row: how much horizontal edge exists in that row.
// Horizontal edges (where Gy is dominant over Gx) indicate stair nosings.
function rowEdgeStrengths(src: Float32Array, w: number, h: number): Float32Array {
  const scores = new Float32Array(h)
  for (let y = 1; y < h - 1; y++) {
    let horizSum = 0
    let totalSum = 0
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ki  = (ky + 1) * 3 + (kx + 1)
          const val = src[(y + ky) * w + (x + kx)]
          gx += val * SOBEL_X[ki]
          gy += val * SOBEL_Y[ki]
        }
      }
      const mag   = Math.sqrt(gx * gx + gy * gy)
      const horiz = Math.abs(gy)   // horizontal edges → strong Gy
      totalSum  += mag
      horizSum  += horiz
    }
    // Score = horizontal edge density, only above a noise floor
    scores[y] = totalSum > w * 2 ? horizSum / w : 0
  }
  return scores
}

// ── Cluster row peaks into stair nosing candidates ────────────────────────────
function clusterPeaks(scores: Float32Array, h: number, threshold: number): DetectedLine[] {
  // Find local maxima above threshold
  const peaks: DetectedLine[] = []
  for (let y = 2; y < h - 2; y++) {
    const s = scores[y]
    if (s < threshold) continue
    if (s >= scores[y-1] && s >= scores[y+1] && s >= scores[y-2] && s >= scores[y+2]) {
      peaks.push({ y, strength: s })
    }
  }

  // Normalise strength to 0–1
  const maxStr = peaks.reduce((m, p) => Math.max(m, p.strength), 1)
  return peaks.map(p => ({ y: p.y, strength: p.strength / maxStr }))
}

// ── Filter for stair-like spacing patterns ────────────────────────────────────
// Real stair nosings are roughly evenly spaced.
// We look for a set of lines where inter-line spacing is consistent.
function findStaircaseLines(lines: DetectedLine[], frameH: number): DetectedLine[] {
  if (lines.length < 2) return lines

  // Sort top → bottom
  const sorted = [...lines].sort((a, b) => a.y - b.y)

  // Compute gaps between consecutive lines
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].y - sorted[i-1].y)
  }

  if (gaps.length === 0) return sorted

  // Find the median gap
  const sortedGaps = [...gaps].sort((a,b) => a - b)
  const medianGap  = sortedGaps[Math.floor(sortedGaps.length / 2)]

  // Keep lines that fit within ±40% of the median gap
  // This rejects random edges that aren't stair risers
  const tolerance = medianGap * 0.4
  const result: DetectedLine[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].y - result[result.length - 1].y
    if (Math.abs(gap - medianGap) < tolerance) {
      result.push(sorted[i])
    }
  }

  return result.length >= 2 ? result : sorted.slice(0, Math.min(sorted.length, 4))
}

// ── Estimate real-world riser height ──────────────────────────────────────────
// Uses the pixel spacing between nosing lines + device tilt to estimate mm.
//
// Model: phone held ~60–90cm from staircase, looking slightly downward.
// Typical stair riser = 150–200mm.
// We use the pixel gap as a ratio of frame height to estimate mm.
// This is a heuristic — real accuracy needs LiDAR or a reference object.
//
// Calibration: at 75cm distance, 80° field of view, 720px height:
//   1px ≈ (scene_height / frame_height)
//   scene_height = 2 * distance * tan(vFOV/2) ≈ 1200mm at 75cm
//   so 1px ≈ 1200/720 ≈ 1.67mm
//
// We adjust for tilt: if phone tilts down 30°, the vertical scale increases.

export function estimateRiserMm(
  pixelGap:   number,
  frameH:     number,
  tiltDeg:    number,   // device beta from DeviceOrientation (degrees from vertical)
  fieldKey:   string
): number {
  // Typical viewing distance assumptions per measurement type
  const DISTANCE_MM: Record<string, number> = {
    riser:    700,    // close to the step
    tread:    700,
    nosing:   500,    // very close
    headroom: 1500,   // standing back to see full height
    width:    1000,
    handrail: 900,
    variation:700,
    landing:  1000,
  }

  const dist    = DISTANCE_MM[fieldKey] || 700
  const vFOVrad = (70 * Math.PI) / 180   // typical phone vertical FOV ≈ 70°
  const sceneH  = 2 * dist * Math.tan(vFOVrad / 2)  // scene height in mm at that distance
  const mmPerPx = sceneH / frameH

  // Tilt correction: if phone is tilted toward ground, vertical foreshortening occurs
  const tiltRad    = clamp(Math.abs(tiltDeg), 10, 80) * (Math.PI / 180)
  const tiltFactor = 1 / Math.sin(tiltRad)   // ~1.0 at 90° (straight at wall), increases as you tilt down

  const rawMm = pixelGap * mmPerPx * tiltFactor

  // Sanity clamp per field
  const RANGES: Record<string, [number, number]> = {
    riser:    [100, 220],
    tread:    [200, 380],
    nosing:   [10,  60],
    headroom: [1800, 2500],
    width:    [600, 1500],
    handrail: [700, 1200],
    variation:[2,   20],
    landing:  [600, 1500],
  }
  const range = RANGES[fieldKey] || [50, 2500]
  return clamp(Math.round(rawMm), range[0], range[1])
}

// ── Main analysis function ─────────────────────────────────────────────────────
// Call this every frame with the current video frame + device tilt.

export function analyzeFrame(
  ctx:       CanvasRenderingContext2D,
  video:     HTMLVideoElement,
  tiltDeg:   number,
  fieldKey:  string,
  scale:     number = 0.25   // downsample for performance (0.25 = quarter res)
): VisionResult {

  const srcW = video.videoWidth  || 640
  const srcH = video.videoHeight || 480
  const w    = Math.round(srcW * scale)
  const h    = Math.round(srcH * scale)

  if (w < 10 || h < 10) {
    return { lines: [], staircaseLines: [], suggestedMm: null, confidence: 0, debugInfo: 'No video' }
  }

  // Draw scaled video frame to canvas — skip if source is the same canvas (already drawn)
  if ((video as any) !== ctx.canvas) {
    ctx.drawImage(video as any, 0, 0, w, h)
  }
  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, w, h)
  } catch {
    return { lines: [], staircaseLines: [], suggestedMm: null, confidence: 0, debugInfo: 'Canvas read error' }
  }

  // Vision pipeline
  const gray    = toGrayscale(imageData.data, w, h)
  const blurred = gaussianBlur(gray, w, h)
  const scores  = rowEdgeStrengths(blurred, w, h)

  // Dynamic threshold: top 15% of score values
  const scoreArr  = Array.from(scores).sort((a,b) => b-a)
  const threshold = scoreArr[Math.floor(scoreArr.length * 0.15)] * 0.5

  const allLines      = clusterPeaks(scores, h, threshold)
  const staircaseLines = findStaircaseLines(allLines, h)

  // Scale line y-coords back to full video resolution for display
  const scale_inv = 1 / scale
  const scaledLines  = allLines.map(l => ({ ...l, y: Math.round(l.y * scale_inv) }))
  const scaledStairs = staircaseLines.map(l => ({ ...l, y: Math.round(l.y * scale_inv) }))

  // Estimate dimension if we have at least 2 stair lines
  let suggestedMm: number | null = null
  let confidence  = 0
  let debugInfo   = ''

  if (staircaseLines.length >= 2) {
    // Use median gap between detected stair lines (in downsampled pixels)
    const gaps: number[] = []
    const sorted = [...staircaseLines].sort((a,b) => a.y - b.y)
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i].y - sorted[i-1].y)
    }
    const medianGapPx = gaps.sort((a,b)=>a-b)[Math.floor(gaps.length/2)]

    // Convert to full-resolution pixels then to mm
    const medianGapFull = medianGapPx * scale_inv
    suggestedMm = estimateRiserMm(medianGapFull, srcH, tiltDeg, fieldKey)

    // Confidence: more lines + consistent spacing = higher confidence
    const spacingVariance = gaps.reduce((sum, g) => sum + Math.abs(g - medianGapPx), 0) / gaps.length
    const spacingConsistency = Math.max(0, 1 - spacingVariance / medianGapPx)
    confidence = Math.min(1, (staircaseLines.length / 4) * spacingConsistency * 0.9 +
                             staircaseLines.map(l=>l.strength).reduce((a,b)=>a+b,0)/staircaseLines.length * 0.1)

    debugInfo = `${staircaseLines.length} stair edges · gap ${Math.round(medianGapFull)}px · ${Math.round(confidence*100)}% confidence`
  } else if (allLines.length > 0) {
    debugInfo = `${allLines.length} edges detected, looking for stair pattern…`
    confidence = 0.1
  } else {
    debugInfo = 'No edges detected — aim at the staircase'
    confidence = 0
  }

  return { lines: scaledLines, staircaseLines: scaledStairs, suggestedMm, confidence, debugInfo }
}

// ── Draw overlay onto canvas ──────────────────────────────────────────────────
// Position-aware overlay: each scan step gets a tailored visual guide.
//
// Positions:
//   overview / riser_front  → two snapping horizontal lines (top + bottom of flight)
//   tread_top / run         → two snapping horizontal lines (tread front + back edge)
//   alt_angle / guard       → diagonal handrail guide + bottom step line
//   width                   → vertical span guide
//   default                 → standard detected lines

// Internal smoothing state (module-level so it persists across frames)
const _smooth = { topY: -1, botY: -1 }

function drawHLine(
  ctx: CanvasRenderingContext2D, w: number, y: number,
  color: string, label: string, labelSide: 'left' | 'right' = 'right'
) {
  ctx.beginPath()
  ctx.moveTo(w * 0.04, y)
  ctx.lineTo(w * 0.96, y)
  ctx.strokeStyle = color
  ctx.lineWidth   = 2.5
  ctx.setLineDash([10, 5])
  ctx.stroke()
  ctx.setLineDash([])

  // End ticks
  for (const tx of [w * 0.04, w * 0.96]) {
    ctx.beginPath()
    ctx.moveTo(tx, y - 7); ctx.lineTo(tx, y + 7)
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke()
  }

  // Label pill
  if (label) {
    ctx.font = 'bold 12px system-ui'
    const tw  = ctx.measureText(label).width
    const lx  = labelSide === 'right' ? w * 0.96 - tw - 10 : w * 0.04 + 4
    const ly  = y - 18
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath()
    ctx.roundRect(lx - 4, ly - 2, tw + 12, 20, 5)
    ctx.fill()
    ctx.fillStyle = color
    ctx.fillText(label, lx + 2, ly + 13)
  }
}

function getSnapLines(
  result: VisionResult, h: number, fallbackTop: number, fallbackBot: number
): { topY: number; botY: number } {
  const sorted = [...result.staircaseLines].sort((a, b) => a.y - b.y)
  const rawTop = sorted.length > 0 ? sorted[0].y               : fallbackTop
  const rawBot = sorted.length > 1 ? sorted[sorted.length-1].y : fallbackBot

  // Exponential smoothing to avoid jitter
  const alpha = 0.25
  if (_smooth.topY < 0) { _smooth.topY = rawTop; _smooth.botY = rawBot }
  _smooth.topY = _smooth.topY * (1 - alpha) + rawTop * alpha
  _smooth.botY = _smooth.botY * (1 - alpha) + rawBot * alpha

  return { topY: _smooth.topY, botY: _smooth.botY }
}

export function drawOverlay(
  ctx:           CanvasRenderingContext2D,
  w:             number,
  h:             number,
  result:        VisionResult,
  suggestedMm:   number | null,
  confidence:    number,
  currentField:  string,
  cardDetected?: boolean
): void {
  ctx.clearRect(0, 0, w, h)

  const locked  = confidence > 0.6
  const hiColor = locked ? '#4ade80' : '#38bdf8'   // green locked, cyan scanning
  const dimColor = locked ? 'rgba(74,222,128,0.5)' : 'rgba(56,189,248,0.45)'
  const t = Date.now()

  // ── 1. OVERVIEW / RISER FRONT — snap horizontal lines to top + bottom of flight ──
  if (currentField === 'overview' || currentField === 'riser_front' || currentField === 'rise') {
    const { topY, botY } = getSnapLines(result, h, h * 0.15, h * 0.82)
    const topLabel = currentField === 'overview' ? 'Top of flight' : 'Top of riser'
    const botLabel = currentField === 'overview' ? 'Bottom step'   : 'Riser base'

    // Faint fill between lines
    ctx.fillStyle = `rgba(56,189,248,${locked ? 0.07 : 0.04})`
    ctx.fillRect(0, topY, w, botY - topY)

    drawHLine(ctx, w, topY, hiColor, topLabel, 'right')
    drawHLine(ctx, w, botY, hiColor, botLabel, 'left')

    // Animated scan bar between lines
    const scanY = topY + ((t / 18) % (botY - topY))
    const grad  = ctx.createLinearGradient(0, scanY - 12, 0, scanY + 12)
    grad.addColorStop(0,   'rgba(56,189,248,0)')
    grad.addColorStop(0.5, `rgba(56,189,248,${0.08 + confidence * 0.1})`)
    grad.addColorStop(1,   'rgba(56,189,248,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, scanY - 12, w, 24)
  }

  // ── 2. TREAD TOP / RUN — snap two lines to tread front and back nosing ───────────
  else if (currentField === 'tread_top' || currentField === 'run') {
    const { topY, botY } = getSnapLines(result, h, h * 0.3, h * 0.65)

    drawHLine(ctx, w, topY, hiColor, 'Tread back edge', 'right')
    drawHLine(ctx, w, botY, hiColor, 'Tread front nosing', 'left')

    // Bracket on right side
    const bx = w * 0.88
    ctx.beginPath(); ctx.moveTo(bx, topY); ctx.lineTo(bx, botY)
    ctx.strokeStyle = hiColor; ctx.lineWidth = 2; ctx.stroke()
    for (const by of [topY, botY]) {
      ctx.beginPath(); ctx.moveTo(bx - 8, by); ctx.lineTo(bx + 8, by)
      ctx.strokeStyle = hiColor; ctx.lineWidth = 2; ctx.stroke()
    }
    if (suggestedMm) {
      const label = `~${suggestedMm} mm`
      ctx.font = 'bold 13px system-ui'
      const tw = ctx.measureText(label).width
      const lx = bx + 10; const ly = (topY + botY) / 2 - 10
      ctx.fillStyle = locked ? 'rgba(46,125,50,0.88)' : 'rgba(2,60,110,0.88)'
      ctx.beginPath(); ctx.roundRect(lx - 4, ly - 2, tw + 14, 22, 5); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.fillText(label, lx + 3, ly + 14)
    }
  }

  // ── 3. HANDRAIL / GUARD — diagonal line tracing railing + bottom step line ───────
  else if (currentField === 'alt_angle' || currentField === 'guard' || currentField === 'handrail') {
    // Reset smoothing for this position
    _smooth.topY = -1; _smooth.botY = -1

    // Diagonal guide — traces expected railing angle (ascending left-to-right)
    // Animate subtle pulse on the diagonal
    const pulse = 0.6 + 0.4 * Math.sin(t / 400)
    const diagColor = locked ? `rgba(74,222,128,${pulse})` : `rgba(56,189,248,${pulse})`

    // Main diagonal — from bottom-left to upper-right (standard stair railing angle ~35°)
    const diagX1 = w * 0.08;  const diagY1 = h * 0.78
    const diagX2 = w * 0.92;  const diagY2 = h * 0.12
    ctx.beginPath()
    ctx.moveTo(diagX1, diagY1)
    ctx.lineTo(diagX2, diagY2)
    ctx.strokeStyle = diagColor
    ctx.lineWidth   = 3
    ctx.setLineDash([14, 6])
    ctx.stroke()
    ctx.setLineDash([])

    // Arrow head at upper-right end
    const angle = Math.atan2(diagY2 - diagY1, diagX2 - diagX1)
    const aLen = 14
    ctx.beginPath()
    ctx.moveTo(diagX2, diagY2)
    ctx.lineTo(diagX2 - aLen * Math.cos(angle - 0.4), diagY2 - aLen * Math.sin(angle - 0.4))
    ctx.moveTo(diagX2, diagY2)
    ctx.lineTo(diagX2 - aLen * Math.cos(angle + 0.4), diagY2 - aLen * Math.sin(angle + 0.4))
    ctx.strokeStyle = diagColor; ctx.lineWidth = 2.5; ctx.stroke()

    // Label on diagonal
    ctx.save(); ctx.translate(w * 0.5, h * 0.42)
    ctx.rotate(Math.atan2(diagY2 - diagY1, diagX2 - diagX1))
    ctx.font = 'bold 12px system-ui'
    const dLabel = 'Align railing with this line'
    const dtw = ctx.measureText(dLabel).width
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath(); ctx.roundRect(-dtw/2 - 6, -16, dtw + 14, 20, 5); ctx.fill()
    ctx.fillStyle = diagColor; ctx.fillText(dLabel, -dtw/2, -1)
    ctx.restore()

    // Bottom step line — snap to lowest detected stair line or fallback
    const sorted = [...result.staircaseLines].sort((a, b) => b.y - a.y)
    const stepY  = sorted.length > 0 ? sorted[0].y : h * 0.82
    drawHLine(ctx, w, stepY, 'rgba(255,183,77,0.9)', 'First step', 'right')

    // Measurement bracket on left
    if (suggestedMm) {
      const bx = w * 0.08
      ctx.beginPath(); ctx.moveTo(bx, stepY); ctx.lineTo(bx, h * 0.12)
      ctx.strokeStyle = locked ? '#4ade80' : '#ffb74d'; ctx.lineWidth = 2; ctx.stroke()
      const label = `~${suggestedMm} mm`
      ctx.font = 'bold 13px system-ui'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.beginPath(); ctx.roundRect(bx - 4, h * 0.42 - 11, tw + 14, 22, 5); ctx.fill()
      ctx.fillStyle = locked ? '#4ade80' : '#ffb74d'
      ctx.fillText(label, bx + 3, h * 0.42 + 5)
    }
  }

  // ── 4. DEFAULT — generic stair line detection overlay ────────────────────────────
  else {
    result.staircaseLines.forEach(line => {
      const alpha = 0.4 + line.strength * 0.5
      ctx.beginPath()
      ctx.moveTo(w * 0.08, line.y); ctx.lineTo(w * 0.92, line.y)
      ctx.strokeStyle = confidence > 0.5 ? `rgba(74,222,128,${alpha})` : `rgba(56,189,248,${alpha})`
      ctx.lineWidth = 2; ctx.setLineDash([8, 4]); ctx.stroke(); ctx.setLineDash([])
    })
  }

  // ── Card detected indicator ───────────────────────────────────────────────────────
  if (cardDetected) {
    const cx = 16; const cy = h - 36
    // Mini card rectangle
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath(); ctx.roundRect(cx, cy, 88, 22, 4); ctx.fill()
    // Card outline icon
    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.roundRect(cx + 4, cy + 4, 22, 14, 2); ctx.stroke()
    ctx.fillStyle = '#4ade80'
    ctx.font = '10px system-ui'
    ctx.fillText(' Card detected', cx + 30, cy + 14)
  }

  // ── Confidence arc (top-right corner) ────────────────────────────────────────────
  const arcR = 18; const arcX = w - arcR - 12; const arcY = arcR + 10
  ctx.beginPath()
  ctx.arc(arcX, arcY, arcR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * confidence)
  ctx.strokeStyle = locked ? '#4ade80' : '#38bdf8'
  ctx.lineWidth = 3; ctx.stroke()
  ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(`${Math.round(confidence * 100)}%`, arcX, arcY)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
}
