<script lang="ts">
  import { menuFor } from '../../utils/navigation';
  import { MoreHorizontal, X } from '@lucide/svelte';
  import { auth } from '../../store/auth.svelte';
  import { currentPath, navigate } from '../../router';
  import NavigationMenu from './NavigationMenu.svelte';

  const items = $derived(menuFor(auth.user?.role));
  const activePath = $derived(currentPath());
  let moreOpen = $state(false);
  const primary = $derived(items.filter(item => ['home', 'reservations', 'reservations_tables'].includes(item.key)));
  const hasMore = $derived(items.some(item => !primary.includes(item)));

  function go(path: string): void {
    moreOpen = false;
    navigate(path);
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') moreOpen = false; }} />

<div class="workspace-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden dark:border-slate-700 dark:bg-slate-900" style="padding-bottom: env(safe-area-inset-bottom)">
  <nav class="mx-auto flex h-16 max-w-lg items-stretch" aria-label="เมนูหลักบนมือถือ">
    {#each primary as item (item.path)}
      {@const Icon = item.icon}
      {@const isActive = activePath === item.path}
      <a href="#{item.path}" class="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 {isActive ? 'text-blue-800 dark:text-blue-200' : 'text-slate-500 dark:text-slate-400'}" aria-label={item.label} aria-current={isActive ? 'page' : undefined}>
        <Icon class="h-5 w-5" />
        <span class="max-w-full truncate text-[10px]">{item.label}</span>
        {#if isActive}<span class="mobile-active-indicator absolute top-0 h-0.5 w-8"></span>{/if}
      </a>
    {/each}
    {#if hasMore}
      <button class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-slate-500 dark:text-slate-400" onclick={() => moreOpen = true} aria-label="เมนูทั้งหมด" aria-expanded={moreOpen} aria-controls="mobile-menu-panel">
        <MoreHorizontal class="h-5 w-5" /><span class="text-[10px]">เมนูทั้งหมด</span>
      </button>
    {/if}
  </nav>
</div>

{#if moreOpen}
  <button class="fixed inset-0 z-50 bg-slate-900/50 lg:hidden" onclick={() => moreOpen = false} aria-label="ปิดเมนูทั้งหมด"></button>
  <section id="mobile-menu-panel" class="mobile-menu-panel fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-slate-200 bg-white lg:hidden dark:border-slate-700 dark:bg-slate-900" style="padding-bottom: env(safe-area-inset-bottom)" aria-label="เมนูทั้งหมด">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
      <h2 class="text-base font-medium text-slate-900 dark:text-slate-100">เมนูการใช้งาน</h2>
      <button class="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={() => moreOpen = false} aria-label="ปิดเมนู"><X class="h-5 w-5" /></button>
    </div>
    <div class="max-h-[60vh] overflow-y-auto px-4 py-4"><NavigationMenu idPrefix="mobile" onNavigate={go} /></div>
  </section>
{/if}
