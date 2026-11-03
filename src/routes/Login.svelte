<script lang="ts">
  import { AlertCircle, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, ClipboardList, Eye, EyeOff, LockKeyhole, Moon, ScanLine, ShieldCheck, Sun, UserRound, Users } from '@lucide/svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { navigate } from '../lib/router';
  import { canUseRegistrationDesk } from '../lib/utils/permissions';

  let { registration = false }: { registration?: boolean } = $props();

  let username = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;
    error = '';
    if (!username.trim() || !password) {
      error = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน';
      return;
    }
    loading = true;
    try {
      await auth.login(username.trim(), password);
      if (registration && !canUseRegistrationDesk(auth.user?.role)) {
        auth.logout();
        throw new Error('บัญชีนี้ไม่มีสิทธิ์ลงทะเบียนเข้างาน กรุณาใช้บัญชีเจ้าหน้าที่ฝ่ายต้อนรับ');
      }
      ui.showToast(`ยินดีต้อนรับ, ${auth.displayName}`, 'success');
      if (auth.mustChangePassword) {
        navigate(registration ? '/registration' : '/dashboard');
        ui.showToast('กรุณาเปลี่ยนรหัสผ่านครั้งแรก', 'warning');
      } else {
        navigate(registration ? '/registration' : '/dashboard');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>{registration ? 'เข้าสู่จุดลงทะเบียน' : 'เข้าสู่ระบบ'} · ทัณฑสถานบำบัดพิเศษกลาง</title></svelte:head>

<main class="workspace-shell login-page">
  <div class="login-frame">
    <div class="login-topbar">
      <span class="portal-label"><span aria-hidden="true"></span>ระบบงานสำหรับเจ้าหน้าที่</span>
      <button type="button" class="theme-toggle" onclick={() => ui.toggleDarkMode()} aria-label={ui.darkMode ? 'ใช้ธีมสว่าง' : 'ใช้ธีมมืด'} aria-pressed={ui.darkMode}>
        {#if ui.darkMode}<Sun size={18} />{:else}<Moon size={18} />{/if}
        <span>{ui.darkMode ? 'ใช้ธีมสว่าง' : 'ใช้ธีมมืด'}</span>
      </button>
    </div>

    <div class="login-shell">
      <section class="brand-panel" aria-label="ทัณฑสถานบำบัดพิเศษกลาง">
        <div class="brand-lockup">
          <img src="/login-mark.webp" alt="ตราทัณฑสถานบำบัดพิเศษกลาง" width="64" height="64" class="brand-mark" fetchpriority="high" />
          <div><p class="brand-name">ทัณฑสถานบำบัดพิเศษกลาง</p><p class="brand-caption">กรมราชทัณฑ์ · กระทรวงยุติธรรม</p></div>
        </div>

        <div class="brand-story">
          <span class="story-line" aria-hidden="true"></span>
          <p class="story-eyebrow">{registration ? 'จุดบริการลงทะเบียน' : 'ระบบบริหารงานเจ้าหน้าที่'}</p>
          <h2>{#if registration}ตรวจสอบการจอง<br /><span>และลงทะเบียนเข้างาน</span>{:else}บริหารการจอง<br /><span>และการเข้าเยี่ยม</span>{/if}</h2>
          <p class="story-description">{registration ? 'ตรวจสอบข้อมูลผู้เข้าร่วมและบันทึกการเข้างาน ตามสิทธิ์ของเจ้าหน้าที่ประจำจุดลงทะเบียน' : 'ติดตามการจอง ตรวจสอบผู้เข้าร่วม และจัดทำรายงาน ในระบบเดียวกันตามสิทธิ์การใช้งาน'}</p>
        </div>

        <div class="service-list">
          <div class="service-item"><span class="service-icon">{#if registration}<ScanLine size={20} />{:else}<CalendarDays size={20} />{/if}</span><div><h3>{registration ? 'ตรวจสอบการจอง' : 'การจองและการเข้าเยี่ยม'}</h3><p>{registration ? 'อ่านรหัส QR และค้นหาข้อมูลผู้เข้าร่วม' : 'ติดตามการจองเยี่ยมและการจองโต๊ะ'}</p></div></div>
          <div class="service-item"><span class="service-icon">{#if registration}<UserRound size={20} />{:else}<Users size={20} />{/if}</span><div><h3>{registration ? 'ตรวจสอบรายชื่อ' : 'ข้อมูลผู้เข้าร่วม'}</h3><p>{registration ? 'ตรวจสอบผู้เข้าร่วมตามข้อมูลการจอง' : 'ติดตามรายชื่อและสถานะการดำเนินงาน'}</p></div></div>
          <div class="service-item"><span class="service-icon">{#if registration}<ClipboardList size={20} />{:else}<BarChart3 size={20} />{/if}</span><div><h3>{registration ? 'ลงทะเบียนเข้างาน' : 'สถิติและรายงาน'}</h3><p>{registration ? 'บันทึกการเข้าร่วมตามสิทธิ์ของเจ้าหน้าที่' : 'เรียกดูข้อมูลและรายงานตามสิทธิ์การใช้งาน'}</p></div></div>
        </div>

        <p class="brand-footer"><ShieldCheck size={16} aria-hidden="true" />การเข้าถึงข้อมูลเป็นไปตามสิทธิ์ของแต่ละบัญชี</p>
      </section>

      <section class="form-panel" aria-labelledby="login-title">
        <div class="login-content">
          <span class="login-symbol" aria-hidden="true">{#if registration}<ScanLine size={24} />{:else}<LockKeyhole size={24} />{/if}</span>
          <header class="login-heading">
            <p class="login-eyebrow">{registration ? 'สำหรับเจ้าหน้าที่ลงทะเบียน' : 'สำหรับเจ้าหน้าที่ที่ได้รับสิทธิ์'}</p>
            <h1 id="login-title">{registration ? 'เข้าสู่จุดลงทะเบียน' : 'เข้าสู่ระบบ'}</h1>
            <p>{registration ? 'สแกน QR และตรวจสอบการเข้างานประจำวัน' : 'เข้าสู่ระบบบริหารการจองและการเข้าเยี่ยม'}</p>
          </header>

          <form onsubmit={handleSubmit} aria-busy={loading} class="login-form">
            <div class="login-field">
              <label for="login-username">ชื่อผู้ใช้</label>
              <div class="input-wrap">
                <UserRound class="field-icon h-[18px] w-[18px]" aria-hidden="true" />
                <input id="login-username" name="username" type="text" bind:value={username} placeholder="กรอกชื่อผู้ใช้" autocomplete="username" autocapitalize="none" spellcheck={false} required disabled={loading} aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
              </div>
            </div>
            <div class="login-field">
              <label for="login-password">รหัสผ่าน</label>
              <div class="input-wrap">
                <LockKeyhole class="field-icon h-[18px] w-[18px]" aria-hidden="true" />
                <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} bind:value={password} placeholder="กรอกรหัสผ่าน" autocomplete="current-password" required disabled={loading} aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} class="password-input" />
                <button type="button" class="password-toggle" disabled={loading} onclick={() => showPassword = !showPassword} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={showPassword} aria-controls="login-password">
                  {#if showPassword}<EyeOff size={18} aria-hidden="true" />{:else}<Eye size={18} aria-hidden="true" />{/if}
                </button>
              </div>
            </div>
            {#if error}<div id="login-error" role="alert" class="login-error"><AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{error}</p></div>{/if}
            <div class="login-submit"><Button type="submit" loading={loading} disabled={loading} fullWidth size="lg">{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}{#if !loading}<ArrowRight size={18} aria-hidden="true" />{/if}</Button></div>
          </form>

          <p class="login-help">หากยังไม่มีบัญชีหรือไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ</p>
          {#if !registration}<a class="registration-link" href="#/registration"><ScanLine size={19} aria-hidden="true" /><span>สำหรับเจ้าหน้าที่ลงทะเบียนเข้างาน</span><ArrowRight size={16} aria-hidden="true" /></a>{/if}
        </div>
        <footer class="form-footer"><span>{registration ? 'จุดลงทะเบียนเข้างาน' : 'ระบบบริหารการจองและการเข้าเยี่ยม'}</span><a href="https://cida.dpdns.org/" target="_blank" rel="noopener noreferrer">เว็บไซต์ผู้ใช้บริการ<ArrowUpRight size={14} aria-hidden="true" /></a></footer>
      </section>
    </div>
    <p class="page-caption">ทัณฑสถานบำบัดพิเศษกลาง · กรมราชทัณฑ์</p>
  </div>
</main>

<style>
  .login-page { min-height: 100svh; display: flex; align-items: center; justify-content: center; padding: 28px; background: var(--workspace-bg); color: var(--workspace-ink); }
  .login-frame { width: min(1080px, 100%); }
  .login-topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
  .portal-label { display: inline-flex; align-items: center; gap: 9px; color: var(--workspace-muted); font-size: 12px; }
  .portal-label > span { width: 7px; height: 7px; border-radius: 50%; background: var(--workspace-accent); }
  .theme-toggle { min-height: 44px; display: inline-flex; align-items: center; gap: 9px; border: 1px solid var(--workspace-border); background: var(--workspace-panel); border-radius: 7px; padding: 8px 12px; color: var(--workspace-ink); font-size: 12px; }
  .theme-toggle:hover { background: var(--workspace-raised); }
  .login-shell { display: grid; grid-template-columns: 1.05fr 1fr; overflow: hidden; border: 1px solid var(--workspace-border); border-radius: 14px; box-shadow: 0 20px 60px #0b132529; }
  .brand-panel { display: flex; flex-direction: column; padding: 32px; background: #131b29; color: #f1f5fb; }
  .brand-lockup { display: flex; align-items: center; gap: 14px; }
  .brand-mark { width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; }
  .brand-name { margin: 0; font-size: 17px; font-weight: 500; line-height: 1.6; }
  .brand-caption { margin: 4px 0 0; color: #bac9dd; font-size: 12px; }
  .brand-story { padding: 28px 0 24px; }
  .story-line { display: block; height: 3px; width: 38px; border-radius: 2px; background: #5eead4; margin-bottom: 20px; }
  .story-eyebrow { color: #bac9dd; font-size: 12px; }
  .brand-story h2 { margin: 12px 0 14px; font-size: clamp(28px, 3vw, 32px); font-weight: 500; line-height: 1.45; letter-spacing: -.5px; }
  .brand-story h2 span { color: #5eead4; }
  .story-description { color: #bac9dd; font-size: 13px; line-height: 1.9; max-width: 380px; }
  .service-list { display: flex; flex-direction: column; gap: 14px; padding: 0 0 22px; }
  .service-item { display: flex; align-items: center; gap: 12px; }
  .service-icon { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; flex-shrink: 0; border: 1px solid #355366; border-radius: 8px; color: #7de5d2; background: #1c303c; }
  .service-item h3 { margin: 0; font-weight: 400; font-size: 13px; color: #e2eaf5; }
  .service-item p { margin-top: 4px; font-size: 12px; line-height: 1.7; color: #bac9dd; }
  .brand-footer { display: flex; align-items: flex-start; gap: 8px; margin-top: auto; padding-top: 16px; border-top: 1px solid #47566c; font-size: 11px; color: #bac9dd; line-height: 1.8; }
  .brand-footer :global(svg) { flex-shrink: 0; margin-top: 2px; }
  .form-panel { display: flex; flex-direction: column; justify-content: space-between; padding: 30px 34px 22px; background: var(--workspace-panel); }
  .login-content { width: 100%; max-width: 365px; margin: auto; padding: 0 0 22px; }
  .login-symbol { display: inline-flex; align-items: center; justify-content: center; height: 44px; width: 44px; border: 1px solid var(--workspace-input-border); border-radius: 8px; color: var(--workspace-accent); background: var(--workspace-raised); }
  .login-heading { margin-top: 16px; margin-bottom: 22px; }
  .login-eyebrow { font-size: 12px; color: var(--workspace-accent); }
  .login-heading h1 { margin: 6px 0 8px; font-size: 28px; font-weight: 500; line-height: 1.4; }
  .login-heading > p:last-child { font-size: 13px; color: var(--workspace-muted); line-height: 1.75; }
  .login-form { display: flex; flex-direction: column; gap: 16px; }
  .login-field label { display: block; font-size: 14px; margin-bottom: 8px; font-weight: 400; }
  .input-wrap { position: relative; }
  .input-wrap :global(.field-icon) { position: absolute; top: 18px; left: 14px; color: var(--workspace-muted); pointer-events: none; }
  .input-wrap input { width: 100%; min-width: 0; height: 54px; padding: 13px 14px 13px 43px; border: 1px solid var(--workspace-input-border); border-radius: 7px; background: var(--workspace-bg); color: var(--workspace-ink); font: inherit; font-size: 14px; transition: border-color 150ms; }
  .input-wrap input::placeholder { color: var(--workspace-muted); opacity: 1; }
  .input-wrap input:focus { outline: 2px solid var(--workspace-accent); outline-offset: 3px; border-color: var(--workspace-accent); }
  .input-wrap input[aria-invalid='true'] { border-color: #f28b91; }
  .input-wrap input:disabled { opacity: .65; }
  .input-wrap .password-input { padding-right: 54px; }
  .password-toggle { display: flex; align-items: center; justify-content: center; position: absolute; right: 5px; top: 5px; width: 44px; height: 44px; border-radius: 5px; color: var(--workspace-muted); background: transparent; }
  .password-toggle:hover { color: var(--workspace-accent); background: var(--workspace-raised); }
  .login-error { display: flex; gap: 9px; border: 1px solid #b85a65; border-radius: 7px; padding: 12px; color: #fecaca; background: #4a252c; font-size: 13px; line-height: 1.7; }
  .login-error p { margin: 0; }
  .login-submit { margin-top: 4px; }
  .login-submit :global(button) { min-height: 54px; border-radius: 7px; background: var(--workspace-action); color: var(--workspace-action-text); font-size: 14px; font-weight: 500; box-shadow: none; }
  .login-submit :global(button:hover:enabled) { background: #115e59; }
  .login-help { font-size: 12px; color: var(--workspace-muted); line-height: 1.8; margin-top: 20px; }
  .registration-link { display: flex; align-items: center; gap: 10px; min-height: 44px; margin-top: 16px; padding: 10px 0; border-top: 1px solid var(--workspace-border); color: var(--workspace-accent); font-size: 12px; text-decoration: none; }
  .registration-link span { flex: 1; }
  .registration-link:hover span { text-decoration: underline; text-underline-offset: 4px; }
  .form-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; padding-top: 14px; border-top: 1px solid var(--workspace-border); color: var(--workspace-muted); font-size: 10px; line-height: 1.8; }
  .form-footer a { display: inline-flex; align-items: center; gap: 4px; min-height: 24px; color: var(--workspace-accent); text-decoration: none; }
  .form-footer a:hover { text-decoration: underline; }
  .page-caption { margin: 17px 0 0; color: var(--workspace-muted); text-align: center; font-size: 11px; }
  @media (min-width: 761px) and (max-height: 800px) { .login-page { padding: 16px; } .login-topbar { margin-bottom: 12px; } .page-caption { display: none; } }
  @media (max-width: 960px) { .brand-panel { padding: 30px; } .form-panel { padding: 30px; } .brand-name { font-size: 15px; } .brand-mark { width: 54px; height: 54px; } .brand-story h2 { font-size: 29px; } }
  @media (max-width: 760px) { .login-page { padding: 20px 16px; align-items: flex-start; } .login-frame { max-width: 480px; } .login-shell { grid-template-columns: minmax(0, 1fr); border-radius: 10px; } .brand-panel { padding: 23px; } .brand-story, .service-list, .brand-footer { display: none; } .brand-mark { width: 48px; height: 48px; } .brand-name { font-size: 15px; } .brand-caption { font-size: 11px; } .form-panel { padding: 26px 24px 20px; } .login-content { max-width: none; padding-bottom: 20px; } .login-heading h1 { font-size: 28px; } .input-wrap input { font-size: 16px; } }
  @media (max-width: 380px) { .theme-toggle > span { display: none; } .theme-toggle { width: 44px; justify-content: center; padding: 8px; } .brand-panel { padding: 20px; } .form-panel { padding: 24px 20px 18px; } .brand-lockup { gap: 10px; } .brand-name { font-size: 14px; } .brand-caption { font-size: 10px; } }
</style>
