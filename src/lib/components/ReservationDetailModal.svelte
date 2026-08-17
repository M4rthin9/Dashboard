<script lang="ts">
  import {
    Baby,
    Banknote,
    Building2,
    CalendarDays,
    Clock3,
    ClipboardCopy,
    CreditCard,
    Download,
    Hash,
    Info,
    Phone,
    QrCode,
    ReceiptText,
    ShieldCheck,
    User,
    UsersRound,
  } from '@lucide/svelte';
  import Modal from './ui/Modal.svelte';
  import Button from './ui/Button.svelte';
  import Badge from './ui/Badge.svelte';
  import SlipViewerModal from './SlipViewerModal.svelte';
  import SlipVerifyPanel from './SlipVerifyPanel.svelte';
  import { formatBaht, formatNumber, formatDateTimeThai, normalizeStatus, visitDateLabel } from '../utils/format';
  import type { Reservation } from '../api/types';
  import { getSlipByRef, generatePromptPayQr, updateStatus } from '../api/endpoints';
  import { decodeBase64Image } from '../utils/base64';
  import { verifySlipOCR } from '../utils/slipVerification';
  import { ui } from '../store/ui.svelte';
  import { reservations } from '../store/reservations.svelte';

  let { open, row, onclose, canViewSlip }: {
    open: boolean;
    row: Reservation | null;
    onclose: () => void;
    canViewSlip: boolean;
  } = $props();

  let slipLoading = $state(false);
  let fetchedSlip = $state('');
  let slipViewerOpen = $state(false);

  let paymentPayload = $state('');
  let paymentQr = $state('');

  // Fetch the per-booking bill-payment QR from the backend by ref (Pillar 1).
  // The worker mints this booking's stable ref1; nothing is built client-side.
  $effect(() => {
    if (!open || !row) {
      paymentPayload = '';
      paymentQr = '';
      return;
    }
    if (normalizeStatus(row.status) !== 'รอชำระเงิน') {
      paymentPayload = '';
      paymentQr = '';
      return;
    }
    const ref = row.ref;
    let cancelled = false;
    paymentQr = '';
    generatePromptPayQr({ ref })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'ok' && res.qrDataUrl) {
          paymentQr = String(res.qrDataUrl);
          paymentPayload = res.payload ?? '';
        } else {
          paymentQr = '';
          paymentPayload = '';
        }
      })
      .catch(() => {
        if (!cancelled) {
          paymentQr = '';
          paymentPayload = '';
        }
      });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (!open || !canViewSlip) {
      fetchedSlip = '';
      slipLoading = false;
      return;
    }
    const base = String(row?.slipImage ?? '').trim();
    if (base && !base.startsWith('SLIP_UPLOADED:')) return;
    const ref = row?.ref;
    if (!ref) return;
    let cancelled = false;
    fetchedSlip = '';
    slipLoading = true;
    getSlipByRef(ref)
      .then((d) => {
        if (cancelled) return;
        if (d.status === 'ok' && d.slipImage) fetchedSlip = String(d.slipImage);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) slipLoading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  // --- Auto-slip verification (runs once per open when status = รอชำระเงิน) ---
  let slipVerified = $state(false);
  let slipVerifying = $state(false);

  $effect(() => {
    if (!open || !row || slipVerified || slipVerifying) return;
    const status = normalizeStatus(row.status);
    if (status !== 'รอชำระเงิน') return;

    const slipBase = String(row.slipImage ?? '').trim();
    const isSentinel = !slipBase || slipBase.startsWith('SLIP_UPLOADED:');
    if (isSentinel && !fetchedSlip) return;

    const imageRaw = slipBase && !isSentinel ? slipBase : fetchedSlip;
    if (!imageRaw) return;

    slipVerifying = true;
    verifySlipOCR(imageRaw, {
      customerName: row.visitorName ?? '',
      requiredAmount: Number(row.total) || 0,
    })
      .then(async (result) => {
        if (result.error || !result.success) {
          ui.showToast(`ตรวจสอบสลิปไม่สำเร็จ: ${result.error ?? 'ไม่ทราบข้อผิดพลาด'} — กรุณาตรวจสอบด้วยตนเอง`, 'warning', 6000);
          slipVerified = true;
          return;
        }

        if (result.targetStatus === 'เสร็จสิ้น') {
          await reservations.updateStatus(row.ref, 'เสร็จสิ้น');
          ui.showAlert({
            title: 'ชำระเงินสำเร็จ',
            message: `ชื่อ "${result.extractedName}" ✓ · จำนวนเงิน ${result.extractedAmount.toLocaleString()} บาท ✓\nสถานะเปลี่ยนเป็น "เสร็จสิ้น" อัตโนมัติ`,
            type: 'success',
          });
        } else {
          const reasons: string[] = [];
          if (!result.nameMatched) reasons.push(`ชื่อ "${result.extractedName}" ไม่ตรง`);
          if (!result.amountMatched) reasons.push(`จำนวนเงิน ${result.extractedAmount.toLocaleString()} บาท ไม่ตรง`);
          ui.showToast(`รอเจ้าหน้าที่ตรวจสอบสลิป — ${reasons.join(', ')}`, 'info', 6000);
        }
        slipVerified = true;
      })
      .catch(() => {
        ui.showToast('ไม่สามารถตรวจสอบสลิปได้ — กรุณาตรวจสอบด้วยตนเอง', 'warning', 5000);
        slipVerified = true;
      })
      .finally(() => {
        slipVerifying = false;
      });
  });

  // Reset verification state when modal closes or row changes
  $effect(() => {
    if (!open) {
      slipVerified = false;
      slipVerifying = false;
    }
  });

  const slipUrl = $derived(decodeBase64Image(String(row?.slipImage ?? '').trim() || fetchedSlip));
  const hasSlip = $derived(!!slipUrl && !slipUrl.startsWith('SLIP_UPLOADED:'));

  interface ExtraVisitor {
    name: string;
    id: string;
    relation: string;
    approved: string;
  }

  const extras = $derived.by<ExtraVisitor[]>(() => {
    if (!row || !String(row.extraVisitorNames ?? '').trim()) return [];
    const str = String(row.extraVisitorNames);
    const isNew = str.includes(';;') || str.includes('|');
    let items: Array<{ name: string; id: string; relation: string }>;
    if (isNew) {
      items = str.split(';;').map((e) => {
        const p = e.split('|');
        return { name: (p[0] ?? '').trim(), id: (p[1] ?? '').trim(), relation: (p[2] ?? '').trim() };
      });
    } else {
      items = str.split(/,(?![^(]*\))/).map((e) => {
        const m = e.trim().match(/^(.+?)\s*\(/);
        return { name: m ? m[1].trim() : e.trim(), id: '', relation: m ? e.trim().slice(m[0].length, -1) : '' };
      });
    }
    const appr = String(row.extraVisitorApproved ?? '').split(';;');
    return items
      .filter((v) => v.name)
      .map((v, i) => ({ ...v, approved: (appr[i] ?? '').trim() }));
  });

  const s = $derived(row ? normalizeStatus(row.status) : '');
  const visitorApproval = $derived.by(() => {
    if (!row) return '';
    const v = String(row.visitorApproved ?? '').trim();
    if (v === 'yes') return 'เข้าได้';
    if (v === 'no') return 'เข้าไม่ได้';
    return '';
  });
  const visitorApprovalTone = $derived.by(() => {
    const v = String(row?.visitorApproved ?? '').trim();
    if (v === 'yes') return 'success';
    if (v === 'no') return 'danger';
    return 'warning';
  });
  const totalPersons = $derived(Number(row?.totalPersons) || (Number(row?.visitorCount) || 0) + 1);
  const adults = $derived(Number(row?.adultCount) || (Number(row?.visitorCount) || 0));
  const kids5_8 = $derived(Number(row?.child5to8Count) || 0);
  const kidsUnder5 = $derived(Number(row?.childUnder5Count) || 0);

  const hero = $derived.by(() => {
    switch (s) {
      case 'ไม่อนุมัติ':
        return { grad: 'from-red-500/15 via-red-500/5 to-transparent', ring: 'ring-red-200 dark:ring-red-900/60', dot: 'bg-red-500' };
      case 'ยกเลิก':
        return { grad: 'from-slate-500/15 via-slate-500/5 to-transparent', ring: 'ring-slate-200 dark:ring-slate-700', dot: 'bg-slate-400' };
      case 'เสร็จสิ้น':
        return { grad: 'from-emerald-500/15 via-emerald-500/5 to-transparent', ring: 'ring-emerald-200 dark:ring-emerald-900/60', dot: 'bg-emerald-500' };
      case 'ชำระแล้ว':
        return { grad: 'from-blue-600/15 via-blue-600/5 to-transparent', ring: 'ring-blue-200 dark:ring-blue-900/60', dot: 'bg-blue-600' };
      case 'รอชำระเงิน':
        return { grad: 'from-blue-500/15 via-blue-500/5 to-transparent', ring: 'ring-blue-200 dark:ring-blue-900/60', dot: 'bg-blue-500' };
      case 'รอตรวจสอบวินัย':
        return { grad: 'from-orange-500/15 via-orange-500/5 to-transparent', ring: 'ring-orange-200 dark:ring-orange-900/60', dot: 'bg-orange-500' };
      default:
        return { grad: 'from-amber-500/15 via-amber-500/5 to-transparent', ring: 'ring-amber-200 dark:ring-amber-900/60', dot: 'bg-amber-500' };
    }
  });

  function initials(name: string | undefined): string {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  }

  async function copyPaymentPayload(): Promise<void> {
    try {
      await navigator.clipboard.writeText(paymentPayload);
    } catch {
      /* ignore */
    }
  }

  function downloadPaymentQr(): void {
    if (!paymentQr) return;
    const a = document.createElement('a');
    a.href = paymentQr;
    a.download = `promptpay-${String(row?.ref ?? 'qr').replace(/[^\w-]+/g, '_')}.png`;
    a.click();
  }
</script>

<Modal
  {open}
  title={row ? `รายละเอียดการจอง · ${row.ref}` : 'รายละเอียดการจอง'}
  onclose={onclose}
  width="max-w-3xl"
  accent={s === 'ไม่อนุมัติ' || s === 'ยกเลิก' ? 'red' : s === 'เสร็จสิ้น' ? 'emerald' : 'blue'}
  icon={ReceiptText}
  subtitle={row ? `สร้างเมื่อ ${formatDateTimeThai(row.createdAt)}` : ''}
>
  {#if row}
    <div class="flex flex-col gap-5">
      <div class="rounded-2xl bg-gradient-to-br {hero.grad} p-4 ring-1 {hero.ring}">
        <div class="flex flex-wrap items-center gap-2">
          <span class="relative inline-flex h-2.5 w-2.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full {hero.dot} opacity-60"></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full {hero.dot}"></span>
          </span>
          <Badge label={s} tone={s === 'ไม่อนุมัติ' || s === 'ยกเลิก' ? 'danger' : s === 'เสร็จสิ้น' ? 'success' : 'info'} />
          {#if row._archived}<Badge label="ย้อนหลัง" tone="default" />{/if}
          {#if row.source}<Badge label={row.source === 'admin' ? 'บันทึกผ่านระบบ' : 'ออนไลน์'} tone="default" />{/if}
          <span class="ml-auto text-xs text-slate-500 dark:text-slate-400">โดย {row.createdBy ?? '—'}</span>
        </div>
        <div class="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div class="font-mono text-xs text-slate-500 dark:text-slate-400">REF</div>
            <div class="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{row.ref}</div>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-500 dark:text-slate-400">ยอดชำระรวม</div>
            <div class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{formatBaht(row.total)}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
              <Building2 class="h-4 w-4" />
            </div>
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้ต้องขัง</h3>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-sm font-bold text-white">
              {initials(row.prisonerName)}
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{row.prisonerName ?? '—'}</div>
              <div class="flex items-center gap-1 text-xs text-slate-400">
                <Hash class="h-3 w-3" />
                <span>{row.prisonerId ?? ''}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <Building2 class="h-3.5 w-3.5 text-slate-400" />
            ปีกที่ดูแล: <span class="font-semibold">{row.wing ?? '—'}</span>
          </div>
        </section>

        <section class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <User class="h-4 w-4" />
              </div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้เยี่ยมหลัก</h3>
            </div>
            {#if visitorApproval}
              <Badge label={visitorApproval} tone={visitorApprovalTone} />
            {/if}
          </div>
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
              {initials(row.visitorName)}
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{row.visitorName ?? '—'}</div>
              {#if row.visitorId}<div class="truncate text-xs text-slate-400">เลขบัตร: {row.visitorId}</div>{/if}
            </div>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {#if row.visitorPhone}
              <span class="inline-flex items-center gap-1">
                <Phone class="h-3.5 w-3.5 text-slate-400" /> {row.visitorPhone}
              </span>
            {/if}
            <span class="inline-flex items-center gap-1">
              <UsersRound class="h-3.5 w-3.5 text-slate-400" /> {row.relation ?? '—'}
            </span>
            {#if row.religion}
              <span class="inline-flex items-center gap-1">
                <Info class="h-3.5 w-3.5 text-slate-400" /> {row.religion}
              </span>
            {/if}
          </div>
          {#if row.allergy && row.allergy !== '-'}
            <div class="rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              ⚠️ แพ้อาหาร: {row.allergy}
            </div>
          {/if}
        </section>
      </div>

      {#if extras.length > 0}
        <section class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <UsersRound class="h-4 w-4" />
            </div>
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ผู้เยี่ยมร่วม ({extras.length} คน)</h3>
          </div>
          <div class="flex flex-col gap-2">
            {#each extras as ex, i (i)}
              <div class="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-500 text-xs font-bold text-white">
                  {initials(ex.name)}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{ex.name}</div>
                  <div class="flex flex-wrap gap-x-3 text-xs text-slate-400">
                    {#if ex.id}<span>เลขบัตร: {ex.id}</span>{/if}
                    {#if ex.relation}<span>({ex.relation})</span>{/if}
                  </div>
                </div>
                {#if ex.approved}
                  <Badge label={ex.approved === 'yes' ? 'เข้าได้' : 'เข้าไม่ได้'} tone={ex.approved === 'yes' ? 'success' : 'danger'} />
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <section class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <CalendarDays class="h-4 w-4" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ข้อมูลการเยี่ยม</h3>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div class="flex items-center gap-1 text-[11px] text-slate-400">
              <CalendarDays class="h-3 w-3" /> วันที่เข้างาน
            </div>
            <div class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{visitDateLabel(row.visitDate, row.visitDateISO)}</div>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div class="flex items-center gap-1 text-[11px] text-slate-400">
              <UsersRound class="h-3 w-3" /> จำนวนคน
            </div>
            <div class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{formatNumber(row.visitorCount)} คน · {totalPersons} ท่าน</div>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div class="flex items-center gap-1 text-[11px] text-slate-400">
              <User class="h-3 w-3" /> ผู้ใหญ่
            </div>
            <div class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{formatNumber(adults)} คน</div>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div class="flex items-center gap-1 text-[11px] text-slate-400">
              <Baby class="h-3 w-3" /> เด็ก 5-8 ปี
            </div>
            <div class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{formatNumber(kids5_8)} คน</div>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div class="flex items-center gap-1 text-[11px] text-slate-400">
              <Baby class="h-3 w-3" /> เด็ก &lt;5 ปี
            </div>
            <div class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{formatNumber(kidsUnder5)} คน</div>
          </div>
          <div class="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/60">
            <div class="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <Banknote class="h-3 w-3" /> ยอดรวม
            </div>
            <div class="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatBaht(row.total)}</div>
          </div>
        </div>
      </section>

      {#if s === 'รอชำระเงิน'}
        <section class="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-slate-900">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <QrCode class="h-4 w-4" />
            </div>
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">ชำระเงินด้วย PromptPay</h3>
            <span class="ml-auto inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Banknote class="h-3.5 w-3.5" /> {formatBaht(row.total)}
            </span>
          </div>
          <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div class="shrink-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700">
              {#if paymentQr}
                <img src={paymentQr} alt="PromptPay QR สำหรับชำระเงิน" width="280" height="280" class="h-44 w-44 object-contain md:h-52 md:w-52" />
              {:else}
                <div class="flex h-44 w-44 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                  <span class="h-7 w-7 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600"></span>
                </div>
              {/if}
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-2.5">
              <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                ให้ผู้เยี่ยมชมสแกน QR นี้เพื่อชำระเงินตามยอดรวมการจอง แล้วอัปโหลดสลิปเพื่อให้เจ้าหน้าที่ยืนยันการชำระเงิน
              </p>
              {#if paymentPayload}
                <div class="flex items-start gap-2">
                  <code class="min-w-0 flex-1 break-all rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">{paymentPayload}</code>
                  <button
                    class="shrink-0 rounded-xl border border-slate-300 p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                    onclick={copyPaymentPayload}
                    aria-label="คัดลอก payload"
                  >
                    <ClipboardCopy class="h-4 w-4" />
                  </button>
                </div>
              {/if}
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onclick={downloadPaymentQr} disabled={!paymentQr}>
                  <Download class="h-4 w-4" /> ดาวน์โหลด QR
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => (location.href = '#/promptpay')}
                >
                  ตั้งค่า QR
                </Button>
              </div>
            </div>
          </div>
        </section>
      {/if}

      {#if row.cancelReason}
        <section class="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div class="font-semibold">เหตุผลการปฏิเสธ/ยกเลิก</div>
            <div class="mt-0.5">{row.cancelReason}</div>
          </div>
        </section>
      {/if}

      {#if canViewSlip && hasSlip}
        <section class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <CreditCard class="h-4 w-4" />
            </div>
            <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">สลิปชำระเงิน</h3>
          </div>
          {#if slipLoading}
            <div class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900">
              <span class="h-8 w-8 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600"></span>
              <div class="text-sm font-medium text-slate-500 dark:text-slate-400">กำลังโหลดสลิปชำระเงิน...</div>
            </div>
          {:else}
            <div class="flex flex-col items-center gap-3">
              <button
                onclick={() => (slipViewerOpen = true)}
                class="group max-w-full rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm transition hover:shadow-xl dark:border-slate-700"
                aria-label="ขยายสลิปชำระเงิน"
              >
                <img
                  src={slipUrl}
                  alt="สลิปชำระเงิน"
                  class="max-h-80 w-auto cursor-zoom-in rounded-xl object-contain"
                />
              </button>
              <p class="text-center text-[11px] text-slate-400">คลิกเพื่อขยายสลิปขนาดเต็ม</p>
            </div>
            {#if slipVerifying}
              <div class="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600"></span>
                กำลังตรวจสอบสลิปอัตโนมัติ...
              </div>
            {/if}
            <SlipVerifyPanel
              ref={row.ref}
              status={String(row.slip_verify_status ?? '')}
              json={String(row.slip_verify_json ?? '')}
            />
          {/if}
        </section>
      {/if}

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-[11px] text-slate-400 dark:border-slate-800">
        <span class="inline-flex items-center gap-1"><Clock3 class="h-3 w-3" /> สร้าง: {formatDateTimeThai(row.createdAt)}</span>
        <span class="inline-flex items-center gap-1"><Clock3 class="h-3 w-3" /> แก้ไข: {formatDateTimeThai(row.updatedAt)}</span>
        {#if row.version}
          <span class="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">เวอร์ชัน {row.version}</span>
        {/if}
      </div>
    </div>
  {/if}
  {#snippet footer()}
    <Button variant="outline" onclick={onclose}>ปิด</Button>
  {/snippet}
</Modal>

<SlipViewerModal open={slipViewerOpen} slipUrl={slipUrl} ref={row?.ref} onclose={() => (slipViewerOpen = false)} />
