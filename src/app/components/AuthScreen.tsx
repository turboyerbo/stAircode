'use client'
/**
 * AuthScreen.tsx — stAIrcode
 *
 * Auth flow:
 *  PRIMARY   — Google, Apple, Facebook (OAuth via Supabase)
 *  SECONDARY — Email OTP (for users without social accounts)
 *
 * The "Start / skip sign-in" beta button has been removed.
 * All users must authenticate before accessing the app.
 *
 * Supabase setup required (see SETUP.md):
 *   Authentication → Providers → Enable Google, Apple, Facebook
 *   Redirect URL: https://staircode.app
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import React from 'react'
import { getSupabase } from '@/lib/supabase-client'
import { Analytics, identifyUser } from '@/lib/analytics'

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = 'architect' | 'building_manager' | 'contractor' | 'diy' | 'realestate'
export interface AppUser {
  email:      string
  name:       string
  provider:   'otp' | 'google' | 'apple' | 'facebook'
  membership: 'free' | 'pro' | 'enterprise'
  units:      'mm' | 'ft'
  role?:      UserRole
}
interface Props { onAuth: (user: AppUser) => void }
type Screen = 'entry' | 'otp'

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  bg:      '#E8F4FF',
  navy:    '#0A1C2E',
  navy2:   '#2C4A68',
  navy3:   '#5E7D9B',
  orange:  '#F29337',
  blue:    '#417CA4',
  border:  'rgba(65,124,164,0.18)',
  cardBg:  'rgba(44,90,122,0.05)',
}

// ── Phone normaliser ──────────────────────────────────────────────────────────
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (raw.trim().startsWith('+')) return raw.trim()
  return `+${digits}`
}
function isPhone(s: string) { return !s.includes('@') }

// ── OTP helpers ───────────────────────────────────────────────────────────────
async function sendOtp(contact: string) {
  const sb = getSupabase()
  if (!sb) { await new Promise(r => setTimeout(r, 800)); return }
  const err = isPhone(contact)
    ? (await sb.auth.signInWithOtp({ phone: normalisePhone(contact) })).error
    : (await sb.auth.signInWithOtp({ email: contact, options: { shouldCreateUser: true } })).error
  if (err) throw new Error(err.message)
}

async function verifyOtp(contact: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase()
  if (!sb) { await new Promise(r => setTimeout(r, 700)); return { ok: true } }
  const { error } = isPhone(contact)
    ? await sb.auth.verifyOtp({ phone: normalisePhone(contact), token: code, type: 'sms' })
    : await sb.auth.verifyOtp({ email: contact, token: code, type: 'email' })
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AuthScreen({ onAuth }: Props) {
  const [screen,   setScreen]   = useState<Screen>('entry')
  const [contact,  setContact]  = useState('')
  const [digits,   setDigits]   = useState(['', '', '', '', '', ''])
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sending,  setSending]  = useState(false)
  const [resent,   setResent]   = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (screen === 'otp') setTimeout(() => refs.current[0]?.focus(), 150)
  }, [screen])

  useEffect(() => {
    if (digits.join('').length === 6 && screen === 'otp' && !loading) handleVerify()
  }, [digits]) // eslint-disable-line

  function save(u: AppUser) {
    try { localStorage.setItem('sc_user', JSON.stringify(u)) } catch {}
  }

  // ── OAuth ─────────────────────────────────────────────────────────────────
  async function handleOAuth(provider: 'google' | 'apple' | 'facebook') {
    setError('')
    setLoading(true)
    const sb = getSupabase()
    if (!sb) {
      // Dev stub
      const u: AppUser = {
        email: `user@${provider}.com`,
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
        provider,
        membership: 'free',
        units: 'mm',
      }
      save(u); onAuth(u); return
    }
    try {
      const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}/?signin=1`
            : 'https://staircode.app/?signin=1',
        },
      })
      if (error) throw error
      // Redirects away — session restored on return via page.tsx useEffect
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed. Try email instead.')
      setLoading(false)
    }
  }

  // ── Email OTP ─────────────────────────────────────────────────────────────
  async function handleSend() {
    setError('')
    const c = contact.trim()
    if (!c) { setError('Enter your email address.'); return }
    if (!c.includes('@') || !c.includes('.')) { setError('Enter a valid email address.'); return }
    setSending(true); setLoading(true)
    try {
      await sendOtp(c)
      setScreen('otp')
      setDigits(['', '', '', '', '', ''])
      setResent(false)
    } catch (err: any) {
      const msg = (err?.message ?? '') as string
      setError(
        msg.includes('fetch') || msg.includes('network') ? 'Could not reach auth server. Check your connection.' :
        msg.includes('rate') || msg.includes('limit')    ? 'Too many attempts. Wait a minute and try again.' :
        msg || 'Could not send code. Try again.'
      )
    } finally { setSending(false); setLoading(false) }
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    const code = digits.join('')
    if (code.length < 6) return
    setError(''); setLoading(true)
    try {
      const result = await verifyOtp(contact.trim(), code)
      if (!result.ok) {
        const msg = result.error ?? ''
        setError(
          msg.includes('expired')                          ? 'Code expired. Tap "Resend code".' :
          msg.includes('invalid') || msg.includes('incorrect') ? 'Incorrect code. Try again.' :
          msg || 'Incorrect code. Try again.'
        )
        setDigits(['', '', '', '', '', ''])
        setTimeout(() => refs.current[0]?.focus(), 80)
        return
      }
      const u: AppUser = {
        email: contact.trim(),
        name:  contact.trim().split('@')[0],
        provider: 'otp',
        membership: 'free',
        units: 'mm',
      }
      save(u)
      identifyUser(u.email, { membership: 'free', method: 'otp' })
      Analytics.userSignedIn('otp')
      if (contact.trim().includes('@') && !localStorage.getItem('sc_welcomed')) {
        fetch('/api/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: contact.trim(), name: u.name }),
        }).then(() => { try { localStorage.setItem('sc_welcomed', '1') } catch {} }).catch(() => {})
      }
      onAuth(u)
    } catch (err: any) {
      setError(err?.message ?? 'Verification failed. Please try again.')
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => refs.current[0]?.focus(), 80)
    } finally { setLoading(false) }
  }, [digits, contact, onAuth])

  async function handleResend() {
    setError(''); setResent(false)
    try {
      await sendOtp(contact.trim())
      setResent(true)
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => refs.current[0]?.focus(), 100)
      setTimeout(() => setResent(false), 4000)
    } catch (err: any) { setError(err?.message ?? 'Could not resend.') }
  }

  function onDigitChange(i: number, val: string) {
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, '').slice(0, 6)
      const next = ['', '', '', '', '', '']
      for (let k = 0; k < 6; k++) next[k] = pasted[k] ?? ''
      setDigits(next)
      refs.current[Math.min(pasted.length, 5)]?.focus()
      return
    }
    const d = val.replace(/\D/g, '')
    const next = [...digits]; next[i] = d; setDigits(next)
    if (d && i < 5) refs.current[i + 1]?.focus()
  }

  function onDigitKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) { const n = [...digits]; n[i] = ''; setDigits(n) }
      else if (i > 0) { const n = [...digits]; n[i - 1] = ''; setDigits(n); refs.current[i - 1]?.focus() }
    }
    if (e.key === 'Enter' && digits.join('').length === 6) handleVerify()
    if (e.key === 'ArrowLeft'  && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const wrap: React.CSSProperties = {
    minHeight: '100dvh', background: C.bg,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '2rem 1.5rem',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    color: C.navy, overflowY: 'auto',
  }

  const errBox = error ? (
    <div style={{
      fontSize: '0.74rem', color: '#ff8080',
      background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.2)',
      borderRadius: 8, padding: '0.5rem 0.75rem', textAlign: 'center',
    }}>{error}</div>
  ) : null

  // ── OTP verification screen ───────────────────────────────────────────────
  if (screen === 'otp') return (
    <div style={wrap}>
      {/* Safety stripe */}
      <div style={{ width: '100%', maxWidth: 360, height: 5, borderRadius: '2px 2px 0 0', background: 'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)', marginBottom: 0 }} />

      <div style={{ textAlign: 'center', margin: '1.5rem 0 1.2rem' }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Check your email</div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(28,64,88,0.55)', marginTop: '0.4rem', lineHeight: 1.5 }}>
          We sent a 6-digit code to<br />
          <strong style={{ color: C.navy }}>{contact}</strong>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 360, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 24, padding: '2rem 1.6rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'center' }}>
          {digits.map((d, i) => (
            <input
              key={i} ref={el => { refs.current[i] = el }}
              type="text" inputMode="numeric" maxLength={6} value={d}
              onChange={e => onDigitChange(i, e.target.value)}
              onKeyDown={e => onDigitKey(i, e)}
              onFocus={e => e.target.select()}
              style={{
                width: 44, height: 54,
                background: 'rgba(44,90,122,0.08)',
                border: `1.5px solid ${d ? C.blue : C.border}`,
                borderRadius: 12, color: C.navy,
                fontSize: '1.5rem', fontWeight: 700, textAlign: 'center',
                outline: 'none', caretColor: C.orange,
              }}
            />
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'rgba(28,64,88,0.55)' }}>Verifying…</div>}
        {errBox}

        <button
          onClick={handleVerify}
          disabled={loading || digits.join('').length < 6}
          style={{
            width: '100%', padding: '1rem', border: 'none', borderRadius: 14,
            fontSize: '0.95rem', fontWeight: 700, cursor: loading || digits.join('').length < 6 ? 'not-allowed' : 'pointer',
            color: digits.join('').length < 6 ? 'rgba(28,64,88,0.4)' : '#fff',
            background: digits.join('').length < 6 ? 'rgba(44,90,122,0.08)' : `linear-gradient(135deg,${C.orange},#C4721E)`,
            boxShadow: digits.join('').length === 6 ? '0 4px 20px rgba(65,124,164,0.4)' : 'none',
          }}
        >
          {loading ? 'Verifying…' : 'Verify →'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          <button onClick={() => { setScreen('entry'); setError(''); setDigits(['', '', '', '', '', '']) }}
            style={{ background: 'none', border: 'none', color: 'rgba(28,64,88,0.55)', cursor: 'pointer' }}>
            ← Back
          </button>
          {resent
            ? <span style={{ color: '#4ade80' }}>✓ Code sent</span>
            : <button onClick={handleResend} disabled={loading}
                style={{ background: 'none', border: 'none', color: C.navy2, cursor: 'pointer', fontWeight: 600 }}>
                Resend code
              </button>
          }
        </div>

        <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(28,64,88,0.4)', textAlign: 'center', lineHeight: 1.6 }}>
          <strong style={{ color: '#1A3A5C' }}>Check your spam folder</strong> if you don&apos;t see it within 60 seconds.
        </p>
      </div>
    </div>
  )

  // ── Entry screen ─────────────────────────────────────────────────────────
  return (
    <div style={wrap}>
      {/* Safety stripe */}
      <div style={{ width: '100%', maxWidth: 380, height: 5, borderRadius: '2px 2px 0 0', background: 'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)' }} />

      {/* Header */}
      <div style={{ textAlign: 'center', margin: '1.6rem 0 1.2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#F29337', color: '#fff', fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.14em', padding: '0.2rem 0.65rem', borderRadius: 20, marginBottom: '0.6rem' }}>BETA</div>
        <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          st<span style={{ color: C.orange }}>AI</span>rcode
        </div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(28,64,88,0.5)', marginTop: '0.35rem' }}>
          Sign in to check your stairs
        </div>
      </div>

      {/* Main card */}
      <div style={{ width: '100%', maxWidth: 380, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 24, padding: '1.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/* Google */}
        <button
          onClick={() => handleOAuth('google')}
          disabled={loading}
          style={{
            width: '100%', padding: '0.85rem 1rem',
            background: '#fff', border: '1.5px solid #E0E0E0',
            borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            fontSize: '0.95rem', fontWeight: 600, color: '#1F1F1F',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            transition: 'box-shadow 0.15s',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Apple — hidden until Apple Sign In is configured */}
        {false && (
        <button
          onClick={() => handleOAuth('apple')}
          disabled={loading}
          style={{
            width: '100%', padding: '0.85rem 1rem',
            background: '#000', border: '1.5px solid #000',
            borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            fontSize: '0.95rem', fontWeight: 600, color: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <svg width="18" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Continue with Apple
        </button>
        )}

        {/* Facebook — hidden until configured */}
        {false && <button
          onClick={() => handleOAuth('facebook')}
          disabled={loading}
          style={{
            width: '100%', padding: '0.85rem 1rem',
            background: '#1877F2', border: '1.5px solid #1877F2',
            borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            fontSize: '0.95rem', fontWeight: 600, color: '#fff',
            boxShadow: '0 1px 4px rgba(24,119,242,0.3)',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Continue with Facebook
        </button>}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: '0.72rem', color: C.navy3, letterSpacing: '0.06em' }}>or use email</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        {/* Email toggle / input */}
        {!showEmail ? (
          <button
            onClick={() => setShowEmail(true)}
            style={{
              width: '100%', padding: '0.8rem',
              background: 'transparent', border: `1.5px solid ${C.border}`,
              borderRadius: 14, cursor: 'pointer',
              fontSize: '0.9rem', color: C.navy2, fontWeight: 500,
            }}
          >
            Continue with Email →
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <input
              type="text" inputMode="email" autoComplete="username"
              placeholder="Email address"
              value={contact} autoFocus
              onChange={e => { setContact(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              style={{
                background: 'rgba(44,90,122,0.08)',
                border: `1.5px solid ${error ? '#E85555' : C.border}`,
                borderRadius: 14, padding: '0.9rem 1rem',
                color: C.navy, fontSize: '1rem', outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
            {errBox}
            <button
              onClick={handleSend}
              disabled={loading || !contact.trim()}
              style={{
                width: '100%', padding: '0.9rem', border: 'none', borderRadius: 14,
                fontSize: '0.9rem', fontWeight: 700,
                cursor: loading || !contact.trim() ? 'not-allowed' : 'pointer',
                color: !contact.trim() ? 'rgba(28,64,88,0.4)' : '#fff',
                background: !contact.trim() ? 'rgba(44,90,122,0.08)' : `linear-gradient(135deg,${C.orange},#C4721E)`,
              }}
            >
              {sending ? 'Sending…' : 'Send code →'}
            </button>
          </div>
        )}

        {/* Error (OAuth errors) */}
        {error && !showEmail && errBox}
      </div>

      {/* Store badges */}
      <div style={{ marginTop: '1.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: '0.58rem', color: 'rgba(44,90,122,0.35)', letterSpacing: '0.12em', fontFamily: 'monospace' }}>AVAILABLE ON</div>
        <div style={{ display: 'flex', gap: '0.65rem', width: '100%' }}>

          {/* Google Play */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <a href="https://play.google.com/store/apps/details?id=app.staircode.android&pcampaignid=web_share" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', background: '#000', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '0.7rem 0.75rem', textDecoration: 'none' }}>
              <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0.5 1.33L11.14 11L0.5 20.67V1.33Z" fill="#4285F4"/>
                <path d="M14.5 7.5L2.5 0.5L11.14 11L14.5 7.5Z" fill="#34A853"/>
                <path d="M14.5 14.5L11.14 11L2.5 21.5L14.5 14.5Z" fill="#FBBC04"/>
                <path d="M19.5 11C19.5 10.17 19.07 9.43 18.41 9L14.5 7.5L11.14 11L14.5 14.5L18.41 13C19.07 12.57 19.5 11.83 19.5 11Z" fill="#EA4335"/>
              </svg>
              <div>
                <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1, letterSpacing: '0.04em' }}>GET IT ON</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', lineHeight: 1.25, letterSpacing: '-0.01em' }}>Google Play</div>
              </div>
            </a>
            <div style={{ fontSize: '0.58rem', color: 'rgba(44,90,122,0.6)', textAlign: 'center', lineHeight: 1.4, fontStyle: 'italic' }}>
              Android beta — available now
            </div>
          </div>

          {/* App Store */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <a href="https://apps.apple.com/app/staircode/id6744870260" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', background: '#000', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '0.7rem 0.75rem', textDecoration: 'none' }}>
              <svg width="18" height="22" viewBox="0 0 18 22" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.93 11.62c-.02-2.45 2-3.63 2.09-3.69-1.14-1.67-2.91-1.9-3.54-1.93-1.51-.15-2.96.89-3.73.89-.78 0-1.97-.87-3.24-.85C4.79 6.07 3.2 7 2.35 8.43.59 11.33 1.89 15.63 3.59 18c.85 1.17 1.85 2.48 3.16 2.43 1.27-.05 1.75-.82 3.28-.82s1.97.82 3.3.79c1.36-.02 2.22-1.19 3.05-2.37.97-1.36 1.36-2.69 1.38-2.76-.03-.01-2.64-1.01-2.67-4.02l.04.37zM12.51 3.91c.7-.86 1.17-2.05 1.04-3.25-1.01.04-2.23.67-2.95 1.52-.65.74-1.22 1.94-1.07 3.08 1.13.09 2.28-.58 2.98-1.35z"/>
              </svg>
              <div>
                <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1, letterSpacing: '0.04em' }}>DOWNLOAD ON THE</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', lineHeight: 1.25, letterSpacing: '-0.01em' }}>App Store</div>
              </div>
            </a>
            <div style={{ fontSize: '0.58rem', color: 'rgba(44,90,122,0.6)', textAlign: 'center', lineHeight: 1.4, fontStyle: 'italic' }}>
              iOS — launching June 2025
            </div>
          </div>

        </div>
      </div>

      {/* Instagram + Facebook — proper brand logos */}
      <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1rem', justifyContent: 'center' }}>

        {/* Instagram — gradient background with camera SVG */}
        <a href="https://www.instagram.com/staircode/" target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', borderRadius: 12, textDecoration: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>
          {/* Official Instagram camera icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="white" strokeWidth="2"/>
            <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="2"/>
            <circle cx="17.5" cy="6.5" r="1" fill="white"/>
          </svg>
          <span>Instagram</span>
        </a>

        {/* Facebook — official blue with f logo */}
        <a href="https://www.facebook.com/people/Staircode/61589350702805/" target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#1877F2', borderRadius: 12, textDecoration: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>
          {/* Official Facebook f logo */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span>Facebook</span>
        </a>
      </div>

      <p style={{ fontSize: '0.6rem', color: C.navy2, textAlign: 'center', marginTop: '0.75rem', lineHeight: 1.7, maxWidth: 300 }}>
        By continuing you agree to our{' '}
        <a href="/terms" style={{ color: C.orange, fontWeight: 600 }}>Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy" style={{ color: C.orange, fontWeight: 600 }}>Privacy Policy</a>.
      </p>
    </div>
  )
}
