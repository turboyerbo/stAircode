/**
 * Netlify Scheduled Function — retries queued report builds.
 *
 * Runs every 2 minutes and nudges the background worker. This is the safety net
 * that makes the queue trustworthy: if the immediate trigger from
 * /api/report/request never landed, or a build died halfway, the row is still
 * pending and gets picked up here. A customer's report is never lost because a
 * single invocation failed.
 */
import type { Config } from '@netlify/functions'

export default async () => {
  const base = process.env.URL ?? 'https://staircode.app'
  try {
    const res = await fetch(`${base}/.netlify/functions/build-report-background`, { method: 'POST' })
    console.log('[report-sweeper] triggered:', res.status)
  } catch (err) {
    console.error('[report-sweeper] failed:', err)
  }
}

export const config: Config = {
  schedule: '*/2 * * * *', // every 2 minutes
}
