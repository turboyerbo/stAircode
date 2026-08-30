/**
 * src/app/api/vision/route.ts
 *
 * POST /api/vision
 * Accepts a base64 JPEG frame + text prompt.
 * Calls Claude Sonnet 4.6 (claude-sonnet-4-5) vision API and returns AI measurement text.
 * Used as fallback when WebXR is unavailable.
 *
 * Body: { imageB64: string, prompt: string }
 * Response: { text: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

// Tell Netlify/Vercel to allow up to 30s for vision calls
export const maxDuration = 30

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-5'

export async function POST(req: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip     = getClientIp(req)
  const rl     = rateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: rl.reason ?? 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After':       String(Math.ceil(rl.retryAfterMs / 1000)),
          'X-RateLimit-Reset': String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      }
    )
  }

  // ── Validate API key ───────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  // Accepts a single `imageB64` (legacy) or an `images` array so several photos
  // of the same element are analyzed together for a richer result.
  let images: string[], prompt: string
  try {
    const body = await req.json()
    prompt = body.prompt
    const raw: unknown = body.images ?? body.imageB64
    images = Array.isArray(raw) ? (raw as string[]).filter(Boolean) : (raw ? [raw as string] : [])
    if (!images.length || !prompt) throw new Error('Missing fields')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const MAX_IMAGES = 4
  if (images.length > MAX_IMAGES) images = images.slice(0, MAX_IMAGES)

  const totalSize = images.reduce((n, i) => n + i.length, 0)
  if (images.some(i => i.length > 5_000_000) || totalSize > 12_000_000) {
    return NextResponse.json({ error: 'Images too large - please retake; photos are compressed automatically.' }, { status: 413 })
  }

  function toBlock(b64: string) {
    const cleanB64 = b64.includes('base64,') ? b64.split('base64,')[1] : b64
    const head = cleanB64.slice(0, 12)
    const mediaType =
      head.startsWith('/9j/')  ? 'image/jpeg' :
      head.startsWith('iVBOR') ? 'image/png'  :
      head.startsWith('R0lGO') ? 'image/gif'  :
      head.startsWith('UklGR') ? 'image/webp' :
      'image/jpeg'
    return { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: cleanB64 } }
  }

  const content: any[] = []
  if (images.length === 1) {
    content.push(toBlock(images[0]))
  } else {
    content.push({ type: 'text', text: `You are given ${images.length} photographs of the SAME element, taken from different angles or distances. Consider all of them together and combine what they show into one assessment. If they disagree, say so and explain which view is more reliable.` })
    images.forEach((img, i) => {
      content.push({ type: 'text', text: `Photo ${i + 1}:` })
      content.push(toBlock(img))
    })
  }
  content.push({ type: 'text', text: prompt })

  // ── Call Anthropic ─────────────────────────────────────────────────────────
  try {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[vision] Anthropic error:', response.status, err)
      return NextResponse.json({ error: 'AI service error' }, { status: 502 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    if (!text) return NextResponse.json({ error: 'Empty AI response' }, { status: 502 })

    return NextResponse.json({ text })

  } catch (err) {
    console.error('[vision] Fetch error:', err)
    return NextResponse.json({ error: 'Network error' }, { status: 503 })
  }
}
