/**
 * src/lib/trial-emails.ts
 *
 * Branded HTML templates + sender for the 7-day trial nurture sequence.
 *   Day 1 — onboarding: run your first scan
 *   Day 5 — urgency: 2 days left + what you've built
 *   Day 7 — trial ended: your saved work is behind the paywall
 *
 * Uses Resend. Sender is shared so all transactional emails look consistent.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://staircode.app'
const FROM    = process.env.EMAIL_FROM ?? 'info@staircode.app'
const LOGO    = `${APP_URL}/staircode_logo.png`

type Stage = 'day1' | 'day5' | 'day7'

// ── Shared shell ────────────────────────────────────────────────────────────
function shell(inner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EBF3FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:1.5rem 1rem;">
  <div style="background:#0A1C2E;border-radius:16px 16px 0 0;padding:1.75rem 2rem 1.25rem;text-align:center;">
    <img src="${LOGO}" alt="stAIrcode" style="height:38px;display:block;margin:0 auto;" />
  </div>
  <div style="background:#fff;padding:2rem;border-radius:0 0 16px 16px;border:1px solid #DCE7F0;border-top:none;">
    ${inner}
  </div>
  <div style="text-align:center;padding:1.25rem 1rem;color:#9DB4C5;font-size:0.7rem;line-height:1.6;">
    stAIrcode by Just Open Technologies Inc.<br/>
    <a href="${APP_URL}" style="color:#5E7D9B;">staircode.app</a> ·
    Building code compliance, anywhere.
  </div>
</div></body></html>`
}

function button(label: string, href: string, color = '#27A96B'): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:0.85rem 1.75rem;border-radius:10px;margin:0.5rem 0;">${label}</a>`
}

// ── Templates ───────────────────────────────────────────────────────────────
function day1(name: string) {
  return {
    subject: "Your first scan takes 2 minutes — here's how",
    html: shell(`
      <h1 style="font-size:1.4rem;font-weight:800;color:#0A1C2E;margin:0 0 0.75rem;letter-spacing:-0.02em;">Welcome aboard, ${name} 👋</h1>
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1rem;">
        Your 7-day free trial is live. The fastest way to see what stAIrcode does is to run a quick stair scan — point your phone, and the AI measures rise, run, headroom, nosing, and handrail, then checks each one against your local building code in seconds.
      </p>
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1.25rem;">
        No tape measure. No setup. Just see it work.
      </p>
      <div style="text-align:center;margin:1.5rem 0;">
        ${button('Run your first scan →', `${APP_URL}/?scan=stair`)}
      </div>
      <div style="background:#F7FAFC;border-radius:10px;padding:1rem 1.25rem;margin-top:1rem;">
        <p style="font-size:0.85rem;color:#5E7D9B;line-height:1.6;margin:0;">
          <strong style="color:#0A1C2E;">Ready for a real project?</strong> Start a full inspection with as much or as little detail as you need — from a quick address-only pre-screen to a complete multi-phase report. stAIrcode scales to any project, anywhere in the world.
        </p>
      </div>
    `),
  }
}

function day5(name: string, daysLeft: number, counts?: { projects: number; reports: number }) {
  const hasWork = counts && (counts.projects > 0 || counts.reports > 0)
  // Personalized banner showing what they've actually built
  const workBanner = hasWork ? `
      <div style="background:#F0F8F4;border:1px solid rgba(39,169,107,0.3);border-radius:10px;padding:1.1rem 1.25rem;margin:0 0 1.25rem;">
        <p style="font-size:0.82rem;color:#1A7A50;line-height:1.6;margin:0 0 0.4rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">What you've built so far</p>
        <p style="font-size:1.05rem;color:#0A1C2E;line-height:1.5;margin:0;font-weight:700;">
          ${counts!.projects} ${counts!.projects === 1 ? 'project' : 'projects'}${counts!.reports > 0 ? ` · ${counts!.reports} ${counts!.reports === 1 ? 'report' : 'reports'}` : ''}
        </p>
        <p style="font-size:0.8rem;color:#5E7D9B;line-height:1.6;margin:0.5rem 0 0;">
          All of it stays saved and accessible the moment you subscribe — and disappears from view when your trial ends.
        </p>
      </div>` : ''

  return {
    subject: hasWork
      ? `${daysLeft} days left — don't lose your ${counts!.projects} ${counts!.projects === 1 ? 'project' : 'projects'}`
      : `${daysLeft} days left in your stAIrcode trial`,
    html: shell(`
      <h1 style="font-size:1.4rem;font-weight:800;color:#0A1C2E;margin:0 0 0.75rem;letter-spacing:-0.02em;">${daysLeft} days left, ${name}</h1>
      ${workBanner}
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1rem;">
        Your free trial ends soon. If stAIrcode has been useful, now's the moment to lock in continued access — every project, report, and photo you've created stays exactly where it is.
      </p>
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1.25rem;">
        With a membership you keep:
      </p>
      <ul style="font-size:0.9rem;color:#3A5A78;line-height:1.9;margin:0 0 1.25rem;padding-left:1.1rem;">
        <li>Unlimited AI-vision scans and compliance checks</li>
        <li>Full multi-phase inspection workflows</li>
        <li>Professional PDF reports, emailed from the field</li>
        <li>Cloud-stored projects, retrievable anytime</li>
        <li>The in-field AI code assistant</li>
      </ul>
      <div style="text-align:center;margin:1.5rem 0;">
        ${button('Keep my access →', `${APP_URL}/?subscribe=1`)}
      </div>
      <p style="font-size:0.8rem;color:#9DB4C5;line-height:1.6;margin:1rem 0 0;text-align:center;">
        $38.99/month · cancel anytime
      </p>
    `),
  }
}

function day7(name: string) {
  return {
    subject: 'Your trial has ended — your projects are saved',
    html: shell(`
      <h1 style="font-size:1.4rem;font-weight:800;color:#0A1C2E;margin:0 0 0.75rem;letter-spacing:-0.02em;">Your free trial has ended</h1>
      <p style="font-size:0.92rem;color:#3A5A78;line-height:1.7;margin:0 0 1rem;">
        ${name}, your 7-day trial is up — but nothing has been deleted. Every project, report, and photo you created is saved and waiting. Subscribe to pick up exactly where you left off.
      </p>
      <div style="background:#FFF6ED;border:1px solid rgba(242,147,55,0.3);border-radius:10px;padding:1rem 1.25rem;margin:1.25rem 0;">
        <p style="font-size:0.88rem;color:#9A5A1E;line-height:1.6;margin:0;">
          <strong>Your work is held securely.</strong> Reactivate any time to regain full access to your saved projects and reports.
        </p>
      </div>
      <div style="text-align:center;margin:1.5rem 0;">
        ${button('Reactivate my account →', `${APP_URL}/?subscribe=1`, '#F29337')}
      </div>
      <p style="font-size:0.8rem;color:#9DB4C5;line-height:1.6;margin:1rem 0 0;text-align:center;">
        $38.99/month · cancel anytime · your data is never deleted
      </p>
    `),
  }
}

export function buildTrialEmail(stage: Stage, name: string, daysLeft = 0, counts?: { projects: number; reports: number }) {
  const safeName = (name || '').trim() || 'there'
  if (stage === 'day1') return day1(safeName)
  if (stage === 'day5') return day5(safeName, daysLeft, counts)
  return day7(safeName)
}

/** Sends one email via Resend. Returns true on success. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[trial-emails] RESEND_API_KEY not set — skipping send to', to)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: `stAIrcode <${FROM}>`, to: [to], subject, html }),
    })
    return res.ok
  } catch (err) {
    console.error('[trial-emails] send failed:', err)
    return false
  }
}
