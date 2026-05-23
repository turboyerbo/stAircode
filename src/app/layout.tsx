import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'


// ── PWA + SEO Metadata ─────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'stAIrcode — Stair Compliance',
  description: 'Check your staircase against local building codes. Camera-based measurements, auto-detected jurisdiction (OBC, NBC, QBC, BCBC, IBC and more).',
  applicationName: 'stAIrcode',
  keywords: ['stair compliance', 'building code', 'OBC', 'staircase inspection', 'riser height', 'tread depth'],
  authors: [{ name: 'Just Open Technologies Inc.' }],
  creator: 'Just Open Technologies Inc.',
  publisher: 'Just Open Technologies Inc.',
  manifest: '/manifest.json',
  metadataBase: new URL('https://staircode.app'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'stAIrcode — Stair Compliance',
    description: 'Measure and check your staircase against local building codes using your phone camera.',
    url: 'https://staircode.app',
    siteName: 'stAIrcode',
    type: 'website',
    images: [{ url: '/screenshots/feature-graphic.png', width: 1024, height: 500 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'stAIrcode — Stair Compliance',
    description: 'AR stair measurements checked against OBC, NBC, IRC, IBC and more.',
    images: ['/screenshots/feature-graphic.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'stAIrcode',
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
        <meta name="apple-mobile-web-app-title" content="stAIrcode" />
        {/* S-lettermark icons — cloud icon permanently removed */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0A1C2E" />
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />
        {/* Google Fonts: DM Sans + Syne (logo wordmark) — loaded via <link> tag; optimizeFonts disabled in next.config.js */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(r){ console.log('[SW] Registered:', r.scope); }).catch(function(e){ console.warn('[SW] Failed:', e); }); }); }` }} />
        <script dangerouslySetInnerHTML={{ __html: `window.__POSTHOG_KEY__='${process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ''}';window.__POSTHOG_HOST__='${process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'}';` }} />
        <script dangerouslySetInnerHTML={{ __html: `
          // Silently suppress Chrome/Firefox extension injection errors so they
          // never crash the app UI (e.g. Honey, Grammarly overriding window.open)
          window.addEventListener('error', function(e) {
            var src = (e.filename || '') + (e.error && e.error.stack ? e.error.stack : '');
            if (src.indexOf('chrome-extension://') !== -1 ||
                src.indexOf('moz-extension://') !== -1 ||
                src.indexOf('safari-extension://') !== -1 ||
                src.indexOf('injectScript') !== -1) {
              e.preventDefault(); e.stopPropagation(); return true;
            }
          }, true);
          window.addEventListener('unhandledrejection', function(e) {
            var msg = e.reason && (e.reason.message || e.reason.stack || String(e.reason));
            if (msg && (msg.indexOf('chrome-extension://') !== -1 ||
                        msg.indexOf('moz-extension://') !== -1 ||
                        msg.indexOf('injectScript') !== -1 ||
                        msg.indexOf('read only property') !== -1)) {
              e.preventDefault(); return;
            }
          });
        `}} />
      </head>
      <body>
        {children}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-SJSZV0KBFE" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-SJSZV0KBFE',{page_path:window.location.pathname});`}</Script>
      </body>
    </html>
  )
}
