/**
 * POST /api/inspection/invite
 * Body: { jobId, ownerEmail, inviteeEmail, role, jobAddress }
 *
 * Adds a collaborator to an inspection project and sends them an invite email.
 * Only the project owner can invite collaborators.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, isValidEmail, isValidJobId } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  let body: { jobId?: string; ownerEmail?: string; inviteeEmail?: string; role?: string; jobAddress?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  const { jobId, ownerEmail, inviteeEmail, role = 'co-inspector', jobAddress = '' } = body

  if (!jobId || !isValidJobId(jobId)) return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
  if (!ownerEmail || !isValidEmail(ownerEmail)) return NextResponse.json({ error: 'Invalid owner email' }, { status: 400 })
  if (!inviteeEmail || !isValidEmail(inviteeEmail)) return NextResponse.json({ error: 'Invalid invitee email' }, { status: 400 })
  if (ownerEmail.toLowerCase() === inviteeEmail.toLowerCase()) return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 })

  const RESEND_KEY = process.env.RESEND_API_KEY
  const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'

  try {
    const sb = getServiceClient()

    // Ownership check
    const { data: existing } = await sb
      .from('inspection_jobs')
      .select('id, user_id, inspector_email, job_json')
      .eq('id', jobId)
      .single()

    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const owner = (existing.user_id ?? '').toLowerCase()
    const insp  = (existing.inspector_email ?? '').toLowerCase()
    if (ownerEmail.toLowerCase() !== owner && ownerEmail.toLowerCase() !== insp) {
      return NextResponse.json({ error: 'Only the project owner can invite collaborators' }, { status: 403 })
    }

    // Merge collaborator into job_json
    const jobJson = existing.job_json ?? {}
    const collaborators: any[] = jobJson.collaborators ?? []
    const already = collaborators.some((c: any) => c.email?.toLowerCase() === inviteeEmail.toLowerCase())
    if (already) return NextResponse.json({ error: `${inviteeEmail} already has access to this project` }, { status: 409 })

    collaborators.push({ email: inviteeEmail.toLowerCase(), role, addedAt: new Date().toISOString() })
    jobJson.collaborators = collaborators

    // Persist
    await sb.from('inspection_jobs')
      .update({ job_json: jobJson })
      .eq('id', jobId)

    // Send invite email via Resend
    if (RESEND_KEY) {
      const roleLabel = role === 'co-inspector' ? 'co-inspector' : role === 'viewer' ? 'viewer (read-only)' : 'client'
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from:    'stAIrcode <no-reply@staircode.app>',
          to:      [inviteeEmail],
          subject: `You've been added to an inspection project — ${jobAddress || 'stAIrcode'}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f7fafc">
              <div style="background:#0A1C2E;padding:18px 24px;border-radius:10px 10px 0 0">
                <span style="font-size:1.1rem;font-weight:800;color:#fff">st<span style="color:#F29337">AI</span>rcode</span>
              </div>
              <div style="background:#fff;padding:28px 24px;border-radius:0 0 10px 10px;border:1px solid #e2eaf0">
                <h2 style="margin:0 0 12px;font-size:1.1rem;color:#0A1C2E">You've been added as a ${roleLabel}</h2>
                <p style="color:#5E7D9B;font-size:0.9rem;line-height:1.6;margin:0 0 20px">
                  <strong>${ownerEmail}</strong> has added you to an inspection project${jobAddress ? ` at <strong>${jobAddress}</strong>` : ''}.
                </p>
                <a href="${APP_URL}/?member=1" style="display:inline-block;padding:12px 28px;background:#0A1C2E;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:0.9rem">
                  Open Project →
                </a>
                <p style="margin:24px 0 0;font-size:0.72rem;color:#9DB4C5">
                  Sign in with ${inviteeEmail} to access the project. If you don't have an account yet, sign up with this email address.
                </p>
              </div>
            </div>
          `,
        }),
      })
    }

    return NextResponse.json({ ok: true, collaborators })
  } catch (err: any) {
    console.error('[invite]', err.message)
    return NextResponse.json({ error: err.message ?? 'Server error' }, { status: 500 })
  }
}

/** DELETE /api/inspection/invite?jobId=X&ownerEmail=Y&inviteeEmail=Z */
export async function DELETE(req: NextRequest) {
  const jobId        = req.nextUrl.searchParams.get('jobId') ?? ''
  const ownerEmail   = req.nextUrl.searchParams.get('ownerEmail')?.toLowerCase() ?? ''
  const inviteeEmail = req.nextUrl.searchParams.get('inviteeEmail')?.toLowerCase() ?? ''

  if (!isValidJobId(jobId) || !isValidEmail(ownerEmail) || !isValidEmail(inviteeEmail)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  try {
    const sb = getServiceClient()
    const { data: existing } = await sb
      .from('inspection_jobs').select('id, user_id, inspector_email, job_json').eq('id', jobId).single()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const owner = (existing.user_id ?? '').toLowerCase()
    const insp  = (existing.inspector_email ?? '').toLowerCase()
    if (ownerEmail !== owner && ownerEmail !== insp) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const jobJson = existing.job_json ?? {}
    jobJson.collaborators = (jobJson.collaborators ?? []).filter((c: any) => c.email?.toLowerCase() !== inviteeEmail)
    await sb.from('inspection_jobs').update({ job_json: jobJson }).eq('id', jobId)
    return NextResponse.json({ ok: true, collaborators: jobJson.collaborators })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
