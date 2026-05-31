/**
 * /api/report/collate — POST
 *
 * Collates pre-generated phase PDF sections into one final report.
 * Adds cover page, summary of significant findings, and site info.
 * Emails the report to specified recipients.
 * Uploads to Supabase Storage.
 *
 * Body: {
 *   job:          InspectionJob       — full job with phase.reportPdfB64 populated
 *   coverNotes?:  string              — optional inspector notes for cover
 *   sendTo:       {
 *     client?:    boolean             — email to job.clientEmail
 *     ahj?:       boolean             — email to job.ahjEmail
 *     extras?:    string[]            — additional email addresses
 *   }
 * }
 *
 * Response: {
 *   ok:       true
 *   pdfB64:   string                  — final merged PDF, base64
 *   reportUrl?: string                — Supabase Storage URL
 *   emailsSent: string[]              — addresses that received the report
 *   pageCount:  number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { collatePhasePdfs }           from '@/lib/generate-inspection-report'
import type { InspectionJob }         from '@/lib/inspection-types'
import { createClient }               from '@supabase/supabase-js'

export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

export async function POST(req: NextRequest) {
  let body: {
    job:         InspectionJob
    coverNotes?: string
    sendTo:      { client?: boolean; ahj?: boolean; extras?: string[] }
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { job, coverNotes, sendTo } = body
  if (!job?.id) return NextResponse.json({ error: 'Missing job data' }, { status: 400 })

  try {
    // ── 1. Collate phase PDFs into final report ───────────────────────────────
    console.log(`[collate] Collating report for job ${job.id}`)
    const pdfBuffer = await collatePhasePdfs(job, coverNotes)
    const pdfB64    = pdfBuffer.toString('base64')
    const pageCount = job.phases.reduce((n, p) => n + (p.reportPdfB64 ? 1 : 0), 3) // rough estimate

    // ── 2. Upload to Supabase Storage ─────────────────────────────────────────
    let reportUrl: string | null = null
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (SUPA_URL && SUPA_KEY) {
      try {
        const sb   = createClient(SUPA_URL, SUPA_KEY)
        const path = `inspection-reports/${job.id}-final-${Date.now()}.pdf`
        const { error } = await sb.storage.from('reports').upload(path, pdfBuffer, {
          contentType: 'application/pdf', upsert: true,
        })
        if (!error) {
          const { data } = sb.storage.from('reports').getPublicUrl(path)
          reportUrl = data?.publicUrl ?? null
          await sb.from('inspection_jobs').update({
            report_url: reportUrl, updated_at: new Date().toISOString(),
          }).eq('id', job.id)
        }
      } catch (err) {
        console.warn('[collate] Storage upload failed:', err)
      }
    }

    // ── 3. Build recipient list ───────────────────────────────────────────────
    const recipients = new Set<string>()
    if (sendTo.client && job.clientEmail)  recipients.add(job.clientEmail.toLowerCase())
    if (sendTo.ahj    && job.ahjEmail)     recipients.add(job.ahjEmail.toLowerCase())
    if (sendTo.extras) sendTo.extras.filter(Boolean).forEach(e => recipients.add(e.toLowerCase()))

    // ── 4. Send emails ────────────────────────────────────────────────────────
    const emailsSent: string[] = []
    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.EMAIL_FROM ?? 'info@staircode.app'

    if (resendKey && recipients.size > 0) {
      for (const recipient of Array.from(recipients)) {
        try {
          const isAhj = recipient === job.ahjEmail?.toLowerCase()
          const subject = isAhj
            ? `Building Inspection Report — ${job.address.street}, ${job.address.city} (For Permit Review)`
            : `Building Inspection Report — ${job.address.street}, ${job.address.city}`

          const res = await fetch('https://api.resend.com/emails', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
            body: JSON.stringify({
              from:        fromEmail,
              to:          [recipient],
              subject,
              html:        buildEmailHtml(job, reportUrl, isAhj, coverNotes),
              attachments: [{
                filename:     `inspection-report-${job.address.street.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
                content:      pdfB64,
                content_type: 'application/pdf',
              }],
            }),
          })
          if (res.ok) {
            emailsSent.push(recipient)
            console.log(`[collate] Email sent to ${recipient}`)
          } else {
            console.error('[collate] Email error:', await res.text())
          }
        } catch (err) {
          console.error(`[collate] Failed to email ${recipient}:`, err)
        }
      }
    }

    return NextResponse.json({ ok: true, pdfB64, reportUrl, emailsSent, pageCount })

  } catch (err: any) {
    console.error('[collate] Error:', err)
    return NextResponse.json({ error: err?.message ?? 'Collation failed' }, { status: 500 })
  }
}

// ── Email templates ────────────────────────────────────────────────────────────
function buildEmailHtml(job: InspectionJob, reportUrl: string | null, isAhj: boolean, coverNotes?: string): string {
  const addr    = `${job.address.street}, ${job.address.city}, ${job.address.province}`
  const dateStr = new Date(job.inspectionDate).toLocaleDateString('en-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  let totalFindings = 0, majorCount = 0
  for (const phase of job.phases) {
    for (const mod of phase.modules) {
      for (const f of mod.findings) {
        totalFindings++
        if (f.severity === 'major' || f.severity === 'critical') majorCount++
      }
    }
  }

  const completedPhases = job.phases.filter(p => p.status === 'complete').length
  const totalPhases     = job.phases.length

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#0A1C2E;padding:2rem;text-align:center">
    <div style="font-size:1.5rem;font-weight:800;color:#F29337">stAIrcode</div>
    <div style="color:rgba(255,255,255,0.5);font-size:0.75rem;margin-top:0.2rem">by Just Open Technologies Inc.</div>
  </div>
  <div style="background:#F29337;height:5px"></div>
  <div style="padding:2rem">
    <h2 style="font-size:1.25rem;font-weight:700;color:#0A1C2E;margin:0 0 0.5rem">
      ${isAhj ? 'Building Inspection Report — Permit Review' : 'Your Building Inspection Report'}
    </h2>
    <p style="color:#5E7D9B;margin:0 0 1.5rem;line-height:1.65">
      ${isAhj
        ? `A residential building inspection report for <strong>${addr}</strong> has been submitted for your review.`
        : `The full building inspection report for <strong>${addr}</strong> is attached as a PDF.`
      }
    </p>

    ${coverNotes ? `<div style="background:#F4F7FB;border-left:3px solid #F29337;padding:0.85rem 1rem;margin-bottom:1.5rem;border-radius:0 8px 8px 0;font-size:0.85rem;color:#3A5A78;line-height:1.65"><strong>Inspector's Note:</strong> ${coverNotes}</div>` : ''}

    <div style="background:#F4F7FB;border-radius:10px;padding:1.25rem;margin-bottom:1.5rem">
      <div style="font-size:0.65rem;font-weight:700;color:#417CA4;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.75rem">Report Summary</div>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <tr><td style="padding:0.3rem 0;color:#5E7D9B;width:45%">Property</td><td style="color:#0D1E2E;font-weight:600">${addr}</td></tr>
        <tr><td style="padding:0.3rem 0;color:#5E7D9B">Inspection date</td><td style="color:#0D1E2E;font-weight:600">${dateStr}</td></tr>
        <tr><td style="padding:0.3rem 0;color:#5E7D9B">Inspected by</td><td style="color:#0D1E2E;font-weight:600">${job.inspectorName || 'Inspector'}</td></tr>
        <tr><td style="padding:0.3rem 0;color:#5E7D9B">Phases completed</td><td style="color:#0D1E2E;font-weight:600">${completedPhases} of ${totalPhases}</td></tr>
        <tr><td style="padding:0.3rem 0;color:#5E7D9B">Total observations</td><td style="color:#0D1E2E;font-weight:600">${totalFindings}</td></tr>
        ${majorCount > 0 ? `<tr><td style="padding:0.3rem 0;color:#5E7D9B">Significant findings</td><td style="color:#E84545;font-weight:700">${majorCount} item${majorCount!==1?'s':''} requiring attention</td></tr>` : ''}
        ${job.permitNumber ? `<tr><td style="padding:0.3rem 0;color:#5E7D9B">Permit number</td><td style="color:#0D1E2E;font-weight:600">${job.permitNumber}</td></tr>` : ''}
      </table>
    </div>

    ${majorCount > 0 ? `<div style="background:rgba(232,69,69,0.06);border:1px solid rgba(232,69,69,0.2);border-radius:8px;padding:0.85rem 1rem;margin-bottom:1.25rem;font-size:0.85rem;color:#C44000"><strong>${majorCount} significant finding${majorCount!==1?'s':''}</strong> require${majorCount===1?'s':''} attention. Review the Summary section of the attached report.</div>` : ''}

    <p style="color:#5E7D9B;font-size:0.82rem;line-height:1.65">The full report PDF is attached to this email.${reportUrl ? ` You can also <a href="${reportUrl}" style="color:#417CA4">download it directly</a>.` : ''}</p>

    <a href="${APP_URL}" style="display:inline-block;margin-top:1rem;padding:0.8rem 1.75rem;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.875rem">Open stAIrcode →</a>
  </div>
  <div style="background:#0A1C2E;padding:1.25rem 2rem">
    <p style="margin:0;color:rgba(255,255,255,0.4);font-size:0.7rem;line-height:1.6">
      This report is a visual inspection aid generated by stAIrcode. It does not replace an inspection by a licensed professional. All findings should be verified by qualified tradespeople before action is taken.
    </p>
    <p style="margin:0.5rem 0 0;color:rgba(255,255,255,0.2);font-size:0.62rem">stAIrcode by Just Open Technologies Inc. · staircode.app</p>
  </div>
</div></body></html>`
}
