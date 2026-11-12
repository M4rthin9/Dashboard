import { formatNumber, visitDateLabel, parseExtraVisitors, prisonersOf, normalizeStatus } from './format';
import { monthLabel } from './dashboard';
import { bookingPool } from './management';
import type { Reservation } from '../api/types';
import type { FinancialDayRow, FinancialMonthRow, FinancialSummary } from './dashboard';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRINT_SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Sarabun', sans-serif; font-size: 12px; color: #111; padding: 15px; }
  .print-header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #000; padding-bottom: 10px; }
  .print-header h1 { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
  .print-header h2 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
  .print-header p { font-size: 12px; color: #555; }
  .print-title { font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
  th, td { border: 1px solid #000; padding: 5px 7px; text-align: left; }
  th { background: #f0f0f0; font-weight: 700; font-size: 10px; text-transform: uppercase; }
  tr:nth-child(even) { background: #fafafa; }
  .print-footer { text-align: center; font-size: 10px; color: #888; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 6px; }
  @media print {
    body { padding: 0; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .print-header { border-bottom-color: #000; }
    th { background: #e8e8e8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr:nth-child(even) { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .tear-off { page-break-inside: avoid; }
  }
`;

export function openPrintWindow(content: string, reportName: string, printerName: string): boolean {
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(`
    <!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${escapeHtml(reportName)}</title>
    <style>${PRINT_SHARED_CSS}</style>
    </head><body>
    <div class="no-print print-preview-bar" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1a1a2e;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:'Sarabun',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
      <span style="font-weight:600;">📋 ตัวอย่างก่อนพิมพ์</span>
      <div style="display:flex;gap:8px;">
        <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:14px;">🖨️ พิมพ์</button>
        <button onclick="window.close()" style="background:#dc2626;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:14px;">✕ ปิด</button>
      </div>
    </div>
    <div class="no-print" style="margin-top:50px;"></div>
    <div class="print-header"><h1>ทัณฑสถานบำบัดพิเศษกลาง</h1><h2>Chance &amp; Change Cafe</h2></div>
    ${content}
    <div class="print-footer">ผู้ปริ้น: ${escapeHtml(printerName)} • พิมพ์เมื่อ ${now}</div>
    </body></html>
  `);
  win.document.close();
  win.focus();
  return true;
}

const DAILY_REPORT_CSS = `
  @page { size:A4 portrait; margin:10mm; }
  .print-header { text-align:center; border:0; margin:0 0 5px; padding:0; }
  .print-header h1 { display:inline; font-size:11px; font-weight:400; color:#222; }
  .print-header h2 { display:inline; margin-left:8px; font-size:11px; color:#222; }
  .print-footer { font-size:9px; margin-top:8px; padding-top:4px; color:#444; }
  .daily-report { color:#111; line-height:1.3; font-size:12px; }
  .daily-report * { overflow-wrap:anywhere; }
  .daily-report .doc-heading { text-align:center; margin-bottom:6px; }
  .daily-report .doc-kicker { display:none; }
  .daily-report h2 { font-size:16px; line-height:1.35; margin:2px 0; color:#111; }
  .daily-report .doc-subtitle, .daily-report .muted { color:#333; font-size:11px; }
  .daily-report .stats { display:flex; flex-wrap:wrap; gap:4px 18px; margin:6px 0; padding:4px 0; border-top:1px solid #777; border-bottom:1px solid #777; }
  .daily-report .stat { font-size:11px; }
  .daily-report .stat span, .daily-report .stat strong, .daily-report .stat small { display:inline; font-size:11px; margin-right:4px; color:#111; }
  .daily-report h3 { font-size:12px; color:#111; margin:8px 0 3px; }
  .daily-report table { width:100%; border-collapse:collapse; font-size:12px; margin:4px 0; }
  .daily-report th { background:#f1f1f1; color:#111; font-size:11px; font-weight:700; text-transform:none; }
  .daily-report th, .daily-report td { border:1px solid #777; padding:4px 6px; vertical-align:top; }
  .daily-report tr:nth-child(even) { background:white; }
  .daily-report thead { display:table-header-group; }
  .daily-report tr { break-inside:avoid; page-break-inside:avoid; }
  .daily-report .center { text-align:center; }
  .daily-report .ref { font-size:11px; font-weight:600; font-variant-numeric:tabular-nums; }
  .daily-report .signoffs { display:flex; gap:24px; margin-top:8px; break-inside:avoid; }
  .daily-report .signoff { flex:1; text-align:center; padding-top:0; line-height:1.5; font-size:10px; }
  .daily-report .sign-line { border-bottom:1px dotted #555; height:22px; max-width:180px; margin:0 auto 3px; }
  .daily-report .memo-meta { display:grid; grid-template-columns:38px 1fr; gap:3px 6px; padding:4px 0; }
  .daily-report .memo-copy { margin:6px 0; text-indent:2em; line-height:1.5; }
  .daily-report .notice { margin:4px 0; font-size:10px; color:#333; }
  .daily-report .register { font-size:11px; line-height:1.15; table-layout:fixed; }
  .daily-report .register td { vertical-align:middle; padding:3px 5px; }
  .daily-report .register .person + .person { margin-top:2px; padding-top:0; }
  .daily-report .handwriting { height:32px; }
  .daily-report .person + .person { margin-top:3px; padding-top:2px; border-top:1px dotted #aaa; }
  .daily-report .identity { display:block; color:#333; font-size:10px; }
  .daily-report .seating-list { table-layout:fixed; font-size:11px; }
  .daily-report .seating-list .person .identity { display:inline; margin-left:4px; }
  .daily-report .warning { font-weight:700; text-decoration:underline; }
  @media print {
    .daily-report th { background:#f1f1f1 !important; }
    .daily-report tr:nth-child(even) { background:white !important; }
    .daily-report h3 { break-after:avoid; }
  }
`;

function reportHeading(title: string, subtitle: string, kicker: string): string {
  return `<div class="doc-heading"><p class="doc-kicker">${escapeHtml(kicker)}</p><h2>${escapeHtml(title)}</h2><p class="doc-subtitle">${escapeHtml(subtitle)}</p></div>`;
}

function reportStats(items: Array<[string, number, string]>): string {
  return `<div class="stats">${items.map(([label, value, unit]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${formatNumber(value)}</strong><small>${escapeHtml(unit)}</small></div>`).join('')}</div>`;
}

function reportSignoffs(labels: string[]): string {
  return `<div class="signoffs">${labels.map(label => `<div class="signoff"><div class="sign-line"></div><div>ลงชื่อ ${escapeHtml(label)}</div><div>(..................................................)</div><div>วันที่ .......... / .......... / ..........</div></div>`).join('')}</div>`;
}

function reportVisitors(r: Reservation): Array<{ name: string; id?: string; relation?: string }> {
  const main = r.visitorApproved === 'no' ? [] : [{ name: String(r.visitorName ?? ''), id: r.visitorId, relation: r.relation }];
  return [...main, ...parseExtraVisitors(r).filter(e => e.approved !== 'no')];
}

function reportVisitorCount(r: Reservation): number {
  const stored = r.visitorCount;
  return stored !== null && stored !== undefined && String(stored).trim() !== '' && Number.isInteger(Number(stored)) && Number(stored) >= 0 ? Number(stored) : reportVisitors(r).length;
}

function visitorLine(name: string, id?: string): string {
  return `<span>${escapeHtml(String(name).trim() || '—')}</span>${id ? `<span class="identity">เลขบัตร / หนังสือเดินทาง ${escapeHtml(id)}</span>` : ''}`;
}

export function buildDisciplinaryReport(rows: Reservation[], date: string): string {
  const unique = new Map<string, ReturnType<typeof prisonersOf>[number]>();
  for (const row of rows) for (const p of prisonersOf(row)) {
    if (!p.name && !p.id) continue;
    const key = p.id.trim() || `${p.name.trim()}|${p.wing.trim()}`;
    if (!unique.has(key)) unique.set(key, p);
  }
  const prisoners = [...unique.values()].sort((a,b) => a.wing.localeCompare(b.wing, 'th') || a.name.localeCompare(b.name, 'th'));
  const wings = new Set(prisoners.map(p => p.wing).filter(Boolean)).size;
  return `<style>${DAILY_REPORT_CSS}</style><article class="daily-report">
    ${reportHeading('หนังสือขออนุมัติเบิกตัวผู้ต้องขังเข้าร่วมกิจกรรม', `วันที่เข้าร่วมกิจกรรม ${thaiDateLabel(date)}`, 'CHANCE & CHANGE CAFE · งานปกครอง')}
    <div class="memo-meta"><b>เรื่อง</b><span>ขออนุมัติเบิกตัวผู้ต้องขังเข้าร่วมกิจกรรม Chance &amp; Change Cafe</span><b>เรียน</b><span>ผู้อำนวยการส่วนปกครองผู้ต้องขัง</span></div>
    <p class="memo-copy">ด้วยร้าน Chance &amp; Change Cafe มีกำหนดจัดกิจกรรมในวันที่ ${escapeHtml(thaiDateLabel(date))} จึงขออนุมัติเบิกตัวผู้ต้องขัง จำนวน ${formatNumber(prisoners.length)} คน เพื่อเข้าร่วมกิจกรรม ตามรายชื่อดังต่อไปนี้</p>
    ${reportStats([['ผู้ต้องขัง (ไม่ซ้ำ)', prisoners.length, 'คน'], ['แดนที่มีผู้เข้าร่วม', wings, 'แดน'], ['การจองที่เกี่ยวข้อง', rows.length, 'โต๊ะ']])}
    <h3>บัญชีรายชื่อผู้ต้องขัง · เรียงตามแดน</h3>
    <table><thead><tr><th class="center" style="width:9%">ลำดับ</th><th style="width:41%">ชื่อ–นามสกุล</th><th style="width:32%">เลขประจำตัวผู้ต้องขัง</th><th style="width:18%">แดน</th></tr></thead><tbody>${prisoners.map((p,i) => `<tr><td class="center">${i+1}</td><td><b>น.ช. ${escapeHtml(p.name || '—')}</b></td><td>${escapeHtml(p.id || '—')}</td><td>${escapeHtml(p.wing || '—')}</td></tr>`).join('') || '<tr><td colspan="4" class="center">ไม่มีข้อมูลผู้ต้องขังในวันที่เลือก</td></tr>'}</tbody></table>
    <p class="memo-copy">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
    ${reportSignoffs(['ผู้จัดทำรายงาน', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ'])}
  </article>`;
}

export function buildGateRegistrationReport(rows: Reservation[], date: string): string {
  const sorted = rows.slice().sort((a,b) => a.ref.localeCompare(b.ref));
  const visitors = rows.reduce((n,r) => n + reportVisitorCount(r), 0);
  const prisoners = rows.reduce((n,r) => n + prisonersOf(r).length, 0);
  const body = sorted.map((r,i) => {
    const inmates = prisonersOf(r);
    return `<tr><td class="center">${i+1}</td><td><b class="ref">${escapeHtml(r.ref)}</b></td><td>${reportVisitors(r).map(v => `<div class="person">${escapeHtml(v.name || '—')} <span class="muted">(${escapeHtml(v.relation || '—')})</span>${v.id ? `<span class="identity">${escapeHtml(v.id)}</span>` : ''}</div>`).join('') || '—'}</td><td>${inmates.map(p => `<div class="person"><b>น.ช. ${escapeHtml(p.name || '—')}</b><span class="identity">แดน ${escapeHtml(p.wing || '—')}</span></div>`).join('') || '—'}</td><td class="center">${reportVisitorCount(r)} + ${inmates.length}<br><b>รวม ${reportVisitorCount(r)+inmates.length}</b></td><td class="handwriting"></td><td class="handwriting"></td><td class="handwriting"></td></tr>`;
  }).join('');
  return `<style>${DAILY_REPORT_CSS}@page{size:A4 landscape;margin:10mm}</style><article class="daily-report">
    ${reportHeading('ทะเบียนผู้เข้าเยี่ยม (ลงชื่อ)', `วันที่ ${thaiDateLabel(date)} · สำหรับเจ้าหน้าที่ลงทะเบียนหน้าประตู`, 'CHANCE & CHANGE CAFE · ทะเบียนประจำวัน')}
    ${reportStats([['การจอง', rows.length, 'โต๊ะ'], ['ผู้เข้าเยี่ยม', visitors, 'คน'], ['ผู้ต้องขัง', prisoners, 'คน'], ['รวมผู้เข้าร่วม', visitors+prisoners, 'คน']])}
    <p class="notice">ตรวจสอบรายชื่อและเอกสารประจำตัวก่อนลงทะเบียน · ช่องจำนวนคนแสดงผู้เยี่ยม + ผู้ต้องขัง · บันทึกเวลาเข้าและลงชื่อในช่องว่าง</p>
    <table class="register"><thead><tr><th style="width:5%" class="center">ลำดับ</th><th style="width:12%">เลขอ้างอิง</th><th style="width:25%">รายชื่อผู้เข้าเยี่ยม / เอกสารประจำตัว</th><th style="width:17%">ผู้ต้องขัง / แดน</th><th style="width:9%" class="center">จำนวนคน</th><th style="width:8%">เวลาเข้า</th><th style="width:12%">ลงชื่อผู้เยี่ยม</th><th style="width:12%">ลงชื่อเจ้าหน้าที่</th></tr></thead><tbody>${body || '<tr><td colspan="8" class="center">ไม่มีข้อมูลผู้เข้าเยี่ยมในวันที่เลือก</td></tr>'}</tbody></table>
    <p class="muted">สิ้นสุดรายการ · ${formatNumber(rows.length)} โต๊ะ · ผู้เยี่ยม ${formatNumber(visitors)} คน · ผู้ต้องขัง ${formatNumber(prisoners)} คน</p>
  </article>`;
}

const PAID_STATUSES = ['ชำระแล้ว', 'เสร็จสิ้น'];
function isTableBooking(r: Reservation): boolean { return bookingPool(r) === 'table'; }

const SEATING_REPORT_CSS = `
  .print-header { display:flex; flex-direction:row-reverse; align-items:baseline; justify-content:space-between; border-bottom:1px solid #c7cfcc; padding-bottom:7px; margin-bottom:10px; }
  .print-header h1 { font-size:10px; color:#5c6862; }
  .print-header h2 { font-size:14px; margin:0; font-weight:700; color:#263f34; }
  .seating-report { color:#202b25; }
  .seating-report .doc-heading { text-align:left; margin:0 0 6px; }
  .seating-report h2 { font-size:22px; font-weight:600; color:#263f34; margin-bottom:3px; }
  .seating-report .doc-subtitle { font-size:11px; color:#59655e; }
  .seating-report .stats { border-top:0; border-bottom:1px solid #b6c3bb; gap:24px; padding:5px 0 8px; margin:0 0 10px; }
  .seating-report .stat span { color:#59655e; }
  .seating-report .stat strong { font-size:16px; color:#263f34; margin:0 4px 0 3px; }
  .seating-report .section-heading { font-size:11px; color:#526158; margin:10px 0 5px; font-weight:600; }
  .seating-report .booking { margin:0 0 8px; border:1px solid #cbd3ce; border-radius:5px; break-inside:avoid; page-break-inside:avoid; }
  .seating-report .booking-head { display:flex; align-items:center; gap:10px; padding:6px 10px; background:#f2f5f2; border-radius:5px 5px 0 0; border-bottom:1px solid #dce2dd; }
  .seating-report .booking-number { min-width:54px; color:#263f34; border-right:1px solid #c7d1ca; padding-right:10px; white-space:nowrap; font-size:10px; }
  .seating-report .booking-number b { font-size:19px; line-height:1; font-weight:600; margin-left:3px; font-variant-numeric:tabular-nums; }
  .seating-report .booking-ref { font-size:11px; font-weight:600; }
  .seating-report .booking-date { margin-left:auto; font-size:10px; color:#526158; }
  .seating-report .booking-status { font-size:10px; border:1px solid #bbcbbf; padding:1px 6px; border-radius:3px; color:#263f34; }
  .seating-report .booking-body { display:grid; grid-template-columns:minmax(0,1.8fr) minmax(0,1fr) minmax(0,.6fr); gap:14px; padding:8px 10px; }
  .seating-report .booking-label { color:#647168; font-size:10px; margin-bottom:3px; }
  .seating-report .booking-guest { font-size:12px; line-height:1.4; }
  .seating-report .booking-guest + .booking-guest { margin-top:3px; }
  .seating-report .booking-id { color:#67716a; font-size:10px; margin-left:6px; }
  .seating-report .booking-contact { font-size:11px; color:#526158; margin:2px 0 5px; }
  .seating-report .booking-inmate + .booking-inmate { margin-top:5px; }
  .seating-report .booking-inmate { font-size:12px; line-height:1.4; }
  .seating-report .booking-inmate small { display:block; font-size:11px; color:#526158; }
  .seating-report .booking-totals { text-align:right; border-left:1px solid #e0e5e1; padding-left:10px; }
  .seating-report .booking-people { font-size:20px; color:#263f34; font-weight:600; line-height:1.2; }
  .seating-report .booking-people small { font-size:10px; font-weight:400; margin-left:3px; }
  .seating-report .booking-breakdown { font-size:10px; color:#59655e; margin-top:3px; }
  .seating-report .booking-price { font-size:12px; margin-top:8px; font-weight:600; }
  .seating-report .booking-price small { font-size:9px; font-weight:400; }
  .seating-report .booking-foot { border-top:1px solid #e0e5e1; padding:4px 10px; display:flex; justify-content:space-between; gap:12px; font-size:10px; color:#59655e; }
  .seating-report .booking-allergy { color:#804822; font-weight:700; }
  .seating-report .seating-end { display:flex; justify-content:space-between; gap:20px; margin-top:8px; padding-top:6px; border-top:1px solid #aebdb3; font-size:10px; }
  .seating-report .seating-end b { color:#263f34; font-size:12px; }
  .seating-report .notice { margin-top:5px; font-size:9px; color:#67716a; }
  .seating-report .signoffs { max-width:520px; margin:8px 0 0 auto; }
  .seating-report .signoff { font-size:9px; }
  .seating-report .sign-line { height:15px; }
  @media print {
    .seating-report .booking-head { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  }
`;

function renderSeatingBookings(rows: Reservation[], startIndex: number): string {
  return rows.map((r,i) => {
    const table = isTableBooking(r);
    const inmates = table ? [] : prisonersOf(r);
    const status = normalizeStatus(r.status);
    const guests = parseExtraVisitors(r).filter(e => e.approved !== 'no');
    const allergy = String(r.allergy || '').trim();
    const hasAllergy = allergy && !['-', 'ไม่มี'].includes(allergy);
    return `<section class="booking">
      <header class="booking-head"><span class="booking-number">โต๊ะ <b>${String(startIndex+i+1).padStart(2,'0')}</b></span><span class="booking-ref">${escapeHtml(r.ref)}</span><span class="booking-date">${escapeHtml(visitDateLabel(r.visitDate,r.visitDateISO))}</span><span class="booking-status">${escapeHtml(status || '—')}</span></header>
      <div class="booking-body">
        <div><p class="booking-label">${table ? 'ผู้จอง / ผู้ร่วมโต๊ะ' : 'ผู้เยี่ยม / ผู้ร่วมโต๊ะ'}</p>
          <p class="booking-guest"><b>${escapeHtml(r.visitorName || '—')}</b><span class="booking-id">${escapeHtml(r.visitorId || '—')}</span>${r.visitorApproved === 'no' ? ' (ไม่อนุมัติ)' : ''}</p>
          <p class="booking-contact">โทร ${escapeHtml(r.visitorPhone || '—')} · ${escapeHtml(r.relation || '—')}</p>
          ${guests.map(v => `<p class="booking-guest">${escapeHtml(v.name || '—')}<span class="booking-id">${escapeHtml(v.id || '—')} · ${escapeHtml(v.relation || '—')}${v.approved !== 'yes' ? ' · รออนุมัติ' : ''}</span></p>`).join('')}
        </div>
        <div><p class="booking-label">${table ? 'ประเภทการจอง' : 'ผู้ต้องขัง'}</p>${table ? '<p class="booking-inmate">จองโต๊ะ · TBL</p>' : inmates.map(p => `<div class="booking-inmate"><b>น.ช. ${escapeHtml(p.name || '—')}</b><small>${escapeHtml(p.id || '—')} · แดน ${escapeHtml(p.wing || '—')}</small></div>`).join('') || '<p class="booking-inmate">ไม่ระบุผู้ต้องขัง</p>'}</div>
        <div class="booking-totals"><p class="booking-people">${reportVisitorCount(r)+inmates.length}<small>คน</small></p><p class="booking-breakdown">ผู้ร่วมโต๊ะ ${reportVisitorCount(r)}${table ? '' : ` · ผู้ต้องขัง ${inmates.length}`}</p><p class="booking-price">${formatNumber(Number(r.total)||0)} <small>บาท</small></p><p class="booking-breakdown">${PAID_STATUSES.includes(status) ? 'ชำระแล้ว' : 'ยอดการจอง'}</p></div>
      </div>
      <footer class="booking-foot"><span class="${hasAllergy ? 'booking-allergy' : ''}">แพ้อาหาร: ${escapeHtml(allergy || 'ไม่ระบุ')}</span><span>ศาสนา: ${escapeHtml(r.religion || '—')}</span></footer>
    </section>`;
  }).join('');
}

export function buildSeatingReport(rows: Reservation[], filterLabel?: string): string {
  const sorted = rows.slice().sort((a,b) => a.ref.localeCompare(b.ref));
  const prisoner = sorted.filter(r => !isTableBooking(r));
  const table = sorted.filter(isTableBooking);
  const visitors = rows.reduce((n,r) => n+reportVisitorCount(r),0);
  const inmates = prisoner.reduce((n,r) => n+prisonersOf(r).length,0);
  let html = `<style>${DAILY_REPORT_CSS}${SEATING_REPORT_CSS}@page{size:A4 portrait;margin:10mm}</style><article class="daily-report seating-report">${reportHeading('รายงานการจัดโต๊ะ', filterLabel || 'รายการจองเรียงตามเลขอ้างอิง', '')}
    ${reportStats([['โต๊ะทั้งหมด',rows.length,'โต๊ะ'],['ผู้ร่วมโต๊ะ',visitors,'คน'],['ผู้ต้องขัง',inmates,'คน'],['รวมทั้งหมด',visitors+inmates,'คน']])}`;
  if (prisoner.length) html += `<h3 class="section-heading">1) การจองเยี่ยมผู้ต้องขัง · ${prisoner.length} โต๊ะ</h3>${renderSeatingBookings(prisoner,0)}`;
  if (table.length) html += `<h3 class="section-heading">${prisoner.length ? '2' : '1'}) การจองโต๊ะ (TBL) · ${table.length} โต๊ะ</h3>${renderSeatingBookings(table,prisoner.length)}`;
  if (!rows.length) html += '<p class="notice">ไม่มีข้อมูลการจอง</p>';
  html += `<div class="seating-end"><span>ยอดเงินรวม <b>${formatNumber(rows.reduce((n,r)=>n+(Number(r.total)||0),0))} บาท</b></span><span>ชำระแล้ว <b>${formatNumber(rows.filter(r=>PAID_STATUSES.includes(normalizeStatus(r.status))).reduce((n,r)=>n+(Number(r.total)||0),0))} บาท</b></span></div><p class="notice">ลำดับโต๊ะใช้สำหรับอ้างอิงในรายงานนี้ · ตรวจสอบเลขอ้างอิงก่อนจัดที่นั่ง</p>${reportSignoffs(['เจ้าหน้าที่จัดโต๊ะ', 'ผู้ตรวจสอบ'])}</article>`;
  return html;
}


/**
 * Door-registration list for no-prisoner table (TBL) bookings. Each table party
 * gets a row with a signature column, so staff at the gate can tick people off
 * as they walk in. Only the booking-order rows shown — no prisoner column, since
 * table bookings have no prisoner.
 */
export function buildTableRegistrationReport(rows: Reservation[], date: string): string {
  const sorted = rows
    .slice()
    .sort((a, b) => String(a.ref || '').localeCompare(String(b.ref || '')));

  const body = sorted
    .map((r, i) => {
      const extras = parseExtraVisitors(r).filter((e) => e.approved !== 'no');
      const visitors = [visitorLine(String(r.visitorName ?? ''), r.visitorId)];
      for (const e of extras) visitors.push(visitorLine(e.name, e.id));
      const people = Number(r.visitorCount) || 1 + extras.length;
      return `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td style="text-align:center;">${escapeHtml(r.ref)}</td>
        <td style="text-align:center;">${escapeHtml(String(r.visitDateISO ?? '—'))}</td>
        <td>${visitors.join('<br>')}</td>
        <td style="text-align:center;">${people}</td>
        <td style="text-align:center;">${escapeHtml(normalizeStatus(r.status) ?? '—')}</td>
        <td style="width:110px;"></td>
      </tr>`;
    })
    .join('');

  const totals = sorted.reduce(
    (acc, r) => {
      const extras = parseExtraVisitors(r).filter((e) => e.approved !== 'no');
      acc.tables += 1;
      acc.people += Number(r.visitorCount) || 1 + extras.length;
      acc.total += Number(r.total) || 0;
      return acc;
    },
    { tables: 0, people: 0, total: 0 }
  );

  return `
    <style>@page { size: landscape; margin: 10mm; }</style>
    <div class="print-title">ทะเบียนจัดการโต๊ะ (ลงทะเบียนหน้าประตู) — วันที่ ${escapeHtml(thaiDateLabel(date))}</div>
    <table>
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">ลำดับ</th>
          <th style="width:90px; text-align:center;">Ref</th>
          <th style="width:110px; text-align:center;">วันที่</th>
          <th>รายชื่อผู้ร่วมโต๊ะ</th>
          <th style="width:55px; text-align:center;">จำนวนคน</th>
          <th style="width:90px; text-align:center;">สถานะ</th>
          <th style="width:110px; text-align:center;">ลงชื่อ (เจ้าหน้าที่)</th>
        </tr>
      </thead>
      <tbody>${body || '<tr><td colspan="7" style="text-align:center;color:#888;">ไม่พบการจองโต๊ะในวันที่เลือก</td></tr>'}</tbody>
    </table>
    <div style="font-weight:600; font-size:12px; margin-top:6px;">
      รวม ${formatNumber(totals.tables)} โต๊ะ · ${formatNumber(totals.people)} คน · ยอด ${formatNumber(totals.total)} บาท
    </div>
  `;
}

function thaiDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

export type ReportType = 'all' | 'vis' | 'tbl';

const REPORT_TYPE_TITLES: Record<ReportType, { title: string; subtitle: string }> = {
  all: {
    title: 'รายงานสรุปผลการดำเนินงานด้านการเงิน (ภาพรวม)',
    subtitle: 'ร้าน Chance &amp; Change Cafe · ทัณฑสถานบำบัดพิเศษกลาง · รวมการจองเยี่ยมผู้ต้องขัง (VIS) และการจองโต๊ะ (TBL)',
  },
  vis: {
    title: 'รายงานสรุปการดำเนินงาน (VIS)',
    subtitle: 'ร้าน Chance &amp; Change Cafe · ทัณฑสถานบำบัดพิเศษกลาง · เฉพาะการจองเยี่ยมผู้ต้องขัง (Ref ขึ้นต้น VIS-)',
  },
  tbl: {
    title: 'รายงานสรุปการดำเนินงาน (TBL)',
    subtitle: 'ร้าน Chance &amp; Change Cafe · ทัณฑสถานบำบัดพิเศษกลาง · เฉพาะการจองโต๊ะ (Ref ขึ้นต้น TBL-)',
  },
};

export function buildFinancialReport(
  summary: FinancialSummary,
  daily: FinancialDayRow[],
  monthly: FinancialMonthRow[],
  periodLabel: string,
  type: ReportType = 'all'
): string {
  const fmt = (n: number): string => formatNumber(n);
  const meta = REPORT_TYPE_TITLES[type];

  const dailyRows = daily
    .filter((d) => d.bookings > 0 || d.attended > 0)
    .map(
      (d, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${escapeHtml(thaiDateLabel(d.date))}</td>
        <td style="text-align:center;">${fmt(d.attended)}</td>
        <td style="text-align:center;">${fmt(d.adults)}</td>
        <td style="text-align:center;">${fmt(d.kidsUnder5)}</td>
        <td style="text-align:center;">${fmt(d.kids5_8)}</td>
        <td style="text-align:center;">${fmt(d.visitors)}</td>
        <td style="text-align:center;">${fmt(d.prisoners)}</td>
        <td style="text-align:center; font-weight:700;">${fmt(d.people)}</td>
        <td style="text-align:right;">${fmt(d.netRevenue)}</td>
        <td style="text-align:right;">${fmt(d.welfareDeduction)}</td>
        <td style="text-align:right;">${fmt(d.total)}</td>
      </tr>`
    )
    .join('');

  const monthlyRows = monthly
    .map(
      (m, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${escapeHtml(monthLabel(m.month))}</td>
        <td style="text-align:center;">${fmt(m.attended)}</td>
        <td style="text-align:center;">${fmt(m.adults)}</td>
        <td style="text-align:center;">${fmt(m.kidsUnder5)}</td>
        <td style="text-align:center;">${fmt(m.kids5_8)}</td>
        <td style="text-align:center;">${fmt(m.visitors)}</td>
        <td style="text-align:center;">${fmt(m.prisoners)}</td>
        <td style="text-align:center; font-weight:700;">${fmt(m.people)}</td>
        <td style="text-align:right;">${fmt(m.netRevenue)}</td>
        <td style="text-align:right;">${fmt(m.welfareDeduction)}</td>
        <td style="text-align:right;">${fmt(m.total)}</td>
      </tr>`
    )
    .join('');

  const now = new Date();
  const issuedLabel = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

  const statBox = (label: string, value: string): string => `
      <div style="flex:1; min-width:130px; border:1px solid #444; padding:10px; text-align:center;">
        <div style="font-size:10px; color:#555; text-transform:uppercase; letter-spacing:0.03em;">${escapeHtml(label)}</div>
        <div style="font-size:17px; font-weight:700; color:#1a1a1a; margin-top:2px;">${value}</div>
      </div>`;

  return `
    <div style="text-align:center; border-bottom:2px solid #1a1a1a; padding-bottom:10px; margin-bottom:14px;">
      <div style="font-size:15px; font-weight:700;">${meta.title}</div>
      <div style="font-size:13px; font-weight:600; margin-top:2px;">${meta.subtitle}</div>
      <div style="font-size:11px; color:#555; margin-top:4px;">ช่วงเวลารายงาน: ${escapeHtml(periodLabel)} &nbsp;|&nbsp; จัดทำเมื่อวันที่ ${escapeHtml(issuedLabel)}</div>
    </div>

    <p style="font-size:12px; line-height:1.7; margin-bottom:14px; text-align:justify;">
      รายงานฉบับนี้จัดทำขึ้นเพื่อสรุปผลการดำเนินงานด้านการเงินของร้าน Chance &amp; Change Cafe
      ในช่วงเวลา ${escapeHtml(periodLabel)} ประกอบด้วยข้อมูลจำนวนการจอง ยอด 80% ยอด 20% และยอดรวมที่ลูกค้าชำระแล้ว
      และจำนวนผู้เข้าร่วมกิจกรรม โดยมีรายละเอียดดังต่อไปนี้
    </p>

    <p style="font-size:11px; color:#555;">ยอดรวมคิดจากสถานะ ชำระแล้ว / เสร็จสิ้น เท่านั้น แบ่งเป็นยอด 80% และยอดสวัสดิการร้านสงเคราะห์ 20%</p>

    <h3 style="font-size:12.5px; font-weight:700; margin:0 0 8px;">1. สรุปข้อมูลทางการเงินและผู้เข้าร่วม</h3>
    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
      ${statBox('ยอด 80%', fmt(summary.netRevenue) + ' บาท')}
      ${statBox('ยอด 20%', fmt(summary.welfareDeduction) + ' บาท')}
      ${statBox('ยอดรวม', fmt(summary.total) + ' บาท')}
      ${statBox('จำนวนการจอง', fmt(summary.bookings) + ' โต๊ะ')}
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px;">
      ${statBox('รวมผู้เข้าร่วมทั้งหมด', fmt(summary.people) + ' คน')}
      ${statBox('ผู้เข้าร่วม (ผู้เยี่ยม)', fmt(summary.visitors) + ' คน')}
      ${statBox('ผู้ต้องขังที่เข้าร่วม', fmt(summary.prisoners) + ' คน')}
      ${statBox('ผู้ต้องขัง (ไม่ซ้ำ)', fmt(summary.distinctPrisoners) + ' คน')}
    </div>

    <h3 style="font-size:12.5px; font-weight:700; margin:16px 0 6px;">2. รายละเอียดสรุปรายวัน</h3>
    <table>
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">ลำดับ</th>
          <th>วันที่</th>
          <th style="width:50px; text-align:center;">โต๊ะที่เข้าร่วม</th>
          <th style="width:55px; text-align:center;">ผู้ใหญ่</th>
          <th style="width:55px; text-align:center;">เด็ก&lt;5 ปี</th>
          <th style="width:55px; text-align:center;">เด็ก 5-8 ปี</th>
          <th style="width:55px; text-align:center;">ผู้เข้าร่วม</th>
          <th style="width:55px; text-align:center;">ผู้ต้องขัง</th>
          <th style="width:55px; text-align:center;">รวมคน</th>
          <th style="width:90px; text-align:right;">ยอด 80%</th>
          <th style="width:90px; text-align:right;">ยอด 20%</th>
          <th style="width:90px; text-align:right;">ยอดรวม</th>
        </tr>
      </thead>
      <tbody>${dailyRows || '<tr><td colspan="12" style="text-align:center;color:#888;">ไม่มีข้อมูล</td></tr>'}</tbody>
    </table>

    <h3 style="font-size:12.5px; font-weight:700; margin:16px 0 6px; page-break-before:avoid;">3. รายละเอียดสรุปรายเดือน</h3>
    <table>
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">ลำดับ</th>
          <th>เดือน</th>
          <th style="width:50px; text-align:center;">โต๊ะที่เข้าร่วม</th>
          <th style="width:55px; text-align:center;">ผู้ใหญ่</th>
          <th style="width:55px; text-align:center;">เด็ก&lt;5 ปี</th>
          <th style="width:55px; text-align:center;">เด็ก 5-8 ปี</th>
          <th style="width:55px; text-align:center;">ผู้เข้าร่วม</th>
          <th style="width:55px; text-align:center;">ผู้ต้องขัง</th>
          <th style="width:55px; text-align:center;">รวมคน</th>
          <th style="width:90px; text-align:right;">ยอด 80%</th>
          <th style="width:90px; text-align:right;">ยอด 20%</th>
          <th style="width:90px; text-align:right;">ยอดรวม</th>
        </tr>
      </thead>
      <tbody>${monthlyRows || '<tr><td colspan="12" style="text-align:center;color:#888;">ไม่มีข้อมูล</td></tr>'}</tbody>
    </table>

    <p style="font-size:11px; color:#555; margin-top:16px; text-align:justify;">
      จึงเรียนมาเพื่อโปรดทราบและพิจารณา ทั้งนี้ ข้อมูลข้างต้นสรุปจากระบบจองเยี่ยม Chance &amp; Change Cafe
      ณ วันที่จัดทำรายงาน
    </p>

    <table style="width:80%; margin:32px auto 0; border:none;">
      <tbody>
        <tr>
          <td style="border:none; width:50%; text-align:center; height:70px; vertical-align:bottom;">
            <div>ลงชื่อ.............................................. ผู้จัดทำรายงาน</div>
            <div style="font-size:10px; color:#555; margin-top:2px;">(..................................................)</div>
            <div style="font-size:10px; color:#555; margin-top:2px;">วันที่........./........./.........</div>
          </td>
          <td style="border:none; width:50%; text-align:center; vertical-align:bottom;">
            <div>ลงชื่อ.............................................. ผู้อนุมัติรายงาน</div>
            <div style="font-size:10px; color:#555; margin-top:2px;">(..................................................)</div>
            <div style="font-size:10px; color:#555; margin-top:2px;">วันที่........./........./.........</div>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * Single-booking PromptPay payment slip for offline collection. The QR itself is
 * the branded card SVG minted server-side by `generatePromptPayQr` — it already
 * encodes this booking's ref as the bill number and its server-authoritative
 * total as a fixed amount, so nothing here can drift from what the bank charges.
 */
export function buildPromptPayQrCard(row: Reservation, qrCardSvg: string, amount: number): string {
  const meta: Array<[string, string]> = [
    ['เลขอ้างอิง (Ref)', String(row.ref ?? '')],
    ['ผู้เข้าร่วมกิจกรรม', String(row.visitorName ?? '')],
    ['ผู้ต้องขัง', prisonersOf(row).map((p) => p.name).join(', ')],
    ['แดน', [...new Set(prisonersOf(row).map((p) => p.wing || '-'))].join(', ')],
    ['วันที่เข้าร่วม', visitDateLabel(row.visitDate, row.visitDateISO)],
    ['จำนวนผู้เข้าร่วม', `${formatNumber(row.totalPersons ?? '')} คน`],
  ];

  const rowsHtml = meta
    .map(
      ([label, value]) => `
      <tr>
        <th style="width:35%;">${escapeHtml(label)}</th>
        <td>${escapeHtml(value || '-')}</td>
      </tr>`
    )
    .join('');

  // qrCardSvg comes from our own worker, not user input, so it is inlined as
  // markup on purpose — escaping it would print the source instead of the QR.
  return `
    <div class="print-title">ใบชำระเงินค่าร่วมกิจกรรม (PromptPay)</div>
    <table>${rowsHtml}</table>
    <div style="text-align:center;margin:10px 0 4px;font-size:15px;font-weight:700;">
      ยอดชำระ ${escapeHtml(formatNumber(amount))} บาท
    </div>
    <div style="display:flex;justify-content:center;margin:8px 0 12px;">
      <div style="width:320px;max-width:100%;">${qrCardSvg}</div>
    </div>
    <div style="text-align:center;font-size:11px;color:#555;line-height:1.7;">
      สแกน QR นี้ด้วยแอปธนาคารเพื่อชำระเงิน · ยอดเงินถูกกำหนดไว้แล้ว ไม่ต้องกรอกเอง<br>
      เมื่อชำระเรียบร้อยแล้ว กรุณาเก็บสลิปไว้เป็นหลักฐาน และแจ้งเจ้าหน้าที่เพื่อยืนยันการชำระเงิน
    </div>`;
}
