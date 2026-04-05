/**
 * useNativeBridge.ts
 *
 * React hook that connects the web layer (staircode.app) to native AR
 * measurement results from either:
 *   - iOS WKWebView bridge (window.stairCodeNative + window.onNativeMeasurement)
 *   - Android TWA WebXR (via arcore-session.ts)
 *
 * Usage in ScanReadyScreen:
 *
 *   const { isNative, hasLiDAR, triggerNativeMeasure, lastNativeMeasurement } = useNativeBridge()
 *
 *   // When isNative === true, call triggerNativeMeasure('riser') instead of callVision()
 *   // lastNativeMeasurement updates automatically when Swift/ARCore sends data
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export interface NativeMeasurement {
  key:         string    // 'rise' | 'run' | 'width' | 'guard' | 'headroom'
  estimatedMm: number
  confidence:  number
  method:      string    // 'lidar-depth' | 'arkit-plane' | 'arcore-plane'
  message:     string
}

export interface NativeARInfo {
  hasLiDAR:   boolean
  platform:   'ios' | 'android' | null
}

export interface NativeBridgeState {
  isNative:             boolean          // running inside native iOS or Android TWA
  hasLiDAR:             boolean          // iPhone Pro with LiDAR available
  arReady:              boolean          // AR session started and planes detected
  platform:             'ios' | 'android' | 'web'
  lastMeasurement:      NativeMeasurement | null
  planeCount:           number           // how many planes ARKit/ARCore has detected
  triggerMeasure:       (type: string) => void
}

declare global {
  interface Window {
    stairCodeNative?:    { isNative: boolean; platform: string; measure: (t: string) => void; startAR: () => void }
    onNativeMeasurement?: (payload: NativeMeasurement) => void
    onNativeARReady?:     (info: NativeARInfo) => void
    onNativePlaneDetected?: (info: { type: string; widthMm: number; heightMm: number }) => void
  }
}

export function useNativeBridge(): NativeBridgeState {
  const [isNative,        setIsNative]        = useState(false)
  const [hasLiDAR,        setHasLiDAR]        = useState(false)
  const [arReady,         setArReady]         = useState(false)
  const [platform,        setPlatform]        = useState<'ios'|'android'|'web'>('web')
  const [lastMeasurement, setLastMeasurement] = useState<NativeMeasurement | null>(null)
  const [planeCount,      setPlaneCount]      = useState(0)

  // ARCore (Android TWA) session ref
  const arcoreRef = useRef<typeof import('./arcore-session') | null>(null)

  useEffect(() => {
    // ── Detect iOS native bridge ───────────────────────────────────────────
    if (window.stairCodeNative?.isNative) {
      setIsNative(true)
      setPlatform('ios')

      // Register callback — Swift will call this when measurement is ready
      window.onNativeMeasurement = (payload: NativeMeasurement) => {
        setLastMeasurement(payload)
      }

      window.onNativeARReady = (info: NativeARInfo) => {
        setHasLiDAR(info.hasLiDAR)
        setArReady(true)
      }

      window.onNativePlaneDetected = (_info) => {
        setPlaneCount(c => c + 1)
      }

      return
    }

    // ── Detect Android TWA / WebXR ────────────────────────────────────────
    const checkWebXR = async () => {
      if (!navigator.xr) return

      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar')
        if (!supported) return

        // Dynamically import arcore-session only when WebXR is available
        const arcore = await import('./arcore-session')
        arcoreRef.current = arcore

        const isTWA = arcore.isTWA()
        setIsNative(isTWA)
        setPlatform('android')
        setArReady(true)
      } catch {}
    }

    checkWebXR()

    return () => {
      // Clean up callbacks
      window.onNativeMeasurement  = undefined
      window.onNativeARReady      = undefined
      window.onNativePlaneDetected = undefined
    }
  }, [])

  const triggerMeasure = useCallback((type: string) => {
    // iOS: call through WKWebView bridge
    if (window.stairCodeNative?.isNative) {
      window.stairCodeNative.measure(type)
      return
    }

    // Android: call through ARCore session
    if (arcoreRef.current) {
      const arcore  = arcoreRef.current
      const modeMap: Record<string, () => Promise<import('./arcore-session').ARMeasurement | null>> = {
        rise:     () => arcore.measureWithARCore('riser',    {}),
        run:      () => arcore.measureWithARCore('tread',    {}),
        width:    () => arcore.measureWithARCore('width',    {}),
        guard:    () => arcore.measureWithARCore('handrail', {}),
        headroom: () => arcore.measureWithARCore('headroom', {}),
      }

      const fn = modeMap[type]
      if (fn) {
        fn().then(result => {
          if (result) {
            setLastMeasurement({
              key:         type,
              estimatedMm: result.estimatedMm,
              confidence:  result.confidence,
              method:      result.method,
              message:     result.message,
            })
          }
        })
      }
    }
  }, [])

  return {
    isNative,
    hasLiDAR,
    arReady,
    platform,
    lastMeasurement,
    planeCount,
    triggerMeasure,
  }
}
