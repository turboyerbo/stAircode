'use client'
/**
 * /research — stAIrcode Research & Data page
 */

export default function ResearchPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #F7FAFC; color: #0D1E2E; -webkit-font-smoothing: antialiased; }
        .nav-cta { display: inline-flex; align-items: center; gap: 6px; background: #F29337; color: #fff; font-weight: 700; font-size: 0.88rem; padding: 10px 22px; border-radius: 6px; text-decoration: none; transition: background 0.15s; }
        .nav-cta:hover { background: #d97b1f; }
        .stat-card { background: #fff; border: 1px solid #E2EAF0; border-radius: 12px; padding: 1.5rem; }
        .stat-card .num { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.04em; color: #F29337; }
        .stat-card .lbl { font-size: 0.82rem; color: #5E7D9B; margin-top: 4px; line-height: 1.45; }
        .source-card { background: #fff; border: 1px solid #E2EAF0; border-radius: 10px; padding: 1.25rem 1.5rem; }
        .source-card .title { font-weight: 700; font-size: 0.9rem; color: #0D1E2E; margin-bottom: 0.25rem; }
        .source-card .meta  { font-size: 0.78rem; color: #5E7D9B; line-height: 1.55; }
        .source-card a { color: #F29337; text-decoration: none; }
        .source-card a:hover { text-decoration: underline; }
      `}</style>

      {/* Nav */}
      <header style={{ background: '#fff', borderBottom: '1px solid #E2EAF0', padding: '0 1.25rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/marketing" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo_icon_blue.png" alt="stAIrcode" style={{ height: 28 }} />
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0D1E2E', letterSpacing: '-0.02em' }}>
            st<span style={{ color: '#F29337' }}>AI</span>rcode
          </span>
        </a>
        <a href="/?signin=1" className="nav-cta">Try stAIrcode FREE →</a>
      </header>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '3.5rem 1.25rem 5rem' }}>

        {/* Hero callout */}
        <div style={{ background: '#0A1C2E', borderRadius: 16, padding: '2.5rem 2rem', marginBottom: '3rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(65,124,164,0.06) 27px,rgba(65,124,164,0.06) 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,rgba(65,124,164,0.06) 27px,rgba(65,124,164,0.06) 28px)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F29337', marginBottom: '0.75rem' }}>The Cost of Non-Compliance</div>
            <div style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', fontWeight: 800, letterSpacing: '-0.05em', color: '#F29337', lineHeight: 1 }}>$92B+</div>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', marginTop: '0.75rem', maxWidth: 560, lineHeight: 1.6 }}>
              The direct medical costs of non-fatal stair fall injuries in the United States are estimated at over $92 billion annually — making stair safety one of the most costly preventable injury categories in North America.
            </p>
          </div>
        </div>

        {/* Stat grid */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F29337', marginBottom: '1rem' }}>Key Statistics</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          {[
            { num: '1,800',   lbl: 'Emergency department visits per day from unintentional falls — Canada' },
            { num: '417',     lbl: 'Hospital admissions per day from fall injuries — Canada' },
            { num: '20%',     lbl: 'Of fall-related injury hospitalizations in seniors involve stairs' },
            { num: '+50%',    lbl: 'Increased trip risk from riser height inconsistency greater than 3/8 inch (9.5mm)' },
            { num: '9.5mm',   lbl: 'Maximum riser height variation permitted under OBC, NBC, and IBC' },
            { num: '36,000+', lbl: 'Stair-related injuries requiring hospitalization annually in Canada' },
          ].map(s => (
            <div key={s.num} className="stat-card">
              <div className="num">{s.num}</div>
              <div className="lbl">{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Full problem text */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '1.25rem', color: '#0D1E2E' }}>The Problem Is Real</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.95rem', lineHeight: 1.8, color: '#2C4A68' }}>
            <p>Unintentional falls result in almost <strong>1,800 emergency department visits</strong> and <strong>417 hospital admissions every day</strong> in Canada alone. Falls are the leading cause of injury-related hospitalizations for Canadians aged 65 and older.</p>
            <p>In Canada, falls on stairs account for roughly <strong>20% of fall-related injury hospitalizations among seniors</strong>. The dimensional inconsistency of risers — when adjacent risers vary by more than 3/8 inch (9.5 mm) — <strong>increases trip risk by over 50%</strong>, according to research published in the Journal of Safety Research.</p>
            <p>Non-compliant stairs injure and kill people. The regulatory requirement to check stairs against building codes is real — OBC, NBC, IBC, and their international equivalents all contain explicit dimensional tolerances precisely because the evidence supporting them is so strong.</p>
            <p>Yet the gap between <em>&ldquo;I have stairs&rdquo;</em> and <em>&ldquo;I know if they&apos;re compliant&rdquo;</em> is enormous. Hiring a licensed building inspector costs $300&ndash;$600 and requires scheduling. A tape measure and the knowledge to interpret it correctly are not tools most homeowners or real estate professionals carry. stAIrcode addresses that gap.</p>
          </div>
        </div>

        {/* What causes non-compliance */}
        <div style={{ background: '#fff', border: '1px solid #E2EAF0', borderRadius: 14, padding: '2rem', marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: '#0D1E2E' }}>What Causes Non-Compliant Stairs?</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { icon: '🔨', title: 'DIY construction and renovations', body: 'Non-permitted work carried out without reference to current code requirements. Riser heights are the most commonly violated dimension.' },
              { icon: '📅', title: 'Age and settlement', body: 'Older homes built to superseded codes, or where natural settlement has caused dimensional drift that pushes stairs out of compliance over time.' },
              { icon: '📏', title: 'Measurement error during construction', body: 'Even permitted work can fail final inspection. A 5mm cumulative error across a 10-riser staircase produces the exact inconsistency pattern associated with elevated fall risk.' },
              { icon: '📋', title: 'Absence of pre-listing inspection', body: 'Real estate transactions often proceed without a stair-specific compliance check. Sellers and buyers are both exposed.' },
            ].map(c => (
              <div key={c.title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{c.icon}</span>
                <div>
                  <strong style={{ fontSize: '0.9rem', color: '#0D1E2E' }}>{c.title}</strong>
                  <p style={{ fontSize: '0.82rem', color: '#5E7D9B', marginTop: '0.2rem', lineHeight: 1.55 }}>{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sources */}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '1.25rem', color: '#0D1E2E' }}>Sources & References</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              {
                title: 'Stair-related injuries in the United States',
                meta: 'Startzell, J.K., Owens, D.A., Mulfinger, L.M., & Cavanagh, P.R. (2000). Stair negotiation in older people: a review. Journal of the American Geriatrics Society, 48(5), 567–580.',
                note: 'Foundation study quantifying riser inconsistency and trip risk.',
              },
              {
                title: 'Public Health Agency of Canada — Fall Prevention',
                meta: 'Public Health Agency of Canada. (2022). The Chief Public Health Officer\'s Report on the State of Public Health in Canada. Government of Canada.',
                url: 'https://www.canada.ca/en/public-health/services/injury-prevention/falls.html',
                note: 'Source for 1,800 ER visits / 417 daily admissions figures.',
              },
              {
                title: 'Riser height inconsistency and stair accident risk',
                meta: 'Templer, J., Mullet, G., Archea, J., & Margulis, S.T. (1985). An analysis of the behaviour of stair users. US Department of Commerce, National Bureau of Standards.',
                note: 'Classic reference for the >50% trip risk increase with >9.5mm riser variation.',
              },
              {
                title: 'Economic burden of fall-related injuries',
                meta: 'Florence, C.S., Bergen, G., Atherly, A., Burns, E., Stevens, J., & Drake, C. (2018). Medical costs of fatal and nonfatal falls in older adults. Journal of the American Geriatrics Society, 66(4), 693–698.',
                url: 'https://doi.org/10.1111/jgs.15304',
                note: 'Source for $92B annual US medical cost estimate.',
              },
            ].map((s, i) => (
              <div key={i} className="source-card">
                <div className="title">[{i + 1}] {s.title}</div>
                <div className="meta">{s.meta}</div>
                {s.url && <div className="meta" style={{ marginTop: 4 }}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a></div>}
                {s.note && <div style={{ fontSize: '0.78rem', color: '#5E7D9B', marginTop: 4, fontStyle: 'italic' }}>{s.note}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: '4rem', padding: '2.5rem 1.5rem', background: '#0A1C2E', borderRadius: 14 }}>
          <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '1.3rem', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>Check your stairs in under 5 minutes</h3>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>Free scan. No download. Just your phone.</p>
          <a href="/?signin=1" className="nav-cta" style={{ fontSize: '1rem', padding: '13px 28px' }}>Try stAIrcode FREE →</a>
        </div>
      </main>

      <footer style={{ background: '#0A1C2E', color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', padding: '1.5rem 1.25rem', textAlign: 'center' }}>
        © {new Date().getFullYear()} Just Open Technologies Inc. — <a href="/marketing" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>staircode.app</a>
      </footer>
    </>
  )
}
