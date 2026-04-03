/**
 * src/app/api/vision/route.ts
 *
 * POST /api/vision
 * Accepts a base64 JPEG frame + text prompt.
 * Calls Claude claude-sonnet-4-20250514 vision API and returns AI measurement text.
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
const MODEL         = 'claude-sonnet-4-6'

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
  let imageB64: string, prompt: string
  try {
    const body = await req.json()
    imageB64   = body.imageB64
    prompt     = body.prompt
    if (!imageB64 || !prompt) throw new Error('Missing fields')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ── Size guard: Anthropic allows up to 5MB base64 (~3.75MB image) ─────────
  if (imageB64.length > 5_000_000) {
    return NextResponse.json({ error: 'Image too large — max 5MB' }, { status: 413 })
  }

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
        messages: [
          {
            role: 'user',
            content: [
              {
                type:   'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
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
