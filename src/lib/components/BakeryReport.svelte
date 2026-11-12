<script lang="ts">
  import type { Reservation } from '../api/types';
  import { prisonersOf, visitDateLabel } from '../utils/format';
  import { bookingPool } from '../utils/management';
  import { escapeHtml, openPrintWindow } from '../utils/print';
  import { ui } from '../store/ui.svelte';

  let { rows, date, printerName }: { rows: Reservation[]; date: string; printerName: string } = $props();
  const count = (value: unknown): number | null =>
    value !== null && value !== undefined && String(value).trim() !== '' && Number.isInteger(Number(value)) && Number(value) >= 0
      ? Number(value) : null;
  const summary = $derived(rows.reduce((total, row) => {
    const visitors = count(row.visitorCount);
    return {
      people: total.people + (visitors ?? 0) + (bookingPool(row) === 'table' ? 0 : prisonersOf(row).length),
      missing: total.missing + Number(visitors === null),
    };
  }, { people: 0, missing: 0 }));

  function printReport() {
    if (!date || !rows.length || summary.missing) return;
    const content = `<style>
      @page { size:A4 portrait; margin:12mm; }
      .print-header { text-align:left; border:0; margin:0 0 12px; padding:0; }
      .print-header h1, .print-footer { display:none; }
      .print-header h2 { font-size:14px; }
      .bakery-summary { max-width:500px; border-top:1px solid #777; border-bottom:1px solid #777; padding:12px 0; }
      .bakery-summary h2 { font-size:17px; margin:0 0 4px; }
      .bakery-date { font-size:12px; color:#444; }
      .bakery-serving { margin:18px 0 12px; font-size:15px; }
      .bakery-serving strong { font-size:46px; margin:0 8px; }
      .bakery-tables { font-size:12px; }
    </style><section class="bakery-summary">
      <h2>ยอดเตรียมขนมประจำวัน</h2>
      <p class="bakery-date">${escapeHtml(visitDateLabel(undefined, date))}</p>
      <p class="bakery-serving">เตรียมขนมสำหรับ <strong>${summary.people.toLocaleString('th-TH')}</strong> คน</p>
      <p class="bakery-tables">รวม ${rows.length.toLocaleString('th-TH')} โต๊ะ</p>
    </section>`;
    if (!openPrintWindow(content, 'ยอดเตรียมขนมประจำวัน', printerName)) {
      ui.showAlert({ title: 'กรุณาอนุญาต Popup', message: 'อนุญาต Popup เพื่อเปิดรายงาน', type: 'warning' });
    }
  }
</script>

<section class="bakery" aria-label="ยอดเตรียมขนมประจำวัน">
  <header>
    <div><h3>ยอดเตรียมขนมประจำวัน</h3><p>{visitDateLabel(undefined, date)}</p></div>
    <button onclick={printReport} disabled={!date || !rows.length || summary.missing > 0}>พิมพ์ / บันทึก PDF</button>
  </header>
  {#if summary.missing}
    <p class="warning" role="status">ตรวจสอบจำนวนผู้เข้าร่วม {summary.missing} โต๊ะก่อนสรุปยอดขนม</p>
  {:else if rows.length}
    <div class="serving"><span>เตรียมขนมสำหรับ</span><p><strong>{summary.people.toLocaleString('th-TH')}</strong> คน</p><span>รวม {rows.length.toLocaleString('th-TH')} โต๊ะ</span></div>
  {:else}
    <p class="empty">ไม่มีการจองที่ยืนยันแล้วในวันที่เลือก</p>
  {/if}
</section>

<style>
  .bakery { border:1px solid #e4d6c5; border-radius:14px; background:#fffdf8; color:#513c2e; padding:20px; }
  .bakery header { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; }
  .bakery h3 { font-size:17px; font-weight:600; }
  .bakery header p { font-size:12px; color:#806d5c; margin-top:4px; }
  .bakery button { background:#74492d; color:white; border-radius:8px; padding:9px 14px; font-weight:600; font-size:12px; cursor:pointer; }
  .bakery button:disabled { opacity:.45; cursor:default; }
  .bakery button:focus-visible { outline:3px solid #ca9c67; outline-offset:3px; }
  .serving { margin-top:18px; padding-top:16px; border-top:1px solid #e4d6c5; }
  .serving > span { font-size:13px; color:#806d5c; }
  .serving p { margin:2px 0; font-size:16px; }
  .serving strong { font-size:46px; line-height:1.3; font-weight:600; margin-right:6px; font-variant-numeric:tabular-nums; }
  .warning { margin-top:16px; font-size:13px; color:#9b5c17; }
  .empty { padding-top:20px; font-size:13px; color:#806d5c; }
  @media(max-width:540px) { .bakery { padding:16px; } .bakery button { width:100%; } }
</style>
