'use client'
/**
 * MemberLoginScreen.tsx
 *
 * Shown when:
 *  - User clicks "Sign In" on the marketing page (returning member)
 *  - User signs out (direct return to this screen, not marketing)
 *
 * Purpose: authenticate a returning member as fast as possible.
 * No upsell, no pricing, no stair demo — just "welcome back, sign in".
 *
 * New users are sent to /marketing first, which has the pricing/demo path.
 */

import { useState, useRef, useEffect } from 'react'
import type { AppUser, UserRole }       from './AuthScreen'
import { getSupabase }                  from '@/lib/supabase-client'

interface Props {
  onAuth:          (user: AppUser) => void
  onNotAMember?:   () => void   // link to marketing/pricing
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const BG     = '#F0F4F8'
const BORDER = 'rgba(44,90,122,0.15)'

export default function MemberLoginScreen({ onAuth, onNotAMember }: Props) {
  const [step,     setStep]     = useState<'entry' | 'otp'>('entry')
  const [email,    setEmail]    = useState('')
  const [digits,   setDigits]   = useState(['','','','','',''])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (step === 'otp') setTimeout(() => refs.current[0]?.focus(), 150)
  }, [step])

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (digits.join('').length === 6 && step === 'otp' && !loading) handleVerify()
  }, [digits]) // eslint-disable-line

  function buildUser(sbUser: any): AppUser {
    const e = sbUser.email ?? sbUser.phone ?? ''
    // Preserve existing membership from localStorage
    let membership: AppUser['membership'] = 'free'
    try {
      const stored = localStorage.getItem('sc_user')
      if (stored) {
        const prev = JSON.parse(stored)
        if (prev?.email === e && prev?.membership && prev.membership !== 'free') {
          membership = prev.membership
        }
      }
      if (localStorage.getItem('sc_beta_access') === '1') membership = 'subscription' as any
    } catch {}
    return {
      email:      e,
      name:       sbUser.user_metadata?.full_name ?? e.split('@')[0] ?? 'User',
      provider:   (sbUser.app_metadata?.provider ?? 'otp') as AppUser['provider'],
      membership,
      units:      'mm',
      role:       'diy' as UserRole,
    }
  }

  async function handleGoogle() {
    setError(''); setLoading(true)
    const sb = getSupabase()
    if (!sb) { setError('Auth not configured'); setLoading(false); return }
    const { error: oauthErr } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${window.location.origin}/?signin=1&goto=projects` },
    })
    if (oauthErr) { setError(oauthErr.message); setLoading(false) }
  }

  async function handleSendOtp() {
    if (!email.trim()) { setError('Enter your email address'); return }
    setError(''); setLoading(true)
    const sb = getSupabase()
    if (!sb) { setError('Auth not configured'); setLoading(false); return }
    const { error: otpErr } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/?signin=1&goto=projects` },
    })
    setLoading(false)
    if (otpErr) { setError(otpErr.message); return }
    setStep('otp')
  }

  async function handleVerify() {
    const code = digits.join('')
    if (code.length !== 6) return
    setError(''); setLoading(true)
    const sb = getSupabase()
    if (!sb) { setError('Auth not configured'); setLoading(false); return }
    const { data, error: verifyErr } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type:  'email',
    })
    setLoading(false)
    if (verifyErr || !data.user) {
      setError(verifyErr?.message ?? 'Invalid code. Try again.')
      setDigits(['','','','','',''])
      setTimeout(() => refs.current[0]?.focus(), 50)
      return
    }
    const u = buildUser(data.user)
    try { localStorage.setItem('sc_user', JSON.stringify(u)) } catch {}
    onAuth(u)
  }

  function onDigitChange(i: number, val: string) {
    const v = val.replace(/\D/g, '')
    if (v.length > 1) {
      // Pasted code
      const chars = v.slice(0, 6).split('')
      const next = ['','','','','',''].map((_, idx) => chars[idx] ?? '')
      setDigits(next)
      setTimeout(() => refs.current[Math.min(5, chars.length - 1)]?.focus(), 10)
      return
    }
    const next = digits.map((d, idx) => idx === i ? v : d)
    setDigits(next)
    if (v && i < 5) setTimeout(() => refs.current[i + 1]?.focus(), 10)
  }

  function onDigitKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const card: React.CSSProperties = {
    width: '100%', maxWidth: 400,
    background: '#fff', border: `1px solid ${BORDER}`,
    borderRadius: 20, padding: '2rem 1.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.85rem',
    boxShadow: '0 4px 24px rgba(10,28,46,0.08)',
  }

  return (
    <div style={{
      minHeight: '100dvh', background: BG,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      {/* Safety stripe */}
      <div style={{ width: '100%', maxWidth: 400, height: 5, borderRadius: '3px 3px 0 0',
        background: 'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)' }} />

      <div style={card}>
        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: NAVY, marginBottom: '0.2rem' }}>
            st<span style={{ color: ORANGE }}>AI</span>rcode
          </div>
          {step === 'entry' ? (
            <>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: NAVY, marginTop: '0.35rem' }}>Member sign in</div>
              <div style={{ fontSize: '0.78rem', color: '#5E7D9B', marginTop: '0.2rem' }}>Welcome back — access your inspection projects</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: NAVY, marginTop: '0.35rem' }}>Check your email</div>
              <div style={{ fontSize: '0.78rem', color: '#5E7D9B', marginTop: '0.2rem' }}>
                6-digit code sent to <strong style={{ color: NAVY }}>{email}</strong>
              </div>
            </>
          )}
        </div>

        {error && (
          <div style={{ fontSize: '0.75rem', color: '#E84545', background: 'rgba(232,69,69,0.07)', border: '1px solid rgba(232,69,69,0.2)', borderRadius: 9, padding: '0.55rem 0.75rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {step === 'entry' ? (
          <>
            {/* Google */}
            <button onClick={handleGoogle} disabled={loading}
              style={{ width: '100%', padding: '0.85rem', background: '#fff', border: '1.5px solid #E0E0E0', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', fontSize: '0.92rem', fontWeight: 600, color: '#1F1F1F', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', opacity: loading ? 0.6 : 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, height: 1, background: BORDER }}/>
              <span style={{ fontSize: '0.72rem', color: '#9DB4C5' }}>or use email</span>
              <div style={{ flex: 1, height: 1, background: BORDER }}/>
            </div>

            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
              placeholder="your@email.com" autoComplete="email"
              style={{ width: '100%', padding: '0.8rem 1rem', background: '#F4F7FB', border: `1.5px solid ${email ? BLUE : BORDER}`, borderRadius: 11, fontSize: '0.92rem', color: NAVY, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}/>

            <button onClick={handleSendOtp} disabled={loading || !email.trim()}
              style={{ width: '100%', padding: '0.9rem', background: loading || !email.trim() ? 'rgba(65,124,164,0.3)' : `linear-gradient(135deg,${BLUE},#2C5A7A)`, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: '0.92rem', cursor: loading || !email.trim() ? 'default' : 'pointer', boxShadow: '0 3px 12px rgba(65,124,164,0.3)' }}>
              {loading ? 'Sending…' : 'Send sign-in code →'}
            </button>
          </>
        ) : (
          <>
            {/* OTP digits */}
            <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'center' }}>
              {digits.map((d, i) => (
                <input key={i} ref={el => { refs.current[i] = el }}
                  type="text" inputMode="numeric" maxLength={6} value={d}
                  onChange={e => onDigitChange(i, e.target.value)}
                  onKeyDown={e => onDigitKey(i, e)}
                  onFocus={e => e.target.select()}
                  style={{ width: 46, height: 56, background: 'rgba(44,90,122,0.06)', border: `1.5px solid ${d ? BLUE : BORDER}`, borderRadius: 11, color: NAVY, fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}/>
              ))}
            </div>

            <button onClick={handleVerify} disabled={loading || digits.join('').length < 6}
              style={{ width: '100%', padding: '0.9rem', background: loading ? 'rgba(65,124,164,0.3)' : `linear-gradient(135deg,${ORANGE},#C4721E)`, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: '0.92rem', cursor: loading ? 'default' : 'pointer', boxShadow: '0 3px 12px rgba(242,147,55,0.35)' }}>
              {loading ? 'Verifying…' : 'Verify & sign in →'}
            </button>

            <button onClick={() => { setStep('entry'); setDigits(['','','','','','']); setError('') }}
              style={{ background: 'none', border: 'none', color: '#9DB4C5', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              ← Use a different email
            </button>
          </>
        )}

        {/* Not a member link */}
        <div style={{ textAlign: 'center', paddingTop: '0.5rem', borderTop: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: '0.75rem', color: '#9DB4C5' }}>Don&apos;t have an account?{' '}</span>
          <button onClick={() => onNotAMember ? onNotAMember() : window.location.href = '/marketing'}
            style={{ background: 'none', border: 'none', color: ORANGE, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            View pricing →
          </button>
        </div>
      </div>

      {/* Safety disclaimer */}
      <div style={{ marginTop: '1.25rem', fontSize: '0.65rem', color: '#9DB4C5', textAlign: 'center', maxWidth: 340, lineHeight: 1.5 }}>
        By signing in you agree to our{' '}
        <a href="/terms" style={{ color: '#9DB4C5' }}>Terms of Service</a>{' '}and{' '}
        <a href="/privacy" style={{ color: '#9DB4C5' }}>Privacy Policy</a>.
      </div>
    </div>
  )
}
