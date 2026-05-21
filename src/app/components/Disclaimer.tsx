/**
 * src/app/components/Disclaimer.tsx
 *
 * Legal disclaimer shown on every compliance report.
 * MUST remain visible — do not hide behind a toggle or scroll.
 */

export default function Disclaimer() {
  return (
    <div style={{
      marginTop: '0.5rem',
      padding: '0.9rem 1rem',
      background: '#fffbf0',
      border: '1px solid rgba(180,130,0,0.25)',
      borderLeft: '3px solid #b8860b',
      borderRadius: '8px',
      fontSize: '0.68rem',
      color: '#5a4a00',
      lineHeight: 1.7,
    }}><div style={{
        fontWeight: 700,
        fontSize: '0.65rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: '0.35rem',
        color: '#8a6a00',
      }}>Important Disclaimer
      </div>
      <p>
        This report is provided for <strong>informational and preliminary assessment
        purposes only</strong>. It does not constitute a professional engineering,
        architectural, or building inspection assessment, and must not be relied upon
        as a substitute for advice from a licensed professional.
      </p>
      <p style={{ marginTop: '0.4rem' }}>Just Open Technologies Inc. makes no representations or warranties regarding the accuracy,
        completeness, or fitness for purpose of these results. Measurements entered
        by the user have not been independently verified. Local amendments,
        occupancy classifications, and site-specific conditions may affect applicable
        requirements.
      </p>
      <p style={{ marginTop: '0.4rem' }}><strong>Always consult a licensed architect, engineer, or building official
        before making any structural or compliance decisions.</strong> Just Open Technologies Inc.
        accepts no liability for any loss, injury, or damage arising from reliance
        on this report.
      </p>
      <p style={{ marginTop: '0.4rem' }}><strong>Data collection:</strong> Usage data is collected solely to improve app functionality
        and service quality. It is never intentionally shared for marketing purposes or sold to
        third parties. Any camera images captured that do not contain staircase content are treated
        as unrelated data and are deleted from our servers immediately and automatically.
      </p>
      <p style={{ marginTop: '0.5rem', fontSize: '0.6rem', color: '#8a6a00' }}>© {new Date().getFullYear()} Just Open Technologies Inc. · By using this app you agree to
        our{' '}
        <a href="/terms" style={{ color: '#8a6a00', textDecoration: 'underline' }}>Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy" style={{ color: '#8a6a00', textDecoration: 'underline' }}>Privacy Policy</a>.
      </p>
    </div>
  )
}
