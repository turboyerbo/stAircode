/**
 * POST /api/photos/upload
 *
 * Stores an inspection photo in a PRIVATE Supabase Storage bucket and returns a
 * durable reference of the form `sb:<path>`.
 *
 * Why: photos used to live only as base64 inside the job object. Because that
 * payload is too large to save to the server, the save step replaced them with
 * `[photo-N]` placeholders and kept the real image only in the browser's local
 * storage. That meant photos vanished on any other device and could not be
 * embedded in emailed reports. Uploading here makes them durable and portable:
 * the job stores a short reference, and the bytes live in Storage.
 *
 * Body:   { imageB64: string, jobId?: string, moduleId?: string }
 * Return: { ref: 'sb:inspections/<jobId>/<moduleId>/<uuid>.jpg' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export const maxDuration = 30

const BUCKET = 'inspection-photos'

function slug(v: string | undefined, fallback: string) {
  const s = (v ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return s || fallback
}

export async function POST(req: NextRequest) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPA_URL || !SUPA_KEY) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 503 })
  }

  let imageB64: string, jobId: string | undefined, moduleId: string | undefined
  try {
    const body = await req.json()
    imageB64 = body.imageB64
    jobId    = body.jobId
    moduleId = body.moduleId
    if (!imageB64 || typeof imageB64 !== 'string') throw new Error('missing image')
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // Already a stored reference or a URL: nothing to do.
  if (imageB64.startsWith('sb:') || imageB64.startsWith('http')) {
    return NextResponse.json({ ref: imageB64 })
  }

  const raw = imageB64.includes('base64,') ? imageB64.split('base64,')[1] : imageB64
  let bytes: Buffer
  try { bytes = Buffer.from(raw, 'base64') } catch { return NextResponse.json({ error: 'bad_base64' }, { status: 400 }) }

  if (!bytes.length)          return NextResponse.json({ error: 'empty_image' }, { status: 400 })
  if (bytes.length > 8_000_000) return NextResponse.json({ error: 'image_too_large' }, { status: 413 })

  // Detect the real type from magic bytes so the stored object has a correct
  // content-type (declaring the wrong one breaks rendering in some browsers).
  const isPng  = bytes[0] === 0x89 && bytes[1] === 0x50
  const isGif  = bytes[0] === 0x47 && bytes[1] === 0x49
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45
  const ext         = isPng ? 'png'  : isGif ? 'gif'  : isWebp ? 'webp' : 'jpg'
  const contentType = isPng ? 'image/png' : isGif ? 'image/gif' : isWebp ? 'image/webp' : 'image/jpeg'

  const path = `inspections/${slug(jobId, 'unassigned')}/${slug(moduleId, 'general')}/${randomUUID()}.${ext}`

  try {
    const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false })
    if (error) {
      console.error('[photos/upload] storage error:', error.message)
      return NextResponse.json({ error: 'upload_failed', detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ ref: `sb:${path}` })
  } catch (err: any) {
    console.error('[photos/upload] failed:', err?.message)
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
  }
}
