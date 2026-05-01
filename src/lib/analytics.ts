/**
 * src/lib/analytics.ts
 *
 * PostHog event tracking for stAIrcode Beta.
 * All events flow through this one file — add, remove, or rename here.
 *
 * Setup:
 *   1. posthog.com → new project → copy phc_xxxx API key
 *   2. Add to Netlify env vars:
 *        NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxx
 *        NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
 *
 * What PostHog gives you automatically:
 *   - Session recordings (watch real users navigate)
 *   - Heatmaps + click maps
 *   - Funnel analysis (scan → report → purchase)
 *   - Retention cohorts by role
 *   - Feature flags for A/B testing pricing
 */

import posthog from 'posthog-js'

let initialised = false

export function initAnalytics() {
  if (initialised) return
  if (typeof window === 'undefined') return

  const key  = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'

  if (!key) {
    console.info('[analytics] NEXT_PUBLIC_POSTHOG_KEY not set — tracking disabled')
    return
  }

  posthog.init(key, {
    api_host:    host,
    defaults:    '2026-01-30',  // PostHog recommended defaults snapshot
    persistence: 'localStorage',
    autocapture: false,         // manual events only — no noise
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') {
        ph.opt_out_capturing()
        console.info('[analytics] PostHog opted-out in dev mode')
      }
    },
  })

  initialised = true
}

// ── Identity ──────────────────────────────────────────────────────────────────
// Call this as soon as the user signs in so all events are attributed to them
export function identifyUser(
  email:      string,
  props?: {
    role?:       string
    membership?: string
    method?:     string
    provider?:   string
    betaUser?:   boolean
  }
) {
  if (!initialised) return
  posthog.identify(email, {
    email,
    beta_user:  true,
    ...props,
  })
}

export function resetUser() {
  if (!initialised) return
  posthog.reset()
}

// ── Core track helper ─────────────────────────────────────────────────────────
function track(event: string, props?: Record<string, unknown>) {
  if (!initialised) return
  // Always stamp beta flag and timestamp on every event
  posthog.capture(event, {
    beta:      true,
    app_version: '1.0.0-beta.1',
    ...props,
  })
}

// ── All events ────────────────────────────────────────────────────────────────
export const Analytics = {

  // ── Auth ────────────────────────────────────────────────────────────────────

  /** User completes sign-in (OTP verified, Google, Apple, or beta skip) */
  userSignedIn: (method: 'otp' | 'google' | 'apple' | 'facebook' | 'beta') =>
    track('user_signed_in', { method }),

  /** User selects their role on the role picker screen */
  roleSelected: (role: string) =>
    track('role_selected', { role }),

  /** User signs out */
  userSignedOut: () =>
    track('user_signed_out'),

  // ── Scan ────────────────────────────────────────────────────────────────────

  /** User taps Start Scan — beginning of core funnel */
  scanStarted: (props?: { role?: string; codeLabel?: string; location?: string; scanMode?: string }) =>
    track('scan_started', props),

  /** A single measurement locked in (riser, tread, width, handrail) */
  /** A single measurement locked in — measurement can be 'guard_manual' for manually entered handrail */
  measurementLocked: (measurement: string, valueMm: number, confidence: number) =>
    track('measurement_locked', { measurement, value_mm: valueMm, confidence }),

  /** User requested a rescan of a specific step */
  measurementRescanned: (measurement: string) =>
    track('measurement_rescanned', { measurement }),

  /** Intro positioning image was shown */
  introImageShown: () =>
    track('intro_image_shown'),

  /** Stuck hint (man crouching) was shown — user had no lock after 25s */
  stuckHintShown: (stepLabel: string) =>
    track('stuck_hint_shown', { step: stepLabel }),

  /** Nosing not detected overlay was triggered */
  nosingNotDetected: () =>
    track('nosing_not_detected'),

  /** All measurements complete — user reached review screen */
  scanCompleted: (props: {
    role?:             string
    measurementCount:  number
    hasFailed:         boolean
    durationSeconds?:  number
    codeLabel?:        string
    location?:         string
  }) => track('scan_completed', props),

  // ── Report ──────────────────────────────────────────────────────────────────

  /** User opens the pricing/plans sheet */
  pricingViewed: (source?: string) =>
    track('pricing_viewed', { source }),

  /** User taps a purchase button (before payment) */
  purchaseInitiated: (product: 'report' | 'pro' | 'enterprise') =>
    track('purchase_initiated', { product }),

  /** Stripe payment completed — webhook fired, report emailed */
  purchaseCompleted: (product: 'report' | 'pro', pricePaid?: number) =>
    track('purchase_completed', { product, price_paid: pricePaid }),

  /** Stripe checkout was abandoned */
  purchaseCancelled: (product: 'report' | 'pro') =>
    track('purchase_cancelled', { product }),

  /** Free beta report generated (no payment — beta period) */
  betaReportGenerated: (props: {
    verdict:    string
    failCount:  number
    passCount:  number
    codeLabel:  string
    role?:      string
    emailed?:   boolean
  }) => track('beta_report_generated', props),

  /** Paid report generated */
  reportGenerated: (props: {
    verdict:    string
    failCount:  number
    passCount:  number
    codeLabel:  string
    role?:      string
  }) => track('report_generated', props),

  /** User tapped Print / Save PDF or Copy */
  exportClicked: (type: 'print' | 'copy' | 'free_pdf') =>
    track('export_clicked', { type }),

  /** Report was successfully emailed to user */
  reportEmailed: (success: boolean) =>
    track('report_emailed', { success }),

  // ── Survey ──────────────────────────────────────────────────────────────────

  /** User clicked the survey link in the report email or in-app */
  surveyLinkClicked: (source: 'report_email' | 'in_app_report' | 'help_screen') =>
    track('survey_link_clicked', { source }),

  /** Feedback form opened (in-app Tally widget) */
  feedbackOpened: (source: 'help_screen' | 'report_screen' | 'settings') =>
    track('feedback_opened', { source }),

  // ── Navigation ──────────────────────────────────────────────────────────────

  /** User tapped Find Inspector button */
  findInspectorClicked: () =>
    track('find_inspector_clicked'),

  /** User viewed the Help screen */
  helpViewed: () =>
    track('help_viewed'),

  /** User viewed Settings */
  settingsViewed: () =>
    track('settings_viewed'),

  // ── Beta-specific ────────────────────────────────────────────────────────────

  /** Pro scan count tracked (for 20/month cap) */
  proScanUsed: (scansUsedThisMonth: number, scansRemaining: number) =>
    track('pro_scan_used', { scans_used: scansUsedThisMonth, scans_remaining: scansRemaining }),

  /** Pro scan limit reached */
  proScanLimitReached: () =>
    track('pro_scan_limit_reached'),

  /** User hit an API error during scan */
  scanError: (step: string, errorType: string) =>
    track('scan_error', { step, error_type: errorType }),

  /** Report generation timed out */
  reportTimeout: () =>
    track('report_generation_timeout'),
}
