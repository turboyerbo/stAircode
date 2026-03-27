import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor config — iOS build of Staircode
 *
 * For static export builds (iOS App Store):
 *   1. Uncomment `output: 'export'` in next.config.js (iOS-only build)
 *   2. Run: npm run build && npx cap sync ios && npx cap open ios
 *
 * For server-mode (loads live URL — same as Android TWA):
 *   Uncomment the `server.url` field below.
 */
const config: CapacitorConfig = {
  appId:   'app.staircode.ios',
  appName: 'Staircode',
  webDir:  'out',               // Next.js static export output dir

  ios: {
    contentInset:      'always',   // respect notch / Dynamic Island safe areas
    backgroundColor:   '#EEF3F9',
    allowsLinkPreview: false,
    scrollEnabled:     false,      // app handles its own scroll
  },

  server: {
    // Uncomment to load from deployed URL (requires network, but supports WebXR via Safari engine):
    url: 'https://staircode.app',
    cleartext: false,
    iosScheme: 'staircode',
    androidScheme: 'https',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration:  300,
      backgroundColor:     '#EEF3F9',
      showSpinner:         false,
      launchAutoHide:      true,
    },
    Camera: {
      // Permissions string is set in ios/App/App/Info.plist
    },
  },
}

export default config
