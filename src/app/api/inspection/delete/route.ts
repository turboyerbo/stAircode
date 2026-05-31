import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  const id      = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (SUPA_URL && SUPA_KEY) {
    const sb = createClient(SUPA_URL, SUPA_KEY)
    await sb.from('inspection_jobs').delete().eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
