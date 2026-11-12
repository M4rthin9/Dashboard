<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { QrCode, Camera, Square, RefreshCw, ScanLine, CheckCircle2, CircleAlert, Clock3, Users, Utensils, Search, ChevronRight, CalendarDays, ShieldCheck, UserCheck, ArrowRight, Loader2 } from '@lucide/svelte';
  import { checkVisitorEntry, checkInVisitor, getAttendance, type EntryCheck, type AttendanceRecord, type AttendanceTable } from '../lib/api/attendance';
  import { decodeQrFrame } from '../lib/utils/qrScanner';
  import { formatBaht, formatNumber, visitDateLabel, prisonersOf } from '../lib/utils/format';
  import { bookingPool, businessDate } from '../lib/utils/management';

  import '../lib/styles/checkin.css';

  let clock = $state(new Date());
  const clockText = $derived(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(clock));
  let qr = $state('');
  let verifiedQr = '';
  let entry = $state<EntryCheck | null>(null);
  let rows = $state<AttendanceRecord[]>([]);
  let tables = $state<AttendanceTable[]>([]);
  let lastUpdated = $state('');
  let displayedDate = '';
  let tableSearch = $state('');
  let tablePool = $state('all');
  let tableStatus = $state('active');
  const pooledTables = $derived(tables.filter(table => tablePool === 'all' || table.bookingType === tablePool));
  const activeTables = $derived(pooledTables.filter(table => table.active));
  const visibleTables = $derived(pooledTables.filter(table => {
    const statusMatches = tableStatus === 'all' || (tableStatus === 'inactive' ? !table.active : table.active && (tableStatus === 'active' || table.registrationStatus === tableStatus));
    const search = tableSearch.trim().toLocaleLowerCase();
    return statusMatches && (!search || [table.ref, table.visitorName, table.visitorPhone, table.prisonerName, ...table.guests.map(guest => guest.name)].join(' ').toLocaleLowerCase().includes(search));
  }));
  const metrics = $derived([
    { label: 'โต๊ะที่มีการจอง', value: activeTables.length, icon: Utensils, color: '#9d7e46', bg: '#f5f0e7', note: 'การจองที่ยังมีผลในวันที่เลือก' },
    { label: 'ลงทะเบียนครบแล้ว', value: activeTables.filter(table => table.registrationStatus === 'registered').length, icon: CheckCircle2, color: '#218060', bg: '#edf7f1', note: 'ผู้เข้าร่วมมาครบทุกคน' },
    { label: 'ลงทะเบียนบางคน', value: activeTables.filter(table => table.registrationStatus === 'partial').length, icon: Users, color: '#ae7b24', bg: '#fff6e5', note: 'ยังรอผู้เข้าร่วมเพิ่มเติม' },
    { label: 'ยังไม่ลงทะเบียน', value: activeTables.filter(table => table.registrationStatus === 'not_registered').length, icon: Clock3, color: '#577d9b', bg: '#edf3f8', note: 'ยังไม่มีผู้เข้าร่วมเช็กอิน' },
  ]);
  const registrationLabels = { not_registered: 'ยังไม่ลงทะเบียน', partial: 'ลงทะเบียนบางคน', registered: 'ลงทะเบียนครบแล้ว' };
  let today = $state(businessDate());
  let date = $state(businessDate());
  const viewingToday = $derived(date === today);
  let busy = $state(false);
  let savingGuestKey = $state('');
  let loading = $state(false);
  let error = $state('');
  let listError = $state('');
  let notice = $state('');
  let scanning = $state(false);
  let openingCamera = $state(false);
  let video = $state<HTMLVideoElement>();
  let resultPanel = $state<HTMLDivElement>();
  let stream: MediaStream | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let scanSession = 0;
  let listRequest = 0;
  const time = (value: string) => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  onMount(() => {
    const clockTick = setInterval(() => { clock = new Date(); }, 1000);
    void load();
    const rollover = setInterval(() => {
      const current = businessDate();
      if (current === today) { if (viewingToday) void load(true); return; }
      const previous = today;
      today = current;
      if (date === previous) { date = current; changeDate(); }
      else { stopCamera(); entry = null; }
    }, 30000);
    return () => { clearInterval(clockTick); clearInterval(rollover); stopCamera(); };
  });

  function changeDate() {
    stopCamera();
    entry = null;
    qr = '';
    error = '';
    notice = '';
    void load();
  }

  async function load(background = false) {
    if (background && (busy || loading || document.hidden)) return;
    const request = ++listRequest;
    const requestedDate = date;
    loading = true;
    listError = '';
    // Keep the current day's overview stable during refresh and successful check-in.
    if (displayedDate !== requestedDate) { rows = []; tables = []; lastUpdated = ''; }
    try {
      const result = await getAttendance(requestedDate);
      if (request === listRequest) { rows = result.rows; tables = result.tables; lastUpdated = result.asOf; displayedDate = requestedDate; }
    } catch (e) { if (request === listRequest) listError = e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ'; }
    finally { if (request === listRequest) loading = false; }
  }

  function stopCamera() {
    scanSession++;
    scanning = false;
    openingCamera = false;
    clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    stream = undefined;
    if (video) video.srcObject = null;
  }

  async function startCamera() {
    if (!viewingToday || busy || openingCamera || scanning) return;
    stopCamera();
    openingCamera = true;
    error = '';
    notice = '';
    qr = '';
    verifiedQr = '';
    entry = null;
    const session = scanSession;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('อุปกรณ์นี้เปิดกล้องไม่ได้ กรุณาใช้เครื่องสแกน QR หรือวางข้อความ QR');
      const opened = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (session !== scanSession) { opened.getTracks().forEach(track => track.stop()); return; }
      stream = opened;
      const cameraVideo = video;
      if (!cameraVideo) throw new Error('ไม่พบหน้าจอกล้อง กรุณาเปิดกล้องใหม่');
      scanning = true;
      cameraVideo.srcObject = opened;
      await cameraVideo.play();
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('ไม่สามารถอ่านภาพจากกล้องได้');
      const scan = async () => {
        if (session !== scanSession) return;
        try {
          if (cameraVideo.readyState >= 2 && cameraVideo.videoWidth) {
            const scale = Math.min(1, 800 / cameraVideo.videoWidth);
            canvas.width = Math.round(cameraVideo.videoWidth * scale);
            canvas.height = Math.round(cameraVideo.videoHeight * scale);
            context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
            const value = await decodeQrFrame(context.getImageData(0, 0, canvas.width, canvas.height));
            if (session !== scanSession) return;
            if (value) { qr = value; stopCamera(); await verify(); return; }
          }
          timer = setTimeout(() => { void scan(); }, 200);
        } catch (e) { if (session !== scanSession) return; stopCamera(); error = e instanceof Error ? e.message : 'อ่าน QR ไม่สำเร็จ'; }
      };
      void scan();
    } catch (e) {
      if (session !== scanSession) return;
      stopCamera();
      error = e instanceof Error ? e.message : 'เปิดกล้องไม่สำเร็จ กรุณาอนุญาตการใช้กล้อง';
    } finally { if (session === scanSession) openingCamera = false; }
  }

  async function revealResult() {
    await tick();
    if (!resultPanel || !entry) return;
    const bounds = resultPanel.getBoundingClientRect();
    if (bounds.top < 0 || bounds.top + Math.min(bounds.height, 120) > window.innerHeight) {
      resultPanel.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    resultPanel.focus({ preventScroll: true });
  }

  async function verify() {
    if (busy || !viewingToday || !qr.trim()) return;
    stopCamera();
    busy = true;
    entry = null;
    error = '';
    notice = '';
    const submitted = qr.trim();
    const submittedDate = date;
    try {
      const result = await checkVisitorEntry(submitted);
      if (date !== submittedDate || businessDate() !== submittedDate) return;
      entry = result.entry;
      verifiedQr = submitted;
      await revealResult();
    }
    catch (e) { error = e instanceof Error ? e.message : 'ตรวจสอบไม่สำเร็จ'; }
    finally { busy = false; }
  }

  async function checkIn(guestKey: string) {
    if (busy || !viewingToday || !entry?.allowed) return;
    busy = true;
    savingGuestKey = guestKey;
    error = '';
    notice = '';
    const submittedDate = date;
    try {
      const result = await checkInVisitor(verifiedQr, guestKey);
      if (date !== submittedDate || businessDate() !== submittedDate) return;
      entry = result.entry;
      notice = result.alreadyCheckedIn ? 'ผู้เข้าร่วมนี้ลงทะเบียนเข้างานแล้ว' : 'บันทึกการเข้างานแล้ว';
      // The check-in is already saved. Refresh the overview without blocking the next guest.
      void load();
    } catch (e) { entry = null; error = e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ กรุณาสแกนใหม่'; }
    finally { busy = false; savingGuestKey = ''; }
  }
</script>

<div class="attendance-page">
  <section class="att-hero" aria-labelledby="checkin-title">
    <div><p class="att-eyebrow"><ScanLine size={15} /> SMART CHECK-IN · VISITOR REGISTRATION</p><h1 id="checkin-title">ลงทะเบียนเข้าร่วมกิจกรรม</h1><p class="att-hero-description">ตรวจสอบการจอง ยืนยันสิทธิ์ และดูแลการต้อนรับในจุดเดียว<br />ทัณฑสถานบำบัดพิเศษกลาง</p></div>
    <div class="att-clock"><time datetime={clock.toISOString()}>{clockText}</time><p>{visitDateLabel(today)}</p><small>เวลาประเทศไทย · Asia/Bangkok</small></div>
  </section>

  <div class="att-daybar">
    <div class="att-day-controls"><label class="att-date-label"><CalendarDays size={16} /><span>วันที่ให้บริการ</span><input type="date" class="att-input" bind:value={date} onchange={changeDate} disabled={busy} /></label><button class="att-action quiet" onclick={() => { date = businessDate(); today = date; changeDate(); }} disabled={busy}>วันนี้</button><button class="att-action" onclick={() => load()} disabled={busy || loading} aria-busy={loading} aria-label="โหลดข้อมูลการลงทะเบียนล่าสุด"><RefreshCw size={14} class={loading ? 'att-spinner' : ''} /> อัปเดตข้อมูล</button></div>
    <span class="att-live" class:current={!!lastUpdated && !listError} class:warning={!!listError}>{listError ? 'รับข้อมูลล่าสุดไม่สำเร็จ' : loading ? 'กำลังอัปเดตข้อมูล' : lastUpdated ? `ข้อมูลล่าสุด ${time(lastUpdated)}` : 'รอรับข้อมูล'}</span>
  </div>
  {#if !viewingToday}<p class="att-history"><Clock3 size={15} class="inline" /> กำลังดูข้อมูลวันที่ {visitDateLabel(date)} · เลือก “วันนี้” เพื่อสแกนและลงทะเบียนเข้าร่วม</p>{/if}
  {#if listError}<p role="alert" class="att-alert error">โหลดข้อมูลล่าสุดไม่สำเร็จ: {listError} กรุณาอัปเดตข้อมูลก่อนตรวจสอบ</p>{/if}

  <section class="att-metrics" aria-label="ภาพรวมการลงทะเบียนรายโต๊ะ" aria-busy={loading}>
    {#each metrics as metric (metric.label)}
      {@const Icon = metric.icon}
      <article class="att-metric" style="--metric-color:{metric.color};--metric-bg:{metric.bg}"><div class="att-metric-top"><p>{metric.label}</p><span class="att-metric-icon"><Icon size={17} /></span></div><div class="att-metric-value"><strong>{lastUpdated ? formatNumber(metric.value) : '—'}</strong><span>โต๊ะ</span></div><small>{metric.note}</small></article>
    {/each}
  </section>

  {#if viewingToday}
    <section class="att-workstation" id="attendance-scanner" aria-label="จุดสแกนและตรวจสอบสิทธิ์">
      <div class="att-scanner">
        <div class="att-panel-heading"><div><p class="att-eyebrow">SCAN & VERIFY</p><h2>สแกน QR เพื่อเริ่มลงทะเบียน</h2><p>ใช้ QR เข้างานจากหน้าสถานะการจอง</p></div><span class="att-number">01 / 03</span></div>
        <div class="att-viewfinder" class:scanning>
          <video bind:this={video} hidden={!scanning} muted playsinline aria-label="กล้องสแกน QR เข้างาน"></video>
          {#if !scanning}<div class="att-idle"><QrCode size={62} strokeWidth={1.1} /><p>แสดง QR ภายในกรอบสแกน</p><small>รองรับโทรศัพท์และเอกสารที่พิมพ์ QR ไว้</small></div>{/if}
          <div class="att-corners" aria-hidden="true"></div>{#if scanning}<div class="att-scan-line" aria-hidden="true"></div>{/if}
        </div>
        <p class="att-camera-status" class:active={scanning} role="status"><Camera size={12} />{openingCamera ? 'กำลังเปิดกล้อง…' : scanning ? 'กำลังอ่าน QR จากกล้อง' : 'เปิดกล้องเพื่อรับ QR ของผู้เข้าร่วม'}</p>
        {#if openingCamera}<button class="att-action cyan" onclick={stopCamera}><Loader2 size={17} class="att-spinner" /> กำลังเปิดกล้อง · ยกเลิก</button>{:else if scanning}<button class="att-action cyan" onclick={stopCamera}><Square size={16} /> หยุดสแกน</button>{:else}<button class="att-action cyan" onclick={startCamera} disabled={busy}><Camera size={17} />{entry ? 'สแกนผู้เข้าร่วมถัดไป' : 'เปิดกล้องสแกน QR'}<ArrowRight size={15} /></button>{/if}
        <p class="att-scanner-note">ตรวจบัตรประชาชนหรือหนังสือเดินทางให้ตรงกับรายชื่อ<br />ก่อนกดยืนยันลงทะเบียนเข้าร่วม</p>
        <form class="att-manual" onsubmit={(event) => { event.preventDefault(); void verify(); }}><label for="checkin-qr-text">เครื่องสแกนภายนอก / ข้อความจาก QR</label><div class="att-manual-controls"><input id="checkin-qr-text" class="att-input" bind:value={qr} disabled={busy} oninput={() => { entry = null; notice = ''; }} autocomplete="off" placeholder="สแกนหรือวางข้อความ QR ที่นี่" required /><button type="submit" class="att-action" disabled={busy || !qr.trim()} aria-busy={busy && !savingGuestKey} aria-label={busy && !savingGuestKey ? 'กำลังตรวจสอบ QR' : 'ตรวจสอบ QR'}>{#if busy && !savingGuestKey}<Loader2 size={18} class="att-spinner" />{:else}<ChevronRight size={18} />{/if}</button></div></form>
        {#if error}<p role="alert" class="att-alert error">{error}</p>{/if}
      </div>

      <div class="att-panel att-result-panel" aria-live="polite" aria-label="ผลการตรวจสอบการจอง" tabindex="-1" bind:this={resultPanel}>
        {#if entry}
          {@const reservation = entry.reservation}
          {@const isTable = bookingPool(reservation) === 'table'}
          <div class="att-verdict" class:blocked={!entry.allowed}>{#if entry.allowed}<ShieldCheck size={28} />{:else}<CircleAlert size={28} />{/if}<div><h2>{entry.allowed ? 'ตรวจสอบสิทธิ์ผ่าน พร้อมลงทะเบียน' : 'ยังไม่สามารถลงทะเบียนได้'}</h2><p>{entry.allowed ? 'ยืนยันการชำระเงินแล้ว · ตรวจรายชื่อก่อนยืนยันเข้าร่วม' : entry.blockedReason}</p></div></div>
          <div class="att-booking-body">
            <div class="att-feedback" class:has-notice={!!notice}><div><p role="status" class="att-alert success">{#if notice}<CheckCircle2 size={17} />{/if}{notice}</p></div></div>
            <div class="att-booking-title"><div><h3>{entry.ref}</h3><p>{visitDateLabel(reservation.visitDate, reservation.visitDateISO)}</p></div><span class="att-chip">{isTable ? 'จองโต๊ะ · TBL' : 'เยี่ยมผู้ต้องขัง · VIS'}</span></div>
            <div class="att-guest-summary"><span>ผู้ร่วมตามการจอง <strong>{entry.guests.length}</strong> คน</span><span>เข้างานแล้ว <strong>{entry.guests.filter(guest => guest.attendance).length}</strong> คน</span><span>ยังไม่เข้างาน <strong>{entry.guests.filter(guest => !guest.attendance).length}</strong> คน</span></div>
            {#each entry.guests as guest, index (guest.guestKey)}
              <article class="att-guest" class:is-arrived={!!guest.attendance}>
                <div class="att-guest-top"><div class="att-guest-title"><span>{String(index + 1).padStart(2, '0')}</span><div><h4>{guest.name}</h4><small>{guest.main ? 'ผู้จองหลัก' : 'ผู้ร่วมโต๊ะ'}</small></div></div><span class="att-chip" class:green={entry.paymentConfirmed} class:red={!entry.paymentConfirmed && guest.approval === 'no'}>{entry.paymentConfirmed ? 'ยืนยันชำระเงินแล้ว' : guest.approved ? 'อนุมัติแล้ว' : guest.approval === 'no' ? 'ไม่อนุมัติ' : 'รอตรวจสอบ'}</span></div>
                <p class="att-guest-id">เลขบัตรประชาชน / หนังสือเดินทาง<strong>{guest.id || 'ไม่ระบุ'}</strong></p>
                <div class="att-guest-meta"><span>ความสัมพันธ์: {guest.relation || '—'}</span><span>อายุ: {guest.age ? `${guest.age} ปี` : 'ไม่ระบุ'}</span><span>ศาสนา: {guest.religion || '—'}</span><span class="allergy">แพ้อาหาร / ข้อจำกัด: {guest.allergy || '—'}</span></div>
                <div class="att-guest-action"><p class:arrived={!!guest.attendance}>{#if guest.attendance}<CheckCircle2 size={13} />เข้างานแล้ว {time(guest.attendance.checkedInAt)} · {guest.attendance.checkedInBy}{:else}<Clock3 size={13} />ยังไม่ลงทะเบียนเข้าร่วม{/if}</p><button class="att-action success" aria-busy={savingGuestKey === guest.guestKey} disabled={busy || !entry.allowed || !!guest.attendance} onclick={() => checkIn(guest.guestKey)}>{#if savingGuestKey === guest.guestKey}<Loader2 size={15} class="att-spinner" />{:else if guest.attendance}<CheckCircle2 size={15} />{:else}<UserCheck size={15} />{/if}{guest.attendance ? 'ลงทะเบียนแล้ว' : savingGuestKey === guest.guestKey ? 'กำลังบันทึก…' : 'ยืนยันเข้าร่วม'}</button></div>
              </article>
            {/each}
            <details class="att-details"><summary>ข้อมูลการจองฉบับเต็ม · สำหรับตรวจสอบกับรายงานประจำวัน</summary><dl class="att-detail-grid">
              {#each [
                ['เลขอ้างอิง (Ref)', reservation.ref], ['วันที่เข้าร่วม', visitDateLabel(reservation.visitDate, reservation.visitDateISO)], ['สถานะการจอง', reservation.status],
                ['ผู้จองหลัก', reservation.visitorName], ['เลขบัตรประชาชน / หนังสือเดินทาง', reservation.visitorId], ['เบอร์โทรศัพท์', reservation.visitorPhone],
                ['จำนวนผู้ร่วมตามการจอง', `${formatNumber(reservation.visitorCount)} คน`], ['จำนวนคนรวมตามการจอง', `${formatNumber(reservation.totalPersons)} คน`], ['ยอดชำระตามการจอง', formatBaht(reservation.total)],
                ['ผู้ใหญ่', `${formatNumber(reservation.adultCount)} คน`], ['เด็ก 5–8 ปี', `${formatNumber(reservation.child5to8Count)} คน`], ['เด็กอายุต่ำกว่า 5 ปี', `${formatNumber(reservation.childUnder5Count)} คน`],
                ['วันที่จอง', reservation.timestamp || (reservation.createdAt ? time(reservation.createdAt) : '')], ['ผู้สร้างการจอง', reservation.createdBy], ['ช่องทางการจอง', reservation.source], ['แก้ไขล่าสุด', reservation.updatedAt ? time(reservation.updatedAt) : ''],
              ] as [label, value] (label)}<div><dt>{label}</dt><dd>{value || '—'}</dd></div>{/each}
            </dl>{#if !isTable}{#each prisonersOf(reservation) as prisoner, i (i)}<p class="att-table-sub">ผู้ต้องขัง: {prisoner.name || '—'} · เลขประจำตัว {prisoner.id || '—'} · แดน {prisoner.wing || '—'}</p>{/each}{/if}{#if reservation.cancelReason}<p class="att-alert error">{reservation.cancelReason}</p>{/if}</details>
          </div>
        {:else}
          <div class="att-panel-header"><div class="att-panel-heading"><div><p class="att-eyebrow">VERIFY & CHECK IN</p><h2>ตรวจสอบสิทธิ์การเข้าร่วม</h2></div><span class="att-number">02 — 03</span></div></div>
          <div class="att-welcome"><img src="/login-mark.webp" alt="ตราทัณฑสถานบำบัดพิเศษกลาง" width="76" height="76" /><h2>{busy ? 'กำลังตรวจสอบข้อมูลการจอง' : 'พร้อมต้อนรับทุกการมาเยือน'}</h2><p>เมื่อสแกน QR ข้อมูลการจองและสถานะการชำระเงิน<br />จะแสดงที่นี่ เพื่อให้เจ้าหน้าที่ยืนยันการเข้าร่วม</p><div class="att-welcome-steps"><div><span>01</span><strong>สแกน QR</strong><p>รับ QR จากผู้เข้าร่วม</p></div><div><span>02</span><strong>ตรวจสอบสิทธิ์</strong><p>เช็กการชำระเงินและรายชื่อ</p></div><div><span>03</span><strong>ยืนยันเข้าร่วม</strong><p>บันทึกการเข้างานรายคน</p></div></div></div>
          <div class="att-recent"><div class="att-recent-title"><span>การลงทะเบียนล่าสุด</span><span>{lastUpdated ? `${rows.length} คนในวันที่เลือก` : 'รอรับข้อมูล'}</span></div>{#each rows.slice(0, 3) as row (`${row.ref}:${row.guestKey}`)}<div class="att-recent-row"><CheckCircle2 size={16} /><div><strong>{row.guestName}</strong><small>{row.ref} · {row.checkedInBy}</small></div><time datetime={row.checkedInAt}>{new Date(row.checkedInAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })}</time></div>{/each}{#if !rows.length}<p class="att-table-sub">{loading ? 'กำลังโหลดข้อมูล…' : 'ยังไม่มีรายการลงทะเบียนในวันที่เลือก'}</p>{/if}</div>
        {/if}
      </div>
    </section>
  {/if}

  <section class="att-panel" aria-labelledby="table-overview-heading">
    <header class="att-panel-header att-table-heading"><div><p class="att-eyebrow">TABLE OVERVIEW</p><h2 id="table-overview-heading">ภาพรวมการลงทะเบียนรายโต๊ะ</h2><p>{visitDateLabel(date)} · ตรวจสอบโต๊ะที่มาแล้วและยังรอผู้เข้าร่วม</p></div><span class="att-chip">{visibleTables.length} รายการ</span></header>
    <div class="att-panel-toolbar"><label for="table-search">ค้นหาการจอง<div class="relative"><Search size={14} class="absolute left-3 top-5 text-slate-400" /><input id="table-search" class="att-input" style="padding-left:34px" type="search" bind:value={tableSearch} placeholder="เลขอ้างอิง ชื่อ หรือเบอร์โทรศัพท์" /></div></label><label for="table-pool">ประเภทการจอง<select id="table-pool" class="att-select" bind:value={tablePool}><option value="all">ทุกประเภท</option><option value="table">จองโต๊ะ (TBL)</option><option value="prisoner">เยี่ยมผู้ต้องขัง (VIS)</option></select></label><label for="table-status">สถานะลงทะเบียน<select id="table-status" class="att-select" bind:value={tableStatus}><option value="active">การจองที่ยังมีผลทั้งหมด</option><option value="not_registered">ยังไม่ลงทะเบียน</option><option value="partial">ลงทะเบียนบางคน</option><option value="registered">ลงทะเบียนครบแล้ว</option><option value="inactive">ยกเลิก / ไม่อนุมัติ / คืนเงิน</option><option value="all">ทุกรายการ</option></select></label></div>
    <p class="att-table-note"><ShieldCheck size={14} /> ใช้ข้อมูลการชำระเงินล่าสุด รองรับผู้ยืนยันชำระภายหลังและผู้มาถึงช้า โดยไม่ต้องส่งรายงานเดิมใหม่</p>
    <div class="att-table-wrap att-overview-wrap"><table class="att-table att-overview-table"><thead><tr><th scope="col">โต๊ะ / เลขอ้างอิง</th><th scope="col">ผู้จอง / ผู้ร่วมโต๊ะ</th><th scope="col">สถานะการชำระเงิน</th><th scope="col">การลงทะเบียน</th><th scope="col">เข้างาน / จำนวนคน</th></tr></thead><tbody>
      {#each visibleTables as table (table.ref)}
        <tr><td data-label="โต๊ะ / เลขอ้างอิง"><p class="att-table-ref">{table.ref}</p><p class="att-table-sub">{table.bookingType === 'table' ? 'จองโต๊ะ · TBL' : 'เยี่ยมผู้ต้องขัง · VIS'}</p>{#if table.prisonerName}<p class="att-table-sub">{table.prisonerName}</p>{/if}</td><td data-label="ผู้จอง / ผู้ร่วมโต๊ะ"><p class="att-table-name">{table.visitorName || '—'}</p><p class="att-table-sub">{table.visitorPhone || '—'}</p><details class="att-details"><summary>ดูรายชื่อผู้ร่วมโต๊ะ</summary><ul>{#each table.guests as guest (guest.guestKey)}<li>{guest.name} · {guest.checkedInAt ? 'เข้างานแล้ว' : table.paymentConfirmed ? 'ยังไม่เข้างาน' : 'รอยืนยันการชำระเงิน'}{#if guest.checkedInAt}<small>{time(guest.checkedInAt)} · {guest.checkedInBy}</small>{/if}</li>{/each}</ul></details></td><td data-label="สถานะการชำระเงิน"><p class:att-payment-confirmed={table.paymentConfirmed}>{table.paymentConfirmed ? 'ยืนยันชำระเงินแล้ว' : table.paymentStatus === 'ชำระแล้ว' ? 'รอฝ่ายการเงินยืนยันสลิป' : table.paymentStatus}</p><p class="att-table-sub">{formatBaht(table.total)}</p>{#if table.blockedReason}<p class="att-payment-blocked">{table.blockedReason}</p>{/if}</td><td data-label="การลงทะเบียน"><span class="att-chip" class:green={table.registrationStatus === 'registered'} class:amber={table.registrationStatus === 'partial'} class:gray={table.registrationStatus === 'not_registered'}>{#if table.registrationStatus === 'registered'}<CheckCircle2 size={11} />{:else}<Clock3 size={11} />{/if}{registrationLabels[table.registrationStatus]}</span>{#if !table.active}<p class="att-payment-blocked">รายการไม่มีผลแล้ว</p>{/if}</td><td data-label="เข้างาน / จำนวนคน"><p class="att-table-count">{table.checkedInCount}<span class="att-table-sub"> / {table.expectedCount} คน</span></p><progress class="att-progress" max={Math.max(1, table.expectedCount)} value={Math.min(table.checkedInCount, table.expectedCount)} aria-label={`การเข้างาน ${table.ref}`}></progress><p class="att-table-sub">ยังไม่เข้างาน {table.remainingCount} คน</p></td></tr>
      {/each}
    </tbody></table></div>
    {#if loading && !lastUpdated}<p role="status" class="att-empty">กำลังโหลดข้อมูลการลงทะเบียน…</p>{:else if !listError && !visibleTables.length}<p class="att-empty">ไม่พบการจองตามวันที่และตัวกรองที่เลือก</p>{/if}
    <div class="att-table-footer"><span>{lastUpdated ? `อัปเดต ${time(lastUpdated)}` : 'ยังไม่ได้รับข้อมูลล่าสุด'}</span><span>{viewingToday ? 'อัปเดตอัตโนมัติประมาณทุก 30 วินาทีขณะเปิดหน้า' : 'ข้อมูลย้อนหลัง · สำหรับตรวจสอบเท่านั้น'}</span></div>
  </section>

  <details class="att-panel att-audit"><summary><span>บันทึกการเข้างานรายบุคคล</span><small>{rows.length} รายการ · {visitDateLabel(date)}</small></summary><div class="att-table-wrap"><table class="att-table"><thead><tr><th scope="col">เลขอ้างอิง</th><th scope="col">ผู้เข้าร่วม</th><th scope="col">เวลาเข้างาน</th><th scope="col">เจ้าหน้าที่</th></tr></thead><tbody>{#each rows as row (`${row.ref}:${row.guestKey}`)}<tr><td class="att-table-ref">{row.ref}</td><td>{row.guestName}</td><td>{time(row.checkedInAt)}</td><td>{row.checkedInBy}</td></tr>{/each}</tbody></table></div>{#if !loading && !listError && !rows.length}<p class="att-empty">ยังไม่มีผู้ลงทะเบียนเข้างานในวันที่เลือก</p>{/if}</details>
</div>
