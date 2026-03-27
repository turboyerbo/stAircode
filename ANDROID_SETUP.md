# Android Studio Setup — Staircode ARAI_10

This app is a **Next.js PWA** wrapped as an Android app using
**TWA (Trusted Web Activity)** via Google's Bubblewrap CLI.
There is no native Android/Kotlin code — the WebView loads your
deployed web app URL. You build the APK once; all future updates
are just web deploys with no new APK needed.

---

## Quick start (5 steps)

```
1. npm install && cp .env.example .env.local   (add your API key)
2. vercel --prod                                (deploy web app)
3. Update twa-manifest.json with your URL
4. bubblewrap init --manifest=https://your-url/manifest.json
5. bubblewrap build  →  adb install app-release-signed.apk
```

---

## Prerequisites

Install all of these before starting:

| Tool | Version | Link |
|------|---------|------|
| Node.js | 18 LTS+ | https://nodejs.org |
| Git | any | https://git-scm.com |
| Vercel CLI | latest | `npm i -g vercel` |
| Bubblewrap CLI | latest | `npm i -g @bubblewrap/cli` |
| Java JDK | 17 | https://adoptium.net |
| Android Studio | Hedgehog+ | https://developer.android.com/studio |

Check everything is installed:
```bash
node -v        # should print v18+
java -version  # should print 17+
bubblewrap --version
adb --version  # comes with Android Studio
```

---

## Step 1 — Set up your API key

```bash
cp .env.example .env.local
```

Open `.env.local` and replace `sk-ant-...` with your real Anthropic key
from https://console.anthropic.com

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Test locally first:**
```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## Step 2 — Deploy the web app

The Android TWA wraps a **live URL** — you must deploy before building the APK.

### Vercel (recommended — free tier works fine)
```bash
npm i -g vercel
vercel --prod
```

Vercel will print your URL, e.g. `https://staircode-arai-10.vercel.app`

**Add your API key to Vercel:**
```bash
vercel env add ANTHROPIC_API_KEY
# paste your key when prompted
vercel --prod   # redeploy with the env var
```

Or in the Vercel dashboard: Project → Settings → Environment Variables

### Netlify alternative
```bash
npm i -g netlify-cli
netlify deploy --prod
# then: netlify env:set ANTHROPIC_API_KEY sk-ant-...
```

---

## Step 3 — Update URLs in config files

Replace `staircode.app` with your actual deployed URL everywhere.

### `twa-manifest.json` — update these fields:
```json
{
  "host": "staircode-arai-10.vercel.app",
  "fullScopeUrl": "https://staircode-arai-10.vercel.app/",
  "iconUrl": "https://staircode-arai-10.vercel.app/icons/icon-512.png",
  "maskableIconUrl": "https://staircode-arai-10.vercel.app/icons/icon-maskable-512.png",
  "monochromeIconUrl": "https://staircode-arai-10.vercel.app/icons/icon-512.png",
  "webManifestUrl": "https://staircode-arai-10.vercel.app/manifest.json"
}
```

Leave everything else as-is.

---

## Step 4 — Generate the Android project

```bash
bubblewrap init --manifest=https://your-url/manifest.json
```

Bubblewrap will prompt for settings. Use these answers exactly:

| Prompt | Value |
|--------|-------|
| Package ID | `app.staircode.twa` |
| App name | `Staircode` |
| Launcher name | `Staircode` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar color | `#1565C0` |
| Nav bar color | `#1565C0` |
| Background color | `#0d0f14` |
| Start URL | `/` |
| Icon | *(auto-loaded from manifest)* |
| Min SDK | `19` |
| Target SDK | `34` |
| Signing key path | `./staircode-release-key.jks` |
| Signing key alias | `staircode` |

This creates an `android/` folder. **Do not commit it** — `.gitignore` already excludes it.

---

## Step 5 — Create your signing keystore

Run this once. **Save the passwords — they cannot be recovered.**

```bash
keytool -genkey -v \
  -keystore staircode-release-key.jks \
  -alias staircode \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Get your SHA-256 fingerprint

```bash
keytool -list -v \
  -keystore staircode-release-key.jks \
  -alias staircode \
  | grep SHA256
```

Copy the fingerprint (format: `AB:CD:EF:12:34:...`) and paste it into
`public/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.staircode.twa",
      "sha256_cert_fingerprints": [
        "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78"
      ]
    }
  }
]
```

**Redeploy after editing assetlinks.json:**
```bash
vercel --prod
```

Verify it's live: `https://your-url/.well-known/assetlinks.json`

---

## Step 6 — Build the APK

```bash
bubblewrap build
```

Or via npm:
```bash
npm run twa:build
```

Output files:
- `app-release-signed.apk` — install directly on device for testing
- `app-release.aab` — upload to Google Play Store

---

## Step 7 — Install on your device

```bash
# Enable USB Debugging first (see below), then:
adb install app-release-signed.apk
```

### Enable USB Debugging on Android
1. **Settings → About Phone** → tap **Build Number** 7 times rapidly
2. **Settings → Developer Options** → turn on **USB Debugging**
3. Plug phone into computer via USB → accept the "Allow USB Debugging?" popup

---

## Step 8 — Open in Android Studio (optional)

If you want to run/debug via Android Studio:

1. Open **Android Studio**
2. **File → Open** → navigate to `staircode-ARAI_10/android/`
3. Wait for Gradle sync (2–5 min first time)
4. Click **▶ Run** with your device selected

### First-time Android Studio setup
- Install SDK: **SDK Manager → SDK Platforms → Android 14 (API 34)**
- Install build tools: **SDK Manager → SDK Tools → Android SDK Build-Tools 34**
- Set `JAVA_HOME` if needed:
  ```bash
  # macOS
  export JAVA_HOME=$(/usr/libexec/java_home -v 17)
  # add to ~/.zshrc or ~/.bashrc to persist

  # Windows — set in System Environment Variables
  JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.x.x
  ```

---

## Camera permissions in the TWA

The WebView inherits camera permission from the manifest automatically.
If the camera doesn't work after install:
- **Settings → Apps → Staircode → Permissions → Camera → Allow**

The `next.config.js` already sets `Permissions-Policy: camera=self` which
Android's TWA honours.

---

## Updating the app after code changes

```bash
# 1. Make your code changes
# 2. Redeploy
vercel --prod

# That's it — TWA loads the live URL, no new APK needed.
# Only rebuild the APK if you change package ID, icons, or signing.
```

---

## Troubleshooting

### "Digital Asset Links verification failed" — app falls back to browser tabs
- Check `assetlinks.json` is live: `curl https://your-url/.well-known/assetlinks.json`
- SHA256 in the file must match your `.jks` keystore exactly
- Verify with Google's tool: https://developers.google.com/digital-asset-links/tools/generator

### "App not installed"
```bash
adb uninstall app.staircode.twa   # remove old version first
adb install app-release-signed.apk
```

### White/blank screen on launch
- Visit your deployed URL in Chrome on the same device — does it load?
- Check there are no console errors at that URL
- Make sure `ANTHROPIC_API_KEY` is set in Vercel environment variables

### Bubblewrap "Java not found"
```bash
# macOS
export JAVA_HOME=$(/usr/libexec/java_home -v 17)

# Linux
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

# Then retry:
bubblewrap build
```

### Gradle sync fails in Android Studio
- **File → Invalidate Caches → Invalidate and Restart**
- Make sure Android SDK API 34 and Build-Tools 34 are installed in SDK Manager

---

## File reference

```
staircode-ARAI_10/
├── src/app/                        ← Next.js app (the web part)
│   ├── page.tsx                    ← App entry point
│   ├── layout.tsx                  ← HTML shell + PWA meta tags
│   ├── components/                 ← All UI screens
│   └── api/
│       ├── vision/route.ts         ← AI measurement (needs ANTHROPIC_API_KEY)
│       └── check/route.ts          ← Compliance engine (server-only)
│
├── public/
│   ├── index.html                  ← Static fallback root
│   ├── manifest.json               ← PWA manifest (TWA reads this) ✓ UPDATED
│   ├── sw.js                       ← Service worker
│   ├── icons/                      ← App icons (192 + 512, regular + maskable)
│   └── .well-known/
│       └── assetlinks.json         ← ⚠ UPDATE SHA256 WITH YOUR KEYSTORE
│
├── twa-manifest.json               ← ⚠ UPDATE host URL TO YOUR DEPLOYMENT
├── vercel.json                     ← Vercel deployment config ✓
├── netlify.toml                    ← Netlify deployment config ✓
├── next.config.js                  ← Next.js + security headers ✓
├── package.json                    ← Includes twa:build script ✓
├── .env.example                    ← Copy to .env.local and add API key
├── .gitignore                      ← Excludes android/, *.jks, .env.local ✓
└── android/                        ← Generated by bubblewrap (not in git)
```

---

## Two things you MUST do before the APK will work

1. **Add `ANTHROPIC_API_KEY`** to Vercel/Netlify environment variables
2. **Update SHA256** in `public/.well-known/assetlinks.json` with your keystore fingerprint

Everything else is already configured.
