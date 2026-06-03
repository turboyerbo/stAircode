/**
 * GET /api/trial/status?email=user@example.com
 *
 * Returns the trial status for a given email.
 * Used on app load to enforce the 30-day expiry server-side.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ hasTrial: false, active: false, daysLeft: 0, expired: false })
  }

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ hasTrial: false, active: false, daysLeft: 0, expired: false, noDb: true })
  }

  const sb = createClient(SUPA_URL, SUPA_KEY)
  const { data, error } = await sb
    .from('trials')
    .select('trial_start, trial_end, active')
    .eq('email', email)
    .single()

  if (error || !data) {
    return NextResponse.json({ hasTrial: false, active: false, daysLeft: 0, expired: false })
  }

  const now      = new Date()
  const trialEnd = new Date(data.trial_end)
  const expired  = now > trialEnd
  const daysLeft = expired ? 0 : Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (expired && data.active) {
    await sb.from('trials').update({ active: false }).eq('email', email)
  }

  return NextResponse.json({
    hasTrial: true,
    active:   !expired,
    trialEnd: data.trial_end,
    daysLeft,
    expired,
  })
}
