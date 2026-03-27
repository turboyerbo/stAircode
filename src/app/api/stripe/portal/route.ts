/**
 * src/app/api/stripe/portal/route.ts
 *
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so Pro users can:
 *   - View invoices
 *   - Update payment method
 *   - Cancel subscription
 *
 * Body: { userEmail: string }
 * Returns: { url: string }
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'
import Stripe                        from 'stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })

  const stripe = new Stripe(key, { apiVersion: '2024-06-20' })

  let userEmail: string
  try {
    const body = await req.json()
    userEmail  = body.userEmail
    if (!userEmail) throw new Error('Missing userEmail')
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    // Find the Stripe customer by email
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 })
    if (!customers.data.length) {
      return NextResponse.json({ error: 'No subscription found for this account' }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   customers.data[0].id,
      return_url: `${APP_URL}/`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[portal] Error:', err)
    return NextResponse.json({ error: err?.message ?? 'Portal error' }, { status: 502 })
  }
}
