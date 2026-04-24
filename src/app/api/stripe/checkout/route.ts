/**
 * src/app/api/stripe/checkout/route.ts
 *
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for:
 *   - $11.99 one-time report purchase    (product: 'report')
 *   - $2.99  photo PDF download            (product: 'photo_report')
 *   - $38.99/mo Pro subscription            (product: 'pro')
 *
 * Body:
 *   { product: 'report' | 'pro', userEmail: string, reportData?: string }
 *
 * reportData is the full generated report text — stored in Stripe metadata
 * so the webhook can email it after payment succeeds.
 *
 * Returns:
 *   { url: string }  ← redirect user to this Stripe Checkout URL
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          sk_live_... or sk_test_...
 *   STRIPE_REPORT_PRICE_ID     price_xxx  (one-time $11.99 price in Stripe)
 *   STRIPE_PRO_PRICE_ID        price_xxx  (recurring $38.99/mo price in Stripe)
 *   NEXT_PUBLIC_APP_URL        https://staircode.app
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
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.reason }, { status: 429 })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { product: string; userEmail?: string; reportData?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { product, userEmail, reportData } = body

  if (!['report', 'photo_report', 'pro'].includes(product)) {
    return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
  }

  // ── Stripe not configured — return test mode response ─────────────────────
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({
      error: 'Payment not configured',
      hint:  'Add STRIPE_SECRET_KEY to environment variables',
    }, { status: 503 })
  }

  // ── Build line items ───────────────────────────────────────────────────────
  const isReport      = product === 'report'
  const isPhotoReport = product === 'photo_report'
  const isPro         = product === 'pro'

  const priceId = isReport      ? process.env.STRIPE_REPORT_PRICE_ID
                : isPhotoReport ? process.env.STRIPE_PHOTO_REPORT_PRICE_ID
                :                 process.env.STRIPE_PRO_PRICE_ID

  const priceLabel = isReport ? 'REPORT' : isPhotoReport ? 'PHOTO_REPORT' : 'PRO'
  if (!priceId) {
    return NextResponse.json({
      error: `STRIPE_${priceLabel}_PRICE_ID not set`,
    }, { status: 503 })
  }

  // Truncate report data to fit Stripe metadata limit (500 chars per value)
  // Full report is stored in reportData_1 + reportData_2 + reportData_3
  const chunks: Record<string, string> = {}
  if (reportData) {
    const chunkSize = 490
    for (let i = 0; i < Math.min(3, Math.ceil(reportData.length / chunkSize)); i++) {
      chunks[`reportData_${i + 1}`] = reportData.slice(i * chunkSize, (i + 1) * chunkSize)
    }
    chunks.reportTotalLength = String(reportData.length)
  }

  // ── Create Checkout session ────────────────────────────────────────────────
  try {
    const session = await stripe.checkout.sessions.create({
      mode:                (isReport || isPhotoReport) ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      customer_email:      userEmail || undefined,
      line_items: [{ price: priceId, quantity: 1 }],

      // Where to send the user after payment
      success_url: `${APP_URL}/?payment=success&product=${product}&session_id={CHECKOUT_SESSION_ID}${isPhotoReport ? '&download=1' : ''}`,
      cancel_url:  `${APP_URL}/?payment=cancelled`,

      metadata: {
        product,
        userEmail: userEmail ?? '',
        ...chunks,
      },

      // Allow promotion codes
      allow_promotion_codes: true,

      // One-time report: don't save card
      ...((isReport || isPhotoReport) ? {} : {
        subscription_data: {
          metadata: { product: 'pro', userEmail: userEmail ?? '' },
          trial_period_days: 7,   // 7-day free trial for Pro
        },
      }),
    })

    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error('[stripe/checkout] Error:', err)
    return NextResponse.json({ error: err?.message ?? 'Stripe error' }, { status: 502 })
  }
}
