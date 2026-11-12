import type { AttendanceRecord, AttendanceTable } from '../api/attendance';
import { escapeHtml } from './print';
import { prisonersOf, visitDateLabel } from './format';

/** Attendance records who arrived; current bookings determine admission eligibility. */
export function guardAdmissionRows(rows: AttendanceRecord[], tables: AttendanceTable[], date: string) {
  const bookings = new Map(tables.filter(table => table.visitDateISO === date && table.bookingType === 'prisoner' && table.active && table.paymentConfirmed && !table.blockedReason).map(table => [table.ref, table]));
  const seen = new Set<string>();
  return rows.filter(row => row.visitDateISO === date).flatMap(row => {
    const table = bookings.get(row.ref);
    const guest = table?.guests.find(guest => guest.guestKey === row.guestKey);
    const key = `${row.ref}:${row.guestKey}`;
    if (!table || !guest || seen.has(key)) return [];
    seen.add(key);
    return [{ ...row, id: guest.id, relation: guest.relation, prisoners: prisonersOf({ ...table }) }];
  }).sort((a, b) => a.ref.localeCompare(b.ref) || a.checkedInAt.localeCompare(b.checkedInAt) || a.guestKey.localeCompare(b.guestKey));
}

export function buildGuardAdmissionReport(rows: AttendanceRecord[], tables: AttendanceTable[], date: string, asOf: string): string {
  const guests = guardAdmissionRows(rows, tables, date);
  if (!guests.length) throw new Error('ไม่มีผู้เข้าเยี่ยมที่ลงทะเบียนหน้าประตูแล้วและมีสิทธิ์เข้าร่วมในวันที่เลือก');
  const time = (value: string) => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  return `<style>
    @page { size:A4 landscape; margin:10mm; }
    .guard-report { font-size:12px; line-height:1.5; }
    .guard-report h2 { text-align:center; font-size:17px; margin-bottom:10px; }
    .guard-report p { margin:6px 0; }
    .guard-report table { table-layout:fixed; font-size:11px; }
    .guard-report th { text-transform:none; font-size:11px; }
    .guard-report td { height:45px; vertical-align:middle; overflow-wrap:anywhere; }
    .guard-report small { display:block; }
    .guard-report thead { display:table-header-group; }
    .guard-report tr, .guard-signatures { break-inside:avoid; }
    .guard-signatures { display:flex; justify-content:space-around; margin-top:28px; text-align:center; }
  </style><article class="guard-report">
    <h2>ทะเบียนผู้เข้าเยี่ยม (ลงชื่อ) — สำหรับส่วนรักษาการณ์</h2>
    <p><b>เรื่อง</b> ขออนุญาตให้ผู้เข้าเยี่ยมเข้าภายในทัณฑสถาน<br><b>เรียน</b> หัวหน้าส่วนรักษาการณ์</p>
    <p>ด้วยผู้เข้าเยี่ยมตามรายชื่อด้านล่างได้ลงทะเบียน ณ จุดลงทะเบียนหน้าประตูแล้ว ในวันที่ ${escapeHtml(visitDateLabel(date))} จำนวน ${guests.length} คน จาก ${new Set(guests.map(guest => guest.ref)).size} การจอง จึงเรียนมาเพื่อโปรดพิจารณาอนุญาตให้เข้าภายในทัณฑสถาน โดยขอให้เจ้าหน้าที่ตรวจสอบตัวบุคคลและเอกสารประจำตัวอีกครั้งก่อนอนุญาตให้เข้า</p>
    <p>ข้อมูล ณ ${escapeHtml(time(asOf))} (เวลาไทย) · เฉพาะการเยี่ยมผู้ต้องขัง (VIS) ที่ยืนยันชำระเงินแล้วและยังไม่ถูกยกเลิกหรือคืนเงิน</p>
    <table><colgroup><col style="width:4%"><col style="width:12%"><col style="width:24%"><col style="width:21%"><col style="width:13%"><col style="width:13%"><col style="width:13%"></colgroup>
    <thead><tr><th>ลำดับ</th><th>เลขอ้างอิง</th><th>ชื่อผู้เข้าเยี่ยม / เลขประจำตัว</th><th>ผู้ต้องขัง / แดน</th><th>ลงทะเบียนหน้าประตู</th><th>ลงชื่อผู้เข้าเยี่ยม</th><th>เจ้าหน้าที่รักษาการณ์</th></tr></thead>
    <tbody>${guests.map((guest, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(guest.ref)}</td><td>${escapeHtml(guest.guestName)}<small>${escapeHtml(guest.id || 'ไม่ระบุเลขประจำตัว')}</small><small>${escapeHtml(guest.relation || '')}</small></td><td>${guest.prisoners.map(prisoner => `${escapeHtml(prisoner.name)}<small>${escapeHtml(prisoner.id)} · แดน ${escapeHtml(prisoner.wing || '-')}</small>`).join('')}</td><td>${escapeHtml(time(guest.checkedInAt))}<small>${escapeHtml(guest.checkedInBy)}</small></td><td></td><td>☐ ตรวจสอบแล้ว<br>ลงชื่อ ....................<br>เวลา ......................</td></tr>`).join('')}</tbody></table>
    <p>รายชื่อนี้แสดงเฉพาะผู้ที่ลงทะเบียนแล้ว ณ เวลาจัดทำเอกสาร หากมีผู้มาลงทะเบียนเพิ่มเติม ให้จัดพิมพ์รายงานฉบับใหม่</p>
    <div class="guard-signatures"><div>ลงชื่อ ................................................<br>ผู้จัดทำ / เจ้าหน้าที่ลงทะเบียน</div><div>ลงชื่อ ................................................<br>ผู้ตรวจสอบ ส่วนรักษาการณ์</div><div>ลงชื่อ ................................................<br>ผู้พิจารณาอนุญาต</div></div>
  </article>`;
}
