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

  function handleOkClick(e: MouseEvent) {
    e.stopPropagation();
    ui.closeAlert();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if ui.alert}
  {@const a = ui.alert}
  {@const Icon = icons[a.type]}
  <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <div
      class="absolute inset-0 z-0 animate-fade-in bg-slate-900/60 backdrop-blur-sm"
      onclick={() => ui.closeAlert()}
      aria-hidden="true"
    ></div>
    <div
      bind:this={dialogEl}
      role="alertdialog"
      aria-modal="true"
      aria-label={a.title}
      tabindex="-1"
      class="animate-modal-pop relative z-[71] flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900"
    >
      <div class="pointer-events-none absolute inset-x-0 top-0 z-0 h-1 {accentBar[a.type]}" aria-hidden="true"></div>
      <div class="relative flex flex-col gap-5 p-7">
        <div class="flex items-start gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl {iconBg[a.type]}">
            <Icon class="h-6 w-6" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{a.title}</h2>
            {#if a.message}
              <p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{a.message}</p>
            {/if}
          </div>
        </div>
        <div class="flex justify-end border-t border-slate-200 pt-5 dark:border-slate-700">
          <button
            class="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-in-out hover:bg-indigo-700 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
            onclick={handleOkClick}
          >
            {a.okText ?? 'ตกลง'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
