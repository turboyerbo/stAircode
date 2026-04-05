// MeasurementBridge.swift
// Passes native LiDAR/ARKit measurements to the WKWebView (staircode.app web layer)
//
// Architecture:
//   Native Swift (LiDAR) → WKScriptMessageHandler → JavaScript → React state
//   JavaScript → WKWebView.evaluateJavaScript → Swift handler → ARKit action

import WebKit
import Foundation

// MARK: - Bridge Message Types (Swift → JS)

struct NativeMeasurementMessage: Codable {
    let type:    String          // "measurement" | "plane_detected" | "ar_ready" | "ar_error"
    let payload: MeasurementPayload?
}

struct MeasurementPayload: Codable {
    let key:        String       // "rise" | "run" | "width" | "guard" | "headroom"
    let estimatedMm: Int
    let confidence: Double
    let method:     String       // "lidar-depth" | "arkit-plane"
    let message:    String
}

// MARK: - JS → Swift Command Handler

class NativeCommandHandler: NSObject, WKScriptMessageHandler {

    private let session: StairMeasurementSession

    init(session: StairMeasurementSession) {
        self.session = session
    }

    /// Called when JavaScript calls window.webkit.messageHandlers.native.postMessage(...)
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let cmd  = body["command"] as? String else { return }

        DispatchQueue.main.async {
            switch cmd {
            case "measureRiser":    self.session.measureRiserHeight()
            case "measureTread":    self.session.measureTreadDepth()
            case "measureWidth":    self.session.measureStairWidth()
            case "measureHandrail": self.session.measureHandrailHeight()
            case "startAR":         break  // session already running
            case "stopAR":          self.session.stopSession()
            default:
                print("[Bridge] Unknown command: \(cmd)")
            }
        }
    }
}

// MARK: - Swift → JS Bridge

class MeasurementBridge {

    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
    }

    /// Send a measurement result to the JavaScript layer
    func sendMeasurement(_ measurement: StairMeasurement) {
        let payload = MeasurementPayload(
            key:         measurement.type.rawValue,
            estimatedMm: measurement.estimatedMm,
            confidence:  measurement.confidence,
            method:      measurement.method,
            message:     measurement.message
        )

        guard let json = try? JSONEncoder().encode(payload),
              let str  = String(data: json, encoding: .utf8) else { return }

        let js = """
            if (window.onNativeMeasurement) {
                window.onNativeMeasurement(\(str));
            }
        """
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(js) { _, err in
                if let err { print("[Bridge] JS error: \(err)") }
            }
        }
    }

    /// Notify JS that ARKit/LiDAR is ready
    func sendARReady(hasLiDAR: Bool) {
        let js = """
            if (window.onNativeARReady) {
                window.onNativeARReady({ hasLiDAR: \(hasLiDAR ? "true" : "false"), platform: "ios" });
            }
        """
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    /// Notify JS that a plane was detected (triggers visual feedback in UI)
    func sendPlaneDetected(type: String, extentMm: (width: Int, height: Int)) {
        let js = """
            if (window.onNativePlaneDetected) {
                window.onNativePlaneDetected({
                    type: "\(type)",
                    widthMm: \(extentMm.width),
                    heightMm: \(extentMm.height)
                });
            }
        """
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

// MARK: - WKWebView Setup Helper

extension WKWebViewConfiguration {
    /// Configure WKWebView for stAIrcode native bridge
    static func stairCodeConfig(commandHandler: NativeCommandHandler) -> WKWebViewConfiguration {
        let config    = WKWebViewConfiguration()
        let userCtrl  = config.userContentController

        // Register Swift handler — JS calls this via:
        //   window.webkit.messageHandlers.native.postMessage({ command: "measureRiser" })
        userCtrl.add(commandHandler, name: "native")

        // Inject bridge JS on every page load
        let bridgeScript = WKUserScript(
            source: bridgeJavaScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        userCtrl.addUserScript(bridgeScript)

        // Allow camera access in WKWebView
        config.allowsInlineMediaPlayback    = true
        config.mediaTypesRequiringUserActionForPlayback = []

        return config
    }
}

// MARK: - Injected JavaScript (runs in web layer)

private let bridgeJavaScript = """
// stAIrcode native bridge — injected by iOS WKWebView
// Allows web React code to call native Swift functions

window.stairCodeNative = {
    isNative: true,
    platform: 'ios',

    // Call from React: window.stairCodeNative.measure('riser')
    measure: function(type) {
        const commands = {
            rise:     'measureRiser',
            run:      'measureTread',
            width:    'measureWidth',
            guard:    'measureHandrail',
            headroom: 'measureHeadroom',
        };
        const cmd = commands[type];
        if (cmd && window.webkit) {
            window.webkit.messageHandlers.native.postMessage({ command: cmd });
        }
    },

    startAR: function() {
        if (window.webkit) {
            window.webkit.messageHandlers.native.postMessage({ command: 'startAR' });
        }
    },

    stopAR: function() {
        if (window.webkit) {
            window.webkit.messageHandlers.native.postMessage({ command: 'stopAR' });
        }
    }
};

// Callbacks — set by React code:
// window.onNativeMeasurement = (payload) => { ... }
// window.onNativeARReady     = (info)    => { ... }
// window.onNativePlaneDetected = (info)  => { ... }

console.log('[stAIrcode] Native bridge injected. Platform: iOS');
"""
