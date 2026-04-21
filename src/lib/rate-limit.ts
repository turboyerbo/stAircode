/**
 * src/lib/rate-limit.ts
 *
 * In-memory rate limiter for API routes.
 * No external dependencies — works on Netlify Edge out of the box.
 *
 * Limits:
 *  - 10 requests per IP per minute  (burst protection)
 *  - 50 requests per IP per hour    (scraping protection)
 *
 * Memory is per-serverless-instance so this won't perfectly
 * coordinate across Netlify's global edge, but it catches
 * the vast majority of abuse and scripted scraping.
 */

interface BucketEntry {
  count:     number
  windowStart: number
}

// Two separate maps — one for per-minute, one for per-hour
const minuteBuckets = new Map<string, BucketEntry>()
const hourBuckets   = new Map<string, BucketEntry>()

const MINUTE_MS  = 60   * 1000
const HOUR_MS    = 3600 * 1000
const MINUTE_MAX = 15   // max requests per minute per IP
const HOUR_MAX   = 50   // max requests per hour per IP

// Purge stale entries every 5 minutes to prevent memory leaks
let lastPurge = Date.now()

function purgeStale() {
  const now = Date.now()
  if (now - lastPurge < 5 * MINUTE_MS) return
  lastPurge = now
  minuteBuckets.forEach((entry, key) => {
    if (now - entry.windowStart > MINUTE_MS) minuteBuckets.delete(key)
  })
  hourBuckets.forEach((entry, key) => {
    if (now - entry.windowStart > HOUR_MS) hourBuckets.delete(key)
  })
}

function checkBucket(
  map:      Map<string, BucketEntry>,
  key:      string,
  windowMs: number,
  maxReqs:  number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now   = Date.now()
  const entry = map.get(key)

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    map.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: maxReqs - 1, resetMs: windowMs }
  }

  entry.count++
  const remaining = Math.max(0, maxReqs - entry.count)
  const resetMs   = windowMs - (now - entry.windowStart)

  if (entry.count > maxReqs) {
    return { allowed: false, remaining: 0, resetMs }
  }
  return { allowed: true, remaining, resetMs }
}

export interface RateLimitResult {
  allowed:       boolean
  minuteRemaining: number
  hourRemaining:   number
  retryAfterMs:    number
  reason?:         string
}

export function rateLimit(ip: string): RateLimitResult {
  purgeStale()

  const minute = checkBucket(minuteBuckets, ip, MINUTE_MS, MINUTE_MAX)
  const hour   = checkBucket(hourBuckets,   ip, HOUR_MS,   HOUR_MAX)

  if (!minute.allowed) {
    return {
      allowed: false,
      minuteRemaining: 0,
      hourRemaining:   hour.remaining,
      retryAfterMs:    minute.resetMs,
      reason: 'Too many requests — please wait a moment before trying again.',
    }
  }

  if (!hour.allowed) {
    return {
      allowed: false,
      minuteRemaining: minute.remaining,
      hourRemaining:   0,
      retryAfterMs:    hour.resetMs,
      reason: 'Hourly limit reached — please try again later.',
    }
  }

  return {
    allowed: true,
    minuteRemaining: minute.remaining,
    hourRemaining:   hour.remaining,
    retryAfterMs:    0,
  }
}

/**
 * Extract the real client IP from Next.js request headers.
 * Netlify sets x-nf-client-connection-ip — prefer that over
 * x-forwarded-for which can be spoofed by the client.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-nf-client-connection-ip') ??   // Netlify edge (most reliable)
    req.headers.get('x-real-ip') ??                    // Common reverse proxy header
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? // Last resort
    'unknown'
  )
}
