/**
 * /api/inspection/list — GET ?email=<email>
 * Returns job summaries for authenticated user only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, verifyRequestEmail, isValidEmail } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  // Accept email from token (preferred) or query param (legacy)
  let callerEmail = await verifyRequestEmail(req)
  if (!callerEmail) {
    const qEmail = (req.nextUrl.searchParams.get('email') ?? req.nextUrl.searchParams.get('userId') ?? '').trim().toLowerCase()
    if (qEmail && isValidEmail(qEmail)) callerEmail = qEmail
  }
  if (!callerEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sb = getServiceClient()
    const selectCols = 'id, client_name, inspector_name, address_street, address_city, address_province, building_type, status, phase_progress, active_phase, permit_number, inspection_date, report_url, created_at, updated_at, job_json'

    const { data, error } = await sb
      .from('inspection_jobs')
      .select(selectCols)
      .or(`user_id.eq.${callerEmail},inspector_email.eq.${callerEmail}`)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ ok: true, jobs: [] })

    const jobs = (data ?? []).map((row: any) => ({
      ...row,
      thumbnail: row.job_json?.propertyThumbnail || null,
      job_json: undefined,
    }))

    return NextResponse.json({ ok: true, jobs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'List failed' }, { status: 500 })
  }
}
