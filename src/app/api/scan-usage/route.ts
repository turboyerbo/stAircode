/**
 * src/app/api/scan-usage/route.ts
 *
 * GET /api/scan-usage?email=...
 *
 * Returns the current scan usage for an email address.
 * Used by the HomeTab to display remaining free scans.
 *
 * Response: { scanCount: number, isPro: boolean, limit: number, remaining: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'
import { checkScanUsage, FREE_SCAN_LIMIT } from '@/lib/scan-usage'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const email = req.nextUrl.searchParams.get('email')?.trim()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const usage = await checkScanUsage(email)

  return NextResponse.json({
    scanCount: usage.scanCount,
    isPro:     usage.isPro,
    limit:     FREE_SCAN_LIMIT,
    remaining: usage.isPro ? 999 : Math.max(0, FREE_SCAN_LIMIT - usage.scanCount),
    allowed:   usage.allowed,
  })
}
