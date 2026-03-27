/**
 * src/app/api/report/status/route.ts
 *
 * GET /api/report/status?email=user@example.com
 *
 * Returns whether the user has a paid report credit available.
 * Pro users have unlimited reports. Free users get 0 — each costs $11.99.
 *
 * Response:
 *   { canGenerate: boolean, reason: 'pro' | 'credit' | 'none', creditsUsed: number }
 *
 * Purchase records are stored in the Supabase `report_purchases` table.
 * The webhook creates a record when checkout.session.completed fires.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server-side only — NOT the anon key)
 */

import { NextRequest, NextResponse } from 'next/server'

async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  const sb = await getSupabaseAdmin()

  // Supabase not configured — allow generation (graceful degradation for dev/beta)
  if (!sb) {
    return NextResponse.json({ canGenerate: true, reason: 'dev', creditsUsed: 0 })
  }

  try {
    // Check if user has a Pro membership
    const { data: profile } = await sb
      .from('profiles')
      .select('membership')
      .eq('email', email)
      .single()

    if (profile?.membership === 'pro' || profile?.membership === 'enterprise') {
      return NextResponse.json({ canGenerate: true, reason: 'pro', creditsUsed: 0 })
    }

    // Count how many report purchases this user has used
    const { data: purchases, error } = await sb
      .from('report_purchases')
      .select('id, used, created_at')
      .eq('email', email)
      .eq('product', 'report')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[report/status] DB error:', error)
      // Fail open in beta — don't block user if DB has issues
      return NextResponse.json({ canGenerate: true, reason: 'db_error', creditsUsed: 0 })
    }

    const unusedCredit = purchases?.find(p => !p.used)
    const creditsUsed  = purchases?.filter(p => p.used).length ?? 0

    if (unusedCredit) {
      // They have a paid-for-but-not-yet-used credit
      return NextResponse.json({
        canGenerate: true,
        reason:      'credit',
        creditId:    unusedCredit.id,
        creditsUsed,
      })
    }

    // No credits — they need to pay
    return NextResponse.json({ canGenerate: false, reason: 'none', creditsUsed })

  } catch (err) {
    console.error('[report/status] Unexpected error:', err)
    return NextResponse.json({ canGenerate: true, reason: 'error', creditsUsed: 0 })
  }
}
