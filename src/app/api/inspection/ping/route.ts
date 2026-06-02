/**
 * /api/inspection/ping — GET
 * Tests Supabase connectivity and returns a diagnostic report.
 * Used by the dashboard save status indicator.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const result: Record<string, any> = {
    supabase_url:          SUPA_URL ? `${SUPA_URL.slice(0,30)}…` : 'NOT SET',
    service_role_key:      SVC_KEY  ? `${SVC_KEY.slice(0,12)}…` : 'NOT SET ← this is the problem',
    anon_key:              ANON_KEY ? `${ANON_KEY.slice(0,12)}…` : 'NOT SET',
    key_being_used:        SVC_KEY  ? 'service_role' : ANON_KEY ? 'anon (weaker)' : 'NONE',
    table_reachable:       false,
    table_writable:        false,
    rls_status:            'unknown',
    error:                 null as string | null,
    hint:                  null as string | null,
  }

  if (!SUPA_URL || (!SVC_KEY && !ANON_KEY)) {
    result.error = 'Supabase environment variables not set in Netlify'
    result.hint  = 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify → Site settings → Environment variables'
    return NextResponse.json(result)
  }

  const sb = createClient(SUPA_URL, SVC_KEY ?? ANON_KEY!)

  // Test 1: Can we read from the table?
  const { data: readData, error: readError } = await sb
    .from('inspection_jobs')
    .select('id')
    .limit(1)

  if (readError) {
    result.error = readError.message
    result.hint  = readError.message.includes('does not exist') || readError.message.includes('42P01')
      ? 'Run supabase-migration.sql in Supabase SQL Editor to create the table'
      : readError.message.includes('permission') || readError.message.includes('denied') || readError.message.includes('RLS')
      ? 'Row Level Security is blocking reads. In Supabase → Authentication → Policies, disable RLS on inspection_jobs OR add a service_role bypass policy'
      : 'Check Supabase dashboard logs'
    return NextResponse.json(result)
  }

  result.table_reachable = true

  // Test 2: Can we write a test row?
  const testId = `_ping_test_${Date.now()}`
  const { error: writeError } = await sb
    .from('inspection_jobs')
    .upsert({
      id:               testId,
      user_id:          '_ping_test',
      client_name:      '_ping_test',
      address_street:   '_ping_test',
      building_type:    '_ping_test',
      status:           '_ping_test',
      phase_progress:   0,
      job_json:         { test: true },
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'id' })

  if (writeError) {
    result.error       = writeError.message
    result.rls_status  = 'blocking writes'
    result.hint        = writeError.message.includes('RLS') || writeError.message.includes('policy') || writeError.message.includes('permission')
      ? 'RLS is blocking writes. Go to Supabase → Table Editor → inspection_jobs → RLS policies → Disable RLS (or add a service_role policy)'
      : writeError.message
    return NextResponse.json(result)
  }

  result.table_writable = true

  // Clean up test row
  await sb.from('inspection_jobs').delete().eq('id', testId)

  result.rls_status = SVC_KEY ? 'bypassed by service_role key' : 'may be active (using anon key)'
  result.hint = result.table_writable
    ? 'Supabase is fully operational. If projects still fail to sync, check Netlify function logs for save errors.'
    : null

  return NextResponse.json(result)
}
