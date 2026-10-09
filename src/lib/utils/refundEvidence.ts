import type { RefundEvidence } from '../api/types';
import { escapeHtml } from './print';
import { formatBaht, visitDateLabel } from './format';

export interface RefundRequest {
  amount: number;
  reason: string;
  recipient: string;
  account: string;
}

export function refundRequestError(request: RefundRequest, total: unknown): string {
  const max = Number(total);
  if (!Number.isFinite(max) || max <= 0) return 'ไม่พบยอดชำระตามข้อมูลการจอง';
  if (!Number.isFinite(request.amount) || request.amount <= 0 || request.amount > max || Math.abs(request.amount * 100 - Math.round(request.amount * 100)) > 0.00001) return 'ระบุยอดคืนเงินมากกว่า 0 และไม่เกินยอดชำระ โดยมีทศนิยมไม่เกิน 2 ตำแหน่ง';
  if (!request.reason.trim() || request.reason.length > 250) return 'กรุณาระบุเหตุผลขอคืนเงิน ไม่เกิน 250 ตัวอักษร';
  if (request.recipient.length > 200 || request.account.length > 150) return 'ชื่อผู้รับเงินหรือข้อมูลบัญชียาวเกินกำหนด';
  return '';
}

export function buildRefundEvidence(evidence: RefundEvidence, request: RefundRequest): string {
  if (evidence.refund) request = evidence.refund;
  const error = refundRequestError(request, evidence.booking.total);
  if (error) throw new Error(error);
  if (!evidence.slipImage || !/^(data:image\/(?:png|jpeg|jpg|webp|gif|bmp);base64,|https?:\/\/)/i.test(evidence.slipImage)) throw new Error('ไม่พบสลิปชำระเงินที่สามารถพิมพ์ได้');
  const row = evidence.booking;
  const field = (label: string, value: unknown) => `<div><strong>${escapeHtml(label)}</strong> ${escapeHtml(value || '—')}</div>`;
  const table = row.bookingType === 'table' || row.ref.toUpperCase().startsWith('TBL-');
  const stages = evidence.stages.map(stage => `<tr><td>${escapeHtml(stage.label)}</td><td>${escapeHtml(stage.state)}<small>${escapeHtml(stage.source)}</small></td><td>${escapeHtml(stage.timestamp || 'ไม่พบบันทึกวัน')}<small>ผู้ดำเนินการ: ${escapeHtml(stage.actor || 'ไม่พบบันทึก')}</small></td></tr>`).join('');
  return `<style>
    @page { size: A4 portrait; margin: 10mm; }
    body:has(.refund-sheet) { width: 190mm; max-width: 100%; margin: 0 auto; }
    .refund-sheet { font-size: 11px; line-height: 1.45; overflow-wrap: anywhere; }
    .refund-sheet h3 { font-size: 12px; margin: 6px 0; }
    .refund-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px; border: 1px solid #aaa; padding: 8px; }
    .refund-sheet table { table-layout: fixed; margin: 8px 0; font-size: 10px; }
    .refund-sheet th:first-child { width: 24%; }
    .refund-sheet th:last-child { width: 31%; }
    .refund-sheet td { padding: 4px 6px; vertical-align: top; }
    .refund-sheet small { display: block; font-size: 9px; color: #555; }
    .refund-request { border: 1px solid #777; padding: 8px; margin: 6px 0; }
    .refund-slip { display: block; width: 100%; height: 95mm; object-fit: contain; margin: 5px auto; }
    .refund-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center; margin-top: 14px; }
    .refund-signatures p { padding-top: 12px; border-bottom: 1px dotted #555; }
    body.refund-print-layout { padding: 0; font-size: 11px; max-width: none; zoom: var(--refund-print-zoom, 1); }
    .refund-print-layout .no-print { display: none !important; }
    .refund-print-layout .print-header { margin-bottom: 6px; padding-bottom: 5px; }
    .refund-print-layout .print-title { margin-bottom: 7px; font-size: 15px; }
    .refund-print-layout .print-footer { margin-top: 7px; padding-top: 4px; }
    @media print { body:has(.refund-sheet) { zoom: var(--refund-print-zoom, 1); max-width: none; } .print-header { margin-bottom: 6px; padding-bottom: 5px; } .print-title { margin-bottom: 7px; font-size: 15px; } .print-footer { margin-top: 7px; padding-top: 4px; } .refund-sheet tr, .refund-request, .refund-slip, .refund-signatures { break-inside: avoid; } }
  </style>
  <div class="refund-sheet">
    <div class="print-title">เอกสารประกอบการขอคืนเงิน — ${escapeHtml(row.ref)}</div>
    <div class="refund-meta">
      ${field('ประเภท:', table ? 'จองโต๊ะ (TBL)' : 'เยี่ยมญาติ (VIS)')}
      ${field('สถานะปัจจุบัน:', row.status)}
      ${field('ผู้จอง:', row.visitorName)}
      ${field('เลขบัตร/หนังสือเดินทาง:', row.visitorId)}
      ${field('โทรศัพท์:', row.visitorPhone)}
      ${field('วันที่เข้าร่วม:', visitDateLabel(row.visitDate, row.visitDateISO))}
      ${!table ? field('ผู้ต้องขัง:', row.prisonerName) + field('เลขผู้ต้องขัง/แดน:', [row.prisonerId, row.wing].filter(Boolean).join(' / ')) : ''}
      ${field('จำนวนผู้เข้าร่วม:', row.totalPersons)}
      ${field('ยอดตามข้อมูลการจอง:', formatBaht(row.total))}
    </div>
    <h3>หลักฐานการจอง การอนุมัติ และการชำระเงิน${row._archived ? ' (รายการย้อนหลัง)' : ''}</h3>
    <table><thead><tr><th>ขั้นตอน</th><th>หลักฐานที่พบ</th><th>วันเวลา / ผู้ดำเนินการ</th></tr></thead><tbody>${stages}</tbody></table>
    <div class="refund-request">
      <strong>จำนวนเงินที่ขอคืน: ${escapeHtml(formatBaht(request.amount))} (${request.amount === Number(row.total) ? 'เต็มจำนวน' : 'บางส่วน'})</strong>
      ${field('เหตุผล:', request.reason.trim())}
      ${field('ผู้รับเงินคืน:', request.recipient.trim() || row.visitorName)}
      ${field('ธนาคาร / เลขบัญชี:', request.account.trim() || '........................................................')}
    </div>
    ${evidence.refund ? `<div class="refund-request"><strong>บันทึกคืนเงินแล้ว: ${escapeHtml(formatBaht(evidence.refund.amount))}</strong>${field('วันที่บันทึก:', evidence.refund.timestamp)}${field('ผู้บันทึก:', evidence.refund.actor)}</div>` : ''}
    <h3>สลิปชำระเงินที่ลูกค้าอัปโหลด</h3>
    <img class="refund-slip" src="${escapeHtml(evidence.slipImage)}" alt="สลิปชำระเงิน ${escapeHtml(row.ref)}" />
    <small>เอกสารประกอบการพิจารณาคืนเงิน ไม่ใช่หลักฐานว่าได้คืนเงินแล้ว ฝ่ายการเงินตรวจสอบยอดและสลิปก่อนดำเนินการ</small>
    <div class="refund-signatures"><div><p>ลงชื่อ ................................</p>ผู้จัดทำ / วันที่ ...............</div><div><p>ลงชื่อ ................................</p>ผู้อนุมัติ / วันที่ ...............</div><div><p>ลงชื่อ ................................</p>ฝ่ายการเงิน / วันที่ ...............</div></div>
  </div>
  <script>
    // Fit unusually long names/reasons without cropping evidence or the slip.
    window.addEventListener('beforeprint', () => {
      document.body.style.setProperty('--refund-print-zoom', '1');
      // beforeprint can fire before Chromium applies print media styles.
      document.body.classList.add('refund-print-layout');
      const measure = document.createElement('div');
      measure.style.cssText = 'position:absolute;visibility:hidden;height:277mm;width:1px';
      document.body.appendChild(measure);
      const pageHeight = measure.getBoundingClientRect().height - 8;
      measure.remove();
      const contentHeight = document.body.getBoundingClientRect().height;
      document.body.style.setProperty('--refund-print-zoom', String(Math.min(1, pageHeight / contentHeight)));
    });
    window.addEventListener('afterprint', () => {
      document.body.style.removeProperty('--refund-print-zoom');
      document.body.classList.remove('refund-print-layout');
    });
    const slip = document.querySelector('.refund-slip');
    const printButton = document.querySelector('.print-preview-bar button');
    if (printButton && slip) {
      printButton.disabled = true;
      slip.decode().then(() => { printButton.disabled = false; }).catch(() => {
        const error = document.createElement('p');
        error.textContent = 'โหลดสลิปไม่สำเร็จ กรุณาปิดเอกสารและลองใหม่';
        error.className = 'no-print';
        error.style.color = '#b91c1c';
        slip.replaceWith(error);
      });
    }
  </script>`;
}
