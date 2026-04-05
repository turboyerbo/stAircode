// StairMeasurement.swift
// stAIrcode iOS — LiDAR + ARKit measurement engine
//
// Requirements: iPhone 12 Pro / 13/14/15/16 Pro / iPad Pro 2020+
// Framework: ARKit + RealityKit + CoreMotion
//
// Measurement method:
//   1. ARKit detects floor/wall planes via ARPlaneAnchor
//   2. LiDAR sceneDepth provides per-pixel depth at 256×192 resolution
//   3. Depth is sampled at key screen points to measure stair geometry
//   4. Results are bridge-passed to WKWebView (web layer handles UI/report)

import ARKit
import RealityKit
import CoreMotion
import UIKit

// MARK: - Measurement Results

struct StairMeasurement: Codable {
    let type:        MeasurementType
    let estimatedMm: Int
    let confidence:  Double     // 0.0–1.0
    let method:      String     // "lidar-depth" | "arkit-plane" | "hybrid"
    let message:     String
}

enum MeasurementType: String, Codable {
    case riserHeight   = "rise"
    case treadDepth    = "run"
    case stairWidth    = "width"
    case handrailHeight = "guard"
    case headroom      = "headroom"
    case nosing        = "nosing"
}

// MARK: - ARCore Measurement Session

class StairMeasurementSession: NSObject, ARSessionDelegate {

    // MARK: Properties
    private var arSession:     ARSession?
    private var arView:        ARView?
    private var detectedPlanes: [UUID: ARPlaneAnchor] = [:]
    private var latestDepthMap: CVPixelBuffer?
    private var latestCamera:   ARCamera?

    var onMeasurement: ((StairMeasurement) -> Void)?
    var onPlaneDetected: ((ARPlaneAnchor) -> Void)?
    var onError: ((String) -> Void)?

    // MARK: Session Control

    func startSession(in view: ARView) {
        self.arView = view

        let config = ARWorldTrackingConfiguration()

        // Enable LiDAR scene reconstruction if available
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            config.sceneReconstruction = .meshWithClassification
        }

        // Enable LiDAR depth
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            config.frameSemantics.insert(.sceneDepth)
        }

        // Plane detection — horizontal (treads) and vertical (risers)
        config.planeDetection = [.horizontal, .vertical]

        // Highest quality mode
        config.videoHDRAllowed  = true
        config.isAutoFocusEnabled = true

        arSession = view.session
        view.session.delegate = self
        view.session.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    func stopSession() {
        arView?.session.pause()
        detectedPlanes.removeAll()
        latestDepthMap = nil
    }

    // MARK: ARSessionDelegate

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        latestDepthMap = frame.sceneDepth?.depthMap
        latestCamera   = frame.camera
    }

    func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
        for anchor in anchors.compactMap({ $0 as? ARPlaneAnchor }) {
            detectedPlanes[anchor.identifier] = anchor
            onPlaneDetected?(anchor)
        }
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        for anchor in anchors.compactMap({ $0 as? ARPlaneAnchor }) {
            detectedPlanes[anchor.identifier] = anchor
        }
    }

    func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
        for anchor in anchors {
            detectedPlanes.removeValue(forKey: anchor.identifier)
        }
    }

    // MARK: Measurement Methods

    /// Measure riser height using LiDAR depth sampling
    /// Phone is placed on tread nosing pointing at the riser face
    func measureRiserHeight() {
        guard let depthMap = latestDepthMap,
              let camera   = latestCamera else {
            onError?("Waiting for LiDAR depth data — hold the phone still")
            return
        }

        // Sample depth at vertical strip in centre of frame
        // Riser face should fill the centre column
        let measurements = sampleVerticalStrip(depthMap: depthMap, camera: camera, x: 0.5)

        // Find the transition point where depth changes (nosing to riser)
        guard let riserMm = findRiserHeight(samples: measurements) else {
            onError?("Cannot detect riser edge — centre the riser in frame")
            return
        }

        let inRange = riserMm >= 125 && riserMm <= 220
        let result  = StairMeasurement(
            type:        .riserHeight,
            estimatedMm: riserMm,
            confidence:  inRange ? 0.95 : 0.72,
            method:      "lidar-depth",
            message:     "LiDAR: riser height \(riserMm)mm\(inRange ? " ✓" : " — check framing")"
        )
        onMeasurement?(result)
    }

    /// Measure tread depth using LiDAR depth sampling
    /// Phone held horizontally above the tread, camera facing down
    func measureTreadDepth() {
        guard let depthMap = latestDepthMap else {
            onError?("Waiting for LiDAR depth data")
            return
        }

        // Sample horizontal strip through centre of depth map
        // Depth variation along the strip shows nosing-to-riser distance
        let samples = sampleHorizontalStrip(depthMap: depthMap, y: 0.5)

        // The tread surface is at a consistent depth; riser is at a greater depth
        guard let depthMm = findTreadDepth(samples: samples) else {
            onError?("Point camera directly down at the tread surface")
            return
        }

        let result = StairMeasurement(
            type:        .treadDepth,
            estimatedMm: depthMm,
            confidence:  depthMm >= 220 && depthMm <= 420 ? 0.95 : 0.75,
            method:      "lidar-depth",
            message:     "LiDAR: tread depth \(depthMm)mm"
        )
        onMeasurement?(result)
    }

    /// Measure stair width using detected vertical planes
    func measureStairWidth() {
        let verticals = detectedPlanes.values.filter { $0.alignment == .vertical }
        guard verticals.count >= 2 else {
            onError?("Move back until both sides of the stair are visible")
            return
        }

        // Find leftmost and rightmost vertical planes
        let sorted    = verticals.sorted { $0.center.x < $1.center.x }
        let leftWorld  = simd_float4(sorted.first!.center, 1)
        let rightWorld = simd_float4(sorted.last!.center, 1)
        let widthM    = abs(rightWorld.x - leftWorld.x)
        let widthMm   = Int(widthM * 1000)

        let result = StairMeasurement(
            type:        .stairWidth,
            estimatedMm: widthMm,
            confidence:  widthMm >= 700 && widthMm <= 1500 ? 0.90 : 0.65,
            method:      "arkit-plane",
            message:     "ARKit: stair width \(widthMm)mm"
        )
        onMeasurement?(result)
    }

    /// Measure handrail height using plane pair
    func measureHandrailHeight() {
        let horizontals = detectedPlanes.values.filter { $0.alignment == .horizontal }
        guard horizontals.count >= 2 else {
            onError?("Step back so tread and handrail top are both visible")
            return
        }

        let sorted    = horizontals.sorted { $0.center.y < $1.center.y }
        let treadY    = sorted.first!.center.y
        let railY     = sorted.last!.center.y
        let heightMm  = Int(abs(railY - treadY) * 1000)

        let result = StairMeasurement(
            type:        .handrailHeight,
            estimatedMm: heightMm,
            confidence:  heightMm >= 865 && heightMm <= 1070 ? 0.92 : 0.68,
            method:      "arkit-plane",
            message:     "ARKit: handrail \(heightMm)mm"
        )
        onMeasurement?(result)
    }

    // MARK: LiDAR Depth Sampling Helpers

    private func sampleVerticalStrip(
        depthMap: CVPixelBuffer, camera: ARCamera, x: Float
    ) -> [Float] {
        CVPixelBufferLockBaseAddress(depthMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depthMap, .readOnly) }

        let width  = CVPixelBufferGetWidth(depthMap)
        let height = CVPixelBufferGetHeight(depthMap)
        let base   = CVPixelBufferGetBaseAddress(depthMap)!
        let floats = base.bindMemory(to: Float32.self, capacity: width * height)

        let colIdx = Int(x * Float(width))
        var samples = [Float]()
        for row in 0..<height {
            samples.append(floats[row * width + colIdx])
        }
        return samples
    }

    private func sampleHorizontalStrip(depthMap: CVPixelBuffer, y: Float) -> [Float] {
        CVPixelBufferLockBaseAddress(depthMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depthMap, .readOnly) }

        let width  = CVPixelBufferGetWidth(depthMap)
        let height = CVPixelBufferGetHeight(depthMap)
        let base   = CVPixelBufferGetBaseAddress(depthMap)!
        let floats = base.bindMemory(to: Float32.self, capacity: width * height)

        let rowIdx = Int(y * Float(height))
        return (0..<width).map { floats[rowIdx * width + $0] }
    }

    private func findRiserHeight(samples: [Float]) -> Int? {
        // Find the largest step-change in depth values
        // This corresponds to the nosing-to-riser transition
        var maxDelta: Float = 0
        var riserDepth: Float = 0
        var treadDepth: Float = 0

        for i in 1..<samples.count {
            let delta = abs(samples[i] - samples[i - 1])
            if delta > maxDelta && delta > 0.05 {  // >50mm depth change
                maxDelta   = delta
                treadDepth = min(samples[i], samples[i - 1])
                riserDepth = max(samples[i], samples[i - 1])
            }
        }

        guard maxDelta > 0.05 else { return nil }

        // Height in metres converted to mm
        let heightM = riserDepth - treadDepth
        return Int(heightM * 1000)
    }

    private func findTreadDepth(samples: [Float]) -> Int? {
        // Tread surface is at consistent depth; back riser is further away
        let validSamples = samples.filter { $0 > 0.1 && $0 < 3.0 }
        guard validSamples.count > 10 else { return nil }

        let minDepth = validSamples.min()!
        let maxDepth = validSamples.max()!
        let range    = maxDepth - minDepth

        guard range > 0.15 else { return nil }  // need at least 150mm variation

        // Tread depth ≈ range of depth variation projected onto horizontal plane
        return Int(range * 1000)
    }
}
