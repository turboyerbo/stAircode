import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Staircode',
  description: 'How Staircode collects and uses your data.',
}

export default function PrivacyPage() {
  const updated = 'March 20, 2026'
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem 5rem', fontFamily: "system-ui, sans-serif", color: '#1a2b3c', lineHeight: 1.75 }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.3rem' }}>Privacy Policy</h1>
      <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '2.5rem' }}>Last updated: {updated}</p>

      <Section title="1. Who we are">
        Staircode Inc. ("Staircode", "we", "our") operates the Staircode mobile app and website at staircode.app.
        Contact us at <a href="mailto:info@staircode.app" style={{ color: '#1565C0' }}>info@staircode.app</a>.
      </Section>

      <Section title="2. What we collect">
        <ul>
          <li><strong>Camera frames</strong> — captured in-app during a measurement session. Frames are processed
            in memory and sent to our AI service to estimate stair dimensions. They are <strong>never saved to
            your camera roll</strong>, never stored on our servers, and discarded immediately after measurement.</li>
          <li><strong>Location</strong> — approximate GPS coordinates, collected once per session to detect your
            local building code jurisdiction. We do not track your location over time or share it with third parties.</li>
          <li><strong>Account information</strong> — if you sign in, we store your email address or phone number
            and membership tier. OAuth providers (Google, Apple) share only a user ID and email.</li>
          <li><strong>Usage analytics</strong> — anonymous session events (screen views, scan count) to improve
            the product. No personally identifiable information is attached.</li>
        </ul>
      </Section>

      <Section title="3. How we use your data">
        <ul>
          <li>To provide and improve the measurement and compliance features.</li>
          <li>To detect your jurisdiction and apply the correct building code.</li>
          <li>To manage your account and membership.</li>
          <li>To send transactional emails (OTP codes, receipts). We do not send marketing email without consent.</li>
        </ul>
      </Section>

      <Section title="4. AI processing">
        Camera frames are transmitted over HTTPS to the Anthropic API (Claude) for measurement analysis.
        Anthropic's data processing is governed by their <a href="https://www.anthropic.com/privacy" style={{ color: '#1565C0' }}>Privacy Policy</a>.
        We do not use your camera images to train AI models.
      </Section>

      <Section title="5. Data retention">
        Camera frames: deleted immediately after measurement (not stored). Location: session-only.
        Account data: retained while your account is active. You may request deletion at any time by emailing us.
      </Section>

      <Section title="6. Third-party services">
        <ul>
          <li><strong>Anthropic (Claude API)</strong> — AI measurement analysis.</li>
          <li><strong>Vercel</strong> — hosting and serverless functions.</li>
          <li><strong>OpenStreetMap / Nominatim</strong> — reverse geocoding for jurisdiction detection.</li>
          <li><strong>Overpass API</strong> — nearby firms lookup.</li>
        </ul>
        We do not sell your data to any third party.
      </Section>

      <Section title="7. Children's privacy">
        Staircode is not directed at children under 13. We do not knowingly collect data from children.
      </Section>

      <Section title="8. Your rights">
        You may request access to, correction of, or deletion of your personal data at any time.
        Contact <a href="mailto:info@staircode.app" style={{ color: '#1565C0' }}>info@staircode.app</a>.
        If you are in the EU/EEA, you have additional rights under GDPR.
      </Section>

      <Section title="9. Changes">
        We will post updates to this page and update the "Last updated" date. Continued use of the app
        after changes constitutes acceptance of the revised policy.
      </Section>

      <p style={{ marginTop: '3rem', fontSize: '0.8rem', color: '#9ca3af' }}>
        © {new Date().getFullYear()} Staircode Inc. All rights reserved.
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
