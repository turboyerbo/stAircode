/**
 * public/sw.js — Staircode PWA Service Worker
 *
 * Cache-busting strategy:
 *  - CACHE_VERSION is injected at build time via next.config.js
 *  - Falls back to a timestamp so every deploy gets a fresh cache
 *  - On activate: deletes ALL old caches — users never need to manually clear
 *
 * Strategy per resource type:
 *  - API routes (/api/*):         network-only — never cache
 *  - HTML pages:                  network-first — always check for updates
 *  - JS/CSS/images:               cache-first — fast, busted by version change
 */

// __CACHE_VERSION__ is replaced by next.config.js build step.
// Falls back to Date.now() so a missing injection still busts cache.
const CACHE_VERSION = self.__CACHE_VERSION__ || 'staircode-' + Date.now()
const CACHE_NAME    = `staircode-${CACHE_VERSION}`

const PRECACHE_URLS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Pre-cache silently — fail gracefully if any asset 404s
      Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url)))
    )
  )
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting()
})

// ── Activate — delete ALL old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)  // keep only current version
          .map(k => {
            console.log('[SW] Deleting old cache:', k)
            return caches.delete(k)
          })
      )
    ).then(() => self.clients.claim())  // take control of all open tabs
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 0. Ignore non-http(s) schemes (chrome-extension, data, blob, etc.)
  if (!url.protocol.startsWith('http')) return

  // 0b. Ignore cross-origin requests (Google Fonts, GTM, Stripe, etc.)
  //     Only cache/intercept requests to our own origin
  if (url.origin !== self.location.origin) return

  // 1. Never cache API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // 2. Never cache non-GET
  if (request.method !== 'GET') return

  // 3. HTML pages — network-first so users always get the latest deploy
  //    Falls back to cache only if offline
  if (request.headers.get('accept')?.includes('text/html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(c => c.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))  // offline fallback
    )
    return
  }

  // 4. Static assets (JS/CSS/images/fonts) — cache-first
  //    These are content-hashed by Next.js so a new deploy = new URLs
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached

      const response = await fetch(request)
      if (response.ok) cache.put(request, response.clone())
      return response
    })
  )
})

// ── Message: force update ──────────────────────────────────────────────────────
// Clients can send { type: 'SKIP_WAITING' } to force an immediate update
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
