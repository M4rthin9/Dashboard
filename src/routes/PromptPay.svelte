<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import { CheckCircle2, ClipboardCopy, Download, QrCode as QrIcon, RefreshCw, Save, ScanLine, XCircle } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Input from '../lib/components/ui/Input.svelte';
  import Select from '../lib/components/ui/Select.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { promptpayStore } from '../lib/store/promptpay.svelte';
  import { generatePromptPayQr } from '../lib/api/endpoints';
  import type { PromptPayConfig } from '../lib/utils/promptpay';
  import { buildBillerPayload, validateEmvCoPayload, parsePayloadValues } from '../lib/utils/promptpay';

  let saving = $state(false);
  let serverSamplePayload = $state('');

  let draftBillerId = $state(promptpayStore.config.billerId);
  let draftRef1 = $state(promptpayStore.config.ref1);
  let draftRef2 = $state(promptpayStore.config.ref2);
  let draftRef3 = $state(promptpayStore.config.ref3);
  let draftPoi = $state<'11' | '12'>(promptpayStore.config.pointOfInitiation);

  let billerId = $state(promptpayStore.config.billerId);
  let ref1 = $state(promptpayStore.config.ref1);
  let ref2 = $state(promptpayStore.config.ref2);
  let ref3 = $state(promptpayStore.config.ref3);
  let amount = $state('');
  let poi = $state<'11' | '12'>(promptpayStore.config.pointOfInitiation);

  let generating = $state(false);
  let payload = $state('');
  let qrImage = $state('');
  let validation = $state<ReturnType<typeof validateEmvCoPayload> | null>(null);
  let parsed = $state<Record<string, string>>({});

  onMount(async () => {
    await promptpayStore.hydrateFromServer();
    syncFromStore();
    await loadBackendSample();
  });

  function syncFromStore(): void {
    const c = promptpayStore.config;
    draftBillerId = c.billerId;
    draftRef1 = c.ref1;
    draftRef2 = c.ref2;
    draftRef3 = c.ref3;
    draftPoi = c.pointOfInitiation;
    billerId = c.billerId;
    ref1 = c.ref1;
    ref2 = c.ref2;
    ref3 = c.ref3;
    poi = c.pointOfInitiation;
    amount = '';
  }

  async function loadBackendSample(): Promise<void> {
    try {
      const res = await generatePromptPayQr({});
      if (res.status === 'ok' && res.payload) {
        serverSamplePayload = res.payload;
      }
    } catch {
      serverSamplePayload = '';
    }
  }

  async function saveConfig(): Promise<void> {
    if (!draftBillerId.trim()) {
      ui.showAlert({ title: 'กรุณากรอก Biller ID', message: 'ต้องระบุเลขผู้ประกอบการรับชำระเงิน (15 หลัก)', type: 'error' });
      return;
    }
    saving = true;
    const next: PromptPayConfig = {
      billerId: draftBillerId.trim(),
      ref1: draftRef1.trim(),
      ref2: draftRef2.trim(),
      ref3: draftRef3.trim(),
      pointOfInitiation: draftPoi,
    };
    try {
      const ok = await promptpayStore.save(next);
      syncFromStore();
      ui.showToast(ok ? 'บันทึกตั้งค่า QR สำเร็จ (เครื่อง + เซิร์ฟเวอร์)' : 'บันทึกในเครื่องแล้ว แต่เซิร์ฟเวอร์ล้มเหลว', ok ? 'success' : 'warning');
    } catch (err) {
      ui.showAlert({ title: 'บันทึกตั้งค่าไม่สำเร็จ', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      saving = false;
    }
  }

  async function generate(): Promise<void> {
    if (!billerId.trim()) {
      ui.showAlert({ title: 'กรุณากรอก Biller ID', message: 'ต้องระบุเลขผู้ประกอบการรับชำระเงิน (15 หลัก)', type: 'error' });
      return;
    }
    generating = true;
    payload = '';
    qrImage = '';
    validation = null;
    parsed = {};
    try {
      const res = await generatePromptPayQr({
        billerId: billerId.trim(),
        ref1: ref1.trim(),
        ref2: ref2.trim(),
        ref3: ref3.trim(),
        amount: amount.trim() ? amount.trim() : undefined,
        pointOfInitiation: poi,
      });
      if (res.status !== 'ok' || !res.payload) {
        throw new Error(res.message ?? 'สร้าง payload ไม่สำเร็จ');
      }
      payload = res.payload;
      parsed = parsePayloadValues(payload);
      validation = validateEmvCoPayload(payload);
      qrImage = await QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
      ui.showToast(validation.ok ? 'สร้าง QR สำเร็จ' : 'สร้าง QR แล้ว แต่ payload มีปัญหา', validation.ok ? 'success' : 'error');
    } catch (err) {
      ui.showAlert({ title: 'สร้าง QR ไม่สำเร็จ', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      generating = false;
    }
  }

  async function inspectSample(): Promise<void> {
    if (!serverSamplePayload) {
      ui.showAlert({ title: 'ยังไม่มีตัวอย่างจากระบบ', message: 'โหลดค่าเริ่มต้นจากระบบก่อน', type: 'warning' });
      return;
    }
    payload = serverSamplePayload;
    parsed = parsePayloadValues(payload);
    validation = validateEmvCoPayload(payload);
    qrImage = await QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
    ui.showToast(validation.ok ? 'ตรวจสอบตัวอย่างผ่าน' : 'ตัวอย่างจากระบบมีปัญหา', validation.ok ? 'success' : 'error');
  }

  function sampleLocalPayload(): string {
    return buildBillerPayload(
      { billerId: billerId.trim(), ref1: ref1.trim(), ref2: ref2.trim(), ref3: ref3.trim(), pointOfInitiation: poi },
      { amount: amount.trim() || undefined }
    );
  }

  async function inspectLocalSample(): Promise<void> {
    const p = sampleLocalPayload();
    payload = p;
    parsed = parsePayloadValues(p);
    validation = validateEmvCoPayload(p);
    qrImage = await QRCode.toDataURL(p, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
    ui.showToast(validation.ok ? 'ตรวจสอบตัวอย่างผ่าน' : 'ตัวอย่างมีปัญหา', validation.ok ? 'success' : 'error');
  }

  async function copyPayload(): Promise<void> {
    try {
      await navigator.clipboard.writeText(payload);
      ui.showToast('คัดลอก payload แล้ว', 'success');
    } catch {
      ui.showToast('คัดลอกไม่สำเร็จ', 'error');
    }
  }

  function downloadQr(): void {
    if (!qrImage) return;
    const a = document.createElement('a');
    a.href = qrImage;
    a.download = 'promptpay-qr.png';
    a.click();
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="ตั้งค่า QR ชำระเงิน" subtitle="ค่าที่ใช้สร้าง PromptPay QR ตอนสถานะชำระเงิน — บันทึกในเครื่องและเซิร์ฟเวอร์">
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Biller ID (15 หลัก)" placeholder="010753700088205" value={draftBillerId} oninput={(e) => (draftBillerId = e.currentTarget.value)} />
        <Input label="Ref1" value={draftRef1} oninput={(e) => (draftRef1 = e.currentTarget.value)} />
        <Input label="Ref2" value={draftRef2} oninput={(e) => (draftRef2 = e.currentTarget.value)} />
        <Input label="Ref3" value={draftRef3} oninput={(e) => (draftRef3 = e.currentTarget.value)} />
        <div>
          <Select
            label="Point of Initiation"
            value={draftPoi}
            onchange={(v) => (draftPoi = v as '11' | '12')}
            options={[
              { value: '11', label: 'Static (ไม่ระบุจำนวนเงิน)' },
              { value: '12', label: 'Dynamic (ระบุจำนวนเงิน)' },
            ]}
          />
        </div>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onclick={syncFromStore} disabled={saving}>
          <RefreshCw class="h-4 w-4" /> คืนค่าเดิม
        </Button>
        <Button onclick={saveConfig} loading={saving} disabled={saving}>
          <Save class="h-4 w-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกตั้งค่า'}
        </Button>
      </div>
    </div>
  </Card>

  <Card title="สร้าง QR สำหรับทดสอบ" subtitle="สร้าง EMVCo payload และแสดง QR จากค่าที่ตั้งไว้ (หรือกรอกใหม่เพื่อทดสอบ)">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input label="Biller ID (15 หลัก)" placeholder="010753700088205" value={billerId} oninput={(e) => (billerId = e.currentTarget.value)} />
      <Input label="จำนวนเงิน (บาท, ว่าง = QR แบบไม่ระบุจำนวน)" type="number" placeholder="เช่น 100.00" value={amount} oninput={(e) => (amount = e.currentTarget.value)} />
      <Input label="Ref1" placeholder="เช่น เลขใบแจ้งหนี้" value={ref1} oninput={(e) => (ref1 = e.currentTarget.value)} />
      <Input label="Ref2" value={ref2} oninput={(e) => (ref2 = e.currentTarget.value)} />
      <Input label="Ref3" value={ref3} oninput={(e) => (ref3 = e.currentTarget.value)} />
      <div>
        <Select
          label="Point of Initiation"
          value={poi}
          onchange={(v) => (poi = v as '11' | '12')}
          options={[
            { value: '11', label: 'Static (ไม่ระบุจำนวนเงิน)' },
            { value: '12', label: 'Dynamic (ระบุจำนวนเงิน)' },
          ]}
        />
      </div>
    </div>
    <div class="mt-4 flex flex-wrap justify-end gap-2">
      <Button variant="outline" onclick={inspectSample}>
        <RefreshCw class="h-4 w-4" /> ตรวจสอบตัวอย่างจากระบบ
      </Button>
      <Button variant="outline" onclick={inspectLocalSample}>
        <ScanLine class="h-4 w-4" /> ตรวจสอบตัวอย่างในเครื่อง
      </Button>
      <Button onclick={generate} loading={generating} disabled={generating}>
        <QrIcon class="h-4 w-4" /> {generating ? 'กำลังสร้าง...' : 'สร้าง QR'}
      </Button>
    </div>

    {#if payload}
      <div class="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
        <div class="flex flex-col items-start gap-6 md:flex-row">
          <div class="flex flex-col items-center gap-3">
            {#if qrImage}
              <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700">
                <img src={qrImage} alt="PromptPay QR" width="320" height="320" class="h-48 w-48 object-contain md:h-64 md:w-64" />
              </div>
              <Button variant="outline" size="sm" onclick={downloadQr}>
                <Download class="h-4 w-4" /> ดาวน์โหลด PNG
              </Button>
            {:else}
              <div class="flex h-48 w-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
                <Spinner />
              </div>
            {/if}
          </div>

          <div class="min-w-0 flex-1 space-y-4">
            {#if validation}
              <div class="flex items-start gap-2 rounded-xl px-3.5 py-2.5 {validation.ok
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}">
                {#if validation.ok}
                  <CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0" />
                {:else}
                  <XCircle class="mt-0.5 h-4 w-4 shrink-0" />
                {/if}
                <p class="text-sm font-medium">{validation.message}</p>
              </div>
            {/if}

            <div>
              <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">EMVCo Payload</p>
              <div class="flex items-start gap-2">
                <code class="min-w-0 flex-1 break-all rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100">{payload}</code>
                <button
                  class="shrink-0 rounded-xl border border-slate-300 p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                  onclick={copyPayload}
                  aria-label="คัดลอก payload"
                >
                  <ClipboardCopy class="h-4 w-4" />
                </button>
              </div>
            </div>

            {#if Object.keys(parsed).length > 0}
              <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th class="px-3 py-2 font-medium">Tag</th>
                      <th class="px-3 py-2 font-medium">ค่า</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 font-mono text-slate-700 dark:divide-slate-800 dark:text-slate-200">
                    {#each Object.entries(parsed) as [tag, value] (tag)}
                      <tr>
                        <td class="px-3 py-2 text-slate-400">{tag}</td>
                        <td class="break-all px-3 py-2">{value}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </Card>
</div>
