# DEPLOY.md — From ZIP to staircode.app

Everything you need to run, test, and ship Staircode.
Do these steps in order. Each section tells you exactly what to type.

---

## Prerequisites (one-time installs)

If you haven't already, install these:

| What | Download |
|------|---------|
| Node.js 18 LTS | https://nodejs.org (click "LTS") |
| Git | https://git-scm.com |
| VS Code (optional) | https://code.visualstudio.com |

Verify:
```bash
node -v    # must print v18 or higher
npm -v     # must print 9 or higher
git --version
```

---

## Part 1 — Run locally (test before deploying)

### 1. Unzip and open
Unzip `staircode-ARAI_10.zip` anywhere on your computer.
Open a terminal (Git Bash on Windows, Terminal on Mac) and navigate into the folder:

```bash
cd path/to/staircode-ARAI_10
```

### 2. Install dependencies
```bash
npm install
```
This downloads ~200MB of packages into `node_modules/`. Takes 1–3 minutes.

### 3. Add your API key
```bash
cp .env.example .env.local
```
Open `.env.local` in any text editor and replace the placeholder:
```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_REAL_KEY_HERE
```
Get your key at https://console.anthropic.com → API Keys.

### 4. Run the dev server
```bash
npm run dev
```
Open http://localhost:3000 in Chrome on your phone or computer.
You should see the Staircode sign-in screen.

**Test the full flow:**
1. Tap **START →** (beta skip — no real login needed)
2. Tap **● Start Scan**
3. Point camera at stairs → tap the red button
4. Walk through measurements → get compliance report

If it works locally, you're ready to deploy.

---

## Part 2 — Deploy to staircode.app (Vercel)

### 5. Install Vercel CLI
```bash
npm install -g vercel
```

### 6. Log in to Vercel
```bash
vercel login
```
This opens a browser. Sign in with GitHub, Google, or email.

### 7. Link to your staircode.app project
If this is your first deploy:
```bash
vercel
```
Vercel will ask a few questions — accept all defaults (Next.js, root directory).

If you already have the project in Vercel and own staircode.app:
```bash
vercel link
# Select your existing project
```

### 8. Add your API key to Vercel
```bash
vercel env add ANTHROPIC_API_KEY production
# Paste your sk-ant-... key when prompted
```

Or go to vercel.com → your project → Settings → Environment Variables → Add.

### 9. Deploy to production
```bash
vercel --prod
```
After ~2 minutes, Vercel prints:
```
✅  Production: https://staircode.app
```

Open https://staircode.app in Chrome on your phone — it should be fully live.

### 10. Verify the PWA works
In Chrome on Android:
- Open https://staircode.app
- Tap the three-dot menu → "Add to Home Screen"
- Open the installed icon → should open fullscreen with no browser bar

---

## Part 3 — Google Play (target: April 1)

### 11. Install additional tools

**Java JDK 17** — https://adoptium.net (download "Temurin 17")

**Bubblewrap CLI:**
```bash
npm install -g @bubblewrap/cli
```

**Android Studio** — https://developer.android.com/studio
After installing, open it once so it downloads the Android SDK.

Verify:
```bash
java -version      # must show 17
bubblewrap --version
```

### 12. Create your signing keystore (ONCE — keep this file forever)
```bash
keytool -genkey -v \
  -keystore staircode-release-key.jks \
  -alias staircode \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```
Fill in the prompts (name, org, country). **Save the passwords you enter — they cannot be recovered.**

### 13. Get your SHA-256 fingerprint
```bash
keytool -list -v \
  -keystore staircode-release-key.jks \
  -alias staircode | grep SHA256
```
Copy the output — looks like `AB:CD:EF:12:34:...`

### 14. Paste fingerprint into assetlinks.json
Open `public/.well-known/assetlinks.json` and replace the placeholder:
```json
"sha256_cert_fingerprints": [
  "AB:CD:EF:12:34:56:78:90:..."
]
```

### 15. Redeploy with the updated assetlinks
```bash
vercel --prod
```
Verify it's live:
```bash
curl https://staircode.app/.well-known/assetlinks.json
```
You should see your fingerprint in the response.

### 16. Generate the Android project
```bash
bubblewrap init --manifest=https://staircode.app/manifest.json
```
When prompted, use these values:

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
| Min SDK | `19` |
| Target SDK | `34` |
| Signing key path | `./staircode-release-key.jks` |
| Signing key alias | `staircode` |

### 17. Build the APK + AAB
```bash
npm run twa:build
```
This produces:
- `app-release-signed.apk` — test on your device
- `app-release.aab` — upload to Google Play

### 18. Test on your Android phone
Enable USB debugging on your phone:
1. Settings → About Phone → tap **Build Number** 7 times
2. Settings → Developer Options → turn on **USB Debugging**
3. Plug in via USB → accept the popup

Then install:
```bash
adb install app-release-signed.apk
```
Open Staircode from your app drawer. Camera and AR should work.

### 19. Upload to Google Play Console
1. Go to https://play.google.com/console
2. Create a new app → "Staircode"
3. Upload `app-release.aab` to the **Internal Testing** track
4. Fill in the store listing (name, description, screenshots)
5. Answer the content rating questionnaire (Utilities → no issues)
6. Submit for review

---

## Part 4 — After every code change

You **do not** need to rebuild the APK for most changes. Just:

```bash
# 1. Edit your code
# 2. Redeploy
vercel --prod
```

The TWA always loads the live URL — the Android app updates instantly.

Only rebuild the APK (`npm run twa:build`) if you change:
- The package ID
- App icons
- Signing key
- Android manifest settings

---

## Quick reference

| Command | What it does |
|---------|-------------|
| `npm install` | Install dependencies (first time only) |
| `npm run dev` | Run locally at localhost:3000 |
| `npm run build` | Build for production (Vercel does this automatically) |
| `vercel --prod` | Deploy to staircode.app |
| `vercel env add ANTHROPIC_API_KEY production` | Add API key to Vercel |
| `npm run twa:build` | Build Android APK + AAB |
| `adb install app-release-signed.apk` | Install on connected Android phone |

---

## Troubleshooting

**`npm install` fails**
→ Make sure you're running Node 18+: `node -v`

**Blank white screen at localhost:3000**
→ Check your `.env.local` has the real API key, not the placeholder

**"Module not found" error on `npm run dev`**
→ Run `npm install` again, then retry

**Camera doesn't work in the browser**
→ Must use HTTPS in production (Vercel handles this). Locally, Chrome allows camera on localhost.

**`vercel --prod` says "not linked"**
→ Run `vercel link` first to connect to your existing project

**`bubblewrap` says "Java not found"**
```bash
# macOS
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
# Windows — add to System Environment Variables:
JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.x.x.x-hotspot
```

**TWA opens in browser tabs instead of fullscreen**
→ Your `assetlinks.json` fingerprint doesn't match your keystore.
Re-run step 13, copy the fingerprint again, update the file, redeploy.

---

## Part 5 — Google & Apple OAuth (before public launch)

These are optional for beta. Email OTP works without them.
You need the Supabase env vars configured first (Part 1 Step 3).

---

### Google OAuth (~30 min)

**Step 1 — Google Cloud Console**
1. Go to https://console.cloud.google.com
2. Create a new project (or select existing) — name it "Staircode"
3. APIs & Services → OAuth consent screen
   - User type: External
   - App name: Staircode
   - Support email: info@staircode.com
   - Authorised domain: staircode.app
   - Save
4. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: **Web application**
   - Name: Staircode Web
   - Authorised redirect URI — add exactly:
     ```
     https://[YOUR-SUPABASE-PROJECT-REF].supabase.co/auth/v1/callback
     ```
     (find your project ref in Supabase dashboard → Settings → General)
5. Copy the **Client ID** and **Client Secret**

**Step 2 — Supabase dashboard**
1. Go to your Supabase project → Authentication → Providers
2. Click **Google** → toggle Enable
3. Paste Client ID and Client Secret
4. Save

**Step 3 — Test**
Deploy to Netlify, open staircode.app, tap "Continue with Google" — should open Google's consent screen.

---

### Apple OAuth (~1 hour, requires $99/yr Apple Developer account)

**Step 1 — Apple Developer portal** (developer.apple.com → Account)

1. **Identifiers → App IDs** → Register a new App ID
   - Platform: iOS / iPadOS
   - Bundle ID: `app.staircode.ios`
   - Enable "Sign In with Apple" capability
   - Save

2. **Identifiers → Services IDs** → Register a new Services ID
   - Description: Staircode Web
   - Identifier: `app.staircode.web`  ← this is your Client ID for Supabase
   - Enable "Sign In with Apple" → Configure:
     - Primary App ID: the App ID you just created
     - Domains: `staircode.app`
     - Return URL:
       ```
       https://[YOUR-SUPABASE-PROJECT-REF].supabase.co/auth/v1/callback
       ```
   - Save

3. **Keys** → Create a new key
   - Name: Staircode Sign In with Apple
   - Enable "Sign In with Apple" → Configure → select your Primary App ID
   - Register → Download the `.p8` file  ⚠️ **Download once — cannot re-download**
   - Note the **Key ID** shown after download

4. Note your **Team ID** — shown top-right of the developer portal (10-character string)

**Step 2 — Supabase dashboard**
1. Authentication → Providers → **Apple** → Enable
2. Fill in:
   - Service ID (Client ID): `app.staircode.web`
   - Team ID: your 10-char team ID
   - Key ID: from step 3 above
   - Private Key: open the `.p8` file in a text editor, paste the entire contents
3. Save

**Step 3 — Test**
Deploy, open staircode.app in Safari on an iPhone, tap "Continue with Apple".

---

### Notes

- Google OAuth works on all browsers. Apple OAuth only shows correctly in Safari — Chrome on iOS will redirect through Safari.
- Both providers redirect the user to Supabase's callback URL, which then redirects back to staircode.app. The Supabase session is automatically detected by the `onAuthStateChange` listener already in `page.tsx`.
- If a user signs in with Google and their email matches an existing OTP account, Supabase merges them automatically.
- For the Android TWA (Play Store app): Google OAuth works fine since it's Chrome under the hood. Apple OAuth may show a browser tab — this is expected behaviour in a TWA.


---

## Part 6 — Analytics & Feedback (PostHog + Tally)

### PostHog (~10 min)

1. Sign up at **posthog.com** → Create project → name it "Staircode"
2. Copy your **Project API Key** (starts with `phc_`)
3. Add to Netlify environment variables:
   ```
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxx
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
   ```
   (Use `https://eu.posthog.com` if you want EU data residency)
4. Redeploy — events start flowing immediately

**Events tracked automatically:**
- `user_signed_in` — method (otp / google / apple / beta)
- `role_selected` — homeowner / architect / contractor / realestate
- `scan_started` — with role, code label, location
- `measurement_locked` — per dimension (rise, run, width, guard)
- `scan_completed` — measurement count, pass/fail summary
- `report_generated` — verdict, fail count, code label
- `pricing_viewed` — every time the plans sheet opens
- `purchase_initiated` — report / pro / enterprise
- `purchase_completed` — after Stripe redirect
- `purchase_cancelled` — after Stripe cancel
- `export_clicked` — print / copy
- `find_inspector_clicked`
- `feedback_opened` — source screen

**Session recordings** are on by default. Input fields are masked.
View them at posthog.com → Session Recordings.

**Useful funnels to set up in PostHog:**
- Acquisition funnel: `scan_started` → `scan_completed` → `pricing_viewed` → `purchase_initiated` → `purchase_completed`
- Role analysis: break down any event by `role` property to see if architects convert better than homeowners
- Drop-off: where between `scan_started` and `scan_completed` do users quit?

---

### Tally Feedback Form (~10 min)

1. Sign up at **tally.so** (free)
2. Create a new form with these questions:
   - "What were you trying to do?" (Short text)
   - "Did it work as expected?" (Multiple choice: Yes / No / Partially)
   - "What was confusing or frustrating?" (Long text)
   - "How likely are you to recommend Staircode? 1–10" (Rating scale)
   - "Any other thoughts?" (Long text, mark as optional)
3. Publish the form
4. Copy the form ID from the URL:
   `https://tally.so/r/XXXXXX` → ID is `XXXXXX`
5. Add to Netlify environment variables:
   ```
   NEXT_PUBLIC_TALLY_FORM_ID=XXXXXX
   ```
6. Redeploy

The feedback button appears:
- In the **Help screen** → Support section (above the email link)
- In the **Settings screen** → Beta Testing section

Every form open is tracked as `feedback_opened` in PostHog so you can see how many users engage with it.

