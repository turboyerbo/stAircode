/**
 * GET /api/report/build-status?id=<requestId>
 * GET /api/report/build-status?jobId=<jobId>   (latest request for that job)
 *
 * Progress for a queued final-report build, so the "your report is being
 * prepared" screen can show real state instead of guessing.
 *
 * Note: /api/report/status is a different, pre-existing route (entitlement
 * check), which is why this lives under its own path.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 15

export async function GET(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get('id')
  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!id && !jobId) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPA_URL || !SUPA_KEY) return NextResponse.json({ status: 'unknown' })

  try {
    const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
    let q = sb.from('report_requests')
      .select('id, status, report_url, emails_sent, page_count, error, created_at, updated_at')
    q = id ? q.eq('id', id) : q.eq('job_id', jobId!)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (error || !data) return NextResponse.json({ status: 'unknown' })
    return NextResponse.json({
      requestId:  data.id,
      status:     data.status,
      reportUrl:  data.report_url,
      emailsSent: data.emails_sent ?? [],
      pageCount:  data.page_count,
      // Surface a short reason, never a stack trace.
      error:      data.status === 'failed' ? (data.error ?? 'Report build failed') : null,
      updatedAt:  data.updated_at,
    })
  } catch {
    return NextResponse.json({ status: 'unknown' })
  }
}
