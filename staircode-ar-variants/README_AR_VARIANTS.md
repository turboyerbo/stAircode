# stAIrcode — AR Variant Architecture

## Three parallel versions

| Version | Platform | AR Technology | Accuracy | Status |
|---|---|---|---|---|
| **Web PWA** | Chrome/Safari | Claude AI Vision | ±9–25mm | Deployed |
| **Android Native** | Android 7+ w/ARCore | WebXR + ARCore depth API | ±2–5mm | This doc |
| **iOS Native** | iPhone 12 Pro+ | RealityKit + LiDAR | ±0.5–2mm | This doc |

---

## Why each version needs a different codebase

### Web PWA (existing — staircode.app)
Cannot use ARCore or LiDAR because:
- Safari on iOS blocks all WebXR AR APIs entirely (Apple WKWebView restriction)
- Android Chrome requires ARCore + flags enabled — only ~30% of devices qualify
- PWAs cannot access native depth buffers or LiDAR hardware

**Measurement method:** Claude Vision AI analyses full-res camera frame

### Android (WebXR + ARCore)
WebXR `immersive-ar` with `plane-detection` and `depth-sensing` feature descriptors
wraps Google ARCore. Works when:
- Chrome for Android 81+ is installed
- Device has ARCore support (mid-range and up, Android 7+)
- App served over HTTPS or as a TWA (Trusted Web Activity)

**This is buildable as a TWA wrapping staircode.app** — same Next.js codebase,
different entry point that requests the WebXR session.

### iOS Native (RealityKit + LiDAR)
Apple's LiDAR scanner (iPhone 12 Pro, 13/14/15/16 Pro series, all iPad Pro 2020+)
provides a depth mesh accurate to ±1mm at close range. Cannot be accessed from:
- Safari WebXR (Apple exposes limited WebXR, no depth API)
- Any web technology

**Requires a native Swift app using RealityKit/ARKit.**
Can still call the staircode.app API for report generation.

---

## Variant 1: Android TWA with WebXR ARCore

### What is a TWA?
A Trusted Web Activity is a Chrome Custom Tab that loads your website full-screen
with no browser UI. It qualifies for WebXR AR because Chrome considers it a
first-party context. Your existing PWA manifest makes this straightforward.

### How measurement works
```
User taps "Measure" →
  navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['plane-detection', 'hit-test'],
    optionalFeatures: ['depth-sensing', 'dom-overlay'],
  }) →
  ARCore initialises → scans environment →
  XRPlane events fire with horizontal/vertical planes →
  app picks best matching plane for each measurement →
  sends to /api/vision for AI cross-validation →
  result shown with ±2mm confidence
```

### Build steps (requires Android Studio + Java 11)
```bash
# 1. Install Bubblewrap CLI (Google's TWA builder)
npm install -g @bubblewrap/cli

# 2. Initialise TWA from your PWA manifest
bubblewrap init --manifest https://staircode.app/manifest.json

# 3. Build signed APK
bubblewrap build

# 4. Output: app-release.apk → upload to Play Store
```

### Required manifest additions (public/manifest.json)
```json
{
  "related_applications": [{
    "platform": "play",
    "id": "app.staircode.android"
  }]
}
```

### WebXR session code (src/lib/arcore-session.ts)
See: `/android-webxr/src/lib/arcore-session.ts` in this repo

---

## Variant 2: iOS Native (Swift + RealityKit + LiDAR)

### Architecture
```
Swift App (Xcode project)
  ├── ARKit / RealityKit session
  │     ├── LiDAR depth mesh (sceneDepth)
  │     ├── Plane detection (ARPlaneAnchor)
  │     └── Hit-test / raycasting
  ├── Measurement engine (Swift)
  │     ├── StairMeasurement.swift
  │     └── DepthSampler.swift
  ├── WebView layer (WKWebView)
  │     └── Loads staircode.app for auth/report/billing
  └── Native → Web bridge (WKScriptMessageHandler)
        └── Passes measurements to web layer as JSON
```

### How LiDAR measurement works
```swift
// 1. Get depth frame from ARFrame
let depthMap = frame.sceneDepth?.depthMap  // CVPixelBuffer, Float32

// 2. Sample depth at target pixel (centre of stair face)
let depth = depthMap.sampleMetres(at: screenPoint)  // e.g. 0.178m = 178mm

// 3. Find stair planes via ARPlaneAnchor
// iPhone places plane anchors on detected horizontal/vertical surfaces
// Each ARPlaneAnchor has .extent (width × height in metres)

// 4. Riser height = vertical distance between two horizontal planes
// Tread depth = depth distance from nosing to back riser

// 5. Send to web layer
webView.evaluateJavaScript("""
  window.nativeMeasurement({
    rise: \(riserMm),
    run: \(treadMm),
    width: \(widthMm),
    confidence: "high",
    method: "lidar"
  })
""")
```

### Xcode project structure
See: `/ios-native/` directory in this repo

---

## Shared measurement API

All three versions call the same backend:
- `POST /api/vision` — AI cross-validation of measurements
- `POST /api/report/generate` — generate + email compliance report
- `GET /api/geo` — location detection for code jurisdiction

The native apps authenticate via the same Supabase auth, use the same
Stripe subscription, and generate the same report format.
