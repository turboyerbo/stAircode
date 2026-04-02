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

  // ── Entry screen ──────────────────────────────────────────────────────────────
  if (screen === 'entry') return (
    <div style={wrap}>
      {logo}

      {/* Safety stripe — signature brand cue */}
      <div style={{ width:'100%', maxWidth:360, height:5, borderRadius:'2px 2px 0 0', background:'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)', backgroundSize:'20px 20px', marginBottom:0 }} />

      <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Sign in</div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(28,64,88,0.55)', marginTop: '0.3rem' }}>
          Enter your email to continue
        </div>
      </div>

      <div style={card}>
        {/* Email / phone input */}
        <input
          id="email-address"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          placeholder="Email address"
          value={contact}
          onChange={e => { setContact(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          autoFocus
          style={{
            background: 'rgba(44,90,122,0.08)',
            border: `1.5px solid ${error ? '#E85555' : C.border}`,
            borderRadius: 14,
            padding: '0.95rem 1.1rem',
            color: '#0A1C2E',
            fontSize: '1rem',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box' as const,
            fontFamily: 'inherit',
            transition: 'border-color 0.2s',
          }}
        />

        {/* Phone format hint */}
        {contact.trim() && !contact.includes('@') && (
          <div style={{ fontSize: '0.68rem', color: 'rgba(28,64,88,0.45)', marginTop: '-0.5rem' }}>
            </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            fontSize: '0.74rem', color: '#ff8080',
            background: 'rgba(232,85,85,0.08)',
            border: '1px solid rgba(232,85,85,0.2)',
            borderRadius: 8, padding: '0.5rem 0.75rem',
          }}>{error}</div>
        )}

        {/* Send code button */}
        <button
          onClick={handleSend}
          disabled={loading || !contact.trim()}
          style={{
            width: '100%', padding: '1rem', border: 'none', borderRadius: 14,
            fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.04em',
            cursor: loading || !contact.trim() ? 'not-allowed' : 'pointer',
            color: loading || !contact.trim() ? 'rgba(28,64,88,0.4)' : '#fff',
            background: loading || !contact.trim()
              ? 'rgba(44,90,122,0.08)'
              : `linear-gradient(135deg,#F29337,#C4721E)`,
            boxShadow: !loading && contact.trim() ? '0 4px 20px rgba(65,124,164,0.4)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {sending ? 'Sending…' : 'Send code →'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: '0.7rem', color: 'rgba(28,64,88,0.55)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>


      </div>

      {/* Beta skip */}
      <div style={{ marginTop: '1.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ height: 1, width: 40, background: 'rgba(44,90,122,0.09)' }} />
          <span style={{ fontSize: '0.65rem', color: '#F29337', letterSpacing: '0.14em', fontFamily: 'monospace', fontWeight: 700 }}>🚧 BETA TESTING</span>
          <div style={{ height: 1, width: 40, background: 'rgba(44,90,122,0.09)' }} />
        </div>
        <button
          onClick={() => {
            const guest: AppUser = { email: 'beta@staircode.app', name: 'Beta Tester', provider: 'otp', membership: 'free', units: 'mm' }
            save(guest)
            identifyUser(guest.email, { membership: 'free', method: 'beta' })
            Analytics.userSignedIn('beta')
            onAuth(guest)
          }}
          style={{
            padding: '0.9rem 2.8rem',
            background: 'linear-gradient(135deg,#1565C0,#0D47A1)',
            border: 'none', borderRadius: 14, color: '#ffffff',
            fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
            letterSpacing: '0.06em',
            boxShadow: '0 6px 24px rgba(44,90,122,0.38)',
          }}
        >
          START →
        </button>
        <span style={{ fontSize: '0.62rem', color: 'rgba(44,90,122,0.3)' }}>Skip sign-in for now</span>
      </div>

      {/* Store badges */}
      <div style={{ marginTop: '1.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', width: '100%', maxWidth: 320 }}>
        <div style={{ fontSize: '0.6rem', color: 'rgba(44,90,122,0.3)', letterSpacing: '0.12em', fontFamily: 'monospace' }}>AVAILABLE ON</div>
        <div style={{ display: 'flex', gap: '0.6rem', width: '100%' }}>
          {/* Google Play */}
          <a
            href="https://play.google.com/store/apps/details?id=app.staircode.android"
            target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', background: 'rgba(44,90,122,0.07)', border: '1.5px solid rgba(44,90,122,0.18)', borderRadius: 14, padding: '0.75rem 0.6rem', textDecoration: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M3.18 23.76c.3.17.64.24.99.21l11.87-11.88L12.59 8.6 3.18 23.76z"/><path fill="#EA4335" d="M20.6 10.27l-2.79-1.6-3.43 3.43 3.43 3.43 2.82-1.62c.8-.46.8-1.18-.03-1.64z"/><path fill="#FBBC05" d="M3.18.24C2.83.53 2.6 1.03 2.6 1.7v20.6c0 .67.23 1.17.58 1.46l.09.08 11.54-11.54v-.27L3.27.16l-.09.08z"/><path fill="#34A853" d="M16.04 12.09l-3.43-3.43-9.43 9.43c.38.4.98.44 1.64.08l11.22-6.08z"/></svg>
              <div>
                <div style={{ fontSize: '0.55rem', color: 'rgba(28,64,88,0.55)', lineHeight: 1 }}>GET IT ON</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0A1C2E', lineHeight: 1.2 }}>Google Play</div>
              </div>
            </div>
            <div style={{ fontSize: '0.56rem', fontFamily: 'monospace', color: 'rgba(44,90,122,0.6)', background: 'rgba(44,90,122,0.1)', borderRadius: 6, padding: '0.18rem 0.5rem', letterSpacing: '0.06em' }}>LAUNCHING APRIL</div>
          </a>
          {/* App Store */}
          <a
            href="https://apps.apple.com/app/staircode/id6744870260"
            target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', background: 'rgba(44,90,122,0.07)', border: '1.5px solid rgba(44,90,122,0.18)', borderRadius: 14, padding: '0.75rem 0.6rem', textDecoration: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#555"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <div>
                <div style={{ fontSize: '0.55rem', color: 'rgba(28,64,88,0.55)', lineHeight: 1 }}>DOWNLOAD ON THE</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0A1C2E', lineHeight: 1.2 }}>App Store</div>
              </div>
            </div>
            <div style={{ fontSize: '0.56rem', fontFamily: 'monospace', color: 'rgba(44,90,122,0.6)', background: 'rgba(44,90,122,0.1)', borderRadius: 6, padding: '0.18rem 0.5rem', letterSpacing: '0.06em' }}>LAUNCHING MAY</div>
          </a>
        </div>
        <p style={{ fontSize: '0.62rem', color: '#2C5A7A', textAlign: 'center', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
          Currently in beta · Web version available now
        </p>
      </div>

      <p style={{ fontSize: '0.62rem', color: '#2C4A68', textAlign: 'center', marginTop: '0.75rem', lineHeight: 1.7, maxWidth: 300 }}>
        By continuing you agree to our{' '}
        <a href="/terms" style={{ color: '#F29337', fontWeight: 600, textDecoration: 'underline' }}>Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy" style={{ color: '#F29337', fontWeight: 600, textDecoration: 'underline' }}>Privacy Policy</a>.
      </p>
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
          <span style={{ color: '#1A3A5C', fontWeight: 600 }}>Check your spam folder</span><span style={{ color: 'rgba(44,74,100,0.5)' }}> if you don&apos;t see it within 60 seconds.</span>
        </p>
      </div>
    </div>
  )
}
