/**
 * /api/report/generate-phase — POST
 *
 * Generates a PDF section for a single inspection phase.
 * Fast and targeted — designed to be called when each phase is completed.
 * The base64 result is stored on InspectionPhase.reportPdfB64.
 *
 * Body: { job: InspectionJob, phaseId: string }
 * Response: { ok: true, phaseId: string, pdfB64: string, pageCount: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { generatePhaseSection }      from '@/lib/generate-inspection-report'
import type { InspectionJob }        from '@/lib/inspection-types'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'
import { isValidJobId }              from '@/lib/api-auth'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  let body: { job: InspectionJob; phaseId: string }
  try {
    const text = await req.text()
    if (!text) return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    body = JSON.parse(text)
  } catch (e) {
    console.error('[generate-phase] Body parse error:', e)
    return NextResponse.json({ error: 'Request body too large or malformed' }, { status: 400 })
  }

  const { job, phaseId } = body
  if (!job?.id || !phaseId) {
    return NextResponse.json({ error: 'Missing job or phaseId' }, { status: 400 })
  }
  if (!isValidJobId(job.id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  try {
    console.log(`[generate-phase] Generating section for phase ${phaseId} of job ${job.id}`)
    const pdfBuffer = await generatePhaseSection(job, phaseId)
    const pdfB64    = pdfBuffer.toString('base64')

    // Rough page count estimate (each page ~2-3KB in pdf-lib)
    const pageCount = Math.max(1, Math.round(pdfBuffer.length / 2500))

    return NextResponse.json({ ok: true, phaseId, pdfB64, pageCount })
  } catch (err: any) {
    console.error(`[generate-phase] Error for phase ${phaseId}:`, err)
    return NextResponse.json({ error: err?.message ?? 'Phase report generation failed' }, { status: 500 })
  }
}
