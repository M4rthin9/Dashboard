<script lang="ts">
  import {
    Building2,
    CalendarDays,
    Calculator,
    Check,
    Hash,
    Plus,
    Search,
    Trash2,
    User,
    UsersRound,
    X,
  } from '@lucide/svelte';
  import Modal from './ui/Modal.svelte';
  import { formatBaht, formatNumber } from '../utils/format';
  import type { Prisoner, Reservation } from '../api/types';

  const RELATION_OPTIONS = ['บิดา / มารดา', 'แฟน/ภรรยา', 'บุตร / ธิดา', 'พี่ / น้อง', 'ญาติ', 'เพื่อน', 'ทนายความ', 'อื่น ๆ'];
  const RELIGION_OPTIONS = ['พุทธ', 'อิสลาม', 'คริสต์', 'อื่น ๆ'];

  const PRICING = {
    MAIN_VISITOR: 1000,
    PRISONER: 1000,
    EXTRA_VISITOR: 1000,
    CHILD_FREE_AGE: 5,
    CHILD_HALF_AGE: 8,
    CHILD_HALF_PRICE: 500,
    CHILD_FREE_PRICE: 0,
  };

  const CHILD_RELATIONS = ['บุตร / ธิดา', 'Child', '子女', 'Son/Daughter'];

  function computeExtraFee(relation: string, age: string): number {
    if (CHILD_RELATIONS.includes(relation)) {
      const a = parseInt(age, 10);
      if (!isNaN(a)) {
        if (a < PRICING.CHILD_FREE_AGE) return PRICING.CHILD_FREE_PRICE;
        if (a <= PRICING.CHILD_HALF_AGE) return PRICING.CHILD_HALF_PRICE;
      }
    }
    return PRICING.EXTRA_VISITOR;
  }

  let { open, mode, row, prisoners, onclose, onsubmit, saving, width = 'max-w-3xl' }: {
    open: boolean;
    mode: 'edit' | 'create';
    row: Reservation | null;
    prisoners: Prisoner[];
    onclose: () => void;
    onsubmit: (fields: Record<string, unknown>) => Promise<void>;
    saving: boolean;
    width?: string;
  } = $props();

  interface ExtraVisitor {
    name: string;
    id: string;
    relation: string;
    age: string;
    religion: string;
    allergy: string;
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
  const labelCls = 'text-xs font-medium text-slate-600 dark:text-slate-300';

  let visitorName = $state('');
  let visitorId = $state('');
  let visitorPhone = $state('');
  let relation = $state('');
  let religion = $state('');
  let allergy = $state('');
  let prisonerQuery = $state('');
  let prisonerId = $state('');
  let prisonerName = $state('');
  let wing = $state('');
  let visitDateISO = $state('');
  let extras = $state<ExtraVisitor[]>([]);
  let adultCount = $state(1);
  let child5to8Count = $state(0);
  let childUnder5Count = $state(0);

  const extraCount = $derived(extras.filter((e) => e.name.trim()).length);
  const visitorCount = $derived(1 + extraCount);
  const totalPersons = $derived(visitorCount + 1);

  const total = $derived.by(() => {
    const extraFees = extras
      .filter((e) => e.name.trim())
      .reduce((sum, e) => sum + computeExtraFee(e.relation, e.age), 0);
    return PRICING.MAIN_VISITOR + PRICING.PRISONER + extraFees;
  });

  const extraFeeTotal = $derived(
    extras
      .filter((e) => e.name.trim())
      .reduce((sum, e) => sum + computeExtraFee(e.relation, e.age), 0)
  );

  let prisonerHighlight = $state(0);
  let prisonerMatchStatus = $state('');

  const prisonerSuggestions = $derived.by(() => {
    const q = prisonerQuery.trim().toLowerCase();
    if (!q) return [];
    const matches: Prisoner[] = [];
    for (const p of prisoners) {
      if (matches.length >= 8) break;
      const name = String(p.prisonerName ?? '').toLowerCase();
      const id = String(p.prisonerId ?? '').toLowerCase();
      if (id.includes(q) || name.includes(q)) matches.push(p);
    }
    return matches;
  });

  const prisonerActiveIndex = $derived(Math.min(prisonerHighlight, Math.max(0, prisonerSuggestions.length - 1)));

  function onPrisonerKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const list = prisonerSuggestions;
      if (list.length > 0 && list[prisonerActiveIndex]) {
        pickPrisoner(list[prisonerActiveIndex]);
      }
      return;
    }
    if (e.key === 'Escape') {
      prisonerQuery = '';
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    const list = prisonerSuggestions;
    if (list.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      prisonerHighlight = (prisonerHighlight + 1) % list.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      prisonerHighlight = (prisonerHighlight - 1 + list.length) % list.length;
    }
  }

  function parseExtras(): ExtraVisitor[] {
    const items: ExtraVisitor[] = [];
    const str = String(row?.extraVisitorNames ?? '').trim();
    if (str) {
      const isNew = str.includes(';;') || str.includes('|');
      if (isNew) {
        for (const e of str.split(';;')) {
          const p = e.split('|');
          if (p[0]?.trim()) items.push({ name: p[0].trim(), id: (p[1] ?? '').trim(), relation: (p[2] ?? '').trim(), age: (p[3] ?? '').trim(), religion: '', allergy: '' });
        }
      } else {
        for (const e of str.split(/,(?![^(]*\))/)) {
          const m = e.trim().match(/^(.+?)\s*\(/);
          if (m) items.push({ name: m[1].trim(), id: '', relation: e.trim().slice(m[0].length, -1).trim(), age: '', religion: '', allergy: '' });
        }
      }
    }
    const rels = String(row?.extraVisitorReligions ?? '').split(';;');
    const alls = String(row?.extraVisitorAllergies ?? '').split(';;');
    items.forEach((it, i) => {
      it.religion = (rels[i] ?? '').trim();
      it.allergy = (alls[i] ?? '').trim();
    });
    return items;
  }

  $effect(() => {
    if (!open) return;
    if (mode === 'edit' && row) {
      visitorName = String(row.visitorName ?? '');
      visitorId = String(row.visitorId ?? '');
      visitorPhone = String(row.visitorPhone ?? '');
      relation = String(row.relation ?? '');
      religion = String(row.religion ?? '');
      allergy = String(row.allergy ?? '');
      prisonerId = String(row.prisonerId ?? '');
      prisonerName = String(row.prisonerName ?? '');
      wing = String(row.wing ?? '');
      prisonerQuery = '';
      prisonerMatchStatus = prisonerName ? `✓ เลือกจากฐานข้อมูล: ${prisonerName} (#${prisonerId}) — ${wing}` : '';
      visitDateISO = String(row.visitDateISO ?? row.visitDate ?? '');
      extras = parseExtras();
      adultCount = Number(row.adultCount ?? 1) || 1;
      child5to8Count = Number(row.child5to8Count ?? 0) || 0;
      childUnder5Count = Number(row.childUnder5Count ?? 0) || 0;
    } else if (mode === 'create') {
      const now = new Date();
      visitDateISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      visitorName = '';
      visitorId = '';
      visitorPhone = '';
      relation = '';
      religion = '';
      allergy = '';
      prisonerQuery = '';
      prisonerId = '';
      prisonerName = '';
      wing = '';
      prisonerMatchStatus = '';
      extras = [];
      adultCount = 1;
      child5to8Count = 0;
      childUnder5Count = 0;
    }
  });

  function pickPrisoner(p: Prisoner): void {
    prisonerId = String(p.prisonerId ?? '');
    prisonerName = String(p.prisonerName ?? '');
    wing = String(p.wing ?? '');
    prisonerQuery = '';
    prisonerHighlight = 0;
    prisonerMatchStatus = `✓ เลือกจากฐานข้อมูล: ${prisonerName} (#${prisonerId}) — ${wing}`;
  }

  function clearPrisoner(): void {
    prisonerQuery = '';
    prisonerId = '';
    prisonerName = '';
    wing = '';
    prisonerMatchStatus = '';
  }

  function recomputeCounts(): void {
    let adults = 1;
    let kids5_8 = 0;
    let kidsUnder5 = 0;
    for (const e of extras.filter((x) => x.name.trim())) {
      const fee = computeExtraFee(e.relation, e.age);
      if (fee === PRICING.EXTRA_VISITOR) adults++;
      else if (fee === PRICING.CHILD_HALF_PRICE) kids5_8++;
      else kidsUnder5++;
    }
    adultCount = adults;
    child5to8Count = kids5_8;
    childUnder5Count = kidsUnder5;
  }

  function buildFields(): Record<string, unknown> {
    const named = extras.filter((e) => e.name.trim());
    const extraNamesStr = named.map((e) => `${e.name}|${e.id}|${e.relation}|${e.age}`).join(';;');
    const extraReligionsStr = named.map((e) => e.religion || '').join(';;');
    const extraAllergiesStr = named.map((e) => e.allergy || '').join(';;');
    const d = new Date(`${visitDateISO}T00:00:00`);
    const visitDate =
      !isNaN(d.getTime())
        ? d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : visitDateISO;
    return {
      visitorName,
      visitorId,
      visitorPhone,
      relation,
      religion,
      allergy,
      extraVisitorNames: extraNamesStr,
      extraVisitorReligions: extraReligionsStr,
      extraVisitorAllergies: extraAllergiesStr,
      prisonerName,
      prisonerId,
      wing,
      visitDate,
      visitDateISO,
      visitorCount,
      totalPersons,
      total,
      adultCount,
      child5to8Count,
      childUnder5Count,
    };
  }

  async function submit(): Promise<void> {
    if (!visitorName.trim()) {
      window.alert('กรุณากรอกชื่อผู้เยี่ยม');
      return;
    }
    if (!prisonerId || !prisonerName) {
      window.alert('กรุณาเลือกผู้ต้องขัง');
      return;
    }
    if (!visitDateISO) {
      window.alert('กรุณาเลือกวันเข้างาน');
      return;
    }
    await onsubmit(buildFields());
  }
</script>

<Modal
  {open}
  {width}
  title={mode === 'edit' ? `แก้ไขการจอง · ${row?.ref ?? ''}` : 'สร้างการจองใหม่'}
  onclose={onclose}
  accent={mode === 'edit' ? 'indigo' : 'emerald'}
  icon={mode === 'edit' ? CalendarDays : Plus}
  subtitle={mode === 'edit' ? 'แก้ไขข้อมูลการจองที่มีอยู่' : 'ลงทะเบียนการจองใหม่ผ่านระบบ'}
>
  <form
    class="flex flex-col gap-5"
    onsubmit={(e) => {
      e.preventDefault();
      submit();
    }}
  >
    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <User class="h-4 w-4" />
        </div>
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้เยี่ยมหลัก</h3>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1">
          <label for="rf-visitor-name" class={labelCls}>ชื่อ-นามสกุล *</label>
          <input id="rf-visitor-name" bind:value={visitorName} class={inputCls} placeholder="ชื่อ นามสกุล" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="rf-visitor-id" class={labelCls}>เลขประจำตัว *</label>
          <input id="rf-visitor-id" bind:value={visitorId} class={inputCls} placeholder="ปชช. X-XXXX-XXXXX-XX-X หรือ Passport" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="rf-visitor-phone" class={labelCls}>เบอร์โทร *</label>
          <input id="rf-visitor-phone" bind:value={visitorPhone} class={inputCls} placeholder="08X-XXX-XXXX" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="rf-relation" class={labelCls}>ความสัมพันธ์ *</label>
          <select id="rf-relation" bind:value={relation} class={inputCls}>
            <option value="">-- เลือก --</option>
            {#each RELATION_OPTIONS as o (o)}<option value={o}>{o}</option>{/each}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for="rf-religion" class={labelCls}>ศาสนา *</label>
          <select id="rf-religion" bind:value={religion} class={inputCls}>
            <option value="">-- เลือก --</option>
            {#each RELIGION_OPTIONS as o (o)}<option value={o}>{o}</option>{/each}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for="rf-allergy" class={labelCls}>แพ้อาหาร *</label>
          <input id="rf-allergy" bind:value={allergy} class={inputCls} placeholder="ระบุ หรือ '-'" />
        </div>
      </div>
    </section>

    <div class="border-t border-dashed border-slate-200 dark:border-slate-700"></div>

    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
          <Building2 class="h-4 w-4" />
        </div>
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้ต้องขัง</h3>
      </div>
      <div class="relative">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          bind:value={prisonerQuery}
          class={inputCls + ' pl-9'}
          placeholder="พิมพ์เลขผู้ต้องขัง หรือ ชื่อ-นามสกุล..."
          aria-label="ค้นหาผู้ต้องขัง"
          onkeydown={onPrisonerKeydown}
        />
        {#if prisonerSuggestions.length > 0}
          <div class="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {#each prisonerSuggestions as p, i (p.prisonerId)}
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors {i === prisonerActiveIndex
                  ? 'bg-orange-50 dark:bg-orange-950/60'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800'}"
                onmouseenter={() => (prisonerHighlight = i)}
                onmousedown={(e) => {
                  e.preventDefault();
                  pickPrisoner(p);
                }}
              >
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-[10px] font-bold text-white">
                  {String(p.prisonerName ?? '')[0] ?? '?'}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{p.prisonerName}</span>
                  <span class="block truncate text-xs text-slate-400">
                    #{p.prisonerId} · ปีก {p.wing}
                    {#if p.status && p.status !== 'active' && p.status !== 'Active'} · <span class="text-amber-500">{p.status}</span>{/if}
                  </span>
                </span>
                {#if i === prisonerActiveIndex}
                  <Check class="h-4 w-4 shrink-0 text-orange-500" />
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      {#if prisonerMatchStatus}
        <p class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{prisonerMatchStatus}</p>
      {/if}
      {#if prisonerName}
        <div class="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/50">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-sm font-bold text-white">
            {String(prisonerName)[0] ?? '?'}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              <Check class="h-3.5 w-3.5" />
              <span class="truncate">{prisonerName}</span>
            </div>
            <div class="flex flex-wrap gap-x-3 text-xs text-emerald-700/80 dark:text-emerald-300/80">
              <span class="inline-flex items-center gap-1"><Hash class="h-3 w-3" />{prisonerId}</span>
              <span class="inline-flex items-center gap-1"><Building2 class="h-3 w-3" />ปีก {wing}</span>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg p-1 text-emerald-600 transition-colors hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900"
            title="ล้างผู้ต้องขัง"
            onclick={clearPrisoner}
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      {/if}
    </section>

    <div class="border-t border-dashed border-slate-200 dark:border-slate-700"></div>

    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
            <UsersRound class="h-4 w-4" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้เยี่ยมร่วม</h3>
          {#if extraCount > 0}
            <span class="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              {extraCount}
            </span>
          {/if}
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-100 dark:bg-violet-950/60 dark:text-violet-300 dark:hover:bg-violet-900"
          onclick={() => (extras = [...extras, { name: '', id: '', relation: '', age: '', religion: '', allergy: '' }])}
        >
          <Plus class="h-3.5 w-3.5" />
          เพิ่มผู้เยี่ยม
        </button>
      </div>
      {#if extras.length === 0}
        <div class="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
          ยังไม่มีผู้เยี่ยมร่วม (เฉพาะผู้เยี่ยมหลัก) — กด "+ เพิ่มผู้เยี่ยม" เพื่อเพิ่ม
        </div>
      {/if}
      {#each extras as ex, i (i)}
        <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-[11px] font-bold text-white">
                {i + 2}
              </span>
              <span class="text-xs font-semibold text-violet-600 dark:text-violet-400">ผู้เข้าร่วมคนที่ {i + 2}</span>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs text-red-500 transition-colors hover:text-red-700"
              onclick={() => (extras = extras.filter((_, j) => j !== i))}
            >
              <Trash2 class="h-3.5 w-3.5" /> ลบ
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div class="flex flex-col gap-1">
              <label for="rf-extra-name-{i}" class={labelCls}>ชื่อ *</label>
              <input id="rf-extra-name-{i}" bind:value={ex.name} class={inputCls} />
            </div>
            <div class="flex flex-col gap-1">
              <label for="rf-extra-id-{i}" class={labelCls}>เลขประจำตัว</label>
              <input id="rf-extra-id-{i}" bind:value={ex.id} class={inputCls} />
            </div>
            <div class="flex flex-col gap-1">
              <label for="rf-extra-rel-{i}" class={labelCls}>ความสัมพันธ์</label>
              <select id="rf-extra-rel-{i}" bind:value={ex.relation} class={inputCls}>
                <option value="">-- เลือก --</option>
                {#each RELATION_OPTIONS as o (o)}<option value={o}>{o}</option>{/each}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label for="rf-extra-age-{i}" class={labelCls}>อายุ (ถ้าเป็นบุตร)</label>
              <input id="rf-extra-age-{i}" type="number" bind:value={ex.age} min="0" max="120" class={inputCls} />
            </div>
            <div class="flex flex-col gap-1">
              <label for="rf-extra-religion-{i}" class={labelCls}>ศาสนา</label>
              <select id="rf-extra-religion-{i}" bind:value={ex.religion} class={inputCls}>
                <option value="">-- เลือก --</option>
                {#each RELIGION_OPTIONS as o (o)}<option value={o}>{o}</option>{/each}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label for="rf-extra-allergy-{i}" class={labelCls}>แพ้อาหาร</label>
              <input id="rf-extra-allergy-{i}" bind:value={ex.allergy} class={inputCls} />
            </div>
          </div>
        </div>
      {/each}
    </section>

    <div class="border-t border-dashed border-slate-200 dark:border-slate-700"></div>

    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <Calculator class="h-4 w-4" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">วันที่ & ยอดรวม</h3>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onclick={recomputeCounts}
        >
          <Calculator class="h-3.5 w-3.5" />
          คำนวณยอดใหม่
        </button>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="flex flex-col gap-1">
          <label for="rf-visit-date" class={labelCls}>วันเข้างาน *</label>
          <input id="rf-visit-date" type="date" bind:value={visitDateISO} class={inputCls} />
        </div>
        <div class="flex flex-col gap-1">
          <label for="rf-adult-count" class={labelCls}>ผู้ใหญ่</label>
          <input id="rf-adult-count" type="number" bind:value={adultCount} min="1" class={inputCls} />
        </div>
        <div class="flex flex-col gap-1">
          <label for="rf-kids5-8" class={labelCls}>เด็ก 5-8 ปี</label>
          <input id="rf-kids5-8" type="number" bind:value={child5to8Count} min="0" class={inputCls} />
        </div>
        <div class="flex flex-col gap-1">
          <label for="rf-kids-under5" class={labelCls}>เด็ก {'<'}5 ปี</label>
          <input id="rf-kids-under5" type="number" bind:value={childUnder5Count} min="0" class={inputCls} />
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div class="flex flex-col gap-1 px-4 py-3 text-sm">
          <div class="flex items-center justify-between text-emerald-800/80 dark:text-emerald-300/80">
            <span>ผู้เยี่ยมหลัก + ผู้ต้องขัง</span>
            <span>{formatBaht(PRICING.MAIN_VISITOR + PRICING.PRISONER)}</span>
          </div>
          {#if extraCount > 0}
            <div class="flex items-center justify-between text-emerald-800/80 dark:text-emerald-300/80">
              <span>ผู้เยี่ยมร่วม ({extraCount} คน)</span>
              <span>{formatBaht(extraFeeTotal)}</span>
            </div>
          {/if}
          <div class="mt-1 flex items-center justify-between border-t border-emerald-200 pt-2 text-base font-bold text-emerald-800 dark:border-emerald-900 dark:text-emerald-300">
            <span>ยอดชำระรวม ({totalPersons} ท่าน)</span>
            <span>{formatBaht(total)}</span>
          </div>
          <div class="text-xs text-emerald-700/70 dark:text-emerald-300/70">
            ผู้เยี่ยม {formatNumber(visitorCount)} คน · ผู้ใหญ่ {adultCount} · เด็ก 5-8 ปี {child5to8Count} · เด็ก &lt;5 ปี {childUnder5Count}
          </div>
        </div>
      </div>
    </section>

    <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button
        type="button"
        class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        onclick={onclose}
      >
        กลับ
      </button>
      <button
        type="submit"
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        disabled={saving}
      >
        {#if saving}<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>{/if}
        {saving ? 'กำลังบันทึก...' : mode === 'edit' ? 'บันทึกการแก้ไข' : 'สร้างการจอง'}
      </button>
    </div>
  </form>
</Modal>
