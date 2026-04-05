## iOS Xcode Project Setup — stAIrcode LiDAR Edition

### Requirements
- Xcode 15+
- macOS 13+ (Ventura or later)
- Apple Developer account ($99/year)
- iPhone 12 Pro / 13 Pro / 14 Pro / 15 Pro / 16 Pro for LiDAR testing
  (also: iPad Pro 2020, 2021, 2022, M4)

---

### 1. Create Xcode project

```
File → New → Project → App
Product Name: stAIrcode
Bundle ID: app.staircode.ios
Language: Swift
Interface: Storyboard (not SwiftUI — needed for ARView)
```

---

### 2. Add frameworks

In Xcode project target → Frameworks, Libraries, and Embedded Content → add:
- `ARKit.framework`
- `RealityKit.framework`
- `WebKit.framework`
- `CoreMotion.framework`

---

### 3. Info.plist permissions

Add these keys to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>stAIrcode uses the camera to scan and measure staircases for compliance inspection.</string>

<key>NSMotionUsageDescription</key>
<string>stAIrcode uses motion sensors for AR positioning and measurement accuracy.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>stAIrcode uses your location to determine the applicable building code for your jurisdiction.</string>
```

---

### 4. Copy Swift files into project

Add these files to the Xcode project:
```
StairCode/
  AR/
    ViewController.swift         (main view controller)
  Measurement/
    StairMeasurement.swift       (LiDAR measurement engine)
  Bridge/
    MeasurementBridge.swift      (Swift ↔ JS bridge)
```

---

### 5. Entitlements

Create `stAIrcode.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>aps-environment</key>
    <string>development</string>
</dict>
</plist>
```

---

### 6. Build settings

- Deployment target: iOS 15.0+
- Supported devices: iPhone (iPad optional)
- Device orientation: Portrait only (prevents AR session interruption)

---

### 7. How the native + web layers interact

```
iPhone boots the app
  → ViewController launches ARView (LiDAR camera feed, full screen)
  → WKWebView loads https://staircode.app (transparent, full screen overlay)
  → Bridge JS injected: window.stairCodeNative becomes available
  → Web React detects window.stairCodeNative.isNative === true
  → useNativeBridge() hook registers measurement callbacks
  → ARKit runs continuously, detecting planes in background

User taps "I'm in position — Start" in web UI
  → React calls window.stairCodeNative.measure('rise')
  → WKScriptMessageHandler receives { command: 'measureRiser' }
  → StairMeasurementSession.measureRiserHeight() runs
  → LiDAR depth map sampled, result computed in <100ms
  → bridge.sendMeasurement(result) called
  → window.onNativeMeasurement({ key:'rise', estimatedMm:178, ... }) fires
  → useNativeBridge() updates lastMeasurement state
  → ScanReadyScreen shows 178mm in the AR overlay
  → User taps "Confirm & Next →"
```

---

### 8. App Store submission checklist

- [ ] Privacy policy URL set in App Store Connect (https://staircode.app/privacy)
- [ ] Screenshot set includes LiDAR measurement demo
- [ ] "AR Required" capability set to NO (runs on non-LiDAR iPhones via AI fallback)
- [ ] `NSCameraUsageDescription` in Info.plist
- [ ] TestFlight beta tested on at least one LiDAR device before release
- [ ] App Review notes: "AR features require iPhone 12 Pro or newer. Tap 'Start Scan' and point camera at a staircase to begin."

---

### 9. Capacitor alternative (faster path)

If you want to avoid a full native Xcode project, Capacitor is already in package.json.
Add these plugins to the existing Next.js project:

```bash
npm install @capacitor/camera @capacitor/device
npx cap add ios
npx cap sync ios
npx cap open ios
```

Then write a Capacitor plugin to bridge ARKit:
- `capacitor-arkit-plugin` (community, partial support)
- Or write a custom Swift plugin using CapacitorPlugin base class

The full native approach above gives access to the raw CVPixelBuffer depth data
which is required for ±0.5mm LiDAR accuracy. Capacitor plugins abstract this away
at the cost of measurement precision.
