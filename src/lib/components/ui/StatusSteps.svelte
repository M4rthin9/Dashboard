<script lang="ts">
  import { approvalComplete } from '../../utils/management';
  let { status, bookingType = 'prisoner', participantApproved, disciplineApproved }: { status: string | undefined; bookingType?: 'prisoner' | 'table'; participantApproved?: string; disciplineApproved?: string } = $props();

  const labels = ['ตรวจสอบผู้เข้าร่วม', 'ตรวจสอบวินัย', 'ยืนยันการเงิน', 'เสร็จสิ้น'];
  const steps = $derived(bookingType === 'table' ? [3, 4] : [1, 2, 3]);

  function stepState(step: number): 'done' | 'active' | 'pending' | 'rejected' | 'skipped' {
    const s = String(status ?? '').trim();
    if (s === 'ไม่อนุมัติ') return step === 1 ? 'rejected' : 'skipped';
    if (s === 'ยกเลิก' || s === 'คืนเงินแล้ว') return 'skipped';
    if (step === 1 || step === 2) {
      if (approvalComplete({ ref: '', status, participantApproved, disciplineApproved }, step === 1 ? 'participant' : 'discipline')) return 'done';
      return ['รอตรวจสอบผู้เข้าร่วม', 'รอตรวจสอบวินัย'].includes(s) ? 'active' : 'pending';
    }
    if (step === 3) {
      if (s === 'รอชำระเงิน') return 'active';
      return ['ชำระแล้ว', 'เสร็จสิ้น'].includes(s) ? 'done' : 'pending';
    }
    if (step === 4) return s === 'เสร็จสิ้น' ? 'done' : s === 'ชำระแล้ว' ? 'active' : 'pending';
    return 'pending';
  }

  function stepContent(state: string, step: number): string {
    if (state === 'done') return '✓';
    if (state === 'rejected') return '✗';
    if (state === 'skipped') return '—';
    if (state === 'active') return '●';
    return String(step);
  }

  const dotClasses: Record<string, string> = {
    done: 'bg-emerald-500 text-white',
    active: 'bg-blue-700 text-white ring-2 ring-blue-400/30',
    pending: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
    rejected: 'bg-red-500 text-white',
    skipped: 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600',
  };
</script>

<div class="flex items-center gap-1" title={status ?? ''}>
  {#each steps as step, i (step)}
    {#if i > 0}
      <span class="h-px w-2 bg-slate-300 dark:bg-slate-600"></span>
    {/if}
    <span
      class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors {dotClasses[stepState(step)]}"
      title={labels[step - 1]}
    >
      {stepContent(stepState(step), i + 1)}
    </span>
  {/each}
</div>
