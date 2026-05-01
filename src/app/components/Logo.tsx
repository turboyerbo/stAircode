'use client'
/**
 * Logo.tsx — stAIrcode brand components
 *
 * Uses new 2025 brand assets:
 *   /staircode_logo.png      — horizontal logo (st[AI]rcode wordmark, 1047×341)
 *   /staircode_icon.png      — S lettermark icon (643×643)
 *   /staircode_header.png    — header/nav logo (835×159)
 *
 * Brand colours:
 *   Orange:    #F29337
 *   Dark Blue: #1B3A6B
 */

import React from 'react'

interface LogoProps {
  size?:      'xs' | 'sm' | 'md' | 'lg' | 'xl'
  onDark?:    boolean
  iconOnly?:  boolean
  style?:     React.CSSProperties
  className?: string
}

const H: Record<string, number> = { xs: 20, sm: 28, md: 40, lg: 56, xl: 72 }

// Full horizontal logo
export default function Logo({ size = 'md', onDark: _onDark = false, iconOnly = false, style, className }: LogoProps) {
  const h = H[size]
  if (iconOnly) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/staircode_icon.png" alt="stAIrcode" width={h} height={h}
        style={{ display:'block', objectFit:'contain', flexShrink:0, ...style }}
        className={className} />
    )
  }
  const w = Math.round(h * 3.07)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/staircode_logo.png" alt="stAIrcode" width={w} height={h}
      style={{ display:'block', objectFit:'contain', flexShrink:0, ...style }}
      className={className} />
  )
}

// Nav/header logo
export function NavLogo({ height = 32, style }: { height?: number; style?: React.CSSProperties }) {
  const w = Math.round(height * (835 / 159))
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/staircode_header.png" alt="stAIrcode" width={w} height={height}
      style={{ display:'block', objectFit:'contain', flexShrink:0, ...style }} />
  )
}

// Icon-only S mark
export function IconLogo({ size = 32, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/staircode_icon.png" alt="stAIrcode" width={size} height={size}
      style={{ display:'block', objectFit:'contain', flexShrink:0, borderRadius: size * 0.22, ...style }} />
  )
}

// BetaLogo — logo + BETA pill
export function BetaLogo({ size = 'md', onDark = false, style }: { size?: 'xs'|'sm'|'md'|'lg'; onDark?: boolean; style?: React.CSSProperties }) {
  const h = H[size]
  const ps = Math.max(9, Math.round(h * 0.3))
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap: Math.round(h * 0.2), ...style }}>
      <Logo size={size} onDark={onDark} />
      <span style={{
        display:'inline-flex', alignItems:'center',
        background:'#F29337', color:'#fff',
        fontSize: ps, fontWeight:800, letterSpacing:'0.13em',
        padding:`${Math.round(ps*0.3)}px ${Math.round(ps*0.65)}px`,
        borderRadius:999, fontFamily:'monospace',
        boxShadow:'0 1px 6px rgba(242,147,55,0.45)',
        flexShrink:0, lineHeight:1,
      }}>BETA</span>
    </div>
  )
}
