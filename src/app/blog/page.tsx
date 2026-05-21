'use client'
import React from 'react'
import { NavLogo } from '@/app/components/Logo'

const POSTS = [
  {
    slug:     'starchitect-dead',
    category: 'Architecture + Technology',
    date:     'April 2026',
    title:    'The starchitect is dead. And we are left with the question of what comes next.',
    excerpt:  'The pedestal is empty. What fills the vacancy left by the singular, visionary architect will define the built environment for a generation. It had better be designed by people who understand what is at stake.',
    readTime: '6 min read',
    href:     '/our-story',
  },
]

export default function BlogPage() {
  const C = { bg: '#fff', navy: '#0D1E2E', navy2: '#5E7D9B', orange: '#F29337', border: '#E5EBF2', bg2: '#F7FAFC' }
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: C.navy }}><header style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', background: C.bg }}><a href="/marketing" style={{ textDecoration: 'none' }}><NavLogo height={28} /></a>
        <a href="/marketing" style={{ fontSize: '0.78rem', color: C.navy2, textDecoration: 'none', marginLeft: 'auto' }}>← Back</a>
      </header>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '4rem 1.5rem 6rem' }}><div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', color: C.orange, textTransform: 'uppercase' as const, marginBottom: '0.6rem' }}>Blog</div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '0.5rem' }}>Thinking about buildings, codes, and technology
        </h1>
        <p style={{ fontSize: '1rem', color: C.navy2, lineHeight: 1.7, marginBottom: '3.5rem', maxWidth: 540 }}>Ideas from the team at Just Open Technologies — the practice behind stAIrcode.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2rem' }}>{POSTS.map(p => (
            <a key={p.slug} href={p.href}
              style={{ display: 'flex', flexDirection: 'column' as const, textDecoration: 'none', borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(44,74,110,0.06)', transition: 'box-shadow 0.2s' }}><div style={{ background: '#0A1C2E', padding: '2.5rem 2rem' }}><h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontWeight: 900, color: '#E8F4FF', lineHeight: 1.2, letterSpacing: '-0.02em', margin: 0 }}>{p.title}
                </h2>
              </div>
              <div style={{ padding: '1.5rem 2rem', background: C.bg }}><div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}><span style={{ fontSize: '0.68rem', fontWeight: 700, color: C.orange, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>{p.category}</span>
                  <span style={{ fontSize: '0.68rem', color: C.navy2 }}>{p.date}</span>
                  <span style={{ fontSize: '0.68rem', color: C.navy2 }}>{p.readTime}</span>
                </div>
                <p style={{ fontSize: '0.95rem', color: C.navy2, lineHeight: 1.7, margin: '0 0 1rem' }}>{p.excerpt}</p>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: C.navy }}>Read more →</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
