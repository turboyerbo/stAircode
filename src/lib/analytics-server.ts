/**
 * src/lib/analytics-server.ts
 *
 * Server-side PostHog tracking using posthog-node.
 * Use this inside API routes (/api/**) — NOT in client components.
 * For client components use src/lib/analytics.ts instead.
 *
 * Pattern:
 *   const ph = serverAnalytics()
 *   ph.capture({ distinctId: email, event: 'report_generated', properties: { ... } })
 *   await ph.shutdown()
 *
 * Always call shutdown() — it flushes the event queue before the
 * serverless function exits.
 */

import { PostHog } from 'posthog-node'

export function serverAnalytics(): PostHog | null {
  const key  = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
              ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'

  if (!key) {
    console.info('[analytics-server] No PostHog key — tracking disabled')
    return null
  }

  return new PostHog(key, { host })
}

/**
 * Fire a single server-side event and immediately shut down.
 * Use this for one-off events inside API routes.
 */
export async function trackServer(
  distinctId: string,
  event:      string,
  properties?: Record<string, unknown>
) {
  const ph = serverAnalytics()
  if (!ph) return

  ph.capture({
    distinctId,
    event,
    properties: {
      beta:        true,
      app_version: '1.0.0-beta.1',
      $lib:        'posthog-node',
      ...properties,
    },
  })

  await ph.shutdown()
}
