/**
 * src/app/api/report/email/route.ts
 *
 * POST /api/report/email
 *
 * Called after a report is generated and the user taps "Print / Save".
 * Emails the full report as a formatted HTML email via Resend.
 * Marks the purchase credit as used in Supabase.
 *
 * Body:
 *   { email: string, reportText: string, creditId?: string, codeLabel?: string, location?: string }
 *
 * Required env vars:
 *   RESEND_API_KEY
 *   EMAIL_FROM
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  let email: string, reportText: string, creditId: string | undefined,
      codeLabel: string, location: string

  try {
    const body = await req.json()
    email      = body.email?.trim()
    reportText = body.reportText
    creditId   = body.creditId
    codeLabel  = body.codeLabel  || 'Building Code'
    location   = body.location   || ''
    if (!email || !reportText) throw new Error('Missing fields')
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[report/email] RESEND_API_KEY not set')
    return NextResponse.json({ ok: true, skipped: true })
  }

  const from    = process.env.EMAIL_FROM ?? 'info@staircode.app'
  const subject = `Your Staircode Compliance Report — ${location || codeLabel}`
  const dateStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:620px;margin:0 auto;padding:1.5rem 1rem;">

  <!-- Header -->
  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:1.75rem 2rem;text-align:center;background-image:repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(147,186,212,0.06) 39px,rgba(147,186,212,0.06) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(147,186,212,0.06) 39px,rgba(147,186,212,0.06) 40px);">
    <img src="https://staircode.app/logo_orange_transparent.png" alt="stAIrcode" style="height:36px;object-fit:contain;display:block;margin:0 auto 0.5rem;" />
    <h1 style="font-size:1.4rem;font-weight:900;color:#E8F4FF;margin:0 0 0.3rem;letter-spacing:-0.02em;">Stair Compliance Report</h1>
    <p style="font-size:0.78rem;color:#93BAD4;margin:0;">${codeLabel}${location ? ' · ' + location : ''} · ${dateStr}</p>
  </div>

  <!-- Report body -->
  <div style="background:#ffffff;border-left:3px solid #F29337;border-right:3px solid #F29337;padding:2rem;">
    <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:10.5pt;line-height:1.75;color:#0A1C2E;margin:0;">${reportText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>

  <!-- Footer -->
  <div style="background:#0F2438;border-radius:0 0 16px 16px;padding:1.25rem 2rem;text-align:center;">
    <p style="font-size:0.7rem;color:#4E7A9B;margin:0 0 0.4rem;line-height:1.6;">
      This report is a pre-inspection AI analysis only.<br>
      It does not constitute a certified inspection and should not be used as evidence of building code compliance.
    </p>
    <p style="font-size:0.65rem;color:#2C4A66;margin:0;">
      Staircode · <a href="${APP_URL}" style="color:#417CA4;">staircode.app</a> · © ${new Date().getFullYear()} Staircode Inc.
    </p>
  </div>

</div>
</body>
</html>`

  // Send via Resend
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: email, subject, html }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[report/email] Resend error:', err)
      return NextResponse.json({ error: 'Email send failed' }, { status: 502 })
    }

    console.log(`[report/email] Report emailed to ${email}`)

    // Mark the credit as used in Supabase
    if (creditId) {
      const sb = await getSupabaseAdmin()
      if (sb) {
        await sb
          .from('report_purchases')
          .update({ used: true, used_at: new Date().toISOString() })
          .eq('id', creditId)
      }
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[report/email] Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
