import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Execute pure TypeScript directly using the project's existing compiler.
// Store tests stub reactivity and transport to exercise session concurrency.
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (mocks[file]) return mocks[file];
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = spec => load(path.resolve(path.dirname(file), `${spec}.ts`));
    vm.runInNewContext(source, { module, exports: module.exports, require, Date, Intl, URLSearchParams, console, ...globals }, { filename: file });
    return module.exports;
  }
  return load;
}
const load = loader();
const refunds = load('src/lib/utils/refundEvidence.ts');
test('refund documents validate partial amounts and preserve evidence without claiming payment confirmation', () => {
  const request = { amount: 500.5, reason: 'เหตุผล <script>test</script>', recipient: 'Customer', account: 'Bank 123' };
  assert.equal(refunds.refundRequestError(request, 2000), '');
  for (const amount of [0, -1, 2000.01, NaN, Infinity, 1.234]) assert.notEqual(refunds.refundRequestError({ ...request, amount }, 2000), '');
  assert.notEqual(refunds.refundRequestError({ ...request, reason: ' ' }, 2000), '');
  const evidence = { booking: { ref: 'VIS-12345', visitorName: '<img onerror=alert(1)>', total: 2000, status: 'ชำระแล้ว' }, stages: [{ label: 'การยืนยันชำระเงิน', state: 'ไม่พบการยืนยันชำระเงินจากเจ้าหน้าที่', timestamp: '', actor: '', source: 'ข้อมูลการจอง' }], slipImage: 'data:image/png;base64,AA==' };
  const html = refunds.buildRefundEvidence(evidence, request);
  assert.match(html, /บางส่วน/);
  assert.match(html, /ไม่พบการยืนยันชำระเงินจากเจ้าหน้าที่/);
  assert.match(html, /ไม่ใช่หลักฐานว่าได้คืนเงินแล้ว/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<img onerror=alert/);
  assert.throws(() => refunds.buildRefundEvidence({ ...evidence, slipImage: 'javascript:alert(1)' }, request));
  assert.throws(() => refunds.buildRefundEvidence({ ...evidence, slipImage: '' }, request));
  assert.match(refunds.buildRefundEvidence({ ...evidence, booking: { ...evidence.booking, ref: 'TBL-12345', bookingType: 'table' } }, { ...request, amount: 2000 }), /เต็มจำนวน/);
});
const m = load('src/lib/utils/management.ts');
const financial = load('src/lib/utils/dashboard.ts');
const format = load('src/lib/utils/format.ts');
const booking = (fields = {}) => ({ ref: 'VIS-1', status: 'ชำระแล้ว', visitDateISO: '2026-02-28', total: 100, visitorCount: 3, adultCount: 1, child5to8Count: 1, childUnder5Count: 1, prisonerId: 'P1', ...fields });
test('refunded bookings remain visible to finance and reprints use the saved partial refund', () => {
  const row = booking({ status: 'คืนเงินแล้ว', total: 2000 });
  assert.equal(m.activeBooking(row), false);
  assert.equal(m.scopedReservations([row], 'Finance').length, 1);
  assert.equal(format.STATUS_LABELS[row.status], 'คืนเงินแล้ว');
  const refund = { amount: 500.5, reason: 'Saved refund reason', recipient: 'Saved recipient', account: 'Saved account', timestamp: '2026-10-09 12:00:00', actor: 'finance' };
  const html = refunds.buildRefundEvidence({ booking: row, refund, stages: [], slipImage: 'data:image/png;base64,AA==' }, { amount: 2000, reason: 'New draft', recipient: 'Other recipient', account: '' });
  assert.match(html, /500\.5/);
  assert.match(html, /บางส่วน/);
  assert.match(html, /Saved refund reason/);
  assert.match(html, /บันทึกคืนเงินแล้ว/);
  assert.doesNotMatch(html, /New draft|Other recipient/);
});
const plain = value => JSON.parse(JSON.stringify(value));

const textCatalog = JSON.parse(fs.readFileSync('src/lib/content/frontend-text.json', 'utf8'));
const content = loader({ [path.resolve('src/lib/content/frontend-text.json.ts')]: textCatalog })('src/lib/utils/frontendContent.ts');
test('frontend editor submits only changed keys across languages and explicit resets', () => {
  const original = { th: { homeHeroTitle: 'Original', homeCtaBook: 'Book' }, en: { homeHeroTitle: 'English' } };
  const draft = { th: { homeHeroTitle: 'Changed', homeCtaBook: '' }, en: {} };
  assert.deepEqual(plain(content.contentChanges(original, draft)), { th: { homeHeroTitle: 'Changed', homeCtaBook: '' }, en: { homeHeroTitle: null } });
  assert.deepEqual(plain(content.contentChanges(original, original)), {});
});
test('frontend editor preserves interpolation tokens while accepting punctuation and empty plain labels', () => {
  assert.equal(content.contentError('homePriceBaht', 'th', '{n} บาท'), '');
  assert.equal(content.contentError('homePriceBaht', 'th', 'บาท').length > 0, true);
  assert.equal(content.contentError('homePriceBaht', 'th', '{n} {extra}').length > 0, true);
  assert.equal(content.contentError('homeCtaBook', 'th', ''), '');
  assert.equal(content.contentError('homeCtaBook', 'th', 'x'.repeat(10001)).length > 0, true);
});

test('every dashboard function belongs to one category and frontend editing is restricted to managers', () => {
  const nav = loader({ [path.resolve('src/lib/utils/@lucide/svelte.ts')]: {} })('src/lib/utils/navigation.ts');
  const grouped = nav.navGroups.flatMap(group => group.keys);
  assert.equal(new Set(grouped).size, grouped.length, 'no function occurs in multiple categories');
  assert.deepEqual([...grouped].sort(), plain(nav.navigation.map(item => item.key).sort()));
  assert.equal(nav.menuFor('Superadmin').some(item => item.key === 'frontend_editor'), true);
  for (const role of ['Admin', 'Finance', 'Vinai', 'Tadtel', 'User', undefined]) {
    assert.equal(nav.menuFor(role).some(item => ['frontend_editor', 'booking_settings', 'payment_settings', 'privacy_settings'].includes(item.key)), false);
  }
});

test('date ranges are inclusive, validated and compared against equal previous periods', () => {
  assert.equal(m.rangeDays({ from: '2024-02-28', to: '2024-03-01' }), 3);
  assert.equal(m.validDate('2026-02-30'), false);
  assert.equal(m.rangeDays({ from: '2026-03-01', to: '2026-02-28' }), 0);
  assert.deepEqual(plain(m.previousRange({ from: '2024-03-01', to: '2024-03-03' })), { from: '2024-02-27', to: '2024-02-29' });
  assert.equal(m.comparison(100, 0).percent, null);
  assert.equal(m.businessDate(new Date('2026-10-05T18:00:00Z')), '2026-10-06');
});
test('period metrics exclude terminal and malformed records; neither future months nor pending approvals are paid', () => {
  const rows = [booking(), booking({ ref: 'TBL-1', status: 'รอชำระเงิน', total: 50 }), booking({ ref: 'VIS-2', status: 'ยกเลิก', total: 999 }), booking({ ref: 'VIS-3', status: 'ไม่อนุมัติ' }), booking({ ref: '', total: 999 }), booking({ ref: 'VIS-4', visitDateISO: '2026-03-01' })];
  const selected = m.periodRows(rows, { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(plain(m.periodSummary(selected)), { bookings: 2, paid: 100, pending: 50, booked: 150, completed: 0, visitors: 6 });
  assert.equal(m.periodRows(rows, { from: '2026-02-01', to: '2026-02-28' }, 'table').length, 1);
  assert.equal(m.amount(booking({ total: Infinity })), 0);
  assert.equal(m.amount(booking({ total: -1 })), 0);
});
test('historical chart uses selected dates, fills gaps and separates VIS from TBL', () => {
  const series = m.dailySeries([booking(), booking({ ref: 'TBL-1', status: 'รอชำระเงิน', total: 50 }), booking({ status: 'ยกเลิก' })], { from: '2026-02-27', to: '2026-03-01' });
  assert.deepEqual(plain(series), [{ date: '2026-02-27', prisoner: 0, table: 0, paid: 0, pending: 0 }, { date: '2026-02-28', prisoner: 1, table: 1, paid: 100, pending: 50 }, { date: '2026-03-01', prisoner: 0, table: 0, paid: 0, pending: 0 }]);
  assert.equal(m.dailySeries([], { from: '2020-01-01', to: '2026-01-01' }).length, 0);
  assert.equal(m.bookingPool(booking({ ref: 'TBL-old', bookingType: 'prisoner' })), 'prisoner');
});
test('booking and archive tables are disjoint even for past live bookings and future archived bookings', () => {
  const rows = [booking({ ref: 'VIS-live-old', visitDateISO: '2020-01-01' }), booking({ ref: 'TBL-live-cancelled', status: 'ยกเลิก' }), booking({ ref: 'VIS-archived', _archived: true, visitDateISO: '2030-01-01' }), booking({ ref: 'TBL-archived', _archived: true, status: 'ไม่อนุมัติ' }), booking({ ref: '', _archived: true })];
  assert.deepEqual(plain(m.reservationViewRows(rows, false).map(row => row.ref)), ['VIS-live-old', 'TBL-live-cancelled']);
  assert.deepEqual(plain(m.reservationViewRows(rows, true).map(row => row.ref)), ['VIS-archived', 'TBL-archived']);
});
test('financial and kitchen counts use stored age buckets and actual prisoners; tables have no prisoners', () => {
  const rows = [booking({ extraPrisoners: 'Second|P2|2' }), booking({ ref: 'TBL-1', bookingType: 'table', prisonerId: '', visitorCount: 0, adultCount: 0, child5to8Count: 0, childUnder5Count: 0 }), booking({ ref: 'VIS-2', status: 'ยกเลิก', total: 999 })];
  const summary = financial.computeFinancialSummary(rows);
  assert.equal(summary.bookings, 2);
  assert.equal(summary.prisoners, 2);
  assert.equal(summary.distinctPrisoners, 2);
  assert.equal(summary.visitors, 3);
  assert.equal(summary.people, 5);
  assert.equal(summary.paid, 200);
  assert.deepEqual(plain(format.computeDeptReportData(rows[0])), { adults: 1, kids5_8: 1, kidsUnder5: 1 });
});
test('live queues obey role permissions, exclude archives and expired holds, and sort visits earliest first', () => {
  const now = new Date('2026-02-28T04:00:00Z');
  const rows = [booking({ ref: 'VIS-later', status: 'รอตรวจสอบผู้เข้าร่วม', visitDateISO: '2026-03-02' }), booking({ ref: 'VIS-earlier', status: 'รอตรวจสอบผู้เข้าร่วม' }), booking({ ref: 'VIS-archive', status: 'รอตรวจสอบผู้เข้าร่วม', _archived: true }), booking({ ref: 'TBL-expired', status: 'รอชำระเงิน', holdExpiresAt: '2026-02-28T03:00:00Z' }), booking({ ref: 'VIS-discipline', status: 'รอตรวจสอบวินัย' })];
  assert.equal(m.workQueues(rows, 'User', now).length, 0);
  assert.equal(m.workQueues(rows, 'Tadtel', now).length, 1);
  assert.deepEqual(plain(m.workQueues(rows, 'Tadtel', now)[0].rows.map(row => row.ref)), ['VIS-earlier', 'VIS-later']);
  assert.equal(m.workQueues(rows, 'Finance', now).flatMap(queue => queue.rows).length, 0);
  assert.equal(m.workQueues(rows, 'Vinai', now).length, 1);
  assert.equal(m.workQueues(rows, 'Admin', now).length, 4);
  assert.equal(m.workQueues(rows, 'Superadmin', now).length, 4);
  assert.equal(m.expiredHold(booking({ ref: 'TBL-paid', holdExpiresAt: '2020-01-01' }), now), false);
});
test('account changes clear rows and discard a previous account response; cached loads release inFlight', async () => {
  const auth = { isAuthenticated: true, user: { username: 'first', role: 'Admin' } };
  let resolveFirst;
  let calls = 0;
  const data = new Map();
  const storeLoad = loader({
    [path.resolve('src/lib/store/auth.svelte.ts')]: { auth, API_BASE: 'test-api' },
    [path.resolve('src/lib/store/liveSync.svelte.ts')]: { liveSync: { poke() {} } },
    [path.resolve('src/lib/api/endpoints.ts')]: { getReservationsWithArchive() { calls++; return calls === 1 ? new Promise(resolve => resolveFirst = resolve) : Promise.resolve({ rows: [booking({ ref: 'VIS-second' })] }); } },
  }, { $state: value => value, localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } });
  const store = storeLoad('src/lib/store/reservations.svelte.ts').reservations;
  const first = store.load();
  auth.user.username = 'second';
  await store.load();
  resolveFirst({ rows: [booking({ ref: 'VIS-first' })] });
  await first;
  assert.equal(store.rows[0].ref, 'VIS-second');
  store.rows = [];
  store.loadedAt = null;
  await store.load(); // restore valid account-scoped cache
  await store.refresh(); // must reach the server after a synchronous cache hit
  assert.equal(calls, 3);
  store.includeArchive = false;
  await store.ensureArchive();
  assert.equal(store.includeArchive, true);
  assert.equal(calls, 4);
  await store.ensureArchive(true);
  assert.equal(calls, 5);
  assert.equal(store.daySummary('2026-02-28', [booking({ _archived: true })]).counts['ชำระแล้ว'], 1);
  store.setSession('');
  assert.equal(store.rows.length, 0);
  assert.equal(store.loadedAt, null);
});

test('reservation pages isolate pools and archive partitions, including legacy and explicit booking types', () => {
  const rows = [
    booking({ ref: 'VIS-current' }),
    booking({ ref: 'TBL-current', bookingType: 'table' }),
    booking({ ref: 'TBL-legacy' }),
    booking({ ref: 'TBL-explicit-visit', bookingType: 'prisoner' }),
    booking({ ref: 'VIS-explicit-table', bookingType: 'table' }),
    booking({ ref: 'VIS-history', _archived: true }),
    booking({ ref: 'TBL-history', _archived: true }),
    booking({ ref: '', bookingType: 'table' }),
  ];
  for (const [route, refs] of [
    ['/reservations', ['VIS-current', 'TBL-explicit-visit']],
    ['/reservations/tables', ['TBL-current', 'TBL-legacy', 'VIS-explicit-table']],
    ['/reservations/archive', ['VIS-history']],
    ['/reservations/tables/archive', ['TBL-history']],
  ]) {
    const scope = m.reservationPageScope(route);
    assert.deepEqual(plain(m.reservationViewRows(rows, scope.archived, scope.pool).map(row => row.ref)), refs);
    assert.equal(m.reservationHref(scope.pool, undefined, scope.archived), route);
  }
  const query = new URLSearchParams({ status: 'รอชำระเงิน', date: '2026-10-07', search: 'TBL-current', type: 'prisoner' });
  const href = m.reservationHref('table', query);
  assert.equal(href.split('?')[0], '/reservations/tables');
  assert.equal(m.reservationPageScope(href.split('?')[0]).pool, 'table');
  assert.equal(new URLSearchParams(href.split('?')[1]).get('status'), 'รอชำระเงิน');
});

test('separate seating reports show only their pool and do not put a page break before TBL tables', () => {
  const print = load('src/lib/utils/print.ts');
  const tableHtml = print.buildSeatingReport([booking({ ref: 'TBL-only', bookingType: 'table', prisonerName: '' })]);
  assert.ok(tableHtml.includes('1) การจองโต๊ะ (TBL)'));
  assert.ok(!tableHtml.includes('การจองเยี่ยมผู้ต้องขัง'));
  assert.ok(!tableHtml.includes('<div style="page-break-before:always;"></div>'));
  const visitHtml = print.buildSeatingReport([booking({ ref: 'TBL-explicit-visit', bookingType: 'prisoner' })]);
  assert.ok(visitHtml.includes('1) การจองเยี่ยมผู้ต้องขัง'));
  assert.ok(!visitHtml.includes('การจองโต๊ะ (TBL)'));
});

test('route fallback respects menus and drilldown query preserves Thai status, date and reference', () => {
  const auth = { isAuthenticated: true, user: { role: 'Finance' } };
  const hashState = { value: '#/dashboard' };
  const mocks = {
    [path.resolve('src/lib/store/auth.svelte.ts')]: { auth },
    [path.resolve('src/lib/store/hash.svelte.ts')]: { hashState },
  };
  for (const component of ['Login', 'Reservations', 'EventLog', 'Users', 'Prisoners', 'Connection', 'Settings']) {
    mocks[path.resolve(`src/routes/${component}.svelte.ts`)] = { default: {} };
  }
  const router = loader(mocks)('src/lib/router.ts');
  assert.equal(router.resolveRoute().path, '/reservations');
  hashState.value = '#/reservations/archive';
  assert.equal(router.resolveRoute().path, '/reservations/archive');
  for (const role of ['Superadmin', 'Admin', 'Finance', 'Vinai', 'Tadtel']) {
    auth.user.role = role;
    for (const route of ['/reservations/tables', '/reservations/tables/archive']) {
      hashState.value = `#${route}`;
      assert.equal(router.resolveRoute().path, route);
    }
  }
  hashState.value = '#/notifications';
  auth.user.role = 'Superadmin';
  assert.equal(router.resolveRoute().path, '/notifications');
  for (const role of ['Admin', 'Finance', 'Vinai', 'Tadtel', 'User']) {
    auth.user.role = role;
    assert.notEqual(router.resolveRoute().path, '/notifications');
  }
  hashState.value = '#/users';
  auth.user.role = 'User';
  assert.equal(router.resolveRoute().path, '/dashboard');
  hashState.value = '#/reservations/tables';
  assert.equal(router.resolveRoute().path, '/dashboard');
  hashState.value = '#/reservations/archive';
  assert.equal(router.resolveRoute().path, '/dashboard');
  hashState.value = `#/reservations?${new URLSearchParams({ status: 'รอตรวจสอบวินัย', date: '2026-10-06', search: 'VIS-123' })}`;
  auth.user.role = 'Admin';
  assert.equal(router.currentPath(), '/reservations');
  assert.equal(router.currentQuery().get('status'), 'รอตรวจสอบวินัย');
  assert.equal(router.currentQuery().get('date'), '2026-10-06');
  assert.equal(router.currentQuery().get('search'), 'VIS-123');
  auth.isAuthenticated = false;
  assert.equal(router.resolveRoute().path, '/login');
});
