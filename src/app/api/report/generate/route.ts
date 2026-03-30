/**
 * src/app/api/report/generate/route.ts
 *
 * POST /api/report/generate
 *
 * Generates a full compliance report via Claude and emails it immediately.
 * Designed to be fire-and-forget from the client — returns quickly with
 * { ok: true, queued: true } so the user isn't stuck waiting on screen.
 *
 * Body: {
 *   email:        string
 *   measurements: object
 *   fields:       object[]
 *   codeLabel:    string
 *   codeRef:      string
 *   location:     string
 *   isOntario:    boolean
 *   surveyUrl:    string   (optional — appended to email)
 * }
 *
 * Env vars required:
 *   ANTHROPIC_API_KEY
 *   RESEND_API_KEY
 *   EMAIL_FROM
 *   NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'
import { trackServer }               from '@/lib/analytics-server'

// Tell Next.js / Netlify to allow up to 60s for this function
export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-5'
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'
// Default survey link — override via request body or env var
const SURVEY_URL    = process.env.NEXT_PUBLIC_SURVEY_URL ?? 'https://tally.so/r/1AMRbW'

interface FieldResult {
  label:       string
  icon:        string
  value:       number | null
  min?:        number
  max?:        number
  pass:        boolean | null
  clearAbove?: boolean
}

// ── Build the report prompt ────────────────────────────────────────────────────
function buildPrompt(
  fields:    FieldResult[],
  codeLabel: string,
  codeRef:   string,
  location:  string,
  isOntario: boolean
): string {
  const rows = fields.map(f => {
    const val    = f.clearAbove ? 'CLEAR/OPEN' : f.value != null ? `${Math.round(f.value)}mm` : 'Not measured'
    const range  = f.min != null && f.max != null ? `${f.min}–${f.max}mm`
                 : f.min != null ? `≥${f.min}mm`
                 : f.max != null ? `≤${f.max}mm` : 'N/A'
    const status = f.pass === true ? 'PASS' : f.pass === false ? 'FAIL' : 'N/A'
    return `${f.label}: ${val} (required: ${range}) — ${status}`
  }).join('\n')

  const failed = fields.filter(f => f.pass === false)
    .map(f => `${f.label}: measured ${f.value}mm`)
    .join('\n')

  return `You are a professional building code compliance consultant. Write a concise pre-inspection stair assessment report.

LOCATION: ${location || 'Unknown'}
CODE: ${codeLabel} (${codeRef})${isOntario ? ' — Ontario, Canada' : ''}

MEASUREMENTS:
${rows}

${failed ? `FAILED ITEMS:\n${failed}` : 'All measured items passed.'}

Write a professional report with these 5 sections. Plain text only, no markdown, no asterisks.

1. STAIR DESCRIPTION
Brief description of the staircase based on the measurements (2-3 sentences).

2. COMPLIANCE ANALYSIS
For each measured dimension: what was found, what is required, and pass/fail. Be specific with values.

3. APPLICABLE CODE SECTIONS
List the specific ${codeLabel} sections that apply, with a plain-language summary of each requirement.

4. PROBABLE OCCUPANCY & RISK
Most likely occupancy type based on the location and dimensions. Key compliance risks in order of severity.

5. RECOMMENDATION
One clear recommendation: whether a formal inspection is needed, what to fix first, and next steps.

Keep the total report under 600 words. Be direct and professional.`
}

// ── Send email via Resend ──────────────────────────────────────────────────────
async function sendEmail(to: string, reportText: string, codeLabel: string, location: string, surveyUrl: string) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) { console.warn('[report/generate] No RESEND_API_KEY'); return false }

  const from    = process.env.EMAIL_FROM ?? 'info@staircode.app'
  const subject = `Your stAIrcode Compliance Report — ${location || codeLabel}`
  const date    = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:1.5rem 1rem;">

  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:1.5rem 2rem;text-align:center;background-image:repeating-linear-gradient(-45deg,#F29337 0px,#F29337 3px,transparent 3px,transparent 14px);background-size:20px 20px;">
    <div style="background:#0A1C2E;padding:1.25rem;border-radius:10px;">
      <img src="https://staircode.app/logo_orange_transparent.png" alt="stAIrcode" style="height:36px;object-fit:contain;display:block;margin:0 auto 0.5rem;" />
      <h1 style="font-size:1.3rem;font-weight:900;color:#E8F4FF;margin:0 0 0.3rem;letter-spacing:-0.02em;">Stair Compliance Report</h1>
      <p style="font-size:0.78rem;color:#93BAD4;margin:0;">${codeLabel}${location ? ' · ' + location : ''} · ${date}</p>
    </div>
  </div>

  <div style="background:#ffffff;border-left:3px solid #F29337;border-right:3px solid #F29337;padding:2rem;">
    <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:10.5pt;line-height:1.75;color:#0A1C2E;margin:0;">${reportText.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
  </div>

  <div style="background:#0F2438;padding:1.25rem 2rem;text-align:center;">
    <p style="font-size:0.82rem;color:#93BAD4;margin:0 0 1rem;line-height:1.6;">
      How was your experience with stAIrcode?<br>
      <strong style="color:#E8F4FF;">Your feedback helps us improve for the next user.</strong>
    </p>
    <a href="${surveyUrl}" style="display:inline-block;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;font-weight:800;font-size:0.88rem;text-decoration:none;padding:0.85rem 2rem;border-radius:12px;letter-spacing:0.04em;">
      Take a 2-min Survey →
    </a>
  </div>

  <div style="background:#0A1C2E;border-radius:0 0 16px 16px;padding:1rem 2rem;text-align:center;">
    <p style="font-size:0.65rem;color:#4E7A9B;margin:0;line-height:1.7;">
      Pre-inspection AI analysis only — not a certified inspection.<br>
      <a href="${APP_URL}" style="color:#417CA4;">staircode.app</a> · © ${new Date().getFullYear()} stAIrcode Inc.
    </p>
  </div>

</div>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    console.error('[report/generate] Resend error:', await res.text())
    return false
  }
  return true
}

// ── Main handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 503 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { email, fields, codeLabel, codeRef, location, isOntario, surveyUrl } = body
  if (!email || !fields) return NextResponse.json({ error: 'Missing email or fields' }, { status: 400 })

  const prompt = buildPrompt(fields, codeLabel || 'Building Code', codeRef || '', location || '', isOntario || false)

  // ── Call Claude ──────────────────────────────────────────────────────────────
  let reportText = ''
  try {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 1500,   // Reduced from 4096 — keeps response fast and focused
        messages: [{
          role:    'user',
          content: [{
            type: 'text',
            text: prompt,
          }],
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[report/generate] Anthropic error:', err)
      return NextResponse.json({ error: 'AI service error' }, { status: 502 })
    }

    const data = await response.json()
    reportText = data.content?.[0]?.text ?? ''

    if (!reportText) return NextResponse.json({ error: 'Empty report' }, { status: 502 })

  } catch (err) {
    console.error('[report/generate] Fetch error:', err)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 502 })
  }

  // ── Email it ─────────────────────────────────────────────────────────────────
  const emailOk = await sendEmail(
    email,
    reportText,
    codeLabel || 'Building Code',
    location || '',
    surveyUrl || SURVEY_URL
  )

  // Track server-side — captures even if the browser closes before client fires
  await trackServer(email, 'report_generated_server', {
    emailed:    emailOk,
    code_label: codeLabel,
    location:   location || '',
    is_ontario: isOntario || false,
  })

  return NextResponse.json({
    ok:        true,
    emailed:   emailOk,
    reportText,   // also return text so app can show it inline
  })
}
