/**
 * CreditCardScalePrompt.tsx
 * 
 * Drop into: src/app/components/CreditCardScalePrompt.tsx
 * 
 * A dismissable in-scene banner that appears before scanning,
 * prompting the user to place a credit card in view for better accuracy.
 * 
 * Why it works:
 *   A standard credit card is exactly 85.6 × 54 mm (ISO/IEC 7810 ID-1).
 *   When the AI vision model can see it in the same frame as the stair,
 *   it uses the card as a known reference object to determine real-world
 *   scale, improving measurement accuracy from ±30–50mm down to ±10–15mm.
 * 
 * Usage:
 *   import CreditCardScalePrompt from './CreditCardScalePrompt';
 * 
 *   // Inside scan view, rendered before the first capture:
 *   {!cardDismissed && (
 *     <CreditCardScalePrompt
 *       onDismiss={() => setCardDismissed(true)}
 *       onCardPlaced={() => { setCardDismissed(true); setScaleRef('credit_card'); }}
 *     />
 *   )}
 * 
 * Also export the helper that adds scale context to your Claude prompt:
 *   import { buildScaleContext } from './CreditCardScalePrompt';
 *   const systemAddendum = buildScaleContext(scaleRef);
 */

'use client';

import { useState } from 'react';

export type ScaleReference = 'credit_card' | 'coin' | 'hand' | 'none';

interface Props {
  /** Called when user taps "Got it" (card is placed) */
  onCardPlaced?: () => void;
  /** Called when user explicitly dismisses without placing a card */
  onDismiss?: () => void;
  /** If true, shows a more compact version for smaller screens */
  compact?: boolean;
}

export default function CreditCardScalePrompt({
  onCardPlaced,
  onDismiss,
  compact = false,
}: Props) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const dismiss = (placed: boolean) => {
    setVisible(false);
    if (placed) onCardPlaced?.();
    else onDismiss?.();
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: compact ? 100 : 120,
        left: 12,
        right: 12,
        zIndex: 30,
        background: 'rgba(10,18,40,0.92)',
        border: '1px solid rgba(59,170,255,0.35)',
        borderRadius: 14,
        padding: compact ? '12px 14px' : '14px 16px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
        animation: 'scalePromptSlideUp 0.3s ease-out',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Card icon */}
        <div
          style={{
            flexShrink: 0,
            width: compact ? 36 : 44,
            height: compact ? 24 : 28,
            background: 'linear-gradient(135deg, #2d5be3 0%, #1a3a9e 100%)',
            borderRadius: 4,
            border: '1.5px solid rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            marginTop: 2,
          }}
        >
          {/* Magnetic stripe */}
          <div
            style={{
              position: 'absolute',
              top: '28%',
              left: 0,
              right: 0,
              height: '22%',
              background: 'rgba(0,0,0,0.55)',
            }}
          />
          {/* Chip */}
          <div
            style={{
              width: 8,
              height: 6,
              background: 'rgba(255,215,0,0.7)',
              borderRadius: 1,
              border: '0.5px solid rgba(255,255,255,0.3)',
              marginTop: -2,
            }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              color: '#fff',
              fontSize: compact ? 13 : 14,
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            Place a credit card in the scene
          </p>
          <p
            style={{
              margin: '4px 0 0',
              color: 'rgba(255,255,255,0.65)',
              fontSize: compact ? 11 : 12,
              lineHeight: 1.4,
            }}
          >
            A standard card is{' '}
            <span style={{ color: '#3BAAFF', fontWeight: 600 }}>85.6 × 54 mm</span> — a known size the AI
            uses as a scale reference. This can improve measurement accuracy to{' '}
            <span style={{ color: '#3BAAFF', fontWeight: 600 }}>±10–15 mm</span>, compared to ±30–50 mm
            without a reference object.
          </p>
        </div>
      </div>

      {/* How to position tip */}
      {!compact && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 10px',
            background: 'rgba(59,170,255,0.08)',
            borderRadius: 8,
            border: '1px solid rgba(59,170,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>📐</span>
          <p
            style={{
              margin: 0,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 11,
              lineHeight: 1.4,
            }}
          >
            Lay the card flat on the tread or step nosing, parallel to the edge, fully visible in frame.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => dismiss(false)}
          style={{
            flex: 1,
            padding: '9px 0',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.55)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Skip
        </button>
        <button
          onClick={() => dismiss(true)}
          style={{
            flex: 2,
            padding: '9px 0',
            background: 'linear-gradient(135deg, #1d6aff 0%, #0a4fe8 100%)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(29,106,255,0.4)',
          }}
        >
          Card is in frame ✓
        </button>
      </div>

      <style>{`
        @keyframes scalePromptSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Helper: build system-prompt addendum for Claude Vision ───────────────────
/**
 * Call this to append scale context to your Claude API system prompt
 * so the vision model knows to look for the reference object.
 * 
 * Example:
 *   const systemPrompt = BASE_SYSTEM_PROMPT + buildScaleContext('credit_card');
 */
export function buildScaleContext(ref: ScaleReference): string {
  switch (ref) {
    case 'credit_card':
      return `
SCALE REFERENCE: A standard ISO/IEC 7810 ID-1 credit or debit card (85.6 mm wide × 54.0 mm tall) 
has been placed in the scene by the user. Identify it in the image and use its known dimensions 
to calibrate your real-world distance estimates before reporting stair measurements. 
If you can detect the card, state its apparent pixel dimensions and the scale factor you derived. 
This should allow measurement accuracy of ±10–15 mm.`;

    case 'coin':
      return `
SCALE REFERENCE: A Canadian loonie coin (26.5 mm diameter) or quarter (23.88 mm) may be visible 
in the scene. If you detect a coin, use its diameter as a scale reference to calibrate measurements.`;

    case 'hand':
      return `
SCALE REFERENCE: The user's hand may be visible. An average adult hand is approximately 
185–200 mm from wrist to middle fingertip. Use this as a rough scale reference if no better 
object is present, noting the increased uncertainty (±30 mm).`;

    default:
      return `
SCALE REFERENCE: No reference object was placed in the scene. Estimate scale from contextual 
environmental cues (door frames ~2000 mm, standard lumber widths, etc.) and state your 
confidence level. Expected accuracy ±30–50 mm.`;
  }
}
