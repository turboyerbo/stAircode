/**
 * GET /api/trial/status?email=user@example.com
 * Returns the authoritative server-side trial status for an email.
 * Source of truth — takes precedence over any localStorage state.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, isValidEmail } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ hasTrial: false, active: false, daysLeft: 0, expired: false })
  }

  try {
    const sb = getServiceClient()
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
    const daysLeft = expired ? 0 : Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)

    if (expired && data.active) {
      await sb.from('trials').update({ active: false }).eq('email', email)
    }

    return NextResponse.json({
      hasTrial:   true,
      active:     !expired,
      trialStart: data.trial_start,
      trialEnd:   data.trial_end,
      daysLeft,
      expired,
    })
  } catch (err: any) {
    console.error('[trial/status]', err.message)
    return NextResponse.json({ hasTrial: false, active: false, daysLeft: 0, expired: false })
  }
}
