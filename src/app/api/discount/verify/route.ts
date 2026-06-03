/**
 * POST /api/discount/verify
 *
 * Validates the trial access code and creates a 30-day trial record in Supabase.
 *
 * Body:   { code: string, email?: string }
 * Returns: { valid: true, trialEnd: string, daysLeft: number }
 *        | { valid: false, error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { rateLimit, getClientIp }    from '@/lib/rate-limit'

// The trial access code — also settable via DISCOUNT_CODE env var
const TRIAL_CODE = (process.env.DISCOUNT_CODE ?? 'ontariofuture2029').toLowerCase()
const TRIAL_DAYS = 30

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) return NextResponse.json({ error: rl.reason }, { status: 429 })

  let code: string
  let email: string
  try {
    const body = await req.json()
    code  = (body.code  ?? '').trim().toLowerCase()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request' }, { status: 400 })
  }

  if (code !== TRIAL_CODE) {
    return NextResponse.json(
      { valid: false, error: 'That code is not valid. Check for typos and try again.' },
      { status: 200 }
    )
  }

  const now      = new Date()
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

  // Persist trial to Supabase if configured and email is provided
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (SUPA_URL && SUPA_KEY && email) {
    try {
      const sb = createClient(SUPA_URL, SUPA_KEY)
      const { error } = await sb.from('trials').upsert({
        email,
        code:       code,
        trial_start: now.toISOString(),
        trial_end:   trialEnd.toISOString(),
        active:      true,
      }, { onConflict: 'email' })

      if (error) {
        console.warn('[discount/verify] Could not persist trial to Supabase:', error.message)
        // Don't fail — still grant access even if DB write fails
      } else {
        console.log(`[discount/verify] Trial created for ${email} until ${trialEnd.toISOString()}`)
      }
    } catch (e: any) {
      console.warn('[discount/verify] Supabase error:', e?.message)
    }
  }

  return NextResponse.json({
    valid:    true,
    trialEnd: trialEnd.toISOString(),
    daysLeft: TRIAL_DAYS,
    // Legacy unlock token for compatibility with existing redirect flow
    unlockToken: Buffer.from(`trial|${email}|${trialEnd.toISOString()}`).toString('base64'),
  })
}
