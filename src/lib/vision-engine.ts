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
// Draws detected lines + measurement annotation on top of the video feed.

export function drawOverlay(
  ctx:           CanvasRenderingContext2D,
  w:             number,
  h:             number,
  result:        VisionResult,
  suggestedMm:   number | null,
  confidence:    number,
  currentField:  string
): void {
  ctx.clearRect(0, 0, w, h)

  // Draw all detected edge lines (faint)
  result.lines.forEach(line => {
    ctx.beginPath()
    ctx.moveTo(0, line.y)
    ctx.lineTo(w, line.y)
    ctx.strokeStyle = `rgba(255,255,255,${0.15 * line.strength})`
    ctx.lineWidth   = 1
    ctx.stroke()
  })

  // Draw stair candidate lines (bright)
  result.staircaseLines.forEach((line, i) => {
    const alpha = 0.4 + line.strength * 0.6
    ctx.beginPath()
    ctx.moveTo(w * 0.1, line.y)
    ctx.lineTo(w * 0.9, line.y)
    ctx.strokeStyle = confidence > 0.5
      ? `rgba(102,187,106,${alpha})`    // green when confident
      : `rgba(255,183,77,${alpha})`     // amber when uncertain
    ctx.lineWidth   = 2
    ctx.setLineDash([8, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Small tick marks
    ctx.beginPath()
    ctx.moveTo(w * 0.1 - 8, line.y)
    ctx.lineTo(w * 0.1 + 8, line.y)
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`
    ctx.lineWidth   = 2
    ctx.stroke()
  })

  // Draw measurement bracket between first two stair lines
  if (result.staircaseLines.length >= 2) {
    const sorted = [...result.staircaseLines].sort((a,b) => a.y - b.y)
    const y1 = sorted[0].y
    const y2 = sorted[1].y
    const mx = w * 0.85

    const color = confidence > 0.5 ? '#66bb6a' : '#ffb74d'

    // Vertical bracket line
    ctx.beginPath()
    ctx.moveTo(mx, y1)
    ctx.lineTo(mx, y2)
    ctx.strokeStyle = color
    ctx.lineWidth   = 2.5
    ctx.stroke()

    // Bracket end caps
    ;[y1, y2].forEach(y => {
      ctx.beginPath()
      ctx.moveTo(mx - 10, y)
      ctx.lineTo(mx + 10, y)
      ctx.strokeStyle = color
      ctx.lineWidth   = 2.5
      ctx.stroke()
    })

    // Dimension label
    if (suggestedMm) {
      const midY   = (y1 + y2) / 2
      const label  = `~${suggestedMm} mm`
      ctx.font     = 'bold 16px system-ui'
      const tw     = ctx.measureText(label).width
      const bx     = mx + 16
      const by     = midY - 12

      // Background pill
      ctx.fillStyle   = confidence > 0.5 ? 'rgba(46,125,50,0.85)' : 'rgba(230,81,0,0.85)'
      ctx.beginPath()
      ctx.roundRect(bx - 4, by - 4, tw + 16, 26, 6)
      ctx.fill()

      // Label text
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, bx + 4, by + 14)
    }
  }

  // Scanning animation — moving horizontal bar
  const scanY = ((Date.now() / 20) % h)
  const grad  = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20)
  grad.addColorStop(0,   'rgba(102,187,106,0)')
  grad.addColorStop(0.5, `rgba(102,187,106,${0.06 + confidence * 0.08})`)
  grad.addColorStop(1,   'rgba(102,187,106,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, scanY - 20, w, 40)
}
