<script lang="ts">
  import { Moon, Sun, LogOut, Wifi, WifiOff } from '@lucide/svelte';
  import { ui } from '../../store/ui.svelte';
  import { auth } from '../../store/auth.svelte';
  import { currentPath, routes, navigate } from '../../router';

  let route = $derived(routes.find((r) => r.path === currentPath()));
  let online = $state(navigator.onLine);

  $effect(() => {
    const on = () => (online = true);
    const off = () => (online = false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  });

  function handleLogout(): void {
    auth.logout();
    navigate('/login');
  }
</script>

<header class="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-slate-700/60 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/85 lg:h-16 lg:px-6">
  <div class="flex min-w-0 items-center gap-3">
    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white lg:hidden">
      CCC
    </span>
    <h1 class="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{route?.title ?? ''}</h1>
  </div>

  <div class="flex shrink-0 items-center gap-1.5">
    <div class="hidden items-center gap-3 sm:flex">
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium {online
          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
          : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}"
      >
        {#if online}
          <Wifi class="h-3.5 w-3.5" />
          ออนไลน์
        {:else}
          <WifiOff class="h-3.5 w-3.5" />
          ออฟไลน์
        {/if}
      </span>
      <span class="hidden h-6 w-px bg-slate-200 dark:bg-slate-700"></span>
      <span class="hidden h-8 w-8 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-600 dark:text-indigo-400 md:flex lg:hidden">
        {(auth.displayName || '?').slice(0, 1).toUpperCase()}
      </span>
    </div>

    <button
      class="rounded-xl p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      onclick={() => ui.toggleDarkMode()}
      aria-label="สลับโหมดมืด"
    >
      {#if ui.darkMode}
        <Sun class="h-5 w-5" />
      {:else}
        <Moon class="h-5 w-5" />
      {/if}
    </button>

    <button
      class="rounded-xl p-2 text-slate-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
      onclick={handleLogout}
      aria-label="ออกจากระบบ"
    >
      <LogOut class="h-5 w-5" />
    </button>
  </div>
</header>
