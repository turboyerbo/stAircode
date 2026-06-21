'use client'
/**
 * /admin — simple trial → conversion dashboard.
 * Prompts for the admin secret, then renders funnel stats and a recent-trials table.
 * The secret is held in memory only (never persisted).
 */
import { useState } from 'react'

const NAVY  = '#0A1C2E'
const BLUE  = '#417CA4'
const GREEN = '#27A96B'
const ORANGE = '#F29337'
const RED   = '#E84545'

interface Stats {
  total: number; subscribed: number; activeTrials: number; expiredNoConv: number
  day1: number; day2to4: number; day5to6: number; day7plus: number; conversionRate: number
}
interface Row {
  email: string; name: string; daysIn: number; daysLeft: number
  expired: boolean; subscribed: boolean; trialStart: string; emailsSent: string[]
}

export default function AdminPage() {
  const [secret,  setSecret]  = useState('')
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [recent,  setRecent]  = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/trials?secret=${encodeURIComponent(secret)}`)
      if (res.status === 401) { setError('Wrong admin secret'); setLoading(false); return }
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Failed')
      setStats(data.stats)
      setRecent(data.recent)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const card = (label: string, value: string | number, color = NAVY, sub?: string) => (
    <div style={{ background:'#fff', border:'1px solid #DCE7F0', borderRadius:12, padding:'1.1rem 1.25rem', flex:'1 1 140px', minWidth:140 }}>
      <div style={{ fontSize:'1.8rem', fontWeight:800, color, letterSpacing:'-0.02em', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:'0.72rem', color:'#5E7D9B', marginTop:'0.35rem', fontWeight:600 }}>{label}</div>
      {sub && <div style={{ fontSize:'0.62rem', color:'#9DB4C5', marginTop:'0.15rem' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#EBF3FA', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding:'1.5rem 1rem' }}>
      <div style={{ maxWidth:1000, margin:'0 auto' }}>
        <h1 style={{ fontSize:'1.5rem', fontWeight:800, color:NAVY, margin:'0 0 1rem', letterSpacing:'-0.02em' }}>
          st<span style={{ color:ORANGE }}>AI</span>rcode — Trial Funnel
        </h1>

        {!stats && (
          <div style={{ background:'#fff', border:'1px solid #DCE7F0', borderRadius:12, padding:'1.5rem', maxWidth:380 }}>
            <div style={{ fontSize:'0.85rem', color:'#5E7D9B', marginBottom:'0.75rem' }}>Enter admin secret to view stats</div>
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') load() }}
              placeholder="ADMIN_SECRET"
              style={{ width:'100%', padding:'0.75rem 0.9rem', border:'1.5px solid rgba(65,124,164,0.25)', borderRadius:9, fontSize:'0.9rem', boxSizing:'border-box', marginBottom:'0.75rem', fontFamily:'inherit' }}
            />
            <button onClick={load} disabled={loading || !secret}
              style={{ width:'100%', padding:'0.8rem', background: loading||!secret ? 'rgba(65,124,164,0.3)' : NAVY, color:'#fff', border:'none', borderRadius:9, fontSize:'0.88rem', fontWeight:700, cursor: loading||!secret ? 'default' : 'pointer' }}>
              {loading ? 'Loading…' : 'View Stats'}
            </button>
            {error && <div style={{ color:RED, fontSize:'0.8rem', marginTop:'0.6rem' }}>{error}</div>}
          </div>
        )}

        {stats && (
          <>
            {/* Headline funnel */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.75rem', marginBottom:'1rem' }}>
              {card('Total trials', stats.total)}
              {card('Subscribed', stats.subscribed, GREEN)}
              {card('Conversion', `${stats.conversionRate}%`, GREEN)}
              {card('Active now', stats.activeTrials, BLUE)}
              {card('Expired, no convert', stats.expiredNoConv, RED)}
            </div>

            {/* Day buckets */}
            <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#5E7D9B', margin:'1rem 0 0.5rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Where active trials are</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.75rem', marginBottom:'1.5rem' }}>
              {card('Day 0–1', stats.day1, BLUE, 'just started')}
              {card('Day 2–4', stats.day2to4, BLUE)}
              {card('Day 5–6', stats.day5to6, ORANGE, 'urgency window')}
              {card('Day 7+ (lapsed)', stats.day7plus, RED, 'win-back')}
            </div>

            {/* Recent table */}
            <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#5E7D9B', margin:'0 0 0.5rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Recent trials</div>
            <div style={{ background:'#fff', border:'1px solid #DCE7F0', borderRadius:12, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
                <thead>
                  <tr style={{ background:'#F7FAFC', textAlign:'left', color:'#5E7D9B' }}>
                    <th style={{ padding:'0.6rem 0.85rem', fontWeight:700 }}>User</th>
                    <th style={{ padding:'0.6rem 0.5rem', fontWeight:700 }}>Day</th>
                    <th style={{ padding:'0.6rem 0.5rem', fontWeight:700 }}>Status</th>
                    <th style={{ padding:'0.6rem 0.85rem', fontWeight:700 }}>Emails</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={i} style={{ borderTop:'1px solid #EBF3FA' }}>
                      <td style={{ padding:'0.55rem 0.85rem', color:NAVY }}>
                        <div style={{ fontWeight:600 }}>{r.name}</div>
                        <div style={{ fontSize:'0.68rem', color:'#9DB4C5' }}>{r.email}</div>
                      </td>
                      <td style={{ padding:'0.55rem 0.5rem', color:'#5E7D9B' }}>{r.daysIn}d</td>
                      <td style={{ padding:'0.55rem 0.5rem' }}>
                        {r.subscribed
                          ? <span style={{ color:GREEN, fontWeight:700 }}>● Paid</span>
                          : r.expired
                            ? <span style={{ color:RED }}>○ Lapsed</span>
                            : <span style={{ color:BLUE }}>● Trial ({r.daysLeft}d left)</span>}
                      </td>
                      <td style={{ padding:'0.55rem 0.85rem', color:'#9DB4C5', fontSize:'0.68rem' }}>{r.emailsSent.join(' ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={load} style={{ marginTop:'1rem', padding:'0.6rem 1.2rem', background:'#fff', border:'1.5px solid '+BLUE, color:BLUE, borderRadius:9, fontSize:'0.82rem', fontWeight:700, cursor:'pointer' }}>
              ↻ Refresh
            </button>
          </>
        )}
      </div>
    </div>
  )
}
