'use client'
/**
 * AuthScreen.tsx — Staircode Beta
 *
 * Email / phone OTP auth via Supabase.
 * Falls back to stub (any code works) if Supabase env vars are not set.
 *
 * Bugs fixed in this revision:
 *  1. Phone OTP — Supabase requires E.164 format (+1xxxxxxxxxx). Added auto-formatter.
 *  2. Verify error was silently swallowed — now surfaces the Supabase error message.
 *  3. handleResend had no error handling — now catches and shows errors.
 *  4. handleVerify finally block ran before setError on failure — fixed order.
 *  5. OTP code auto-submit when 6th digit entered.
 *  6. Loading state not reset on OAuth error path — fixed.
 *  7. Send code button text was white-on-white when disabled — fixed color.
 *  8. Paste support improved — pastes into all 6 boxes from any input.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import React from 'react'

const C = {
  orange:  '#F29337',
  blue:    '#417CA4',
  blueDk:  '#2C5A7A',
  paper:   '#F0F5FA',
  border:  'rgba(65,124,164,0.18)',
  ink:     '#0D1E2E',
  ink2:    '#2C4A68',
  ink3:    '#5E7D9B',
  muted:   'rgba(65,124,164,0.45)',
  dark:    '#EEF2F6',
}

// Two profiles — layperson (homeowner / DIY / real estate) or professional (architect / contractor / inspector)
export type UserRole = 'architect' | 'building_manager' | 'contractor' | 'diy' | 'realestate'

export interface AppUser {
  email:      string
  name:       string
  provider:   'otp' | 'google' | 'apple'
  membership: 'free' | 'pro' | 'enterprise'
  units:      'mm' | 'ft'
  role?:      UserRole
}

interface Props { onAuth: (user: AppUser) => void }
type Screen = 'entry' | 'otp'

// ── Supabase client (lazy) ────────────────────────────────────────────────────
// Requires: npm install @supabase/supabase-js
// Env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
import { createClient } from '@supabase/supabase-js'
import { Analytics, identifyUser } from '@/lib/analytics'
import { BetaLogo } from '@/app/components/Logo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const supabase    = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

// ── Phone number normaliser → E.164 ──────────────────────────────────────────
// Supabase requires +1xxxxxxxxxx format for SMS OTP.
// If user types 6471234567 or (647) 123-4567 we normalise it.
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Already has country code (11+ digits starting with 1 for North America)
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  // 10-digit North American number — assume +1
  if (digits.length === 10) return `+1${digits}`
  // Already has + — return as-is
  if (raw.trim().startsWith('+')) return raw.trim()
  // Otherwise prepend +
  return `+${digits}`
}

function isPhone(contact: string): boolean {
  return !contact.includes('@')
}

// ── OTP functions ─────────────────────────────────────────────────────────────
async function sendOtp(contact: string): Promise<void> {
  if (!supabase) {
    // Stub — works without Supabase configured
    await new Promise(r => setTimeout(r, 800))
    return
  }
  if (isPhone(contact)) {
    const phone = normalisePhone(contact)
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.auth.signInWithOtp({
      email: contact,
      options: { shouldCreateUser: true },
    })
    if (error) throw new Error(error.message)
  }
}

async function verifyOtp(contact: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) {
    await new Promise(r => setTimeout(r, 700))
    return { ok: true }
  }
  if (isPhone(contact)) {
    const phone = normalisePhone(contact)
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type:  'sms',
    })
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.auth.verifyOtp({
      email: contact,
      token: code,
      type:  'email',
    })
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function AuthScreen({ onAuth }: Props) {
  const [screen,  setScreen]  = useState<Screen>('entry')
  const [contact, setContact] = useState('')
  const [digits,  setDigits]  = useState(['', '', '', '', '', ''])
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [resent,  setResent]  = useState(false)
  const [sending, setSending] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  // Focus first digit box when OTP screen appears
  useEffect(() => {
    if (screen === 'otp') setTimeout(() => refs.current[0]?.focus(), 150)
  }, [screen])

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (digits.join('').length === 6 && screen === 'otp' && !loading) {
      handleVerify()
    }
  }, [digits]) // eslint-disable-line

  function save(u: AppUser) {
    try { localStorage.setItem('sc_user', JSON.stringify(u)) } catch {}
  }

  // ── Send code ────────────────────────────────────────────────────────────────
  async function handleSend() {
    setError('')
    const c = contact.trim()
    if (!c) { setError('Enter your email address.'); return }

    if (!c.includes('@') || !c.includes('.')) {
      setError('Enter a valid email address.')
      return
    }

    setSending(true)
    setLoading(true)
    try {
      await sendOtp(c)
      setScreen('otp')
      setDigits(['', '', '', '', '', ''])
      setResent(false)
    } catch (err: any) {
      // Surface the real Supabase error so it's actionable
      const msg = err?.message ?? ''
      if (msg.includes('rate') || msg.includes('limit')) {
        setError('Too many attempts. Please wait a minute and try again.')
      } else if (msg.includes('not confirmed') || msg.includes('signup')) {
        setError('Sign-up is currently restricted. Contact info@staircode.app for beta access.')
      } else {
        setError(msg || 'Could not send code. Check your email and try again.')
      }
    } finally {
      setSending(false)
      setLoading(false)
    }
  }

  // ── Verify code ──────────────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    const code = digits.join('')
    if (code.length < 6) return
    setError('')
    setLoading(true)
    try {
      const result = await verifyOtp(contact.trim(), code)
      if (!result.ok) {
        const msg = result.error ?? ''
        if (msg.includes('expired')) {
          setError('Code expired. Tap "Resend code" to get a new one.')
        } else if (msg.includes('invalid') || msg.includes('incorrect')) {
          setError('Incorrect code. Double-check and try again.')
        } else {
          setError(msg || 'Incorrect code. Try again.')
        }
        setDigits(['', '', '', '', '', ''])
        setTimeout(() => refs.current[0]?.focus(), 80)
        return
      }
      const u: AppUser = {
        email:      contact.trim(),
        name:       contact.trim().includes('@')
                      ? contact.trim().split('@')[0]
                      : contact.trim(),
        provider:   'otp',
        membership: 'free',
        units:      'mm',
      }
      save(u)

      // Identify user in PostHog — all future events will be attributed to this email
      identifyUser(u.email, { role: u.role, membership: u.membership, method: 'otp' })
      Analytics.userSignedIn('otp')

      // Send welcome email for new users (fire-and-forget — don't block sign-in)
      // Only fires if contact is an email address
      if (contact.trim().includes('@')) {
        const isNew = !localStorage.getItem('sc_welcomed')
        if (isNew) {
          fetch('/api/welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: contact.trim(), name: u.name }),
          }).then(() => {
            try { localStorage.setItem('sc_welcomed', '1') } catch {}
          }).catch(() => {})  // never block sign-in on email failure
        }
      }

      onAuth(u)
    } catch (err: any) {
      setError(err?.message ?? 'Verification failed. Please try again.')
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => refs.current[0]?.focus(), 80)
    } finally {
      setLoading(false)
    }
  }, [digits, contact, onAuth])

  // ── Resend ────────────────────────────────────────────────────────────────────
  async function handleResend() {
    setError('')
    setResent(false)
    try {
      await sendOtp(contact.trim())
      setResent(true)
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => refs.current[0]?.focus(), 100)
      setTimeout(() => setResent(false), 4000)
    } catch (err: any) {
      setError(err?.message ?? 'Could not resend. Try again in a moment.')
    }
  }

  // ── Digit input handling ──────────────────────────────────────────────────────
  function onDigitChange(i: number, val: string) {
    // Handle paste — spread all 6 digits
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, '').slice(0, 6)
      const next = ['', '', '', '', '', '']
      for (let k = 0; k < 6; k++) next[k] = pasted[k] ?? ''
      setDigits(next)
      refs.current[Math.min(pasted.length, 5)]?.focus()
      return
    }
    const d = val.replace(/\D/g, '')
    const next = [...digits]
    next[i] = d
    setDigits(next)
    if (d && i < 5) refs.current[i + 1]?.focus()
  }

  function onDigitKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        // Clear current box
        const next = [...digits]; next[i] = ''; setDigits(next)
      } else if (i > 0) {
        // Move to previous box
        const next = [...digits]; next[i - 1] = ''; setDigits(next)
        refs.current[i - 1]?.focus()
      }
    }
    if (e.key === 'Enter' && digits.join('').length === 6) handleVerify()
    if (e.key === 'ArrowLeft'  && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
  }

  // ── OAuth ─────────────────────────────────────────────────────────────────────
  async function handleOAuth(p: 'google' | 'apple') {
    setError('')
    setLoading(true)
    if (!supabase) {
      const u: AppUser = {
        email:      p === 'google' ? 'user@gmail.com' : 'user@icloud.com',
        name:       p === 'google' ? 'Google User'    : 'Apple User',
        provider:   p,
        membership: 'free',
        units:      'mm',
      }
      save(u); onAuth(u); return
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: p,
        options: {
          redirectTo: typeof window !== 'undefined'
            ? window.location.origin
            : 'https://staircode.app',
        },
      })
      if (error) throw error
      // Redirects away — session restored on return via page.tsx useEffect
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed. Try email instead.')
      setLoading(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────────
  const wrap: React.CSSProperties = {
    minHeight: '100dvh',
    background: '#E8F4FF',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1.5rem',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    color: '#0A1C2E',
    overflowY: 'auto',
  }
  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: 360,
    background: 'rgba(44,90,122,0.05)',
    border: `1px solid rgba(65,124,164,0.18)`,
    borderRadius: 24,
    padding: '2rem 1.6rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  }

  const logo = (
    <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
      <div style={{ fontSize: '0.52rem', fontFamily: 'monospace', letterSpacing: '0.34em', color: '#F29337', marginBottom: '0.3rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem' }}>
<span style={{display:'inline-flex',alignItems:'center',background:'#F29337',color:'#fff',fontSize:'0.42rem',fontWeight:800,letterSpacing:'0.12em',padding:'0.15rem 0.5rem',borderRadius:20,marginLeft:'0.45rem',verticalAlign:'middle',fontFamily:'monospace',boxShadow:'0 1px 6px rgba(242,147,55,0.45)'}}>BETA</span>
      </div>
    </div>
  )

  // ── Entry / Landing screen ───────────────────────────────────────────────────
  if (screen === 'entry') return (
    <div style={{
      minHeight: '100dvh',
      background: '#0A1C2E',
      backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 0 3rem',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      color: '#E8F4FF',
      overflowY: 'auto',
    }}>

      {/* Hero section */}
      <div style={{
        width: '100%', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(180deg, #0A1C2E 0%, #0F2438 100%)',
        padding: 'max(env(safe-area-inset-top,0px),2.5rem) 1.5rem 2.5rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        borderBottom: '1px solid rgba(65,124,164,0.2)',
      }}>
        {/* Safety stripe */}
        <div style={{ width: '100%', maxWidth: 480, height: 4, borderRadius: 2,
          background: 'repeating-linear-gradient(-45deg,#FA741F 0px,#FA741F 5px,#0A1C2E 5px,#0A1C2E 12px)',
          marginBottom: '1.75rem' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
          <img src="/logo_mark.svg" alt="stAIrcode" style={{ height: 40, filter: 'brightness(0) saturate(100%) invert(52%) sepia(90%) saturate(600%) hue-rotate(1deg) brightness(103%)' }} />
          <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize: 28, fontWeight: 600, letterSpacing: '-0.01em' }}>
            <span style={{ color: '#E8F4FF' }}>st</span>
            <span style={{ color: '#FA741F' }}>AI</span>
            <span style={{ color: '#E8F4FF' }}>rcode</span>
          </div>
          <div style={{ background: '#FA741F', color: '#fff', fontSize: '0.55rem', fontWeight: 800,
            letterSpacing: '0.12em', padding: '0.2rem 0.55rem', borderRadius: 999,
            fontFamily: 'monospace', boxShadow: '0 2px 8px rgba(250,116,31,0.5)' }}>BETA</div>
        </div>

        {/* Hero headline */}
        <h1 style={{ fontSize: 'clamp(1.4rem,5vw,1.9rem)', fontWeight: 900, color: '#E8F4FF',
          textAlign: 'center', margin: '0 0 0.75rem', lineHeight: 1.2, letterSpacing: '-0.02em', maxWidth: 420 }}>
          Stair compliance inspection —{" "}
          <span style={{ color: '#FA741F' }}>in 90 seconds.</span>
        </h1>
        <p style={{ fontSize: '1.05rem', color: '#93BAD4', textAlign: 'center',
          margin: '0 0 0.5rem', lineHeight: 1.6, maxWidth: 380, fontWeight: 400 }}>
          Real estate agents: generate a stair compliance pre-assessment report in 90 seconds.{" "}
          <strong style={{ color: '#27A96B' }}>Free during beta.</strong>
        </p>

        {/* AR image */}
        <div style={{ width: '100%', maxWidth: 420, borderRadius: 18, overflow: 'hidden',
          margin: '1.5rem 0', border: '1px solid rgba(65,124,164,0.25)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
          <img src="/AR_guided_inspection.png" alt="AR-guided stair inspection"
            style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover', objectPosition: 'center top' }} />
          <div style={{ background: 'rgba(10,28,46,0.95)', padding: '0.65rem 1rem',
            borderTop: '1px solid rgba(65,124,164,0.2)' }}>
            <div style={{ fontSize: '0.72rem', color: '#93BAD4', textAlign: 'center' }}>
              📡 AR measures real-world distances · 🤖 AI validates compliance
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div style={{ width: '100%', maxWidth: 420, background: 'rgba(39,169,107,0.1)',
          border: '1px solid rgba(39,169,107,0.3)', borderRadius: 16, padding: '1rem 1.1rem',
          marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '1rem', color: '#E8F4FF', lineHeight: 1.6, marginBottom: '0.5rem', fontStyle: 'italic' }}>
            &ldquo;I used stAIrcode on a listing inspection and flagged a riser height violation in under 2 minutes. The report was in my inbox before I left the property. This is exactly what agents need.&rdquo;
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#27A96B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>J</div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#E8F4FF' }}>Jordan M.</div>
              <div style={{ fontSize: '0.65rem', color: '#93BAD4' }}>Real Estate Agent · Toronto, ON · Beta Tester</div>
            </div>
            <div style={{ marginLeft: 'auto', color: '#FA741F', fontSize: '0.85rem' }}>★★★★★</div>
          </div>
        </div>
      </div>

      {/* Sign-in card */}
      <div style={{ width: '100%', maxWidth: 420, padding: '1.75rem 1.5rem 0' }}>
        <div style={{ background: '#0F2438', border: '1px solid rgba(65,124,164,0.25)',
          borderRadius: 20, padding: '1.5rem 1.4rem', marginBottom: '1.5rem',
          boxShadow: '0 4px 30px rgba(0,0,0,0.3)' }}>

          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#E8F4FF', marginBottom: '0.3rem' }}>
              Create your free account
            </div>
            <div style={{ fontSize: '0.78rem', color: '#93BAD4', lineHeight: 1.5 }}>
              Enter your email — we&apos;ll send a 6-digit code to sign you in. No password needed.
              Your account saves your scan history and reports across devices.
            </div>
          </div>

          <input
            id="email-address"
            name="email"
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="your@email.com"
            value={contact}
            onChange={e => { setContact(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            autoFocus
            style={{
              background: 'rgba(65,124,164,0.1)',
              border: `1.5px solid ${error ? '#E85555' : 'rgba(65,124,164,0.3)'}`,
              borderRadius: 12, padding: '0.9rem 1rem',
              color: '#E8F4FF', fontSize: '1rem', outline: 'none',
              width: '100%', boxSizing: 'border-box' as const,
              fontFamily: 'inherit', marginBottom: '0.75rem',
            }}
          />

          {error && (
            <div style={{ fontSize: '0.74rem', color: '#ff8080',
              background: 'rgba(232,85,85,0.1)', border: '1px solid rgba(232,85,85,0.25)',
              borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>{error}</div>
          )}

          <button
            onClick={handleSend}
            disabled={loading || !contact.trim()}
            style={{
              width: '100%', padding: '1rem', border: 'none', borderRadius: 12,
              fontSize: '1rem', fontWeight: 800, letterSpacing: '0.04em', cursor: 'pointer',
              color: '#fff',
              background: !contact.trim() ? 'rgba(65,124,164,0.2)' : 'linear-gradient(135deg,#FA741F,#C4721E)',
              boxShadow: contact.trim() ? '0 4px 20px rgba(250,116,31,0.45)' : 'none',
              transition: 'all 0.2s',
              marginBottom: '0.75rem',
            }}
          >
            {sending ? 'Sending…' : 'Get free access →'}
          </button>

          <div style={{ fontSize: '0.68rem', color: '#5E7D9B', textAlign: 'center', lineHeight: 1.6 }}>
            Already have an account? Enter the same email — you&apos;ll get a new code to sign back in.
            Your previous scans and reports will be waiting.
          </div>
        </div>

        {/* Beta tester access */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.6rem', color: '#FA741F', letterSpacing: '0.18em',
            fontFamily: 'monospace', fontWeight: 700, marginBottom: '0.6rem' }}>🚧 BETA TESTING IN PROGRESS</div>
          <button
            onClick={() => {
              const guest: AppUser = { email: 'beta@staircode.app', name: 'Beta Tester', provider: 'otp', membership: 'free', units: 'mm' }
              save(guest)
              identifyUser(guest.email, { membership: 'free', method: 'beta' })
              Analytics.userSignedIn('beta')
              onAuth(guest)
            }}
            style={{
              padding: '0.8rem 2rem', background: 'rgba(65,124,164,0.15)',
              border: '1px solid rgba(65,124,164,0.3)', borderRadius: 12, color: '#93BAD4',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
            }}
          >
            Continue without signing in
          </button>
          <div style={{ fontSize: '0.62rem', color: '#3A5A78', marginTop: '0.4rem' }}>
            Reports won&apos;t be saved to your account
          </div>
        </div>

        {/* Safety stats section */}
        <div style={{ background: 'rgba(232,85,85,0.06)', border: '1px solid rgba(232,85,85,0.2)',
          borderRadius: 18, padding: '1.25rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#E84545',
            fontFamily: 'monospace', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>
            ⚠ WHY STAIR COMPLIANCE MATTERS
          </div>
          {[
            { stat: '1,800+', text: 'emergency department visits per day in Canada from unintentional falls¹' },
            { stat: '20%', text: 'of fall-related hospitalizations among seniors caused by stair falls in Canada¹' },
            { stat: '50%+', text: 'increase in trip risk from riser height inconsistency greater than 3/8 inch²' },
            { stat: '$92B', text: 'annual direct medical costs of non-fatal stair injuries in the US²' },
          ].map(({ stat, text }) => (
            <div key={stat} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.65rem', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#E84545',
                fontFamily: 'monospace', flexShrink: 0, minWidth: 60, lineHeight: 1.2 }}>{stat}</div>
              <div style={{ fontSize: '0.75rem', color: '#93BAD4', lineHeight: 1.55 }}>{text}</div>
            </div>
          ))}
          <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.75rem',
            background: 'rgba(10,28,46,0.5)', borderRadius: 10 }}>
            <div style={{ fontSize: '0.78rem', color: '#E8F4FF', lineHeight: 1.6, fontWeight: 500 }}>
              Non-compliant stairs injure and kill people every day. The regulatory requirement to
              check stairs against building codes is real. stAIrcode closes the gap between
              &ldquo;I have stairs&rdquo; and &ldquo;I know they&apos;re compliant.&rdquo;
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.58rem', color: '#3A5A78', lineHeight: 1.6 }}>
            ¹ Canadian Institute for Health Information · Global News Canada (2018)<br/>
            ² Gitnux Stair Injury Statistics Report (2025) · US National Safety Council
          </div>
        </div>

        {/* Report preview */}
        <div style={{ background: '#0F2438', border: '1px solid rgba(65,124,164,0.25)',
          borderRadius: 18, padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#5BA3D0',
            fontFamily: 'monospace', letterSpacing: '0.12em', marginBottom: '0.85rem' }}>
            📋 WHAT YOU GET
          </div>
          {[
            { icon: '✅', label: 'Full compliance report', sub: 'Riser, tread, width, handrail — checked against OBC, NBC, IBC and more' },
            { icon: '📧', label: 'Emailed as PDF instantly', sub: 'Report arrives in your inbox before you leave the property' },
            { icon: '📍', label: 'Auto-detected jurisdiction', sub: 'Ontario OBC, Quebec QBC, BC, National NBC, USA IBC, and more' },
            { icon: '⏱', label: 'Under 90 seconds', sub: 'Camera-based AR + AI measurement — no tape measure needed' },
          ].map(({ icon, label, sub }) => (
            <div key={label} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.85rem', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '1.1rem', flexShrink: 0, width: 24 }}>{icon}</div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E8F4FF', marginBottom: '0.15rem' }}>{label}</div>
                <div style={{ fontSize: '0.7rem', color: '#5E7D9B', lineHeight: 1.5 }}>{sub}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: '0.5rem', background: 'rgba(39,169,107,0.1)',
            border: '1px solid rgba(39,169,107,0.25)', borderRadius: 12, padding: '0.65rem 0.85rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#93BAD4' }}>Report price</div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#27A96B' }}>
                FREE during beta
                <span style={{ fontSize: '0.65rem', color: '#5E7D9B', fontWeight: 400, marginLeft: '0.4rem' }}>normally $2.99</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#93BAD4' }}>Pro plan</div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#5BA3D0' }}>
                $12.99<span style={{ fontSize: '0.65rem', fontWeight: 400 }}>/mo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontSize: '0.62rem', color: '#3A5A78', textAlign: 'center',
          lineHeight: 1.7, margin: '0 0 0.5rem' }}>
          By continuing you agree to our{" "}
          <a href="/terms" style={{ color: '#FA741F', textDecoration: 'underline' }}>Terms of Service</a>
          {" "}and{" "}
          <a href="/privacy" style={{ color: '#FA741F', textDecoration: 'underline' }}>Privacy Policy</a>.
          <br/>
          stAIrcode is a pre-assessment tool. Always confirm with a qualified building inspector.
        </p>
      </div>
    </div>
  )

  // ── OTP verification screen ───────────────────────────────────────────────────
  return (
    <div style={wrap}>
      {logo}

      <div style={{ textAlign: 'center', marginBottom: '1.6rem' }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Check your email
        </div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(28,64,88,0.55)', marginTop: '0.4rem', maxWidth: 280, margin: '0.4rem auto 0', lineHeight: 1.5 }}>
          We sent a 6-digit code to<br />
          <strong style={{ color: '#0A1C2E' }}>{contact}</strong>
        </div>
      </div>

      <div style={card}>
        {/* 6-digit input boxes */}
        <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'center' }}>
          {digits.map((d, i) => (
            <input
              key={i}
              id={`otp-digit-${i}`}
              name={`otp-digit-${i}`}
              ref={el => { refs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={d}
              onChange={e => onDigitChange(i, e.target.value)}
              onKeyDown={e => onDigitKey(i, e)}
              onFocus={e => e.target.select()}
              style={{
                width: 44, height: 54,
                background: 'rgba(44,90,122,0.08)',
                border: `1.5px solid ${d ? C.blue : C.border}`,
                borderRadius: 12,
                color: '#0A1C2E',
                fontSize: '1.5rem',
                fontWeight: 700,
                textAlign: 'center',
                outline: 'none',
                transition: 'border-color 0.15s',
                caretColor: '#F29337',
              }}
            />
          ))}
        </div>

        {/* Loading indicator */}
        {loading && (
          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'rgba(28,64,88,0.55)' }}>
            Verifying…
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            fontSize: '0.74rem', color: '#ff8080',
            background: 'rgba(232,85,85,0.08)',
            border: '1px solid rgba(232,85,85,0.2)',
            borderRadius: 8, padding: '0.5rem 0.75rem',
            textAlign: 'center',
          }}>{error}</div>
        )}

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={loading || digits.join('').length < 6}
          style={{
            width: '100%', padding: '1rem', border: 'none', borderRadius: 14,
            fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.04em',
            cursor: loading || digits.join('').length < 6 ? 'not-allowed' : 'pointer',
            color: loading || digits.join('').length < 6 ? 'rgba(28,64,88,0.4)' : '#fff',
            background: loading || digits.join('').length < 6
              ? 'rgba(44,90,122,0.08)'
              : `linear-gradient(135deg,#F29337,#C4721E)`,
            boxShadow: digits.join('').length === 6 ? '0 4px 20px rgba(65,124,164,0.4)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Verifying…' : 'Verify →'}
        </button>

        {/* Change / Resend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
          <button
            onClick={() => { setScreen('entry'); setError(''); setDigits(['', '', '', '', '', '']) }}
            style={{ background: 'none', border: 'none', color: 'rgba(28,64,88,0.55)', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            ← Change
          </button>
          {resent
            ? <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>✓ Code sent</span>
            : <button
                onClick={handleResend}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: C.ink2, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
              >
                Resend code
              </button>
          }
        </div>

        {/* Hint */}
        <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(28,64,88,0.4)', textAlign: 'center', lineHeight: 1.6 }}>
          <span style={{ color: '#1A3A5C', fontWeight: 600 }}>Check your spam folder</span><span style={{ color: 'rgba(44,74,100,0.5)' }}> if you don't see it within 60 seconds.</span>
        </p>
      </div>
    </div>
  )
}
