<script lang="ts">
  import { CalendarDays, ArrowUpRight, Users } from '@lucide/svelte';
  import type { Reservation } from '../../api/types';
  import Card from '../ui/Card.svelte';
  import { reservations } from '../../store/reservations.svelte';
  import { normalizeStatus, formatBaht, visitDateLabel, prisonersOf, statusColor } from '../../utils/format';
  import { businessDate, activeBooking, bookingPool, peopleCount, visitOrder, validDate } from '../../utils/management';
  let { rows = reservations.rows, ondetail }: { rows?: Reservation[]; ondetail?: (row: Reservation) => void } = $props();
  let selectedDate = $state(businessDate());
  let type = $state('');
  const dates = $derived([...new Set([businessDate(), ...rows.map(row => String(row.visitDateISO ?? '').trim()).filter(validDate)])].sort().reverse());
  const dayBookings = $derived(rows.filter(row => activeBooking(row) && row.visitDateISO?.trim() === selectedDate && (!type || bookingPool(row) === type)).sort(visitOrder));
</script>

<Card title="การจองรายวัน" subtitle="รายการตามวันเข้าเยี่ยม / ใช้บริการ · ไม่มีข้อมูลการกำหนดหมายเลขหรือตำแหน่งโต๊ะในระบบ">
  <div class="mb-5 flex flex-wrap items-end gap-3"><div><label for="roster-date" class="mb-1.5 block text-xs text-slate-500">วันที่ใช้บริการ</label><select id="roster-date" bind:value={selectedDate} class="management-input">{#each dates as date (date)}<option value={date}>{visitDateLabel(date)}</option>{/each}</select></div><div><label for="roster-type" class="mb-1.5 block text-xs text-slate-500">ประเภทการจอง</label><select id="roster-type" bind:value={type} class="management-input"><option value="">ทุกประเภท</option><option value="prisoner">เยี่ยมผู้ต้องขัง</option><option value="table">จองโต๊ะ (TBL)</option></select></div><p class="ml-auto text-xs text-slate-500">{dayBookings.length} การจอง · {dayBookings.reduce((sum, row) => sum + peopleCount(row), 0)} คนตามข้อมูลการจอง</p></div>
  {#if !dayBookings.length}<div class="flex flex-col items-center gap-3 py-14 text-center text-slate-400"><CalendarDays class="h-8 w-8" /><p class="text-sm">ไม่มีการจองที่ยังมีผลในวันที่เลือก</p></div>
  {:else}<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{#each dayBookings as row (row.ref)}<article class="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div class="flex flex-wrap items-center justify-between gap-2"><p class="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{row.ref}</p><span class="rounded-full px-2 py-1 text-[10px] {statusColor(row.status)}">{normalizeStatus(row.status)}</span></div><p class="mt-3 text-[10px] font-medium text-slate-400">{bookingPool(row) === 'table' ? 'จองโต๊ะ (ไม่มีผู้ต้องขัง)' : 'เยี่ยมผู้ต้องขัง'}</p><p class="mt-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{row.visitorName || '—'}</p>{#if bookingPool(row) === 'prisoner'}<p class="mt-1 text-xs text-slate-500">{prisonersOf(row).map(prisoner => prisoner.name).join(', ') || 'ไม่ระบุผู้ต้องขัง'}</p>{/if}<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800"><span class="flex items-center gap-1"><Users class="h-3.5 w-3.5" />{peopleCount(row)} คน</span><span class="tabular-nums">{formatBaht(row.total)}</span></div>{#if row._archived}<p class="mt-2 text-[10px] text-slate-400">ข้อมูลย้อนหลังที่เก็บถาวร</p>{/if}{#if ondetail}<button class="mt-3 flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300" onclick={() => ondetail?.(row)}>ดูรายละเอียด <ArrowUpRight class="h-3.5 w-3.5" /></button>{/if}</article>{/each}</div>{/if}
</Card>
