/**
 * src/app/api/report/email/route.ts
 *
 * POST /api/report/email
 *
 * Sends a TEASER email — not the full report.
 * Shows:
 *   - Brief stair description (first 2-3 sentences of reportText)
 *   - Pass/fail table per dimension (from fields[])
 *   - Blurred/locked section
 *   - Paywall CTA: "Get Full Report — $2.99"
 *
 * Body:
 *   { email, reportText, fields, codeLabel, location, teaserOnly? }
 *
 * Required env vars:
 *   RESEND_API_KEY
 *   EMAIL_FROM
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  let email: string, reportText: string, fields: any[], codeLabel: string, location: string

  try {
    const body = await req.json()
    email      = body.email?.trim()
    reportText = body.reportText ?? ''
    fields     = Array.isArray(body.fields) ? body.fields : []
    codeLabel  = body.codeLabel  || 'Building Code'
    location   = body.location   || ''
    if (!email) throw new Error('Missing email')
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[report/email] RESEND_API_KEY not set')
    return NextResponse.json({ ok: true, skipped: true })
  }

  const from    = process.env.EMAIL_FROM ?? 'info@staircode.app'
  const subject = `Your stAIrcode Results — ${location || codeLabel}`
  const dateStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── Extract brief description (first 2 sentences of reportText) ──────────────
  const sentences   = reportText.split(/(?<=[.!?])\s+/).filter(Boolean)
  const briefDesc   = sentences.slice(0, 3).join(' ')

  // ── Build pass/fail rows from fields ─────────────────────────────────────────
  const measuredFields = fields.filter((f: any) => f.value != null || f.clearAbove)

  const passColor = '#27A96B'
  const failColor = '#E84545'
  const naColor   = '#9BB5C8'

  const tableRows = measuredFields.map((f: any) => {
    const passed  = f.pass === true  || f.clearAbove === true
    const failed  = f.pass === false
    const status  = f.clearAbove ? 'CLEAR' : passed ? 'PASS' : failed ? 'FAIL' : 'N/A'
    const color   = f.clearAbove ? passColor : passed ? passColor : failed ? failColor : naColor
    const val     = f.value != null ? `${f.value} mm` : f.clearAbove ? 'Clear' : '—'

    return `
      <tr style="border-bottom:1px solid #E5EBF2;">
        <td style="padding:0.7rem 0.75rem;font-size:0.82rem;color:#0D1E2E;font-weight:600;">${f.label ?? f.id}</td>
        <td style="padding:0.7rem 0.75rem;font-size:0.82rem;color:#0D1E2E;text-align:center;">${val}</td>
        <td style="padding:0.7rem 0.75rem;text-align:center;">
          <span style="display:inline-block;padding:0.2rem 0.65rem;border-radius:20px;font-size:0.72rem;font-weight:800;color:#fff;background:${color};letter-spacing:0.06em;">${status}</span>
        </td>
      </tr>`
  }).join('')

  const passCount = measuredFields.filter((f: any) => f.pass === true || f.clearAbove).length
  const failCount = measuredFields.filter((f: any) => f.pass === false).length
  const overallPass = failCount === 0 && measuredFields.length > 0
  const verdictColor  = overallPass ? passColor : failColor
  const verdictLabel  = overallPass ? '✓ COMPLIANT' : '⚠ REVIEW REQUIRED'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:1.5rem 1rem;">

  <!-- Header -->
  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:1.75rem 2rem;text-align:center;">
    <img src="https://staircode.app/staircode_logo.png" alt="stAIrcode" style="height:36px;object-fit:contain;display:block;margin:0 auto 0.5rem;" />
    <h1 style="font-size:1.2rem;font-weight:900;color:#E8F4FF;margin:0 0 0.25rem;letter-spacing:-0.02em;">Your Stair Compliance Results</h1>
    <p style="font-size:0.75rem;color:#93BAD4;margin:0;">${codeLabel}${location ? ' · ' + location : ''} · ${dateStr}</p>
  </div>

  <!-- Beta pricing banner -->
  <div style="background:linear-gradient(135deg,#F29337,#C4721E);padding:0.75rem 2rem;text-align:center;">
    <p style="margin:0;font-size:0.85rem;font-weight:800;color:#fff;">
      🎉 Get your full report for <span style="text-decoration:line-through;opacity:0.65;font-weight:400;">$38.99</span> &nbsp;<strong>$2.99</strong> — Beta testing discount
    </p>
  </div>

  <!-- Overall verdict -->
  <div style="background:#fff;padding:1.25rem 2rem;border-left:4px solid ${verdictColor};border-right:4px solid ${verdictColor};text-align:center;">
    <div style="display:inline-block;padding:0.5rem 1.5rem;background:${overallPass ? 'rgba(39,169,107,0.1)' : 'rgba(232,69,69,0.1)'};border:2px solid ${verdictColor};border-radius:30px;font-size:1.1rem;font-weight:900;color:${verdictColor};letter-spacing:0.06em;">
      ${verdictLabel}
    </div>
    <p style="margin:0.6rem 0 0;font-size:0.8rem;color:#5E7D9B;">${passCount} passed · ${failCount} failed · ${measuredFields.length} measured</p>
  </div>

  <!-- Brief description -->
  ${briefDesc ? `<div style="background:#fff;padding:1rem 2rem;border-left:4px solid #F29337;border-right:4px solid #F29337;">
    <p style="margin:0;font-size:0.82rem;color:#2C4A66;line-height:1.7;">${briefDesc.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
  </div>` : ''}

  <!-- Pass/Fail table -->
  <div style="background:#fff;border-left:4px solid #F29337;border-right:4px solid #F29337;padding:0 0 0.5rem;">
    <div style="padding:0.75rem 1.5rem 0.4rem;">
      <span style="font-size:0.65rem;font-weight:800;letter-spacing:0.14em;color:#F29337;text-transform:uppercase;">Measurement Summary</span>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#F0F5FA;">
          <th style="padding:0.5rem 0.75rem;font-size:0.72rem;font-weight:700;color:#5E7D9B;text-align:left;letter-spacing:0.06em;">DIMENSION</th>
          <th style="padding:0.5rem 0.75rem;font-size:0.72rem;font-weight:700;color:#5E7D9B;text-align:center;letter-spacing:0.06em;">MEASURED</th>
          <th style="padding:0.5rem 0.75rem;font-size:0.72rem;font-weight:700;color:#5E7D9B;text-align:center;letter-spacing:0.06em;">RESULT</th>
        </tr>
      </thead>
      <tbody>${tableRows || '<tr><td colspan="3" style="padding:1rem;text-align:center;color:#9BB5C8;font-size:0.8rem;">No measurements recorded</td></tr>'}</tbody>
    </table>
  </div>

  <!-- Locked / paywall section -->
  <div style="background:#fff;border-left:4px solid #F29337;border-right:4px solid #F29337;padding:0 2rem 0;">
    <!-- Blurred preview text -->
    <div style="filter:blur(3px);user-select:none;padding:1rem 0 0.5rem;opacity:0.45;font-size:0.82rem;color:#2C4A66;line-height:1.7;">
      Detailed compliance analysis with specific code references. Building code section citations for each dimension. Pre-inspection summary and recommendations for your contractor or building inspector. Measurement photographs from each scan position.
    </div>
    <!-- Gradient fade -->
    <div style="height:40px;background:linear-gradient(to bottom,rgba(255,255,255,0),rgba(255,255,255,1));margin-top:-40px;position:relative;"></div>

    <!-- Lock + CTA -->
    <div style="text-align:center;padding:1rem 0 1.75rem;">
      <div style="font-size:1.8rem;margin-bottom:0.5rem;">🔒</div>
      <p style="font-size:0.95rem;font-weight:800;color:#0D1E2E;margin:0 0 0.35rem;">Full report locked</p>
      <p style="font-size:0.78rem;color:#5E7D9B;margin:0 0 1.25rem;line-height:1.6;">
        Your full report includes detailed code citations, measurement photos,<br>and a pre-inspection summary — ready to share with your inspector.
      </p>
      <!-- CTA -->
      <a href="${APP_URL}/?signin=1" style="display:inline-block;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;font-weight:800;font-size:1rem;text-decoration:none;padding:0.85rem 2.5rem;border-radius:14px;letter-spacing:0.04em;box-shadow:0 4px 20px rgba(242,147,55,0.4);">
        Get Full Report — $2.99 →
      </a>
      <p style="font-size:0.68rem;color:#9BB5C8;margin:0.6rem 0 0;">
        <span style="text-decoration:line-through;opacity:0.65;">Regular price $38.99</span> · Beta testing discount applied at checkout
      </p>
    </div>
  </div>

  <!-- What's included -->
  <div style="background:#F0F7FF;border-left:4px solid #F29337;border-right:4px solid #F29337;padding:1.25rem 2rem;">
    <p style="font-size:0.72rem;font-weight:800;color:#0D1E2E;margin:0 0 0.6rem;letter-spacing:0.06em;text-transform:uppercase;">Your full PDF report includes:</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="font-size:0.78rem;color:#2C4A66;padding:0.2rem 0.5rem 0.2rem 0;width:50%;">✓ All measurements with code limits</td>
        <td style="font-size:0.78rem;color:#2C4A66;padding:0.2rem 0;">✓ Building code section citations</td>
      </tr>
      <tr>
        <td style="font-size:0.78rem;color:#2C4A66;padding:0.2rem 0.5rem 0.2rem 0;">✓ Measurement photographs</td>
        <td style="font-size:0.78rem;color:#2C4A66;padding:0.2rem 0;">✓ Pre-inspection summary</td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="background:#0F2438;border-radius:0 0 16px 16px;padding:1.25rem 2rem;text-align:center;">
    <p style="font-size:0.68rem;color:#4E7A9B;margin:0 0 0.4rem;line-height:1.6;">
      This is a pre-inspection AI analysis only. It does not constitute a certified inspection<br>and should not be used as evidence of building code compliance.
    </p>
    <p style="font-size:0.62rem;color:#2C4A66;margin:0;">
      stAIrcode · <a href="${APP_URL}" style="color:#417CA4;">staircode.app</a>
    </p>
  </div>

</div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from, to: email, subject, html }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[report/email] Resend error:', err)
      return NextResponse.json({ error: 'Email send failed' }, { status: 502 })
    }
    console.log(`[report/email] Teaser emailed to ${email}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[report/email] Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
