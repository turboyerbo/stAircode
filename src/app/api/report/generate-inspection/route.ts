/**
 * /api/report/generate-inspection — POST
 *
 * Generates a full building inspection PDF report and:
 *   1. Emails it to the client and inspector
 *   2. Uploads to Supabase Storage (reports bucket)
 *   3. Returns a base64-encoded PDF for immediate download
 *
 * Can be called at any time during the inspection — generates
 * a report from whatever data exists at that point.
 *
 * Body: { job: InspectionJob }
 */

import { NextRequest, NextResponse }          from 'next/server'
import { generateInspectionReport }           from '@/lib/generate-inspection-report'
import type { InspectionJob }                 from '@/lib/inspection-types'
import { createClient }                       from '@supabase/supabase-js'

export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

export async function POST(req: NextRequest) {
  let body: { job: InspectionJob }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { job } = body
  if (!job?.id) return NextResponse.json({ error: 'Missing job data' }, { status: 400 })

  try {
    // ── 1. Generate PDF ──────────────────────────────────────────────────────
    console.log(`[generate-inspection] Generating report for job ${job.id}`)
    const pdfBuffer = await generateInspectionReport(job)
    const pdfBase64 = pdfBuffer.toString('base64')

    // ── 2. Upload to Supabase Storage ────────────────────────────────────────
    let reportUrl: string | null = null
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (SUPA_URL && SUPA_KEY) {
      try {
        const sb         = createClient(SUPA_URL, SUPA_KEY)
        const fileName   = `inspection-${job.id}-${Date.now()}.pdf`
        const storagePath = `inspection-reports/${fileName}`

        const { error: uploadError } = await sb.storage
          .from('reports')
          .upload(storagePath, pdfBuffer, {
            contentType:  'application/pdf',
            cacheControl: '3600',
            upsert:       true,
          })

        if (!uploadError) {
          const { data: urlData } = sb.storage.from('reports').getPublicUrl(storagePath)
          reportUrl = urlData?.publicUrl ?? null

          // Update the job record with the report URL
          await sb.from('inspection_jobs').update({
            report_url: reportUrl,
            updated_at: new Date().toISOString(),
          }).eq('id', job.id)

          console.log(`[generate-inspection] Report uploaded: ${reportUrl}`)
        }
      } catch (err) {
        console.warn('[generate-inspection] Storage upload failed:', err)
      }
    }

    // ── 3. Email the report ──────────────────────────────────────────────────
    const emailsSent: string[] = []
    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.EMAIL_FROM ?? 'info@staircode.app'
    const recipients = [job.clientEmail, job.inspectorName && job.clientEmail !== job.clientEmail ? undefined : undefined].filter(Boolean) as string[]

    // Send to client email if available
    if (resendKey && job.clientEmail) {
      try {
        const emailHtml = buildEmailHtml(job, reportUrl)
        const res = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
          body: JSON.stringify({
            from:        fromEmail,
            to:          [job.clientEmail],
            subject:     `Building Inspection Report — ${job.address.street}, ${job.address.city}`,
            html:        emailHtml,
            attachments: [{
              filename:    `inspection-report-${job.address.street.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
              content:     pdfBase64,
              content_type: 'application/pdf',
            }],
          }),
        })
        if (res.ok) {
          emailsSent.push(job.clientEmail)
          console.log(`[generate-inspection] Email sent to ${job.clientEmail}`)
        } else {
          const err = await res.text()
          console.error('[generate-inspection] Email error:', err)
        }
      } catch (err) {
        console.error('[generate-inspection] Email failed:', err)
      }
    }

    return NextResponse.json({
      ok:          true,
      pdfBase64,
      reportUrl,
      emailsSent,
      message:     emailsSent.length > 0
                     ? `Report generated and emailed to ${emailsSent.join(', ')}`
                     : 'Report generated. Add a client email address to send by email.',
    })

  } catch (err: any) {
    console.error('[generate-inspection] Error:', err)
    return NextResponse.json({ error: err?.message ?? 'Report generation failed' }, { status: 500 })
  }
}

// ── Email template ────────────────────────────────────────────────────────────
function buildEmailHtml(job: InspectionJob, reportUrl: string | null): string {
  const addr    = `${job.address.street}, ${job.address.city}, ${job.address.province}`
  const dateStr = new Date(job.inspectionDate).toLocaleDateString('en-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  // Count significant findings
  let majorCount = 0, totalFindings = 0
  for (const phase of job.phases) {
    for (const mod of phase.modules) {
      for (const f of mod.findings) {
        totalFindings++
        if (f.severity === 'major' || f.severity === 'critical') majorCount++
      }
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

  <!-- Header -->
  <div style="background:#0A1C2E;padding:2rem 2rem 1.5rem;text-align:center">
    <div style="font-size:1.5rem;font-weight:800;color:#F29337;letter-spacing:-0.02em">stAIrcode</div>
    <div style="color:rgba(255,255,255,0.6);font-size:0.78rem;margin-top:0.25rem">by Just Open Technologies Inc.</div>
  </div>

  <!-- Orange bar -->
  <div style="background:#F29337;height:5px"></div>

  <!-- Body -->
  <div style="padding:2rem">
    <h2 style="font-size:1.3rem;font-weight:700;color:#0A1C2E;margin:0 0 0.5rem">Your Inspection Report is Ready</h2>
    <p style="color:#5E7D9B;margin:0 0 1.5rem;line-height:1.6">The full building inspection report for <strong>${addr}</strong> has been generated and is attached to this email as a PDF.</p>

    <!-- Property summary -->
    <div style="background:#F4F7FB;border-radius:10px;padding:1.25rem;margin-bottom:1.5rem">
      <div style="font-size:0.68rem;font-weight:700;color:#417CA4;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.75rem">Inspection Summary</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B;width:45%">Property</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:600;color:#0D1E2E">${addr}</td>
        </tr>
        <tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B">Date</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:600;color:#0D1E2E">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B">Inspected by</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:600;color:#0D1E2E">${job.inspectorName || 'Inspector'}</td>
        </tr>
        <tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B">Total observations</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:600;color:#0D1E2E">${totalFindings}</td>
        </tr>
        ${majorCount > 0 ? `<tr>
          <td style="padding:0.35rem 0;font-size:0.85rem;color:#5E7D9B">Significant findings</td>
          <td style="padding:0.35rem 0;font-size:0.85rem;font-weight:700;color:#E84545">${majorCount} item${majorCount !== 1 ? 's' : ''} requiring attention</td>
        </tr>` : ''}
      </table>
    </div>

    <p style="color:#5E7D9B;font-size:0.85rem;line-height:1.6">The full report PDF is attached to this email. ${reportUrl ? `You can also <a href="${reportUrl}" style="color:#417CA4">download it here</a>.` : ''}</p>

    ${majorCount > 0 ? `<div style="background:rgba(232,69,69,0.06);border:1px solid rgba(232,69,69,0.2);border-radius:8px;padding:1rem;margin:1rem 0;font-size:0.85rem;color:#C44000">
      <strong>${majorCount} significant finding${majorCount !== 1 ? 's' : ''}</strong> require${majorCount === 1 ? 's' : ''} attention. Please review the Summary section of the report.
    </div>` : ''}

    <a href="${APP_URL}" style="display:inline-block;margin-top:1rem;padding:0.85rem 2rem;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.9rem">Open stAIrcode →</a>
  </div>

  <!-- Footer -->
  <div style="background:#0A1C2E;padding:1.25rem 2rem;margin-top:1.5rem">
    <p style="margin:0;color:rgba(255,255,255,0.45);font-size:0.72rem;line-height:1.6">
      This report was generated by stAIrcode and is a visual inspection aid only. It does not replace an inspection by a licensed professional. All findings should be verified by qualified tradespeople before taking action.
    </p>
    <p style="margin:0.75rem 0 0;color:rgba(255,255,255,0.25);font-size:0.65rem">
      stAIrcode by Just Open Technologies Inc. · staircode.app
    </p>
  </div>
</div>
</body>
</html>`
}
