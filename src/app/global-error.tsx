'use client'
/**
 * global-error.tsx — App-level error boundary (Next.js App Router)
 *
 * Catches unhandled errors before they crash the page.
 * Chrome extension injection errors (Honey, Grammarly, etc.) are
 * silently swallowed so they never surface to the user.
 */
import { useEffect } from 'react'

function isExtensionError(error: Error): boolean {
  const msg   = error?.message ?? ''
  const stack = error?.stack   ?? ''
  const extPrefixes = ['chrome-extension://', 'moz-extension://', 'safari-extension://']
  return extPrefixes.some(p => stack.includes(p) || msg.includes(p)) ||
    msg.includes('read only property') ||
    msg.includes('Cannot assign to read only property') ||
    msg.includes('injectScript')
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    if (isExtensionError(error)) {
      // Silently recover — extension conflict, not our bug
      reset()
      return
    }
    console.error('[stAIrcode] Unhandled error:', error)
  }, [error, reset])

  if (isExtensionError(error)) return null

  return (
    <html>
      <body style={{ fontFamily: 'system-ui,sans-serif', background: '#0A1C2E', color: '#E8F4FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>⚠️</div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: '0.88rem', color: '#93BAD4', maxWidth: 360, lineHeight: 1.65, margin: 0 }}>
          An unexpected error occurred. Please refresh the page or contact{' '}
          <a href="mailto:info@staircode.app" style={{ color: '#F29337' }}>info@staircode.app</a> if it persists.
        </p>
        <button
          onClick={reset}
          style={{ padding: '0.75rem 1.5rem', background: '#F29337', border: 'none', borderRadius: 10, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
