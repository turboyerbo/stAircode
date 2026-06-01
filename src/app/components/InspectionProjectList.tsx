'use client'
/**
 * InspectionProjectList.tsx
 *
 * Project management screen — "My Inspections".
 * Shows all saved InspectionJobs from Supabase.
 * Entry point for the full building inspection workflow.
 */

import { useState, useEffect, useCallback } from 'react'
import type { InspectionJob }               from '@/lib/inspection-types'
import { NavLogo }                          from './Logo'

interface Props {
  userEmail:    string
  onStartNew:   () => void
  onResumeJob:  (job: InspectionJob) => void
  onBack:       () => void
}

const NAVY   = '#0A1C2E'
const BLUE   = '#417CA4'
const ORANGE = '#F29337'
const GREEN  = '#27A96B'
const BORDER = 'rgba(44,90,122,0.14)'
const BG     = '#F4F7FB'

type SummaryRow = {
  id:              string
  client_name:     string
  address_street:  string
  address_city:    string
  address_province: string
  building_type:   string
  status:          string
  phase_progress:  number
  active_phase:    string | null
  inspection_date: string
  updated_at:      string
  permit_number:   string | null
  thumbnail?:      string   // base64 first property photo
}

function statusColor(s: string): string {
  if (s === 'complete') return GREEN
  if (s === 'active')   return BLUE
  if (s === 'on_hold')  return ORANGE
  return '#9DB4C5'
}

function statusLabel(s: string): string {
  return { active:'In Progress', complete:'Complete', on_hold:'On Hold', archived:'Archived' }[s] ?? s
}

// Extract the first property photo from a full InspectionJob
function getJobThumbnail(job: any): string | undefined {
  if (!job?.phases) return undefined
  for (const phase of job.phases) {
    for (const mod of phase.modules ?? []) {
      const photo = mod.photos?.[0] || mod.findings?.[0]?.photos?.[0]
      if (photo && typeof photo === 'string' && !photo.startsWith('[')) return photo
    }
  }
  return undefined
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days} days ago`
  if (days < 31) return `${Math.floor(days/7)} weeks ago`
  return `${Math.floor(days/30)} months ago`
}

export default function InspectionProjectList({ userEmail, onStartNew, onResumeJob, onBack }: Props) {
  const [jobs,       setJobs]       = useState<SummaryRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [resuming,   setResuming]   = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setLoading(true); setError(null)

    // Always load sessionStorage jobs first for instant display
    const sessionJobs: SummaryRow[] = []
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith('insp_')) {
          const j = JSON.parse(sessionStorage.getItem(key) ?? '')
          if (j?.id) sessionJobs.push({
            id: j.id, client_name: j.clientName ?? '',
            address_street: j.address?.street ?? '', address_city: j.address?.city ?? '',
            address_province: j.address?.province ?? '', building_type: j.buildingType ?? '',
            status: j.status ?? 'active', phase_progress: 0, active_phase: null,
            inspection_date: j.inspectionDate ?? '', updated_at: j.updatedAt ?? j.createdAt ?? '',
            permit_number: j.permitNumber ?? null,
          })
        }
      }
    } catch {}
    if (sessionJobs.length) setJobs(sessionJobs)

    try {
      const res  = await fetch(`/api/inspection/list?email=${encodeURIComponent(userEmail)}&userId=${encodeURIComponent(userEmail)}`)
      const data = await res.json()
      if (data.ok) {
        const serverJobs = data.jobs ?? []
        // Merge: server rows take priority, then add any session-only jobs not yet synced
        const serverIds = new Set(serverJobs.map((j: SummaryRow) => j.id))
        const localOnly = sessionJobs.filter(j => !serverIds.has(j.id))
        setJobs([...serverJobs, ...localOnly])
      }
    } catch {
      // Fall back to sessionStorage jobs already set above
      const localJobs: SummaryRow[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith('insp_')) {
          try {
            const j = JSON.parse(sessionStorage.getItem(key) ?? '')
            if (j?.id) localJobs.push({
              id:              j.id,
              client_name:     j.clientName,
              address_street:  j.address.street,
              address_city:    j.address.city,
              address_province: j.address.province,
              building_type:   j.buildingType,
              status:          j.status ?? 'active',
              phase_progress:  0,
              active_phase:    null,
              inspection_date: j.inspectionDate,
              updated_at:      j.updatedAt ?? j.createdAt,
              permit_number:   j.permitNumber ?? null,
              thumbnail:       getJobThumbnail(j),
            })
          } catch {}
        }
      }
      setJobs(localJobs)
    }
    setLoading(false)
  }, [userEmail])

  useEffect(() => { loadJobs() }, [loadJobs])

  async function handleResume(id: string) {
    setResuming(id)
    try {
      // Try server first
      const res  = await fetch(`/api/inspection/load?id=${id}`)
      const data = await res.json()
      if (data.ok && data.job) { onResumeJob(data.job); return }
    } catch {}
    // Fall back to sessionStorage
    try {
      const raw = sessionStorage.getItem(`insp_${id}`)
      if (raw) { onResumeJob(JSON.parse(raw)); return }
    } catch {}
    setError('Could not load project. Please try again.')
    setResuming(null)
  }

  async function handleDelete(id: string) {
    setDeleting(id); setConfirmDel(null)
    try { await fetch(`/api/inspection/delete?id=${id}`, { method: 'DELETE' }) } catch {}
    try { sessionStorage.removeItem(`insp_${id}`) } catch {}
    setJobs(prev => prev.filter(j => j.id !== id))
    setDeleting(null)
  }

  return (
    <div style={{ minHeight: '100dvh', background: BG, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: '#0D1E2E' }}>

      {/* ── Header ── */}
      <div style={{ background: NAVY, paddingTop: 'max(env(safe-area-inset-top,0px),1rem)', paddingBottom: '1.25rem', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>← Back</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><NavLogo height={22} /></div>
          <div style={{ width: 40 }} />
        </div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>My Inspections</h1>
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', margin: '0.25rem 0 0' }}>Projects are saved to the server and available across sessions</p>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '1.25rem 1.25rem 7rem' }}>

        {/* New Inspection button */}
        <button onClick={onStartNew}
          style={{ width: '100%', padding: '1rem', background: `linear-gradient(135deg,${ORANGE},#C4721E)`, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 18px rgba(242,147,55,0.4)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="8" stroke="#fff" strokeWidth="1.5"/>
            <line x1="9" y1="5" x2="9" y2="13" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="5" y1="9" x2="13" y2="9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Start New Inspection
        </button>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(232,69,69,0.08)', border: '1px solid rgba(232,69,69,0.25)', borderRadius: 9, padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#E84545', marginBottom: '1rem' }}>{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0', gap: '0.4rem', alignItems: 'center' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE, opacity: 0.4, animation: 'pulse 1.2s ease infinite', animationDelay: `${i * 0.2}s` }}/>)}
            <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
          </div>
        )}

        {/* Empty state */}
        {!loading && jobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(65,124,164,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="18" rx="2" stroke={BLUE} strokeWidth="1.5"/>
                <line x1="7" y1="8" x2="17" y2="8" stroke={BLUE} strokeWidth="1.2"/>
                <line x1="7" y1="12" x2="13" y2="12" stroke={BLUE} strokeWidth="1.2"/>
              </svg>
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0D1E2E', marginBottom: '0.35rem' }}>No inspections yet</div>
            <div style={{ fontSize: '0.78rem', color: '#5E7D9B', lineHeight: 1.6 }}>Start a new inspection above. Projects are saved automatically and can be resumed across sessions.</div>
          </div>
        )}

        {/* Project list */}
        {!loading && jobs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#5E7D9B', marginBottom: '0.1rem' }}>
              {jobs.length} project{jobs.length !== 1 ? 's' : ''}
            </div>
            {jobs.map(job => (
              <div key={job.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '1rem', boxShadow: '0 1px 4px rgba(44,74,110,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  {/* Thumbnail */}
                  {job.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/jpeg;base64,${job.thumbnail}`}
                      alt="property"
                      style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: `1px solid ${BORDER}` }}
                    />
                  )}
                  {!job.thumbnail && (
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: 'rgba(65,124,164,0.08)', border: `1px solid ${BORDER}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <rect x="2" y="4" width="18" height="14" rx="2" stroke={BLUE} strokeWidth="1.3" fill="none"/>
                        <path d="M2 14l5-4 4 3 3-2 6 5" stroke={BLUE} strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                        <circle cx="7" cy="9" r="1.5" fill={BLUE} fillOpacity="0.5"/>
                      </svg>
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0D1E2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {job.address_street || 'No address'}{job.address_city ? `, ${job.address_city}` : ''}
                      </div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 600, color: statusColor(job.status), background: `${statusColor(job.status)}14`, padding: '0.12rem 0.45rem', borderRadius: 4, border: `1px solid ${statusColor(job.status)}33`, flexShrink: 0 }}>
                        {statusLabel(job.status)}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#5E7D9B', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                      {job.client_name && <span style={{ marginRight: '0.5rem' }}>Client: <strong>{job.client_name}</strong></span>}
                      {job.building_type.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}
                      {job.permit_number && <span style={{ marginLeft: '0.5rem', color: '#9DB4C5' }}>Permit: {job.permit_number}</span>}
                    </div>
                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: 4, background: 'rgba(44,90,122,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${job.phase_progress}%`, background: job.phase_progress === 100 ? GREEN : BLUE, borderRadius: 2, transition: 'width 0.4s' }}/>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#5E7D9B', flexShrink: 0 }}>{job.phase_progress}%</div>
                    </div>
                    {job.active_phase && (
                      <div style={{ fontSize: '0.65rem', color: BLUE, marginTop: '0.3rem' }}>Current: {job.active_phase}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: '0.62rem', color: '#9DB4C5' }}>Updated {timeAgo(job.updated_at)}</div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {/* Delete with confirm */}
                    {confirmDel === job.id ? (
                      <>
                        <span style={{ fontSize: '0.7rem', color: '#E84545', marginRight: '0.2rem' }}>Delete?</span>
                        <button onClick={() => handleDelete(job.id)} disabled={deleting === job.id}
                          style={{ padding: '0.4rem 0.7rem', background: deleting === job.id ? 'rgba(232,69,69,0.1)' : '#E84545', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: '0.72rem', cursor: deleting === job.id ? 'default' : 'pointer' }}>
                          {deleting === job.id ? '…' : 'Yes, delete'}
                        </button>
                        <button onClick={() => setConfirmDel(null)}
                          style={{ padding: '0.4rem 0.6rem', background: 'rgba(44,90,122,0.07)', border: `1px solid ${BORDER}`, borderRadius: 7, color: '#5E7D9B', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDel(job.id)}
                        style={{ padding: '0.4rem 0.55rem', background: 'none', border: `1px solid rgba(232,69,69,0.25)`, borderRadius: 7, color: '#E84545', fontSize: '0.72rem', cursor: 'pointer', lineHeight: 1 }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M2 3h9M5 3V2h3v1M3.5 3l.5 8h5l.5-8" stroke="#E84545" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleResume(job.id)}
                      disabled={resuming === job.id}
                      style={{ padding: '0.45rem 1rem', background: resuming === job.id ? 'rgba(65,124,164,0.1)' : BLUE, border: 'none', borderRadius: 7, color: resuming === job.id ? BLUE : '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: resuming === job.id ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                      {resuming === job.id ? 'Loading…' : 'Resume →'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
