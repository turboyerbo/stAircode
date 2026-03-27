# Staircode — ARAI_10

**Stair Code Compliance Inspector** — Next.js PWA + Android TWA.
AI-powered camera measurements checked against NBC, OBC, IRC, IBC, and more.

## Quick start

```bash
git clone <your-repo-url>
cd staircode-ARAI_10
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                   # open http://localhost:3000
```

**For Android deployment → see [ANDROID_SETUP.md](./ANDROID_SETUP.md)**

## How the server-side protection works

All compliance logic lives in `src/lib/compliance-engine.ts`.
This file **runs only on the server** and is never sent to the browser.

```
Browser                          Your Server (hidden)
──────                           ────────────────────
User enters measurements    →    POST /api/check
                            ←    Pass/fail results only

User clicks Find Local Firms →   GET /api/firms?lat=…&lng=…
                            ←    Firm list only
```

What users can NEVER see:
- Code limit values (e.g. NBC riser: 125mm–200mm)
- Pass/fail logic
- Firm query logic

---

## Project structure

```
staircode/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── check/
│   │   │   │   └── route.ts      ← POST /api/check  (SERVER ONLY)
│   │   │   └── firms/
│   │   │       └── route.ts      ← GET  /api/firms  (SERVER ONLY)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx              ← Browser UI (no logic here)
│   └── lib/
│       └── compliance-engine.ts  ← YOUR PROTECTED IP (SERVER ONLY)
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## Getting started

### 1. Install prerequisites (one time)

- **Node.js 18+** — download from https://nodejs.org (LTS version)
- **VS Code** — download from https://code.visualstudio.com

### 2. Clone and install

```bash
git clone https://github.com/your-repo/staircode-ARAI_10.git
cd staircode-ARAI_10
npm install
```

### 3. Add your API key

```bash
cp .env.example .env.local
# Edit .env.local and set ANTHROPIC_API_KEY=your_key_here
```
Get your key at https://console.anthropic.com

### 4. Run locally

```bash
npm run dev
```
Open http://localhost:3000 in your browser.

### 5. Deploy to Vercel

```bash
npm install -g vercel
vercel
# Add ANTHROPIC_API_KEY when prompted
```

See `ANDROID_SETUP.md` for full Android / TWA packaging instructions.

---

## Adding a new building code

All you need to do is add an entry to `CODE_SPECS` in
`src/lib/compliance-engine.ts`:

```typescript
MYCODE: {
  label: 'My Custom Code 2024',
  ref:   'Section X.X.X',
  fields: {
    riser:     { min: 130, max: 190 },
    tread:     { min: 240 },
    // ...etc
  }
}
```

Then add it to `CODE_META` in the same file so it appears in the UI.

---

## Tech stack

| Layer      | Technology          |
|------------|---------------------|
| Framework  | Next.js 14          |
| Language   | TypeScript          |
| Styling    | CSS (globals.css)   |
| Map        | Leaflet.js          |
| Map data   | OpenStreetMap/CARTO |
| Firm data  | Overpass API (OSM)  |
| Hosting    | Vercel (recommended)|

---

## Next build — staircode-ARAI_10 roadmap

### AR plane detection (replacing AI-only measurement)

The current measurement flow sends a still frame to Claude and asks it to
estimate dimensions from visual reasoning alone. The next build should
explore native AR plane detection so the app can anchor measurements to
real-world geometry rather than inferring it from a photo.

---

#### Option 1 — WebXR (recommended first attempt)

**What it is:** The W3C browser standard for AR/VR. On Android it runs on
top of ARCore; on iOS it runs on top of ARKit (Safari 15.4+).

**What it gives you:**
- `XRHitTestSource` — ray-cast against detected real-world surfaces to find
  where a ray from the camera intersects a plane
- `XRPlane` objects — actual planar surface geometry with real-world
  coordinates and orientation, updated every frame
- `XRAnchor` — pin a measurement widget to a detected surface so it stays
  locked even as the user moves the phone

**How it fits StairCode:**
Replace the still-frame AI call with a live WebXR session. The device's
camera + IMU map the riser face or tread surface as a real geometric plane.
The app ray-casts to find the plane, reads its size from the `XRPlane`
geometry, and derives the measurement without needing AI to guess from
pixels.

**Browser support:**
- ✅ Android — Chrome 81+ (ARCore required, ships on most Android 8+)
- ⚠️  iOS — Safari 15.4+ supports `immersive-ar` but plane detection API
  is still behind a flag in some versions; test on device

**Key implementation files to create:**
```
src/app/components/ARSession.tsx     ← WebXR session lifecycle + hit-test
src/app/components/ARPlaneView.tsx   ← renders detected planes on canvas
src/lib/xr-measure.ts               ← derives mm from XRPlane geometry
```

**Detection pattern (pseudo-code):**
```typescript
const session = await navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['hit-test', 'plane-detection'],
})
session.addEventListener('planesdetected', (event) => {
  for (const plane of event.planes) {
    // plane.polygon gives real-world corner points in metres
    // derive width/height from bounding box
  }
})
```

---

#### Option 2 — 8th Wall (best iOS fallback)

**What it is:** Commercial WebAR platform (Niantic). Runs its own CV
pipeline in WebAssembly — no ARCore/ARKit required, works in any mobile
browser including iOS Safari with no flags.

**Why consider it:** The most reliable cross-platform option for production.
Handles all the camera + IMU fusion internally.

**Cost:** Paid licence (free trial available at 8thwall.com).

**Integration:** Drop-in `<script>` tag + their world-tracking component.
Surface detection is exposed as a Three.js scene graph — attach measurement
geometry directly to detected plane anchors.

---

#### Option 3 — AR.js (open source, simpler)

Lightweight, free, works on top of Three.js or A-Frame. Primarily
marker-based or GPS-based rather than true planar detection. Good for
prototyping but less suitable for precise measurement.

---

#### Recommended architecture for ARAI_10

1. **Runtime feature detection** — on app start, check
   `navigator.xr?.isSessionSupported('immersive-ar')`.
2. **If supported** → launch WebXR session, use plane detection for
   measurement (no AI still-frame call needed).
3. **If not supported** → fall back gracefully to the current
   AI-from-still-frame flow (already in place in ARAI_9).
4. **8th Wall as an optional build target** — keep the same component
   interface (`onMeasureComplete(mm: number)`) so either backend slots in
   without changing the rest of the app.

This means ARAI_9 users on older devices see no regression, while users on
ARCore/ARKit-capable devices get sub-millimetre accuracy from real geometry.

---

Copyright © 2026. All rights reserved.
