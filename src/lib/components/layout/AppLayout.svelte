<script lang="ts">
  import type { Snippet } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import Topbar from './Topbar.svelte';
  import BottomNav from './BottomNav.svelte';
  import ChatWidget from '../chat/ChatWidget.svelte';
  import { ADMIN_SYSTEM_PROMPT, VISITOR_SYSTEM_PROMPT } from '../../utils/chatApi';
  import { auth } from '../../store/auth.svelte';

  let { children }: { children: Snippet } = $props();

  const isAdmin = $derived(
    auth.user?.role === 'Superadmin' || auth.user?.role === 'Admin'
  );
</script>

<div class="workspace-shell flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">
  <Sidebar />
  <div class="flex min-w-0 flex-1 flex-col">
    <Topbar />
    <main class="flex-1">
      <div class="workspace-content mx-auto w-full max-w-[1480px] px-4 py-6 pb-28 lg:px-8 lg:py-7 lg:pb-12">
        {@render children()}
        <footer class="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-500 dark:border-slate-800"><span>ทัณฑสถานบำบัดพิเศษกลาง · กรมราชทัณฑ์</span><span>ระบบบริหารการจองและการเข้าเยี่ยม</span></footer>
      </div>
    </main>
  </div>
  <BottomNav />
  {#if auth.isAuthenticated}
    <ChatWidget
      systemPrompt={isAdmin ? ADMIN_SYSTEM_PROMPT : VISITOR_SYSTEM_PROMPT}
      title={isAdmin ? 'ผู้ช่วย Admin' : 'ผู้ช่วยจองโต๊ะ'}
      subtitle={isAdmin ? 'สอบถามข้อมูลเกี่ยวกับระบบ' : 'สอบถามข้อมูลการจอง'}
    />
  {/if}
</div>
