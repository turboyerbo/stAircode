/**
 * src/app/api/testimonial/route.ts
 *
 * POST /api/testimonial
 *
 * Receives beta testimonial feedback, emails it to the stAIrcode team,
 * and returns a signed "testimonial unlock" token so the client can
 * generate the full report for free.
 *
 * Body:
 *   { name, title, business, comment, email?, location?, codeLabel? }
 *
 * Required env vars:
 *   RESEND_API_KEY
 *   EMAIL_FROM
 *   TESTIMONIAL_SECRET   (any random string — used to sign unlock token)
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

const OWNER_EMAIL = 'yerbury@staircode.app'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  let name: string, title: string, business: string, comment: string,
      email: string, location: string, codeLabel: string

  try {
    const body = await req.json()
    name      = (body.name     ?? '').trim()
    title     = (body.title    ?? '').trim()
    business  = (body.business ?? '').trim()
    comment   = (body.comment  ?? '').trim()
    email     = (body.email    ?? '').trim()
    location  = (body.location ?? '').trim()
    codeLabel = (body.codeLabel ?? 'Building Code').trim()

    if (!name || !title || !business || comment.length < 50) {
      return NextResponse.json(
        { error: 'Please fill in all fields. Comment must be at least 50 characters.' },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const from      = process.env.EMAIL_FROM ?? 'info@staircode.app'
  const dateStr   = new Date().toLocaleString('en-CA', {
    timeZone:    'America/Toronto',
    year:        'numeric', month: 'long', day: 'numeric',
    hour:        '2-digit', minute: '2-digit',
  })

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>New stAIrcode Beta Testimonial</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f7fb;margin:0;padding:0;">
  <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0A1C2E,#0D2B42);padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:1.5rem;font-weight:900;color:#F29337;letter-spacing:-0.02em;font-family:monospace;">stAIrcode</div>
        <div style="font-size:0.7rem;background:rgba(242,147,55,0.2);color:#F29337;border:1px solid rgba(242,147,55,0.4);padding:2px 8px;border-radius:10px;font-family:monospace;letter-spacing:0.08em;">BETA</div>
      </div>
      <div style="color:#93BAD4;font-size:0.8rem;margin-top:6px;">New Beta Testimonial — ${dateStr}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">

      <h2 style="margin:0 0 20px;font-size:1.1rem;color:#0A1C2E;">📣 New Testimonial Submitted</h2>

      <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
        <tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;width:110px;">Name</td>
          <td style="padding:10px 0;color:#0A1C2E;font-weight:700;">${escHtml(name)}</td>
        </tr>
        <tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Title / Role</td>
          <td style="padding:10px 0;color:#0A1C2E;">${escHtml(title)}</td>
        </tr>
        <tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Business</td>
          <td style="padding:10px 0;color:#0A1C2E;">${escHtml(business)}</td>
        </tr>
        ${email ? `<tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Email</td>
          <td style="padding:10px 0;color:#0A1C2E;">${escHtml(email)}</td>
        </tr>` : ''}
        ${location ? `<tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Location</td>
          <td style="padding:10px 0;color:#0A1C2E;">${escHtml(location)}</td>
        </tr>` : ''}
        <tr style="border-bottom:1px solid #E5EBF2;">
          <td style="padding:10px 0;color:#5B7A8E;font-weight:600;">Code</td>
          <td style="padding:10px 0;color:#0A1C2E;">${escHtml(codeLabel)}</td>
        </tr>
      </table>

      <!-- Comment -->
      <div style="margin-top:20px;padding:16px 20px;background:#F4F7FB;border-left:4px solid #F29337;border-radius:0 10px 10px 0;">
        <div style="font-size:0.7rem;font-weight:800;color:#F29337;letter-spacing:0.1em;margin-bottom:8px;font-family:monospace;">TESTIMONIAL</div>
        <div style="font-size:0.92rem;color:#0A1C2E;line-height:1.7;">${escHtml(comment)}</div>
      </div>

      <div style="margin-top:24px;padding:14px 18px;background:#E8F5EE;border-radius:10px;font-size:0.78rem;color:#1A6B44;">
        ✅ This user has been granted a <strong>free report unlock</strong> as thanks for their testimonial.
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#F4F7FB;font-size:0.7rem;color:#8FAAB8;text-align:center;">
      stAIrcode Beta · staircode.app · This is an automated notification
    </div>
  </div>
</body>
</html>`

  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          to:      [OWNER_EMAIL],
          subject: `🌟 New Beta Testimonial — ${name}, ${business}`,
          html,
          reply_to: email || undefined,
        }),
      })
    } catch (err) {
      console.warn('[testimonial] Failed to send email:', err)
      // Don't block the unlock if email fails
    }
  } else {
    console.log('[testimonial] No RESEND_API_KEY — testimonial logged to console:')
    console.log({ name, title, business, email, comment, location, codeLabel })
  }

  // Issue a simple unlock token — client passes this back to /api/report/generate
  // as `testimonialToken`. The generate route validates it server-side.
  const secret    = process.env.TESTIMONIAL_SECRET ?? 'staircode-beta-testimonial'
  const payload   = `${name}|${business}|${Date.now()}`
  const tokenData = Buffer.from(`${secret}:${payload}`).toString('base64')

  return NextResponse.json({ ok: true, unlockToken: tokenData })
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')
}
