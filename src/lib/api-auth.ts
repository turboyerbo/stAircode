/**
 * src/lib/api-auth.ts
 *
 * Shared auth helpers for API routes.
 *
 * - verifyRequestEmail: extracts + validates the caller's email from the
 *   Supabase auth token in the Authorization header. Used to enforce
 *   ownership checks on all inspection data routes.
 * - requireServiceKey: ensures only server-side code (service_role key)
 *   is used for Supabase operations in API routes.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest }  from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

/** Returns a service_role Supabase client. Throws if env vars missing. */
export function getServiceClient() {
  if (!SUPA_URL || !SUPA_KEY) throw new Error('Supabase not configured')
  return createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Verifies the Bearer token in the request, returns the authenticated email.
 * Returns null if the token is missing or invalid.
 * Used to enforce ownership — API routes should reject requests where
 * the token email doesn't match the resource owner.
 */
export async function verifyRequestEmail(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return null
    if (!SUPA_URL || !SUPA_KEY) return null
    const sb = createClient(SUPA_URL, SUPA_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await sb.auth.getUser(token)
    if (error || !data?.user?.email) return null
    return data.user.email.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Validates that a string looks like an email address.
 * Prevents injection via email parameters.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)
}

/**
 * Sanitises an ID string — must be alphanumeric + hyphens only.
 * Prevents path traversal or injection in job ID parameters.
 */
export function isValidJobId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,120}$/.test(id)
}
