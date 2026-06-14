/**
 * /api/inspection/list — GET ?email=<email>&userId=<id>
 *
 * Returns all InspectionJob summaries for a user.
 * Used to populate the "My Inspections" project list screen.
 *
 * Returns lightweight rows (no job_json) for the list view.
 * Full job_json is only fetched when a user taps "Resume".
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPA_URL || !SUPA_KEY) {
    console.warn('[inspection/list] Supabase not configured — returning empty list')
    return NextResponse.json({ ok: true, jobs: [] })
  }

  const email  = req.nextUrl.searchParams.get('email')
  const userId = req.nextUrl.searchParams.get('userId')

  if (!email && !userId) {
    return NextResponse.json({ error: 'Missing email or userId' }, { status: 400 })
  }

  const sb = createClient(SUPA_URL, SUPA_KEY)

  const searchEmail = email || userId || ''
  if (!searchEmail) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  // Try with inspector_email column first; fall back to user_id only if column missing
  let data: any[] | null = null
  let error: any = null

  const selectCols = 'id, client_name, inspector_name, address_street, address_city, address_province, building_type, estimated_age, status, phase_progress, active_phase, permit_number, inspection_date, report_url, created_at, updated_at, job_json'

  const result1 = await sb
    .from('inspection_jobs')
    .select(selectCols)
    .or(`user_id.eq.${searchEmail},inspector_email.eq.${searchEmail}`)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (result1.error && result1.error.message?.includes('inspector_email')) {
    // Column doesn't exist yet — query user_id only
    console.warn('[inspection/list] inspector_email column missing — querying user_id only')
    const result2 = await sb
      .from('inspection_jobs')
      .select(selectCols)
      .eq('user_id', searchEmail)
      .order('updated_at', { ascending: false })
      .limit(50)
    data  = result2.data
    error = result2.error
  } else {
    data  = result1.data
    error = result1.error
  }

  // Extract address + thumbnail from job_json as fallback when columns are empty
  const jobs = (data ?? []).map((row: any) => {
    const jj = row.job_json ?? {}
    return {
      ...row,
      // Use dedicated columns first, fall back to job_json address fields
      address_street:   row.address_street   || jj.address?.street   || '',
      address_city:     row.address_city     || jj.address?.city      || '',
      address_province: row.address_province || jj.address?.province  || '',
      thumbnail: row.job_json?.propertyThumbnail || null,
      job_json: undefined,  // don't send full job_json to client in list view
    }
  })

  return NextResponse.json({ ok: true, jobs })
}
