'use client'
/**
 * FeedbackButton.tsx
 *
 * "Share Beta Feedback" button used on HelpScreen and SettingsScreen.
 *
 * Priority order for where the form opens:
 *   1. NEXT_PUBLIC_TALLY_FORM_ID is set → embed Tally iframe in bottom sheet
 *   2. NEXT_PUBLIC_SURVEY_URL is set    → open survey in new tab (no iframe)
 *   3. Neither set                      → open mailto: fallback
 *
 * To wire up:
 *   tally.so → New form → Publish → Share
 *   Copy the form ID from the URL:  tally.so/r/XXXXXX → use XXXXXX
 *   Add to Netlify: NEXT_PUBLIC_TALLY_FORM_ID=XXXXXX
 *   Add to Netlify: NEXT_PUBLIC_SURVEY_URL=https://tally.so/r/XXXXXX
 */

import { useState } from 'react'
import { Analytics } from '@/lib/analytics'

const BG3    = '#152D46'
const BORDER = 'rgba(147,186,212,0.15)'
const TEXT   = '#E8F4FF'
const TEXT2  = '#93BAD4'
const TEXT3  = '#4E7A9B'
const GREEN  = '#27A96B'

interface Props {
  source?: 'help_screen' | 'report_screen' | 'settings'
}

export default function FeedbackButton({ source = 'help_screen' }: Props) {
  const [open, setOpen] = useState(false)

  const tallyFormId  = process.env.NEXT_PUBLIC_TALLY_FORM_ID
  const surveyUrl    = process.env.NEXT_PUBLIC_SURVEY_URL
  const hasRealForm  = tallyFormId && tallyFormId.length > 4
  const hasSurveyUrl = surveyUrl && surveyUrl.startsWith('http')

  // Build embed URL only if we have a real form ID
  const embedUrl = hasRealForm
    ? `https://tally.so/embed/${tallyFormId}?alignLeft=1&hideTitle=1&transparentBackground=1`
    : null

  function handleOpen() {
    Analytics.feedbackOpened(source)
    Analytics.surveyLinkClicked('help_screen')

    if (hasRealForm) {
      // Embed in bottom sheet
      setOpen(true)
    } else if (hasSurveyUrl) {
      // No form ID but survey URL set — open directly in new tab
      window.open(surveyUrl, '_blank', 'noopener,noreferrer')
    } else {
      // Fallback — email us
      window.location.href = 'mailto:info@staircode.app?subject=stAIrcode Beta Feedback'
    }
  }

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <button
        onClick={handleOpen}
        style={{
          width: '100%',
          padding: '0.95rem',
          background: `linear-gradient(135deg, ${GREEN}, #1A7A50)`,
          border: 'none',
          borderRadius: 14,
          cursor: 'pointer',
          color: '#fff',
          fontSize: '0.88rem',
          fontFamily: 'monospace',
          fontWeight: 700,
          letterSpacing: '0.08em',
          boxShadow: `0 4px 20px rgba(39,169,107,0.35)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '1rem' }}>💬</span>
        Share Beta Feedback
      </button>

      {/* ── Bottom sheet (only when embedUrl is valid) ──────────────────────── */}
      {open && embedUrl && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.72)',
              zIndex: 200,
            }}
          />

          {/* Sheet */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 430,
            zIndex: 201,
            background: BG3,
            borderRadius: '22px 22px 0 0',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90dvh',
          }}>

            {/* Handle + header */}
            <div style={{
              padding: '1rem 1.25rem 0.75rem',
              borderBottom: `1px solid ${BORDER}`,
              flexShrink: 0,
            }}>
              <div style={{
                width: 36, height: 4, borderRadius: 2,
                background: 'rgba(147,186,212,0.25)',
                margin: '0 auto 0.85rem',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: TEXT }}>Beta Feedback</div>
                  <div style={{ fontSize: '0.7rem', color: TEXT2, marginTop: '0.1rem' }}>
                    2 min · helps us improve stAIrcode
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: 'rgba(147,186,212,0.12)',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    width: 32, height: 32,
                    cursor: 'pointer',
                    color: TEXT3,
                    fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tally iframe */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 420 }}>
              <iframe
                src={embedUrl}
                title="Beta Feedback"
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 420,
                  border: 'none',
                  background: 'transparent',
                }}
              />
            </div>

            {/* Footer */}
            <div style={{
              padding: '0.6rem 1.25rem 1.5rem',
              borderTop: `1px solid ${BORDER}`,
              flexShrink: 0,
            }}>
              <p style={{
                margin: 0,
                fontSize: '0.6rem',
                color: TEXT3,
                textAlign: 'center',
                lineHeight: 1.6,
              }}>
                Responses are anonymous unless you include contact info.
                We read every submission — thank you for helping us improve.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  )
}
