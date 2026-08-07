<script lang="ts">
  import { onMount } from 'svelte';
  import { ChevronLeft, ChevronRight, Search, RefreshCw } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Badge from '../lib/components/ui/Badge.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { getReservations } from '../lib/api/endpoints';
  import { ui } from '../lib/store/ui.svelte';
  import { statusColor, formatBaht } from '../lib/utils/format';
  import type { Reservation } from '../lib/api/types';

  let rows = $state<Reservation[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let statusFilter = $state('');
  let dateFilter = $state('');
  let pageSize = $state(10);
  let page = $state(1);

  let statuses = $derived(Array.from(new Set(rows.map((r) => String(r.status ?? '').trim()).filter(Boolean))).sort());
  let dates = $derived(Array.from(new Set(rows.map((r) => String(r.visitDateISO ?? '')).filter(Boolean))).sort().reverse());

  let filtered = $derived(
    rows.filter((r) => {
      if (search) {
        const q = search.trim().toLowerCase();
        const hay = [r.ref, r.visitorName, r.prisonerName, r.visitorPhone, r.wing]
          .map((v) => String(v ?? '').toLowerCase())
          .join(' ');
        if (!hay.includes(q)) return false;
      }
      if (statusFilter && String(r.status ?? '').trim() !== statusFilter) return false;
      if (dateFilter && String(r.visitDateISO ?? '') !== dateFilter) return false;
      return true;
    })
  );

  let totalPages = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
  let pagedRows = $derived(filtered.slice((page - 1) * pageSize, page * pageSize));

  $effect(() => {
    if (page > totalPages) page = totalPages;
  });

  onMount(fetchData);

  async function fetchData(): Promise<void> {
    loading = true;
    error = '';
    try {
      const data = await getReservations();
      rows = data.rows ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
      ui.showToast(error, 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="ระบบจอง" subtitle="ตารางการจองทั้งหมด">
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            bind:value={search}
            placeholder="ค้นหาชื่อผู้มาเยี่ยม, ผู้ต้องขัง, REF, ปีก"
            class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <select
          bind:value={statusFilter}
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามสถานะ"
        >
          <option value="">ทุกสถานะ</option>
          {#each statuses as s (s)}
            <option value={s}>{s}</option>
          {/each}
        </select>
        <select
          bind:value={dateFilter}
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามวันที่"
        >
          <option value="">ทุกวัน</option>
          {#each dates as d (d)}
            <option value={d}>{d}</option>
          {/each}
        </select>
        <button
          class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          onclick={fetchData}
          aria-label="โหลดข้อมูลใหม่"
        >
          <RefreshCw class="h-4 w-4" />
        </button>
      </div>

      {#if loading}
        <div class="flex items-center justify-center py-16">
          <Spinner />
        </div>
      {:else if error}
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th class="px-3 py-2 font-medium">REF</th>
                <th class="px-3 py-2 font-medium">ผู้มาเยี่ยม</th>
                <th class="px-3 py-2 font-medium">ผู้ต้องขัง</th>
                <th class="px-3 py-2 font-medium">ปีก</th>
                <th class="px-3 py-2 font-medium">วันที่</th>
                <th class="px-3 py-2 text-right font-medium">ยอดรวม</th>
                <th class="px-3 py-2 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {#each pagedRows as row (row.ref)}
                <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td class="px-3 py-2.5 font-mono text-indigo-600 dark:text-indigo-400">{row.ref}</td>
                  <td class="px-3 py-2.5">{row.visitorName}</td>
                  <td class="px-3 py-2.5">{row.prisonerName}</td>
                  <td class="px-3 py-2.5">{row.wing}</td>
                  <td class="px-3 py-2.5">{row.visitDateISO}</td>
                  <td class="px-3 py-2.5 text-right whitespace-nowrap">{formatBaht(row.total)}</td>
                  <td class="px-3 py-2.5">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor(row.status)}">
                      {row.status}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>

          {#if filtered.length === 0}
            <div class="py-10 text-center text-sm text-slate-400 dark:text-slate-500">ไม่พบข้อมูล</div>
          {/if}
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            แสดง {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)}
            จาก {filtered.length} รายการ
          </p>
          <div class="flex items-center gap-2">
            <select
              bind:value={pageSize}
              class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              aria-label="จำนวนรายการต่อหน้า"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button
              class="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
              onclick={() => (page = Math.max(1, page - 1))}
              disabled={page <= 1}
              aria-label="ก่อนหน้า"
            >
              <ChevronLeft class="h-4 w-4" />
            </button>
            <span class="text-sm text-slate-600 dark:text-slate-300">{page} / {totalPages}</span>
            <button
              class="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
              onclick={() => (page = Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              aria-label="ถัดไป"
            >
              <ChevronRight class="h-4 w-4" />
            </button>
          </div>
        </div>
      {/if}
    </div>
  </Card>
</div>
