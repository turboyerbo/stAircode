/**
 * src/lib/scan-usage.ts
 *
 * Server-side scan usage tracking.
 * Called from /api/report/generate (the natural "scan completed" event).
 *
 * Free tier: FREE_SCAN_LIMIT scans per email.
 * Pro tier:  unlimited (is_pro = true in scan_usage table).
 *
 * Design notes:
 *  - Keyed by email (not IP, not cookie) — survives clears, incognito, device switches
 *  - Enforced server-side — not bypassable by the client
 *  - Fails open: if Supabase is unreachable, scan proceeds (don't block the user)
 *  - Incremented when the REPORT is generated, not per API call
 *    (a scan = one inspection session; each session makes ~6 AI calls)
 */

export const FREE_SCAN_LIMIT = 3    // free scans before paywall
export const VISION_CALLS_PER_SCAN = 6  // approx Claude calls per full scan

export interface ScanUsageResult {
  allowed:    boolean
  scanCount:  number
  limit:      number
  isPro:      boolean
  remaining:  number
  error?:     string
}

/**
 * Check whether an email is allowed to complete a scan.
 * Returns { allowed: true } if under limit or pro.
 * Returns { allowed: false } if limit reached.
 * Returns { allowed: true } if Supabase is unavailable (fail-open).
 */
export async function checkScanUsage(email: string): Promise<ScanUsageResult> {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!sbUrl || !sbKey || !email) {
    // No Supabase configured or anonymous — allow (dev/test mode)
    return { allowed: true, scanCount: 0, limit: FREE_SCAN_LIMIT, isPro: false, remaining: FREE_SCAN_LIMIT }
  }

  try {
    const res = await fetch(
      `${sbUrl}/rest/v1/scan_usage?select=scan_count,is_pro&email=eq.${encodeURIComponent(email.toLowerCase())}`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
    )

    if (!res.ok) throw new Error(`Supabase ${res.status}`)

    const rows: { scan_count: number; is_pro: boolean }[] = await res.json()
    const row      = rows[0]
    const scanCount = row?.scan_count ?? 0
    const isPro     = row?.is_pro ?? false

    if (isPro) {
      return { allowed: true, scanCount, limit: Infinity, isPro: true, remaining: Infinity }
    }

    const remaining = Math.max(0, FREE_SCAN_LIMIT - scanCount)
    return {
      allowed:   scanCount < FREE_SCAN_LIMIT,
      scanCount,
      limit:     FREE_SCAN_LIMIT,
      isPro:     false,
      remaining,
    }
  } catch (err) {
    console.warn('[scan-usage] Check failed — failing open:', err)
    // Never block the user if our DB is down
    return { allowed: true, scanCount: 0, limit: FREE_SCAN_LIMIT, isPro: false, remaining: FREE_SCAN_LIMIT, error: String(err) }
  }
}

/**
 * Increment the scan count for an email after a successful scan.
 * Fire-and-forget safe — errors are logged but not thrown.
 */
export async function incrementScanUsage(email: string): Promise<void> {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!sbUrl || !sbKey || !email) return

  try {
    await fetch(`${sbUrl}/rest/v1/rpc/increment_scan_usage`, {
      method:  'POST',
      headers: {
        apikey:          sbKey,
        Authorization:   `Bearer ${sbKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ user_email: email.toLowerCase() }),
    })
  } catch (err) {
    console.warn('[scan-usage] Increment failed:', err)
  }
}

/**
 * Mark a user as Pro (unlimited scans).
 * Called by the Stripe webhook after a successful Pro subscription payment.
 */
export async function unlockProScans(email: string): Promise<void> {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!sbUrl || !sbKey || !email) return

  try {
    await fetch(`${sbUrl}/rest/v1/rpc/unlock_pro_scans`, {
      method:  'POST',
      headers: {
        apikey:          sbKey,
        Authorization:   `Bearer ${sbKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ user_email: email.toLowerCase() }),
    })
  } catch (err) {
    console.warn('[scan-usage] Pro unlock failed:', err)
  }
}
