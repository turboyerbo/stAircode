/**
 * POST /api/webhooks/resend
 *
 * Receives real-time email delivery events from Resend.
 * Tracks in PostHog for beta analytics and optionally logs to Supabase.
 *
 * Events handled:
 *   email.sent       — Resend accepted the email
 *   email.delivered  — Email confirmed delivered to inbox
 *   email.opened     — Recipient opened the email
 *   email.clicked    — Recipient clicked a link
 *   email.bounced    — Email bounced (bad address)
 *   email.complained — Recipient marked as spam
 *
 * Setup:
 *   1. Resend dashboard → Webhooks → Add Webhook
 *   2. Endpoint URL: https://staircode.app/api/webhooks/resend
 *   3. Subscribe to: email.sent, email.delivered, email.opened,
 *                    email.clicked, email.bounced, email.complained
 *   4. Copy the signing secret → Netlify env var: RESEND_WEBHOOK_SECRET
 *
 * Required env vars:
 *   RESEND_WEBHOOK_SECRET   (from Resend dashboard → Webhooks → secret)
 *   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
 *   SUPABASE_SERVICE_ROLE_KEY  (optional — for DB logging)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { trackServer } from '@/lib/analytics-server'

// ── Signature verification ─────────────────────────────────────────────────────
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    // Resend uses svix-style webhooks: signature is "v1,<base64-hmac-sha256>"
    const parts = signature.split(',')
    const sigPart = parts.find(p => p.startsWith('v1=') || !p.includes('=')) ?? parts[parts.length - 1]
    const sigBytes = Buffer.from(sigPart.replace('v1=', ''), 'base64')
    const hmac     = createHmac('sha256', secret).update(payload).digest()
    return sigBytes.length === hmac.length && timingSafeEqual(sigBytes, hmac)
  } catch {
    return false
  }
}

// ── Supabase email event log (optional) ───────────────────────────────────────
async function logToSupabase(event: ResendEvent) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return  // skip if Supabase not configured

  try {
    await fetch(`${url}/rest/v1/email_events`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        key,
        'Authorization': `Bearer ${key}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        resend_email_id: event.data.email_id,
        event_type:      event.type,
        recipient:       event.data.to?.[0] ?? event.data.to ?? '',
        subject:         event.data.subject ?? '',
        occurred_at:     event.data.created_at ?? new Date().toISOString(),
      }),
    })
  } catch (err) {
    console.error('[resend-webhook] Supabase log failed:', err)
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ResendEvent {
  type: string
  data: {
    email_id:   string
    to:         string | string[]
    subject?:   string
    created_at?: string
    bounced_at?: string
    clicked_at?: string
    opened_at?:  string
    tags?:       Record<string, string>
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET

  // Read raw body for signature verification
  const rawBody = await req.text()

  // Verify signature if secret is configured
  if (secret) {
    const signature = req.headers.get('svix-signature')
                   ?? req.headers.get('resend-signature')
                   ?? ''
    if (!signature || !verifySignature(rawBody, signature, secret)) {
      console.warn('[resend-webhook] Invalid signature — request rejected')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } else {
    console.warn('[resend-webhook] RESEND_WEBHOOK_SECRET not set — skipping verification')
  }

  // Parse event
  let event: ResendEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, data } = event
  const recipient = Array.isArray(data.to) ? data.to[0] : (data.to ?? 'unknown')
  const emailId   = data.email_id ?? 'unknown'

  console.log(`[resend-webhook] ${type} — ${recipient} — ${emailId}`)

  // ── Track in PostHog ────────────────────────────────────────────────────────
  const distinctId = recipient || emailId

  switch (type) {
    case 'email.sent':
      await trackServer(distinctId, 'email_sent', {
        email_id:  emailId,
        subject:   data.subject,
        recipient,
      })
      break

    case 'email.delivered':
      await trackServer(distinctId, 'email_delivered', {
        email_id:  emailId,
        subject:   data.subject,
        recipient,
      })
      break

    case 'email.opened':
      await trackServer(distinctId, 'email_opened', {
        email_id:   emailId,
        subject:    data.subject,
        recipient,
        opened_at:  data.opened_at,
      })
      break

    case 'email.clicked':
      await trackServer(distinctId, 'email_link_clicked', {
        email_id:   emailId,
        subject:    data.subject,
        recipient,
        clicked_at: data.clicked_at,
      })
      break

    case 'email.bounced':
      await trackServer(distinctId, 'email_bounced', {
        email_id:   emailId,
        subject:    data.subject,
        recipient,
        bounced_at: data.bounced_at,
      })
      // Log bounces prominently — bad email addresses affect deliverability
      console.error(`[resend-webhook] BOUNCE: ${recipient}`)
      break

    case 'email.complained':
      await trackServer(distinctId, 'email_spam_complaint', {
        email_id:  emailId,
        subject:   data.subject,
        recipient,
      })
      console.error(`[resend-webhook] SPAM COMPLAINT: ${recipient}`)
      break

    default:
      console.log(`[resend-webhook] Unhandled event type: ${type}`)
  }

  // ── Log to Supabase ─────────────────────────────────────────────────────────
  await logToSupabase(event)

  return NextResponse.json({ received: true })
}
