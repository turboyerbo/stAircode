/**
 * /api/inspection/debug — GET
 * Diagnostic endpoint — returns what Supabase sees for a given email.
 * Only enabled when ?key=debug2025 is present.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'debug2025') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = req.nextUrl.searchParams.get('email') ?? ''

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const results: Record<string, any> = {
    supabase_url_set:      !!SUPA_URL,
    service_key_set:       !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anon_key_set:          !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    email_queried:         email,
  }

  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ ...results, error: 'Supabase not configured' })
  }

  const sb = createClient(SUPA_URL, SUPA_KEY)

  // Check table exists
  const { data: tableCheck, error: tableError } = await sb
    .from('inspection_jobs')
    .select('id, user_id, inspector_email, address_street, updated_at')
    .limit(5)

  results.table_error     = tableError?.message ?? null
  results.total_rows_sample = tableCheck?.length ?? 0
  results.sample_rows     = tableCheck?.map(r => ({
    id: r.id, user_id: r.user_id, inspector_email: r.inspector_email,
    address: r.address_street, updated: r.updated_at
  })) ?? []

  // Query by email
  if (email) {
    const { data: byEmail, error: emailError } = await sb
      .from('inspection_jobs')
      .select('id, user_id, inspector_email, address_street')
      .or(`user_id.eq.${email},inspector_email.eq.${email}`)
    results.email_query_error  = emailError?.message ?? null
    results.email_query_count  = byEmail?.length ?? 0
    results.email_query_rows   = byEmail?.map(r => ({ id: r.id, user_id: r.user_id })) ?? []
  }

  return NextResponse.json(results)
}
