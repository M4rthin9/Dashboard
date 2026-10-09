<script lang="ts">
  import PushSubscribersCard from '../lib/components/settings/PushSubscribersCard.svelte';
  import { onMount } from 'svelte';
  import { Bell, RefreshCw, Send } from '@lucide/svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Modal from '../lib/components/ui/Modal.svelte';
  import { getPushAnnouncements, sendPushAnnouncement, type PushAnnouncement } from '../lib/api/endpoints';

  const destinations = [
    { value: '/', label: 'หน้าแรก' },
    { value: '/#/table-booking', label: 'จองโต๊ะสำหรับบุคคลและองค์กรภายนอก (TBL)' },
    { value: '/#/booking', label: 'จองโต๊ะกับคนที่คุณคิดถึง (VIS)' },
  ];
  let subject = $state('');
  let body = $state('');
  let url = $state('/');
  let recipients = $state(0);
  let pushEnabled = $state(false);
  let rows = $state<PushAnnouncement[]>([]);
  let loading = $state(true);
  let ready = $state(false);
  let sending = $state(false);
  let error = $state('');
  let notice = $state('');
  let draft = $state<Pick<PushAnnouncement, 'id' | 'subject' | 'body' | 'url'> | null>(null);
  let confirm = $state(false);
  const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
  const valid = $derived(subject.trim().length > 0 && subject.trim().length <= 100 && body.trim().length > 0 && body.trim().length <= 500);
  const destinationLabel = (value: string) => destinations.find((d) => d.value === value)?.label ?? 'หน้าแรก';
  const dateLabel = (value: string) => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  async function load(): Promise<void> {
    loading = true;
    error = '';
    try {
      const data = await getPushAnnouncements();
      recipients = data.recipients;
      pushEnabled = data.pushEnabled;
      rows = data.rows;
      ready = true;
    } catch (e) {
      ready = false;
      error = e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ';
    } finally { loading = false; }
  }
  onMount(() => { void load(); });

  function preview(): void {
    if (!valid || !ready || !pushEnabled || recipients === 0 || sending) return;
    const message = { subject: subject.trim(), body: body.trim(), url };
    // Keep the same ID after a timeout; a retry cannot create a second broadcast.
    if (!draft || draft.subject !== message.subject || draft.body !== message.body || draft.url !== message.url) {
      draft = { id: `ANN-${crypto.randomUUID()}`, ...message };
    }
    confirm = true;
  }

  async function send(): Promise<void> {
    if (!draft || sending) return;
    sending = true;
    error = '';
    notice = '';
    try {
      const result = await sendPushAnnouncement(draft);
      confirm = false;
      subject = '';
      body = '';
      draft = null;
      notice = result.deliveryStarted
        ? 'บันทึกข้อความและเริ่มส่งแล้ว ตรวจสอบผลการส่งได้ในประวัติ'
        : 'บันทึกข้อความแล้ว ระบบยังรอเริ่มส่ง กด “ดำเนินการส่งต่อ” ในประวัติเพื่อลองอีกครั้ง';
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : 'ส่งไม่สำเร็จ กรุณาลองอีกครั้ง';
    } finally { sending = false; }
  }

  async function resume(row: PushAnnouncement): Promise<void> {
    if (sending) return;
    sending = true;
    error = '';
    try {
      const result = await sendPushAnnouncement(row);
      notice = result.deliveryStarted ? 'เริ่มดำเนินการส่งต่อแล้ว' : 'ระบบยังรอเริ่มส่ง กรุณาลองอีกครั้ง';
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : 'ดำเนินการส่งต่อไม่สำเร็จ';
    } finally { sending = false; }
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-white"><Bell class="h-6 w-6" />ส่งแจ้งเตือน</h1>
      <p class="mt-1 text-sm text-slate-500">ส่งข่าวสารถึงลูกค้าที่สมัครรับการแจ้งเตือนผ่านเว็บไซต์</p>
    </div>
    <Button variant="outline" onclick={() => { void load(); }} disabled={loading || sending}><RefreshCw class="h-4 w-4" />{loading ? 'กำลังโหลด...' : 'รีเฟรช'}</Button>
  </div>

  {#if error}<div role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>{/if}
  {#if notice}<div role="status" class="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{notice}</div>{/if}

  <Card>
    <p class="text-sm text-slate-500">ผู้สมัครรับการแจ้งเตือน</p>
    <p class="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">{ready ? recipients.toLocaleString('th-TH') : '—'} <span class="text-base font-normal">เบราว์เซอร์</span></p>
    <p class="mt-2 text-sm text-slate-500">นับตามเบราว์เซอร์ที่สมัคร ลูกค้าหนึ่งคนอาจสมัครจากหลายอุปกรณ์</p>
    {#if ready && !pushEnabled}<p class="mt-2 text-sm text-amber-700">ระบบส่งการแจ้งเตือนยังไม่เปิดใช้งาน</p>{/if}
    {#if ready && recipients === 0}<p class="mt-2 text-sm text-amber-700">ยังไม่มีผู้สมัครรับการแจ้งเตือน</p>{/if}
  </Card>

  <div class="grid gap-6 lg:grid-cols-2">
    <Card title="สร้างข้อความแจ้งเตือน">
      <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); preview(); }}>
        <div class="space-y-1.5"><label for="notification-subject" class="text-sm font-medium">หัวข้อ</label><input id="notification-subject" class={fieldClass} bind:value={subject} maxlength="100" required disabled={sending} placeholder="เช่น เปิดจองโต๊ะสำหรับบุคคลภายนอกแล้ว" /><p class="text-right text-xs text-slate-500">{subject.length}/100</p></div>
        <div class="space-y-1.5"><label for="notification-body" class="text-sm font-medium">ข้อความ</label><textarea id="notification-body" class={fieldClass} bind:value={body} maxlength="500" rows="5" required disabled={sending} placeholder="เขียนข่าวสารที่ต้องการแจ้งให้ลูกค้าทราบ"></textarea><p class="text-right text-xs text-slate-500">{body.length}/500</p></div>
        <div class="space-y-1.5"><label for="notification-destination" class="text-sm font-medium">เมื่อแตะการแจ้งเตือน ให้เปิดหน้า</label><select id="notification-destination" class={fieldClass} bind:value={url} disabled={sending}>{#each destinations as d (d.value)}<option value={d.value}>{d.label}</option>{/each}</select></div>
        <Button type="submit" disabled={!valid || !ready || loading || !pushEnabled || recipients === 0 || sending}><Send class="h-4 w-4" />ตรวจสอบก่อนส่ง</Button>
      </form>
    </Card>
    <Card title="ตัวอย่างการแจ้งเตือน">
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800">
        <p class="mb-3 flex items-center gap-2 text-xs text-slate-500"><Bell class="h-4 w-4" />CC Cafe</p>
        <p class="break-words font-semibold">{subject.trim() || 'หัวข้อการแจ้งเตือน'}</p>
        <p class="mt-2 whitespace-pre-wrap break-words text-sm">{body.trim() || 'ข้อความของคุณจะแสดงที่นี่'}</p>
      </div>
      <p class="mt-4 text-sm text-slate-500">หน้าปลายทาง: {destinationLabel(url)}</p>
    </Card>
  </div>

  <Card title="ประวัติการส่งล่าสุด">
    <p class="mb-4 text-sm text-slate-500">“ส่งสำเร็จ” หมายถึงบริการแจ้งเตือนรับข้อความแล้ว ลูกค้าอาจยังไม่ได้เปิดอ่าน กดรีเฟรชเพื่อดูผลล่าสุด</p>
    {#if !loading && ready && rows.length === 0}<p class="text-sm text-slate-500">ยังไม่มีประวัติการส่ง</p>{/if}
    <div class="space-y-3">
      {#each rows as row (row.id)}
        <article class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p class="break-words font-semibold">{row.subject}</p>
          <p class="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{row.body}</p>
          <p class="mt-2 text-xs text-slate-500">{dateLabel(row.createdAt)} · {row.createdBy} · {destinationLabel(row.url)}</p>
          <div class="mt-3 flex flex-wrap gap-3 text-sm"><span>ผู้รับ {row.total}</span><span class="text-emerald-700 dark:text-emerald-400">ส่งสำเร็จ {row.sent}</span><span class="text-amber-700 dark:text-amber-400">รอส่ง {row.pending}</span><span class="text-red-700 dark:text-red-400">ส่งไม่สำเร็จ {row.failed}</span></div>
          {#if row.pending > 0}<div class="mt-3"><Button variant="outline" size="sm" disabled={sending || loading || !pushEnabled} onclick={() => { void resume(row); }}>ดำเนินการส่งต่อ</Button></div>{/if}
        </article>
      {/each}
    </div>
  </Card>
</div>

<Modal open={confirm} title="ยืนยันการส่งแจ้งเตือน" icon={Bell} onclose={() => { if (!sending) confirm = false; }}>
  {#if draft}
    <p class="mb-4 text-sm">ส่งถึงเบราว์เซอร์ที่สมัครรับการแจ้งเตือนประมาณ <strong>{recipients}</strong> รายการ จำนวนผู้รับจริงขึ้นอยู่กับการสมัคร ณ เวลาส่ง</p>
    <p class="break-words font-semibold">{draft.subject}</p>
    <p class="mt-2 whitespace-pre-wrap break-words text-sm">{draft.body}</p>
    <p class="mt-4 text-sm text-slate-500">หน้าปลายทาง: {destinationLabel(draft.url)}</p>
    <p class="mt-3 text-sm text-amber-700 dark:text-amber-400">เมื่อยืนยันแล้ว ข้อความจะเริ่มส่งและไม่สามารถเรียกคืนได้</p>
    {#if error}<p role="alert" class="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>{/if}
  {/if}
  {#snippet footer()}
    <Button variant="outline" disabled={sending} onclick={() => { confirm = false; }}>กลับไปแก้ไข</Button>
    <Button disabled={sending} loading={sending} onclick={() => { void send(); }}><Send class="h-4 w-4" />ยืนยันส่งแจ้งเตือน</Button>
  {/snippet}
</Modal>

<div class="mt-4"><PushSubscribersCard /></div>
