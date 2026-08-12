<script lang="ts">
  import { CreditCard, Download, ExternalLink, ImageOff } from '@lucide/svelte';
  import Modal from './ui/Modal.svelte';
  import Button from './ui/Button.svelte';
  import { decodeBase64Image } from '../utils/base64';

  let { open, slipUrl, ref, onclose }: {
    open: boolean;
    slipUrl: string;
    ref?: string;
    onclose: () => void;
  } = $props();

  const decodedUrl = $derived(decodeBase64Image(slipUrl));
  const valid = $derived(!!decodedUrl && !decodedUrl.startsWith('SLIP_UPLOADED:'));

  function download(): void {
    if (!decodedUrl) return;
    const a = document.createElement('a');
    a.href = decodedUrl;
    a.download = `slip-${String(ref ?? 'payment').replace(/[^\w-]+/g, '_')}.png`;
    a.click();
  }
</script>

<Modal
  {open}
  title="ตรวจสอบสลิปชำระเงิน"
  onclose={onclose}
  width="max-w-5xl"
  accent="blue"
  icon={CreditCard}
  subtitle={ref ? `Ref: ${ref}` : ''}
>
  <div class="flex flex-col gap-4">
    {#if valid}
      <div class="flex max-h-[75vh] items-center justify-center overflow-auto rounded-2xl bg-slate-100 p-3 dark:bg-slate-950">
        <img
          src={decodedUrl}
          alt="สลิปชำระเงิน"
          class="h-auto max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-md"
        />
      </div>
    {:else}
      <div class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-10 text-center dark:border-amber-700 dark:bg-amber-950/40">
        <ImageOff class="h-10 w-10 text-amber-500" />
        <div class="text-sm font-semibold text-amber-700 dark:text-amber-300">ไม่สามารถอ่านสลิปชำระเงินได้</div>
        <div class="text-xs text-amber-600 dark:text-amber-400">ไฟล์สลิปอาจเสียหายหรือไม่ใช่รูปภาพ</div>
      </div>
    {/if}
  </div>
  {#snippet footer()}
    {#if valid}
      <Button variant="outline" size="sm" onclick={download} disabled={!decodedUrl}>
        <Download class="h-4 w-4" /> ดาวน์โหลดสลิป
      </Button>
      <a
        href={decodedUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60"
      >
        <ExternalLink class="h-4 w-4" />
        เปิดสลิปในหน้าต่างใหม่
      </a>
    {/if}
    <Button variant="outline" onclick={onclose}>ปิด</Button>
  {/snippet}
</Modal>
