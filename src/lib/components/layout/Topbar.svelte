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

<header class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
  <div class="flex items-center gap-3">
    <button
      class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
      onclick={ui.toggleSidebar}
      aria-label="เปิดเมนู"
    >
      <Menu class="h-5 w-5" />
    </button>
    <h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{route?.title ?? ''}</h1>
  </div>

  <div class="flex items-center gap-2">
    <span
      class="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex {online
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
      class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      onclick={ui.toggleDarkMode}
      aria-label="สลับโหมดมืด"
    >
      {#if ui.darkMode}
        <Sun class="h-5 w-5" />
      {:else}
        <Moon class="h-5 w-5" />
      {/if}
    </button>

    <button
      class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      onclick={handleLogout}
      aria-label="ออกจากระบบ"
    >
      <LogOut class="h-5 w-5" />
    </button>
  </div>
</header>
