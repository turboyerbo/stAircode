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
  const APP_URL_VAL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'
  const subject = 'Welcome to stAIrcode — check your stairs in minutes'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:1.5rem 1rem;">
  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:2rem;text-align:center;background-image:repeating-linear-gradient(-45deg,#F29337 0px,#F29337 3px,transparent 3px,transparent 14px);background-size:20px 20px;">
    <div style="background:#0A1C2E;padding:1.5rem;border-radius:12px;">
      <img src="https://staircode.app/staircode_logo.png" alt="stAIrcode" style="height:44px;display:block;margin:0 auto 0.75rem;" />
      <h1 style="font-size:1.5rem;font-weight:900;color:#E8F4FF;letter-spacing:-0.02em;margin:0 0 0.4rem;">Welcome to stAIrcode</h1>
      <p style="font-size:0.85rem;color:#93BAD4;margin:0;">AI-powered stair compliance — right from your phone.</p>
    </div>
  </div>
  <div style="background:#fff;border-left:3px solid #F29337;border-right:3px solid #F29337;padding:2rem;">
    <p style="font-size:1rem;color:#0A1C2E;line-height:1.7;margin:0 0 1rem;">Hi ${name},</p>
    <p style="font-size:0.92rem;color:#2C4A66;line-height:1.7;margin:0 0 1.5rem;">You are in. stAIrcode uses your phone camera and AI to measure your stairs and check them against local building codes — no tape measure, no technical knowledge required.</p>
    <div style="background:#F4F7FB;border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1.5rem;">
      <p style="font-size:0.85rem;font-weight:700;color:#0A1C2E;margin:0 0 0.75rem;">How it works:</p>
      <p style="font-size:0.82rem;color:#417CA4;line-height:1.7;margin:0 0 0.4rem;">1. Point your camera at your staircase and follow the on-screen guide</p>
      <p style="font-size:0.82rem;color:#417CA4;line-height:1.7;margin:0 0 0.4rem;">2. AI measures riser height, tread depth, stair width, handrail height, and more</p>
      <p style="font-size:0.82rem;color:#417CA4;line-height:1.7;margin:0;">3. Get a pass/fail result and a full PDF compliance report instantly</p>
    </div>
    <div style="text-align:center;margin-bottom:1.5rem;">
      <a href="${APP_URL_VAL}" style="display:inline-block;background:linear-gradient(135deg,#F29337,#C4721E);color:#000;font-weight:800;font-size:1rem;text-decoration:none;padding:0.95rem 2.5rem;border-radius:14px;box-shadow:0 4px 20px rgba(242,147,55,0.4);">Start My First Scan</a>
    </div>
    <div style="background:rgba(39,169,107,0.07);border:1px solid rgba(39,169,107,0.25);border-radius:10px;padding:0.85rem 1rem;">
      <p style="font-size:0.8rem;color:#0A1C2E;font-weight:700;margin:0 0 0.25rem;">Beta program</p>
      <p style="font-size:0.78rem;color:#2C4A66;line-height:1.6;margin:0;">You joined during our beta. Reports are discounted and your feedback shapes what gets built next. Leave a testimonial after your scan to unlock your report for free.</p>
    </div>
  </div>
  <div style="background:#0F2438;border-radius:0 0 16px 16px;padding:1.25rem 2rem;text-align:center;">
    <p style="font-size:0.72rem;color:#4E7A9B;line-height:1.7;margin:0 0 0.4rem;">Questions? Reply to this email or contact <a href="mailto:info@staircode.app" style="color:#93BAD4;">info@staircode.app</a></p>
    <p style="font-size:0.65rem;color:#2C4A66;margin:0;">Just Open Technologies Inc. &middot; staircode.app &middot; &copy; ${new Date().getFullYear()}<br>You received this because you created an account at staircode.app.</p>
  </div>
</div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: email, subject, html }),
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
