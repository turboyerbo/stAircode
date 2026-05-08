/**
 * src/app/api/welcome/route.ts
 *
 * POST /api/welcome
 * Sends a branded welcome email to a new user after their first sign-in.
 *
 * Body: { email: string, name: string }
 *
 * Required env vars:
 *   RESEND_API_KEY     re_xxxx  (resend.com — free: 3,000 emails/month)
 *   EMAIL_FROM         info@staircode.app  (must be verified domain in Resend)
 *   NEXT_PUBLIC_APP_URL  https://staircode.app
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

export async function POST(req: NextRequest) {
  // Rate limit — one welcome email per IP per minute
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.reason }, { status: 429 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    // Resend not configured — log and return 200 so sign-in still completes
    console.warn('[welcome] RESEND_API_KEY not set — skipping welcome email')
    return NextResponse.json({ ok: true, skipped: true })
  }

  let email: string, name: string
  try {
    const body = await req.json()
    email = body.email?.trim()
    name  = body.name?.trim() || email?.split('@')[0] || 'there'
    if (!email || !email.includes('@')) throw new Error('Invalid email')
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const from    = process.env.EMAIL_FROM ?? 'info@staircode.app'
  const subject = 'Your stAIrcode results are ready — get your report free during Beta'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #EBF3FA; color: #0A1C2E; }
  </style>
</head>
<body style="background:#EBF3FA; padding: 2rem 1rem;">

  <div style="max-width:560px; margin:0 auto;">

    <!-- Header -->
    <div style="background: #0A1C2E; border-radius: 16px 16px 0 0; padding: 2rem 2rem 1.5rem; text-align:center; background-image: repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(147,186,212,0.06) 39px,rgba(147,186,212,0.06) 40px), repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(147,186,212,0.06) 39px,rgba(147,186,212,0.06) 40px);">
      <div style="font-size:0.6rem; letter-spacing:0.32em; color:#F29337; font-family:monospace; margin-bottom:0.5rem;"><img src="https://staircode.app/staircode_logo.png" alt="stAIrcode" style="height:44px;object-fit:contain;display:block;margin:0 auto;" /></div>
      <h1 style="font-size:1.6rem; font-weight:900; color:#E8F4FF; letter-spacing:-0.02em; line-height:1.2; margin-bottom:0.5rem;">
        Welcome to Staircode
      </h1>
      <p style="font-size:0.85rem; color:#93BAD4; line-height:1.6;">
        AR + AI stair compliance — right from your phone.
      </p>
    </div>

    <!-- Body card -->
    <div style="background:#ffffff; border-left:4px solid #F29337; border-right:4px solid #F29337; padding: 2rem;">

      <p style="font-size:1rem; color:#0A1C2E; line-height:1.7; margin-bottom:1.25rem;">
        Hi ${name},
      </p>
      <p style="font-size:0.92rem; color:#2C4A66; line-height:1.7; margin-bottom:1.25rem;">
        Hi ${name}, thanks for scanning with stAIrcode. Your pass/fail results are ready — and your full compliance report is waiting for you.
      </p>

      <!-- Beta free callout -->
      <div style="background:linear-gradient(135deg,rgba(39,169,107,0.08),rgba(39,169,107,0.04)); border:1.5px solid rgba(39,169,107,0.3); border-radius:14px; padding:1.25rem 1.5rem; margin-bottom:1.5rem; text-align:center;">
        <div style="font-size:1.1rem; font-weight:900; color:#27A96B; margin-bottom:0.4rem;"> Your report is FREE during Beta</div>
        <p style="font-size:0.85rem; color:#2C4A66; line-height:1.6; margin-bottom:1rem;">
          During our beta period (until June 2026), full PDF compliance reports are completely free. Your report includes all measurements, building code citations, and a pre-inspection summary.
        </p>
        <a href="${APP_URL}" style="display:inline-block; background:linear-gradient(135deg,#F29337,#C4721E); color:#fff; font-weight:800; font-size:1rem; text-decoration:none; padding:0.95rem 2.5rem; border-radius:14px; letter-spacing:0.04em; box-shadow:0 4px 20px rgba(242,147,55,0.4);">
          Get My Free Report →
        </a>
        <div style="font-size:0.72rem; color:#5E7D9B; margin-top:0.75rem;">Your coupon is applied automatically at checkout · No credit card required during beta</div>
      </div>

      <!-- What's in the report -->
      <p style="font-size:0.9rem; color:#2C4A66; line-height:1.7; margin-bottom:0.5rem; font-weight:700;">Your PDF compliance report includes:</p>
      <ul style="padding-left:1.25rem; margin-bottom:1.5rem;">
        <li style="font-size:0.85rem; color:#2C4A66; line-height:1.8; margin-bottom:0.2rem;"> &nbsp;Full stair description with all captured dimensions</li>
        <li style="font-size:0.85rem; color:#2C4A66; line-height:1.8; margin-bottom:0.2rem;"> &nbsp;Detailed pass/fail compliance analysis per item</li>
        <li style="font-size:0.85rem; color:#2C4A66; line-height:1.8; margin-bottom:0.2rem;"> &nbsp;Applicable building code sections cited by reference</li>
        <li style="font-size:0.85rem; color:#2C4A66; line-height:1.8;"> &nbsp;Pre-inspection summary — ready to share with your inspector or contractor</li>
      </ul>

      <!-- Subscription option -->
      <div style="background:#F0F5FA; border-radius:12px; padding:1rem 1.25rem; margin-bottom:0.5rem;">
        <p style="font-size:0.82rem; color:#0A1C2E; font-weight:700; margin-bottom:0.3rem;">Want 60 reports/month?</p>
        <p style="font-size:0.78rem; color:#417CA4; line-height:1.6;">
          Try <strong>stAIrcode Pro</strong> free for one month — 20 scans/month and reports for building managers, condo boards, and real estate professionals. <strong>$199/mo after your free month. Cancel anytime.</strong>
        </p>
        <a href="${APP_URL}/pro" style="display:inline-block; margin-top:0.75rem; font-size:0.8rem; color:#F29337; font-weight:700; text-decoration:none;">
          Learn about Pro →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#0F2438; border-radius: 0 0 16px 16px; padding: 1.25rem 2rem; text-align:center;">
      <p style="font-size:0.72rem; color:#4E7A9B; line-height:1.7;">
        Questions? Reply to this email or contact us at
        <a href="mailto:info@staircode.app" style="color:#93BAD4;">info@staircode.app</a>
      </p>
      <p style="font-size:0.65rem; color:#2C4A66; margin-top:0.5rem;">
        Just Open Technologies Inc. · staircode.app · © ${new Date().getFullYear()}<br>
        You received this because you signed up at staircode.app.
      </p>
    </div>

  </div>
</body>
</html>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from,
        to:      email,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[welcome] Resend error:', errText)
      return NextResponse.json({ error: 'Email send failed' }, { status: 502 })
    }

    console.log(`[welcome] Welcome email sent to ${email}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[welcome] Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
