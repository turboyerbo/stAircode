/**
 * Netlify BACKGROUND function — builds and delivers a final inspection report.
 *
 * Why this exists: assembling a report (merge sections, upload, email with a PDF
 * attachment) takes longer than Netlify's ~10s synchronous function limit, so
 * doing it inside the user's request failed with an opaque service-worker error.
 * Functions whose name ends in `-background` return 202 immediately and may run
 * for up to 15 minutes, which is the right primitive for this work.
 *
 * Triggered two ways:
 *   1. Fire-and-forget POST { requestId } from /api/report/request (immediate)
 *   2. The scheduled sweeper, which retries anything left pending or stuck
 *
 * Either way the unit of work is a `report_requests` row, so a failure is a row
 * you can inspect and re-run rather than a dead end for the customer.
 */
import { createClient } from '@supabase/supabase-js'
import { collatePhasePdfs } from '../../src/lib/generate-inspection-report'

const MAX_ATTEMPTS = 3

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function emailHtml(job: any, reportUrl: string | null, coverNotes?: string | null) {
  const addr = `${job?.address?.street ?? ''}, ${job?.address?.city ?? ''}`
  return `<!DOCTYPE html><html><body style="margin:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:1.5rem 1rem;">
    <div style="background:#0A1C2E;border-radius:14px 14px 0 0;padding:1.5rem;text-align:center;">
      <h1 style="font-size:1.25rem;font-weight:800;color:#E8F4FF;margin:0;">Your inspection report</h1>
      <p style="font-size:0.85rem;color:#93BAD4;margin:0.35rem 0 0;">${addr}</p>
    </div>
    <div style="background:#fff;padding:1.75rem;border-left:3px solid #F29337;border-right:3px solid #F29337;">
      <p style="font-size:0.92rem;color:#2C4A66;line-height:1.7;margin:0 0 1rem;">Your building code inspection report is attached as a PDF.</p>
      ${coverNotes ? `<p style="font-size:0.88rem;color:#3A5A78;line-height:1.7;margin:0 0 1rem;">${String(coverNotes).slice(0, 800)}</p>` : ''}
      ${reportUrl ? `<p style="margin:1.25rem 0;"><a href="${reportUrl}" style="display:inline-block;background:#0A1C2E;color:#fff;font-weight:700;text-decoration:none;padding:0.8rem 1.6rem;border-radius:10px;font-size:0.9rem;">Open the report</a></p>` : ''}
      <p style="font-size:0.78rem;color:#5E7D9B;line-height:1.6;margin:1rem 0 0;">This report is a compliance aid and is not a substitute for a professional building inspection.</p>
    </div>
    <div style="background:#0F2438;border-radius:0 0 14px 14px;padding:1rem;text-align:center;">
      <p style="font-size:0.68rem;color:#4E7A9B;margin:0;">stAIrcode &middot; Just Open Technologies Inc.</p>
    </div>
  </div></body></html>`
}

async function buildOne(row: any) {
  const client = sb()
  const { job, coverNotes, sendTo } = row.payload ?? {}

  await client.from('report_requests')
    .update({ status: 'processing', attempts: (row.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', row.id)

  // 1. Assemble the PDF from the pre-generated phase sections.
  // The worker has minutes, so it is the one place enrichment is safe to run.
  const pdfBuffer = await collatePhasePdfs(job, coverNotes ?? undefined, true)
  const pdfB64 = pdfBuffer.toString('base64')

  // 2. Store it, so the email can link to it and we never have to rebuild.
  let reportUrl: string | null = null
  try {
    const path = `inspection-reports/${job.id}-final-${Date.now()}.pdf`
    const { error } = await client.storage.from('reports')
      .upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (!error) {
      reportUrl = client.storage.from('reports').getPublicUrl(path).data?.publicUrl ?? null
      await client.from('inspection_jobs')
        .update({ report_url: reportUrl, updated_at: new Date().toISOString() })
        .eq('id', job.id)
    }
  } catch (err) {
    console.warn('[build-report] storage upload failed:', err)
  }

  // 3. Deliver.
  const recipients = new Set<string>()
  if (sendTo?.client && job.clientEmail) recipients.add(String(job.clientEmail).toLowerCase())
  if (sendTo?.ahj    && job.ahjEmail)    recipients.add(String(job.ahjEmail).toLowerCase())
  for (const e of (sendTo?.extras ?? [])) if (e) recipients.add(String(e).toLowerCase())

  const emailsSent: string[] = []
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM ?? 'info@staircode.app'
  const fileName  = `inspection-report-${String(job?.address?.street ?? 'report').replace(/[^a-zA-Z0-9]/g, '-')}.pdf`

  if (resendKey && recipients.size) {
    for (const to of Array.from(recipients)) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromEmail,
            to: [to],
            subject: `Building Inspection Report — ${job?.address?.street ?? ''}, ${job?.address?.city ?? ''}`,
            html: emailHtml(job, reportUrl, coverNotes),
            attachments: [{ filename: fileName, content: pdfB64, content_type: 'application/pdf' }],
          }),
        })
        if (res.ok) emailsSent.push(to)
        else console.error('[build-report] email error:', await res.text())
      } catch (err) {
        console.error('[build-report] email failed:', err)
      }
    }
  }

  await client.from('report_requests').update({
    status:      'done',
    report_url:  reportUrl,
    emails_sent: emailsSent,
    page_count:  null,
    error:       null,
    updated_at:  new Date().toISOString(),
  }).eq('id', row.id)

  console.log(`[build-report] done ${row.id} -> ${emailsSent.length} email(s)`)
}

export default async (req: Request) => {
  let requestId: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    requestId = body?.requestId ?? null
  } catch { /* sweeper invocation has no body */ }

  const client = sb()

  // Pick up either the specific request, or anything pending / stuck processing.
  let rows: any[] = []
  if (requestId) {
    const { data } = await client.from('report_requests').select('*').eq('id', requestId).limit(1)
    rows = data ?? []
  } else {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data } = await client.from('report_requests')
      .select('*')
      .or(`status.eq.pending,and(status.eq.processing,updated_at.lt.${staleBefore})`)
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(5)
    rows = data ?? []
  }

  for (const row of rows) {
    try {
      await buildOne(row)
    } catch (err: any) {
      const attempts = (row.attempts ?? 0) + 1
      console.error('[build-report] failed', row.id, err?.message)
      await client.from('report_requests').update({
        // Keep it retryable until we have genuinely exhausted attempts.
        status:     attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        error:      String(err?.message ?? err).slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq('id', row.id)
    }
  }

  return new Response(JSON.stringify({ processed: rows.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}
