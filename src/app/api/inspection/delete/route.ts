/**
 * /api/inspection/delete — DELETE ?id=<job_id>&email=<owner_email>
 *
 * Deletes a job only if the requesting email owns it.
 * Requires: Authorization: Bearer <supabase_access_token>
 * Falls back to email param ownership check if no token present.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, verifyRequestEmail, isValidJobId, isValidEmail } from '@/lib/api-auth'

export async function DELETE(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get('id')?.trim() ?? ''
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''

  if (!id || !isValidJobId(id)) {
    return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 })
  }

  // Resolve caller identity — prefer verified token, fall back to email param
  let callerEmail = await verifyRequestEmail(req)
  if (!callerEmail && email && isValidEmail(email)) callerEmail = email
  if (!callerEmail) {
    return NextResponse.json({ error: 'Unauthorized — sign in required' }, { status: 401 })
  }

  try {
    const sb = getServiceClient()

    // Ownership check — only delete if this email owns the job
    const { data: job } = await sb
      .from('inspection_jobs')
      .select('id, user_id, inspector_email')
      .eq('id', id)
      .single()

    if (!job) return NextResponse.json({ ok: true }) // already gone

    const owner = (job.user_id ?? '').toLowerCase()
    const insp  = (job.inspector_email ?? '').toLowerCase()
    if (callerEmail !== owner && callerEmail !== insp) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await sb.from('inspection_jobs').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Delete failed' }, { status: 500 })
  }
}
