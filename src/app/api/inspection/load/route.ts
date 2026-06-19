/**
 * /api/inspection/load — GET ?id=<job_id>&email=<owner_email>
 *
 * Returns full job_json only if the requester owns the job.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, verifyRequestEmail, isValidJobId, isValidEmail } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get('id')?.trim() ?? ''
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''

  if (!id || !isValidJobId(id)) {
    return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 })
  }

  // Resolve caller identity
  let callerEmail = await verifyRequestEmail(req)
  if (!callerEmail && email && isValidEmail(email)) callerEmail = email
  if (!callerEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sb = getServiceClient()
    const { data, error } = await sb
      .from('inspection_jobs')
      .select('job_json, updated_at, user_id, inspector_email')
      .eq('id', id)
      .single()

    if (error || !data?.job_json) {
      return NextResponse.json({ error: 'Job not found', id }, { status: 404 })
    }

    // Ownership check
    const owner = (data.user_id ?? '').toLowerCase()
    const insp  = (data.inspector_email ?? '').toLowerCase()
    if (callerEmail !== owner && callerEmail !== insp) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ ok: true, job: data.job_json, updatedAt: data.updated_at })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Load failed' }, { status: 500 })
  }
}
