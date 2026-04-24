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
import { checkScanUsage, incrementScanUsage } from '@/lib/scan-usage'
import { trackServer }               from '@/lib/analytics-server'
import { PostHog }                    from 'posthog-node'

// Tell Next.js / Netlify to allow up to 60s for this function
export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-6'
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

// ── PostHog server client factory ─────────────────────────────────────────────
function makePostHog(): PostHog | null {
  const key  = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
              ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'
  if (!key) return null
  return new PostHog(key, { host })
}
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
async function sendEmail(to: string, reportText: string, codeLabel: string, location: string, surveyUrl: string, frames: Record<string,string> = {}) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) { console.warn('[report/generate] No RESEND_API_KEY'); return false }

  const from    = process.env.EMAIL_FROM ?? 'info@staircode.app'
  const subject = `Your stAIrcode Compliance Report — ${location || codeLabel}`
  const date    = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })


  // Build photo grid HTML if frames were captured
  const frameLabels: Record<string,string> = {
    overview:    'Full Stair View',
    riser_front: 'Riser Height',
    rotate_90:   'Nosing Check',
    nosing:      'Nosing Close-Up',
    handrail:    'Handrail Height',
    alt_angle:   'Stair Width',
    tread_top:   'Tread Depth',
  }
  const frameEntries = Object.entries(frames).filter(([k]) => frameLabels[k] && frames[k])
  // Photo grid: each row = label + measurement reading (inline images blocked by many email clients)
  // Instead we describe what was captured with a visual indicator row
  const photoGridHtml = frameEntries.length > 0 ? `
    <div style="background:#F5F8FA;border-left:3px solid #F29337;border-right:3px solid #F29337;padding:1.5rem 2rem;">
      <h2 style="font-size:0.85rem;font-weight:800;color:#0A1C2E;margin:0 0 0.25rem;letter-spacing:0.05em;text-transform:uppercase;">📸 Measurements Captured</h2>
      <p style="font-size:0.72rem;color:#4E7A9B;margin:0 0 1rem;">The following positions were successfully scanned during this inspection.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#E8F4FF;">
          <th style="padding:0.5rem 0.75rem;font-size:0.65rem;color:#2C5A7A;font-weight:700;text-align:left;font-family:monospace;letter-spacing:0.08em;text-transform:uppercase;">Position</th>
          <th style="padding:0.5rem 0.75rem;font-size:0.65rem;color:#2C5A7A;font-weight:700;text-align:left;font-family:monospace;letter-spacing:0.08em;text-transform:uppercase;">Status</th>
        </tr>
        ${frameEntries.map(([posId], i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#F5F8FA'};">
          <td style="padding:0.5rem 0.75rem;font-size:0.8rem;color:#0A1C2E;font-weight:600;">${frameLabels[posId] ?? posId}</td>
          <td style="padding:0.5rem 0.75rem;font-size:0.75rem;color:#27A96B;font-weight:700;">✓ Captured</td>
        </tr>`).join('')}
      </table>
      <p style="font-size:0.65rem;color:#93BAD4;margin:0.75rem 0 0;font-style:italic;">
        ${frameEntries.length} of 7 measurement positions captured during this inspection.
      </p>
    </div>` : ''
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

  ${photoGridHtml}

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
      <a href="${APP_URL}" style="color:#417CA4;">staircode.app</a> · © ${new Date().getFullYear()} Just Open Technologies Inc.
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
    return null
  }
  const json = await res.json()
  return json.id ?? null  // Resend returns { id: "re_xxxxx" }
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
  // Captured measurement frames (base64 JPEGs keyed by position id)
  let capturedFrames: Record<string,string> = {}
  try { if (body.frames) capturedFrames = JSON.parse(body.frames) } catch {}

  // ── Experiment: print-report ──────────────────────────────────────────────
  // Evaluate server-side so ad-blockers can't interfere with the measurement.
  // The client also evaluates this flag; server is the source of truth.
  const ph = makePostHog()
  let experimentVariant = 'control'
  if (ph && email) {
    try {
      const flag = await ph.getFeatureFlag('print-report', email)
      experimentVariant = (typeof flag === 'string' ? flag : (flag ? 'test' : 'control')) ?? 'control'
      // Send $feature_flag_called so PostHog registers the exposure server-side
      ph.capture({
        distinctId: email,
        event:      '$feature_flag_called',
        properties: {
          '$feature_flag':       'print-report',
          '$feature_flag_response': experimentVariant,
        },
      })
    } catch (err) {
      console.warn('[report/generate] PostHog flag eval failed:', err)
      // Safe default — control variant always works
    }
  }
  // fields is required — email is optional (report still generates, just won't email)
  if (!fields) return NextResponse.json({ error: 'Missing measurement fields' }, { status: 400 })
  const reportEmail = (email || '').toLowerCase().trim()

  // ── Free trial limit: 1 free report per email ─────────────────────────────
  // Pro members bypass this check (paid: true in body)
  const FREE_REPORT_LIMIT = 1
  const isPaid = body.paid === true

  if (!isPaid && reportEmail) {
    const sbUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (sbUrl && sbKey) {
      try {
        // Check existing usage
        const checkRes = await fetch(
          `${sbUrl}/rest/v1/report_usage?select=report_count&email=eq.${encodeURIComponent(reportEmail)}`,
          { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
        )
        if (checkRes.ok) {
          const rows: { report_count: number }[] = await checkRes.json()
          const used = rows[0]?.report_count ?? 0
          if (used >= FREE_REPORT_LIMIT) {
            return NextResponse.json(
              { error: 'trial_exhausted', used, limit: FREE_REPORT_LIMIT },
              { status: 402 }   // 402 Payment Required
            )
          }
        }
      } catch (err) {
        console.warn('[report/generate] Usage check failed — proceeding:', err)
        // Fail open: if Supabase is unreachable, don't block the user
      }
    }
  }

  // ── Scan usage limit ─────────────────────────────────────────────────────────
  // Free tier: FREE_SCAN_LIMIT (3) scans per email. Pro = unlimited.
  // Check BEFORE calling Claude to avoid wasting API credits.
  if (!isPaid && reportEmail) {
    const usage = await checkScanUsage(reportEmail)
    if (!usage.allowed) {
      return NextResponse.json(
        {
          error:      'scan_limit_reached',
          scanCount:  usage.scanCount,
          limit:      usage.limit,
          message:    `You've used all ${usage.limit} free scans. Upgrade to Pro for unlimited inspections.`,
        },
        { status: 402 }
      )
    }
  }

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
        max_tokens: 2500,   // Enough for a quality 5-section report
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
  const emailId = reportEmail
    ? await sendEmail(reportEmail, reportText, codeLabel || 'Building Code', location || '', surveyUrl || SURVEY_URL, capturedFrames)
    : null

  // Track server-side — captures even if the browser closes before client fires
  // Includes experiment variant so PostHog can calculate conversion per arm
  if (ph) {
    ph.capture({
      distinctId: reportEmail || 'anonymous',
      event:      'report_generated_experiment',
      properties: {
        experiment_name:  'print-report',
        variant:          experimentVariant,
        emailed:          !!emailId,
        code_label:       codeLabel,
        location:         location || '',
        is_ontario:       isOntario || false,
        beta:             true,
      },
    })
    await ph.shutdown()  // flush queue before serverless fn exits
  }

  await trackServer(reportEmail || 'anonymous', 'report_generated_server', {
    emailed:          !!emailId,
    code_label:       codeLabel,
    location:         location || '',
    is_ontario:       isOntario || false,
    experiment_variant: experimentVariant,
  })

  // ── Increment scan + report usage counters ──────────────────────────────────
  if (!isPaid && reportEmail) {
    // Increment scan count (non-blocking — fire and forget)
    incrementScanUsage(reportEmail).catch(() => {})

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (sbUrl && sbKey) {
      try {
        await fetch(`${sbUrl}/rest/v1/report_usage`, {
          method: 'POST',
          headers: {
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            email:        reportEmail,
            report_count: 1,
            first_at:     new Date().toISOString(),
            last_at:      new Date().toISOString(),
          }),
        })
        // Note: the upsert increments via DB trigger — see supabase/email_events.sql
        // For now we just record the row; if duplicate, update last_at
        // Full increment via raw SQL patch:
        await fetch(
          `${sbUrl}/rest/v1/rpc/increment_report_usage`,
          {
            method: 'POST',
            headers: {
              apikey: sbKey,
              Authorization: `Bearer ${sbKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_email: reportEmail }),
          }
        )
      } catch (err) {
        console.warn('[report/generate] Usage increment failed:', err)
      }
    }
  }

  return NextResponse.json({
    ok:        true,
    emailed:   !!emailId,
    emailId,
    reportText,
  })
}
