/**
 * src/app/api/report/generate-foundation/route.ts
 *
 * POST /api/report/generate-foundation
 *
 * Generates a foundation inspection compliance report:
 *  1. Calls Claude to write a professional narrative
 *  2. Generates a foundation-specific PDF via pdf-lib
 *  3. Stores the PDF in Supabase Storage (bucket: reports)
 *  4. Saves a record in report_records with module_type = 'foundation'
 *     (future: combine multiple module PDFs into a full compliance package)
 *  5. Emails the PDF to the user via Resend
 *
 * Body: {
 *   email:         string
 *   measurements:  FoundationMeasurements
 *   fields:        FoundationField[]
 *   codeLabel:     string
 *   location:      string
 *   paid?:         boolean
 *   testimonialToken?: string   (discount code or testimonial token)
 *   frames?:       Record<string, string>  (base64 JPEGs)
 * }
 */

import { NextRequest, NextResponse }  from 'next/server'
import { rateLimit, getClientIp }     from '@/lib/rate-limit'
import { generateFoundationPDF }      from '@/lib/generate-foundation-pdf'
import { createClient }               from '@supabase/supabase-js'
import { trackServer }                from '@/lib/analytics-server'
import { canGenerateReport } from '@/lib/subscription'

export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-5'
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

// ── AI prompt for foundation narrative ────────────────────────────────────────
function buildFoundationPrompt(
  fields:    any[],
  measurements: any,
  codeLabel: string,
  location:  string,
): string {
  const today = new Date().toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const rows = fields.map((f: any) => {
    const val = f.value != null ? `${f.value}${f.unit ? ' ' + f.unit : ''}` : 'NOT CAPTURED'
    const status = f.pass === true ? 'PASS' : f.pass === false ? (f.severity === 'critical' ? 'CRITICAL' : 'FLAG') : 'N/A'
    return `${f.label}: ${val} — ${status}${f.note ? ' (' + f.note + ')' : ''}`
  }).join('\n')

  const criticalFlags = fields.filter((f: any) => f.pass === false && f.severity === 'critical')
    .map((f: any) => f.label).join(', ')

  const wallType = measurements.wallTypeLabel ?? measurements.wallType ?? 'unknown'
  const crackType = measurements.crackType ?? 'none'
  const condition = measurements.overallCondition ?? 'unknown'

  return `You are a licensed building code consultant specialising in foundation inspections. Write a professional AI-assisted foundation inspection report.

DATE: ${today}
LOCATION: ${location || 'Not specified'}
CODE: ${codeLabel}
WALL TYPE: ${wallType}
OVERALL CONDITION: ${condition}
CRACK TYPE: ${crackType}
MOISTURE PRESENT: ${measurements.moisturePresent ? 'Yes' : 'No'}
EFFLORESCENCE: ${measurements.efflorescence ? 'Yes' : 'No'}

COMPLIANCE FIELD RESULTS:
${rows}

${criticalFlags ? `CRITICAL FLAGS: ${criticalFlags}` : 'No critical flags.'}
${measurements.horizontalCrack ? '\nHORIZONTAL CRACK DETECTED — structural emergency.' : ''}

Write a professional report with exactly these 5 sections. Plain text only — no markdown, no asterisks, no bullet symbols.

STRICT RULES:
- Never include placeholder text in brackets.
- The date is ${today}.
- No "Prepared By" line.
- For horizontal cracks: clearly state this is a structural emergency requiring immediate licensed structural engineering assessment.
- For each critical flag: explain the specific deficiency and its structural or code consequence.

1. FOUNDATION DESCRIPTION
Brief description of the foundation based on findings (2-3 sentences).

2. COMPLIANCE ANALYSIS
For each assessed field: what was found, what is required, and the result. Be specific about code references.

3. APPLICABLE CODE SECTIONS
The specific ${codeLabel} sections that apply, with plain-language summaries.

4. STRUCTURAL RISK ASSESSMENT
Structural risk profile based on findings, in order of severity. Occupancy implications.

5. RECOMMENDATION
Clear recommendation: urgency of professional assessment, what to address first, next steps.

Keep under 600 words. Be direct and professional.`
}

// ── Email builder ──────────────────────────────────────────────────────────────
async function sendFoundationEmail(
  to:         string,
  pdfBuffer:  Buffer | null,
  pdfUrl:     string | null,
  codeLabel:  string,
  location:   string,
  date:       string,
  photosCount: number,
): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return false

  const from = process.env.EMAIL_FROM ?? 'info@staircode.app'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:1.5rem 1rem;">

  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:1.5rem 2rem;text-align:center;background-image:repeating-linear-gradient(-45deg,#417CA4 0px,#417CA4 3px,transparent 3px,transparent 14px);background-size:20px 20px;">
    <div style="background:#0A1C2E;padding:1.25rem;border-radius:10px;">
      <img src="https://staircode.app/staircode_logo.png" alt="stAIrcode" style="height:36px;object-fit:contain;display:block;margin:0 auto 0.5rem;" />
      <h1 style="font-size:1.3rem;font-weight:900;color:#E8F4FF;margin:0 0 0.3rem;letter-spacing:-0.02em;">Foundation Inspection Report</h1>
      <p style="font-size:0.78rem;color:#93BAD4;margin:0;">${codeLabel}${location ? ' · ' + location : ''} · ${date}</p>
      <span style="display:inline-block;margin-top:0.5rem;padding:0.2rem 0.75rem;background:#417CA4;color:#fff;font-size:0.65rem;font-weight:800;letter-spacing:0.1em;border-radius:999px;font-family:monospace;">FOUNDATION MODULE</span>
    </div>
  </div>

  <div style="background:#fff;border-left:3px solid #417CA4;border-right:3px solid #417CA4;padding:2rem;">
    <p style="font-size:1rem;font-weight:700;color:#0A1C2E;margin:0 0 0.5rem;">Your foundation inspection report is attached.</p>
    <p style="font-size:0.88rem;color:#5E7D9B;line-height:1.7;margin:0 0 1rem;">
      The full PDF report — including ${photosCount > 0 ? `${photosCount} inspection photo${photosCount !== 1 ? 's' : ''}` : 'your inspection data'}, compliance analysis, crack documentation, and applicable code sections — is attached to this email.
    </p>
    <div style="background:#F4F7FB;border-radius:10px;padding:1rem 1.25rem;font-size:0.82rem;color:#5E7D9B;line-height:1.6;">
      <strong style="color:#0A1C2E;">Included in this report:</strong><br>
      · Inspection photos (wall overview, crack detail, thickness, footing)<br>
      · Pass/flag/critical result per compliance check<br>
      · Crack type, width, and structural significance<br>
      · Moisture and dampproofing assessment<br>
      · Applicable ${codeLabel} code citations<br>
      · Professional assessment recommendations
    </div>
    ${pdfUrl ? `<p style="font-size:0.78rem;color:#5E7D9B;margin-top:1rem;">You can also <a href="${pdfUrl}" style="color:#417CA4;font-weight:600;">download the PDF here</a> at any time.</p>` : ''}
  </div>

  <div style="background:#0A1C2E;border-radius:0 0 16px 16px;padding:1rem 2rem;text-align:center;">
    <p style="font-size:0.65rem;color:#4E7A9B;margin:0;line-height:1.7;">
      AI-assisted visual screening — not a certified building inspection.<br>
      <a href="${APP_URL}" style="color:#417CA4;">staircode.app</a> · © ${new Date().getFullYear()} Just Open Technologies Inc.
    </p>
  </div>

</div>
</body>
</html>`

  const emailPayload: any = {
    from,
    to: [to],
    subject: `Your stAIrcode Foundation Inspection Report — ${location || codeLabel}`,
    html,
  }

  if (pdfBuffer) {
    emailPayload.attachments = [{
      filename:     'staircode-foundation-report.pdf',
      content:      pdfBuffer.toString('base64'),
      content_type: 'application/pdf',
    }]
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body:    JSON.stringify(emailPayload),
  })

  if (!res.ok) { console.error('[foundation/generate] Resend error:', await res.json().catch(() => ({}))); return false }
  const { id } = await res.json().catch(() => ({ id: null }))
  console.log(`[foundation/generate] Email sent ${id}, PDF: ${Math.round((pdfBuffer?.length ?? 0) / 1024)}KB`)
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

  const { email, measurements, fields, codeLabel, location } = body

  if (!fields || !measurements) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const reportEmail = (email || '').toLowerCase().trim()
  const discountCode = body.discountCode ?? body.testimonialToken ?? ''
  const { allowed: isPaid, reason: accessReason } = await canGenerateReport(reportEmail, discountCode)

  // ── Decode frames ──────────────────────────────────────────────────────────
  let capturedFrames: Record<string, string> = {}
  if (body.frames) {
    try {
      if (typeof body.frames === 'object') capturedFrames = body.frames
      else if (typeof body.frames === 'string') {
        let parsed = JSON.parse(body.frames)
        if (typeof parsed === 'string') parsed = JSON.parse(parsed)
        if (parsed && typeof parsed === 'object') capturedFrames = parsed
      }
    } catch { capturedFrames = {} }
  }
  const frameCount = Object.values(capturedFrames).filter((v: any) => v && v.length > 100).length
  console.log(`[foundation/generate] ${frameCount} photo frames`)

  // ── Call Claude for narrative ──────────────────────────────────────────────
  const prompt = buildFoundationPrompt(fields, measurements, codeLabel || 'Building Code', location || '')
  let reportText = ''
  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 2500,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    })
    if (!resp.ok) { console.error('[foundation/generate] Claude error:', await resp.text()); return NextResponse.json({ error: 'AI service error' }, { status: 502 }) }
    const data = await resp.json()
    reportText = data.content?.[0]?.text ?? ''
    if (!reportText) return NextResponse.json({ error: 'Empty report' }, { status: 502 })
  } catch (err) {
    console.error('[foundation/generate] Claude fetch error:', err)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 502 })
  }

  // ── Generate PDF ───────────────────────────────────────────────────────────
  const moduleId = `fnd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generateFoundationPDF({
      measurements, fields, reportText, codeLabel: codeLabel || 'Building Code',
      location: location || '', date, frames: capturedFrames, moduleId,
    })
    console.log(`[foundation/generate] PDF: ${Math.round(pdfBuffer.length / 1024)}KB`)
  } catch (err) {
    console.error('[foundation/generate] PDF error:', err)
  }

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  let pdfUrl: string | null = null
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (pdfBuffer && SUPA_URL && SUPA_KEY) {
    try {
      const sb = createClient(SUPA_URL, SUPA_KEY)
      const storagePath = `reports/${moduleId}.pdf`

      const { error: upErr } = await sb.storage
        .from('reports')
        .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

      if (upErr) {
        console.warn('[foundation/generate] Storage upload failed:', upErr.message)
      } else {
        const { data: urlData } = sb.storage.from('reports').getPublicUrl(storagePath)
        pdfUrl = urlData?.publicUrl ?? null

        // Save report record — module_type = 'foundation' enables multi-module combining
        await sb.from('report_records').insert({
          id:           moduleId,
          email:        reportEmail,
          module_type:  'foundation',      // ← key field for future combining
          code_label:   codeLabel,
          location:     location || '',
          pdf_url:      pdfUrl,
          pdf_size_kb:  Math.round(pdfBuffer.length / 1024),
          photos_count: frameCount,
          wall_type:    measurements.wallType ?? null,
          crack_type:   measurements.crackType ?? null,
          overall_condition: measurements.overallCondition ?? null,
          has_horizontal_crack: measurements.horizontalCrack ?? false,
          created_at:   new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.warn('[foundation/generate] report_records insert:', error.message)
        })

        console.log(`[foundation/generate] PDF stored: ${pdfUrl}`)
      }
    } catch (err) {
      console.error('[foundation/generate] Supabase error:', err)
    }
  }

  // ── Send email ─────────────────────────────────────────────────────────────
  let emailed = false
  if (reportEmail) {
    emailed = await sendFoundationEmail(
      reportEmail, pdfBuffer, pdfUrl,
      codeLabel || 'Building Code', location || '', date, frameCount,
    )
  }

  await trackServer(reportEmail || 'anonymous', 'foundation_report_generated', {
    emailed,
    code_label:          codeLabel,
    location:            location || '',
    wall_type:           measurements.wallType,
    overall_condition:   measurements.overallCondition,
    horizontal_crack:    measurements.horizontalCrack,
    frames:              frameCount,
    module_id:           moduleId,
  })

  return NextResponse.json({ ok: true, emailed, pdfUrl, moduleId, reportText })
}
