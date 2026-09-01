import { formatNumber, visitDateLabel, parseExtraVisitors, computeDeptReportData, normalizeStatus, STATUS_COLORS } from './format';
import { monthLabel } from './dashboard';
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
  const now = new Date().toLocaleString('th-TH');
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
    <div style="margin-top:50px;"></div>
    <div class="print-header"><h1>ทัณฑสถานบำบัดพิเศษกลาง</h1><h2>Chance &amp; Change Cafe</h2></div>
    ${content}
    <div class="print-footer">ผู้ปริ้น: ${escapeHtml(printerName)} • พิมพ์เมื่อ ${now}</div>
    </body></html>
  `);
  win.document.close();
  win.focus();
  return true;
}

export function buildDisciplinaryReport(rows: Reservation[], date: string): string {
  const prisoners: Array<{ name: string; id: string; wing: string }> = [];
  rows.forEach((r) => {
    if (r.prisonerName && !prisoners.some((p) => p.id === r.prisonerId)) {
      prisoners.push({ name: String(r.prisonerName), id: String(r.prisonerId ?? ''), wing: String(r.wing ?? '') });
    }
  });

  const letterRows = prisoners
    .map(
      (p, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td><strong>น.ช. ${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.id)}</td>
        <td>${escapeHtml(p.wing || '-')}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="print-title">หนังสือขออนุมัติเบิกตัวผู้ต้องขังเข้าร่วมกิจกรรม</div>
    <div style="margin-bottom:12px; line-height:1.8; font-size:13px;">
      <div style="text-align:right;">วันที่ ${escapeHtml(thaiDateLabel(date))}</div>
      <br>
      <div><strong>เรื่อง</strong> ขออนุมัติเบิกตัวผู้ต้องขังเข้าร่วมกิจกรรม Chance &amp; Change Cafe</div>
      <div><strong>เรียน</strong> ผู้อำนวยการส่วนปกครองผู้ต้องขัง</div>
      <br>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:50px; text-align:center;">ลำดับ</th>
          <th>ชื่อ-นามสกุล</th>
          <th>เลขประจำตัวผู้ต้องขัง</th>
          <th>แดน</th>
        </tr>
      </thead>
      <tbody>${letterRows || '<tr><td colspan="4" style="text-align:center;color:#888;">ไม่มีข้อมูลผู้ต้องขัง</td></tr>'}</tbody>
    </table>

    <table style="width:80%; margin:28px auto 0; border:none;">
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

/** Render one visitor (main or extra) with their citizen ID when provided. */
function visitorLine(name: string, id?: string): string {
  const n = escapeHtml(String(name ?? '').trim() || '—');
  const i = escapeHtml(String(id ?? '').trim());
  return i ? `${n} <span style="color:#444;white-space:nowrap;">· เลขบัตร ${i}</span>` : n;
}

export function buildGateRegistrationReport(rows: Reservation[], date: string): string {
  const body = rows
    .map((r, i) => {
      const extras = parseExtraVisitors(r).filter((e) => e.approved !== 'no');
      const people = [visitorLine(String(r.visitorName ?? ''), r.visitorId)];
      for (const e of extras) people.push(visitorLine(e.name, e.id));
      const visitors = people.join('<br>');
      const count = (Number(r.visitorCount) || 1) + 1;
      return `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td style="text-align:center;">${escapeHtml(r.ref)}</td>
        <td></td>
        <td>${visitors}</td>
        <td><strong>น.ช. ${escapeHtml(r.prisonerName ?? '—')}</strong></td>
        <td>${escapeHtml(r.wing ?? '—')}</td>
        <td>${escapeHtml(r.relation ?? '—')}</td>
        <td style="text-align:center;">${count}</td>
        <td></td>
      </tr>`;
    })
    .join('');

  const totals = rows.reduce(
    (acc, r) => {
      const cnt = Number(r.visitorCount) || 1;
      acc.visitors += cnt;
      acc.people += cnt + 1;
      return acc;
    },
    { visitors: 0, people: 0 }
  );

  return `
    <style>@page { size: landscape; margin: 10mm; }</style>
    <div class="print-title">ทะเบียนผู้เข้าเยี่ยม — วันที่ ${escapeHtml(thaiDateLabel(date))}</div>
    <table>
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">ลำดับ</th>
          <th style="width:90px; text-align:center;">Ref</th>
          <th style="width:90px; text-align:center;">เวลาเข้า</th>
          <th>ผู้เยี่ยม</th>
          <th>ผู้ต้องขัง</th>
          <th>แดน</th>
          <th>ความสัมพันธ์</th>
          <th style="width:55px; text-align:center;">จำนวนคน</th>
          <th style="width:110px; text-align:center;">ลงชื่อ</th>
        </tr>
      </thead>
      <tbody>${body || '<tr><td colspan="9" style="text-align:center;color:#888;">ไม่มีข้อมูล</td></tr>'}</tbody>
    </table>
    <div style="font-weight:600; font-size:12px; margin-top:6px;">
      รวมผู้เยี่ยม ${formatNumber(totals.visitors)} คน + ผู้ต้องขัง ${rows.length} คน = ${formatNumber(totals.people)} คน จาก ${rows.length} โต๊ะ
    </div>
  `;
}

const SEATING_REPORT_CSS = `
  .table-block { margin-bottom:16mm; border:2px solid #312e81; border-radius:8px; overflow:hidden; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.08); page-break-inside:avoid; }
  .table-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#312e81; color:#fff; gap:10px; flex-wrap:wrap; }
  .table-num { font-size:15px; font-weight:700; background:#d97706; color:#1e1b4b; padding:4px 14px; border-radius:4px; }
  .table-ref { font-size:14px; font-weight:600; margin-left:10px; }
  .table-date { font-size:12px; opacity:0.9; }
  .status-pill { font-size:11px; font-weight:700; padding:4px 12px; border-radius:20px; color:#fff; white-space:nowrap; }
  .content-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:14px; }
  .info-section { border:1.5px solid #ddd; border-radius:6px; padding:10px 12px; background:#fafafa; }
  .info-section.prisoner { background:#f0f7f0; border-color:#166534; }
  .info-section.visitor { background:#f0f4ff; border-color:#312e81; }
  .section-title { font-weight:700; font-size:13px; margin-bottom:6px; color:#312e81; display:flex; align-items:center; gap:4px; }
  .info-section.prisoner .section-title { color:#166534; }
  .info-line { margin:3px 0; font-size:13px; line-height:1.4; }
  .info-line b { font-weight:600; color:#1e1b4b; }
  .info-line.contact-line { font-size:15px; font-weight:800; color:#1e1b4b; }
  .info-line.warn-line { color:#b91c1c; font-weight:700; background:#fef2f2; padding:2px 6px; border-radius:4px; display:inline-block; }
  .extra-section { grid-column:1 / -1; background:#fff8e7; border:1.5px solid #f5c542; border-radius:6px; padding:10px 12px; }
  .extra-title { font-weight:700; font-size:13px; color:#92400e; margin-bottom:6px; }
  .extra-item { font-size:13px; padding:2px 0 2px 12px; position:relative; }
  .extra-item::before { content:"\\2022"; position:absolute; left:0; color:#d97706; font-weight:bold; }
  .extra-item .pending-tag { color:#b45309; font-weight:700; font-size:11px; margin-left:4px; }
  .table-footer { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8f9fa; border-top:1.5px solid #ddd; gap:10px; flex-wrap:wrap; }
  .visit-date-info { font-size:13px; color:#555; }
  .visit-date-info b { color:#312e81; font-size:15px; }
  .footer-boxes { display:flex; gap:8px; }
  .payment-box { background:#eef2ff; color:#312e81; border:1.5px solid #312e81; padding:6px 14px; border-radius:6px; font-weight:700; font-size:14px; text-align:center; min-width:110px; }
  .payment-box .label { font-size:11px; font-weight:500; display:block; }
  .payment-box .number { font-size:16px; font-weight:800; }
  .people-count { background:#d97706; color:#1e1b4b; padding:6px 16px; border-radius:6px; font-weight:700; font-size:16px; text-align:center; min-width:110px; }
  .people-count .label { font-size:11px; font-weight:500; display:block; }
  .people-count .number { font-size:18px; font-weight:800; }
  .report-meta { font-size:12px; color:#555; margin-top:2px; }
  .grand-summary { margin-top:36px; page-break-before:always; padding:24px; }
  .grand-box { border:3px solid #312e81; border-radius:10px; padding:24px 32px; background:linear-gradient(135deg,#f8f9fa 0%,#fff 100%); max-width:500px; margin:0 auto; }
  .grand-title { font-size:18px; font-weight:800; color:#312e81; text-align:center; margin-bottom:16px; padding-bottom:10px; border-bottom:2px solid #312e81; }
  .grand-item { display:flex; justify-content:space-between; align-items:center; margin:10px 0; font-size:15px; }
  .grand-item .g-label { color:#555; font-weight:500; }
  .grand-item .g-number { font-weight:800; font-size:20px; color:#312e81; }
  .grand-total { margin-top:16px; padding-top:16px; border-top:3px solid #d97706; display:flex; justify-content:space-between; align-items:center; }
  .grand-total .g-label { font-size:16px; font-weight:600; color:#1e1b4b; }
  .grand-total .g-number { font-size:26px; font-weight:900; color:#d97706; }
  .page-footer { position:fixed; bottom:0; left:0; right:0; height:12mm; border-top:1px solid #ddd; display:flex; align-items:center; justify-content:center; font-size:10px; color:#666; background:#fff; }
  body { margin-bottom:16mm; }
  @media print {
    @page { size:A4; margin:10mm 8mm; }
    .table-block { margin-bottom:3mm; border-width:1.5px; }
    .content-grid { gap:8px; padding:8px 10px; }
    .info-section { padding:6px 8px; }
    .section-title { font-size:11px; margin-bottom:4px; }
    .info-line { font-size:11px; }
    .extra-section { padding:6px 8px; }
    .extra-title { font-size:11px; margin-bottom:4px; }
    .extra-item { font-size:11px; }
    .table-footer { padding:6px 10px; }
    .visit-date-info { font-size:11px; }
    .status-pill { font-size:10px; padding:3px 10px; }
    .payment-box, .people-count { padding:4px 12px; font-size:13px; min-width:90px; }
    .grand-summary { margin-top:6mm; padding:12px; }
    .grand-box { padding:16px 20px; }
    .grand-title { font-size:14px; margin-bottom:10px; padding-bottom:6px; }
    .grand-item { margin:6px 0; font-size:12px; }
    .grand-item .g-number { font-size:16px; }
    .grand-total { margin-top:10px; padding-top:10px; }
    .grand-total .g-label { font-size:13px; }
    .grand-total .g-number { font-size:20px; }
  }
`;

const PAID_STATUSES = ['ชำระแล้ว', 'เสร็จสิ้น'];
const HALTED_STATUSES = ['ไม่อนุมัติ', 'ยกเลิก'];

function paymentBoxClass(status: string): string {
  if (PAID_STATUSES.includes(status)) return 'payment-box paid';
  if (HALTED_STATUSES.includes(status)) return 'payment-box halted';
  return 'payment-box';
}

export function buildSeatingReport(rows: Reservation[], filterLabel?: string): string {
  let totalVisitors = 0;
  let totalPrice = 0;
  let paidTables = 0;
  let paidAmount = 0;
  rows.forEach((r) => {
    totalVisitors += Number(r.visitorCount) || 1;
    totalPrice += Number(r.total) || 0;
    if (PAID_STATUSES.includes(normalizeStatus(r.status))) {
      paidTables++;
      paidAmount += Number(r.total) || 0;
    }
  });
  const totalPrisoners = rows.length;
  const totalPeople = totalVisitors + totalPrisoners;
  const pendingAmount = totalPrice - paidAmount;

  const blocks = rows
    .map((r, i) => {
      const extras = parseExtraVisitors(r);
      const visitorCount = Number(r.visitorCount) || 1;
      const totalPeopleThisTable = visitorCount + 1;
      const shownExtras = extras.filter((e) => e.approved !== 'no');
      const status = normalizeStatus(r.status);
      const statusColor = STATUS_COLORS[status] ?? '#64748b';
      const hasAllergy = r.allergy && String(r.allergy).trim() && String(r.allergy).trim() !== '-' && String(r.allergy).trim() !== 'ไม่มี';
      const paid = PAID_STATUSES.includes(status);

      return `
      <div class="table-block">
        <div class="table-header">
          <div style="display:flex;align-items:center;">
            <span class="table-num">โต๊ะ ${i + 1}</span>
            <span class="table-ref">${escapeHtml(r.ref ?? '—')}</span>
          </div>
          <span class="status-pill" style="background:${statusColor};">${escapeHtml(status || '—')}</span>
          <span class="table-date">📅 ${escapeHtml(visitDateLabel(r.visitDate, r.visitDateISO))}</span>
        </div>
        <div class="content-grid">
          <div class="info-section prisoner">
            <div class="section-title">🔒 ผู้ต้องขัง</div>
            <div class="info-line">ชื่อ: <b>น.ช. ${escapeHtml(r.prisonerName ?? '—')}</b></div>
            <div class="info-line">เลขประจำตัว: <b>${escapeHtml(r.prisonerId ?? '—')}</b></div>
            <div class="info-line">แดน: <b>${escapeHtml(r.wing ?? '—')}</b></div>
          </div>
          <div class="info-section visitor">
            <div class="section-title">👤 ผู้เยี่ยมหลัก</div>
            <div class="info-line"><b>${escapeHtml(r.visitorName ?? '—')}</b>${r.visitorId ? `<span style="color:#555;"> · เลขบัตร ${escapeHtml(r.visitorId)}</span>` : ''}</div>
            <div class="info-line contact-line">📞 ${escapeHtml(r.visitorPhone ?? '—')}</div>
            <div class="info-line">ความสัมพันธ์: ${escapeHtml(r.relation ?? '—')}</div>
            <div class="info-line">ศาสนา: ${escapeHtml(r.religion ?? '—')}</div>
            <div class="info-line${hasAllergy ? ' warn-line' : ''}">${hasAllergy ? '⚠️ แพ้อาหาร: ' : 'แพ้อาหาร: '}${escapeHtml(r.allergy || 'ไม่มี')}</div>
          </div>
          ${
            shownExtras.length > 0
              ? `<div class="extra-section">
                <div class="extra-title">👥 ผู้เยี่ยมเพิ่มเติม (${shownExtras.length} คน)</div>
                ${shownExtras
                  .map(
                    (e) => `<div class="extra-item">${escapeHtml(e.name ?? '—')}${e.id ? ' · เลขบัตร ' + escapeHtml(e.id) : ''} · ${escapeHtml(e.relation ?? '—')}${e.approved !== 'yes' ? '<span class="pending-tag">(รออนุมัติ)</span>' : ''}</div>`
                  )
                  .join('')}
              </div>`
              : ''
          }
        </div>
        <div class="table-footer">
          <div class="visit-date-info">วันที่เยี่ยม: <b>${escapeHtml(visitDateLabel(r.visitDate, r.visitDateISO))}</b></div>
          <div class="footer-boxes">
            <div class="${paymentBoxClass(status)}" style="${paid ? 'background:#ecfdf5;color:#166534;border-color:#166534;' : HALTED_STATUSES.includes(status) ? 'background:#fef2f2;color:#b91c1c;border-color:#b91c1c;' : ''}">
              <span class="label">${paid ? 'ชำระแล้ว' : 'ยอดที่ต้องชำระ'}</span>
              <span class="number">${formatNumber(Number(r.total) || 0)} บ.</span>
            </div>
            <div class="people-count">
              <span class="label">จำนวนคน</span>
              <span class="number">${totalPeopleThisTable} คน</span>
            </div>
          </div>
        </div>
      </div>`;
    })
    .join('');

  return `
    <style>${SEATING_REPORT_CSS}</style>
    <div style="text-align:center; margin-bottom:20px;">
      <h1 style="font-size:22px; margin:0 0 4px; font-weight:700; color:#312e81;">🪑 รายงานการจัดโต๊ะ</h1>
      <h2 style="font-size:16px; margin:0 0 2px; font-weight:700; color:#1e1b4b;">ร้าน Chance &amp; Change Cafe · ทัณฑสถานบำบัดพิเศษกลาง</h2>
      <div style="font-size:12px; color:#555;">เรียงตามเลขที่อ้างอิง · จำนวน ${rows.length} โต๊ะ</div>
      ${filterLabel ? `<div class="report-meta">${escapeHtml(filterLabel)}</div>` : ''}
    </div>
    ${blocks}
    <div class="grand-summary">
      <div class="grand-box">
        <div class="grand-title">📋 สรุปยอดรวมทั้งหมด</div>
        <div class="grand-item"><span class="g-label">จำนวนโต๊ะ</span><span class="g-number">${rows.length} โต๊ะ</span></div>
        <div class="grand-item"><span class="g-label">จำนวนผู้เยี่ยม</span><span class="g-number">${formatNumber(totalVisitors)} คน</span></div>
        <div class="grand-item"><span class="g-label">จำนวนผู้ต้องขัง</span><span class="g-number">${formatNumber(totalPrisoners)} คน</span></div>
        <div class="grand-item"><span class="g-label">ชำระแล้ว</span><span class="g-number" style="color:#166534;">${paidTables}/${rows.length} โต๊ะ · ${formatNumber(paidAmount)} บาท</span></div>
        <div class="grand-item"><span class="g-label">ค้างชำระ</span><span class="g-number" style="color:#b91c1c;">${rows.length - paidTables}/${rows.length} โต๊ะ · ${formatNumber(pendingAmount)} บาท</span></div>
        <div class="grand-item"><span class="g-label">ยอดเงินรวม</span><span class="g-number">${formatNumber(totalPrice)} บาท</span></div>
        <div class="grand-total"><span class="g-label">รวมคนทั้งหมด</span><span class="g-number">${formatNumber(totalPeople)} คน</span></div>
      </div>
    </div>
    <div class="page-footer">พิมพ์จากระบบ CC Cafe Reservation · ทัณฑสถานบำบัดพิเศษกลาง</div>
  `;
}

const KITCHEN_TICKET_CSS = `
  .kt-ticket { border:3px solid #1e1b4b; border-radius:10px; padding:16px 18px; margin-bottom:10px; }
  .kt-head { text-align:center; border-bottom:2px solid #1e1b4b; padding-bottom:10px; margin-bottom:14px; }
  .kt-head-title { font-size:20px; font-weight:800; color:#1e1b4b; display:block; }
  .kt-head-date { font-size:15px; font-weight:600; color:#333; display:block; margin-top:2px; }
  .kt-summary { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:0; }
  .kt-box { border:2px solid #1e1b4b; border-radius:8px; text-align:center; padding:12px 4px; }
  .kt-box .kt-num { font-size:36px; font-weight:900; color:#1e1b4b; line-height:1.1; }
  .kt-box .kt-label { font-size:13px; font-weight:600; color:#444; margin-top:4px; }
  .kt-box.kt-highlight { background:#fff8e7; border-color:#d97706; }
  .kt-box.kt-highlight .kt-num { color:#b45309; font-size:44px; }
  .kt-box.kt-highlight .kt-label { font-size:14px; }
  .kt-cut { text-align:center; margin:14px 0; border-top:3px dashed #c62828; padding-top:8px; color:#c62828; font-weight:800; font-size:14px; }
`;

export function buildKitchenReport(rows: Reservation[], date: string): string {
  let totalAdults = 0;
  let totalKids5_8 = 0;
  let totalKidsUnder5 = 0;
  rows.forEach((r) => {
    const d = computeDeptReportData(r);
    totalAdults += d.adults;
    totalKids5_8 += d.kids5_8;
    totalKidsUnder5 += d.kidsUnder5;
  });
  const tables = rows.length;
  const combinedAdults = totalAdults + tables;
  const totalPeople = combinedAdults + totalKids5_8 + totalKidsUnder5;

  const reportBody = `
    <div class="tear-off kt-ticket">
      <div class="kt-head">
        <span class="kt-head-title">🍽️ ใบสั่งอาหาร — ครัว</span>
        <span class="kt-head-date">📅 ${escapeHtml(thaiDateLabel(date))}</span>
      </div>
      <div class="kt-summary">
        <div class="kt-box"><div class="kt-num">${combinedAdults}</div><div class="kt-label">ผู้ใหญ่</div></div>
        <div class="kt-box"><div class="kt-num">${totalKids5_8}</div><div class="kt-label">เด็ก 5-8 ปี</div></div>
        <div class="kt-box"><div class="kt-num">${totalKidsUnder5}</div><div class="kt-label">เด็กต่ำกว่า 5 ปี</div></div>
        <div class="kt-box kt-highlight"><div class="kt-num">${totalPeople}</div><div class="kt-label">รวมทั้งหมด</div></div>
      </div>
    </div>
  `;

  return `
    <style>@page { size: landscape; margin: 10mm; }</style>
    <style>${KITCHEN_TICKET_CSS}</style>
    ${reportBody}
    <div class="tear-off kt-cut">✂️ ตัดตรงนี้ — ส่งเบเกอรี่</div>
    ${reportBody}
  `;
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
      const people = (Number(r.visitorCount) || 1) + extras.length;
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
      acc.people += (Number(r.visitorCount) || 1) + extras.length;
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

export function buildFinancialReport(
  summary: FinancialSummary,
  daily: FinancialDayRow[],
  monthly: FinancialMonthRow[],
  periodLabel: string
): string {
  const fmt = (n: number): string => formatNumber(n);

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
        <td style="text-align:right;">${fmt(d.paid)}</td>
        <td style="text-align:right;">${fmt(d.pending)}</td>
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
        <td style="text-align:right;">${fmt(m.paid)}</td>
        <td style="text-align:right;">${fmt(m.pending)}</td>
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
      <div style="font-size:15px; font-weight:700;">รายงานสรุปผลการดำเนินงานด้านการเงิน</div>
      <div style="font-size:13px; font-weight:600; margin-top:2px;">ร้าน Chance &amp; Change Cafe · ทัณฑสถานบำบัดพิเศษกลาง</div>
      <div style="font-size:11px; color:#555; margin-top:4px;">ช่วงเวลารายงาน: ${escapeHtml(periodLabel)} &nbsp;|&nbsp; จัดทำเมื่อวันที่ ${escapeHtml(issuedLabel)}</div>
    </div>

    <p style="font-size:12px; line-height:1.7; margin-bottom:14px; text-align:justify;">
      รายงานฉบับนี้จัดทำขึ้นเพื่อสรุปผลการดำเนินงานด้านการเงินของร้าน Chance &amp; Change Cafe
      ในช่วงเวลา ${escapeHtml(periodLabel)} ประกอบด้วยข้อมูลจำนวนการจอง ยอดชำระเงิน ยอดค้างชำระ
      และจำนวนผู้เข้าร่วมกิจกรรม โดยมีรายละเอียดดังต่อไปนี้
    </p>

    <h3 style="font-size:12.5px; font-weight:700; margin:0 0 8px;">1. สรุปข้อมูลทางการเงินและผู้เข้าร่วม</h3>
    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
      ${statBox('ยอดชำระแล้ว', fmt(summary.paid) + ' บาท')}
      ${statBox('ยอดค้างชำระ', fmt(summary.pending) + ' บาท')}
      ${statBox('ยอดรวมทั้งสิ้น', fmt(summary.total) + ' บาท')}
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
          <th style="width:90px; text-align:right;">ชำระแล้ว</th>
          <th style="width:90px; text-align:right;">ค้างชำระ</th>
          <th style="width:90px; text-align:right;">ยอดรวม</th>
        </tr>
      </thead>
      <tbody>${dailyRows || '<tr><td colspan="11" style="text-align:center;color:#888;">ไม่มีข้อมูล</td></tr>'}</tbody>
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
          <th style="width:90px; text-align:right;">ชำระแล้ว</th>
          <th style="width:90px; text-align:right;">ค้างชำระ</th>
          <th style="width:90px; text-align:right;">ยอดรวม</th>
        </tr>
      </thead>
      <tbody>${monthlyRows || '<tr><td colspan="11" style="text-align:center;color:#888;">ไม่มีข้อมูล</td></tr>'}</tbody>
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
    ['ผู้ต้องขัง', String(row.prisonerName ?? '')],
    ['แดน', String(row.wing ?? '-')],
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
