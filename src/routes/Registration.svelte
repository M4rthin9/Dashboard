<script lang="ts">
  import { LogOut, UserRound, ScanLine } from '@lucide/svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { canUseRegistrationDesk, roleLabel } from '../lib/utils/permissions';
  import Login from './Login.svelte';
  import Attendance from './Attendance.svelte';
  import '../lib/styles/checkin.css';

  const allowed = $derived(canUseRegistrationDesk(auth.user?.role));
</script>

<svelte:head><title>Smart Check-in · ทัณฑสถานบำบัดพิเศษกลาง</title></svelte:head>

{#if !auth.isAuthenticated}
  <Login registration />
{:else}
  <div class="registration-shell">
    <header class="registration-masthead">
      <div class="registration-masthead-inner">
        <div class="registration-identity"><img src="/login-mark.webp" alt="ตราทัณฑสถานบำบัดพิเศษกลาง" width="56" height="56" /><div><p class="registration-agency">ทัณฑสถานบำบัดพิเศษกลาง</p><p class="registration-department">กรมราชทัณฑ์ · กระทรวงยุติธรรม</p></div></div>
        <div class="registration-operator"><span class="registration-avatar"><UserRound size={19} /></span><div><p>{auth.displayName}</p><small>{roleLabel(auth.user?.role || '')}</small></div><button class="registration-logout" onclick={() => auth.logout()} aria-label="ออกจากระบบลงทะเบียน"><LogOut size={17} /><span>ออกจากระบบ</span></button></div>
      </div>
    </header>
    <main class="registration-content">
      {#if allowed}
        {#key auth.user?.username}<Attendance />{/key}
      {:else}
        <section role="alert" class="rounded-2xl border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-slate-900"><h1 class="text-lg font-semibold">ไม่มีสิทธิ์ลงทะเบียนเข้างาน</h1><p class="mt-2 text-sm text-slate-500">กรุณาออกจากระบบและใช้บัญชีเจ้าหน้าที่ฝ่ายต้อนรับที่ได้รับสิทธิ์</p></section>
      {/if}
    </main>
    <footer class="registration-footer"><span><ScanLine size={15} /> SMART CHECK-IN</span><p>ทัณฑสถานบำบัดพิเศษกลาง · ระบบลงทะเบียนเข้าร่วมกิจกรรม</p><small>บริการด้วยความใส่ใจ โปร่งใส ตรวจสอบได้</small></footer>
  </div>
{/if}
