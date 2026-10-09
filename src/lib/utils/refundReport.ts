import type { RefundEvidence, Reservation } from '../api/types';
import { bookingPool } from './management';
import { formatBaht, normalizeStatus, visitDateLabel } from './format';
import { escapeHtml } from './print';
import { refundRequestError, type RefundRequest } from './refundEvidence';

export interface RefundReportEntry {
  evidence: RefundEvidence;
  request: RefundRequest;
  ready: boolean;
  error: string;
}

export function refundCandidates(rows: Reservation[]): Reservation[] {
  return rows.filter(row => !!row.ref && ['ยกเลิก', 'ชำระแล้ว', 'เสร็จสิ้น', 'คืนเงินแล้ว'].includes(normalizeStatus(row.status)));
}

export function refundReportTotals(entries: RefundReportEntry[]) {
  let requested = 0, refunded = 0;
  for (const { evidence, request } of entries) {
    const amount = evidence.refund?.amount ?? request.amount;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (evidence.refund) refunded += Math.round(amount * 100);
    else requested += Math.round(amount * 100);
  }
  return { requested: requested / 100, refunded: refunded / 100 };
}

export function buildRefundReport(entries: RefundReportEntry[]): string {
  if (!entries.length) throw new Error('กรุณาเลือกการจองสำหรับรายงานคืนเงิน');
  const refs = new Set<string>();
  const rows = entries.map(({ evidence, request, ready, error }, index) => {
    const row = evidence.booking;
    if (refs.has(row.ref)) throw new Error('พบเลขอ้างอิงซ้ำในรายงาน');
    refs.add(row.ref);
    const refund = evidence.refund ?? request;
    const invalid = refundRequestError(refund, row.total);
    if (!ready || invalid || !evidence.slipImage || (!evidence.refund && !evidence.canCompleteRefund)) throw new Error(`${row.ref}: ${invalid || error || 'กรุณาตรวจสอบหลักฐานและข้อมูลคืนเงินให้ครบถ้วน'}`);
    return `<tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(row.ref)}</strong><small>${bookingPool(row) === 'table' ? 'TBL' : 'VIS'}${row._archived ? ' · ย้อนหลัง' : ''}</small><small>${escapeHtml(visitDateLabel(row.visitDate, row.visitDateISO))}</small></td>
      <td>${escapeHtml(row.visitorName)}<small>ผู้รับเงิน: ${escapeHtml(refund.recipient || row.visitorName)}</small><small>${escapeHtml(refund.account || 'ระบุบัญชีในเอกสารแนบ')}</small></td>
      <td class="money">${escapeHtml(formatBaht(row.total))}</td>
      <td class="money"><strong>${escapeHtml(formatBaht(refund.amount))}</strong><small>${refund.amount === Number(row.total) ? 'เต็มจำนวน' : 'บางส่วน'}</small></td>
      <td>${evidence.refund ? 'คืนเงินแล้ว' : 'ขอคืนเงิน'}<small>${escapeHtml(refund.reason)}</small>${evidence.refund ? `<small>${escapeHtml(evidence.refund.timestamp)} · ${escapeHtml(evidence.refund.actor)}</small>` : ''}</td>
    </tr>`;
  }).join('');
  const totals = refundReportTotals(entries);
  return `<style>
    @page { size: A4 portrait; margin: 10mm; }
    .refund-report { overflow-wrap: anywhere; }
    .refund-report table { table-layout: fixed; }
    .refund-report th:first-child { width: 5%; }
    .refund-report th:nth-child(2) { width: 18%; }
    .refund-report th:nth-child(3) { width: 25%; }
    .refund-report th:nth-child(4), .refund-report th:nth-child(5) { width: 14%; }
    .refund-report td { vertical-align: top; }
    .refund-report small { display: block; font-size: 9px; color: #555; margin-top: 3px; }
    .refund-report .money { text-align: right; }
    .refund-report-totals { margin: 12px 0; line-height: 1.9; }
    .refund-report-signatures { display: flex; justify-content: space-around; gap: 16px; margin-top: 32px; text-align: center; }
    @media print { .refund-report thead { display: table-header-group; } .refund-report tr, .refund-report-totals, .refund-report-signatures { break-inside: avoid; } }
  </style><div class="refund-report">
    <div class="print-title">รายงานคืนเงินสำหรับรายการที่เลือก</div>
    <p style="margin-bottom:10px">จำนวน ${entries.length} รายการ · ใช้ร่วมกับเอกสารประกอบการคืนเงินและสลิปของแต่ละการจอง</p>
    <table><thead><tr><th>ลำดับ</th><th>เลขอ้างอิง / วันที่เข้าร่วม</th><th>ผู้จอง / ผู้รับเงิน / บัญชี</th><th>ยอดจอง</th><th>ยอดคืนเงิน</th><th>สถานะ / เหตุผล</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="refund-report-totals"><div><strong>ยอดขอคืนเงิน: ${escapeHtml(formatBaht(totals.requested))}</strong></div><div><strong>ยอดที่บันทึกคืนเงินแล้ว: ${escapeHtml(formatBaht(totals.refunded))}</strong></div></div>
    <p>รายการ “ขอคืนเงิน” ยังไม่ได้บันทึกว่าโอนเงินคืนแล้ว ฝ่ายการเงินตรวจสอบเอกสารแนบและสลิปก่อนดำเนินการ</p>
    <div class="refund-report-signatures"><div>ลงชื่อ ................................<br>ผู้จัดทำ / วันที่ ....................</div><div>ลงชื่อ ................................<br>ผู้อนุมัติ / วันที่ ....................</div><div>ลงชื่อ ................................<br>ฝ่ายการเงิน / วันที่ ....................</div></div>
  </div>`;
}
