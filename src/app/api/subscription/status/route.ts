/**
 * POST /api/subscription/status
 *
 * Source-of-truth check: does this email have an ACTIVE Stripe subscription?
 * Login previously derived membership from localStorage only, so a paid user on
 * a new device (or after clearing storage) was wrongly treated as 'free' and
 * locked out. This lets login reconcile membership against Stripe.
 *
 * Body: { email: string }
 * Returns: { active: boolean, status?: string, membership: 'subscription'|'free' }
 */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 20

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ active: false, membership: 'free' }) }

  const email = body.email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ active: false, membership: 'free' })

  // ── 1. Fast path: read the persisted status from Supabase profiles ──────────
  // The Stripe webhook keeps profiles.subscription_active in sync, so this is the
  // source of truth for a returning user and avoids a Stripe round-trip.
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (SUPA_URL && SUPA_KEY) {
    try {
      const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
      const { data } = await sb.from('profiles')
        .select('subscription_active, membership')
        .eq('email', email).maybeSingle()
      if (data?.subscription_active) {
        return NextResponse.json({ active: true, source: 'profiles', membership: 'subscription' })
      }
    } catch { /* fall through to Stripe */ }
  }

  // ── 2. Fallback: check Stripe directly (covers webhook gaps / email mismatch) ─
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return NextResponse.json({ active: false, membership: 'free', error: 'stripe_not_configured' })

  try {
    const stripe = new Stripe(key, { apiVersion: '2024-06-20' })
    const customers = await stripe.customers.list({ email, limit: 5 })
    if (!customers.data.length) return NextResponse.json({ active: false, membership: 'free' })

    for (const cust of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: cust.id, status: 'all', limit: 10 })
      const live = subs.data.find(s => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due')
      if (live) {
        // Backfill profiles so next login uses the fast path
        if (SUPA_URL && SUPA_KEY) {
          try {
            const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
            await sb.from('profiles').upsert({
              email, membership: 'subscription', subscription_active: true,
              stripe_customer_id: cust.id, stripe_subscription_id: live.id,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'email' })
          } catch { /* best-effort backfill */ }
        }
        return NextResponse.json({ active: true, source: 'stripe', status: live.status, membership: 'subscription' })
      }
    }
    return NextResponse.json({ active: false, membership: 'free' })
  } catch (err: any) {
    console.error('[subscription/status] error:', err?.message)
    return NextResponse.json({ active: false, membership: 'free', error: 'lookup_failed' })
  }
}
