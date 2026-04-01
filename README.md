# stAIrcode

AI-powered stair compliance inspector. Built by Just Open Technologies Inc.

## Stack
- Next.js 14 PWA → deployed on Netlify (staircode.app)
- Claude Vision API for AI measurements
- ARCore (Android) / ARKit (iOS) for plane detection
- Supabase (auth + DB), Stripe (payments), Resend (email), PostHog (analytics)

## Development
```bash
npm install
npm run dev
```

## Deploy
Push to `main` → Netlify auto-deploys.

## Android
```bash
bubblewrap build
# Upload app-release-bundle.aab to Google Play Console
```

## Env vars
See `.env.example` for required environment variables.
