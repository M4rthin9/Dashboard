<script lang="ts">
  import { onMount } from 'svelte';
  import { RefreshCw, Search, Upload } from '@lucide/svelte';
  import Papa from 'papaparse';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import Modal from '../lib/components/ui/Modal.svelte';
  import Pagination from '../lib/components/ui/Pagination.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { hasPermission } from '../lib/utils/permissions';
  import { getPrisoners, importPrisoners, syncPrisonerWings } from '../lib/api/endpoints';
  import type { Prisoner } from '../lib/api/types';

  let rows = $state<Prisoner[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let page = $state(1);
  let pageSize = $state(20);

  let importOpen = $state(false);
  let importText = $state('');
  let importErrors = $state<string[]>([]);
  let parsed = $state<{ prisonerId: string; prisonerName: string; wing: string; status: string; vinaiDate: string; note: string }[]>([]);
  let importing = $state(false);
  let syncing = $state(false);

  const isManager = $derived(auth.user?.role === 'Superadmin' || auth.user?.role === 'Admin' || hasPermission(auth.user?.role ?? '', 'manage_users'));

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.prisonerId, r.prisonerName, r.wing, r.status, r.vinaiDate]
        .map((v) => String(v ?? '').toLowerCase())
        .some((v) => v.includes(q))
    );
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
      const res = await getPrisoners();
      rows = (res.prisoners ?? []).sort((a, b) => a.prisonerId.localeCompare(b.prisonerId));
    } catch (err) {
      error = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
      ui.showAlert({ title: 'ไม่สามารถโหลดข้อมูลได้', message: error, type: 'error' });
    } finally {
      loading = false;
    }
  }

  function openImport(): void {
    importText = '';
    parsed = [];
    importErrors = [];
    importOpen = true;
  }

  function parseCSV(text: string): void {
    const result = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
    const rows2 = result.data;
    const cleaned: typeof parsed = [];
    const errs: string[] = [];
    rows2.forEach((r, i) => {
      const prisonerId = String(r['เลขผู้ต้องขัง'] ?? r['prisonerId'] ?? r['ref'] ?? '').trim();
      const prisonerName = String(r['ชื่อ-นามสกุล'] ?? r['prisonerName'] ?? r['ชื่อ'] ?? '').trim();
      if (!prisonerId || !prisonerName) {
        errs.push('แถวที่ ' + (i + 2) + ': ขาดเลขผู้ต้องขังหรือชื่อ');
        return;
      }
      cleaned.push({
        prisonerId,
        prisonerName,
        wing: String(r['แดน'] ?? r['wing'] ?? '').trim(),
        status: String(r['สถานะ'] ?? r['status'] ?? '').trim(),
        vinaiDate: String(r['วันที่พ้นโทษ/ไถ่ถอน'] ?? r['vinaiDate'] ?? '').trim(),
        note: String(r['หมายเหตุ'] ?? r['note'] ?? '').trim(),
      });
    });
    parsed = cleaned.slice(0, 5000);
    importErrors = errs;
    if (cleaned.length > 5000) importErrors.push('ข้อมูลเกิน 5000 รายการ ระบบจะนำเข้าเพียง 5000 รายการแรก');
    if (parsed.length === 0) {
      ui.showAlert({ title: 'ไม่พบข้อมูลที่นำเข้าได้', message: 'ไม่พบข้อมูลที่สามารถนำเข้าได้ (ควรมีคอลัมน์ เลขผู้ต้องขัง และ ชื่อ-นามสกุล)', type: 'warning' });
    }
  }

  async function submitImport(): Promise<void> {
    if (parsed.length === 0) return;
    importing = true;
    try {
      const res = await importPrisoners(parsed);
      if (res.status !== 'ok') {
        ui.showAlert({ title: 'นำเข้าไม่สำเร็จ', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
        return;
      }
      ui.showAlert({ title: 'นำเข้าสำเร็จ', message: String(res.message ?? 'นำเข้าข้อมูลผู้ต้องขังเรียบร้อย'), type: 'success' });
      if (res.errors && res.errors.length > 0) importErrors = [...importErrors, ...res.errors];
      importOpen = false;
      await fetchData();
    } catch (err) {
      ui.showAlert({ title: 'เกิดข้อผิดพลาด', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      importing = false;
    }
  }

  async function doSyncWings(): Promise<void> {
    syncing = true;
    try {
      const res = await syncPrisonerWings();
      if (res.status !== 'ok') {
        ui.showAlert({ title: 'ซิงค์ไม่สำเร็จ', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
        return;
      }
      ui.showAlert({ title: 'ซิงค์แดนสำเร็จ', message: String(res.message ?? 'ซิงค์ข้อมูลแดนเรียบร้อย'), type: 'success' });
    } catch (err) {
      ui.showAlert({ title: 'เกิดข้อผิดพลาด', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      syncing = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="ผู้ต้องขัง" subtitle="ฐานข้อมูลผู้ต้องขังทั้งหมด ({rows.length} รายการ)">
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            bind:value={search}
            placeholder="ค้นหาเลขผู้ต้องขัง, ชื่อ, แดน..."
            class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        {#if isManager}
          <button class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={doSyncWings} disabled={syncing}>
            {syncing ? 'กำลังซิงค์...' : 'ซิงค์แดน'}
          </button>
          <button class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700" onclick={openImport}>
            <span class="flex items-center gap-1.5"><Upload class="h-4 w-4" /> นำเข้า CSV</span>
          </button>
        {/if}
        <button class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={fetchData} aria-label="โหลดใหม่">
          <RefreshCw class="h-4 w-4" />
        </button>
      </div>

      {#if loading && rows.length === 0}
        <div class="flex items-center justify-center py-16"><Spinner /></div>
      {:else if error}
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th class="px-3 py-2 font-medium">เลขผู้ต้องขัง</th>
                <th class="px-3 py-2 font-medium">ชื่อ-นามสกุล</th>
                <th class="px-3 py-2 font-medium">แดน</th>
                <th class="px-3 py-2 font-medium">สถานะ</th>
                <th class="px-3 py-2 font-medium">วันที่พ้นโทษ</th>
                <th class="px-3 py-2 font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {#each paged as p (p.prisonerId)}
                <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td class="px-3 py-2.5 font-mono text-xs">{p.prisonerId}</td>
                  <td class="px-3 py-2.5 font-medium">{p.prisonerName}</td>
                  <td class="px-3 py-2.5">
                    {#if p.wing}
                      <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{p.wing}</span>
                    {/if}
                  </td>
                  <td class="px-3 py-2.5 text-xs">{p.status || '-'}</td>
                  <td class="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{p.vinaiDate || '-'}</td>
                  <td class="max-w-[220px] truncate px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{p.note || ''}</td>
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
            แสดง {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} จาก {filtered.length} รายการ
          </p>
          <div class="flex items-center gap-2">
            <select
              bind:value={pageSize}
              class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              aria-label="จำนวนรายการต่อหน้า"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <Pagination {page} {totalPages} onchange={(p) => (page = p)} />
          </div>
        </div>
      {/if}
    </div>
  </Card>
</div>

<Modal open={importOpen} title="นำเข้าข้อมูลผู้ต้องขัง (CSV)" onclose={() => (importOpen = false)} width="max-w-2xl">
  <div class="flex flex-col gap-4">
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      คอลัมน์ที่รองรับ: <span class="font-mono">เลขผู้ต้องขัง</span>, <span class="font-mono">ชื่อ-นามสกุล</span> (จำเป็น) และ
      <span class="font-mono">แดน</span>, <span class="font-mono">สถานะ</span>, <span class="font-mono">วันที่พ้นโทษ/ไถ่ถอน</span>, <span class="font-mono">หมายเหตุ</span>
      (หรือชื่อคอลัมน์ภาษาอังกฤษ <span class="font-mono">prisonerId</span>, <span class="font-mono">prisonerName</span>, <span class="font-mono">wing</span>, <span class="font-mono">status</span>, <span class="font-mono">vinaiDate</span>, <span class="font-mono">note</span>)
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="csv-paste" class="text-sm font-medium text-slate-700 dark:text-slate-300">วางข้อมูล CSV</label>
      <textarea
        id="csv-paste"
        bind:value={importText}
        rows="8"
        oninput={(e) => parseCSV((e.currentTarget as HTMLTextAreaElement).value)}
        placeholder="เลขผู้ต้องขัง,ชื่อ-นามสกุล,แดน,สถานะ,วันที่พ้นโทษ/ไถ่ถอน,หมายเหตุ&#10;12345,นายสมชาย ใจดี,แดน 1,,,"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      ></textarea>
    </div>

    {#if parsed.length > 0}
      <div class="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
        พร้อมนำเข้า {parsed.length} รายการ (รายแรกที่เห็นด้านล่าง)
      </div>
      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="w-full min-w-[600px] text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <th class="px-3 py-2 font-medium">เลขผู้ต้องขัง</th>
              <th class="px-3 py-2 font-medium">ชื่อ-นามสกุล</th>
              <th class="px-3 py-2 font-medium">แดน</th>
              <th class="px-3 py-2 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {#each parsed.slice(0, 5) as p (p.prisonerId + p.prisonerName)}
              <tr class="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td class="px-3 py-2 font-mono">{p.prisonerId}</td>
                <td class="px-3 py-2">{p.prisonerName}</td>
                <td class="px-3 py-2">{p.wing}</td>
                <td class="px-3 py-2">{p.status}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if importErrors.length > 0}
      <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        {#each importErrors as e (e)}
          <p>{e}</p>
        {/each}
      </div>
    {/if}

    <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => (importOpen = false)}>ปิด</button>
      <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50" onclick={submitImport} disabled={importing || parsed.length === 0}>
        {importing ? 'กำลังนำเข้า...' : `นำเข้า ${parsed.length} รายการ`}
      </button>
    </div>
  </div>
</Modal>
