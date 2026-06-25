/**
 * src/lib/image-utils.ts
 *
 * Client-side image normalization for AI vision.
 * Downscales and re-encodes ANY image (including HEIC/PNG from phone photos)
 * to a JPEG that's safely under the API and Netlify body-size limits.
 *
 * Returns raw base64 (no "data:" prefix) ready for /api/vision.
 */

const MAX_DIM     = 1500   // longest edge in px — plenty for vision, small payload
const JPEG_QUALITY = 0.82

/**
 * Takes a File or a data URL / base64 string and returns clean JPEG base64
 * (no data: prefix), downscaled so the longest edge is <= MAX_DIM.
 * Falls back to the original base64 if canvas processing fails.
 */
export async function normalizeImageToJpegB64(input: File | string): Promise<string> {
  const dataUrl = typeof input === 'string'
    ? (input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`)
    : await fileToDataUrl(input)

  try {
    const img = await loadImage(dataUrl)
    const { width, height } = img
    const scale = Math.min(1, MAX_DIM / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas context')
    // White background in case of transparency (JPEG has no alpha)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return out.split(',')[1] ?? ''
  } catch {
    // Fallback: strip any data prefix and return as-is
    return dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}
