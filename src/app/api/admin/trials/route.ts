/**
 * /api/admin/trials
 *
 * Admin-only trial → conversion stats. Protected by ADMIN_SECRET.
 *
 * GET /api/admin/trials?secret=xxx
 *   Returns funnel counts and a recent-trials list.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const auth = req.headers.get('x-admin-secret') ?? req.nextUrl.searchParams.get('secret')
  return auth === secret
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb  = createClient(SUPABASE_URL, SUPABASE_KEY)
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000

  const { data: trials, error } = await sb
    .from('trials')
    .select('email, name, trial_start, trial_end, active, subscribed, email_day1_sent, email_day5_sent, email_day7_sent')
    .order('trial_start', { ascending: false })
    .limit(1000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = trials ?? []

  // ── Funnel buckets ──────────────────────────────────────────────────────
  const stats = {
    total:          rows.length,
    subscribed:     0,
    activeTrials:   0,   // not expired, not subscribed
    expiredNoConv:  0,   // expired, never subscribed
    day1:           0,   // 0–1 days in, active
    day2to4:        0,
    day5to6:        0,
    day7plus:       0,   // expired window
    conversionRate: 0,
  }

  const recent: any[] = []

  for (const t of rows) {
    const start    = new Date(t.trial_start).getTime()
    const end      = new Date(t.trial_end).getTime()
    const daysIn   = Math.floor((now - start) / DAY)
    const daysLeft = Math.max(0, Math.ceil((end - now) / DAY))
    const expired  = now > end

    if (t.subscribed) stats.subscribed++
    else if (expired) stats.expiredNoConv++
    else stats.activeTrials++

    if (!t.subscribed && !expired) {
      if (daysIn < 2)       stats.day1++
      else if (daysIn < 5)  stats.day2to4++
      else if (daysIn < 7)  stats.day5to6++
    }
    if (!t.subscribed && expired) stats.day7plus++

    recent.push({
      email:     t.email,
      name:      t.name ?? t.email.split('@')[0],
      daysIn,
      daysLeft,
      expired,
      subscribed: !!t.subscribed,
      trialStart: t.trial_start,
      emailsSent: [
        t.email_day1_sent ? 'D1' : null,
        t.email_day5_sent ? 'D5' : null,
        t.email_day7_sent ? 'D7' : null,
      ].filter(Boolean),
    })
  }

  stats.conversionRate = stats.total > 0
    ? Math.round((stats.subscribed / stats.total) * 1000) / 10
    : 0

  return NextResponse.json({ ok: true, stats, recent: recent.slice(0, 100) })
}
