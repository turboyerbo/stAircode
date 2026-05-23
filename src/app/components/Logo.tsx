'use client'
/**
 * Logo.tsx — stAIrcode typographic brand components (v2 — text-only)
 *
 * No image files. The wordmark is rendered in pure CSS/HTML using
 * system + web fonts:
 *   - "st"    dark navy  #1B3A6B
 *   - "AI"    orange     #F29337
 *   - "rcode" dark navy  #1B3A6B
 *
 * Font stack: Syne (display weight) → system-ui → sans-serif
 * Syne is loaded via Google Fonts in layout.tsx (already present as a link).
 *
 * Slogan "Next Step in Building Information" appears below in small caps.
 *
 * Variants:
 *   Logo        — full wordmark, showSlogan defaults true for md/lg/xl
 *   NavLogo     — compact header variant, showSlogan defaults false
 *   BetaLogo    — wordmark + BETA pill, showSlogan defaults true for md/lg
 *   IconLogo    — S lettermark SVG
 */

import React from 'react'

const NAVY   = '#1B3A6B'
const ORANGE = '#F29337'
const SLOGAN = 'Next Step in Building Information'

// Font sizes by t-shirt size (px)
const FONT_PX: Record<string, number> = { xs: 16, sm: 22, md: 32, lg: 46, xl: 58 }

// Shared font stack — Syne loaded via <link> in layout.tsx
const FONT = "'Syne', 'DM Sans', system-ui, -apple-system, sans-serif"

interface WordmarkProps {
  fontSize:  number
  onDark?:   boolean
  style?:    React.CSSProperties
}

/** The "stAIrcode" wordmark as styled spans */
function Wordmark({ fontSize, onDark, style }: WordmarkProps) {
  const navyCol = onDark ? '#E8F4FF' : NAVY
  return (
    <span
      aria-label="stAIrcode"
      style={{
        fontFamily:    FONT,
        fontSize:      fontSize,
        fontWeight:    800,
        letterSpacing: '-0.02em',
        lineHeight:    1,
        userSelect:    'none',
        whiteSpace:    'nowrap',
        ...style,
      }}
    >
      <span style={{ color: navyCol }}>st</span>
      <span style={{ color: ORANGE, fontStyle: 'italic' }}>AI</span>
      <span style={{ color: navyCol }}>rcode</span>
    </span>
  )
}

/** Slogan line below the wordmark */
function Slogan({ fontSize, onDark }: { fontSize: number; onDark?: boolean }) {
  return (
    <div
      style={{
        fontFamily:    FONT,
        fontSize:      Math.max(7, Math.round(fontSize * 0.22)),
        fontWeight:    500,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color:         onDark ? 'rgba(255,255,255,0.40)' : 'rgba(27,58,107,0.45)',
        marginTop:     Math.round(fontSize * 0.12),
        lineHeight:    1,
        userSelect:    'none',
        whiteSpace:    'nowrap',
      }}
    >
      {SLOGAN}
    </div>
  )
}

// ── IconLogo — pure SVG "S" lettermark ────────────────────────────────────────
export function IconLogo({ size = 32, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="stAIrcode"
      style={{ flexShrink: 0, borderRadius: size * 0.2, ...style }}
    >
      <rect width="32" height="32" rx={size * 0.2} fill={NAVY} />
      <text
        x="16" y="23"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="22"
        fontWeight="800"
        fontStyle="italic"
        fill={ORANGE}
        letterSpacing="-0.03em"
      >S</text>
    </svg>
  )
}

// ── Logo — full wordmark ───────────────────────────────────────────────────────
interface LogoProps {
  size?:       'xs' | 'sm' | 'md' | 'lg' | 'xl'
  onDark?:     boolean
  iconOnly?:   boolean
  showSlogan?: boolean   // default true for md/lg/xl
  style?:      React.CSSProperties
  className?:  string
}

export default function Logo({
  size = 'md',
  onDark = false,
  iconOnly = false,
  showSlogan,
  style,
  className,
}: LogoProps) {
  const fs = FONT_PX[size]
  const defaultSlogan = size === 'md' || size === 'lg' || size === 'xl'
  const displaySlogan = showSlogan ?? defaultSlogan

  if (iconOnly) {
    return <IconLogo size={fs} style={style} />
  }

  if (!displaySlogan) {
    return <Wordmark fontSize={fs} onDark={onDark} style={style} />
  }

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}
      className={className}
    >
      <Wordmark fontSize={fs} onDark={onDark} />
      <Slogan   fontSize={fs} onDark={onDark} />
    </div>
  )
}

// ── NavLogo — compact header, slogan off by default ───────────────────────────
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
  // height maps roughly to font size: header image was ~159px tall at 835px wide
  // so a 28px height = about 22px font
  const fs = Math.round(height * 0.78)

  if (!showSlogan) {
    return (
      <Wordmark fontSize={fs} onDark={onDark} style={style} />
    )
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}>
      <Wordmark fontSize={fs} onDark={onDark} />
      <Slogan   fontSize={fs} onDark={onDark} />
    </div>
  )
}

// ── BetaLogo — wordmark + BETA pill ───────────────────────────────────────────
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
  const fs  = FONT_PX[size]
  const ps  = Math.max(9, Math.round(fs * 0.3))
  const defaultSlogan = size === 'md' || size === 'lg'
  const displaySlogan = showSlogan ?? defaultSlogan

  return (
    <div
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', ...style }}
    >
      {/* Wordmark + BETA pill on same row */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(fs * 0.2) }}>
        <Wordmark fontSize={fs} onDark={onDark} />
        <span
          style={{
            display:       'inline-flex',
            alignItems:    'center',
            background:    ORANGE,
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
          }}
        >
          BETA
        </span>
      </div>
      {displaySlogan && <Slogan fontSize={fs} onDark={onDark} />}
    </div>
  )
}
