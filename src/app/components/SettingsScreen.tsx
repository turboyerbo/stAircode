'use client'
/**
 * SettingsScreen.tsx — ARAI_10
 * Blueprint dark theme: deep navy background, white text, clear contrast.
 */

import { useState } from 'react'
import { BetaLogo } from '@/app/components/Logo'
import React from 'react'
import type { AppUser, UserRole } from './AuthScreen'
import { getProfile, getProfileLabel } from '@/lib/profiles'
import FeedbackButton                            from './FeedbackButton'

interface Props {
  user: AppUser
  onLogout: () => void
  onUpdateUser: (u: AppUser) => void
}

// ── Blueprint dark palette ─────────────────────────────────────────────────────
const BG2 = '#0A1C2E'

const T = {
  bg:      '#0D2040',        // dark navy — matches app theme
  card:    '#132A4A',        // slightly lighter navy for cards
  cardHi:  'rgba(65,124,164,0.15)',
  border:  'rgba(65,124,164,0.25)',
  borderHi:'rgba(65,124,164,0.45)',
  text:    '#E8F4FF',        // bright white text — high contrast on dark
  text2:   '#93BAD4',        // light blue-grey for secondary text
  text3:   '#5E8FAA',        // muted for tertiary
  blue:    '#5BA3D0',
  orange:  '#FA741F',
  pass:    '#27A96B',
  fail:    '#E84545',
}

const APP_VERSION = '1.0.0 (build 42)'

const ROLE_LABELS: Record<string, string> = {
  architect:        'Architect',
  building_manager: 'Building Manager',
  contractor:       'Contractor',
  diy:              'DIY Renovator',
  realestate:       'Real Estate Professional',
}
const ROLE_COLORS: Record<string, string> = {
  architect:        '#417CA4',
  building_manager: '#A78BFA',
  contractor:       '#F29337',
  diy:              '#3DB88A',
  realestate:       '#F59E0B',
}

const MEMBERSHIP_COLORS: Record<string, string> = {
  free:       T.text2,
  pro:        T.blue,
  enterprise: T.orange,
}
const MEMBERSHIP_LABELS: Record<string, string> = {
  free: 'Free', pro: 'Pro', enterprise: 'Enterprise',
}

export default function SettingsScreen({ user, onLogout, onUpdateUser }: Props) {
  const [showUnits,      setShowUnits]      = useState(false)
  const [showRole,       setShowRole]       = useState(false)
  const [showPayment,    setShowPayment]    = useState(false)
  const [showMembership, setShowMembership] = useState(false)
  const [showLegal,      setShowLegal]      = useState(false)
  const [logoutConfirm,  setLogoutConfirm]  = useState(false)

  return (
    <div style={{
      flex: 1, overflowY: 'auto',
      background: '#0D2040', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px)',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      color: T.text,
      paddingBottom: '2rem',
    }}>{/* Header */}
      <div style={{ padding: '1.6rem 1.25rem 0.5rem', borderBottom: `1px solid ${T.border}` }}><div style={{ marginBottom: '0.5rem' }}><BetaLogo size="sm" onDark /></div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: T.text, letterSpacing: '-0.02em' }}>Settings</h1>
      </div>

      {/* ── PREFERENCES ── */}
      <SectionHeader label="Preferences" />

      <SettingsRow icon="—" label="Units" value={user.units === 'mm' ? 'Millimetres (mm)' : 'Imperial (ft/in)'} onTap={() => setShowUnits(v => !v)} />
      {showUnits && (
        <OptionGroup>
          {(['mm', 'ft'] as const).map(u => (
            <OptionRow key={u}
              label={u === 'mm' ? 'Millimetres (mm)' : 'Imperial (ft/in)'}
              selected={user.units === u}
              onSelect={() => { onUpdateUser({ ...user, units: u }); setShowUnits(false) }}
            />
          ))}
        </OptionGroup>
      )}

      <SettingsRow
        icon="" label="I am a…"
        value={ROLE_LABELS[user.role ?? 'diy']}
        valueColor={ROLE_COLORS[user.role ?? 'diy']}
        onTap={() => setShowRole(v => !v)}
      />
      {showRole && (
        <OptionGroup>
          {(['architect','building_manager','contractor','diy','realestate'] as UserRole[]).map(r => (
            <OptionRow key={r} label={ROLE_LABELS[r]} selected={(user.role ?? 'diy') === r}
              onSelect={() => { onUpdateUser({ ...user, role: r }); setShowRole(false) }} />
          ))}
        </OptionGroup>
      )}

      {/* ── ACCOUNT ── */}
      {/* Header */}
      <div style={{ background:'#0A1C2E', backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.07) 27px,rgba(65,124,164,0.07) 28px)', padding:'1.5rem 1.25rem 1.25rem' }}><div style={{ marginBottom: '0.5rem' }}><BetaLogo size="sm" onDark /></div>
        <div style={{ fontSize:'1.3rem', fontWeight: 700, color:'#E8F4FF', letterSpacing:'-0.02em' }}>Settings</div>
      </div>
      <div style={{ height:5, background:'repeating-linear-gradient(-45deg,#F29337 0px,#F29337 5px,#0A1C2E 5px,#0A1C2E 12px)', backgroundSize:'20px 20px', marginBottom:'0.25rem' }} />

      <SectionHeader label="Account" />

      <SettingsRow icon="—" label="Account" value={user.email} sub={`Signed in with ${user.provider}`} />

      {/* Payment Method — hidden until Pro subscription launches */}

      <SettingsRow
        icon="—" label="Membership"
        value={MEMBERSHIP_LABELS[user.membership]}
        valueColor={MEMBERSHIP_COLORS[user.membership]}
        onTap={() => setShowMembership(v => !v)}
      />
      {showMembership && (
        <div style={{ margin: '0 1rem 0.5rem', background: T.card, border: `1px solid ${T.borderHi}`, borderRadius: 14, overflow: 'hidden' }}>{([
            { id: 'free',       label: 'Free',       desc: 'Basic scanning, limited reports',       price: '$0/mo'  },
            { id: 'pro',        label: 'Pro',         desc: '20 scans/month, PDF exports',          price: '$199/mo' },
            { id: 'enterprise', label: 'Enterprise',  desc: 'Team access, API, priority support',    price: '$79/mo' },
          ] as const).map(({ id, label, desc, price }) => (
            <button key={id}
              onClick={() => { onUpdateUser({ ...user, membership: id }); setShowMembership(false) }}
              style={{
                width: '100%', padding: '0.9rem 1rem',
                background: user.membership === id ? T.cardHi : 'transparent',
                border: 'none', borderBottom: `1px solid ${T.border}`,
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}><div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: MEMBERSHIP_COLORS[id] }}>{label}</div>
                <div style={{ fontSize: '0.7rem', color: T.text2, marginTop: '0.15rem' }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ fontSize: '0.82rem', color: T.text, fontWeight: 700 }}>{price}</span>
                {user.membership === id && <span style={{fontSize:'0.75rem',color:'#27A96B',fontWeight:700}}>&#10003;</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── MANAGE SUBSCRIPTION (Pro/Enterprise only) ── */}
      {(user.membership === 'pro' || user.membership === 'enterprise') && (
        <>
          <SectionHeader label="Subscription" />
          <SettingsRow
            icon="" label="Manage Subscription"
            value={user.membership === 'pro' ? '$199/mo · Active' : 'Enterprise — Contact us'}
            valueColor={T.pass}
            onTap={async () => {
              try {
                const res = await fetch('/api/stripe/portal', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userEmail: user.email }),
                })
                const data = await res.json()
                if (data.url) window.location.href = data.url
                else alert('Could not open billing portal. Contact info@staircode.app.')
              } catch {
                alert('Could not open billing portal. Contact info@staircode.app.')
              }
            }}
          />
        </>
      )}

      {/* ── BETA FEEDBACK ── */}
      <SectionHeader label="Beta Testing" />
      <div style={{ margin: '0 1rem 1rem' }}><div style={{ background: BG2, border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem' }}><div style={{ fontSize: '0.78rem', color: T.text2, lineHeight: 1.6, marginBottom: '0.85rem' }}>You&apos;re using an early build of Staircode. Your feedback directly shapes what gets built next.
          </div>
          <FeedbackButton source="settings" />
        </div>
      </div>

      {/* ── ABOUT ── */}
      <SectionHeader label="About" />

      <SettingsRow icon="—" label="Legal Information" onTap={() => setShowLegal(v => !v)} />
      {showLegal && (
        <div style={{ margin: '0 1rem 0.5rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '1.1rem' }}><p style={{ fontSize: '0.74rem', color: T.text2, lineHeight: 1.75, margin: 0 }}><strong style={{ color: T.text }}>stAIrcode</strong> is a visual aid tool developed by{' '}
            <strong style={{ color: T.text }}>Just Open Technologies Inc.</strong> (federally incorporated in Canada;
            extra-provincial registration in Ontario). stAIrcode is <strong style={{ color: T.text }}>not a compliance
            checker</strong> and does not constitute a building inspection or professional assessment of any kind.
            <br /><br />
            <strong style={{ color: T.text }}>IMPORTANT LIMITATIONS:</strong> All measurements produced by this
            application are AI-generated estimates from camera images only. Accuracy is limited by image quality,
            camera angle, lighting, and perspective distortion — typical error range is ±10–25mm or greater.
            These measurements are <strong>not suitable</strong> for submission to any authority having jurisdiction
            (AHJ), building permit application, legal proceeding, or professional certification.
            <br /><br />
            Only a licensed professional engineer, registered architect, or certified building inspector using
            calibrated equipment can produce legally valid stair measurements. stAIrcode results must not be
            relied upon for construction decisions, safety determinations, or code compliance verification.
            <br /><br />
            <strong style={{ color: T.text }}>LIMITATION OF LIABILITY:</strong> Just Open Technologies Inc.,
            its officers, directors, employees, and agents accept no liability whatsoever for any loss, damage,
            injury, or consequence arising from the use or misuse of this application or its outputs.
            Use of this application is entirely at the user&apos;s own risk.
            <br /><br />
            All building code references are indicative only. Consult the applicable authority having jurisdiction
            (AHJ) for binding requirements. Building codes change — always verify against the current edition.
            <br /><br />
            © {new Date().getFullYear()} stAIrcode — a product of Just Open Technologies Inc. All rights reserved.{' '}
            <a href="/terms" style={{ color: T.blue }}>Terms of Service</a>
            {' · '}
            <a href="/privacy" style={{ color: T.blue }}>Privacy Policy</a>
            {' · '}
            <a href="mailto:info@staircode.app" style={{ color: T.blue }}>info@staircode.app</a>
          </p>
        </div>
      )}

      <SettingsRow icon="—" label="App Version" value={APP_VERSION} />

      {/* ── LOG OUT ── */}
      <div style={{ margin: '1.5rem 1rem 0' }}>{!logoutConfirm ? (
          <button onClick={() => setLogoutConfirm(true)} style={{
            width: '100%', padding: '1rem',
            background: 'rgba(232,85,85,0.1)',
            border: '1px solid rgba(232,85,85,0.3)',
            borderRadius: 14, color: T.fail,
            fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
            letterSpacing: '0.04em',
          }}>Log Out
          </button>
        ) : (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '1.1rem', textAlign: 'center' }}><p style={{ fontSize: '0.85rem', color: T.text2, margin: '0 0 0.9rem', lineHeight: 1.5 }}>Are you sure you want to log out?
            </p>
            <div style={{ display: 'flex', gap: '0.6rem' }}><button onClick={() => setLogoutConfirm(false)} style={{
                flex: 1, padding: '0.8rem',
                background: T.cardHi, border: `1px solid ${T.border}`,
                borderRadius: 10, color: T.text,
                fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600,
              }}>Cancel</button>
              <button onClick={onLogout} style={{
                flex: 1, padding: '0.8rem',
                background: 'rgba(232,85,85,0.15)',
                border: '1px solid rgba(232,85,85,0.4)',
                borderRadius: 10, color: T.fail,
                fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
              }}>Log Out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      padding: '1rem 1.25rem 0.35rem',
      fontSize: '0.62rem', fontWeight: 700,
      letterSpacing: '0.04em', color: T.text3,
      textTransform: 'uppercase',
    }}>{label}
    </div>
  )
}

function SettingsRow({ icon, label, value, sub, valueColor, onTap }: {
  icon: string; label: string; value?: string; sub?: string
  valueColor?: string; onTap?: () => void
}) {
  const showIcon = icon && icon !== '—' && icon !== ''
  return (
    <button onClick={onTap} disabled={!onTap} style={{
      width: '100%', padding: '0.9rem 1.25rem',
      background: 'transparent', border: 'none',
      display: 'flex', alignItems: 'center', gap: '0.85rem',
      cursor: onTap ? 'pointer' : 'default', textAlign: 'left',
      borderBottom: `1px solid ${T.border}`,
    }}>
      {showIcon && <span style={{ fontSize: '1.15rem', flexShrink: 0, width: 24, textAlign: 'center' }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '0.9rem', color: T.text, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: T.text2, marginTop: '0.1rem' }}>{sub}</div>}
      </div>
      {value && (
        <span style={{ fontSize: '0.8rem', color: valueColor ?? T.text2, flexShrink: 0, maxWidth: 180, textAlign: 'right', fontWeight: valueColor ? 700 : 400 }}>{value}
        </span>
      )}
      {onTap && <span style={{ color: T.text3, fontSize: '1rem', marginLeft: '0.1rem' }}>›</span>}
    </button>
  )
}

function OptionGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: '0 1rem 0.6rem',
      background: T.card,
      border: `1px solid ${T.borderHi}`,
      borderRadius: 14, overflow: 'hidden',
    }}>{children}
    </div>
  )
}

function OptionRow({ label, selected, onSelect }: {
  label: string; selected: boolean; onSelect: () => void
}) {
  return (
    <button onClick={onSelect} style={{
      width: '100%', padding: '0.9rem 1rem',
      background: selected ? T.cardHi : 'transparent',
      border: 'none', borderBottom: `1px solid ${T.border}`,
      cursor: 'pointer', textAlign: 'left',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}><span style={{ fontSize: '0.9rem', color: T.text, fontWeight: selected ? 700 : 400 }}>{label}</span>
      {selected && <span style={{fontSize:'0.8rem',color:'#27A96B',fontWeight: 700}}>&#10003;</span>}
    </button>
  )
}
