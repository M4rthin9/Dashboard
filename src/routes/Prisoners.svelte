<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, FileDown, Pencil, RefreshCw, Search, Upload } from '@lucide/svelte';
  import Papa from 'papaparse';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import Modal from '../lib/components/ui/Modal.svelte';
  import Pagination from '../lib/components/ui/Pagination.svelte';
  import PrisonerEditModal from '../lib/components/PrisonerEditModal.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { hasPermission } from '../lib/utils/permissions';
  import { downloadPrisonerTemplate, exportPrisonersCSV } from '../lib/utils/csv';
  import { getPrisoners, importPrisoners, syncPrisonerWings } from '../lib/api/endpoints';
  import type { Prisoner } from '../lib/api/types';

  interface ImportRow {
    prisonerId: string;
    prisonerName: string;
    wing: string;
    status: string;
    vinaiDate: string;
    note: string;
    isNew: boolean;
  }

  let rows = $state<Prisoner[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let wingFilter = $state('');
  let page = $state(1);
  let pageSize = $state(20);

  let importOpen = $state(false);
  let importText = $state('');
  let importErrors = $state<string[]>([]);
  let parsed = $state<ImportRow[]>([]);
  let importing = $state(false);
  let syncing = $state(false);
  let dragging = $state(false);

  let editing = $state<Prisoner | null>(null);
  let editOpen = $state(false);

  const isManager = $derived(auth.user?.role === 'Superadmin' || auth.user?.role === 'Admin' || hasPermission(auth.user?.role ?? '', 'manage_users'));

  const wings = $derived([...new Set(rows.map((r) => r.wing).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')));

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (wingFilter && r.wing !== wingFilter) return false;
      if (!q) return true;
      return [r.prisonerId, r.prisonerName, r.wing, r.status, r.vinaiDate]
        .map((v) => String(v ?? '').toLowerCase())
        .some((v) => v.includes(q));
    });
  });

  const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
  const paged = $derived(filtered.slice((page - 1) * pageSize, page * pageSize));
  const addCount = $derived(parsed.filter((p) => p.isNew).length);
  const updateCount = $derived(parsed.length - addCount);

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

  function openEdit(p: Prisoner): void {
    editing = p;
    editOpen = true;
  }

  function handleFile(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      importText = text;
      parseCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
    input.value = '';
  }

  function parseCSV(text: string): void {
    const result = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
    const parsedRows = result.data;
    const cleaned: ImportRow[] = [];
    const errs: string[] = [];
    const seen = new Map(rows.map((r) => [r.prisonerId, r] as const));
    const newIds: Record<string, boolean> = {};
    parsedRows.forEach((r, i) => {
      const prisonerId = String(r['เลขผู้ต้องขัง'] ?? r['prisonerId'] ?? r['ref'] ?? '').trim();
      const prisonerName = String(r['ชื่อ-นามสกุล'] ?? r['prisonerName'] ?? r['ชื่อ'] ?? '').trim();
      if (!prisonerId || !prisonerName) {
        errs.push('แถวที่ ' + (i + 2) + ': ขาดเลขผู้ต้องขังหรือชื่อ');
        return;
      }
      const cur = seen.get(prisonerId);
      const isNew = !cur || !!newIds[prisonerId];
      if (isNew) newIds[prisonerId] = true;
      cleaned.push({
        prisonerId,
        prisonerName,
        wing: String(r['แดน'] ?? r['wing'] ?? '').trim() || cur?.wing || '',
        status: String(r['สถานะ'] ?? r['status'] ?? '').trim() || cur?.status || '',
        vinaiDate: String(r['วันกระทำความผิด/ไถ่ถอน'] ?? r['วันที่พ้นโทษ/ไถ่ถอน'] ?? r['vinaiDate'] ?? '').trim() || cur?.vinaiDate || '',
        note: String(r['หมายเหตุ'] ?? r['note'] ?? '').trim() || cur?.note || '',
        isNew,
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
      const payload = parsed.map((p) => ({
        prisonerId: p.prisonerId,
        prisonerName: p.prisonerName,
        wing: p.wing,
        status: p.status,
        vinaiDate: p.vinaiDate,
        note: p.note,
      }));
      const res = await importPrisoners(payload);
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

  function statusBadgeClass(status: string): string {
    if (!status) return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    if (status === 'ติดวินัย งดเยี่ยม') return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
    if (status === 'ปกติ') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    return 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300';
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="ผู้ต้องขัง" subtitle="ฐานข้อมูลผู้ต้องขังทั้งหมด ({rows.length} รายการ)" interactive>
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            bind:value={search}
            placeholder="ค้นหาเลขผู้ต้องขัง, ชื่อ, แดน..."
            class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        {#if wings.length > 0}
          <select
            bind:value={wingFilter}
            class="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            aria-label="กรองตามแดน"
          >
            <option value="">ทุกแดน</option>
            {#each wings as w (w)}
              <option value={w}>{w}</option>
            {/each}
          </select>
        {/if}
        {#if isManager}
          <button class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={doSyncWings} disabled={syncing}>
            {syncing ? 'กำลังซิงค์...' : 'ซิงค์แดน'}
          </button>
          <button class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2" onclick={openImport}>
            <span class="flex items-center gap-1.5"><Upload class="h-4 w-4" /> นำเข้า CSV</span>
          </button>
          <button class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => exportPrisonersCSV(rows)}>
            <span class="flex items-center gap-1.5"><Download class="h-4 w-4" /> ส่งออก CSV</span>
          </button>
          <button class="rounded-xl border border-slate-300 p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800" onclick={downloadPrisonerTemplate} aria-label="ดาวน์โหลดแบบฟอร์ม">
            <FileDown class="h-4 w-4" />
          </button>
        {/if}
        <button class="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={fetchData} aria-label="โหลดใหม่">
          <RefreshCw class="h-4 w-4" />
        </button>
      </div>

      {#if loading && rows.length === 0}
        <div class="flex items-center justify-center py-16"><Spinner /></div>
      {:else if error}
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th class="px-3 py-2 font-medium">เลขผู้ต้องขัง</th>
                <th class="px-3 py-2 font-medium">ชื่อ-นามสกุล</th>
                <th class="px-3 py-2 font-medium">แดน</th>
                <th class="px-3 py-2 font-medium">สถานะ</th>
                <th class="px-3 py-2 font-medium">วันกระทำความผิด</th>
                <th class="px-3 py-2 font-medium">หมายเหตุ</th>
                {#if isManager}
                  <th class="px-3 py-2 font-medium"></th>
                {/if}
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
                  <td class="px-3 py-2.5">
                    {#if p.status}
                      <span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium {statusBadgeClass(p.status)}">{p.status}</span>
                    {:else}
                      <span class="text-xs text-slate-400">-</span>
                    {/if}
                  </td>
                  <td class="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{p.vinaiDate || '-'}</td>
                  <td class="max-w-[220px] truncate px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{p.note || ''}</td>
                  {#if isManager}
                    <td class="px-3 py-2.5 text-right">
                      <button class="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800" onclick={() => openEdit(p)} aria-label="แก้ไข">
                        <Pencil class="h-4 w-4" />
                      </button>
                    </td>
                  {/if}
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
              class="rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <p>
        คอลัมน์ที่รองรับ: <span class="font-mono">เลขผู้ต้องขัง</span>, <span class="font-mono">ชื่อ-นามสกุล</span> (จำเป็น) และ
        <span class="font-mono">แดน</span>, <span class="font-mono">สถานะ</span>, <span class="font-mono">วันกระทำความผิด/ไถ่ถอน</span>, <span class="font-mono">หมายเหตุ</span>
        (หรือชื่อคอลัมน์ภาษาอังกฤษ <span class="font-mono">prisonerId</span>, <span class="font-mono">prisonerName</span>, <span class="font-mono">wing</span>, <span class="font-mono">status</span>, <span class="font-mono">vinaiDate</span>, <span class="font-mono">note</span>)
      </p>
      <p class="mt-2 text-emerald-600 dark:text-emerald-400">
        เซลล์ที่เว้นว่างสำหรับผู้ต้องขังที่มีอยู่แล้วจะคงค่าเดิมไว้ (ไม่ลบทับ) — ผู้ต้องขังใหม่จะได้ค่าว่าง
      </p>
    </div>

    <div>
      <label
        for="csv-file"
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors {dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'}"
        ondragover={(e) => {
          e.preventDefault();
          dragging = true;
        }}
        ondragleave={() => (dragging = false)}
        ondrop={(e) => {
          e.preventDefault();
          dragging = false;
          const file = e.dataTransfer?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              const text = String(reader.result ?? '');
              importText = text;
              parseCSV(text);
            };
            reader.readAsText(file, 'UTF-8');
          }
        }}
      >
        <Upload class="h-6 w-6 text-slate-400" />
        <span class="text-sm font-medium text-slate-600 dark:text-slate-300">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ CSV มาวางที่นี่</span>
        <span class="text-xs text-slate-400">รองรับไฟล์ .csv แบบ UTF-8 (ส่งออกจากระบบนี้แล้วแก้ไขได้ทันที)</span>
        <input id="csv-file" type="file" accept=".csv,text/csv" class="hidden" onchange={handleFile} />
      </label>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="csv-paste" class="text-sm font-medium text-slate-700 dark:text-slate-300">หรือวางข้อมูล CSV</label>
      <textarea
        id="csv-paste"
        bind:value={importText}
        rows="6"
        oninput={(e) => parseCSV((e.currentTarget as HTMLTextAreaElement).value)}
        placeholder="เลขผู้ต้องขัง,ชื่อ-นามสกุล,แดน,สถานะ,วันกระทำความผิด/ไถ่ถอน,หมายเหตุ&#10;12345,นายสมชาย ใจดี,แดน 1,,,"
        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      ></textarea>
    </div>

    {#if parsed.length > 0}
      <div class="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
        พร้อมนำเข้า {parsed.length} รายการ — เพิ่มใหม่ {addCount} รายการ, อัปเดต {updateCount} รายการ
      </div>
      <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full min-w-[600px] text-left text-xs">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-800/50">
              <th class="min-w-[120px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">เลขผู้ต้องขัง</th>
              <th class="min-w-[140px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">ชื่อ-นามสกุล</th>
              <th class="min-w-[80px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">แดน</th>
              <th class="min-w-[110px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">สถานะ</th>
              <th class="min-w-[90px] px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">ประเภท</th>
            </tr>
          </thead>
          <tbody>
            {#each parsed.slice(0, 5) as p (p.prisonerId + p.prisonerName)}
              <tr class="border-b border-slate-200 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                <td class="px-3 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-200">{p.prisonerId}</td>
                <td class="px-3 py-2.5 text-slate-700 dark:text-slate-200">{p.prisonerName}</td>
                <td class="px-3 py-2.5 text-slate-600 dark:text-slate-300">{p.wing}</td>
                <td class="px-3 py-2.5 text-slate-600 dark:text-slate-300">{p.status}</td>
                <td class="px-3 py-2.5">
                  {#if p.isNew}
                    <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">เพิ่มใหม่</span>
                  {:else}
                    <span class="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">อัปเดต</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if importErrors.length > 0}
      <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        {#each importErrors as e (e)}
          <p>{e}</p>
        {/each}
      </div>
    {/if}

    <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => (importOpen = false)}>ปิด</button>
      <button class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-indigo-700 disabled:opacity-50" onclick={submitImport} disabled={importing || parsed.length === 0}>
        {importing ? 'กำลังนำเข้า...' : `นำเข้า ${parsed.length} รายการ`}
      </button>
    </div>
  </div>
</Modal>

<PrisonerEditModal open={editOpen} prisoner={editing} {wings} onclose={() => (editOpen = false)} onsaved={fetchData} />
