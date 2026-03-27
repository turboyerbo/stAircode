# Staircode Beta — Build Notes

## Release: 1.0.0-beta.1
## Date: March 2026

---

## What's in this build

### Core scan flow
- AI camera coaching via Claude claude-sonnet-4-5 (vision API)
- WebXR plane detection with AI fallback
- 6 measurements: Riser, Tread, Width, Handrail, Nosing, Headroom
- Tread depth line correctly vertical in top-down camera view (fixed)
- Stale closure bug fixed — AI analysis loop fires reliably
- Role-adaptive AI language (homeowner / architect / contractor / real estate)

### Authentication (Supabase)
- Email OTP — real codes sent via Supabase
- Google OAuth (requires Google Cloud Console setup — see DEPLOY.md Part 5)
- Apple OAuth (requires Apple Developer account — see DEPLOY.md Part 5)
- Session persistence via localStorage + Supabase session restore
- Role selection screen (shown once after first login)
- Beta skip button (START →) for testing without auth

### Payments (Stripe)
- $6.99 one-time report — Stripe Checkout (one-time payment mode)
- $19/mo Pro — Stripe Checkout (subscription mode, 7-day free trial)
- Enterprise — Calendly booking link (https://calendly.com/staircode/30min)
- Stripe Customer Portal for Pro subscription management
- Webhook handler for post-payment fulfillment
- Graceful fallback when Stripe not configured (shows report directly)

### Reports
- Full AI-generated compliance report ($6.99)
- 7 sections: stair description, compliance analysis, code sections, occupancy
  type, bylaw notes, risk assessment, disclaimer
- Emailed via Resend after purchase (reports@staircode.app)
- Free pre-analysis summary (print/PDF)

### Analytics (PostHog)
- 13 events tracked across the full funnel
- Session recordings enabled (inputs masked)
- Disabled in development mode (no dev data pollution)

### Feedback (Tally)
- Feedback button in Help and Settings screens
- Opens Tally form in bottom sheet

### Help screen
- 3 illustrated scanning steps (real illustrations, not placeholders)
- Step-by-step instructions per measurement position
- Measurement line legend (colours + directions)
- Updated FAQ

### Store badges
- Google Play badge (LAUNCHING APR 1) on auth screen
- App Store badge (LAUNCHING MAY 1) on auth screen

---

## Environment variables required (add to Netlify)

| Variable | Purpose |
|----------|---------|
| ANTHROPIC_API_KEY | AI vision + report generation |
| NEXT_PUBLIC_APP_URL | https://staircode.app |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key |
| STRIPE_SECRET_KEY | Stripe payments |
| STRIPE_REPORT_PRICE_ID | $6.99 report price ID |
| STRIPE_PRO_PRICE_ID | $19/mo Pro price ID |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret |
| RESEND_API_KEY | Email delivery |
| EMAIL_FROM | reports@staircode.app |
| NEXT_PUBLIC_POSTHOG_KEY | PostHog analytics |
| NEXT_PUBLIC_POSTHOG_HOST | https://app.posthog.com |
| NEXT_PUBLIC_TALLY_FORM_ID | Tally feedback form ID |

---

## Known stubs (non-blocking for beta)

- Payment: Stripe configured but not live — replace price IDs with real ones
- OAuth: Google/Apple require platform setup (see DEPLOY.md Part 5)
- Tally: Replace NEXT_PUBLIC_TALLY_FORM_ID with your real form ID
- RevenueCat: Not yet integrated — required for iOS App Store IAP (May 1)

---

## File structure additions since ARAI_10

New files:
  src/lib/analytics.ts              PostHog event tracking
  src/app/components/FeedbackButton.tsx   Tally feedback button
  src/app/components/RoleSelectScreen.tsx Role picker
  src/app/api/stripe/checkout/route.ts    Stripe checkout
  src/app/api/stripe/webhook/route.ts     Stripe webhook
  src/app/api/stripe/portal/route.ts      Stripe portal
  public/Girl_measuring.png              Scanning illustration
  public/Lady_measuring_clearance.png    Scanning illustration
  public/Man_measuring_handrail.png      Scanning illustration
