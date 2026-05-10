/**
 * /api/admin/reports/route.ts
 *
 * Admin-only endpoints for managing generated reports.
 * Protected by ADMIN_SECRET env var.
 *
 * GET  /api/admin/reports          — list all stored reports
 * GET  /api/admin/reports?id=xxx   — download a specific PDF
 * POST /api/admin/reports          — resend a report to the user's email
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }               from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const auth = req.headers.get('x-admin-secret') ?? req.nextUrl.searchParams.get('secret')
  return auth === secret
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
  const reportId = req.nextUrl.searchParams.get('id')

  // ── Download a specific PDF ───────────────────────────────────────────────
  if (reportId) {
    const { data, error } = await sb.storage
      .from('reports')
      .download(`reports/${reportId}.pdf`)

    if (error || !data) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    return new Response(buffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="staircode-report-${reportId}.pdf"`,
        'Content-Length':      String(buffer.length),
      },
    })
  }

  // ── List all reports ──────────────────────────────────────────────────────
  const { data: rows, error } = await sb
    .from('report_records')
    .select('id, email, location, code_label, created_at, pdf_url, pdf_size_kb')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reports: rows ?? [] })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let reportId: string
  try {
    const body = await req.json()
    reportId = body.id
    if (!reportId) return NextResponse.json({ error: 'Missing report id' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Fetch report metadata
  const { data: record, error: fetchErr } = await sb
    .from('report_records')
    .select('*')
    .eq('id', reportId)
    .single()

  if (fetchErr || !record) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // Download the PDF from storage
  const { data: pdfBlob, error: dlErr } = await sb.storage
    .from('reports')
    .download(`reports/${reportId}.pdf`)

  if (dlErr || !pdfBlob) {
    return NextResponse.json({ error: 'PDF file not found in storage' }, { status: 404 })
  }

  // Re-send via Resend as attachment
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return NextResponse.json({ error: 'No email provider configured' }, { status: 500 })

  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
    body: JSON.stringify({
      from:    process.env.EMAIL_FROM ?? 'info@staircode.app',
      to:      [record.email],
      subject: `Your stAIrcode Compliance Report — ${record.location || record.code_label}`,
      html:    `<p>Hi there,</p><p>Please find your stAIrcode compliance report attached.</p><p>If you have any questions, reply to this email or contact us at <a href="mailto:info@staircode.app">info@staircode.app</a>.</p><p>stAIrcode · Just Open Technologies Inc.</p>`,
      attachments: [{
        filename:    `staircode-report.pdf`,
        content:     pdfBuffer.toString('base64'),
        content_type: 'application/pdf',
      }],
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.json().catch(() => ({}))
    return NextResponse.json({ error: 'Email send failed', details: err }, { status: 500 })
  }

  // Update sent_at timestamp
  await sb.from('report_records').update({ last_sent_at: new Date().toISOString() }).eq('id', reportId)

  return NextResponse.json({ ok: true, message: `Report resent to ${record.email}` })
}
