/**
 * POST /api/account/delete
 *
 * Permanently deletes a user account and all associated data.
 * Requires the user's current Supabase session token for verification.
 *
 * Body: { email: string, accessToken: string }
 * Response: { ok: true } | { ok: false, error: string }
 *
 * What gets deleted:
 *   - Supabase Auth user record (via service role — cascades to auth.identities)
 *   - inspection_jobs rows for this user
 *   - trials / trial_grants rows for this email
 *   - (Photos in storage are orphaned — cleaned by a separate job or ignored)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export const maxDuration = 20

export async function POST(req: NextRequest) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ ok: false, error: 'Service not configured' }, { status: 503 })
  }

  let email: string
  let accessToken: string
  try {
    const body = await req.json()
    email       = (body.email ?? '').trim().toLowerCase()
    accessToken = (body.accessToken ?? '').trim()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }

  if (!email || !accessToken) {
    return NextResponse.json({ ok: false, error: 'Email and session token required' }, { status: 400 })
  }

  // ── Verify the session token belongs to this email ─────────────────────────
  const anonSb = createClient(SUPA_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? SUPA_KEY)
  const { data: { user: sessionUser }, error: sessionErr } = await anonSb.auth.getUser(accessToken)

  if (sessionErr || !sessionUser) {
    return NextResponse.json({ ok: false, error: 'Session invalid — please sign in again before deleting your account.' }, { status: 401 })
  }

  const sessionEmail = (sessionUser.email ?? '').toLowerCase()
  if (sessionEmail !== email) {
    return NextResponse.json({ ok: false, error: 'Session does not match the account being deleted.' }, { status: 403 })
  }

  const userId = sessionUser.id

  // ── Service role client for deletions ─────────────────────────────────────
  const sb = createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Delete in order: data first, then auth user
  const errors: string[] = []

  // 1. Delete inspection jobs
  const { error: jobsErr } = await sb
    .from('inspection_jobs')
    .delete()
    .or(`user_id.eq.${email},inspector_email.eq.${email}`)
  if (jobsErr) errors.push(`jobs: ${jobsErr.message}`)

  // 2. Delete trial records
  const { error: trialErr } = await sb
    .from('trials')
    .delete()
    .eq('email', email)
  if (trialErr) errors.push(`trials: ${trialErr.message}`)

  const { error: grantErr } = await sb
    .from('trial_grants')
    .delete()
    .eq('email', email)
  if (grantErr) {
    // trial_grants table may not exist yet — non-fatal
    console.warn('[account/delete] trial_grants delete:', grantErr.message)
  }

  // 3. Delete the Supabase Auth user (service role required)
  const { error: authErr } = await sb.auth.admin.deleteUser(userId)
  if (authErr) {
    console.error('[account/delete] Auth delete error:', authErr.message)
    return NextResponse.json({ ok: false, error: 'Could not delete account. Please contact support at yerbury@staircode.app' }, { status: 500 })
  }

  if (errors.length) {
    console.warn('[account/delete] Non-fatal errors during cleanup:', errors.join(', '))
  }

  console.log(`[account/delete] Account deleted: ${email} (${userId})`)

  return NextResponse.json({ ok: true })
}
