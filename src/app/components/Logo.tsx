'use client'
/**
 * Logo.tsx — stAIrcode brand components
 *
 * Image assets (all in /public/):
 *   staircode_logo.png      — full horizontal wordmark (1047×341, JPEG)
 *   staircode_icon.png      — S lettermark (512×512, PNG)
 *   staircode_header.jpg    — wide nav header logo (835×159, JPEG)
 *   just_open_logo.png      — Just Open Technologies symbol (512×512, JPEG)
 *
 * Slogan: "Next Step in Building Information"
 *   Rendered in small Helvetica/Arial beneath the logo image.
 *   Shown by default on md/lg/xl Logo; hidden on xs/sm and NavLogo.
 *   Override with showSlogan={true|false}.
 */

import React from 'react'

// ── Slogan ─────────────────────────────────────────────────────────────────────
const SLOGAN = 'Next Step in Building Information'

function Slogan({ logoHeight, onDark }: { logoHeight: number; onDark: boolean }) {
  const fs = Math.max(7, Math.round(logoHeight * 0.18))
  return (
    <div
      style={{
        fontSize:      fs,
        fontFamily:    "Helvetica Neue, Helvetica, Arial, sans-serif",
        fontWeight:    400,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
        color:         onDark ? 'rgba(255,255,255,0.42)' : 'rgba(27,58,107,0.48)',
        marginTop:     Math.round(logoHeight * 0.08),
        lineHeight:    1,
        userSelect:    'none' as const,
        whiteSpace:    'nowrap' as const,
      }}
    >
      {SLOGAN}
    </div>
  )
}

// ── Logo props ────────────────────────────────────────────────────────────────
interface LogoProps {
  size?:       'xs' | 'sm' | 'md' | 'lg' | 'xl'
  onDark?:     boolean
  iconOnly?:   boolean   // renders staircode_icon.png (S lettermark)
  showSlogan?: boolean   // default true for md/lg/xl
  style?:      React.CSSProperties
  className?:  string
}

const H: Record<string, number> = { xs: 20, sm: 28, md: 40, lg: 56, xl: 72 }

// ── Logo — full horizontal wordmark (staircode_logo.png) ──────────────────────
export default function Logo({
  size = 'md',
  onDark = false,
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
      <img
        src="/staircode_icon.png"
        alt="stAIrcode"
        width={h} height={h}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0, ...style }}
        className={className}
      />
    )
  }

  const w = Math.round(h * 3.07)  // 1047/341 ≈ 3.07

  if (!displaySlogan) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/staircode_logo.png"
        alt="stAIrcode"
        width={w} height={h}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0, ...style }}
        className={className}
      />
    )
  }

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}
      className={className}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/staircode_logo.png"
        alt="stAIrcode"
        width={w} height={h}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
      />
      <Slogan logoHeight={h} onDark={onDark} />
    </div>
  )
}

// ── NavLogo — staircode_header.jpg (835×159, wide nav strip) ─────────────────
export function NavLogo({
  height = 32,
  showSlogan = false,
  onDark = false,
  style,
}: {
  height?:     number
  showSlogan?: boolean
  onDark?:     boolean
  style?:      React.CSSProperties
}) {
  const w = Math.round(height * (835 / 159))  // native aspect ratio

  if (!showSlogan) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/staircode_header.jpg"
        alt="stAIrcode"
        width={w} height={height}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0, ...style }}
      />
    )
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/staircode_header.jpg"
        alt="stAIrcode"
        width={w} height={height}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
      />
      <Slogan logoHeight={height} onDark={onDark} />
    </div>
  )
}

// ── IconLogo — staircode_icon.png (S lettermark, 512×512) ────────────────────
export function IconLogo({
  size = 32,
  style,
}: {
  size?:  number
  style?: React.CSSProperties
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/staircode_icon.png"
      alt="stAIrcode"
      width={size} height={size}
      style={{
        display: 'block', objectFit: 'contain', flexShrink: 0,
        borderRadius: size * 0.22,
        ...style,
      }}
    />
  )
}

// ── JustOpenLogo — just_open_logo.png (Just Open Technologies symbol) ─────────
export function JustOpenLogo({
  size = 32,
  style,
}: {
  size?:  number
  style?: React.CSSProperties
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/just_open_logo.png"
      alt="Just Open Technologies"
      width={size} height={size}
      style={{ display: 'block', objectFit: 'contain', flexShrink: 0, ...style }}
    />
  )
}

// ── BetaLogo — full wordmark + BETA pill ─────────────────────────────────────
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
  const h  = H[size]
  const ps = Math.max(9, Math.round(h * 0.3))
  const w  = Math.round(h * 3.07)
  const defaultSlogan = size === 'md' || size === 'lg'
  const displaySlogan = showSlogan ?? defaultSlogan

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}
    >
      {/* Logo image + BETA pill on same row */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(h * 0.2) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/staircode_logo.png"
          alt="stAIrcode"
          width={w} height={h}
          style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
        />
        <span
          style={{
            display:       'inline-flex',
            alignItems:    'center',
            background:    '#F29337',
            color:         '#fff',
            fontSize:      ps,
            fontWeight:    800,
            letterSpacing: '0.13em',
            padding:       `${Math.round(ps * 0.3)}px ${Math.round(ps * 0.65)}px`,
            borderRadius:  999,
            boxShadow:     '0 1px 6px rgba(242,147,55,0.45)',
            flexShrink:    0,
            lineHeight:    1,
          }}
        >
          BETA
        </span>
      </div>
      {displaySlogan && <Slogan logoHeight={h} onDark={onDark} />}
    </div>
  )
}
