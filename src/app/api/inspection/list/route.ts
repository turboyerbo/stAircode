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

  let query = sb
    .from('inspection_jobs')
    .select('id, client_name, inspector_name, address_street, address_city, address_province, building_type, estimated_age, status, phase_progress, active_phase, permit_number, inspection_date, report_url, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (userId && email && userId === email) {
    // Same value — query user_id OR inspector_email
    query = query.or(`user_id.eq.${email},inspector_email.eq.${email}`)
  } else if (userId) {
    query = query.or(`user_id.eq.${userId},inspector_email.eq.${userId}`)
  } else if (email) {
    query = query.or(`user_id.eq.${email},inspector_email.eq.${email}`)
  }

  const { data, error } = await query


  if (error) {
    if (error.message?.includes('does not exist') || error.message?.includes('schema cache') || (error as any).code === '42P01') {
      console.warn('[inspection/list] inspection_jobs table not found. Run supabase-migration.sql.')
      return NextResponse.json({ ok: true, jobs: [] })
    }
    console.error('[inspection/list] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, jobs: data ?? [] })
}
