<script lang="ts">
  import type { Component } from 'svelte';
  import type { RouteDef } from '../router';
  import Spinner from './ui/Spinner.svelte';

  let { route }: { route: RouteDef } = $props();

  let Comp = $state<Component | null>(null);
  let failed = $state(false);

  $effect(() => {
    if (!route.loader) return;
    let cancelled = false;
    Comp = null;
    failed = false;
    route
      .loader()
      .then((m) => {
        if (!cancelled) Comp = m.default;
      })
      .catch(() => {
        if (!cancelled) failed = true;
      });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if route.component}
  <route.component />
{:else if failed}
  <div class="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
    <p class="text-base font-semibold text-red-600 dark:text-red-400">ไม่สามารถโหลดหน้านี้ได้</p>
    <p class="max-w-md break-words text-xs text-red-500 dark:text-red-400">โปรดตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง</p>
    <button
      class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      onclick={() => location.reload()}
      aria-label="ลองใหม่"
    >
      ลองใหม่
    </button>
  </div>
{:else if Comp}
  <Comp />
{:else}
  <div class="flex min-h-[50vh] items-center justify-center">
    <Spinner size="lg" />
  </div>
{/if}
