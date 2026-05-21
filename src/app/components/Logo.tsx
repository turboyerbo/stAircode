'use client'
/**
 * Logo.tsx — stAIrcode brand components
 *
 * Uses 2025 brand assets:
 *   /staircode_logo.png      — horizontal logo (st[AI]rcode wordmark, 1047×341)
 *   /staircode_icon.png      — S lettermark icon (643×643)
 *   /staircode_header.jpg    — header/nav logo (835×159)
 *
 * Brand colours:
 *   Orange:    #F29337
 *   Dark Blue: #1B3A6B
 *
 * Slogan: "Next Step in Building Information"
 *   Shown by default on md/lg/xl sizes; hidden on xs/sm and NavLogo.
 *   Override with showSlogan={true|false}.
 */

import React from 'react'

interface LogoProps {
  size?:        'xs' | 'sm' | 'md' | 'lg' | 'xl'
  onDark?:      boolean
  iconOnly?:    boolean
  showSlogan?:  boolean   // default: true for md/lg/xl, false for xs/sm
  style?:       React.CSSProperties
  className?:   string
}

const H: Record<string, number> = { xs: 20, sm: 28, md: 40, lg: 56, xl: 72 }
const SLOGAN = 'Next Step in Building Information'

/** Inline slogan tag rendered below the logo image */
function Slogan({ logoHeight, onDark }: { logoHeight: number; onDark: boolean }) {
  const fs = Math.max(8, Math.round(logoHeight * 0.22))
  return (
    <div style={{
      fontSize:      fs,
      fontWeight:    500,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color:         onDark ? 'rgba(255,255,255,0.45)' : 'rgba(27,58,107,0.50)',
      marginTop:     Math.round(logoHeight * 0.1),
      lineHeight:    1,
      userSelect:    'none' as const,
      whiteSpace:    'nowrap' as const,
    }}>
      {SLOGAN}
    </div>
  )
}

// Full horizontal logo
export default function Logo({
  size = 'md',
  onDark: _onDark = false,
  iconOnly = false,
  showSlogan,
  style,
  className,
}: LogoProps) {
  const h = H[size]
  const defaultSlogan = size === 'md' || size === 'lg' || size === 'xl'
  const displaySlogan = showSlogan ?? defaultSlogan

  if (iconOnly) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/staircode_icon.png" alt="stAIrcode" width={h} height={h}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0, ...style }}
        className={className} />
    )
  }

  const w = Math.round(h * 3.07)
  if (!displaySlogan) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/staircode_logo.png" alt="stAIrcode" width={w} height={h}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0, ...style }}
        className={className} />
    )
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}
      className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/staircode_logo.png" alt="stAIrcode" width={w} height={h}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }} />
      <Slogan logoHeight={h} onDark={_onDark} />
    </div>
  )
}

// Nav/header logo — slogan off by default (tight navbars)
export function NavLogo({
  height = 32,
  showSlogan = false,
  style,
}: {
  height?:     number
  showSlogan?: boolean
  style?:      React.CSSProperties
}) {
  const w = Math.round(height * (835 / 159))
  if (!showSlogan) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/staircode_header.jpg" alt="stAIrcode" width={w} height={height}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0, ...style }} />
    )
  }
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/staircode_header.jpg" alt="stAIrcode" width={w} height={height}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }} />
      <Slogan logoHeight={height} onDark={false} />
    </div>
  )
}

// Icon-only S mark
export function IconLogo({ size = 32, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/staircode_icon.png" alt="stAIrcode" width={size} height={size}
      style={{ display: 'block', objectFit: 'contain', flexShrink: 0, borderRadius: size * 0.22, ...style }} />
  )
}

// BetaLogo — logo + BETA pill, slogan below both
export function BetaLogo({
  size = 'md',
  onDark = false,
  showSlogan,
  style,
}: {
  size?:       'xs' | 'sm' | 'md' | 'lg'
  onDark?:     boolean
  showSlogan?: boolean
  style?:      React.CSSProperties
}) {
  const h   = H[size]
  const ps  = Math.max(9, Math.round(h * 0.3))
  const defaultSlogan = size === 'md' || size === 'lg'
  const displaySlogan = showSlogan ?? defaultSlogan

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}>
      {/* Logo row + BETA pill */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(h * 0.2) }}>
        <Logo size={size} onDark={onDark} showSlogan={false} />
        <span style={{
          display:       'inline-flex',
          alignItems:    'center',
          background:    '#F29337',
          color:         '#fff',
          fontSize:      ps,
          fontWeight:    800,
          letterSpacing: '0.13em',
          padding:       `${Math.round(ps * 0.3)}px ${Math.round(ps * 0.65)}px`,
          borderRadius:  999,
          fontFamily:    'monospace',
          boxShadow:     '0 1px 6px rgba(242,147,55,0.45)',
          flexShrink:    0,
          lineHeight:    1,
        }}>BETA</span>
      </div>
      {/* Slogan beneath logo+pill row */}
      {displaySlogan && <Slogan logoHeight={h} onDark={onDark} />}
    </div>
  )
}
