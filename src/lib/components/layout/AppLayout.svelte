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

<div class="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">
  <Sidebar />
  <div class="flex min-w-0 flex-1 flex-col">
    <Topbar />
    <main class="flex-1">
      <div class="mx-auto w-full max-w-[1600px] px-4 py-6 pb-28 lg:px-8 lg:py-8 lg:pb-12">
        {@render children()}
      </div>
    </main>
  </div>
  <BottomNav />
  {#if auth.isAuthenticated}
    <ChatWidget
      systemPrompt={isAdmin ? ADMIN_SYSTEM_PROMPT : VISITOR_SYSTEM_PROMPT}
      title={isAdmin ? 'ผู้ช่วย Admin' : 'ผู้ช่วยจองโต๊ะ'}
      subtitle={isAdmin ? 'ถามได้เลย关于ระบบ' : 'สอบถามข้อมูลการจอง'}
    />
  {/if}
</div>
