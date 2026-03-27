import type { Metadata, Viewport } from 'next'
import './globals.css'

// ── PWA + SEO Metadata ─────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Staircode — Stair Compliance Inspector',
  description: 'Check your staircase against local building codes. Camera-based measurements, auto-detected jurisdiction (OBC, NBC, QBC, Bbl, RCNYS and more).',
  applicationName: 'Staircode',
  keywords: ['stair compliance', 'building code', 'OBC', 'staircase inspection', 'riser height', 'tread depth'],
  authors: [{ name: 'Staircode Inc.' }],
  creator: 'Staircode Inc.',
  publisher: 'Staircode Inc.',
  manifest: '/manifest.json',
  metadataBase: new URL('https://staircode.app'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Staircode — Stair Compliance Inspector',
    description: 'Measure and check your staircase against local building codes using your phone camera.',
    url: 'https://staircode.app',
    siteName: 'Staircode',
    type: 'website',
    images: [{ url: '/screenshots/feature-graphic.png', width: 1024, height: 500 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Staircode — Stair Compliance Inspector',
    description: 'AR stair measurements checked against OBC, NBC, IRC, IBC and more.',
    images: ['/screenshots/feature-graphic.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Staircode',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF3F9' },
    { media: '(prefers-color-scheme: dark)',  color: '#0D2B45' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Staircode" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1565C0" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Fraunces:ital,wght@0,700;0,900;1,700;1,900&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) { console.log('[SW] Registered:', reg.scope); })
                    .catch(function(err) { console.warn('[SW] Failed:', err); });
                });
              }
            `,
          }}
        />
        {/* PostHog analytics — initialised client-side only */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__POSTHOG_KEY__  = '${process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ''}';
              window.__POSTHOG_HOST__ = '${process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'}';
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
