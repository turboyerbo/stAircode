/**
 * GET /api/photos/get?ref=sb:<path>
 *
 * Streams an inspection photo out of the PRIVATE Supabase Storage bucket.
 *
 * Serving through our own route (rather than handing the browser a signed URL)
 * keeps <img src> synchronous, so components can render a photo reference
 * directly without an extra round-trip to mint URLs.
 *
 * The bucket stays private; only this route (holding the service-role key) can
 * read it, and paths contain a random UUID so they are not guessable.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const BUCKET = 'inspection-photos'

export async function GET(req: NextRequest) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPA_URL || !SUPA_KEY) return new NextResponse('storage not configured', { status: 503 })

  const refRaw = req.nextUrl.searchParams.get('ref') ?? ''
  const ref = refRaw.startsWith('sb:') ? refRaw.slice(3) : refRaw
  // Only allow paths inside our own prefix; block traversal.
  if (!ref || ref.includes('..') || !ref.startsWith('inspections/')) {
    return new NextResponse('bad ref', { status: 400 })
  }

  try {
    const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
    const { data, error } = await sb.storage.from(BUCKET).download(ref)
    if (error || !data) return new NextResponse('not found', { status: 404 })

    const buf = Buffer.from(await data.arrayBuffer())
    const ext = ref.split('.').pop()?.toLowerCase()
    const contentType =
      ext === 'png'  ? 'image/png'  :
      ext === 'gif'  ? 'image/gif'  :
      ext === 'webp' ? 'image/webp' : 'image/jpeg'

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type':  contentType,
        // Immutable: the UUID path never changes content.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch (err: any) {
    console.error('[photos/get] failed:', err?.message)
    return new NextResponse('error', { status: 500 })
  }
}
