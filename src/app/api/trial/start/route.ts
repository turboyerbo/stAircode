/**
 * POST /api/trial/start
 * Body: { email: string }
 *
 * Starts a 7-day trial for this email if one doesn't already exist.
 * Idempotent — calling it multiple times never resets an existing trial.
 * Returns the current trial state.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, isValidEmail } from '@/lib/api-auth'

const TRIAL_DAYS = 7

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  const email = body.email?.trim().toLowerCase()
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  try {
    const sb = getServiceClient()

    // Check if trial already exists — never overwrite
    const { data: existing } = await sb
      .from('trials')
      .select('email, trial_start, trial_end, active')
      .eq('email', email)
      .single()

    if (existing) {
      const now      = new Date()
      const trialEnd = new Date(existing.trial_end)
      const expired  = now > trialEnd
      const daysLeft = expired ? 0 : Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)
      if (expired && existing.active) {
        await sb.from('trials').update({ active: false }).eq('email', email)
      }
      return NextResponse.json({ ok: true, isNew: false, active: !expired,
        trialStart: existing.trial_start, trialEnd: existing.trial_end, daysLeft, expired })
    }

    // No trial yet — create one now
    const now      = new Date()
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

    const { error } = await sb.from('trials').insert({
      email,
      trial_start: now.toISOString(),
      trial_end:   trialEnd.toISOString(),
      active:      true,
    })

    if (error) {
      // Race condition — another request beat us; fetch existing
      const { data: race } = await sb
        .from('trials').select('email, trial_start, trial_end, active').eq('email', email).single()
      if (race) {
        const re = new Date(race.trial_end)
        const exp = new Date() > re
        return NextResponse.json({ ok: true, isNew: false, active: !exp,
          trialStart: race.trial_start, trialEnd: race.trial_end,
          daysLeft: exp ? 0 : Math.ceil((re.getTime() - Date.now()) / 86400000), expired: exp })
      }
      throw error
    }

    return NextResponse.json({ ok: true, isNew: true, active: true,
      trialStart: now.toISOString(), trialEnd: trialEnd.toISOString(),
      daysLeft: TRIAL_DAYS, expired: false })

  } catch (err: any) {
    console.error('[trial/start]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
