'use client'
/**
 * MemberLoginScreen.tsx
 *
 * Authentication for returning members. Three paths:
 *  1. Google OAuth (one tap)
 *  2. Email + Password (with forgot password / reset flow)
 *  3. Email Magic Code (OTP — 6-digit, existing flow)
 *
 * Tabs let the user switch between Email+Password and Magic Code.
 * Forgot password sends a Supabase reset link to their email.
 */

import { useState, useRef, useEffect } from 'react'
import type { AppUser, UserRole }       from './AuthScreen'
import { getSupabase }                  from '@/lib/supabase-client'

interface Props {
  onAuth:        (user: AppUser) => void
  onNotAMember?: () => void
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#27A96B'
const RED    = '#E84545'
const BG     = '#F0F4F8'
const BORDER = 'rgba(44,90,122,0.15)'

type AuthTab   = 'password' | 'magic'
type FlowStep  = 'entry' | 'otp' | 'forgot' | 'forgot_sent' | 'signup' | 'signup_confirm'

export default function MemberLoginScreen({ onAuth, onNotAMember }: Props) {
  const [tab,         setTab]         = useState<AuthTab>('password')
  const [step,        setStep]        = useState<FlowStep>('entry')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [newPwd,      setNewPwd]      = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [digits,      setDigits]      = useState(['','','','','',''])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [info,        setInfo]        = useState('')
  const digitRefs = useRef<(HTMLInputElement | null)[]>([])
  const emailRef  = useRef<HTMLInputElement>(null)
  const pwdRef    = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'otp')   setTimeout(() => digitRefs.current[0]?.focus(), 150)
    if (step === 'entry') setTimeout(() => emailRef.current?.focus(), 100)
  }, [step, tab])

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (digits.join('').length === 6 && step === 'otp' && !loading) handleVerifyOtp()
  }, [digits]) // eslint-disable-line

  function buildUser(sbUser: any): AppUser {
    const e = sbUser.email ?? sbUser.phone ?? ''
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
      signedInAt: Date.now(),
    }
  }

  function saveAndAuth(sbUser: any) {
    const u = buildUser(sbUser)
    try { localStorage.setItem('sc_user', JSON.stringify(u)) } catch {}
    onAuth(u)
  }

  // ── Google OAuth ────────────────────────────────────────────────────────────
  async function handleGoogle() {
    setError(''); setLoading(true)
    const sb = getSupabase()
    if (!sb) { setError('Auth not configured'); setLoading(false); return }
    const { error: err } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${window.location.origin}/?signin=1&goto=projects` },
    })
    if (err) { setError(err.message); setLoading(false) }
  }

  // ── Email + Password sign in ────────────────────────────────────────────────
  async function handlePasswordSignIn() {
    if (!email.trim()) { setError('Enter your email address'); return }
    if (!password)     { setError('Enter your password'); pwdRef.current?.focus(); return }
    setError(''); setLoading(true)
    const sb = getSupabase()
    if (!sb) { setError('Auth not configured'); setLoading(false); return }
    const { data, error: err } = await sb.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    })
    setLoading(false)
    if (err) {
      if (err.message.toLowerCase().includes('invalid login') || err.message.toLowerCase().includes('credentials')) {
        setError('Incorrect email or password. Try again or use "Forgot password".')
      } else {
        setError(err.message)
      }
      return
    }
    if (data.user) saveAndAuth(data.user)
  }

  // ── Sign Up (new account with email + password) ─────────────────────────────
  async function handleSignUp() {
    if (!email.trim())    { setError('Enter your email address'); return }
    if (!password)        { setError('Choose a password'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPwd) { setError("Passwords don't match — please check and try again"); return }
    setError(''); setLoading(true)
    const sb = getSupabase()
    if (!sb) { setError('Auth not configured'); setLoading(false); return }
    const { data, error: err } = await sb.auth.signUp({
      email:    email.trim().toLowerCase(),
      password,
      options:  { emailRedirectTo: `${window.location.origin}/?signin=1&goto=projects` },
    })
    if (err) { setError(err.message); setLoading(false); return }

    const userEmail = email.trim().toLowerCase()

    // Grant 7-day free trial immediately on signup
    let trialEnd: string | null = null
    let daysLeft = 7
    let limitedTrial = false
    try {
      const grantRes = await fetch('/api/trial/grant', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: userEmail }),
      })
      const grantData = await grantRes.json()
      if (grantData.ok) {
        trialEnd    = grantData.trialEnd
        daysLeft    = grantData.daysLeft ?? 7
        limitedTrial = !!grantData.limited
        // Store trial access in localStorage for local check
        try {
          localStorage.setItem('sc_beta_access', '1')
          if (trialEnd) localStorage.setItem('sc_trial_end', trialEnd)
          sessionStorage.setItem('sc_beta_access', '1')
        } catch {}
      }
    } catch { /* trial grant failed — still proceed with signup */ }

    setLoading(false)

    if (data.user && data.session) {
      // Signed in immediately (email confirm OFF in Supabase)
      saveAndAuth(data.user)
    } else {
      // Email confirmation required — show confirm screen
      setStep('signup_confirm')
    }
  }

  // ── Forgot password ─────────────────────────────────────────────────────────
  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email address first'); return }
    setError(''); setLoading(true)
    const sb = getSupabase()
    if (!sb) { setError('Auth not configured'); setLoading(false); return }
    const { error: err } = await sb.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/?reset=1` }
    )
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('forgot_sent')
  }

  // ── Magic code (OTP) ────────────────────────────────────────────────────────
  async function handleSendOtp() {
    if (!email.trim()) { setError('Enter your email address'); return }
    setError(''); setLoading(true)
    const sb = getSupabase()
    if (!sb) { setError('Auth not configured'); setLoading(false); return }
    const { error: err } = await sb.auth.signInWithOtp({
      email:   email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/?signin=1&goto=projects` },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('otp')
  }

  async function handleVerifyOtp() {
    const code = digits.join('')
    if (code.length !== 6) return
    setError(''); setLoading(true)
    const sb = getSupabase()
    if (!sb) { setError('Auth not configured'); setLoading(false); return }
    const { data, error: err } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type:  'email',
    })
    setLoading(false)
    if (err || !data.user) {
      setError(err?.message ?? 'Invalid code — check your email and try again.')
      setDigits(['','','','','',''])
      setTimeout(() => digitRefs.current[0]?.focus(), 50)
      return
    }
    saveAndAuth(data.user)
  }

  function onDigitChange(i: number, val: string) {
    const v = val.replace(/\D/g, '')
    if (v.length > 1) {
      const chars = v.slice(0, 6).split('')
      setDigits(['','','','','',''].map((_, idx) => chars[idx] ?? ''))
      setTimeout(() => digitRefs.current[Math.min(5, chars.length - 1)]?.focus(), 10)
      return
    }
    setDigits(digits.map((d, idx) => idx === i ? v : d))
    if (v && i < 5) setTimeout(() => digitRefs.current[i + 1]?.focus(), 10)
  }

  function onDigitKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) digitRefs.current[i - 1]?.focus()
  }

  function switchTab(t: AuthTab) {
    setTab(t); setStep('entry'); setError(''); setInfo('')
    setDigits(['','','','','','']); setPassword(''); setConfirmPwd('')
  }

  // ── Shared input style ──────────────────────────────────────────────────────
  const inp = (active?: boolean): React.CSSProperties => ({
    width: '100%', padding: '0.8rem 1rem',
    background: '#F4F7FB',
    border: `1.5px solid ${active ? BLUE : BORDER}`,
    borderRadius: 11, fontSize: '0.92rem', color: NAVY,
    outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit',
    transition: 'border-color 0.12s',
  })

  const card: React.CSSProperties = {
    width: '100%', maxWidth: 400, background: '#fff',
    border: `1px solid ${BORDER}`, borderRadius: 20,
    padding: '2rem 1.75rem', display: 'flex', flexDirection: 'column' as const,
    gap: '0.85rem', boxShadow: '0 4px 24px rgba(10,28,46,0.08)',
  }

  return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1.5rem', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Safety stripe */}
      <div style={{ width:'100%', maxWidth:400, height:5, borderRadius:'3px 3px 0 0', background:'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)' }}/>

      <div style={card}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'0.25rem' }}>
          <div style={{ fontSize:'1.75rem', fontWeight:800, letterSpacing:'-0.02em', color:NAVY }}>
            st<span style={{ color:ORANGE }}>AI</span>rcode
          </div>

          {step === 'otp' ? (
            <>
              <div style={{ fontSize:'1.05rem', fontWeight:700, color:NAVY, marginTop:'0.35rem' }}>Check your email</div>
              <div style={{ fontSize:'0.78rem', color:'#5E7D9B', marginTop:'0.2rem' }}>
                6-digit code sent to <strong style={{ color:NAVY }}>{email}</strong>
              </div>
            </>
          ) : step === 'forgot_sent' ? (
            <>
              <div style={{ fontSize:'1.05rem', fontWeight:700, color:NAVY, marginTop:'0.35rem' }}>Reset link sent</div>
              <div style={{ fontSize:'0.78rem', color:'#5E7D9B', marginTop:'0.2rem' }}>
                Check <strong style={{ color:NAVY }}>{email}</strong> for a password reset link
              </div>
            </>
          ) : step === 'signup' ? (
            <>
              <div style={{ fontSize:'1.05rem', fontWeight:700, color:NAVY, marginTop:'0.35rem' }}>Create your account</div>
              <div style={{ fontSize:'0.78rem', color:'#5E7D9B', marginTop:'0.2rem' }}>Set up your email and password to get started</div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', marginTop:'0.5rem', background:'rgba(39,169,107,0.1)', border:'1px solid rgba(39,169,107,0.3)', borderRadius:20, padding:'0.25rem 0.75rem' }}>
                <span style={{ fontSize:'0.75rem' }}>🎁</span>
                <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#1A7A50' }}>Includes 7-day free trial — no credit card required</span>
              </div>
            </>
          ) : step === 'signup_confirm' ? (
            <>
              <div style={{ fontSize:'1.05rem', fontWeight:700, color:NAVY, marginTop:'0.35rem' }}>Check your email</div>
              <div style={{ fontSize:'0.78rem', color:'#5E7D9B', marginTop:'0.2rem' }}>
                We sent a confirmation link to <strong style={{ color:NAVY }}>{email}</strong>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:'1.05rem', fontWeight:700, color:NAVY, marginTop:'0.35rem' }}>Welcome back</div>
              <div style={{ fontSize:'0.78rem', color:'#5E7D9B', marginTop:'0.2rem' }}>Sign in to access your projects</div>
            </>
          )}
        </div>

        {/* Error / info banners */}
        {error && (
          <div style={{ fontSize:'0.75rem', color:RED, background:'rgba(232,69,69,0.07)', border:`1px solid rgba(232,69,69,0.2)`, borderRadius:9, padding:'0.55rem 0.75rem', display:'flex', gap:'0.5rem', alignItems:'flex-start' }}>
            <span style={{ flexShrink:0 }}>⚠</span>{error}
          </div>
        )}
        {info && (
          <div style={{ fontSize:'0.75rem', color:'#1A7A50', background:'rgba(39,169,107,0.07)', border:`1px solid rgba(39,169,107,0.2)`, borderRadius:9, padding:'0.55rem 0.75rem' }}>
            {info}
          </div>
        )}

        {/* ── Email confirmed / signup confirmation ── */}
        {step === 'signup_confirm' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div style={{ background:'rgba(39,169,107,0.07)', border:`1px solid rgba(39,169,107,0.25)`, borderRadius:12, padding:'1rem', textAlign:'center' }}>
              <div style={{ fontSize:'1.5rem', marginBottom:'0.4rem' }}>📬</div>
              <div style={{ fontSize:'0.82rem', color:'#1A7A50', lineHeight:1.65 }}>
                A confirmation link has been sent to <strong>{email}</strong>. Click the link in your email to activate your account, then come back here to sign in.
              </div>
            </div>
            <button onClick={() => { setStep('entry'); setError(''); setConfirmPwd(''); setPassword('') }}
              style={{ width:'100%', padding:'0.85rem', background:'none', border:`1.5px solid ${BORDER}`, borderRadius:12, color:NAVY, fontWeight:600, fontSize:'0.88rem', cursor:'pointer', fontFamily:'inherit' }}>
              ← Back to sign in
            </button>
          </div>

        ) : step === 'signup' ? (
          /* ── Sign Up form ── */
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>

            {/* Email */}
            <div>
              <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.3rem' }}>Email address</div>
              <input type="email" value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="your@email.com" autoComplete="email"
                style={inp(!!email)}/>
            </div>

            {/* Password */}
            <div>
              <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.3rem' }}>
                Password <span style={{ fontWeight:400, color:'#9DB4C5' }}>(min. 8 characters)</span>
              </div>
              <div style={{ position:'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="Choose a password" autoComplete="new-password"
                  style={{ ...inp(!!password), paddingRight:'2.75rem' }}/>
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  style={{ position:'absolute', right:'0.8rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9DB4C5', fontSize:'0.8rem', padding:0, lineHeight:1 }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#5E7D9B', marginBottom:'0.3rem' }}>Confirm password</div>
              <div style={{ position:'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'} value={confirmPwd}
                  onChange={e => { setConfirmPwd(e.target.value); setError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSignUp() }}
                  placeholder="Repeat your password" autoComplete="new-password"
                  style={{ ...inp(!!confirmPwd), paddingRight:'2.75rem',
                    borderColor: confirmPwd && password && confirmPwd !== password ? '#E84545'
                               : confirmPwd && password && confirmPwd === password ? '#27A96B'
                               : undefined }}/>
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  style={{ position:'absolute', right:'0.8rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9DB4C5', fontSize:'0.8rem', padding:0, lineHeight:1 }}>
                  {showConfirm ? '🙈' : '👁'}
                </button>
              </div>
              {confirmPwd && password && confirmPwd === password && (
                <div style={{ fontSize:'0.68rem', color:'#27A96B', marginTop:'0.25rem' }}>✓ Passwords match</div>
              )}
            </div>

            <button onClick={handleSignUp} disabled={loading || !email.trim() || !password || !confirmPwd}
              style={{ width:'100%', padding:'0.9rem', background: loading || !email.trim() || !password || !confirmPwd ? 'rgba(242,147,55,0.3)' : `linear-gradient(135deg,${ORANGE},#C4721E)`, border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:'0.92rem', cursor: loading || !email.trim() || !password || !confirmPwd ? 'default':'pointer', boxShadow:'0 3px 12px rgba(242,147,55,0.3)', transition:'all 0.15s' }}>
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>

            <button onClick={() => { setStep('entry'); setError(''); setConfirmPwd(''); setPassword('') }}
              style={{ background:'none', border:'none', color:'#9DB4C5', fontSize:'0.78rem', cursor:'pointer', fontFamily:'inherit', textAlign:'center' as const }}>
              ← Already have an account? Sign in
            </button>
          </div>

        ) : step === 'forgot_sent' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div style={{ background:'rgba(39,169,107,0.07)', border:`1px solid rgba(39,169,107,0.25)`, borderRadius:12, padding:'1rem', textAlign:'center' }}>
              <div style={{ fontSize:'1.5rem', marginBottom:'0.4rem' }}>📬</div>
              <div style={{ fontSize:'0.82rem', color:'#1A7A50', lineHeight:1.65 }}>
                A password reset link has been sent to <strong>{email}</strong>. Check your inbox and click the link to set a new password.
              </div>
            </div>
            <button onClick={() => { setStep('entry'); setError('') }}
              style={{ width:'100%', padding:'0.85rem', background:'none', border:`1.5px solid ${BORDER}`, borderRadius:12, color:NAVY, fontWeight:600, fontSize:'0.88rem', cursor:'pointer', fontFamily:'inherit' }}>
              ← Back to sign in
            </button>
          </div>
        ) : step === 'otp' ? (
          /* ── OTP verification ── */
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div style={{ display:'flex', gap:'0.45rem', justifyContent:'center' }}>
              {digits.map((d, i) => (
                <input key={i} ref={el => { digitRefs.current[i] = el }}
                  type="text" inputMode="numeric" maxLength={6} value={d}
                  onChange={e => onDigitChange(i, e.target.value)}
                  onKeyDown={e => onDigitKey(i, e)}
                  onFocus={e => e.target.select()}
                  style={{ width:46, height:56, background:'rgba(44,90,122,0.06)', border:`1.5px solid ${d ? BLUE : BORDER}`, borderRadius:11, color:NAVY, fontSize:'1.5rem', fontWeight:700, textAlign:'center', outline:'none', fontFamily:'inherit' }}/>
              ))}
            </div>
            <button onClick={handleVerifyOtp} disabled={loading || digits.join('').length < 6}
              style={{ width:'100%', padding:'0.9rem', background:loading ? 'rgba(65,124,164,0.3)' : `linear-gradient(135deg,${ORANGE},#C4721E)`, border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:'0.92rem', cursor:loading ? 'default':'pointer', boxShadow:'0 3px 12px rgba(242,147,55,0.35)' }}>
              {loading ? 'Verifying…' : 'Verify & sign in →'}
            </button>
            <button onClick={() => { setStep('entry'); setDigits(['','','','','','']); setError('') }}
              style={{ background:'none', border:'none', color:'#9DB4C5', fontSize:'0.78rem', cursor:'pointer', fontFamily:'inherit' }}>
              ← Use a different email
            </button>
          </div>
        ) : (
          /* ── Entry state ── */
          <>
            {/* Google */}
            <button onClick={handleGoogle} disabled={loading}
              style={{ width:'100%', padding:'0.85rem', background:'#fff', border:'1.5px solid #E0E0E0', borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.65rem', fontSize:'0.92rem', fontWeight:600, color:'#1F1F1F', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', opacity:loading ? 0.6:1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <div style={{ flex:1, height:1, background:BORDER }}/>
              <span style={{ fontSize:'0.72rem', color:'#9DB4C5' }}>or sign in with email</span>
              <div style={{ flex:1, height:1, background:BORDER }}/>
            </div>

            {/* Email field (shared) */}
            <input ref={emailRef} type="email" value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') { tab === 'password' ? pwdRef.current?.focus() : handleSendOtp() }}}
              placeholder="your@email.com" autoComplete="email"
              style={inp(!!email)}/>

            {/* Auth method tabs */}
            <div style={{ display:'flex', background:'rgba(65,124,164,0.07)', borderRadius:10, padding:'0.25rem', gap:'0.25rem' }}>
              {([['password','Password'] as const, ['magic','Magic Code'] as const]).map(([t, label]) => (
                <button key={t} onClick={() => switchTab(t)}
                  style={{ flex:1, padding:'0.55rem', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:'0.8rem', fontWeight:tab === t ? 700 : 500, background:tab === t ? '#fff' : 'transparent', color:tab === t ? NAVY : '#5E7D9B', boxShadow:tab === t ? '0 1px 4px rgba(10,28,46,0.1)' : 'none', transition:'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Password tab */}
            {tab === 'password' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                <div style={{ position:'relative' }}>
                  <input ref={pwdRef}
                    type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') handlePasswordSignIn() }}
                    placeholder="Password" autoComplete="current-password"
                    style={{ ...inp(!!password), paddingRight:'2.75rem' }}/>
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    style={{ position:'absolute', right:'0.8rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9DB4C5', fontSize:'0.8rem', padding:0, lineHeight:1 }}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>

                <button onClick={handlePasswordSignIn} disabled={loading || !email.trim() || !password}
                  style={{ width:'100%', padding:'0.9rem', background:loading || !email.trim() || !password ? 'rgba(65,124,164,0.3)' : `linear-gradient(135deg,${BLUE},#2C5A7A)`, border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:'0.92rem', cursor:loading || !email.trim() || !password ? 'default':'pointer', boxShadow:'0 3px 12px rgba(65,124,164,0.3)', transition:'all 0.15s' }}>
                  {loading ? 'Signing in…' : 'Sign in →'}
                </button>

                {/* Forgot password */}
                <div style={{ textAlign:'center' }}>
                  <button onClick={() => { if (!email.trim()) { setError('Enter your email first, then click Forgot password'); return } handleForgotPassword() }}
                    style={{ background:'none', border:'none', color:BLUE, fontSize:'0.75rem', cursor:'pointer', fontFamily:'inherit', padding:0, textDecoration:'underline', textDecorationColor:'rgba(65,124,164,0.35)' }}>
                    Forgot password?
                  </button>
                </div>
              </div>
            )}

            {/* Magic code tab */}
            {tab === 'magic' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                <div style={{ fontSize:'0.72rem', color:'#5E7D9B', lineHeight:1.6, padding:'0.5rem 0.75rem', background:'rgba(65,124,164,0.05)', borderRadius:9, border:`1px solid rgba(65,124,164,0.15)` }}>
                  We&apos;ll send a 6-digit code to your email — no password needed.
                </div>
                <button onClick={handleSendOtp} disabled={loading || !email.trim()}
                  style={{ width:'100%', padding:'0.9rem', background:loading || !email.trim() ? 'rgba(65,124,164,0.3)' : `linear-gradient(135deg,${BLUE},#2C5A7A)`, border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:'0.92rem', cursor:loading || !email.trim() ? 'default':'pointer', boxShadow:'0 3px 12px rgba(65,124,164,0.3)' }}>
                  {loading ? 'Sending…' : 'Send sign-in code →'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Not a member / Sign up */}
        {step !== 'forgot_sent' && step !== 'otp' && step !== 'signup' && step !== 'signup_confirm' && (
          <div style={{ textAlign:'center', paddingTop:'0.5rem', borderTop:`1px solid ${BORDER}` }}>
            <span style={{ fontSize:'0.75rem', color:'#9DB4C5' }}>Don&apos;t have an account?{' '}</span>
            <button onClick={() => { setStep('signup'); setError(''); setPassword(''); setConfirmPwd('') }}
              style={{ background:'none', border:'none', color:ORANGE, fontWeight:700, fontSize:'0.75rem', cursor:'pointer', fontFamily:'inherit', padding:0 }}>
              Sign Up →
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop:'1.25rem', fontSize:'0.65rem', color:'#9DB4C5', textAlign:'center', maxWidth:340, lineHeight:1.5 }}>
        By signing in you agree to our{' '}
        <a href="/terms" style={{ color:'#9DB4C5' }}>Terms of Service</a>{' '}and{' '}
        <a href="/privacy" style={{ color:'#9DB4C5' }}>Privacy Policy</a>.
      </div>
    </div>
  )
}
