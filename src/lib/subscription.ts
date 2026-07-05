/**
 * src/lib/subscription.ts
 *
 * Utilities for checking whether a user has an active subscription.
 *
 * All paid features (full building inspection, foundation reports,
 * accessibility reports, full inspection reports) require an active subscription.
 *
 * The stair compliance DEMO scan (the free sample) is always free and bypasses this check.
 *
 * Subscription state is stored in Supabase profiles table:
 *   email                  text
 *   membership             text    ('free' | 'subscription')
 *   subscription_active    bool
 *   stripe_subscription_id text
 *   stripe_customer_id     text
 *   subscription_start     timestamptz
 */

import { createClient } from '@supabase/supabase-js'

export type SubscriptionStatus = 'active' | 'inactive' | 'unknown'

/**
 * Check if a user has an active subscription.
 * Returns 'unknown' if Supabase is not configured or lookup fails.
 */
export async function checkSubscription(email: string): Promise<SubscriptionStatus> {
  if (!email) return 'inactive'

  // Beta code bypass — checked before DB hit
  const betaCode = process.env.BETA_DISCOUNT_CODE ?? 'betacode67'
  // (betaCode bypass is handled at the API call level via discountCode param, not here)

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPA_URL || !SUPA_KEY) return 'unknown'

  try {
    const sb = createClient(SUPA_URL, SUPA_KEY)
    const { data, error } = await sb
      .from('profiles')
      .select('membership, subscription_active')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (error) {
      console.warn('[subscription] Lookup error:', error.message)
      return 'unknown'
    }
    if (!data) return 'inactive'

    const isActive = data.subscription_active === true
                  || data.membership === 'subscription'
                  || data.membership === 'pro'

    return isActive ? 'active' : 'inactive'
  } catch (err) {
    console.error('[subscription] Unexpected error:', err)
    return 'unknown'
  }
}

/**
 * Returns true if the request should be allowed to generate a report.
 *
 * Allowed if:
 *   1. User has an active subscription
 *   2. User provided the beta discount code (betacode67)
 *   3. Subscription check returned 'unknown' (Supabase not configured — dev mode)
 */
export async function canGenerateReport(
  email:        string,
  discountCode: string | undefined,
): Promise<{ allowed: boolean; reason: string }> {
  const betaCode = (process.env.BETA_DISCOUNT_CODE ?? 'betacode67').toLowerCase()

  // Beta code bypass
  if (discountCode && discountCode.toLowerCase().trim() === betaCode) {
    return { allowed: true, reason: 'beta_code' }
  }

  const status = await checkSubscription(email)

  if (status === 'active')  return { allowed: true,  reason: 'subscription' }
  if (status === 'unknown') return { allowed: true,  reason: 'supabase_unconfigured' }

  return {
    allowed: false,
    reason:  'no_subscription',
  }
}
