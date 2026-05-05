/**
 * src/app/api/discount/verify/route.ts
 *
 * POST /api/discount/verify
 *
 * Validates a discount code and returns an unlock token if valid.
 * The valid code is stored in env var DISCOUNT_CODE (falls back to 'betacode67').
 *
 * Body:   { code: string }
 * Returns: { valid: true, unlockToken: string } | { valid: false, error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  let code: string
  try {
    const body = await req.json()
    code = (body.code ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request' }, { status: 400 })
  }

  // Valid codes — primary from env var, with betacode67 as the default beta code
  const envCode  = (process.env.DISCOUNT_CODE ?? '').toLowerCase()
  const validCodes = new Set(
    ['betacode67', envCode].filter(Boolean)
  )

  if (!validCodes.has(code)) {
    return NextResponse.json(
      { valid: false, error: 'That code isn\'t valid. Check for typos and try again.' },
      { status: 200 }
    )
  }

  // Issue unlock token
  const secret    = process.env.TESTIMONIAL_SECRET ?? 'staircode-beta-testimonial'
  const payload   = `discount|${code}|${Date.now()}`
  const unlockToken = Buffer.from(`${secret}:${payload}`).toString('base64')

  return NextResponse.json({ valid: true, unlockToken })
}
