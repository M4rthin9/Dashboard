<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, RefreshCw } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import Pagination from '../lib/components/ui/Pagination.svelte';
  import { getEventLogs } from '../lib/api/endpoints';
  import { ui } from '../lib/store/ui.svelte';
  import { formatDateTimeThai } from '../lib/utils/format';
  import type { EventLog } from '../lib/api/types';

  let logs = $state<EventLog[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let actionFilter = $state('');
  let page = $state(1);
  let pageSize = $state(20);

  const actions = $derived(
    Array.from(new Set(logs.map((l) => l.action).filter(Boolean))).sort()
  );

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actionFilter && l.action !== actionFilter) return false;
      if (q) {
        const hay = [l.username, l.action, l.targetRef, l.details, l.result, l.ip]
          .map((v) => String(v ?? '').toLowerCase())
          .join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
  const paged = $derived(filtered.slice((page - 1) * pageSize, page * pageSize));

  $effect(() => {
    if (page > totalPages) page = totalPages;
  });

  onMount(fetchData);

  async function fetchData(): Promise<void> {
    loading = true;
    error = '';
    try {
      const data = await getEventLogs();
      logs = (data.logs ?? []).sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? '')));
    } catch (err) {
      error = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
      ui.showAlert({ title: 'ไม่สามารถโหลดข้อมูลได้', message: error, type: 'error' });
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="บันทึกเหตุการณ์" subtitle="ประวัติการใช้งานระบบ" interactive>
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            bind:value={search}
            placeholder="ค้นหาผู้ใช้, การกระทำ, REF, IP"
            class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <select
          bind:value={actionFilter}
          class="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          aria-label="กรองตามการกระทำ"
        >
          <option value="">ทุกการกระทำ</option>
          {#each actions as a (a)}
            <option value={a}>{a}</option>
          {/each}
        </select>
        <button
          class="rounded-xl border border-slate-300 p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          onclick={fetchData}
          aria-label="โหลดข้อมูลใหม่"
        >
          <RefreshCw class="h-4 w-4" />
        </button>
      </div>

      {#if loading && logs.length === 0}
        <div class="flex items-center justify-center py-16">
          <Spinner />
        </div>
      {:else if error}
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</div>
      {:else}
        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800/50">
                <th class="min-w-[150px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">เวลา</th>
                <th class="min-w-[110px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">ผู้ใช้</th>
                <th class="min-w-[130px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">การกระทำ</th>
                <th class="min-w-[90px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">REF</th>
                <th class="min-w-[180px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">รายละเอียด</th>
                <th class="min-w-[90px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">ผลลัพธ์</th>
                <th class="min-w-[100px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">IP</th>
              </tr>
            </thead>
            <tbody>
              {#each paged as log (log.timestamp + log.username + log.action)}
                <tr class="border-b border-slate-200 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                  <td class="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{formatDateTimeThai(log.timestamp)}</td>
                  <td class="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">{log.username}</td>
                  <td class="px-3 py-2.5">
                    <span class="font-mono text-xs text-indigo-600 dark:text-indigo-400">{log.action}</span>
                  </td>
                  <td class="px-3 py-2.5 font-mono text-xs">{log.targetRef ?? ''}</td>
                  <td class="max-w-[180px] truncate px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{log.details ?? ''}</td>
                  <td class="px-3 py-2.5">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {log.result === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : log.result === 'denied' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : log.result === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}">
                      {log.result ?? ''}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 font-mono text-xs text-slate-400">{log.ip ?? ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>

          {#if filtered.length === 0}
            <div class="py-12 text-center text-sm text-slate-400 dark:text-slate-500">ไม่พบข้อมูล</div>
          {/if}
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            แสดง {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} จาก {filtered.length} รายการ
          </p>
          <Pagination {page} {totalPages} onchange={(p) => (page = p)} />
        </div>
      {/if}
    </div>
  </Card>
</div>
