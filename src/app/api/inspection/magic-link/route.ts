/**
 * /api/inspection/magic-link — POST
 *
 * Sends a project magic link email so the user can return directly
 * to their inspection without re-entering credentials.
 *
 * Uses Supabase magic link (OTP) so clicking the email auto-signs
 * the user in and redirects them to the project.
 *
 * Body: { email: string; jobId: string; address: string; inspectorName?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  let body: { email: string; jobId: string; address: string; inspectorName?: string }
  try {
    const text = await req.text()
    body = JSON.parse(text)
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { email, jobId, address, inspectorName } = body
  if (!email || !jobId) return NextResponse.json({ error: 'Missing email or jobId' }, { status: 400 })

  const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM ?? 'info@staircode.app'

  if (!resendKey) return NextResponse.json({ ok: false, reason: 'Email not configured' })

  // Deep link that opens the specific project after auth
  const deepLink = `${APP_URL}/?signin=1&goto=projects&project=${jobId}`

  // Generate a Supabase magic link token — clicking it auto-authenticates
  let magicLink = deepLink  // fallback if Supabase unavailable
  if (SUPA_URL && SUPA_KEY) {
    try {
      const sb = createClient(SUPA_URL, SUPA_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await sb.auth.admin.generateLink({
        type:    'magiclink',
        email,
        options: { redirectTo: deepLink },
      })
      if (data?.properties?.action_link) {
        magicLink = data.properties.action_link
      }
    } catch (err) {
      console.warn('[magic-link] Supabase generateLink unavailable, using direct link:', err)
    }
  }

  // Send via Resend
  const html = buildEmail({ address, inspectorName: inspectorName || 'Inspector', magicLink, appUrl: APP_URL })

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from:    fromEmail,
        to:      [email],
        subject: `Your inspection — ${address}`,
        html,
      }),
    })
    if (!res.ok) {
      console.error('[magic-link] Resend error:', await res.text())
      return NextResponse.json({ ok: false })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[magic-link] Error:', err)
    return NextResponse.json({ ok: false })
  }
}

function buildEmail(opts: {
  address: string; inspectorName: string; magicLink: string; appUrl: string
}): string {
  const { address, inspectorName, magicLink, appUrl } = opts
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#0A1C2E;padding:2rem;text-align:center">
    <div style="font-size:1.5rem;font-weight:800;color:#F29337">stAIrcode</div>
    <div style="color:rgba(255,255,255,0.45);font-size:0.72rem;margin-top:0.2rem">by Just Open Technologies Inc.</div>
  </div>
  <div style="background:#F29337;height:5px"></div>
  <div style="padding:2rem">
    <h2 style="font-size:1.2rem;font-weight:700;color:#0A1C2E;margin:0 0 0.5rem">Inspection project started</h2>
    <p style="color:#5E7D9B;font-size:0.88rem;line-height:1.65;margin:0 0 1.5rem">
      Hi ${inspectorName}, your inspection project for
      <strong style="color:#0D1E2E">${address}</strong>
      has been created and saved. Click the button below to return to this project at any time —
      it will sign you in automatically.
    </p>
    <a href="${magicLink}"
      style="display:block;text-align:center;padding:1rem 2rem;background:linear-gradient(135deg,#F29337,#C4721E);color:#fff;border-radius:11px;text-decoration:none;font-weight:800;font-size:1rem;margin-bottom:1.25rem;box-shadow:0 4px 16px rgba(242,147,55,0.4)">
      Continue My Inspection →
    </a>
    <div style="background:#F4F7FB;border-radius:9px;padding:0.85rem 1rem;font-size:0.78rem;color:#5E7D9B;line-height:1.65">
      This button signs you in automatically and takes you directly to your project.
      Valid for 24 hours. After that, sign in at
      <a href="${appUrl}" style="color:#417CA4;font-weight:600">${appUrl}</a>
      and you will find your project in My Inspections.
    </div>
  </div>
  <div style="background:#0A1C2E;padding:1.25rem 2rem">
    <p style="margin:0;color:rgba(255,255,255,0.25);font-size:0.65rem">
      stAIrcode by Just Open Technologies Inc. · staircode.app
    </p>
  </div>
</div>
</body></html>`
}
