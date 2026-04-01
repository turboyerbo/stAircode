/** @type {import('next').NextConfig} */
const { execSync } = require('child_process')

// Generate a unique build ID from git commit hash + timestamp
// This is injected into the service worker so every deploy busts the cache
function getBuildVersion() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
    return `${hash}-${Date.now()}`
  } catch {
    return `build-${Date.now()}`
  }
}

const BUILD_VERSION = getBuildVersion()
console.log('[next.config] Cache version:', BUILD_VERSION)

const nextConfig = {
  // Production domain — used by Next.js for absolute URL generation
  // Set NEXT_PUBLIC_APP_URL=https://staircode.app in Netlify env vars
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://staircode.app',
  },

  trailingSlash: false,

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type',           value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control',          value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type',                value: 'application/json' },
          { key: 'Cache-Control',               value: 'no-cache, no-store, must-revalidate' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type',  value: 'application/json' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type',  value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'X-DNS-Prefetch-Control',    value: 'off' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          {
            key: 'Permissions-Policy',
            value: 'camera=self, geolocation=self, xr-spatial-tracking=self, microphone=(), payment=(), usb=()',
          },
          {
            // CSP: allow eval for PostHog analytics bundle + Next.js internals.
            // unsafe-eval is required by posthog-js (uses Function() internally).
            // Tighten this after PostHog releases an eval-free build.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://www.googletagmanager.com https://www.google-analytics.com",
              "connect-src 'self' https://*.posthog.com https://us.i.posthog.com https://api.anthropic.com https://api.resend.com https://resend.com https://*.supabase.co https://*.stripe.com wss://*.supabase.co https://www.google-analytics.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-src https://tally.so https://js.stripe.com https://*.stripe.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

// Stamp each build with a unique version so sw.js busts the cache on every deploy
const _origWebpack = nextConfig.webpack
nextConfig.webpack = (config, opts) => {
  const { DefinePlugin } = require('webpack')
  const buildId = process.env.NEXT_BUILD_ID || String(Date.now())
  config.plugins.push(new DefinePlugin({ 'self.__CACHE_VERSION__': JSON.stringify(buildId) }))
  return _origWebpack ? _origWebpack(config, opts) : config
}

module.exports = nextConfig
