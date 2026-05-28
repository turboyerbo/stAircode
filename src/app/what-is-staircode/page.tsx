'use client'
import React from 'react'
import { NavLogo } from '@/app/components/Logo'

export default function WhatIsStaircodeePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A1C2E', color: '#fff', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>{/* Nav */}
      <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '1rem' }}><a href="/marketing" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>{/* eslint-disable-next-line @next/next/no-img-element */}
          <NavLogo height={28} />
        </a>
        <a href="/marketing" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'none', marginLeft: 'auto' }}>← Back</a>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '3rem 1.5rem' }}>{/* Label */}
        <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', color: '#F29337', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Introduction
        </div>

        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1.25rem', color: '#E8F4FF' }}>What is st<span style={{ color: '#F29337' }}>AI</span>rcode?
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.8, marginBottom: '2.5rem', maxWidth: 620 }}>stAIrcode is an AI-powered stair compliance tool that lets anyone — from homeowners to building managers — check whether a staircase meets local building code requirements using nothing but a smartphone. No tape measure. No technical knowledge. No site visit required from an engineer.
        </p>

        {/* YouTube video */}
        <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(65,124,164,0.25)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', marginBottom: '3rem', maxWidth: 420, margin: '0 auto 3rem' }}><div style={{ position: 'relative', paddingTop: '177.78%' }}><iframe
              src="https://www.youtube.com/embed/3L6c9sbGpmI?rel=0&modestbranding=1&color=white"
              title="stAIrcode Introduction — AI-guided stair compliance scan"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </div>
        </div>

        {/* Description blocks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>{[
            {
              icon: '',
              title: 'AI-Vision measurement',
              body: 'The app uses your phone camera combined with an AI vision model to estimate stair dimensions — riser height, tread depth, stair width, handrail height, nosing, and headroom — from photographs alone. A reference object (like a standard credit card) placed in frame improves accuracy to within ±9.5–25mm.',
            },
            {
              icon: '',
              title: 'Building code compliance check',
              body: 'Every measurement is automatically checked against the applicable building code for your location — including OBC 2024, NBC, IBC, BCBC, and AODA. You get an instant pass/fail result per dimension, with the specific code section cited.',
            },
            {
              icon: '',
              title: 'Professional PDF report',
              body: 'After scanning, you can access the full platform with a subscription — a professionally formatted PDF including measurement photos, code citations, pass/fail analysis, and a pre-inspection summary ready to share with your architect, contractor, or building inspector.',
            },
          ].map(item => (
            <div key={item.title} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(65,124,164,0.15)', borderRadius: 14, padding: '1.25rem' }}><span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{item.icon}</span>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#E8F4FF', marginBottom: '0.4rem' }}>{item.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: 0 }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}><a href="/?signin=1" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#F29337,#C4721E)', color: '#fff', fontWeight: 800, fontSize: '1rem', textDecoration: 'none', padding: '0.9rem 2.5rem', borderRadius: 14, letterSpacing: '0.04em', boxShadow: '0 4px 20px rgba(242,147,55,0.4)' }}>Try stAIrcode Free →
          </a>
        </div>

      </div>
    </div>
  )
}
