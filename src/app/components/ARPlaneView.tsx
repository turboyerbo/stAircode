'use client'
/**
 * ARPlaneView.tsx — ARAI_10
 *
 * Renders detected XRPlane outlines onto a <canvas> overlay
 * positioned over the live camera feed. Used inside ARSession
 * to give visual feedback that planes are being tracked.
 *
 * The canvas is sized to match the video element via ResizeObserver.
 * Each plane's polygon is projected from plane-local space to screen
 * using the XRFrame's view/pose — or approximated from the polygon
 * bounding box if projection is unavailable.
 */

import { useEffect, useRef } from 'react'
import React from 'react'
import { polygonToMm } from '@/lib/xr-measure'

interface PlaneInfo {
  id:          number
  orientation: 'horizontal' | 'vertical'
  polygon:     DOMPointReadOnly[]
  isTarget:    boolean
}

interface Props {
  planes:     PlaneInfo[]
  stepColor:  string
  videoRef:   React.RefObject<HTMLVideoElement>
}

export default function ARPlaneView({ planes, stepColor, videoRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    let animId = 0
    let t = 0

    const resize = () => {
      canvas.width  = video.offsetWidth
      canvas.height = video.offsetHeight
    }

    const ro = new ResizeObserver(resize)
    ro.observe(video)
    resize()

    const draw = () => {
      t += 0.03
      const W = canvas.width
      const H = canvas.height
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, W, H)

      planes.forEach((plane) => {
        if (plane.polygon.length < 3) return

        const { w, h } = polygonToMm(plane.polygon)
        const larger  = Math.max(w, h)
        const smaller = Math.min(w, h)

        // Map plane bounding box to canvas rectangle (approximate visualisation)
        // Centre the rectangle in the bottom-half of the frame where stairs typically appear
        const scaleX  = W / 3000   // 3000mm ≈ full field width
        const scaleY  = H / 2500
        const rectW   = Math.min(larger * scaleX, W * 0.8)
        const rectH   = Math.min(smaller * scaleY, H * 0.35)
        const rx      = (W - rectW) / 2
        const ry      = H * 0.45

        const color     = plane.isTarget ? stepColor : 'rgba(255,255,255,0.2)'
        const pulse     = (Math.sin(t * 3) + 1) / 2
        const alpha     = plane.isTarget ? 0.6 + pulse * 0.3 : 0.18

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.strokeStyle = color
        ctx.lineWidth   = plane.isTarget ? 2 : 1
        ctx.shadowColor = color
        ctx.shadowBlur  = plane.isTarget ? 12 : 0
        ctx.setLineDash(plane.isTarget ? [] : [6, 4])
        ctx.strokeRect(rx, ry, rectW, rectH)
        ctx.setLineDash([])

        // Corner accent marks for target plane
        if (plane.isTarget) {
          const mark = 14
          ctx.shadowBlur = 18
          ;[[rx, ry], [rx + rectW, ry], [rx, ry + rectH], [rx + rectW, ry + rectH]].forEach(([cx, cy]) => {
            ctx.beginPath()
            ctx.arc(cx, cy, 4.5, 0, Math.PI * 2)
            ctx.fillStyle = color
            ctx.fill()
          })
          // Label
          ctx.shadowBlur = 0
          ctx.fillStyle  = color
          ctx.globalAlpha = 0.85
          ctx.font        = '600 11px monospace'
          ctx.textAlign   = 'left'
          ctx.fillText(`${larger}×${smaller}mm`, rx + 6, ry - 6)
        }

        ctx.restore()
      })

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [planes, stepColor, videoRef])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 12,
      }}
    />
  )
}
