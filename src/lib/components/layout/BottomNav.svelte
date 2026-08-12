<script lang="ts">
  import type { Component } from 'svelte';
  import {
    BarChart3,
    CalendarDays,
    ClipboardList,
    LayoutDashboard,
    Link2,
    MoreHorizontal,
    QrCode,
    Settings,
    UserRound,
    Users,
    Wallet,
    X,
  } from '@lucide/svelte';
  import { auth } from '../../store/auth.svelte';
  import { currentPath, navigate } from '../../router';
  import { visibleMenu } from '../../utils/permissions';

  interface NavItem {
    path: string;
    label: string;
    icon: Component;
  }

  const NAV_ITEMS: Record<string, NavItem> = {
    home: { path: '/dashboard', label: 'หน้าหลัก', icon: LayoutDashboard },
    reservations: { path: '/reservations', label: 'ระบบจอง', icon: CalendarDays },
    reports: { path: '/reports', label: 'รายงาน', icon: BarChart3 },
    reports_overall: { path: '/reports/overall', label: 'รายงานการเงิน', icon: Wallet },
    eventlog: { path: '/eventlog', label: 'บันทึกเหตุการณ์', icon: ClipboardList },
    users: { path: '/users', label: 'ผู้ใช้', icon: Users },
    prisoners: { path: '/prisoners', label: 'ผู้ต้องขัง', icon: UserRound },
    connection: { path: '/connection', label: 'การเชื่อมต่อ', icon: Link2 },
    promptpay: { path: '/promptpay', label: 'PromptPay QR', icon: QrCode },
    settings: { path: '/settings', label: 'ตั้งค่า', icon: Settings },
  };

  let items = $derived(
    visibleMenu(auth.user?.role).map((key) => NAV_ITEMS[key]).filter(Boolean)
  );
  let activePath = $derived(currentPath());
  let moreOpen = $state(false);

  // Show up to 5 primary tabs; anything beyond goes into the "more" sheet.
  const primary = $derived(items.length > 5 ? items.slice(0, 4) : items.slice(0, 5));
  const moreItems = $derived(items.slice(primary.length));

  function go(path: string): void {
    moreOpen = false;
    navigate(path);
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') moreOpen = false;
  }}
/>

<div
  class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden dark:border-slate-700/70 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/80"
  style="padding-bottom: env(safe-area-inset-bottom)"
>
  <nav class="mx-auto flex h-16 max-w-lg items-stretch">
    {#each primary as item (item.path)}
      {@const Icon = item.icon}
      {@const isActive = activePath === item.path}
      <a
        href="#{item.path}"
        class="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1"
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
      >
        <span
          class="flex h-8 w-14 items-center justify-center rounded-full transition-all duration-150 ease-in-out {isActive
            ? 'bg-blue-700/12 dark:bg-blue-600/20'
            : ''}"
        >
          <Icon class={isActive ? 'h-5 w-5 text-blue-700 dark:text-blue-400' : 'h-5 w-5 text-slate-400'} />
        </span>
        <span class="max-w-full truncate text-[10px] font-medium leading-none {isActive
          ? 'text-blue-700 dark:text-blue-400'
          : 'text-slate-500 dark:text-slate-400'}">
          {item.label}
        </span>
        {#if isActive}
          <span class="absolute top-0 h-0.5 w-8 rounded-full bg-blue-700 dark:bg-blue-400"></span>
        {/if}
      </a>
    {/each}

    {#if moreItems.length > 0}
      <button
        class="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1"
        onclick={() => (moreOpen = true)}
        aria-label="เมนูเพิ่มเติม"
      >
        <span class="flex h-8 w-14 items-center justify-center rounded-full">
          <MoreHorizontal class="h-5 w-5 text-slate-400" />
        </span>
        <span class="text-[10px] font-medium leading-none text-slate-500 dark:text-slate-400">เพิ่มเติม</span>
      </button>
    {/if}
  </nav>
</div>

{#if moreOpen}
  <div
    class="fixed inset-0 z-50 bg-slate-900/50 lg:hidden"
    onclick={() => (moreOpen = false)}
    role="presentation"
  ></div>
  <div
    class="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl lg:hidden dark:border-slate-700 dark:bg-slate-900"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <div class="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600"></div>
    <div class="flex items-center justify-between px-5 pb-2 pt-4">
      <p class="text-base font-semibold text-slate-900 dark:text-slate-100">เมนูทั้งหมด</p>
      <button
        class="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        onclick={() => (moreOpen = false)}
        aria-label="ปิดเมนู"
      >
        <X class="h-5 w-5" />
      </button>
    </div>
    <div class="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto px-4 pb-5 pt-1">
      {#each moreItems as item (item.path)}
        {@const Icon = item.icon}
        {@const isActive = activePath === item.path}
        <button
          class="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all duration-150 ease-in-out {isActive
            ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600'}"
          onclick={() => go(item.path)}
        >
          <Icon class="h-5 w-5" />
          <span class="text-xs font-medium leading-tight">{item.label}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}
