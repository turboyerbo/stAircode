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

  // Build teaser — show first ~30% of report, blur/block the rest
  const lines      = reportText.split('\n').filter(Boolean)
  const teaserLines = lines.slice(0, Math.max(4, Math.floor(lines.length * 0.3)))
  const teaserText  = teaserLines.join('\n')
  const blockedCount = lines.length - teaserLines.length

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
    <img src="https://staircode.app/staircode_logo.png" alt="stAIrcode" style="height:40px;object-fit:contain;display:block;margin:0 auto 0.5rem;" />
    <h1 style="font-size:1.4rem;font-weight:900;color:#E8F4FF;margin:0 0 0.3rem;letter-spacing:-0.02em;">Your Stair Compliance Preview</h1>
    <p style="font-size:0.78rem;color:#93BAD4;margin:0;">${codeLabel}${location ? ' · ' + location : ''} · ${dateStr}</p>
  </div>

  <!-- Beta pricing banner -->
  <div style="background:linear-gradient(135deg,#F29337,#C4721E);padding:0.9rem 2rem;text-align:center;">
    <p style="margin:0;font-size:0.88rem;font-weight:800;color:#fff;letter-spacing:0.02em;">
      🎉 Beta Testing Special — Get the full report for
      <span style="text-decoration:line-through;opacity:0.7;font-weight:400;">$7.99</span>
      &nbsp;<span style="font-size:1.1rem;">$2.99</span>
    </p>
  </div>

  <!-- Teaser body -->
  <div style="background:#ffffff;border-left:3px solid #F29337;border-right:3px solid #F29337;padding:2rem 2rem 0;">
    <p style="font-size:0.72rem;font-weight:700;color:#F29337;letter-spacing:0.1em;margin:0 0 1rem;">COMPLIANCE PREVIEW — PARTIAL RESULTS</p>
    <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:10.5pt;line-height:1.75;color:#0A1C2E;margin:0 0 1.5rem;">${teaserText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>

  <!-- Blurred/blocked section -->
  <div style="background:#ffffff;border-left:3px solid #F29337;border-right:3px solid #F29337;padding:0 2rem 0;position:relative;">
    <div style="filter:blur(4px);user-select:none;pointer-events:none;opacity:0.4;padding-bottom:1.5rem;">
      <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:10.5pt;line-height:1.75;color:#0A1C2E;margin:0;">Building code analysis results and dimensional compliance summary with specific measurements for riser height consistency, tread depth variance, stair width clearance, headroom measurement, nosing projection details, and guardrail height assessment follow below. Full citation references to applicable code sections are included along with the pre-inspection summary and recommendations for your contractor or building inspector.</pre>
    </div>
    <!-- Lock overlay -->
    <div style="background:linear-gradient(to bottom,rgba(255,255,255,0),rgba(255,255,255,0.97));height:80px;margin-top:-80px;position:relative;z-index:1;"></div>
    <div style="background:#fff;padding:1.5rem 0 2rem;text-align:center;">
      <div style="font-size:1.5rem;margin-bottom:0.5rem;">🔒</div>
      <p style="font-size:1rem;font-weight:800;color:#0A1C2E;margin:0 0 0.35rem;">
        ${blockedCount > 0 ? blockedCount + ' more lines in your full report' : 'Full compliance analysis available'}
      </p>
      <p style="font-size:0.82rem;color:#5E7D9B;margin:0 0 1.25rem;line-height:1.6;">
        Your full report includes detailed measurements, building code citations,<br>pass/fail analysis, measurement photos, and a pre-inspection summary.
      </p>
      <!-- CTA button -->
      <a href="${APP_URL}/?signin=1" style="display:inline-block;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;font-weight:800;font-size:0.95rem;text-decoration:none;padding:0.9rem 2.25rem;border-radius:14px;letter-spacing:0.04em;box-shadow:0 4px 20px rgba(242,147,55,0.4);margin-bottom:0.75rem;">
        Get Full Report — $2.99 →
      </a>
      <p style="font-size:0.72rem;color:#9BB5C8;margin:0.5rem 0 0;">
        <span style="text-decoration:line-through;opacity:0.6;">Regular price $7.99</span> · Beta testing discount applied automatically
      </p>
    </div>
  </div>

  <!-- What's included -->
  <div style="background:#F0F7FF;border-left:3px solid #F29337;border-right:3px solid #F29337;padding:1.25rem 2rem;">
    <p style="font-size:0.78rem;font-weight:700;color:#0A1C2E;margin:0 0 0.6rem;letter-spacing:0.06em;">YOUR FULL REPORT INCLUDES:</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:0.25rem 0.5rem 0.25rem 0;font-size:0.8rem;color:#2C4A66;width:50%;">✓ All 7 measurement results</td>
        <td style="padding:0.25rem 0;font-size:0.8rem;color:#2C4A66;">✓ Building code citations</td>
      </tr>
      <tr>
        <td style="padding:0.25rem 0.5rem 0.25rem 0;font-size:0.8rem;color:#2C4A66;">✓ Measurement photographs</td>
        <td style="padding:0.25rem 0;font-size:0.8rem;color:#2C4A66;">✓ Pass/fail analysis</td>
      </tr>
      <tr>
        <td style="padding:0.25rem 0.5rem 0.25rem 0;font-size:0.8rem;color:#2C4A66;">✓ Pre-inspection summary</td>
        <td style="padding:0.25rem 0;font-size:0.8rem;color:#2C4A66;">✓ Downloadable PDF</td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="background:#0F2438;border-radius:0 0 16px 16px;padding:1.25rem 2rem;text-align:center;">
    <p style="font-size:0.7rem;color:#4E7A9B;margin:0 0 0.4rem;line-height:1.6;">
      This preview is an AI-assisted pre-inspection analysis only.<br>
      It does not constitute a certified inspection or evidence of building code compliance.
    </p>
    <p style="font-size:0.65rem;color:#2C4A66;margin:0;">
      stAIrcode · <a href="${APP_URL}" style="color:#417CA4;">staircode.app</a>
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
