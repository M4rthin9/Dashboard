<script lang="ts">
  import { onMount } from 'svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Modal from '../lib/components/ui/Modal.svelte';
  import Pagination from '../lib/components/ui/Pagination.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { getBookingBlacklist, updateBookingBan } from '../lib/api/endpoints';
  import type { BookingBlacklistRow } from '../lib/api/types';
  import { ui } from '../lib/store/ui.svelte';
  import { liveSync } from '../lib/store/liveSync.svelte';

  let rows = $state<BookingBlacklistRow[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let filter = $state('attention');
  let page = $state(1);
  let now = $state(Date.now());
  let clockOffset = $state(0);
  let open = $state(false);
  let editing = $state<BookingBlacklistRow | null>(null);
  let prisonerSearch = $state('');
  let warnings = $state(0);
  let expiry = $state('');
  let originalExpiry = $state('');
  let reason = $state('');
  let saving = $state(false);
  let saveError = $state('');
  let loadId = 0;

  const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
  const filtered = $derived(rows.filter((row) => {
    const banned = Date.parse(row.bannedUntil) > now;
    if (filter === 'attention' && !banned && !row.warnings && !row.bannedUntil && !row.totalWarnings) return false;
    if (filter === 'banned' && !banned) return false;
    if (filter === 'warned' && !row.warnings) return false;
    const q = search.trim().toLowerCase();
    return !q || [row.prisonerId, row.prisonerName, row.wing].some((value) => value.toLowerCase().includes(q));
  }));
  const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / 20)));
  const paged = $derived(filtered.slice((page - 1) * 20, page * 20));
  const suggestions = $derived(prisonerSearch.trim() ? rows.filter((row) =>
    [row.prisonerId, row.prisonerName].some((value) => value.toLowerCase().includes(prisonerSearch.trim().toLowerCase()))
  ).slice(0, 8) : []);
  const bannedCount = $derived(rows.filter((row) => Date.parse(row.bannedUntil) > now).length);
  const warnedCount = $derived(rows.filter((row) => row.warnings > 0).length);

  $effect(() => { if (page > totalPages) page = totalPages; });

  onMount(() => {
    void fetchData();
    const timer = setInterval(() => { now = Date.now() + clockOffset; }, 30000);
    const off = liveSync.subscribe((scopes) => {
      if (scopes.includes('reservations') || scopes.includes('prisoners')) return fetchData();
    });
    return () => { clearInterval(timer); off(); };
  });

  async function fetchData(): Promise<void> {
    const requestId = ++loadId;
    loading = true;
    error = '';
    try {
      const result = await getBookingBlacklist();
      if (requestId !== loadId) return;
      if (result.status !== 'ok') throw new Error(String(result.message ?? 'ไม่สามารถโหลดข้อมูลได้'));
      rows = result.rows ?? [];
      clockOffset = result.serverTime ? Date.parse(result.serverTime) - Date.now() : 0;
      now = Date.now() + clockOffset;
    } catch (err) {
      if (requestId === loadId) error = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
    } finally { if (requestId === loadId) loading = false; }
  }

  function localExpiry(value: string): string {
    return value ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16) : '';
  }

  function edit(row: BookingBlacklistRow | null): void {
    editing = row;
    warnings = row?.warnings ?? 0;
    expiry = row && Date.parse(row.bannedUntil) > now ? localExpiry(row.bannedUntil) : '';
    originalExpiry = expiry;
    prisonerSearch = '';
    reason = '';
    saveError = '';
    open = true;
  }

  async function save(operation: 'ban' | 'unban' | 'update'): Promise<void> {
    if (!editing || saving) return;
    saving = true;
    saveError = '';
    try {
      const bannedUntil = operation === 'update' && expiry ? (expiry === originalExpiry ? editing.bannedUntil : new Date(`${expiry}:00+07:00`).toISOString()) : '';
      const result = await updateBookingBan({ prisonerId: editing.prisonerId, operation, warnings, bannedUntil, reason });
      if (result.status !== 'ok') throw new Error(String(result.message ?? 'บันทึกไม่สำเร็จ'));
      open = false;
      ui.showAlert({ title: 'บันทึกสำเร็จ', message: String(result.message), type: 'success' });
      await fetchData();
    } catch (err) { saveError = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'; }
    finally { saving = false; }
  }

  function dateLabel(value: string): string {
    return value ? new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : '-';
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="บัญชีระงับการจอง" subtitle="ระงับอยู่ {bannedCount} ราย · มีคำเตือน {warnedCount} ราย">
    <div class="flex flex-col gap-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">คำเตือนครบ 2 ครั้งจะระงับการจอง 3 เดือนและเริ่มนับคำเตือนรอบใหม่ การชำระเงินสำเร็จจะล้างคำเตือนในรอบนั้น</p>
      <div class="flex flex-wrap items-center gap-3">
        <input type="search" class="{fieldClass} min-w-0 flex-1" aria-label="ค้นหาบัญชีระงับการจอง" placeholder="ค้นหาเลขผู้ต้องขัง ชื่อ หรือแดน" bind:value={search} oninput={() => page = 1} />
        <select class="{fieldClass} sm:w-auto" aria-label="กรองสถานะการระงับ" bind:value={filter} onchange={() => page = 1}>
          <option value="attention">มีคำเตือนหรือประวัติระงับ</option>
          <option value="banned">กำลังระงับ</option>
          <option value="warned">มีคำเตือนในรอบนี้</option>
          <option value="all">ผู้ต้องขังทั้งหมด</option>
        </select>
        <Button variant="outline" onclick={fetchData} disabled={loading}>รีเฟรช</Button>
        <Button onclick={() => edit(null)} disabled={loading || !!error}>ระงับด้วยตนเอง</Button>
      </div>
      {#if error}<p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>{/if}
      {#if loading && !rows.length}
        <div class="flex justify-center py-10"><Spinner /></div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[800px] text-left text-sm">
            <thead><tr class="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700">
              <th class="p-3">ผู้ต้องขัง</th><th class="p-3">แดน</th><th class="p-3">คำเตือนรอบนี้</th><th class="p-3">ประวัติคำเตือนอัตโนมัติ</th><th class="p-3">สิ้นสุดการระงับ (เวลาไทย)</th><th class="p-3">คงเหลือ</th><th class="p-3">จัดการ</th>
            </tr></thead>
            <tbody>
              {#each paged as row (row.prisonerId)}
                {@const active = Date.parse(row.bannedUntil) > now}
                <tr class="border-b border-slate-100 dark:border-slate-800">
                  <td class="p-3"><p class="font-medium">{row.prisonerName || 'ไม่อยู่ในรายชื่อปัจจุบัน'}</p><p class="text-xs text-slate-500">{row.prisonerId}</p></td>
                  <td class="p-3">{row.wing || '-'}</td>
                  <td class="p-3">{row.warnings} / 2 ครั้ง</td><td class="p-3">{row.totalWarnings} ครั้ง</td>
                  <td class="p-3">{dateLabel(row.bannedUntil)}</td>
                  <td class="p-3"><span class={active ? 'text-red-600 dark:text-red-400' : ''}>{active ? `${Math.ceil((Date.parse(row.bannedUntil) - now) / 86400000)} วัน` : row.bannedUntil ? 'หมดระยะระงับแล้ว' : 'ไม่ระงับ'}</span></td>
                  <td class="p-3"><Button size="sm" variant="outline" onclick={() => edit(row)}>แก้ไข / ระงับ</Button></td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if !filtered.length}<p class="py-10 text-center text-sm text-slate-500">ไม่พบรายการ เลือก “ผู้ต้องขังทั้งหมด” หรือ “ระงับด้วยตนเอง” เพื่อเพิ่มการระงับ</p>{/if}
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>{filtered.length} รายการ</span><Pagination {page} {totalPages} onchange={(value) => page = value} />
        </div>
      {/if}
    </div>
  </Card>
</div>

<Modal {open} title="จัดการคำเตือนและระงับการจอง" subtitle={editing?.prisonerId ?? 'เลือกผู้ต้องขัง'} onclose={() => { if (!saving) open = false; }} width="max-w-xl">
  <div class="flex flex-col gap-4">
    {#if !editing}
      <label for="ban-prisoner" class="text-sm font-medium">ค้นหาผู้ต้องขัง</label>
      <input id="ban-prisoner" class={fieldClass} placeholder="เลขผู้ต้องขังหรือชื่อ" bind:value={prisonerSearch} />
      {#each suggestions as row (row.prisonerId)}
        <button class="rounded-xl border border-slate-200 p-3 text-left text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" onclick={() => edit(row)}>{row.prisonerName || 'ไม่อยู่ในรายชื่อปัจจุบัน'} · {row.prisonerId} · {row.wing}</button>
      {/each}
      {#if prisonerSearch && !suggestions.length}<p class="text-sm text-slate-500">ไม่พบผู้ต้องขัง</p>{/if}
    {:else}
      <p class="font-medium">{editing.prisonerName || editing.prisonerId} · {editing.wing || '-'}</p>
      <p class="text-sm text-slate-500">สถานะปัจจุบัน: {Date.parse(editing.bannedUntil) > now ? `ระงับถึง ${dateLabel(editing.bannedUntil)}` : 'ไม่ระงับ'}</p>
      <div>
        <label for="ban-warnings" class="mb-1 block text-sm font-medium">คำเตือนในรอบนี้</label>
        <select id="ban-warnings" class={fieldClass} bind:value={warnings} disabled={saving}><option value={0}>0 ครั้ง</option><option value={1}>1 ครั้ง</option></select>
      </div>
      <div>
        <label for="ban-expiry" class="mb-1 block text-sm font-medium">สิ้นสุดการระงับ (เวลาไทย)</label>
        <input id="ban-expiry" type="datetime-local" class={fieldClass} bind:value={expiry} disabled={saving} />
        <p class="mt-1 text-xs text-slate-500">เว้นว่างเพื่อไม่ระงับ หรือเลือกวันเวลาใหม่แล้วบันทึก</p>
      </div>
      <div><label for="ban-reason" class="mb-1 block text-sm font-medium">เหตุผล / หมายเหตุสำหรับบันทึกเหตุการณ์</label><textarea id="ban-reason" rows="2" class={fieldClass} bind:value={reason} disabled={saving}></textarea></div>
      {#if saveError}<p role="alert" class="text-sm text-red-600 dark:text-red-400">{saveError}</p>{/if}
      <p class="text-xs text-slate-500">“ระงับ 3 เดือน” จะเริ่มนับจากขณะนี้และเริ่มรอบคำเตือนใหม่ การแก้ไขมีผลเฉพาะผู้ต้องขังรายนี้</p>
      <div class="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button variant="outline" onclick={() => open = false} disabled={saving}>ปิด</Button>
        {#if Date.parse(editing.bannedUntil) > now}<Button variant="outline" onclick={() => save('unban')} disabled={saving}>ยกเลิกการระงับ</Button>{/if}
        <Button variant="danger" onclick={() => save('ban')} disabled={saving}>ระงับ 3 เดือน</Button>
        <Button onclick={() => save('update')} loading={saving} disabled={saving}>บันทึกการแก้ไข</Button>
      </div>
    {/if}
  </div>
</Modal>
