/**
 * src/app/api/report/save/route.ts
 *
 * POST /api/report/save
 *
 * Saves report fields + metadata to Supabase so the user can retrieve
 * their report from the email link without re-scanning.
 *
 * Body: { email, fields, codeLabel, location, isOntario }
 * Returns: { token }  — a short UUID the email CTA links to
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
  try {
    const { email, fields, codeLabel, location, isOntario } = await req.json()
    if (!email || !fields) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Generate a simple token — first 8 chars of a UUID
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12)

    // Upsert into a report_tokens table — create it if it doesn't exist via upsert
    const { error } = await supabase
      .from('report_tokens')
      .upsert({
        token,
        email,
        fields: JSON.stringify(fields),
        code_label: codeLabel,
        location: location || '',
        is_ontario: isOntario || false,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      }, { onConflict: 'token' })

    if (error) {
      console.error('[report/save] Supabase error:', error)
      // Return a fallback token anyway — worst case the unlock page regenerates from params
      return NextResponse.json({ token: 'fallback', ok: false })
    }

    return NextResponse.json({ token, ok: true })
  } catch (err) {
    console.error('[report/save] Error:', err)
    return NextResponse.json({ token: 'fallback', ok: false })
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { data, error } = await supabase
      .from('report_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Token not found' }, { status: 404 })

    return NextResponse.json({
      email:      data.email,
      fields:     JSON.parse(data.fields || '[]'),
      codeLabel:  data.code_label,
      location:   data.location,
      isOntario:  data.is_ontario,
      ok: true,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
