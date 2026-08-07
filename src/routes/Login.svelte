<script lang="ts">
  import { Eye, EyeOff, Lock, User } from '@lucide/svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { navigate } from '../lib/router';
  import { API_BASE } from '../lib/api/client';

  let username = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    error = '';
    if (!username.trim() || !password) {
      error = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน';
      return;
    }
    loading = true;
    try {
      await auth.login(username.trim(), password);
      ui.showToast(`ยินดีต้อนรับ, ${auth.displayName}`, 'success');
      if (auth.mustChangePassword) {
        navigate('/dashboard');
        ui.showToast('กรุณาเปลี่ยนรหัสผ่านครั้งแรก', 'warning');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
  <div class="w-full max-w-md">
    <div class="mb-6 text-center">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-600/30">
        CCC
      </div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">CCC Dashboard</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">เข้าสู่ระบบจัดการการจองเยี่ยม</p>
    </div>

    <form
      onsubmit={handleSubmit}
      class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
    >
      <div class="flex flex-col gap-4">
        <div class="relative">
          <User class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            bind:value={username}
            placeholder="ชื่อผู้ใช้"
            autocomplete="username"
            class="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div class="relative">
          <Lock class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            bind:value={password}
            placeholder="รหัสผ่าน"
            autocomplete="current-password"
            class="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onclick={() => (showPassword = !showPassword)}
            aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          >
            {#if showPassword}
              <EyeOff class="h-4 w-4" />
            {:else}
              <Eye class="h-4 w-4" />
            {/if}
          </button>
        </div>

        {#if error}
          <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        {/if}

        <Button type="submit" loading={loading} fullWidth size="lg">
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </Button>
      </div>
    </form>

    <p class="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
      เชื่อมต่อกับเซิร์ฟเวอร์: <span class="font-mono">{API_BASE}</span>
    </p>
  </div>
</div>
