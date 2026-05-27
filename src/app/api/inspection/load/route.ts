/**
 * /api/inspection/load — GET ?id=<job_id>
 *
 * Fetches a single InspectionJob from Supabase by ID.
 * Returns the full job_json with all phase/module data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const sb = createClient(SUPA_URL, SUPA_KEY)
  const { data, error } = await sb
    .from('inspection_jobs')
    .select('job_json, updated_at')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, job: data.job_json, updatedAt: data.updated_at })
}
