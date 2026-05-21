import React from 'react'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Page Not Found — Staircode' }

export default function NotFound() {
  return (
    <main style={{
      minHeight: '100dvh', background: '#0D2B45', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '1rem', padding: '2rem',
      fontFamily: "system-ui, -apple-system, sans-serif", textAlign: 'center',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/staircode_logo.png" alt="stAIrcode" style={{ height: 36, objectFit: 'contain', marginBottom: '0.5rem' }} />
      <h1 style={{ fontSize: '4rem', fontWeight: 900, margin: 0, opacity: 0.15 }}>404</h1>
      <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>Page not found</p>
      <a href="/" style={{
        marginTop: '1rem', padding: '0.85rem 2rem',
        background: 'linear-gradient(135deg,#007FFF,#FF7F00)',
        borderRadius: 14, color: '#fff', textDecoration: 'none',
        fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace',
        letterSpacing: '0.1em',
      }}>
        ← Back to App
      </a>
    </main>
  )
}
