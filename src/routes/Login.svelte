<script lang="ts">
  import { AlertCircle, ArrowRight, ArrowUpRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from '@lucide/svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { navigate } from '../lib/router';

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

<svelte:head><title>เข้าสู่ระบบ · CC Cafe Dashboard</title></svelte:head>

<main class="login-page">
  <div class="login-shell">
    <section class="brand-panel" aria-label="Chance & Change Café">
      <img class="cafe-photo" src="/login-cafe.webp" alt="" aria-hidden="true" fetchpriority="high" />
      <div class="photo-shade" aria-hidden="true"></div>

      <div class="brand-lockup">
        <img src="/login-mark.webp" alt="ตรากรมราชทัณฑ์" width="128" height="128" class="brand-mark" />
        <div>
          <p class="brand-name">CC Cafe<span class="brand-dot">.</span></p>
          <p class="brand-caption">CHANCE & CHANGE CAFÉ</p>
        </div>
      </div>

      <div class="brand-story">
        <span class="story-line" aria-hidden="true"></span>
        <p class="story-eyebrow">A LITTLE CARE. A BIG CHANGE.</p>
        <h2>ทุกการต้อนรับ<br />เริ่มต้นที่<span>ความใส่ใจ</span></h2>
        <p class="story-description">พื้นที่จัดการงานของทีม CC Cafe<br />เพื่อทุกมื้ออาหารและทุกการพบกันที่มีความหมาย</p>
      </div>

      <div class="brand-footer">
        <span>การจองเยี่ยม</span><span class="footer-dot" aria-hidden="true"></span>
        <span>การจองโต๊ะ</span><span class="footer-dot" aria-hidden="true"></span>
        <span>การชำระเงิน</span>
      </div>
    </section>

    <section class="form-panel" aria-labelledby="login-title">
      <div class="login-content">
        <div class="staff-label"><ShieldCheck class="h-4 w-4" aria-hidden="true" />สำหรับเจ้าหน้าที่</div>
        <header class="login-heading">
          <p class="login-eyebrow">WELCOME BACK</p>
          <h1 id="login-title">ยินดีต้อนรับกลับ</h1>
          <p>เข้าสู่ระบบเพื่อจัดการการจอง<br class="desktop-break" />และดูแลการให้บริการของ CC Cafe</p>
        </header>

        <form onsubmit={handleSubmit} aria-busy={loading} class="login-form">
          <div class="login-field">
            <label for="login-username">ชื่อผู้ใช้</label>
            <div class="input-wrap">
              <UserRound class="field-icon h-[18px] w-[18px]" aria-hidden="true" />
              <input
                id="login-username"
                name="username"
                type="text"
                bind:value={username}
                placeholder="กรอกชื่อผู้ใช้ของคุณ"
                autocomplete="username"
                autocapitalize="none"
                spellcheck={false}
                required
                disabled={loading}
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
          </div>

          <div class="login-field">
            <label for="login-password">รหัสผ่าน</label>
            <div class="input-wrap">
              <LockKeyhole class="field-icon h-[18px] w-[18px]" aria-hidden="true" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                bind:value={password}
                placeholder="กรอกรหัสผ่านของคุณ"
                autocomplete="current-password"
                required
                disabled={loading}
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                class="password-input"
              />
              <button
                type="button"
                class="password-toggle"
                disabled={loading}
                onclick={() => (showPassword = !showPassword)}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                aria-pressed={showPassword}
                aria-controls="login-password"
              >
                {#if showPassword}<EyeOff class="h-[18px] w-[18px]" aria-hidden="true" />
                {:else}<Eye class="h-[18px] w-[18px]" aria-hidden="true" />{/if}
              </button>
            </div>
          </div>

          {#if error}
            <div id="login-error" role="alert" class="login-error">
              <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          {/if}

          <div class="login-submit">
            <Button type="submit" loading={loading} disabled={loading} fullWidth size="lg">
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              {#if !loading}<ArrowRight class="h-[18px] w-[18px]" aria-hidden="true" />{/if}
            </Button>
          </div>
        </form>

        <p class="login-help">หากไม่สามารถเข้าสู่ระบบได้<br />กรุณาติดต่อผู้ดูแลระบบเพื่อขอความช่วยเหลือ</p>
      </div>

      <footer class="form-footer">
        <span>CC Cafe Dashboard</span>
        <a href="https://cida.dpdns.org/" target="_blank" rel="noopener noreferrer">เว็บไซต์ลูกค้า<ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" /></a>
      </footer>
    </section>
  </div>
</main>

<style>
  .login-page {
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    background: radial-gradient(ellipse at 10% 0%, #efe1d9, transparent 55%), #f2eee8;
  }
  .login-shell {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    width: min(1160px, 100%);
    min-height: min(740px, calc(100svh - 64px));
    overflow: hidden;
    border: 1px solid #ffffffb3;
    border-radius: 28px;
    box-shadow: 0 32px 90px -40px #48262350, 0 3px 14px #48262308;
  }
  .brand-panel {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 640px;
    padding: 44px;
    overflow: hidden;
    color: #fff8ef;
    background: #3b1c22;
  }
  .cafe-photo, .photo-shade { position: absolute; inset: 0; z-index: -1; height: 100%; width: 100%; }
  .cafe-photo { object-fit: cover; object-position: center 66%; }
  .photo-shade { background: linear-gradient(180deg, #29151de8 0%, #421e28c7 40%, #3c1c2596 65%, #25191ddd 100%); }
  .brand-lockup { display: flex; align-items: center; gap: 15px; }
  .brand-mark { width: 56px; height: 56px; border-radius: 50%; object-fit: contain; background: #fff; padding: 2px; }
  .brand-name { margin: 0; font-size: 27px; font-weight: 500; line-height: 1.2; letter-spacing: -0.7px; }
  .brand-dot { color: #edc384; }
  .brand-caption { margin-top: 7px; font-size: 9px; letter-spacing: 2.2px; color: #f0d8ca; }
  .brand-story { padding: 74px 0 66px; }
  .story-line { display: block; width: 42px; height: 2px; background: #edc384; margin-bottom: 25px; }
  .story-eyebrow { font-size: 10px; letter-spacing: 2.2px; color: #f2d8b2; }
  .brand-story h2 { margin: 20px 0 23px; font-size: clamp(30px, 3.1vw, 44px); font-weight: 400; line-height: 1.55; letter-spacing: -1.3px; }
  .brand-story h2 span { color: #f6d4a3; }
  .story-description { font-size: 13px; font-weight: 300; line-height: 1.9; color: #f7e9df; }
  .brand-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; border-top: 1px solid #fff6e52b; padding-top: 22px; font-size: 11px; color: #f0d8ca; }
  .footer-dot { width: 3px; height: 3px; border-radius: 50%; background: #edc384; }
  .form-panel { display: flex; flex-direction: column; justify-content: space-between; background: #fffcf7; padding: 46px 56px 27px; color: #34292d; }
  .login-content { width: 100%; max-width: 370px; margin: auto; padding: 26px 0 42px; }
  .staff-label { display: inline-flex; align-items: center; gap: 7px; padding: 7px 10px; border: 1px solid #e9dace; border-radius: 7px; font-size: 11px; color: #876255; background: #f7f0e8; }
  .login-heading { margin-top: 32px; margin-bottom: 32px; }
  .login-eyebrow { font-size: 10px; font-weight: 500; letter-spacing: 2.4px; color: #a92928; }
  .login-heading h1 { margin: 8px 0 12px; font-size: 32px; font-weight: 500; letter-spacing: -0.6px; line-height: 1.4; }
  .login-heading > p:last-child { font-size: 13px; font-weight: 300; line-height: 1.85; color: #796d70; }
  .login-form { display: flex; flex-direction: column; gap: 21px; }
  .login-field label { display: block; font-size: 13px; margin-bottom: 9px; font-weight: 400; }
  .input-wrap { position: relative; }
  .input-wrap :global(.field-icon) { position: absolute; left: 15px; top: 18px; color: #a19597; pointer-events: none; }
  .input-wrap input { width: 100%; height: 54px; padding: 13px 15px 13px 44px; border: 1px solid #ded7d2; border-radius: 10px; background: #fffdfb; color: #34292d; font: inherit; font-size: 14px; transition: border-color 150ms, box-shadow 150ms; }
  .input-wrap input::placeholder { color: #a19597; font-weight: 300; }
  .input-wrap input:focus { outline: none; border-color: #a92928; box-shadow: 0 0 0 3px #a9292812; }
  .input-wrap input[aria-invalid='true'] { border-color: #c14343; }
  .input-wrap input:disabled { opacity: 0.6; }
  .input-wrap .password-input { padding-right: 54px; }
  .password-toggle { position: absolute; right: 5px; top: 5px; display: flex; align-items: center; justify-content: center; height: 44px; width: 44px; border: 0; border-radius: 7px; background: transparent; color: #8c7e82; transition: color 150ms, background 150ms; }
  .password-toggle:hover { color: #a92928; background: #f9f0eb; }
  .login-error { display: flex; gap: 9px; padding: 12px 13px; border-radius: 9px; background: #fcEEEE; color: #9e2727; font-size: 12px; line-height: 1.7; }
  .login-submit { margin-top: 5px; }
  .login-submit :global(button) { min-height: 54px; border-radius: 10px; box-shadow: 0 6px 16px -8px #a9292880; font-weight: 400; }
  .login-help { margin-top: 25px; font-size: 11px; font-weight: 300; line-height: 1.9; color: #8b7e82; }
  .form-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; border-top: 1px solid #eee5dc; padding-top: 20px; font-size: 10px; color: #91868b; }
  .form-footer a { display: inline-flex; align-items: center; gap: 4px; color: #6f565d; text-decoration: none; }
  .form-footer a:hover { color: #a92928; }
  :global(.dark) .login-page { background: radial-gradient(ellipse at 10% 0%, #39222d, transparent 55%), #14141c; }
  :global(.dark) .login-shell { border-color: #ffffff0d; }
  :global(.dark) .form-panel { background: #201c23; color: #f6eee8; }
  :global(.dark) .staff-label { background: #33282b; border-color: #4f3d40; color: #d8b8a0; }
  :global(.dark) .login-eyebrow { color: #e7a59d; }
  :global(.dark) .login-heading > p:last-child, :global(.dark) .login-help { color: #b4a6ad; }
  :global(.dark) .input-wrap input { background: #29232c; border-color: #4b3f48; color: #f6eee8; }
  :global(.dark) .input-wrap input:focus { border-color: #e7a59d; box-shadow: 0 0 0 3px #e7a59d15; }
  :global(.dark) .input-wrap input[aria-invalid='true'] { border-color: #df8c8c; }
  :global(.dark) .password-toggle:hover { color: #e7a59d; background: #3c2b31; }
  :global(.dark) .login-error { background: #472528; color: #f4b5ae; }
  :global(.dark) .form-footer { border-color: #46353e; color: #ab9ca5; }
  :global(.dark) .form-footer a { color: #d5bcc6; }
  @media (max-width: 1000px) {
    .brand-panel { padding: 34px; }
    .form-panel { padding-left: 36px; padding-right: 36px; }
    .brand-story h2 { font-size: 34px; }
  }
  @media (max-width: 760px) {
    .login-page { padding: 20px; }
    .login-shell { grid-template-columns: 1fr; min-height: auto; max-width: 460px; border-radius: 22px; }
    .brand-panel { min-height: auto; padding: 25px 28px; }
    .brand-story, .brand-footer, .cafe-photo { display: none; }
    .photo-shade { background: linear-gradient(120deg, #48212c, #2c1c25); }
    .brand-mark { height: 48px; width: 48px; }
    .brand-name { font-size: 24px; }
    .brand-caption { font-size: 8px; letter-spacing: 1.7px; }
    .form-panel { padding: 28px 28px 23px; }
    .login-content { padding: 0 0 28px; max-width: none; }
    .staff-label { font-size: 10px; padding: 5px 8px; }
    .login-heading { margin: 25px 0 26px; }
    .login-heading h1 { font-size: 29px; }
    .login-form { gap: 19px; }
    .form-footer { padding-top: 18px; }
    .input-wrap input { font-size: 16px; }
  }
  @media (max-width: 360px) {
    .login-page { padding: 12px; }
    .brand-panel, .form-panel { padding-left: 23px; padding-right: 23px; }
    .login-heading h1 { font-size: 26px; }
    .brand-caption { letter-spacing: 1px; }
  }
</style>
