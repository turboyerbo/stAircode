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
    supabase_url_set:   !!SUPA_URL,
    service_role_key:   SVC_KEY  ? `${SVC_KEY.slice(0,12)}…`  : '❌ NOT SET — this is likely the problem',
    anon_key:           ANON_KEY ? `${ANON_KEY.slice(0,12)}…` : '❌ NOT SET',
    key_in_use:         SVC_KEY ? 'service_role ✓' : ANON_KEY ? 'anon ⚠ (weaker — set SUPABASE_SERVICE_ROLE_KEY)' : '❌ NONE',
    table_readable:     false,
    table_writable:     false,
    rls_enabled:        'unknown',
    error:              null as string | null,
    fix:                null as string | null,
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

  result.table_readable = true

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
    result.rls_enabled = 'YES — THIS IS THE BUG. RLS is blocking writes from the API.'
    result.fix         = 'Run supabase-fix-rls.sql in Supabase SQL Editor to disable RLS on inspection_jobs'
    return NextResponse.json(result)
  }

  result.table_writable = true

  // Clean up test row
  await sb.from('inspection_jobs').delete().eq('id', testId)

  result.rls_enabled = false
  result.fix = null
  result.status = '✓ Supabase fully operational — table readable and writable'

  return NextResponse.json(result)
}
