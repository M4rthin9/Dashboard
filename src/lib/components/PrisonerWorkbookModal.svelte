<script lang="ts">
  import { onDestroy } from 'svelte';
  import Modal from './ui/Modal.svelte';
  import Pagination from './ui/Pagination.svelte';
  import { callAction } from '../api/client';
  import type { ParsedWorkbook, WorkbookKind, WorkbookRow } from '../utils/prisonerWorkbook';

  type Entry = WorkbookRow & {
    change: 'add' | 'update' | 'clear';
    before: { prisonerName: string; wing: string; vinaiDate: string } | null;
  };
  type Preview = { status: string; message?: string; rows: Entry[]; issues: ParsedWorkbook['issues']; unchanged: number };
  type ApplyResult = { status: string; message?: string; applied: number; conflicted: number };

  let { kind, onclose, onsaved }: {
    kind: WorkbookKind;
    onclose: () => void;
    onsaved: () => Promise<void>;
  } = $props();

  let fileName = $state('');
  let sheet = $state('');
  let preview = $state<Preview>();
  let ignored = $state(0);
  let page = $state(1);
  let issuesPage = $state(1);
  let reading = $state(false);
  let saving = $state(false);
  let error = $state('');
  let outcome = $state('');
  let done = $state(0);
  let total = $state(0);
  let worker: Worker | undefined;
  let closed = false;

  const pageSize = 15;
  const count = $derived(preview?.rows.length ?? 0);
  const added = $derived(preview?.rows.filter((row) => row.change === 'add').length ?? 0);
  const cleared = $derived(preview?.rows.filter((row) => row.change === 'clear').length ?? 0);
  const labels = { add: 'เพิ่มใหม่', update: 'อัปเดต', clear: 'ยกเลิกงดเยี่ยม' };

  onDestroy(() => { closed = true; worker?.terminate(); });

  async function choose(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    preview = undefined;
    fileName = file.name;
    outcome = '';
    error = '';
    page = issuesPage = 1;
    const extension = kind === 'roster' ? '.xlsm' : '.xlsx';
    if (!file.name.toLowerCase().endsWith(extension) || file.size > 20 * 1024 * 1024) {
      error = `กรุณาเลือกไฟล์ ${extension} ขนาดไม่เกิน 20 MB`;
      return;
    }
    reading = true;
    try {
      const data = await file.arrayBuffer();
      if (closed) return;
      const parsed = await new Promise<ParsedWorkbook>((resolve, reject) => {
        worker = new Worker(new URL('../utils/prisonerWorkbook.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (response: MessageEvent<{ workbook?: ParsedWorkbook; error?: string }>) => {
          if (response.data.workbook) resolve(response.data.workbook);
          else reject(new Error(response.data.error || 'ไม่สามารถอ่านไฟล์ Excel ได้'));
        };
        worker.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ Excel ได้'));
        worker.postMessage({ data, kind }, [data]);
      });
      sheet = parsed.sheet;
      ignored = parsed.ignored;
      if (!parsed.rows.length) {
        preview = { status: 'ok', rows: [], issues: parsed.issues, unchanged: 0 };
        error = 'ไม่พบรายการที่พร้อมตรวจสอบในไฟล์นี้';
        return;
      }
      const result = await callAction<Preview>('processPrisonerWorkbook', {
        kind, operation: 'preview', rows: parsed.rows,
      }, { auth: true });
      if (result.status !== 'ok') throw new Error(result.message || 'ไม่สามารถตรวจสอบข้อมูลในไฟล์ได้');
      preview = { ...result, issues: [...parsed.issues, ...result.issues].sort((a, b) => a.row - b.row) };
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'ไม่สามารถอ่านไฟล์ Excel ได้';
    } finally {
      worker?.terminate();
      worker = undefined;
      reading = false;
    }
  }

  async function save() {
    const rows = preview?.rows;
    if (!rows?.length || saving || reading) return;
    saving = true;
    error = '';
    done = 0;
    total = rows.length;
    let applied = 0;
    let conflicted = 0;
    try {
      for (let i = 0; i < rows.length && !closed; i += 500) {
        const batch = rows.slice(i, i + 500);
        const result = await callAction<ApplyResult>('processPrisonerWorkbook', {
          kind, operation: 'apply', rows: batch,
        }, { auth: true });
        if (result.status !== 'ok') throw new Error(result.message || 'ไม่สามารถบันทึกข้อมูลได้');
        applied += result.applied;
        conflicted += result.conflicted;
        done += batch.length;
      }
    } catch (cause) {
      error = `บันทึกได้ ${applied} รายการก่อนหยุด กรุณาเลือกไฟล์อีกครั้งเพื่อตรวจสอบรายการที่เหลือ ${cause instanceof Error ? cause.message : ''}`;
    } finally {
      saving = false;
      preview = undefined;
      if (!closed) {
        outcome = `บันทึกแล้ว ${applied.toLocaleString('th-TH')} รายการ`;
        if (conflicted) outcome += ` ข้าม ${conflicted} รายการที่ข้อมูลเปลี่ยนไป กรุณาเลือกไฟล์ใหม่เพื่อตรวจสอบ`;
        await onsaved();
      }
    }
  }
</script>

<Modal open title={kind === 'roster' ? 'นำเข้ารายชื่อผู้ต้องขัง (.xlsm)' : 'อัปเดตวินัยผู้ต้องขัง (.xlsx)'}
  width="max-w-3xl" onclose={() => { if (!saving) onclose(); }}>
  <div class="flex flex-col gap-4">
    <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      {#if kind === 'roster'}
        เลือกไฟล์ฐานข้อมูลต้นฉบับ ระบบอ่านชีต Database และนำเข้าเฉพาะแถวที่ระบุแดน
        ข้อมูลที่นำเข้าคือเลขบุ๊ค ชื่อ-สกุล และแดน
      {:else}
        เลือกไฟล์ ผตข.ผิดวินัย.xlsx ระบบเทียบชื่อและเลขหมายในคอลัมน์ B และ C
        แล้วแปลงวันเริ่มวินัยในคอลัมน์ G เป็น ค.ศ. รายการงดเยี่ยมที่ครบ 1 ปีจะถูกเสนอให้ยกเลิก
      {/if}
    </p>
    <label class="grid gap-2 text-sm font-semibold">
      เลือกไฟล์ Excel
      <input type="file" accept={kind === 'roster' ? '.xlsm' : '.xlsx'} onchange={choose}
        disabled={reading || saving}
        class="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-600" />
    </label>
    {#if reading}<p role="status" class="text-sm">กำลังอ่านไฟล์และเทียบข้อมูลกับระบบ…</p>{/if}
    {#if saving}<p role="status" class="text-sm">ตรวจสอบและบันทึกแล้ว {done} จาก {total} รายการ</p>{/if}
    {#if error}<p role="alert" class="text-sm text-red-700 dark:text-red-300">{error}</p>{/if}
    {#if outcome}<p role="status" class="text-sm text-blue-800 dark:text-blue-300">{outcome}</p>{/if}

    {#if preview}
      <div class="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
        <p class="font-medium break-words">{fileName} · {sheet}</p>
        <p class="mt-1">
          {#if kind === 'roster'}
            เพิ่ม {added.toLocaleString('th-TH')} · อัปเดต {(count - added).toLocaleString('th-TH')} ·
            ข้ามแถวที่ไม่ระบุแดน {ignored.toLocaleString('th-TH')}
          {:else}
            แก้วันเริ่มวินัย {count - cleared} · ยกเลิกงดเยี่ยม {cleared}
          {/if}
          · ข้อมูลตรงกัน {preview.unchanged.toLocaleString('th-TH')} · ตรวจสอบ/ข้าม {preview.issues.length.toLocaleString('th-TH')}
        </p>
      </div>
      {#if count}
        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table class="w-full min-w-[32rem] text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-800">
              <tr><th class="p-2">แถว</th><th class="p-2">เลขหมายและชื่อ</th><th class="p-2">ข้อมูลเดิม</th>
                <th class="p-2">ข้อมูลจากไฟล์</th><th class="p-2">ผล</th></tr>
            </thead>
            <tbody>
              {#each preview.rows.slice((page - 1) * pageSize, page * pageSize) as row (row.prisonerId)}
                <tr class="border-t border-slate-200 dark:border-slate-700">
                  <td class="p-2 tabular-nums">{row.row}</td>
                  <td class="p-2"><span class="font-mono">{row.prisonerId}</span> · {row.prisonerName}</td>
                  <td class="p-2">{kind === 'discipline' ? row.before?.vinaiDate || '—' :
                    row.before ? `${row.before.prisonerName} · ${row.before.wing || '—'}` : '—'}</td>
                  <td class="p-2 tabular-nums">{row.value}</td>
                  <td class="p-2">{labels[row.change]}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <Pagination {page} totalPages={Math.ceil(count / pageSize)} onchange={(next) => (page = next)} />
      {/if}
      {#if preview.issues.length}
        <details class="rounded-xl border border-amber-300 p-3 text-sm dark:border-amber-800">
          <summary class="cursor-pointer">ดูแถวที่ข้ามหรือควรตรวจสอบ</summary>
          <ul class="my-2 space-y-1">
            {#each preview.issues.slice((issuesPage - 1) * pageSize, issuesPage * pageSize) as issue (issue.row)}
              <li>แถว {issue.row} · {issue.reason}</li>
            {/each}
          </ul>
          <Pagination page={issuesPage} totalPages={Math.ceil(preview.issues.length / pageSize)}
            onchange={(next) => (issuesPage = next)} />
        </details>
      {/if}
    {/if}

    <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button type="button" onclick={onclose} disabled={saving}
        class="rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">ปิด</button>
      <button type="button" onclick={save} disabled={!count || reading || saving}
        class="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
        ยืนยันบันทึก {count.toLocaleString('th-TH')} รายการ
      </button>
    </div>
  </div>
</Modal>
