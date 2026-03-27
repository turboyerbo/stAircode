# iOS Setup — Staircode ARAI_10

Getting Staircode into the **Apple App Store** by May 1.

The approach mirrors Android: wrap the deployed Next.js PWA in a native
container. For iOS the best wrapper is **Capacitor** (open source, free),
which embeds a WKWebView and exposes native device APIs including camera
and ARKit.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| macOS | Ventura 13+ | Required for Xcode |
| Xcode | 15+ | Download from App Store |
| Node.js | 18 LTS+ | Same as Android build |
| CocoaPods | 1.13+ | `sudo gem install cocoapods` |
| Apple Developer Account | Paid ($99/yr) | developer.apple.com |

---

## Step 1 — Install Capacitor

```bash
cd staircode-ARAI_10
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Staircode app.staircode.ios --web-dir=.next/static
```

Or add to `package.json` scripts:
```json
"ios:init":    "cap init Staircode app.staircode.ios",
"ios:add":     "cap add ios",
"ios:sync":    "npm run build && cap sync ios",
"ios:open":    "cap open ios",
"ios:build":   "npm run build && cap sync ios && cap open ios"
```

---

## Step 2 — Build and sync

```bash
npm run build          # Next.js production build
npx cap sync ios       # copies .next/out → ios/App/public
```

> **Note:** You need `output: 'export'` in `next.config.js` for Capacitor's
> static file serving, OR configure Capacitor to point at your live Vercel URL
> (server mode). For App Store, **static export is recommended** so the app
> works offline.

### For static export add to `next.config.js`:
```js
// Add this for iOS Capacitor build:
// output: 'export',   // uncomment for iOS static build
// images: { unoptimized: true },
```
Keep the default (no output: 'export') for the Vercel/Android TWA build.
Maintain a separate `next.config.ios.js` if needed.

---

## Step 3 — Open in Xcode

```bash
npx cap open ios
```

In Xcode:
1. Select your **Team** (requires Apple Developer account)
2. Set **Bundle ID**: `app.staircode.ios`
3. Set **Deployment Target**: iOS 15.0 (for ARKit WebXR support)
4. Enable **Camera** permission in `Info.plist`:
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>Staircode uses your camera to measure stair dimensions using AR.</string>
   ```

---

## Step 4 — ARKit / WebXR on iOS

WebXR plane detection on iOS Safari requires:
- **iOS 16+** for full ARKit plane-detection via WebXR
- **iOS 15.4+** for hit-test only (no plane geometry)

The app already handles this:
- iOS 16+ → WebXR with plane detection (full accuracy)
- iOS 15.4–16 → WebXR hit-test only (good accuracy)
- iOS < 15.4 or WKWebView → AI fallback (ARAI_9 flow)

The `checkXRSupport()` function in `src/lib/xr-measure.ts` handles detection.

**WKWebView limitation:** Capacitor uses WKWebView which does NOT support
`navigator.xr` as of iOS 17. The AI fallback will be used for all Capacitor
iOS builds until Apple enables WebXR in WKWebView.

**Workaround for full AR on iOS:** Use Safari (PWA) instead of Capacitor.
Users can "Add to Home Screen" from Safari to get a PWA that supports WebXR.

---

## Step 5 — App Store submission checklist

- [ ] App icon set (1024×1024 + all required sizes) — add to `ios/App/App/Assets.xcassets`
- [ ] Launch screen storyboard configured
- [ ] Privacy policy URL live at `https://staircode.app/privacy`
- [ ] Terms of service URL live at `https://staircode.app/terms`
- [ ] App Store description written (max 4000 chars)
- [ ] Screenshots prepared: 6.7", 6.1", 5.5" iPhone; optional iPad
- [ ] Age rating: 4+ (no objectionable content)
- [ ] Category: Utilities (primary), Business (secondary)
- [ ] `NSCameraUsageDescription` in Info.plist
- [ ] TestFlight beta distributed to internal testers (at least 1 week before submission)
- [ ] App Review Information filled in (demo credentials if login required)

---

## Timeline to May 1

| Date | Milestone |
|------|-----------|
| March 20 | ARAI_10 code complete ✓ |
| March 25 | iOS Capacitor project set up, runs in simulator |
| April 1  | Android TWA live on Google Play ← **deadline** |
| April 7  | TestFlight internal build |
| April 14 | TestFlight external beta (invite testers) |
| April 21 | Submit to App Store Review |
| May 1    | App Store approval expected ← **deadline** |

> App Review typically takes 1–3 business days.
> Submit by April 21 to have margin before May 1.

---

## Capacitor config

Create `capacitor.config.ts` in the project root:

```typescript
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:    'app.staircode.ios',
  appName:  'Staircode',
  webDir:   'out',                    // Next.js static export output
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',           // respect safe areas
    backgroundColor: '#EEF3F9',
    allowsLinkPreview: false,
  },
  server: {
    // Uncomment to load from live URL instead of static files:
    // url: 'https://staircode.app',
    // cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 300,
      backgroundColor: '#EEF3F9',
      showSpinner: false,
    },
  },
}

export default config
```

---

## Quick command reference

```bash
# Build + sync + open Xcode in one step:
npm run ios:build

# Or manually:
npm run build
npx cap sync ios
npx cap open ios

# Run on connected iPhone (from Xcode):
# Product → Run (⌘R)
```

---

## Troubleshooting

### "WebXR not available" on device
- Ensure iOS 16+ and test in Safari (not Capacitor WKWebView)
- PWA install path: Safari → Share → Add to Home Screen
- App falls back to AI measurement automatically

### "Camera permission denied"
- Check `NSCameraUsageDescription` is in Info.plist
- Device: Settings → Privacy → Camera → Staircode → Allow

### Capacitor sync fails
- Run `npx cap update ios` then `npx cap sync ios`
- Delete `ios/` folder and re-run `npx cap add ios`

### Build fails with CocoaPods error
```bash
cd ios/App
pod install --repo-update
```

### App rejected by App Store Review
Common reasons and fixes:
- **2.1 Performance**: add loading states, test on older devices
- **5.1.1 Privacy**: ensure camera permission string is descriptive
- **4.0 Design**: disclaimer must be visible without scrolling on report screen
