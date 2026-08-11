<script lang="ts">
  import { Moon, Sun, LogOut, ChevronDown, Wifi, WifiOff } from '@lucide/svelte';
  import { ui } from '../../store/ui.svelte';
  import { auth } from '../../store/auth.svelte';
  import { currentPath, routes, navigate } from '../../router';
  import { roleLabel } from '../../utils/permissions';

  let route = $derived(routes.find((r) => r.path === currentPath()));
  let online = $state(navigator.onLine);
  let menuOpen = $state(false);

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
    menuOpen = false;
    auth.logout();
    navigate('/login');
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') menuOpen = false;
  }}
/>

<header class="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-slate-700/60 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/85 lg:h-16 lg:px-6">
  <div class="flex min-w-0 items-center gap-3">
    <img src="/cida-logo.png" alt="CCC" class="h-8 w-8 shrink-0 rounded-lg object-contain lg:hidden" />
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
      class="rounded-xl p-2 text-slate-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 lg:hidden dark:hover:bg-red-950/20"
      onclick={handleLogout}
      aria-label="ออกจากระบบ"
    >
      <LogOut class="h-5 w-5" />
    </button>

    <div class="relative hidden lg:block">
      <button
        class="flex items-center gap-2 rounded-xl p-1.5 pl-2 pr-1.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800"
        onclick={() => (menuOpen = !menuOpen)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="เมนูผู้ใช้"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800 dark:bg-blue-600/20 dark:text-blue-300">
          {(auth.displayName || '?').slice(0, 1).toUpperCase()}
        </span>
        <span class="hidden max-w-[9rem] truncate text-sm font-medium text-slate-700 xl:block dark:text-slate-200">
          {auth.displayName}
        </span>
        <ChevronDown
          class="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 {menuOpen ? 'rotate-180' : ''}"
        />
      </button>

      {#if menuOpen}
        <div class="fixed inset-0 z-10" onclick={() => (menuOpen = false)} role="presentation"></div>
        <div
          class="absolute right-0 top-full z-20 mt-2 w-64 animate-slide-down rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          role="menu"
        >
          <div class="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800 dark:bg-blue-600/20 dark:text-blue-300">
              {(auth.displayName || '?').slice(0, 1).toUpperCase()}
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{auth.displayName}</p>
              <p class="truncate text-xs text-slate-500 dark:text-slate-400">{roleLabel(auth.user?.role ?? '')}</p>
            </div>
          </div>
          <div class="my-1 h-px bg-slate-200 dark:bg-slate-700"></div>
          <button
            class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            role="menuitem"
            onclick={handleLogout}
          >
            <LogOut class="h-4 w-4" />
            ออกจากระบบ
          </button>
        </div>
      {/if}
    </div>
  </div>
</header>
