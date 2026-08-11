<script lang="ts">
  let { status }: { status: string | undefined } = $props();

  const labels = ['ตรวจสอบผู้เข้าร่วม', 'ตรวจสอบวินัย', 'ยืนยันการเงิน'];

  function stepState(step: number): 'done' | 'active' | 'pending' | 'rejected' | 'skipped' {
    const s = String(status ?? '').trim();
    if (s === 'ไม่อนุมัติ') return step === 1 ? 'rejected' : 'skipped';
    if (s === 'ยกเลิก') return 'skipped';
    if (step === 1) return s === 'รอตรวจสอบผู้เข้าร่วม' ? 'active' : 'done';
    if (step === 2) {
      if (s === 'รอตรวจสอบวินัย') return 'active';
      return ['รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น'].includes(s) ? 'done' : 'pending';
    }
    if (step === 3) {
      if (s === 'รอชำระเงิน') return 'active';
      return ['ชำระแล้ว', 'เสร็จสิ้น'].includes(s) ? 'done' : 'pending';
    }
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
  {#each [1, 2, 3] as step, i (step)}
    {#if i > 0}
      <span class="h-px w-2 bg-slate-300 dark:bg-slate-600"></span>
    {/if}
    <span
      class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors {dotClasses[stepState(step)]}"
      title={labels[step - 1]}
    >
      {stepContent(stepState(step), step)}
    </span>
  {/each}
</div>
