<script lang="ts">
  import { UserRound } from '@lucide/svelte';
  import { auth } from '../../store/auth.svelte';
  import { roleLabel } from '../../utils/permissions';
  import { menuFor } from '../../utils/navigation';
  import NavigationMenu from './NavigationMenu.svelte';
  const items = $derived(menuFor(auth.user?.role));
</script>

<aside class="workspace-sidebar sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col lg:flex">
  <a href="#{items[0]?.path ?? '/login'}" class="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-7">
    <img src="/login-mark.webp" alt="ตราทัณฑสถานบำบัดพิเศษกลาง" class="h-12 w-12 shrink-0 object-contain" />
    <div><p class="text-sm font-medium leading-relaxed text-white">ทัณฑสถานบำบัด<br />พิเศษกลาง</p><p class="mt-1 text-[11px] text-slate-300">กรมราชทัณฑ์</p></div>
  </a>
  <div class="min-h-0 flex-1 overflow-y-auto px-3 py-5">
    <p class="mb-3 px-3 text-[10px] leading-relaxed text-slate-400">ระบบบริหารการจองและการเข้าเยี่ยม</p>
    <NavigationMenu idPrefix="desktop" />
  </div>
  <div class="flex items-center gap-3 border-t border-white/10 px-5 py-4">
    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/5 text-[#c6a66b]"><UserRound class="h-4 w-4" /></span>
    <div class="min-w-0"><p class="truncate text-xs text-white">{auth.displayName}</p><p class="mt-1 text-[10px] text-slate-400">{roleLabel(auth.user?.role ?? '')}</p></div>
  </div>
</aside>
