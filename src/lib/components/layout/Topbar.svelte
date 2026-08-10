<script lang="ts">
  import { Menu, Moon, Sun, LogOut, Wifi, WifiOff } from '@lucide/svelte';
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

<header class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 dark:border-slate-700/60 dark:bg-slate-900 lg:px-6">
  <div class="flex items-center gap-3">
    <button
      class="rounded-xl p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
      onclick={() => ui.toggleSidebar()}
      aria-label="เปิดเมนู"
    >
      <Menu class="h-5 w-5" />
    </button>
    <div class="flex items-center gap-2.5">
      <h1 class="text-base font-semibold text-slate-900 dark:text-slate-100">{route?.title ?? ''}</h1>
    </div>
  </div>

  <div class="flex items-center gap-1.5">
    <span
      class="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:inline-flex {online
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
