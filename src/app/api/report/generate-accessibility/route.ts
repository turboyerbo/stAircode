/**
 * /api/report/generate-accessibility/route.ts
 *
 * POST — generates accessibility compliance report:
 *  1. Claude narrative (5-section OBC accessibility report)
 *  2. PDF with purple accent (accessibility module colour)
 *  3. Supabase Storage upload with module_type='accessibility'
 *  4. Email via Resend with PDF attachment
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'
import { generateAccessibilityPDF }  from '@/lib/generate-accessibility-pdf'
import { createClient }              from '@supabase/supabase-js'
import { trackServer }               from '@/lib/analytics-server'
import { canGenerateReport } from '@/lib/subscription'

export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL         = 'claude-sonnet-4-6'
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

function buildPrompt(fields: any[], measurements: any, codeLabel: string, location: string): string {
  const today = new Date().toLocaleDateString('en-CA', { year:'numeric', month:'long', day:'numeric' })
  const rows = fields.map((f: any) => {
    const measured = f.measured != null ? `${f.measured}${typeof f.measured==='number'?' mm':''}` : 'NOT CAPTURED'
    const required = f.required != null ? `${f.required}${typeof f.required==='number'?' mm':''}` : 'N/A'
    const status = f.pass === true ? 'PASS' : f.pass === false ? (f.severity==='critical'?'CRITICAL':'FLAG') : 'N/A'
    return `${f.label}: ${measured} (required: ${required}) — ${status}${f.note?' | '+f.note:''}`
  }).join('\n')

  const category     = measurements.category ?? 'barrier_free_path'
  const overallPass  = measurements.overallPass

  return `You are a licensed accessibility compliance consultant specialising in Ontario Building Code 2024 and AODA requirements. Write a professional AI-assisted accessibility inspection report.

DATE: ${today}
LOCATION: ${location || 'Not specified'}
CODE: ${codeLabel} (OBC 2024 / AODA)
INSPECTION CATEGORY: ${category.replace(/_/g,' ').toUpperCase()}
OVERALL RESULT: ${overallPass === true ? 'PASS' : overallPass === false ? 'FLAGS IDENTIFIED' : 'PARTIALLY ASSESSED'}

COMPLIANCE FIELD RESULTS:
${rows}

Write a professional report with exactly these 5 sections. Plain text only — no markdown, no asterisks, no bullet symbols.

RULES:
- Date is ${today}.
- No placeholder text in brackets.
- No "Prepared By" line.
- Reference OBC 2024 sections precisely (e.g. "OBC s.3.8.1.4", "NFPA 72-2022").
- For each flag: explain the deficiency, the code requirement, and its impact on accessibility.

1. ACCESSIBILITY DESCRIPTION
Brief description of what was inspected based on the category and findings (2-3 sentences).

2. COMPLIANCE ANALYSIS
For each assessed field: measurement found, code requirement, and result. Be specific about OBC section numbers.

3. APPLICABLE CODE SECTIONS
The specific OBC 2024 and AODA sections that apply with plain-language explanations.

4. OCCUPANCY AND RISK PROFILE
Building occupancy type inferred from context. Accessibility risk profile for users with mobility, visual, or hearing disabilities. Priority of remediation items.

5. RECOMMENDATION
Clear recommendation on urgency, what to address first, suggested remediation approaches, and next steps including whether an accessibility audit by a certified consultant is warranted.

Keep under 700 words. Professional, direct, no placeholder text.`
}

async function sendEmail(to: string, pdfBuffer: Buffer|null, pdfUrl: string|null, codeLabel: string, location: string, date: string, category: string, photosCount: number): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return false
  const from = process.env.EMAIL_FROM ?? 'info@staircode.app'
  const catLabel = category.replace(/_/g,' ').replace(/\b\w/g, (c:string) => c.toUpperCase())

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:1.5rem 1rem;">
  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:1.5rem 2rem;text-align:center;background-image:repeating-linear-gradient(-45deg,#7B5EA7 0px,#7B5EA7 3px,transparent 3px,transparent 14px);background-size:20px 20px;">
    <div style="background:#0A1C2E;padding:1.25rem;border-radius:10px;">
      <img src="https://staircode.app/staircode_logo.png" alt="stAIrcode" style="height:36px;object-fit:contain;display:block;margin:0 auto 0.5rem;" />
      <h1 style="font-size:1.3rem;font-weight:900;color:#E8F4FF;margin:0 0 0.3rem;">Accessibility Compliance Report</h1>
      <p style="font-size:0.78rem;color:#93BAD4;margin:0;">${codeLabel}${location?' · '+location:''} · ${date}</p>
      <span style="display:inline-block;margin-top:0.5rem;padding:0.2rem 0.75rem;background:#7B5EA7;color:#fff;font-size:0.65rem;font-weight:800;letter-spacing:0.1em;border-radius:999px;font-family:monospace;">${catLabel}</span>
    </div>
  </div>
  <div style="background:#fff;border-left:3px solid #7B5EA7;border-right:3px solid #7B5EA7;padding:2rem;">
    <p style="font-size:1rem;font-weight:700;color:#0A1C2E;margin:0 0 0.5rem;">Your accessibility compliance report is attached.</p>
    <p style="font-size:0.88rem;color:#5E7D9B;line-height:1.7;margin:0 0 1rem;">The full PDF includes ${photosCount>0?`${photosCount} inspection photo${photosCount!==1?'s':''}`:' your inspection data'}, compliance analysis, OBC citations, and recommendations.</p>
    <div style="background:#F4F7FB;border-radius:10px;padding:1rem 1.25rem;font-size:0.82rem;color:#5E7D9B;line-height:1.6;">
      <strong style="color:#0A1C2E;">Included in this report:</strong><br>
      · Compliance checks per OBC 2024 / AODA<br>
      · Measured vs required dimensions<br>
      · Pass/flag/critical per check<br>
      · Remediation recommendations<br>
      · Applicable code sections cited
    </div>
    ${pdfUrl?`<p style="font-size:0.78rem;color:#5E7D9B;margin-top:1rem;">You can also <a href="${pdfUrl}" style="color:#7B5EA7;font-weight:600;">download the PDF here</a> at any time.</p>`:''}
  </div>
  <div style="background:#0A1C2E;border-radius:0 0 16px 16px;padding:1rem 2rem;text-align:center;">
    <p style="font-size:0.65rem;color:#4E7A9B;margin:0;line-height:1.7;">AI-assisted visual screening — not a certified accessibility audit.<br><a href="${APP_URL}" style="color:#7B5EA7;">staircode.app</a> · © ${new Date().getFullYear()} Just Open Technologies Inc.</p>
  </div>
</div>
</body>
</html>`

  const payload: any = { from, to:[to], subject:`Your stAIrcode Accessibility Report — ${location||codeLabel}`, html }
  if (pdfBuffer) payload.attachments = [{ filename:'staircode-accessibility-report.pdf', content:pdfBuffer.toString('base64'), content_type:'application/pdf' }]

  const res = await fetch('https://api.resend.com/emails', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${resendKey}`}, body:JSON.stringify(payload) })
  if (!res.ok) { console.error('[accessibility/generate] Resend error:', await res.json().catch(()=>({}))); return false }
  const { id } = await res.json().catch(()=>({id:null}))
  console.log(`[accessibility/generate] Email sent ${id}`)
  return true
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error:rl.reason }, { status:429 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error:'API key not configured' }, { status:503 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error:'Invalid request' }, { status:400 }) }

  const { email, measurements, fields, codeLabel, location } = body
  if (!fields || !measurements) return NextResponse.json({ error:'Missing required fields' }, { status:400 })

  const reportEmail = (email || '').toLowerCase().trim()

  // Decode frames
  let frames: Record<string,string> = {}
  if (body.frames) {
    try {
      if (typeof body.frames === 'object') frames = body.frames
      else { let p = JSON.parse(body.frames); if (typeof p === 'string') p = JSON.parse(p); if (p && typeof p==='object') frames = p }
    } catch { frames = {} }
  }
  const frameCount = Object.values(frames).filter((v:any) => v && v.length>100).length

  // Claude narrative
  const prompt = buildPrompt(fields, measurements, codeLabel||'OBC 2024', location||'')
  let reportText = ''
  try {
    const resp = await fetch(ANTHROPIC_API, {
      method:'POST', headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({ model:MODEL, max_tokens:2500, messages:[{ role:'user', content:[{ type:'text', text:prompt }] }] }),
    })
    if (!resp.ok) { console.error('[accessibility] Claude error:', await resp.text()); return NextResponse.json({ error:'AI service error' }, { status:502 }) }
    const data = await resp.json()
    reportText = data.content?.[0]?.text ?? ''
    if (!reportText) return NextResponse.json({ error:'Empty report' }, { status:502 })
  } catch (err) { console.error('[accessibility] Claude fetch:', err); return NextResponse.json({ error:'Report generation failed' }, { status:502 }) }

  // Generate PDF
  const moduleId = `acc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  const date = new Date().toLocaleDateString('en-CA', { year:'numeric', month:'long', day:'numeric' })
  let pdfBuffer: Buffer|null = null
  try {
    pdfBuffer = await generateAccessibilityPDF({ measurements, fields, reportText, codeLabel:codeLabel||'OBC 2024', location:location||'', date, frames, moduleId })
    console.log(`[accessibility] PDF: ${Math.round(pdfBuffer.length/1024)}KB`)
  } catch (err) { console.error('[accessibility] PDF error:', err) }

  // Supabase upload
  let pdfUrl: string|null = null
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (pdfBuffer && SUPA_URL && SUPA_KEY) {
    try {
      const sb = createClient(SUPA_URL, SUPA_KEY)
      const storagePath = `reports/${moduleId}.pdf`
      const { error:upErr } = await sb.storage.from('reports').upload(storagePath, pdfBuffer, { contentType:'application/pdf', upsert:true })
      if (upErr) { console.warn('[accessibility] Upload:', upErr.message) }
      else {
        const { data:urlData } = sb.storage.from('reports').getPublicUrl(storagePath)
        pdfUrl = urlData?.publicUrl ?? null
        await sb.from('report_records').insert({
          id:           moduleId,
          email:        reportEmail,
          module_type:  'accessibility',    // key field for multi-module combining
          code_label:   codeLabel,
          location:     location||'',
          pdf_url:      pdfUrl,
          pdf_size_kb:  Math.round(pdfBuffer.length/1024),
          photos_count: frameCount,
          accessibility_category: measurements.category ?? null,
          overall_pass: measurements.overallPass ?? null,
          created_at:   new Date().toISOString(),
        }).then(({ error }:any) => { if (error) console.warn('[accessibility] report_records:', error.message) })
      }
    } catch (err) { console.error('[accessibility] Supabase:', err) }
  }

  // Send email
  let emailed = false
  if (reportEmail) emailed = await sendEmail(reportEmail, pdfBuffer, pdfUrl, codeLabel||'OBC 2024', location||'', date, measurements.category??'accessibility', frameCount)

  await trackServer(reportEmail||'anonymous', 'accessibility_report_generated', {
    emailed, codeLabel, location:location||'', category:measurements.category, overallPass:measurements.overallPass, frameCount, moduleId,
  })

  return NextResponse.json({ ok:true, emailed, pdfUrl, moduleId, reportText })
}
