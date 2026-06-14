/**
 * /api/inspection/save — POST
 *
 * Upserts an InspectionJob to Supabase inspection_jobs table.
 * Called automatically when the user saves a phase or module,
 * and explicitly from the dashboard.
 *
 * Body: { job: InspectionJob, userId?: string }
 * Response: { ok: true, id: string } | { error: string }
 *
 * Supabase table schema (inspection_jobs):
 *   id               text PRIMARY KEY
 *   user_id          text
 *   client_name      text
 *   inspector_name   text
 *   address_street   text
 *   address_city     text
 *   address_province text
 *   address_country  text
 *   building_type    text
 *   estimated_age    text
 *   status           text
 *   phase_progress   int4     -- overall % complete
 *   active_phase     text     -- current phase label
 *   permit_number    text
 *   inspection_date  text
 *   report_url       text
 *   job_json         jsonb    -- full InspectionJob object
 *   created_at       timestamptz
 *   updated_at       timestamptz
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import type { InspectionJob }        from '@/lib/inspection-types'
import { getJobProgress, PHASE_META } from '@/lib/inspection-types'

// Max size for propertyThumbnail stored in the row (~15KB base64)
const THUMBNAIL_MAX_B64_LEN = 20000

export async function POST(req: NextRequest) {
  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY    // must be service role, not anon
  const ANON_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const FINAL_KEY = SUPA_KEY || ANON_KEY                      // prefer service role

  let body: { job: InspectionJob; userId?: string }
  try {
    const text = await req.text()
    if (!text) return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    body = JSON.parse(text)
  } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!SUPA_URL || !FINAL_KEY) {
    console.warn('[save] Supabase env vars not set — writing to local only')
    return NextResponse.json({ ok: true, id: body?.job?.id, cloud: false, local: true })
  }

  const { job, userId } = body
  if (!job?.id) return NextResponse.json({ error: 'Missing job.id' }, { status: 400 })

  const resolvedUserId = (userId || job.userId || job.inspectorEmail || job.clientEmail || '').trim()
  if (!resolvedUserId) {
    console.error('[save] No userId — cannot save')
    return NextResponse.json({ ok: false, cloud: false, error: 'No user identity' }, { status: 400 })
  }

  // Create client with service role key — bypass RLS
  // NOTE: RLS must also be DISABLED on the table (run supabase-fix-rls.sql)
  const sb = createClient(SUPA_URL, FINAL_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        // Explicitly identify as service role so Supabase bypasses RLS checks
        'apikey':        FINAL_KEY,
        'Authorization': `Bearer ${FINAL_KEY}`,
      },
    },
  })

  // Strip photos from job_json — keep only small thumbnail
  const thumbnail = job.propertyThumbnail && job.propertyThumbnail.length <= THUMBNAIL_MAX_B64_LEN
    ? job.propertyThumbnail
    : undefined

  const jobForStorage = {
    ...job,
    propertyThumbnail: thumbnail,
    drawingsData: job.drawingsData ? { ...job.drawingsData, pages: [] } : undefined,
    phases: job.phases.map(phase => ({
      ...phase,
      reportPdfB64: undefined,
      modules: phase.modules.map(mod => ({
        ...mod,
        photos:   (mod.photos   || []).map((_: any, i: number) => `[photo-${i}]`),
        findings: (mod.findings || []).map((f: any) => ({
          ...f,
          photos: (f.photos || []).map((_: any, i: number) => `[photo-${i}]`),
        })),
      })),
    })),
  }

  const activePhase = (job.phases || []).find((p: any) => p.status === 'in_progress')
  const now = new Date().toISOString()

  const row: Record<string, unknown> = {
    id:               job.id,
    user_id:          resolvedUserId,
    inspector_email:  resolvedUserId,
    client_name:      (job.clientName   || '').slice(0, 255),
    inspector_name:   (job.inspectorName || '').slice(0, 255),
    address_street:   (job.address?.street   || '').slice(0, 255),
    address_city:     (job.address?.city     || '').slice(0, 255),
    address_province: (job.address?.province || '').slice(0, 255),
    address_country:  (job.address?.country  || 'Canada').slice(0, 100),
    building_type:    (job.buildingType  || '').slice(0, 100),
    estimated_age:    (job.estimatedAge  || '').slice(0, 100),
    status:           (job.status        || 'active').slice(0, 50),
    phase_progress:   Math.round(getJobProgress(job)),
    active_phase:     activePhase ? (PHASE_META[activePhase.id]?.shortLabel ?? null) : null,
    permit_number:    job.permitNumber ?? null,
    inspection_date:  (job.inspectionDate || now.slice(0,10)).slice(0,20),
    report_url:       job.reportUrl ?? null,
    job_json:         jobForStorage,
    updated_at:       now,
  }

  console.log(`[save] Upserting ${job.id} for user ${resolvedUserId} (key: ${SUPA_KEY ? 'service_role' : 'anon'})`)

  // First attempt: with inspector_email
  let { error } = await sb.from('inspection_jobs').upsert(row, { onConflict: 'id' })

  // If inspector_email column missing, retry without it
  if (error && (error.message.includes('inspector_email') || error.message.includes('column'))) {
    console.warn('[save] inspector_email column missing, retrying without')
    const { inspector_email: _drop, ...rowWithout } = row as any
    ;({ error } = await sb.from('inspection_jobs').upsert(rowWithout, { onConflict: 'id' }))
  }

  if (error) {
    const code = (error as any).code ?? ''
    const msg  = error.message ?? 'Unknown error'
    console.error(`[save] FAILED: ${msg} (code: ${code})`)

    let hint = 'Check Supabase dashboard for errors'
    if (code === '42P01' || msg.includes('does not exist')) {
      hint = 'Run supabase-fix-rls.sql in Supabase SQL Editor'
    } else if (msg.includes('RLS') || msg.includes('policy') || msg.includes('permission') || msg.includes('denied')) {
      hint = 'RLS is blocking writes. Run supabase-fix-rls.sql immediately.'
    } else if (msg.includes('JWT') || msg.includes('auth')) {
      hint = 'Auth error. Ensure SUPABASE_SERVICE_ROLE_KEY is set in Netlify env vars (not the anon key).'
    } else if (msg.includes('too large') || msg.includes('payload')) {
      hint = 'Row too large. The job_json may contain base64 images that were not stripped.'
    }

    return NextResponse.json({ ok: false, cloud: false, id: job.id, error: msg, hint })
  }

  console.log(`[save] ✓ Saved ${job.id} to Supabase`)
  return NextResponse.json({ ok: true, cloud: true, id: job.id })
}
