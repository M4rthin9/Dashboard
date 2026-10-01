<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowDown, ArrowUp, ImagePlus, Save, Trash2 } from '@lucide/svelte';
  import Card from '../ui/Card.svelte';
  import Spinner from '../ui/Spinner.svelte';
  import { ui } from '../../store/ui.svelte';
  import { deletePromoImage, getSettings, promoImageUrl, saveSettings, uploadPromoImage } from '../../api/endpoints';
  import { fileToPromoDataUri } from '../../utils/promoImage';

  /** Lets the page refresh views of the same admin_settings blob (the raw JSON editor). */
  let { onSaved }: { onSaved?: () => void } = $props();

  /** Mirrors the backend cap (MAX_PROMO_ADS). */
  const MAX_ADS = 10;

  interface Ad {
    id: string;
    title: string;
    link: string;
    active: boolean;
  }

  let loading = $state(true);
  let saving = $state(false);
  let uploading = $state(false);
  let popupEnabled = $state(true);
  let ads = $state<Ad[]>([]);
  let noticeEnabled = $state(false);
  let noticeTitle = $state('');
  let noticeBody = $state('');
  let fileInput: HTMLInputElement | null = $state(null);

  onMount(load);

  function errMsg(err: unknown): string {
    return err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
  }

  async function load(): Promise<void> {
    loading = true;
    try {
      const res = await getSettings();
      const promo = (res.settings?.promo ?? {}) as Record<string, unknown>;
      popupEnabled = promo.popupEnabled !== false;
      ads = (Array.isArray(promo.ads) ? promo.ads : [])
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object' && typeof a.id === 'string')
        .map((a) => ({
          id: String(a.id),
          title: String(a.title ?? ''),
          link: String(a.link ?? ''),
          active: a.active !== false,
        }));
      const notice = (promo.notice ?? {}) as Record<string, unknown>;
      noticeEnabled = notice.enabled === true;
      noticeTitle = String(notice.title ?? '');
      noticeBody = String(notice.body ?? '');
    } catch (err) {
      ui.showAlert({ title: 'ไม่สามารถโหลดข้อมูลโฆษณาได้', message: errMsg(err), type: 'error' });
    } finally {
      loading = false;
    }
  }

  /** Read-merge-write so sibling keys in admin_settings (payment, promptpay…) survive. */
  async function persist(): Promise<boolean> {
    const current = await getSettings();
    const res = await saveSettings({
      ...(current.settings ?? {}),
      promo: {
        popupEnabled,
        ads: ads.map((a) => ({ id: a.id, title: a.title.trim(), link: a.link.trim(), active: a.active })),
        notice: { enabled: noticeEnabled, title: noticeTitle.trim(), body: noticeBody.trim() },
      },
    });
    if (res.status !== 'ok') return false;
    onSaved?.();
    return true;
  }

  async function save(): Promise<void> {
    const badLink = ads.find((a) => a.link.trim() && !/^https?:\/\//i.test(a.link.trim()));
    if (badLink) {
      ui.showAlert({ title: 'ลิงก์ไม่ถูกต้อง', message: 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', type: 'error' });
      return;
    }
    saving = true;
    try {
      if (await persist()) ui.showToast('บันทึกโฆษณาและประกาศแล้ว', 'success');
    } catch (err) {
      ui.showAlert({ title: 'บันทึกไม่สำเร็จ', message: errMsg(err), type: 'error' });
    } finally {
      saving = false;
    }
  }

  /** Each image is saved into the list right away, so an upload is never left orphaned in R2. */
  async function onFiles(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;
    if (ads.length + files.length > MAX_ADS) {
      ui.showAlert({ title: 'เกินจำนวนที่กำหนด', message: `เพิ่มได้สูงสุด ${MAX_ADS} รูป`, type: 'error' });
      return;
    }
    uploading = true;
    let added = 0;
    try {
      for (const file of files) {
        const res = await uploadPromoImage(await fileToPromoDataUri(file));
        if (res.id) {
          ads = [...ads, { id: res.id, title: '', link: '', active: true }];
          added++;
        }
      }
    } catch (err) {
      ui.showAlert({ title: 'อัปโหลดไม่สำเร็จ', message: errMsg(err), type: 'error' });
    }
    // Whatever made it up before a failure still gets listed.
    try {
      if (added > 0 && (await persist())) ui.showToast(`เพิ่มรูปโฆษณาแล้ว ${added} รูป`, 'success');
    } catch (err) {
      ui.showAlert({ title: 'บันทึกไม่สำเร็จ', message: errMsg(err), type: 'error' });
    } finally {
      uploading = false;
    }
  }

  async function remove(id: string): Promise<void> {
    if (!confirm('ลบรูปโฆษณานี้?')) return;
    const before = ads;
    ads = ads.filter((a) => a.id !== id);
    saving = true;
    try {
      if (!(await persist())) {
        ads = before;
        return;
      }
      // Only after the list no longer references it — the server checks that too.
      await deletePromoImage(id).catch(() => undefined);
      ui.showToast('ลบรูปโฆษณาแล้ว', 'success');
    } catch (err) {
      ads = before;
      ui.showAlert({ title: 'ลบไม่สำเร็จ', message: errMsg(err), type: 'error' });
    } finally {
      saving = false;
    }
  }

  function move(i: number, dir: -1 | 1): void {
    const j = i + dir;
    if (j < 0 || j >= ads.length) return;
    const next = [...ads];
    [next[i], next[j]] = [next[j]!, next[i]!];
    ads = next;
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
</script>

<Card title="โฆษณาและประกาศหน้าแรก" subtitle="ป๊อปอัปรูปโฆษณา (สไลด์) และข้อความประกาศบนหน้าแรกของเว็บจอง">
  {#if loading}
    <div class="flex items-center justify-center py-10"><Spinner /></div>
  {:else}
    <div class="flex flex-col gap-6">
      <label class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <span>
          <span class="block text-sm font-semibold text-slate-700 dark:text-slate-200">แสดงป๊อปอัปเมื่อเปิดหน้าแรก</span>
          <span class="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            ปิดไว้ รูปโฆษณาจะยังแสดงในส่วน "ข่าวสารและประกาศ" บนหน้าแรก
          </span>
        </span>
        <input type="checkbox" bind:checked={popupEnabled} class="h-5 w-5 accent-blue-700" />
      </label>

      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-medium text-slate-700 dark:text-slate-200">รูปโฆษณา ({ads.length}/{MAX_ADS})</p>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            onclick={() => fileInput?.click()}
            disabled={uploading || saving || ads.length >= MAX_ADS}
          >
            <ImagePlus class="h-4 w-4" />
            {uploading ? 'กำลังอัปโหลด...' : 'เพิ่มรูป'}
          </button>
          <input
            bind:this={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            class="hidden"
            onchange={onFiles}
          />
        </div>

        {#if ads.length === 0}
          <p class="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-600">
            ยังไม่มีรูปโฆษณา · แนะนำภาพแนวตั้งหรือสี่เหลี่ยมจัตุรัส ไม่เกิน 3MB
          </p>
        {:else}
          {#each ads as ad, i (ad.id)}
            <div class="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row dark:border-slate-700 {ad.active ? '' : 'opacity-60'}">
              <img src={promoImageUrl(ad.id)} alt={ad.title || `โฆษณา ${i + 1}`} class="h-28 w-full rounded-lg bg-slate-100 object-contain sm:w-40 dark:bg-slate-800" />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <input bind:value={ad.title} maxlength="120" placeholder="หัวข้อ (ไม่บังคับ)" class={inputCls} aria-label="หัวข้อโฆษณา {i + 1}" />
                <input bind:value={ad.link} maxlength="500" placeholder="ลิงก์เมื่อกดรูป https://... (ไม่บังคับ)" class={inputCls} aria-label="ลิงก์โฆษณา {i + 1}" />
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" bind:checked={ad.active} class="h-4 w-4 accent-blue-700" /> แสดงบนเว็บ
                  </label>
                  <div class="flex gap-1">
                    <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800" onclick={() => move(i, -1)} disabled={i === 0} aria-label="เลื่อนขึ้น">
                      <ArrowUp class="h-4 w-4" />
                    </button>
                    <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800" onclick={() => move(i, 1)} disabled={i === ads.length - 1} aria-label="เลื่อนลง">
                      <ArrowDown class="h-4 w-4" />
                    </button>
                    <button type="button" class="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950/40" onclick={() => void remove(ad.id)} disabled={saving} aria-label="ลบรูป">
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <label class="flex items-center justify-between gap-4">
          <span>
            <span class="block text-sm font-semibold text-slate-700 dark:text-slate-200">ข้อความประกาศถึงผู้เข้าร่วม</span>
            <span class="mt-1 block text-xs text-slate-500 dark:text-slate-400">แสดงบนหน้าแรกเสมอ แม้ไม่มีป๊อปอัป</span>
          </span>
          <input type="checkbox" bind:checked={noticeEnabled} class="h-5 w-5 accent-blue-700" />
        </label>
        <input bind:value={noticeTitle} maxlength="120" placeholder="หัวข้อประกาศ" class={inputCls} aria-label="หัวข้อประกาศ" />
        <textarea bind:value={noticeBody} rows="4" maxlength="3000" placeholder="รายละเอียด (ข้อความธรรมดา ขึ้นบรรทัดใหม่ได้)" class={inputCls} aria-label="รายละเอียดประกาศ"></textarea>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 disabled:opacity-50"
          onclick={save}
          disabled={saving || uploading}
        >
          <span class="flex items-center gap-1.5"><Save class="h-4 w-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
        </button>
      </div>
    </div>
  {/if}
</Card>
