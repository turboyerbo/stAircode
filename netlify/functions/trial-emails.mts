/**
 * Netlify Scheduled Function — runs the trial email sequence once a day.
 *
 * Schedule: 14:00 UTC daily (≈9–10am Eastern, a good send time).
 * Calls the app's /api/trial/email-sequence route with the CRON_SECRET.
 *
 * Required env vars (set in Netlify dashboard):
 *   URL          — provided automatically by Netlify (the site's base URL)
 *   CRON_SECRET  — shared secret matching the API route
 */
import type { Config } from '@netlify/functions'

export default async () => {
  const base   = process.env.URL ?? 'https://staircode.app'
  const secret = process.env.CRON_SECRET ?? ''

  try {
    const res = await fetch(`${base}/api/trial/email-sequence?key=${encodeURIComponent(secret)}`, {
      method: 'POST',
      headers: { 'x-cron-secret': secret },
    })
    const data = await res.json()
    console.log('[trial-emails cron]', JSON.stringify(data))
  } catch (err) {
    console.error('[trial-emails cron] failed:', err)
  }
}

export const config: Config = {
  schedule: '0 14 * * *', // 14:00 UTC daily
}
