/**
 * POST /api/report/request
 *
 * Queues a final-report build and returns immediately.
 *
 * Assembling a report (merge sections, upload, email with attachment) takes far
 * longer than Netlify's synchronous function limit, so doing it in the user's
 * request failed in their face with an opaque service-worker error. This route
 * only writes a row and returns, so the button always succeeds. A background
 * worker does the real work and emails the report.
 *
 * Body:   { job, coverNotes?, sendTo }
 * Return: { ok: true, requestId }  (202)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  let body: any
  try {
    const text = await req.text()
    if (!text) return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { job, coverNotes, sendTo, phasePdfs } = body ?? {}
  if (!job?.id) return NextResponse.json({ error: 'Missing job data' }, { status: 400 })

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ error: 'queue_not_configured' }, { status: 503 })
  }

  // Merge any client-held section PDFs into the job before queuing, so the
  // worker has everything it needs and never has to re-run AI analysis.
  const jobForQueue = {
    ...job,
    phases: (job.phases ?? []).map((p: any) => ({
      ...p,
      reportPdfB64: phasePdfs?.[p.id] ?? p.reportPdfB64,
    })),
  }

  try {
    const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
    const { data, error } = await sb.from('report_requests').insert({
      job_id:       job.id,
      status:       'pending',
      payload:      { job: jobForQueue, coverNotes: coverNotes ?? null, sendTo: sendTo ?? {} },
      requested_by: job.inspectorEmail ?? job.clientEmail ?? null,
    }).select('id').single()

    if (error || !data) {
      console.error('[report/request] insert failed:', error?.message)
      return NextResponse.json({ error: 'queue_failed' }, { status: 500 })
    }

    // Nudge the background worker so it starts now rather than waiting for the
    // next sweep. Fire-and-forget: if it does not land, the scheduled sweeper
    // picks the row up anyway, so a report is never lost.
    const base = process.env.URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'
    fetch(`${base}/.netlify/functions/build-report-background`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requestId: data.id }),
    }).catch(() => { /* sweeper will handle it */ })

    return NextResponse.json({ ok: true, requestId: data.id }, { status: 202 })
  } catch (err: any) {
    console.error('[report/request] failed:', err?.message)
    return NextResponse.json({ error: 'queue_failed' }, { status: 500 })
  }
}
