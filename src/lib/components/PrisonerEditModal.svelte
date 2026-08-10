<script lang="ts">
  import { UserRound } from '@lucide/svelte';
  import Modal from './ui/Modal.svelte';
  import Input from './ui/Input.svelte';
  import Button from './ui/Button.svelte';
  import { ui } from '../store/ui.svelte';
  import { importPrisoners } from '../api/endpoints';
  import type { Prisoner } from '../api/types';

  let { prisoner, wings, open, onclose, onsaved }: {
    prisoner: Prisoner | null;
    wings: string[];
    open: boolean;
    onclose: () => void;
    onsaved: () => Promise<void>;
  } = $props();

  let form = $state<Prisoner>({ prisonerId: '', prisonerName: '', wing: '', status: '', vinaiDate: '', note: '' });
  let saving = $state(false);

  $effect(() => {
    if (open && prisoner) {
      form = { ...prisoner };
    }
  });

  const statusOptions = [
    { value: '', label: 'ปกติ' },
    { value: 'ติดวินัย งดเยี่ยม', label: 'ติดวินัย งดเยี่ยม' },
  ];

  async function submit(): Promise<void> {
    if (!form.prisonerId.trim() || !form.prisonerName.trim()) {
      ui.showAlert({ title: 'ข้อมูลไม่ครบ', message: 'กรุณากรอกเลขผู้ต้องขังและชื่อ-นามสกุล', type: 'warning' });
      return;
    }
    saving = true;
    try {
      const res = await importPrisoners([{ ...form }]);
      if (res.status !== 'ok') {
        ui.showAlert({ title: 'บันทึกไม่สำเร็จ', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
        return;
      }
      ui.showAlert({ title: 'บันทึกสำเร็จ', message: String(res.message ?? 'อัปเดตข้อมูลผู้ต้องขังเรียบร้อย'), type: 'success' });
      if (res.errors && res.errors.length > 0) {
        ui.showAlert({ title: 'มีข้อผิดพลาดบางรายการ', message: res.errors.join('\n'), type: 'warning' });
      }
      onclose();
      await onsaved();
    } catch (err) {
      ui.showAlert({ title: 'เกิดข้อผิดพลาด', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      saving = false;
    }
  }
</script>

<Modal open={open} title="แก้ไขข้อมูลผู้ต้องขัง" subtitle={form.prisonerId} onclose={onclose} icon={UserRound} width="max-w-lg">
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input label="เลขผู้ต้องขัง" value={form.prisonerId} oninput={(e) => (form.prisonerId = e.currentTarget.value)} disabled />
      <Input label="ชื่อ-นามสกุล" value={form.prisonerName} oninput={(e) => (form.prisonerName = e.currentTarget.value)} />
    </div>

    <div>
      <label for="edit-wing" class="text-sm font-medium text-slate-700 dark:text-slate-300">แดน</label>
      <input
        id="edit-wing"
        list="edit-wing-list"
        value={form.wing}
        oninput={(e) => (form.wing = e.currentTarget.value)}
        placeholder="เช่น แดน 1, แดน 2..."
        class="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
      <datalist id="edit-wing-list">
        {#each wings as w (w)}
          <option value={w}></option>
        {/each}
      </datalist>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label for="edit-status" class="text-sm font-medium text-slate-700 dark:text-slate-300">สถานะ</label>
        <select
          id="edit-status"
          bind:value={form.status}
          class="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          {#each statusOptions as o (o.value)}
            <option value={o.value}>{o.label}</option>
          {/each}
          {#if form.status && !statusOptions.some((o) => o.value === form.status)}
            <option value={form.status}>{form.status}</option>
          {/if}
        </select>
      </div>
      <Input label="วันที่พ้นโทษ/ไถ่ถอน" type="date" value={form.vinaiDate} oninput={(e) => (form.vinaiDate = e.currentTarget.value)} />
    </div>

    <div>
      <label for="edit-note" class="text-sm font-medium text-slate-700 dark:text-slate-300">หมายเหตุ</label>
      <textarea
        id="edit-note"
        bind:value={form.note}
        rows="2"
        placeholder="หมายเหตุเพิ่มเติม"
        class="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      ></textarea>
    </div>

    <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <Button variant="outline" onclick={onclose}>ปิด</Button>
      <Button onclick={submit} loading={saving} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
    </div>
  </div>
</Modal>
