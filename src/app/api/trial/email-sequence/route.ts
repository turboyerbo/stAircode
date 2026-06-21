/**
 * GET/POST /api/trial/email-sequence
 *
 * Processes the 7-day trial nurture sequence. Designed to be called once a day
 * by a scheduled job (Netlify scheduled function). Idempotent — each user
 * receives each email at most once, tracked by email_dayN_sent columns.
 *
 * Stages (based on full days since trial_start):
 *   day >= 1 and < 5  → day1 onboarding email
 *   day >= 5 and < 7  → day5 urgency email
 *   day >= 7          → day7 trial-ended email
 *
 * Auth: requires the CRON_SECRET env var to match the ?key= param (or
 * x-cron-secret header), so the endpoint can't be triggered by the public.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import { buildTrialEmail, sendEmail } from '@/lib/trial-emails'

export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // if unset, allow (dev) — set it in production
  const key = req.nextUrl.searchParams.get('key') ?? req.headers.get('x-cron-secret') ?? ''
  return key === secret
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000

  // Pull active, unsubscribed trials that may still need an email
  const { data: trials, error } = await sb
    .from('trials')
    .select('email, name, trial_start, trial_end, subscribed, email_day1_sent, email_day5_sent, email_day7_sent')
    .eq('subscribed', false)
    .limit(500)

  if (error) {
    console.error('[email-sequence]', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let sent = 0
  const results: Record<string, number> = { day1: 0, day5: 0, day7: 0 }

  for (const t of trials ?? []) {
    const start   = new Date(t.trial_start).getTime()
    const daysIn  = Math.floor((now - start) / DAY)
    const end     = new Date(t.trial_end).getTime()
    const daysLeft = Math.max(0, Math.ceil((end - now) / DAY))
    const name    = t.name ?? t.email.split('@')[0]

    let stage: 'day1' | 'day5' | 'day7' | null = null
    if (daysIn >= 7 && !t.email_day7_sent)              stage = 'day7'
    else if (daysIn >= 5 && daysIn < 7 && !t.email_day5_sent) stage = 'day5'
    else if (daysIn >= 1 && daysIn < 5 && !t.email_day1_sent) stage = 'day1'

    if (!stage) continue

    // For the day-5 urgency email, fetch what the user has actually built —
    // a real project/report count makes the "look what you'd lose" pull stronger.
    let counts: { projects: number; reports: number } | undefined
    if (stage === 'day5') {
      const email = t.email.toLowerCase()
      const { count: projectCount } = await sb
        .from('inspection_jobs')
        .select('id', { count: 'exact', head: true })
        .or(`user_id.eq.${email},inspector_email.eq.${email}`)
      // Reports = jobs that have a generated report_url
      const { count: reportCount } = await sb
        .from('inspection_jobs')
        .select('id', { count: 'exact', head: true })
        .or(`user_id.eq.${email},inspector_email.eq.${email}`)
        .not('report_url', 'is', null)
      counts = { projects: projectCount ?? 0, reports: reportCount ?? 0 }
    }

    const { subject, html } = buildTrialEmail(stage, name, daysLeft, counts)
    const ok = await sendEmail(t.email, subject, html)
    if (!ok) continue

    const col = stage === 'day1' ? 'email_day1_sent' : stage === 'day5' ? 'email_day5_sent' : 'email_day7_sent'
    await sb.from('trials').update({ [col]: new Date().toISOString() }).eq('email', t.email)
    sent++
    results[stage]++
  }

  return NextResponse.json({ ok: true, processed: trials?.length ?? 0, sent, results })
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
