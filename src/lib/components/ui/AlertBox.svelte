<script lang="ts">
  import { CheckCircle2, AlertTriangle, Info, XCircle } from '@lucide/svelte';
  import { ui } from '../../store/ui.svelte';

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const accentBar: Record<string, string> = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-sky-500',
  };

  const iconBg: Record<string, string> = {
    success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    error: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    info: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
  };

  let dialogEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (ui.alert) dialogEl?.focus();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && ui.alert) ui.closeAlert();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if ui.alert}
  {@const a = ui.alert}
  {@const Icon = icons[a.type]}
  <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div class="absolute inset-0 animate-fade-in bg-slate-900/60 backdrop-blur-sm" onclick={ui.closeAlert} aria-hidden="true"></div>
    <div
      bind:this={dialogEl}
      role="alertdialog"
      aria-modal="true"
      aria-label={a.title}
      tabindex="-1"
      class="animate-modal-pop relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none dark:bg-slate-900"
    >
      <div class="pointer-events-none absolute inset-x-0 top-0 z-0 h-1 {accentBar[a.type]}" aria-hidden="true"></div>
      <div class="flex flex-col gap-4 p-6">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {iconBg[a.type]}">
            <Icon class="h-5 w-5" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">{a.title}</h2>
            {#if a.message}
              <p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{a.message}</p>
            {/if}
          </div>
        </div>
        <div class="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            onclick={ui.closeAlert}
          >
            {a.okText ?? 'ตกลง'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
