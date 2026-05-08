'use client'
/**
 * PaymentSuccessScreen.tsx
 *
 * Shown at /?payment=success&product=report after Stripe checkout.
 * Allows the user to download their PDF report immediately.
 * The report data (text, fields, photos) was saved to sessionStorage
 * by ReportScreen before redirecting to Stripe.
 */

import React, { useState } from 'react'

const C = {
  bg:     '#0A1C2E',
  bg2:    '#0F2336',
  border: 'rgba(65,124,164,0.2)',
  orange: '#F29337',
  green:  '#27A96B',
  blue:   '#417CA4',
  text:   '#FFFFFF',
  text2:  'rgba(255,255,255,0.7)',
  text3:  'rgba(255,255,255,0.4)',
}

export default function PaymentSuccessScreen() {
  const [generating, setGenerating] = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  async function handleDownload() {
    setGenerating(true)
    setError('')
    try {
      const { generatePhotoReport } = await import('@/lib/generate-photo-report')

      // Retrieve scan data saved to sessionStorage before Stripe redirect
      let frames: Record<string, string> = {}
      try { frames = JSON.parse(sessionStorage.getItem('sc_frames') || '{}') } catch {}
      const fields    = (() => { try { return JSON.parse(sessionStorage.getItem('sc_fields') || '[]') } catch { return [] } })()
      const codeLabel = sessionStorage.getItem('sc_code_label') || 'Building Code Compliance'
      const location  = sessionStorage.getItem('sc_location')   || ''

      // Get user email for the report API call
      const userEmail = (() => { try { const u = localStorage.getItem('sc_user'); return u ? JSON.parse(u).email : '' } catch { return '' } })()

      // ── Generate the full AI report text now (post-payment) ──────────────
      let reportText = sessionStorage.getItem('sc_report_text') || ''
      if (!reportText && fields.length > 0) {
        try {
          const res = await fetch('/api/report/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              fields,
              codeLabel,
              location,
              isOntario: location?.toLowerCase().includes('ontario') || location?.toLowerCase().includes('toronto'),
              frames: JSON.stringify(frames),
            }),
          })
          const data = await res.json()
          if (data.ok && data.reportText) {
            reportText = data.reportText
            try { sessionStorage.setItem('sc_report_text', reportText) } catch {}
          }
        } catch (e) {
          console.warn('[PaymentSuccess] Report generate failed, using blank text:', e)
        }
      }

      // ── Build and download the PDF ───────────────────────────────────────
      await generatePhotoReport({ reportText, fields, codeLabel, location, frames })
      setDone(true)
    } catch (err: any) {
      console.error('[PaymentSuccess] PDF error:', err)
      setError('Could not generate the PDF. Your report has been emailed — please check your inbox.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: C.text,
    }}>{/* Safety stripe at top */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 4,
        background: 'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)',
      }} />

      <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>{/* Logo wordmark */}
        <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '2rem' }}>st<span style={{ color: C.orange }}>AI</span>rcode
        </div>

        {/* Success card */}
        <div style={{
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: '2rem 1.75rem',
          marginBottom: '1rem',
        }}>{/* Checkmark */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(39,169,107,0.12)',
            border: '2px solid rgba(39,169,107,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            fontSize: '1.8rem',
          }}></div>

          <h1 style={{
            fontSize: '1.6rem', fontWeight: 900,
            letterSpacing: '-0.02em', marginBottom: '0.5rem',
            color: C.green,
          }}>Payment complete
          </h1>

          {/* Beta pricing confirmation */}
          <div style={{ background: 'rgba(242,147,55,0.08)', border: '1px solid rgba(242,147,55,0.25)', borderRadius: 10, padding: '0.6rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><span style={{ fontSize: '0.78rem', color: C.text2 }}>Beta testing price paid:</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>$38.99</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: C.orange }}>$2.99 </span>
          </div>

          <p style={{
            fontSize: '0.9rem', color: C.text2,
            lineHeight: 1.7, marginBottom: '1.75rem',
          }}>Your stair compliance report is ready. Click the button below to
            download your PDF. A copy has also been sent to your email.
          </p>

          {/* Download button */}
          {!done ? (
            <button
              onClick={handleDownload}
              disabled={generating}
              style={{
                width: '100%', padding: '1.1rem',
                background: generating
                  ? 'rgba(255,255,255,0.06)'
                  : `linear-gradient(135deg, ${C.orange}, #C4721E)`,
                border: 'none', borderRadius: 14,
                color: generating ? C.text3 : C.text,
                fontSize: '1rem', fontWeight: 800,
                letterSpacing: '0.04em',
                cursor: generating ? 'wait' : 'pointer',
                boxShadow: generating ? 'none' : '0 4px 24px rgba(242,147,55,0.4)',
                transition: 'all 0.2s',
                marginBottom: '0.75rem',
              }}
            >
              {generating ? '⏳  Generating compliance analysis…' : '⬇  Download Full Report'}
            </button>
          ) : (
            <div style={{
              background: 'rgba(39,169,107,0.1)',
              border: '1.5px solid rgba(39,169,107,0.35)',
              borderRadius: 14, padding: '1rem',
              marginBottom: '0.75rem',
            }}><div style={{ fontSize: '1rem', fontWeight: 700, color: C.green, marginBottom: '0.25rem' }}>Report downloaded
              </div>
              <div style={{ fontSize: '0.78rem', color: C.text2, lineHeight: 1.6 }}>Check your Downloads folder for the PDF.
                A copy was also sent to your email.
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(220,60,60,0.1)',
              border: '1px solid rgba(220,60,60,0.3)',
              borderRadius: 10, padding: '0.75rem 1rem',
              fontSize: '0.78rem', color: '#ff9999',
              marginBottom: '0.75rem', lineHeight: 1.6,
            }}>{error}
            </div>
          )}

          {/* What's in your report */}
          <div style={{
            background: 'rgba(65,124,164,0.08)',
            border: '1px solid rgba(65,124,164,0.2)',
            borderRadius: 12, padding: '0.9rem 1rem',
            textAlign: 'left',
          }}><div style={{ fontSize: '0.72rem', color: C.text3, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>YOUR REPORT INCLUDES
            </div>
            {[
              'Measurement summary table with pass/fail results',
              'Applicable building code citations',
              'Detailed compliance analysis for each dimension',
              'Measurement photographs from your scan',
              'Pre-inspection summary for your contractor or inspector',
            ].map(item => (
              <div key={item} style={{
                fontSize: '0.78rem', color: C.text2,
                display: 'flex', gap: '0.5rem',
                alignItems: 'flex-start', marginBottom: '0.35rem',
              }}>{item}
              </div>
            ))}
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => {
            // Clear payment params and reload app
            window.history.replaceState({}, '', '/')
            window.location.reload()
          }}
          style={{
            background: 'none',
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '0.7rem 1.75rem',
            color: C.text3,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          ← Back to stAIrcode
        </button>

        <p style={{ fontSize: '0.65rem', color: C.text3, marginTop: '1.25rem', lineHeight: 1.6 }}>Questions? Contact us at{' '}
          <a href="mailto:info@staircode.app" style={{ color: C.blue, textDecoration: 'none' }}>info@staircode.app
          </a>
        </p>
      </div>
    </div>
  )
}
