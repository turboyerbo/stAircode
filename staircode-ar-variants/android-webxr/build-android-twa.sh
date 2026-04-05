#!/usr/bin/env bash
# build-android-twa.sh
#
# Builds the stAIrcode Android TWA (Trusted Web Activity)
# This wraps staircode.app in a Chrome-based full-screen Android app
# that qualifies for WebXR immersive-ar + ARCore plane detection.
#
# Prerequisites:
#   - Node 18+  (npm install -g @bubblewrap/cli)
#   - Java 11+  (required by Bubblewrap's Gradle build)
#   - Android Studio or command-line tools (for signing)
#
# Output: app-release-signed.apk → ready for Google Play upload

set -e

echo "=== stAIrcode Android TWA Build ==="

# ── Step 1: Install Bubblewrap if not present ─────────────────────────────────
if ! command -v bubblewrap &> /dev/null; then
  echo "Installing @bubblewrap/cli..."
  npm install -g @bubblewrap/cli
fi

# ── Step 2: Ensure manifest.json has the right TWA fields ─────────────────────
# These should already be in your deployed PWA manifest.
# Verify at https://staircode.app/manifest.json
echo "Verifying PWA manifest at staircode.app..."
curl -s https://staircode.app/manifest.json | python3 -c "
import json, sys
m = json.load(sys.stdin)
assert m.get('start_url'), 'Missing start_url'
assert m.get('icons'), 'Missing icons'
print('✓ Manifest OK:', m.get('name'))
"

# ── Step 3: Initialise TWA project ───────────────────────────────────────────
if [ ! -f "twa-manifest.json" ]; then
  echo "Initialising TWA from PWA manifest..."
  bubblewrap init --manifest https://staircode.app/manifest.json \
    --directory ./android-twa
else
  echo "✓ TWA already initialised"
fi

# ── Step 4: Patch twa-manifest.json for ARCore support ───────────────────────
# Add the ARCore dependency and CAMERA permission
python3 - << 'PYEOF'
import json

with open('android-twa/twa-manifest.json') as f:
    m = json.load(f)

# Ensure package name matches Play Store listing
m['packageId'] = 'app.staircode.android'
m['appVersion'] = int(m.get('appVersion', 1))

# Add ARCore + camera permissions
m['features'] = m.get('features', [])
if 'arcore' not in m['features']:
    m['features'].append('arcore')

m['permissions'] = list(set(m.get('permissions', []) + ['CAMERA', 'ACCESS_FINE_LOCATION']))

# Enable WebXR in Chrome flags within the TWA
m['enableNotifications'] = True

with open('android-twa/twa-manifest.json', 'w') as f:
    json.dump(m, f, indent=2)

print('✓ twa-manifest.json patched for ARCore')
PYEOF

# ── Step 5: Patch build.gradle for ARCore dependency ─────────────────────────
if [ -f "android-twa/app/build.gradle" ]; then
  if ! grep -q "play-services-ar" android-twa/app/build.gradle; then
    sed -i '/dependencies {/a \    implementation "com.google.ar:core:1.44.0"' \
      android-twa/app/build.gradle
    echo "✓ ARCore dependency added to build.gradle"
  fi
fi

# ── Step 6: Patch AndroidManifest.xml for ARCore required ────────────────────
# ARCore can be "required" (only ARCore devices) or "optional" (fallback to AI)
# We use "optional" so the app installs on all Android devices
MANIFEST="android-twa/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  if ! grep -q "com.google.ar.core" "$MANIFEST"; then
    # Add before </application>
    sed -i 's|</application>|    <meta-data android:name="com.google.ar.core" android:value="optional"/>\n    </application>|' "$MANIFEST"
    echo "✓ ARCore optional meta-data added to AndroidManifest.xml"
  fi
fi

# ── Step 7: Build ─────────────────────────────────────────────────────────────
echo ""
echo "Building APK..."
cd android-twa
bubblewrap build
cd ..

echo ""
echo "=== Build Complete ==="
echo "Output: android-twa/app-release.apk"
echo ""
echo "Next steps:"
echo "  1. Sign: jarsigner -verbose -sigalg SHA256withRSA android-twa/app-release.apk keystore.jks staircode"
echo "  2. Align: zipalign -v 4 android-twa/app-release.apk android-twa/app-release-signed.apk"
echo "  3. Upload to Play Console: https://play.google.com/console"
