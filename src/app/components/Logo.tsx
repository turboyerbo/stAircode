'use client'
/**
 * Logo.tsx — stAIrcode logo component
 *
 * Renders entirely in code — inline SVG cloud + CSS wordmark.
 * No PNG dependencies, works on any background.
 *
 * Brand guide:
 *   Orange:    #FA741F  (cloud gradient, AI letters)
 *   Dark Blue: #0D2B52  (st, rcode text)
 *   Font:      Inter SemiBold
 */

interface LogoProps {
  size?:     'xs' | 'sm' | 'md' | 'lg' | 'xl'
  onDark?:   boolean
  iconOnly?: boolean
  style?:    React.CSSProperties
  className?: string
}

const H: Record<string, number> = { xs: 18, sm: 26, md: 36, lg: 48, xl: 64 }
const ORANGE    = '#FA741F'
const DARK_BLUE = '#0D2B52'
const WHITE     = '#FFFFFF'

function CloudIcon({ h, onDark = false }: { h: number; onDark?: boolean; id?: string }) {
  // CSS filter converts black SVG fill to the right colour:
  //   onDark  → white  (invert to white)
  //   default → orange (#FA741F) via hue-rotate + saturate
  // The SVG uses fill="currentColor" but <img> can't inherit CSS color,
  // so we use filter instead for reliable colour control.
  const filter = onDark
    ? 'brightness(0) invert(1)'  // black → white
    : 'brightness(0) saturate(100%) invert(52%) sepia(90%) saturate(600%) hue-rotate(1deg) brightness(103%)'  // black → #FA741F orange
  return (
    <img
      src="/logo_mark.svg"
      alt=""
      aria-hidden="true"
      width={h}
      height={h}
      style={{ display:'block', flexShrink:0, objectFit:'contain', filter }}
    />
  )
}

function Wordmark({ h, onDark }: { h: number; onDark: boolean }) {
  const color = onDark ? WHITE : DARK_BLUE
  const fs = Math.round(h * 0.76)
  return (
    <span style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: fs, fontWeight: 600, lineHeight: 1,
      letterSpacing: '-0.01em', display: 'inline-flex',
      alignItems: 'baseline', userSelect: 'none' as const,
    }}>
      <span style={{ color }}>st</span>
      <span style={{ color: ORANGE }}>AI</span>
      <span style={{ color }}>rcode</span>
    </span>
  )
}

export default function Logo({ size = 'md', onDark = false, iconOnly = false, style, className }: LogoProps) {
  const h = H[size]
  if (iconOnly) return <CloudIcon h={h} />
  return (
    <div className={className} style={{ display:'inline-flex', alignItems:'center', gap: Math.round(h * 0.22), ...style }}>
      <CloudIcon h={h} />
      <Wordmark h={h} onDark={onDark} />
    </div>
  )
}

export function BetaLogo({ size = 'md', onDark = false, style }: { size?: 'xs'|'sm'|'md'|'lg'; onDark?: boolean; style?: React.CSSProperties }) {
  const h = H[size]
  const ps = Math.max(9, Math.round(h * 0.33))
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap: Math.round(h * 0.18), ...style }}>
      <Logo size={size} onDark={onDark} />
      <span style={{
        display:'inline-flex', alignItems:'center',
        background: ORANGE, color: WHITE,
        fontSize: ps, fontWeight: 800, letterSpacing: '0.13em',
        padding: `${Math.round(ps*0.3)}px ${Math.round(ps*0.65)}px`,
        borderRadius: 999, fontFamily: 'monospace',
        boxShadow: '0 1px 6px rgba(250,116,31,0.45)',
        flexShrink: 0, lineHeight: 1,
      }}>BETA</span>
    </div>
  )
}
