// ViewController.swift
// stAIrcode iOS — Main AR view controller
//
// Wires together:
//   - ARView (camera + LiDAR rendering)
//   - StairMeasurementSession (measurement engine)
//   - WKWebView (staircode.app web layer)
//   - MeasurementBridge (Swift ↔ JavaScript)

import UIKit
import ARKit
import RealityKit
import WebKit

class ViewController: UIViewController {

    // MARK: Properties
    private var arView:       ARView!
    private var webView:      WKWebView!
    private var session:      StairMeasurementSession!
    private var bridge:       MeasurementBridge!

    // MARK: Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        setupARView()
        setupSession()
        setupWebView()
        setupBridge()
        startEverything()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        session.stopSession()
    }

    // MARK: Setup

    private func setupARView() {
        arView = ARView(frame: view.bounds)
        arView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        // Transparent so WKWebView shows on top
        arView.backgroundColor = .black
        arView.environment.background = .color(.black)

        view.addSubview(arView)

        // Show AR coaching overlay while planes are being detected
        let coachingOverlay           = ARCoachingOverlayView()
        coachingOverlay.session       = arView.session
        coachingOverlay.goal          = .horizontalPlane
        coachingOverlay.activatesAutomatically = true
        coachingOverlay.frame         = arView.bounds
        coachingOverlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        arView.addSubview(coachingOverlay)
    }

    private func setupSession() {
        session = StairMeasurementSession()

        session.onMeasurement = { [weak self] measurement in
            self?.bridge.sendMeasurement(measurement)
        }

        session.onPlaneDetected = { [weak self] anchor in
            let extentMm = (
                width:  Int(anchor.planeExtent.width  * 1000),
                height: Int(anchor.planeExtent.height * 1000)
            )
            let type = anchor.alignment == .horizontal ? "horizontal" : "vertical"
            self?.bridge.sendPlaneDetected(type: type, extentMm: extentMm)
        }
    }

    private func setupWebView() {
        let handler = NativeCommandHandler(session: session)
        let config  = WKWebViewConfiguration.stairCodeConfig(commandHandler: handler)

        // WKWebView takes the full screen — AR camera shows through transparent areas
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask      = [.flexibleWidth, .flexibleHeight]
        webView.isOpaque              = false
        webView.backgroundColor       = .clear
        webView.scrollView.isScrollEnabled = false
        webView.navigationDelegate    = self

        view.addSubview(webView)
    }

    private func setupBridge() {
        bridge = MeasurementBridge(webView: webView)
    }

    private func startEverything() {
        // Start AR session
        session.startSession(in: arView)

        // Load web app
        let url = URL(string: "https://staircode.app")!
        webView.load(URLRequest(url: url))
    }
}

// MARK: - WKNavigationDelegate

extension ViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Notify web layer that native AR is available
        let hasLiDAR = ARWorldTrackingConfiguration
            .supportsFrameSemantics(.sceneDepth)
        bridge.sendARReady(hasLiDAR: hasLiDAR)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        // Allow all navigation within staircode.app
        // Open external links (Stripe, Calendly) in Safari
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow); return
        }
        if url.host?.contains("staircode.app") == true {
            decisionHandler(.allow)
        } else if navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }
}
