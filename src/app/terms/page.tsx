import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Staircode',
  description: 'Terms governing use of the Staircode app.',
}

export default function TermsPage() {
  const updated = 'March 20, 2026'
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem 5rem', fontFamily: 'system-ui, sans-serif', color: '#1a2b3c', lineHeight: 1.75 }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.3rem' }}>Terms of Service</h1>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '2.5rem' }}>Last updated: {updated}</p>

      <Section title="1. Acceptance">
        By downloading, installing, or using the Staircode app or website (&quot;Service&quot;), you agree to be
        bound by these Terms of Service. If you do not agree, do not use the Service.
      </Section>

      <Section title="2. Description of Service">
        Staircode provides camera-based stair measurement estimation and preliminary building code
        compliance assessment. Results are indicative only and do not constitute a professional
        engineering, architectural, or regulatory inspection.
      </Section>

      <Section title="3. Disclaimer of warranties">
        THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND. STAIRCODE INC. EXPRESSLY
        DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        <br /><br />
        Measurement accuracy depends on device hardware, lighting, camera positioning, and surface
        characteristics. Typical accuracy is ±5–15 mm. Staircode makes no guarantee of measurement
        accuracy for any specific use case.
      </Section>

      <Section title="4. Limitation of liability">
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, STAIRCODE INC. SHALL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA,
        OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
        <br /><br />
        IN NO EVENT SHALL STAIRCODE&apos;S TOTAL LIABILITY EXCEED THE AMOUNT PAID BY YOU FOR THE SERVICE
        IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR CAD $50, WHICHEVER IS GREATER.
      </Section>

      <Section title="5. Professional advice">
        Nothing in the Service constitutes professional engineering, architectural, or building
        inspection advice. <strong>Always consult a licensed professional</strong> before making
        structural or compliance decisions. The Service must not be relied upon as a substitute for
        advice from a qualified building inspector or code consultant.
      </Section>

      <Section title="6. Permitted use">
        You may use the Service for lawful purposes only. You may not: reverse-engineer or decompile
        the Service; use automated tools to scrape or abuse the API; attempt to circumvent security
        or rate-limiting measures; or use the Service to make false compliance claims.
      </Section>

      <Section title="7. Accounts and subscriptions">
        You are responsible for maintaining the confidentiality of your account credentials.
        Subscriptions are billed monthly or annually. You may cancel at any time; no refunds are
        issued for partial billing periods unless required by applicable law.
      </Section>

      <Section title="8. Intellectual property">
        All content, code, trademarks, and compliance logic in the Service are owned by Just Open Technologies Inc. (federally incorporated in Canada; extra-provincial registration in Ontario).
        and protected by applicable intellectual property laws. The building code limit values and
        compliance engine are proprietary and must not be extracted or reproduced.
      </Section>

      <Section title="9. Governing law">
        These Terms are governed by the laws of the Province of Ontario, Canada, without regard to
        conflict of law principles. Any dispute shall be resolved in the courts of Toronto, Ontario.
      </Section>

      <Section title="10. Changes">
        We may update these Terms at any time. Continued use of the Service after changes constitutes
        acceptance. Material changes will be communicated via email or in-app notice.
      </Section>

      <Section title="11. Contact">
        Questions about these Terms: <a href="mailto:info@staircode.app" style={{ color: '#1565C0' }}>info@staircode.app</a>
      </Section>

      <p style={{ marginTop: '3rem', fontSize: '0.8rem', color: '#9ca3af' }}>
        © {new Date().getFullYear()} Just Open Technologies Inc. All rights reserved.
      </p>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.6rem', color: '#0D2B45' }}>{title}</h2>
      <div style={{ fontSize: '0.92rem', color: '#374151' }}>{children}</div>
    </section>
  )
}
