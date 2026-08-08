import { formatNumber } from './format';
import type { Reservation } from '../api/types';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ExtraVisitor {
  name: string;
  id: string;
  relation: string;
  age: string;
  approved: string;
}

export function parseExtraVisitors(row: Reservation): ExtraVisitor[] {
  const str = String(row.extraVisitorNames ?? '').trim();
  if (!str) return [];
  const isNew = str.includes(';;') || str.includes('|');
  let items: Array<{ name: string; id: string; relation: string; age: string }>;
  if (isNew) {
    items = str.split(';;').map((e) => {
      const p = e.split('|');
      return { name: (p[0] ?? '').trim(), id: (p[1] ?? '').trim(), relation: (p[2] ?? '').trim(), age: (p[3] ?? '').trim() };
    });
  } else {
    items = str.split(/,(?![^(]*\))/).map((e) => {
      const m = e.trim().match(/^(.+?)\s*\(/);
      return { name: m ? m[1].trim() : e.trim(), id: '', relation: m ? e.trim().slice(m[0].length, -1) : '', age: '' };
    });
  }
  const appr = String(row.extraVisitorApproved ?? '').split(';;');
  return items
    .filter((v) => v.name)
    .map((v, i) => ({ ...v, approved: (appr[i] ?? '').trim() }));
}

export function computeDeptReportData(row: Reservation): { adults: number; kids5_8: number; kidsUnder5: number } {
  const extras = parseExtraVisitors(row);
  let adults = 1;
  let kids5_8 = 0;
  let kidsUnder5 = 0;
  extras.forEach((v) => {
    if (v.approved === 'no') return;
    if (v.relation === 'บุตร / ธิดา') {
      const a = parseInt(v.age, 10);
      if (!isNaN(a)) {
        if (a < 5) kidsUnder5++;
        else if (a <= 8) kids5_8++;
        else adults++;
      } else {
        adults++;
      }
    } else {
      adults++;
    }
  });
  return { adults, kids5_8, kidsUnder5 };
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
      <div style="text-align:right;">ที่ จน.ศก. ๐๐๑/๒๕๖๘</div>
      <div style="text-align:right;">วันที่ ${escapeHtml(date)}</div>
      <br>
      <div><strong>เรื่อง</strong> ขออนุมัติเบิกตัวผู้ต้องขังเข้าร่วมกิจกรรม Chance &amp; Change Cafe</div>
      <div><strong>เรียน</strong> ผู้อำนวยการทัณฑสถานบำบัดพิเศษกลาง</div>
      <br>
      <div>ด้วยทัณฑสถานบำบัดพิเศษกลางกำหนดจัดกิจกรรม Chance &amp; Change Cafe ในวันดังกล่าว ข้าพเจ้าขออนุมัติเบิกตัวผู้ต้องขังตามรายการแนบท้าย เพื่อเข้าร่วมกิจกรรม จำนวน <strong>${prisoners.length} ราย</strong></div>
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
          <td style="border:none; width:33%; text-align:center; height:70px; vertical-align:bottom;">
            <div>ลงชื่อ.............................................. ผู้เสนอ</div>
            <div style="font-size:10px; color:#555; margin-top:2px;">(..................................................)</div>
          </td>
          <td style="border:none; width:33%; text-align:center; vertical-align:bottom;">
            <div>ลงชื่อ.............................................. ผู้เห็นชอบ</div>
            <div style="font-size:10px; color:#555; margin-top:2px;">(..................................................)</div>
          </td>
          <td style="border:none; width:33%; text-align:center; vertical-align:bottom;">
            <div>ลงชื่อ.............................................. ผู้อนุมัติ</div>
            <div style="font-size:10px; color:#555; margin-top:2px;">(..................................................)</div>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

export function buildGateRegistrationReport(rows: Reservation[], date: string): string {
  const body = rows
    .map((r, i) => {
      const mainName = String(r.visitorName ?? '—');
      const extras = parseExtraVisitors(r).filter((e) => e.approved !== 'no');
      const visitors = [mainName, ...extras.map((e) => e.name)].join(', ');
      const count = (Number(r.visitorCount) || 1) + 1;
      return `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td style="text-align:center;">${escapeHtml(r.ref)}</td>
        <td></td>
        <td>${escapeHtml(visitors)}</td>
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
    <div class="print-title">ทะเบียนผู้เข้าเยี่ยม — วันที่ ${escapeHtml(date)}</div>
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

export function buildKitchenReport(rows: Reservation[], date: string): string {
  let totalAdults = 0;
  let totalKids5_8 = 0;
  let totalKidsUnder5 = 0;
  let totalPrice = 0;
  rows.forEach((r) => {
    const d = computeDeptReportData(r);
    totalAdults += d.adults;
    totalKids5_8 += d.kids5_8;
    totalKidsUnder5 += d.kidsUnder5;
    totalPrice += Number(r.total) || 0;
  });
  const tables = rows.length;
  const relatives = rows.reduce((s, r) => s + (Number(r.visitorCount) || 1), 0);
  const combinedAdults = totalAdults + tables;

  const reportBody = `
    <div class="tear-off" style="border:2px solid #333; padding:12px; margin-bottom:8px; font-size:13px;">
      <strong style="font-size:15px;">🍽️🍰 ครัว + เบเกอรี่ — วันที่ ${escapeHtml(date)}</strong><br><br>
      จำนวนโต๊ะ: <strong>${tables} โต๊ะ</strong><br>
      รวมผู้เข้าร่วม: <strong>${relatives + tables} คน</strong> (ญาติ ${relatives} + ผู้ต้องขัง ${tables})<br><br>
      <strong>ผู้ใหญ่ (รวมผู้ต้องขัง):</strong> ${combinedAdults} คน<br>
      <strong>เด็ก 5-8 ปี:</strong> ${totalKids5_8} คน<br>
      <strong>ต่ำกว่า 5 ปี:</strong> ${totalKidsUnder5} คน<br><br>
      <strong>ยอดชำระรวม: ${formatNumber(totalPrice)} บาท</strong>
    </div>
  `;

  return `
    <div class="print-title" style="margin-bottom:8px;">🍽️🍰 ครัว + เบเกอรี่ — วันที่ ${escapeHtml(date)}</div>
    <p style="text-align:center; font-size:12px; color:#555; margin-bottom:12px;">พิมพ์ 1 ครั้ง → ตัดตรงกลาง ส่งครัว 1 ชุด / เบเกอรี่ 1 ชุด</p>
    ${reportBody}
    <div class="tear-off" style="text-align:center; margin:12px 0; border-top:2px dashed #c62828; padding-top:8px; color:#c62828; font-weight:700;">
      ✂️ ตัดตรงนี้ — ส่งครัว
    </div>
    ${reportBody}
  `;
}
