/**
 * src/app/api/check/route.ts
 *
 * POST /api/check
 * Runs measurements against the compliance engine (server-side only).
 * The compliance logic in compliance-engine.ts is never sent to the browser.
 *
 * Body: { code: CodeKey, measurements: Measurement[] }
 * Response: ComplianceResult | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { runCompliance, validateInput } from '@/lib/compliance-engine'
import { rateLimit, getClientIp }      from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)

  if (!rl.allowed) {
    return NextResponse.json(
      { error: rl.reason ?? 'Rate limit exceeded' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const { code, measurements } = validateInput(body)
    const result = runCompliance(code, measurements)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Validation failed' }, { status: 422 })
  }
}
