<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import { CheckCircle2, ClipboardCopy, Download, QrCode as QrIcon, RefreshCw, ScanLine, XCircle } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Input from '../lib/components/ui/Input.svelte';
  import Select from '../lib/components/ui/Select.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { generatePromptPayQr } from '../lib/api/endpoints';
  import type { PromptPayDefaults } from '../lib/utils/promptpay';
  import { PROMPTPAY_DEFAULTS, crc16, validateEmvCoPayload, parsePayloadValues } from '../lib/utils/promptpay';

  let loadingDefaults = $state(true);
  let serverDefaults = $state<PromptPayDefaults>({ ...PROMPTPAY_DEFAULTS });
  let serverSamplePayload = $state('');

  let billerId = $state(PROMPTPAY_DEFAULTS.billerId);
  let ref1 = $state(PROMPTPAY_DEFAULTS.ref1);
  let ref2 = $state(PROMPTPAY_DEFAULTS.ref2);
  let ref3 = $state(PROMPTPAY_DEFAULTS.ref3);
  let amount = $state('');
  let poi = $state<'11' | '12'>(PROMPTPAY_DEFAULTS.pointOfInitiation);

  let generating = $state(false);
  let payload = $state('');
  let qrImage = $state('');
  let validation = $state<ReturnType<typeof validateEmvCoPayload> | null>(null);
  let parsed = $state<Record<string, string>>({});

  function defaultsFromPayload(p: string): PromptPayDefaults {
    const outer = parsePayloadValues(p);
    const biller = parsePayloadValues(outer['30'] ?? '');
    return {
      billerId: biller['01'] ?? PROMPTPAY_DEFAULTS.billerId,
      ref1: biller['00'] ?? '',
      ref2: biller['02'] ?? 'CIDA',
      ref3: biller['03'] ?? '0000',
      pointOfInitiation: outer['01'] === '12' ? '12' : '11',
    };
  }

  onMount(loadDefaults);

  async function loadDefaults(): Promise<void> {
    loadingDefaults = true;
    try {
      const res = await generatePromptPayQr({});
      if (res.status === 'ok' && res.payload) {
        serverSamplePayload = res.payload;
        serverDefaults = defaultsFromPayload(res.payload);
      }
    } catch {
      serverDefaults = { ...PROMPTPAY_DEFAULTS };
      ui.showAlert({ title: 'โหลดค่าเริ่มต้นไม่สำเร็จ', message: 'ใช้ค่าเริ่มต้นในเครื่องแทน โปรดตรวจสอบการเชื่อมต่อ', type: 'warning' });
    } finally {
      loadingDefaults = false;
    }
  }

  function applyDefaults(): void {
    billerId = serverDefaults.billerId;
    ref1 = serverDefaults.ref1;
    ref2 = serverDefaults.ref2;
    ref3 = serverDefaults.ref3;
    poi = serverDefaults.pointOfInitiation;
    amount = '';
    ui.showToast('นำค่าเริ่มต้นมาใช้ในฟอร์มแล้ว', 'success');
  }

  async function generate(): Promise<void> {
    if (!billerId.trim()) {
      ui.showAlert({ title: 'กรุณากรอก Biller ID', message: 'ต้องระบุเลขผู้ประกอบการรับชำระเงิน (13 หลัก)', type: 'error' });
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
    const base =
      '0002010102113013' +
      serverDefaults.billerId +
      '53037645802TH5914CIDA FOUNDATION6304';
    return base + crc16(base);
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
  <Card title="ค่าเริ่มต้นจากระบบ" subtitle="ค่าที่กำหนดไว้บนเซิร์ฟเวอร์ (backend) สำหรับสร้าง PromptPay QR">
    {#if loadingDefaults}
      <div class="flex items-center justify-center py-10"><Spinner /></div>
    {:else}
      <div class="flex flex-col gap-4">
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Biller ID</dt>
            <dd class="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100">{serverDefaults.billerId}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Ref1</dt>
            <dd class="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100">{serverDefaults.ref1 || '-'}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Ref2</dt>
            <dd class="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100">{serverDefaults.ref2}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Ref3</dt>
            <dd class="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100">{serverDefaults.ref3}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Point of Initiation</dt>
            <dd class="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100">{serverDefaults.pointOfInitiation}</dd>
          </div>
        </dl>
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onclick={loadDefaults}>
            <RefreshCw class="h-4 w-4" /> โหลดใหม่
          </Button>
          <Button variant="outline" onclick={inspectSample}>
            <ScanLine class="h-4 w-4" /> ตรวจสอบตัวอย่างจากระบบ
          </Button>
          <Button onclick={applyDefaults}>
            <QrIcon class="h-4 w-4" /> ใช้ค่าเริ่มต้นในฟอร์ม
          </Button>
        </div>
      </div>
    {/if}
  </Card>

  <Card title="สร้าง QR สำหรับทดสอบ" subtitle="กรอกข้อมูลแล้วกดสร้าง เพื่อให้ backend สร้าง EMVCo payload และแสดง QR">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input label="Biller ID (13 หลัก)" placeholder="010753700088205" value={billerId} oninput={(e) => (billerId = e.currentTarget.value)} />
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
