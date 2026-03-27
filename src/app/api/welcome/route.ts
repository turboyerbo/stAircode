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
  const subject = 'Welcome to Staircode — your stair intelligence app'

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
      <div style="font-size:0.6rem; letter-spacing:0.32em; color:#F29337; font-family:monospace; margin-bottom:0.5rem;">▲ STAIRCODE</div>
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
        You're in. Staircode uses your phone's camera and AI to measure staircases and check them against building codes — OBC, NBC, IBC, IRC, and more.
      </p>

      <p style="font-size:0.9rem; color:#2C4A66; line-height:1.7; margin-bottom:0.5rem; font-weight:600;">
        Here's what you can do:
      </p>
      <ul style="padding-left:1.25rem; margin-bottom:1.5rem;">
        <li style="font-size:0.88rem; color:#2C4A66; line-height:1.8; margin-bottom:0.25rem;">📐 &nbsp;Measure riser height, tread depth, handrail height, clear width, and headroom</li>
        <li style="font-size:0.88rem; color:#2C4A66; line-height:1.8; margin-bottom:0.25rem;">✅ &nbsp;Get an instant pass/fail against your local building code</li>
        <li style="font-size:0.88rem; color:#2C4A66; line-height:1.8; margin-bottom:0.25rem;">📄 &nbsp;Generate a full compliance report for $11.99 — emailed as a PDF</li>
        <li style="font-size:0.88rem; color:#2C4A66; line-height:1.8;">🏗️ &nbsp;The AI adapts its language to your background — architect to DIY renovator</li>
      </ul>

      <!-- CTA -->
      <div style="text-align:center; margin: 2rem 0 1.5rem;">
        <a href="${APP_URL}" style="display:inline-block; background: linear-gradient(135deg, #F29337, #C4721E); color:#fff; font-weight:800; font-size:0.95rem; text-decoration:none; padding:0.95rem 2.5rem; border-radius:14px; letter-spacing:0.04em; box-shadow:0 4px 20px rgba(242,147,55,0.35);">
          Open Staircode →
        </a>
      </div>

      <p style="font-size:0.82rem; color:#417CA4; line-height:1.65; text-align:center;">
        You're currently on the <strong>free beta plan</strong>.<br>
        Upgrade to Pro ($38.99/mo) for 20 scans/month and full reports.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#0F2438; border-radius: 0 0 16px 16px; padding: 1.25rem 2rem; text-align:center;">
      <p style="font-size:0.72rem; color:#4E7A9B; line-height:1.7;">
        Questions? Reply to this email or contact us at
        <a href="mailto:info@staircode.app" style="color:#93BAD4;">info@staircode.app</a>
      </p>
      <p style="font-size:0.65rem; color:#2C4A66; margin-top:0.5rem;">
        Staircode Inc. · staircode.app · © ${new Date().getFullYear()}<br>
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
