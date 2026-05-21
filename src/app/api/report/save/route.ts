/**
 * src/app/api/report/save/route.ts
 *
 * POST /api/report/save
 *
 * Saves report fields + frames + metadata to Supabase so the webhook
 * can retrieve the full scan data after Stripe payment.
 *
 * Body: { email, fields, codeLabel, location, isOntario, frames? }
 * Returns: { token }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
  try {
    const { email, fields, codeLabel, location, isOntario, frames } = await req.json()
    if (!email || !fields) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12)

    // frames can be a JSON string (passed from sessionStorage) or an object
    const framesStr = typeof frames === 'string'
      ? frames
      : frames ? JSON.stringify(frames) : null

    const { error } = await supabase
      .from('report_tokens')
      .upsert({
        token,
        email,
        fields:     JSON.stringify(fields),
        frames:     framesStr,             // ← photo base64 blobs keyed by posId
        code_label: codeLabel,
        location:   location || '',
        is_ontario: isOntario || false,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'token' })

    if (error) {
      console.error('[report/save] Supabase error:', error)
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
      frames:     data.frames ? JSON.parse(data.frames) : {},   // ← return frames
      codeLabel:  data.code_label,
      location:   data.location,
      isOntario:  data.is_ontario,
      ok: true,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
