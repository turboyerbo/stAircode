# Staircode ARAI_10 — Launch Checklist

## Google Play — Target: April 1

### Code & Deploy
- [ ] `ANTHROPIC_API_KEY` set in Vercel environment variables
- [ ] `vercel --prod` deployed, URL working in Chrome on Android
- [ ] `twa-manifest.json` → update `host` and all URLs to production domain
- [ ] `public/.well-known/assetlinks.json` → replace SHA256 placeholder with real keystore fingerprint
- [ ] Re-deploy after updating assetlinks.json
- [ ] Verify: `curl https://your-domain/.well-known/assetlinks.json`

### TWA Build
- [ ] `keytool` keystore created, passwords saved securely
- [ ] `bubblewrap init` completed with correct Package ID `app.staircode.twa`
- [ ] `bubblewrap build` produces `app-release-signed.apk` and `app-release.aab`
- [ ] APK tested on physical Android device (not just emulator)
- [ ] Camera permission works: Settings → Apps → Staircode → Permissions → Camera
- [ ] AR measurement completes end-to-end on ARCore device
- [ ] AI fallback works on non-ARCore device

### Play Store Listing
- [ ] Google Play Console account created (developer.android.com/distribute)
- [ ] `app-release.aab` uploaded to Internal Testing track
- [ ] Store listing filled:
  - [ ] App name: Staircode
  - [ ] Short description (80 chars): "Measure stairs with AR. Check building code compliance instantly."
  - [ ] Full description (4000 chars)
  - [ ] Screenshots: phone (min 2), 7" tablet (optional)
  - [ ] Feature graphic: 1024×500px
  - [ ] App icon: 512×512px
  - [ ] Privacy policy URL live
- [ ] Content rating questionnaire completed (Utilities → no issues)
- [ ] Target API level 34 confirmed
- [ ] Permissions declared: CAMERA
- [ ] Promoted to Production track
- [ ] Review submitted by March 25 (Google takes 3–7 days)

---

## iOS App Store — Target: May 1

### Setup
- [ ] Apple Developer Program enrolled ($99/yr at developer.apple.com)
- [ ] Capacitor project set up: `npm run ios:add`
- [ ] `npm run ios:sync` succeeds
- [ ] Xcode project opens: `npm run ios:open`
- [ ] Team selected in Xcode signing settings
- [ ] Bundle ID set: `app.staircode.ios`

### Camera & AR
- [ ] `NSCameraUsageDescription` in Info.plist
- [ ] `NSLocationWhenInUseUsageDescription` in Info.plist (for jurisdiction detection)
- [ ] Camera works in Capacitor WKWebView on device
- [ ] AI fallback works (WKWebView doesn't support WebXR — expected)
- [ ] Note in App Review notes: "Full AR available via Safari PWA; app uses AI-based measurement"

### App Assets
- [ ] App icon set: 1024×1024 (Xcode generates all sizes)
- [ ] Launch screen configured (LaunchScreen.storyboard)
- [ ] Privacy policy at `https://staircode.app/privacy`
- [ ] Terms of service at `https://staircode.app/terms`
- [ ] `public/.well-known/apple-app-site-association` updated with real Team ID

### App Store Connect
- [ ] App record created in App Store Connect (appstoreconnect.apple.com)
- [ ] TestFlight internal build uploaded by April 7
- [ ] Internal testing completed, crash-free session rate > 99%
- [ ] TestFlight external beta by April 14 (optional but recommended)
- [ ] Store listing:
  - [ ] App name: Staircode
  - [ ] Subtitle (30 chars): "Stair Compliance Inspector"
  - [ ] Description (4000 chars)
  - [ ] Keywords (100 chars): stair,compliance,building code,OBC,riser,tread,measurement,AR
  - [ ] Screenshots: 6.7" iPhone (required), 6.1" iPhone, 5.5" iPhone
  - [ ] App Preview video (optional but boosts downloads)
  - [ ] Support URL
  - [ ] Marketing URL (optional)
- [ ] Age rating: 4+
- [ ] Category: Utilities (primary)
- [ ] Pricing: Free
- [ ] App Review information:
  - [ ] Demo account: beta@staircode.app / START button works without login
  - [ ] Notes: "Camera required for measurement. Disclaimer is visible on every report. No inappropriate content."
- [ ] Submit for review by April 21
- [ ] Approval expected by May 1

---

## Post-Launch (both stores)
- [ ] Monitor crash reports (Vercel logs, Play Console, App Store Connect)
- [ ] Respond to early reviews
- [ ] Track Day 1 / Day 7 retention
- [ ] Plan ARAI_11: full native ARKit/ARCore SDK for WKWebView WebXR workaround
