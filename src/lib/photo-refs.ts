/**
 * photo-refs.ts
 *
 * One place that understands every form an inspection photo can take, so the UI
 * and the report generator never disagree about what a photo value means.
 *
 * A stored photo can be:
 *   'sb:inspections/…/x.jpg'  a durable Supabase Storage reference (preferred)
 *   'data:image/…;base64,…'   an inline data URL
 *   '/9j/…' | 'iVBOR…'        raw base64 (legacy, device-local)
 *   'https://…'               an external URL
 *   '[photo-0]'               a legacy placeholder left by the old save step;
 *                             the bytes are not on the server at all
 */

export const PHOTO_REF_PREFIX = 'sb:'

/** A durable Storage reference. */
export function isStorageRef(v?: string | null): boolean {
  return !!v && v.startsWith(PHOTO_REF_PREFIX)
}

/** A legacy placeholder with no real image behind it. */
export function isPlaceholder(v?: string | null): boolean {
  if (!v) return true
  if (isStorageRef(v)) return false
  if (v.startsWith('data:') || v.startsWith('http')) return false
  return v.startsWith('[') || v.startsWith('photo-') || v.length < 100
}

/** Anything we can actually display or embed. */
export function isRenderable(v?: string | null): boolean {
  return !!v && !isPlaceholder(v)
}

/**
 * Browser-usable src for any photo value. Storage refs are served through our
 * own route so <img src> stays synchronous (no signed-URL round-trip).
 */
export function photoSrc(v?: string | null): string {
  if (!v) return ''
  if (isStorageRef(v)) return `/api/photos/get?ref=${encodeURIComponent(v)}`
  if (v.startsWith('data:') || v.startsWith('http')) return v
  if (isPlaceholder(v)) return ''
  const raw  = v.includes('base64,') ? v.split('base64,')[1] : v
  const head = raw.slice(0, 8)
  const mime = head.startsWith('iVBOR') ? 'image/png'
             : head.startsWith('/9j/')  ? 'image/jpeg'
             : head.startsWith('R0lGO') ? 'image/gif'
             : head.startsWith('UklGR') ? 'image/webp'
             : 'image/jpeg'
  return `data:${mime};base64,${raw}`
}

/**
 * Remove duplicates. Photos often appear in both module.photos and
 * finding.photos (they reference the same images), which would otherwise render
 * every thumbnail twice. Compares a cheap fingerprint, not whole base64 strings.
 */
export function dedupePhotos(list: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of list) {
    if (!p) continue
    const key = p.length + ':' + p.slice(0, 64) + p.slice(-32)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

/**
 * The photos to show for a module. Findings normally reference the same images
 * as the module, so we take findings when present and fall back to the module,
 * never merging both.
 */
export function modulePhotos(mod: { photos?: string[]; findings?: { photos?: string[] }[] } | null | undefined): string[] {
  if (!mod) return []
  const fromFindings = (mod.findings ?? []).flatMap(f => f.photos ?? [])
  const chosen = fromFindings.length ? fromFindings : (mod.photos ?? [])
  return dedupePhotos(chosen.filter(isRenderable))
}

/**
 * Upload a raw/base64 photo and get back a durable `sb:` reference.
 * Falls back to the original value if storage is unavailable, so capture never
 * breaks just because uploading failed.
 */
export async function uploadPhoto(imageB64: string, jobId?: string, moduleId?: string): Promise<string> {
  if (!imageB64 || isStorageRef(imageB64) || imageB64.startsWith('http')) return imageB64
  try {
    const res = await fetch('/api/photos/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageB64, jobId, moduleId }),
    })
    if (!res.ok) return imageB64
    const data = await res.json()
    return typeof data?.ref === 'string' && data.ref ? data.ref : imageB64
  } catch {
    return imageB64
  }
}
