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

function CloudIcon({ h, id }: { h: number; id: string }) {
  const w = Math.round(h * 1.18)
  return (
    <svg width={w} height={h} viewBox="0 0 94 80" xmlns="http://www.w3.org/2000/svg" style={{ display:'block', flexShrink:0 }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF9030" />
          <stop offset="100%" stopColor={ORANGE} />
        </linearGradient>
      </defs>
      {/* Cloud body */}
      <path d="M73,55 C80,55 86,49 86,42 C86,35 80,29 73,29 C72,22 66,18 58,18 C53,18 49,20 46,24 C43,19 37,16 30,16 C19,16 11,24 11,35 C11,36 11,38 12,39 C7,41 4,46 4,52 C4,59 10,64 18,64 L73,64 Z" fill={`url(#${id})`} />
      {/* Crosshair/plus at top */}
      <rect x="53" y="21" width="7" height="19" rx="2.5" fill={WHITE} />
      <rect x="46" y="27" width="21" height="7" rx="2.5" fill={WHITE} />
      <circle cx="56.5" cy="30.5" r="2.5" fill={`url(#${id})`} />
      {/* Stair bars left to right, ascending */}
      <rect x="12" y="46" width="14" height="15" rx="2" fill={WHITE} />
      <rect x="29" y="40" width="12" height="21" rx="2" fill={WHITE} />
      <rect x="44" y="45" width="10" height="16" rx="2" fill={WHITE} />
      <rect x="57" y="49" width="9" height="12" rx="2" fill={WHITE} />
    </svg>
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
  const id = `cg${h}${onDark ? 'd' : 'l'}`
  if (iconOnly) return <CloudIcon h={h} id={id} />
  return (
    <div className={className} style={{ display:'inline-flex', alignItems:'center', gap: Math.round(h * 0.22), ...style }}>
      <CloudIcon h={h} id={id} />
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
