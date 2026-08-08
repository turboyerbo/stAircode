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

export const maxDuration = 20

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ active: false, membership: 'free' }) }

  const email = body.email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ active: false, membership: 'free' })

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return NextResponse.json({ active: false, membership: 'free', error: 'stripe_not_configured' })

  try {
    const stripe = new Stripe(key, { apiVersion: '2024-06-20' })

    // Find the customer(s) with this email
    const customers = await stripe.customers.list({ email, limit: 5 })
    if (!customers.data.length) return NextResponse.json({ active: false, membership: 'free' })

    // Any active or trialing subscription across those customers counts
    for (const cust of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: cust.id, status: 'all', limit: 10 })
      const live = subs.data.find(s => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due')
      if (live) {
        return NextResponse.json({ active: true, status: live.status, membership: 'subscription' })
      }
    }
    return NextResponse.json({ active: false, membership: 'free' })
  } catch (err: any) {
    // On error, don't lock a user out spuriously — report inconclusive as free
    // but include the error so we can see it in logs.
    console.error('[subscription/status] error:', err?.message)
    return NextResponse.json({ active: false, membership: 'free', error: 'lookup_failed' })
  }
}
