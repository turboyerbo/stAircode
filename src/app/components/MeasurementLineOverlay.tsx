/**
 * MeasurementLineOverlay.tsx
 * 
 * Drop into: src/app/components/MeasurementLineOverlay.tsx
 * 
 * Renders an animated blue measurement line that sweeps across the camera view,
 * mimicking the AR measurement behaviour seen in the screenshot.
 * 
 * Usage:
 *   import MeasurementLineOverlay from './MeasurementLineOverlay';
 *   
 *   // Inside your camera/scan view JSX (must be relative/absolute positioned parent):
 *   <MeasurementLineOverlay
 *     isActive={stage === 'analysing' || stage === 'measuring'}
 *     measurement={detectedMeasurement}   // e.g. "1127mm" — null while scanning
 *     label="STAIR WIDTH"                 // e.g. "RISER HEIGHT", "TREAD DEPTH"
 *     axis="horizontal"                   // or "vertical"
 *     onComplete={() => setStage('confirm')}
 *   />
 */

'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  isActive: boolean;
  measurement?: string | null;   // e.g. "1127mm"
  label?: string;                // e.g. "STAIR WIDTH"
  axis?: 'horizontal' | 'vertical';
  /** Called once the animated sweep finishes and measurement is displayed */
  onComplete?: () => void;
  /** Override the sweep duration in ms (default 1800) */
  sweepDuration?: number;
}

type Phase = 'idle' | 'sweeping' | 'measured' | 'done';

export default function MeasurementLineOverlay({
  isActive,
  measurement,
  label = 'MEASURING',
  axis = 'horizontal',
  onComplete,
  sweepDuration = 1800,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [linePos, setLinePos] = useState(0);        // 0–100 %
  const [showValue, setShowValue] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Kick off sweep whenever isActive flips to true ───────────────────
  useEffect(() => {
    if (!isActive) {
      // Reset cleanly when deactivated
      setPhase('idle');
      setLinePos(0);
      setShowValue(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    setPhase('sweeping');
    setShowValue(false);
    startRef.current = null;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / sweepDuration, 1);

      // Ease-in-out cubic
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      setLinePos(eased * 100);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setPhase('measured');
        setShowValue(true);
        // Show measurement for 2s then call onComplete
        setTimeout(() => {
          setPhase('done');
          onComplete?.();
        }, 2000);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  if (phase === 'idle' || phase === 'done') return null;

  const isHorizontal = axis === 'horizontal';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      {/* ── Scan sweep glow behind the line ── */}
      <div
        style={{
          position: 'absolute',
          ...(isHorizontal
            ? {
                left: 0,
                right: 0,
                top: `${linePos}%`,
                height: 40,
                transform: 'translateY(-50%)',
                background:
                  'linear-gradient(to bottom, transparent, rgba(59,170,255,0.10) 40%, rgba(59,170,255,0.22) 50%, rgba(59,170,255,0.10) 60%, transparent)',
              }
            : {
                top: 0,
                bottom: 0,
                left: `${linePos}%`,
                width: 40,
                transform: 'translateX(-50%)',
                background:
                  'linear-gradient(to right, transparent, rgba(59,170,255,0.10) 40%, rgba(59,170,255,0.22) 50%, rgba(59,170,255,0.10) 60%, transparent)',
              }),
          transition: 'none',
        }}
      />

      {/* ── The blue line itself ── */}
      <div
        style={{
          position: 'absolute',
          ...(isHorizontal
            ? {
                left: '4%',
                right: '4%',
                top: `${linePos}%`,
                height: 2,
                transform: 'translateY(-50%)',
              }
            : {
                top: '15%',
                bottom: '15%',
                left: `${linePos}%`,
                width: 2,
                transform: 'translateX(-50%)',
              }),
          background:
            'linear-gradient(to right, rgba(59,170,255,0.3), #3BAAFF 20%, #3BAAFF 80%, rgba(59,170,255,0.3))',
          boxShadow: '0 0 6px 2px rgba(59,170,255,0.6), 0 0 14px 4px rgba(59,170,255,0.25)',
          borderRadius: 2,
        }}
      />

      {/* ── End-cap dots ── */}
      {phase === 'measured' || phase === 'sweeping' ? (
        <>
          <Dot isHorizontal={isHorizontal} linePos={linePos} side="start" />
          <Dot isHorizontal={isHorizontal} linePos={linePos} side="end" />
        </>
      ) : null}

      {/* ── Measurement badge ── */}
      {showValue && measurement && (
        <div
          style={{
            position: 'absolute',
            ...(isHorizontal
              ? {
                  left: '50%',
                  top: `${linePos}%`,
                  transform: 'translate(-50%, -50%)',
                }
              : {
                  top: '50%',
                  left: `${linePos}%`,
                  transform: 'translate(-50%, -50%)',
                }),
            background: 'rgba(15,25,50,0.88)',
            border: '1.5px solid #3BAAFF',
            borderRadius: 6,
            padding: '4px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            backdropFilter: 'blur(6px)',
            animation: 'stairMeasureFadeIn 0.25s ease-out',
          }}
        >
          <span
            style={{
              color: '#3BAAFF',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.8,
            }}
          >
            {label}
          </span>
          <span
            style={{
              color: '#fff',
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '0.02em',
              lineHeight: 1,
            }}
          >
            {measurement}
          </span>
        </div>
      )}

      {/* ── Label strip shown during sweep ── */}
      {phase === 'sweeping' && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#3BAAFF',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.85,
            textShadow: '0 0 8px rgba(59,170,255,0.8)',
          }}
        >
          {label} — SCANNING
        </div>
      )}

      <style>{`
        @keyframes stairMeasureFadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.88); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Small glowing dot at each end of the line ────────────────────────────────
function Dot({
  isHorizontal,
  linePos,
  side,
}: {
  isHorizontal: boolean;
  linePos: number;
  side: 'start' | 'end';
}) {
  const edgeOffset = '4%';
  const style: React.CSSProperties = {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#3BAAFF',
    boxShadow: '0 0 6px 3px rgba(59,170,255,0.7)',
    transform: 'translate(-50%, -50%)',
    ...(isHorizontal
      ? {
          top: `${linePos}%`,
          [side === 'start' ? 'left' : 'right']: edgeOffset,
        }
      : {
          left: `${linePos}%`,
          [side === 'start' ? 'top' : 'bottom']: '15%',
        }),
  };
  return <div style={style} />;
}
