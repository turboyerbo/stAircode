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
import { getJobProgress, getJobSummary, PHASE_META } from '@/lib/inspection-types'

export async function POST(req: NextRequest) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  let body: { job: InspectionJob; userId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { job, userId } = body
  if (!job?.id) return NextResponse.json({ error: 'Missing job data' }, { status: 400 })

  const sb = createClient(SUPA_URL, SUPA_KEY)

  // Strip base64 photos from job_json to keep the row small
  // Photos are stored separately in Supabase Storage
  const jobForStorage: InspectionJob = {
    ...job,
    phases: job.phases.map(phase => ({
      ...phase,
      modules: phase.modules.map(mod => ({
        ...mod,
        photos: mod.photos.map((_, i) => `[photo-${i}]`), // placeholder
        findings: mod.findings.map(f => ({
          ...f,
          photos: f.photos.map((_, i) => `[photo-${i}]`),
        })),
      })),
    })),
  }

  const activePhase = job.phases.find(p => p.status === 'in_progress')

  const row = {
    id:               job.id,
    user_id:          userId ?? job.userId ?? null,
    client_name:      job.clientName,
    inspector_name:   job.inspectorName,
    address_street:   job.address.street,
    address_city:     job.address.city,
    address_province: job.address.province,
    address_country:  job.address.country,
    building_type:    job.buildingType,
    estimated_age:    job.estimatedAge,
    status:           job.status,
    phase_progress:   getJobProgress(job),
    active_phase:     activePhase ? PHASE_META[activePhase.id].shortLabel : null,
    permit_number:    job.permitNumber ?? null,
    inspection_date:  job.inspectionDate,
    report_url:       job.reportUrl ?? null,
    job_json:         jobForStorage,
    updated_at:       new Date().toISOString(),
  }

  const { error } = await sb.from('inspection_jobs').upsert(row, { onConflict: 'id' })

  if (error) {
    console.error('[inspection/save] Supabase error:', error.message)
    // Table may not exist yet — return success anyway so the job stays in sessionStorage.
    // Run supabase-migration.sql in Supabase SQL Editor to create the table.
    if (error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.code === '42P01') {
      console.warn('[inspection/save] inspection_jobs table not found. Run supabase-migration.sql to create it.')
      return NextResponse.json({ ok: true, id: job.id, warning: 'Table not yet created — job stored locally only' })
    }
    return NextResponse.json({ ok: true, id: job.id, warning: error.message })
  }

  console.log(`[inspection/save] Saved job ${job.id} (${getJobSummary(job)})`)
  return NextResponse.json({ ok: true, id: job.id })
}
