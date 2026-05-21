/**
 * src/lib/firebase.ts
 *
 * Firebase app + Analytics initialization.
 *
 * Config values come from environment variables set in Netlify:
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 *   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID   ← links to Google Analytics property
 *
 * Usage anywhere in the app:
 *   import { logEvent } from '@/lib/firebase'
 *   logEvent('scan_completed', { code: 'OBC 2024', passed: 4, failed: 1 })
 */

import { getApps, initializeApp } from 'firebase/app'
import type { Analytics } from 'firebase/analytics'

// Firebase project config — set these in Netlify env vars
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Singleton Firebase app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// Analytics — only runs in browser, skipped during SSR
let analyticsInstance: Analytics | null = null

async function getAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null
  if (!firebaseConfig.measurementId) return null
  if (analyticsInstance) return analyticsInstance
  try {
    const { getAnalytics: _getAnalytics, isSupported } = await import('firebase/analytics')
    if (await isSupported()) {
      analyticsInstance = _getAnalytics(app)
      return analyticsInstance
    }
  } catch (e) {
    console.warn('[Firebase] Analytics not available:', e)
  }
  return null
}

/**
 * Log a Firebase Analytics event.
 * Also fires the equivalent gtag event so both GA4 properties receive it.
 *
 * @param eventName  snake_case event name
 * @param params     optional key/value pairs
 */
export async function logEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): Promise<void> {
  // Firebase Analytics
  try {
    const analytics = await getAnalytics()
    if (analytics) {
      const { logEvent: _logEvent } = await import('firebase/analytics')
      _logEvent(analytics, eventName, params)
    }
  } catch (e) {
    console.warn('[Firebase] logEvent failed:', e)
  }

  // Also send to existing gtag / Google Analytics
  try {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('event', eventName, params)
    }
  } catch {}
}

export { app }
