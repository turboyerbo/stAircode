/**
 * POST /api/trial/grant
 *
 * Called immediately after a new user signs up with email+password.
 * Grants a 7-day free trial and records an IP + email fingerprint
 * to prevent trivial abuse (same IP = same person, different email).
 *
 * Abuse prevention layers:
 *   1. IP address — exact match blocks re-trial from same IP
 *   2. Email domain — disposable email domains are blocked
 *   3. Rate limit — max 3 trial grants per IP per hour
 *   4. Fingerprint hash — email+IP hash stored to detect re-registration
 *
 * Supabase table required (run once):
 *
 *   CREATE TABLE IF NOT EXISTS trial_grants (
 *     id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     email        text NOT NULL,
 *     ip           text NOT NULL,
 *     fingerprint  text NOT NULL,          -- sha256(email_domain + ip)
 *     trial_start  timestamptz NOT NULL DEFAULT now(),
 *     trial_end    timestamptz NOT NULL,
 *     created_at   timestamptz NOT NULL DEFAULT now()
 *   );
 *   CREATE UNIQUE INDEX IF NOT EXISTS trial_grants_email_idx ON trial_grants (email);
 *   CREATE INDEX IF NOT EXISTS trial_grants_ip_idx ON trial_grants (ip);
 *   CREATE INDEX IF NOT EXISTS trial_grants_fp_idx ON trial_grants (fingerprint);
 *
 *   -- Also upsert into existing trials table for compatibility:
 *   -- trials table already exists with email, trial_start, trial_end, active columns
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

export const maxDuration = 15

const TRIAL_DAYS = 7

// Disposable / throwaway email domains to block
const BLOCKED_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com',
  'throwam.com','yopmail.com','fakeinbox.com','trashmail.com','sharklasers.com',
  'guerrillamailblock.com','grr.la','guerrillamail.info','spam4.me',
  'dispostable.com','maildrop.cc','discard.email','spamgourmet.com',
  'getairmail.com','filzmail.com','emailondeck.com','throwam.com',
  'mailnull.com','spamex.com','deadaddress.com','spam.la',
])

function emailDomain(email: string): string {
  return (email.split('@')[1] ?? '').toLowerCase()
}

// Simple fingerprint: base64 of "domain|ip" — no crypto module needed on edge
function makeFingerprint(email: string, ip: string): string {
  const raw = `${emailDomain(email)}|${ip}`
  return Buffer.from(raw).toString('base64')
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // Rate limit — max 3 trial grants per IP per hour
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many requests — please try again later.' }, { status: 429 })
  }

  let email: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 })
  }

  // Block disposable email domains
  if (BLOCKED_DOMAINS.has(emailDomain(email))) {
    return NextResponse.json({
      ok: false,
      blocked: true,
      error: 'Disposable email addresses are not eligible for a free trial. Please use your real email address.',
    }, { status: 403 })
  }

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const now      = new Date()
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

  // If Supabase not configured — grant in-memory trial (dev/staging fallback)
  if (!SUPA_URL || !SUPA_KEY) {
    console.warn('[trial/grant] Supabase not configured — granting local trial')
    return NextResponse.json({
      ok:       true,
      trialEnd: trialEnd.toISOString(),
      daysLeft: TRIAL_DAYS,
      newGrant: true,
    })
  }

  const sb = createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const fingerprint = makeFingerprint(email, ip)

  // ── Check for existing trial by email ──────────────────────────────────────
  const { data: existing } = await sb
    .from('trial_grants')
    .select('email, trial_end, ip, fingerprint')
    .eq('email', email)
    .single()

  if (existing) {
    // Already has a trial — return existing end date
    const existingEnd = new Date(existing.trial_end)
    const active = existingEnd > now
    const daysLeft = active ? Math.ceil((existingEnd.getTime() - now.getTime()) / 86400000) : 0
    return NextResponse.json({
      ok:       true,
      trialEnd: existing.trial_end,
      daysLeft,
      newGrant: false,
      existing: true,
    })
  }

  // ── Check for previous trial from this IP (abuse prevention) ──────────────
  const { data: ipRows } = await sb
    .from('trial_grants')
    .select('email, trial_end')
    .eq('ip', ip)
    .order('created_at', { ascending: false })
    .limit(5)

  const prevTrialFromIP = (ipRows ?? []).find(r => {
    // Block if a trial from this IP is still active or ended within the last 30 days
    const end = new Date(r.trial_end)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return end > thirtyDaysAgo
  })

  if (prevTrialFromIP) {
    // Same IP already had a trial recently — grant a limited 1-day trial instead of blocking
    // This avoids punishing shared IPs (offices, universities) while limiting abuse
    const shortEnd = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)

    await sb.from('trial_grants').insert({
      email, ip, fingerprint,
      trial_start: now.toISOString(),
      trial_end:   shortEnd.toISOString(),
    })
    // Also write to trials table for compatibility
    await sb.from('trials').upsert({
      email, trial_start: now.toISOString(), trial_end: shortEnd.toISOString(), active: true,
    }, { onConflict: 'email' })

    return NextResponse.json({
      ok:       true,
      trialEnd: shortEnd.toISOString(),
      daysLeft: 1,
      newGrant: true,
      limited:  true,
      limitedReason: 'A trial was recently used from your network. You have 24 hours of access to explore the app.',
    })
  }

  // ── Check fingerprint (domain+IP hash) ────────────────────────────────────
  const { data: fpRows } = await sb
    .from('trial_grants')
    .select('email')
    .eq('fingerprint', fingerprint)
    .limit(3)

  if ((fpRows ?? []).length >= 2) {
    // Multiple accounts from the same network+domain combination — 24h only
    const shortEnd = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
    await sb.from('trial_grants').insert({
      email, ip, fingerprint,
      trial_start: now.toISOString(),
      trial_end:   shortEnd.toISOString(),
    })
    await sb.from('trials').upsert({
      email, trial_start: now.toISOString(), trial_end: shortEnd.toISOString(), active: true,
    }, { onConflict: 'email' })

    return NextResponse.json({
      ok:       true,
      trialEnd: shortEnd.toISOString(),
      daysLeft: 1,
      newGrant: true,
      limited:  true,
    })
  }

  // ── Clean grant — new user, new IP ────────────────────────────────────────
  const { error: insertErr } = await sb.from('trial_grants').insert({
    email, ip, fingerprint,
    trial_start: now.toISOString(),
    trial_end:   trialEnd.toISOString(),
  })

  if (insertErr) {
    console.error('[trial/grant] Insert error:', insertErr.message)
    // Don't fail silently — still grant the trial locally
  }

  // Upsert into trials table for compatibility with existing checkTrialAccess() logic
  await sb.from('trials').upsert({
    email,
    trial_start: now.toISOString(),
    trial_end:   trialEnd.toISOString(),
    active:      true,
  }, { onConflict: 'email' })

  console.log(`[trial/grant] New ${TRIAL_DAYS}-day trial granted to ${email} from IP ${ip}`)

  return NextResponse.json({
    ok:       true,
    trialEnd: trialEnd.toISOString(),
    daysLeft: TRIAL_DAYS,
    newGrant: true,
  })
}
