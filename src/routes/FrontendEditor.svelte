<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, Save, RotateCcw, RefreshCw } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import PromoCard from '../lib/components/settings/PromoCard.svelte';
  import { getSettings, saveFrontendContent, type FrontendContent } from '../lib/api/endpoints';
  import { contentCategories, contentLanguages, contentChanges, contentError, frontendTextCatalog, type ContentLanguage } from '../lib/utils/frontendContent';
  import { ui } from '../lib/store/ui.svelte';

  let tab = $state<'text' | 'promotions'>('text');
  let lang = $state<ContentLanguage>('th');
  let category = $state('home');
  let search = $state('');
  let customOnly = $state(false);
  let original = $state<FrontendContent>({});
  let draft = $state<FrontendContent>({});
  let loading = $state(true);
  let ready = $state(false);
  let saving = $state(false);
  let error = $state('');
  let savedAt = $state('');
  let page = $state(1);
  const pageSize = 25;
  const labels = { th: 'ไทย', en: 'English', zh: '中文', vi: 'Tiếng Việt' };
  const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20';
  const changes = $derived(contentChanges(original, draft));
  const changedCount = $derived(Object.values(changes).reduce((n, fields) => n + Object.keys(fields ?? {}).length, 0));
  const invalid = $derived(Object.entries(changes).some(([language, fields]) => Object.entries(fields ?? {}).some(([key, value]) => value !== null && !!contentError(key, language as ContentLanguage, value))));
  const filtered = $derived(frontendTextCatalog.filter(entry => {
    const query = search.trim().toLocaleLowerCase();
    return (!query ? entry.category === category : [entry.key, entry.defaults.th, entry.defaults[lang], draft[lang]?.[entry.key] ?? ''].some(text => text.toLocaleLowerCase().includes(query))) &&
      (!customOnly || draft[lang]?.[entry.key] !== undefined);
  }));
  const pageCount = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
  const visible = $derived(filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize));
  $effect(() => { void lang; void category; void search; void customOnly; page = 1; });
  onMount(load);

  async function load(): Promise<void> {
    loading = true;
    error = '';
    try {
      const result = await getSettings();
      if (result.status !== 'ok') throw new Error(String(result.message ?? 'โหลดข้อความไม่สำเร็จ'));
      original = (result.settings?.frontendContent ?? {}) as FrontendContent;
      draft = structuredClone($state.snapshot(original));
      savedAt = String(result.settings?._savedAt ?? '');
      ready = true;
    } catch (e) { ready = false; error = e instanceof Error ? e.message : 'โหลดข้อความไม่สำเร็จ'; }
    finally { loading = false; }
  }

  function edit(key: string, value: string | null): void {
    const fields = { ...draft[lang] };
    const defaults = frontendTextCatalog.find(entry => entry.key === key)?.defaults[lang];
    if (value === null || value === defaults) delete fields[key];
    else fields[key] = value;
    draft = { ...draft, [lang]: fields };
  }

  async function save(): Promise<void> {
    if (!ready || !changedCount || invalid || saving) return;
    saving = true;
    error = '';
    try {
      const result = await saveFrontendContent($state.snapshot(changes));
      if (result.status !== 'ok' || !result.frontendContent) throw new Error(String(result.message ?? 'บันทึกไม่สำเร็จ'));
      original = result.frontendContent;
      draft = structuredClone($state.snapshot(original));
      savedAt = new Date().toISOString();
      ui.showToast('บันทึกข้อความเว็บไซต์แล้ว', 'success');
    } catch (e) { error = e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'; }
    finally { saving = false; }
  }
</script>

<svelte:window onbeforeunload={(event) => { if (changedCount) { event.preventDefault(); event.returnValue = ''; } }} />

<div class="flex flex-col gap-4">
  <div class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
    <h2 class="text-lg font-semibold">Frontend Editor · แก้ไขเว็บไซต์</h2>
    <p class="mt-1 text-sm text-slate-500">จัดการข้อความทุกหน้าและข่าวประชาสัมพันธ์ของเว็บไซต์จอง แก้ไขแต่ละภาษาได้โดยตรง</p>
    <div class="mt-4 flex flex-wrap gap-2" aria-label="หมวดการแก้ไขเว็บไซต์">
      <button class="rounded-xl px-4 py-2 text-sm {tab === 'text' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}" onclick={() => tab = 'text'} aria-pressed={tab === 'text'}>ข้อความเว็บไซต์ ({frontendTextCatalog.length})</button>
      <button class="rounded-xl px-4 py-2 text-sm {tab === 'promotions' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}" onclick={() => tab = 'promotions'} aria-pressed={tab === 'promotions'}>โปรโมชั่น รูปภาพ และประกาศ</button>
    </div>
  </div>

  <!-- Keep drafts mounted when switching between text and promotions. -->
  <div hidden={tab !== 'text'} class="flex flex-col gap-4">
    <Card title="ข้อความเว็บไซต์" subtitle="ข้อความที่เว้นค่าเริ่มต้นไว้จะใช้ต้นฉบับของภาษานั้น หน้าเว็บไซต์อัปเดตภายในประมาณ 15 วินาทีหลังบันทึก">
      {#if loading}<div class="flex justify-center py-10"><Spinner /></div>
      {:else}
        {#if error}<p class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert">{error}</p>{/if}
        {#if !ready}<button class="inline-flex items-center gap-2 text-sm text-blue-700" onclick={load}><RefreshCw class="h-4 w-4" /> ลองโหลดใหม่</button>
        {:else}
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap gap-1" aria-label="ภาษาที่แก้ไข">
              {#each contentLanguages as language (language)}<button disabled={saving} aria-pressed={lang === language} class="rounded-lg px-3 py-2 text-sm {lang === language ? 'bg-blue-100 font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'text-slate-500'}" onclick={() => lang = language}>{labels[language]}</button>{/each}
            </div>
            <button onclick={save} disabled={saving || !changedCount || invalid} class="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save class="h-4 w-4" />{saving ? 'กำลังบันทึก...' : `บันทึก ${changedCount} ข้อความ`}</button>
          </div>
          <div class="mt-4 grid gap-3 md:grid-cols-[1fr_2fr]">
            <label class="text-xs text-slate-500">หมวดข้อความ<select class="{fieldClass} mt-1" bind:value={category} disabled={saving}>{#each contentCategories as group (group.key)}<option value={group.key}>{group.label}</option>{/each}</select></label>
            <label class="text-xs text-slate-500"><span class="flex items-center gap-1"><Search class="h-3 w-3" /> ค้นหาทุกหมวด</span><input class="{fieldClass} mt-1" type="search" bind:value={search} placeholder="ค้นหาจากข้อความภาษาไทย คำแปล หรือชื่อข้อความ" /></label>
          </div>
          <label class="mt-3 flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" bind:checked={customOnly} /> แสดงเฉพาะข้อความที่กำหนดเอง</label>
          <p class="mt-3 text-xs text-slate-500">ตัวแปร เช่น {'{n}'} และ {'{date}'} ใช้แสดงข้อมูลจริง กรุณาคงไว้ · เครื่องหมาย | แบ่งบรรทัดของหัวเรื่อง · ข้อความแสดงเป็นข้อความธรรมดา</p>
          {#if savedAt}<p class="mt-2 text-xs text-slate-400">บันทึกล่าสุด {new Date(savedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>{/if}
        {/if}
      {/if}
    </Card>
    {#if ready && !loading}
      <div class="flex items-center justify-between text-sm text-slate-500"><p>พบ {filtered.length} ข้อความ</p><span>หน้า {Math.min(page, pageCount)} / {pageCount}</span></div>
      {#each visible as entry (entry.key)}
        {@const value = draft[lang]?.[entry.key] ?? entry.defaults[lang]}
        {@const fieldError = contentError(entry.key, lang, value)}
        {@const changed = changes[lang]?.[entry.key] !== undefined}
        <div class="rounded-2xl border bg-white p-4 dark:bg-slate-900 {changed ? 'border-blue-300 dark:border-blue-700' : 'border-slate-200 dark:border-slate-700'}">
          <div class="mb-2 flex items-start justify-between gap-3">
            <label for="content-{entry.key}" class="min-w-0 text-sm font-medium"><span class="block whitespace-pre-line">{entry.defaults.th.slice(0, 160)}{entry.defaults.th.length > 160 ? '…' : ''}</span><span class="mt-1 block break-all font-mono text-xs font-normal text-slate-400">{entry.key} · {contentCategories.find(group => group.key === entry.category)?.label}</span></label>
            <button type="button" disabled={saving || draft[lang]?.[entry.key] === undefined} class="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800" title="คืนค่าเริ่มต้นของข้อความนี้" aria-label="คืนค่าเริ่มต้น {entry.key}" onclick={() => edit(entry.key, null)}><RotateCcw class="h-4 w-4" /></button>
          </div>
          <textarea id="content-{entry.key}" class={fieldClass} rows={value.length > 180 || value.includes('\n') ? 5 : 2} value={value} maxlength={10000} disabled={saving} aria-invalid={!!fieldError} aria-describedby={fieldError ? `error-${entry.key}` : undefined} oninput={(event) => edit(entry.key, event.currentTarget.value)}></textarea>
          {#if fieldError}<p id="error-{entry.key}" class="mt-1 text-xs text-red-600" role="alert">{fieldError}</p>{/if}
          {#if draft[lang]?.[entry.key] !== undefined}<p class="mt-1 text-xs text-blue-600">{changed ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'ใช้ข้อความที่กำหนดเอง'}</p>{:else if changed}<p class="mt-1 text-xs text-blue-600">จะคืนค่าเริ่มต้นเมื่อบันทึก</p>{/if}
        </div>
      {:else}<p class="py-8 text-center text-sm text-slate-500">ไม่พบข้อความที่ตรงกับตัวกรอง</p>{/each}
      <div class="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div class="flex gap-2"><button class="rounded-xl border px-4 py-2 text-sm disabled:opacity-30" disabled={page <= 1} onclick={() => page = Math.max(1, page - 1)}>ก่อนหน้า</button><button class="rounded-xl border px-4 py-2 text-sm disabled:opacity-30" disabled={page >= pageCount} onclick={() => page = Math.min(pageCount, page + 1)}>ถัดไป</button></div>
        <button onclick={save} disabled={saving || !changedCount || invalid} class="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'กำลังบันทึก...' : `บันทึก ${changedCount} ข้อความ`}</button>
      </div>
    {/if}
  </div>
  {#if tab === 'promotions'}<PromoCard />{/if}
</div>
