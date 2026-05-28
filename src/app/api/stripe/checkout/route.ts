/**
 * src/app/api/stripe/checkout/route.ts
 *
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for the stAIrcode subscription:
 *
 *   product: 'subscription'  — $38.99/month recurring (full platform access)
 *   product: 'pro'           — alias for 'subscription' (legacy)
 *
 * All reports (stair, foundation, accessibility, full inspection) are included
 * in the subscription. There are no per-report charges.
 *
 * Body:
 *   { product: 'subscription' | 'pro', email?: string, returnTo?: string }
 *
 * Returns:
 *   { url: string }  ← redirect to Stripe Checkout
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY                sk_live_... or sk_test_...
 *   STRIPE_SUBSCRIPTION_PRICE_ID     price_xxx  ($38.99/month recurring)
 *   NEXT_PUBLIC_APP_URL              https://staircode.app
 *
 * Optional:
 *   STRIPE_BETA_COUPON               Stripe coupon ID auto-applied at checkout
 *                                    (removes or unset to end beta discount period)
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'
import Stripe                        from 'stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  let body: { product?: string; email?: string; returnTo?: string; userEmail?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  // Accept both 'subscription' and legacy 'pro'
  const product    = body.product ?? 'subscription'
  const userEmail  = (body.email ?? body.userEmail ?? '').trim().toLowerCase()
  const returnTo   = body.returnTo ?? '/'

  if (!['subscription', 'pro'].includes(product)) {
    return NextResponse.json({ error: `Unknown product: ${product}` }, { status: 400 })
  }

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({
      error: 'Payment not configured',
      hint:  'Set STRIPE_SECRET_KEY in environment variables',
    }, { status: 503 })
  }

  // Resolve the subscription price
  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID
               ?? process.env.STRIPE_PRO_PRICE_ID   // legacy fallback
  if (!priceId) {
    return NextResponse.json({
      error: 'STRIPE_SUBSCRIPTION_PRICE_ID not set',
      hint:  'Add the $38.99/month recurring price ID from your Stripe dashboard',
    }, { status: 503 })
  }

  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items:           [{ price: priceId, quantity: 1 }],

      // Pre-fill email if we have it
      ...(userEmail ? { customer_email: userEmail } : {}),

      success_url: `${APP_URL}/?payment=success&product=subscription&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}${returnTo.startsWith('/') ? returnTo : '/' + returnTo}?payment=cancelled`,

      subscription_data: {
        metadata: {
          product:   'subscription',
          userEmail: userEmail,
        },
      },

      metadata: {
        product:   'subscription',
        userEmail: userEmail,
      },

      // Allow Stripe-native promo code entry at checkout
      allow_promotion_codes: true,
    }

    // If a beta coupon is configured, auto-apply it
    const betaCoupon = process.env.STRIPE_BETA_COUPON
    if (betaCoupon) {
      sessionParams.discounts = [{ coupon: betaCoupon }]
      // Can't use allow_promotion_codes when discounts is set
      delete sessionParams.allow_promotion_codes
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error('[stripe/checkout] Error:', err)
    return NextResponse.json({ error: err?.message ?? 'Stripe error' }, { status: 502 })
  }
}

// Support GET for simple redirects from links
// e.g. /api/stripe/checkout?product=subscription&email=...
export async function GET(req: NextRequest) {
  const email   = req.nextUrl.searchParams.get('email')   ?? ''
  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? '/'

  // Reuse POST logic
  return POST(new NextRequest(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ product: 'subscription', email, returnTo }),
  }))
}
