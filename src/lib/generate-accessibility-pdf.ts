/**
 * generate-accessibility-pdf.ts
 * Purple-accented accessibility compliance PDF using pdf-lib.
 * Sections: header, summary chips, inspection photos, compliance table,
 *           OBC code references, AI narrative, disclaimer + module metadata.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const PURPLE  = rgb(0.482, 0.369, 0.655)  // #7B5EA7
const ORANGE  = rgb(0.949, 0.576, 0.216)
const NAVY    = rgb(0.039, 0.110, 0.180)
const LIGHT   = rgb(0.957, 0.969, 0.984)
const TEXT    = rgb(0.051, 0.118, 0.180)
const TEXT2   = rgb(0.369, 0.490, 0.608)
const PASS    = rgb(0.153, 0.663, 0.420)
const FAIL    = rgb(0.910, 0.333, 0.333)
const WARN    = rgb(0.949, 0.576, 0.216)
const BORDER  = rgb(0.898, 0.918, 0.945)
const WHITE   = rgb(1, 1, 1)
const STRIPE  = rgb(0.482, 0.369, 0.655)

const FRAME_LABELS: Record<string,string> = {
  doorway:                'Doorway Width',
  corridor:               'Corridor Width',
  turning_space:          'Turning Space',
  ramp:                   'Ramp Assessment',
  floor_alarm_overview:   'Floor Alarm Coverage',
  sleeping_room_alarm:    'Sleeping Room Alarm',
  washroom_entry:         'Washroom Entry',
  washroom_turning:       'Washroom Turning Space',
  grab_bars:              'Grab Bars & Fixtures',
  sink_counter:           'Sink & Counter Height',
  pool_deck_approach:     'Pool Deck Approach',
  pool_lift:              'Pool Lift / Access',
  wheelchair_spaces:      'Wheelchair Seating Spaces',
  mobility_storage:       'Mobility Device Storage',
}

export interface AccessibilityPDFParams {
  measurements: any
  fields:       any[]
  reportText:   string
  codeLabel:    string
  location:     string
  date:         string
  frames:       Record<string,string>
  moduleId:     string
}

export async function generateAccessibilityPDF(params: AccessibilityPDFParams): Promise<Buffer> {
  const { measurements, fields, reportText, codeLabel, location, date, frames, moduleId } = params

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`stAIrcode Accessibility Report — ${location||codeLabel}`)
  pdfDoc.setAuthor('stAIrcode by Just Open Technologies Inc.')
  pdfDoc.setSubject('Accessibility Compliance Report')
  pdfDoc.setKeywords([`module:accessibility`, `moduleId:${moduleId}`, `category:${measurements.category??'unknown'}`, `code:${codeLabel}`])

  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const PW = 595.28, PH = 841.89, ML = 50, MR = 50, CW = PW - ML - MR
  let page = pdfDoc.addPage([PW, PH])
  let y = PH - 20

  const newPage = () => { page = pdfDoc.addPage([PW, PH]); y = PH - 50 }
  const ensureSpace = (n: number) => { if (y - n < 60) newPage() }
  const sectionBar = (title: string, col = NAVY) => {
    ensureSpace(30)
    page.drawRectangle({ x:ML, y:y-22, width:CW, height:22, color:col })
    page.drawText(title, { x:ML+8, y:y-16, size:9, font:boldFont, color:WHITE })
    y -= 30
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  page.drawRectangle({ x:0, y:PH-115, width:PW, height:115, color:NAVY })
  for (let sx = -80; sx < PW+80; sx += 22) page.drawRectangle({ x:sx, y:PH-115, width:11, height:115, color:STRIPE, opacity:0.28 })
  page.drawRectangle({ x:0, y:PH-115, width:8, height:115, color:PURPLE })
  page.drawRectangle({ x:ML-10, y:PH-107, width:CW+20, height:97, color:NAVY })

  // Logo
  page.drawText('st',    { x:PW/2-62, y:PH-42, size:20, font:boldFont, color:WHITE })
  page.drawText('AI',    { x:PW/2-34, y:PH-42, size:20, font:boldFont, color:ORANGE })
  page.drawText('rcode', { x:PW/2-12, y:PH-42, size:20, font:boldFont, color:WHITE })

  const titleText = 'Accessibility Compliance Report'
  const titleW = boldFont.widthOfTextAtSize(titleText, 15)
  page.drawText(titleText, { x:PW/2-titleW/2, y:PH-68, size:15, font:boldFont, color:WHITE })

  const catLabel = (measurements.category??'accessibility').replace(/_/g,' ').toUpperCase()
  const badgeW = boldFont.widthOfTextAtSize(catLabel, 7.5) + 16
  page.drawRectangle({ x:PW/2-badgeW/2, y:PH-88, width:badgeW, height:13, color:PURPLE, opacity:0.9 })
  const bW = boldFont.widthOfTextAtSize(catLabel, 7.5)
  page.drawText(catLabel, { x:PW/2-bW/2, y:PH-85, size:7.5, font:boldFont, color:WHITE })

  const subText = `${codeLabel}${location?' · '+location:''} · ${date}`
  const subW = regularFont.widthOfTextAtSize(subText, 9)
  page.drawText(subText, { x:PW/2-subW/2, y:PH-104, size:9, font:regularFont, color:rgb(0.576,0.729,0.831) })
  y = PH - 130

  // ── Summary chips ────────────────────────────────────────────────────────────
  const passCount  = fields.filter(f => f.pass === true).length
  const flagCount  = fields.filter(f => f.pass === false).length
  const critCount  = fields.filter(f => f.pass === false && f.severity === 'critical').length
  const chips = [{ label:'PASS', val:passCount, col:PASS }, { label:'FLAG', val:flagCount, col:WARN }, { label:'CRITICAL', val:critCount, col:FAIL }]
  const chipW = CW/3 - 8
  let cx = ML
  for (const chip of chips) {
    page.drawRectangle({ x:cx, y:y-44, width:chipW, height:44, color:LIGHT, borderColor:BORDER, borderWidth:0.5 })
    const nStr = String(chip.val)
    const nW = boldFont.widthOfTextAtSize(nStr, 20)
    page.drawText(nStr, { x:cx+chipW/2-nW/2, y:y-24, size:20, font:boldFont, color:chip.col })
    const lW = regularFont.widthOfTextAtSize(chip.label, 7)
    page.drawText(chip.label, { x:cx+chipW/2-lW/2, y:y-38, size:7, font:regularFont, color:TEXT2 })
    cx += chipW+12
  }
  y -= 60

  // ── Photos ───────────────────────────────────────────────────────────────────
  const validFrames = Object.entries(frames).filter(([k,v]) => FRAME_LABELS[k] && v && v.length>100)
  if (validFrames.length > 0) {
    sectionBar('INSPECTION PHOTOS')
    const imgW = (CW-12)/2, imgH = 130, lblH = 18
    for (let i = 0; i < validFrames.length; i += 2) {
      ensureSpace(imgH+lblH+12)
      const pair = validFrames.slice(i, i+2)
      for (let j = 0; j < pair.length; j++) {
        const [posId, b64raw] = pair[j]
        const imgX = ML + j*(imgW+12), imgY = y-imgH
        page.drawRectangle({ x:imgX, y:imgY, width:imgW, height:imgH, borderColor:BORDER, borderWidth:0.5, color:LIGHT })
        try {
          const raw = b64raw.startsWith('data:') ? b64raw.split(',')[1] : b64raw
          const bytes = Uint8Array.from(Buffer.from(raw, 'base64'))
          let img; try { img = await pdfDoc.embedJpg(bytes) } catch { img = await pdfDoc.embedPng(bytes) }
          const { width:iw, height:ih } = img
          const scale = Math.min(imgW/iw, imgH/ih)
          const dw = iw*scale, dh = ih*scale
          page.drawImage(img, { x:imgX+(imgW-dw)/2, y:imgY+(imgH-dh)/2, width:dw, height:dh })
        } catch { page.drawText('Photo unavailable', { x:imgX+imgW/2-30, y:imgY+imgH/2, size:8, font:regularFont, color:TEXT2 }) }
        const lbl = FRAME_LABELS[posId]??posId
        const lW = boldFont.widthOfTextAtSize(lbl, 8)
        page.drawText(lbl, { x:imgX+imgW/2-lW/2, y:imgY-14, size:8, font:boldFont, color:TEXT })
      }
      y -= imgH+lblH+8
    }
    y -= 8
  }

  // ── Compliance table ──────────────────────────────────────────────────────────
  sectionBar('COMPLIANCE CHECK RESULTS')
  page.drawRectangle({ x:ML, y:y-18, width:CW, height:18, color:LIGHT })
  page.drawText('Check',           { x:ML+4,   y:y-13, size:8, font:boldFont, color:TEXT2 })
  page.drawText('Measured',        { x:ML+190,  y:y-13, size:8, font:boldFont, color:TEXT2 })
  page.drawText('Required',        { x:ML+285,  y:y-13, size:8, font:boldFont, color:TEXT2 })
  page.drawText('Result',          { x:ML+380,  y:y-13, size:8, font:boldFont, color:TEXT2 })
  y -= 18
  for (let i = 0; i < fields.length; i++) {
    ensureSpace(22)
    const f = fields[i]
    page.drawRectangle({ x:ML, y:y-20, width:CW, height:20, color:i%2===0?WHITE:LIGHT, borderColor:BORDER, borderWidth:0.25 })
    const measured  = f.measured != null ? `${f.measured}${typeof f.measured==='number'?' mm':''}` : '—'
    const required  = f.required != null ? `${f.required}${typeof f.required==='number'?' mm':''}` : '—'
    const status    = f.pass===true?'PASS':f.pass===false?(f.severity==='critical'?'CRITICAL':'FLAG'):'N/A'
    const sCol      = f.pass===true?PASS:f.pass===false?(f.severity==='critical'?FAIL:WARN):TEXT2
    page.drawText(f.label,   { x:ML+4,    y:y-14, size:7.5, font:regularFont, color:TEXT })
    page.drawText(measured,  { x:ML+190,   y:y-14, size:7.5, font:regularFont, color:TEXT })
    page.drawText(required,  { x:ML+285,   y:y-14, size:7.5, font:regularFont, color:TEXT })
    page.drawText(status,    { x:ML+380,   y:y-14, size:7.5, font:boldFont,    color:sCol })
    y -= 20
    if (f.note) {
      ensureSpace(14)
      const noteW = regularFont.widthOfTextAtSize(f.note, 7)
      if (noteW <= CW-8) { page.drawText(f.note, { x:ML+8, y:y-10, size:7, font:regularFont, color:TEXT2 }); y -= 13 }
    }
  }
  y -= 8

  // ── OBC Code References ───────────────────────────────────────────────────────
  sectionBar('APPLICABLE CODE REFERENCES', PURPLE)
  const refs = [
    'OBC 2024 §3.8.1 — Barrier-free path of travel: doorway widths (min 860mm), corridor widths (min 900mm)',
    'OBC 2024 §3.8.1.5 — Turning spaces: 1500mm × 1500mm clear at key locations',
    'OBC 2024 §3.8.3 — Ramps: min 900mm wide, max 1:10 slope, landings min 1500mm deep',
    'OBC 2024 §3.2.4 / NFPA 72 — Visual fire alarms in all public spaces and sleeping rooms',
    'OBC 2024 §3.8.4 — Barrier-free washrooms: turning space, grab bars, counter heights',
    'OBC 2024 §3.8.5 — Pool and spa access: barrier-free deck, pool lift requirements',
    'OBC 2024 §3.8.6 — Accessible seating: wheelchair spaces 900×1400mm, companion seating',
    'AODA (Ontario) — Accessibility for Ontarians with Disabilities Act, 2005',
  ]
  for (const ref of refs) {
    ensureSpace(14)
    page.drawText(`• ${ref}`, { x:ML+4, y, size:7.5, font:regularFont, color:TEXT2 })
    y -= 13
  }
  y -= 8

  // ── AI Narrative ──────────────────────────────────────────────────────────────
  sectionBar('DETAILED ASSESSMENT')
  for (const line of reportText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) { y -= 6; continue }
    const isHdr = /^[0-9]+\.\s+[A-Z\s]+$/.test(trimmed)
    const fs = isHdr ? 10 : 9
    const font = isHdr ? boldFont : regularFont
    const col  = isHdr ? ORANGE : TEXT
    if (isHdr) { ensureSpace(20); y -= 4 }
    const words = trimmed.split(' '), lines: string[] = []
    let cur = ''
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w
      if (font.widthOfTextAtSize(test, fs) > CW && cur) { lines.push(cur); cur = w } else cur = test
    }
    if (cur) lines.push(cur)
    for (const l of lines) { ensureSpace(fs+4); page.drawText(l, { x:ML, y, size:fs, font, color:col }); y -= fs+3 }
    if (isHdr) y -= 3
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────────
  ensureSpace(50)
  y -= 12
  page.drawLine({ start:{x:ML,y}, end:{x:ML+CW,y}, thickness:0.5, color:BORDER })
  y -= 12
  const disc = `AI-assisted visual screening — not a certified accessibility audit. Accuracy ±15–25mm. All findings must be confirmed by a licensed architect, engineer, or certified accessibility consultant. Module ID: ${moduleId} · staircode.app · © ${new Date().getFullYear()} Just Open Technologies Inc.`
  let dLine = ''
  for (const w of disc.split(' ')) {
    const test = dLine ? `${dLine} ${w}` : w
    if (regularFont.widthOfTextAtSize(test, 7.5) > CW && dLine) {
      const dW = regularFont.widthOfTextAtSize(dLine, 7.5)
      page.drawText(dLine, { x:PW/2-dW/2, y, size:7.5, font:regularFont, color:TEXT2 }); y -= 11; dLine = w
    } else dLine = test
  }
  if (dLine) { const dW = regularFont.widthOfTextAtSize(dLine, 7.5); page.drawText(dLine, { x:PW/2-dW/2, y, size:7.5, font:regularFont, color:TEXT2 }) }

  return Buffer.from(await pdfDoc.save())
}
