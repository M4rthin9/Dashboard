# Dashboard audit and implementation decisions

Audit date: 6 October 2026. Source audit completed before this pass changed application files. The previous visual pass is included in this review.

## Architecture and evidence

- Svelte 5.56.8 SPA with TypeScript 6.0.3, Vite 8.2.1, hash routing, Svelte runes stores, Tailwind 4.3.3, Lucide 1.29.0, ECharts 6.1.0, PapaParse 5.5.4 and Zod 4.4.3 (resolved lockfile versions). No new runtime dependency is needed.
- Dashboard source: `src/routes/Dashboard.svelte`; shared calculations: `src/lib/utils/dashboard.ts` and `format.ts`; charts: `components/charts/EChart.svelte` and `utils/echarts.ts`; navigation: router, permissions, layout and navigation modules.
- `App.svelte` subscribes to `liveSync`: authenticated `/api/version` polling at 3 seconds, hidden-tab suspension, backoff to 30 seconds. Reservation store caches for 5 minutes, includes archive by default, preserves row identities for open modals, and rolls back optimistic writes.
- API data path: Dashboard/Reservations/Reports/TableReport -> reservation store -> `getReservationsWithArchive` -> authenticated POST `{ action: 'getAllWithArchive', includeArchive }` -> backend `routes/reservations.ts` -> `db/queries/reservations.ts` -> `reservations` plus `reservations_archive`, deduplicated by reference with live rows winning. OverallReport separately fetches the same endpoint with archive enabled.
- Read-only inspection also covered the sibling backend at `F:/Website/CCC`: Hono on Cloudflare Workers, direct parameterized D1 SQLite queries (no ORM), JWT via jose plus legacy credential compatibility, DB-backed role permissions, D1 versioned cache, KV support and R2 slip/promo assets. Local source is evidence of implementation, not proof of the currently deployed version.
- Schema entities: reservations, archive, prisoners, users, roles, event_log, notes, settings, refresh_tokens, data_version; later migrations add notifications, consent logs, slip metadata, booking type/holds, extra prisoners and opening-alert subscriptions.
- Booking flows: prisoner visits advance participant -> discipline -> payment -> paid -> completed; no-prisoner `table` bookings start at payment with a timed hold. Main-visitor rejection rejects the whole visit. Server recomputes pricing and approved visitor buckets. Extra prisoners are charged/count separately. Ordinary reject/cancel is date-bound; current backend source explicitly gives Superadmin a force path, including archived records (older PLAN/CLAUDE statements are outdated).
- Built-in roles: Superadmin, Admin, Finance, Vinai, Tadtel and User. Frontend menu/actions are static; backend also supports dynamic roles. Finance reservation rows are financial statuses; Tadtel participant-pending; Vinai skips past visits. The original dashboard did not match these row scopes.
- Reviewed all routed page scripts and their rendered sections/action wiring: login, dashboard, reservations, reports, financial report, TBL report, prisoners, users/role management, settings, connection and event log. Reviewed reservation form/detail/payment/visitor modals, QR/slip helpers, print report generation, shared UI, settings cards, chat/proxy functions, deployment configuration and service worker. `Placeholder.svelte` is not routed. Pagination endpoints declared in frontend helpers are not registered in the inspected backend and are unused by the current lists.

## Element audit

| Element / question | Source and correctness | Decision |
|---|---|---|
| Role guards, reservation CRUD and approvals | Existing router, permissions, store and backend transition/pricing handlers | KEEP business behavior; fix fallback so Finance does not render a disallowed dashboard |
| Thai language, Buddhist dates, baht, dark mode, grouped menu | Existing formatters/UI/navigation | KEEP; remove decorative sidebar filler and retain useful navigation |
| Monthly revenue KPI / how much was earned? | `computeRevenueKpis`: sums every nonterminal status; only lower month bound, so includes future months | IMPROVE: bounded period, distinguish booking value, paid booking value and awaiting-payment value; label by visit date |
| Paid vs unpaid revenue donut | Center total includes approval-pending value absent from slices | CONSOLIDATE into explicit money KPIs and daily stacked bars; avoid mismatched totals |
| All-time total vs today's KPI | Mixed scope, repeated today count with different cancellation/archive rules | CONSOLIDATE into clearly scoped period KPIs plus a separate live-today briefing |
| Four status cards / what needs action? | Live rows but not date-prioritized or role-scoped | IMPROVE: capability-specific queues, counts, next step, live-only, earliest visits first |
| Paid alerts / what needs completion? | `computeAlerts` includes already completed bookings | IMPROVE: paid-only completion queue, completed is history |
| Payment queue / what needs review? | No slip priority; latest-created first; past dates/holds not explained | IMPROVE: nearest visit first, existing modal retained, table hold state visible |
| Today's visits | Includes cancelled/rejected rows and unbounded detail access | IMPROVE: active-today count, explicit statuses, details only with `view_detail` |
| 14-day booking trend | Includes cancelled/rejected, smooth line implies continuous measurement | IMPROVE: discrete daily VIS/TBL stacked bars, paid/cancel exclusions defined, equal-period comparison |
| Status donut and pipeline funnel | Both count current states; no transition history or cohort conversion exists | CONSOLIDATE: horizontal state distribution; remove funnel geometry and conversion implication |
| Wing counts | Counts bookings only by main wing; extras and table pool can confuse interpretation | MOVE to analytics; label as visit bookings by main prison wing |
| Six-month revenue | Nonterminal booking value rather than payment-date revenue | MOVE to analytics; label booking value by visit month |
| Visitor ages | Stored server-authoritative adult/child buckets; not actual check-in | MOVE to analytics; compare categories with bars and label registered visitor counts |
| Daily revenue report | Range-selected rows plotted on a trailing-today axis | IMPROVE: build axis from selected from/to dates and validate inverted ranges |
| Floor plan | `i + 1` labels are fabricated table assignments; excludes paid records; silently chooses latest date | REMOVE physical-floor-plan claim; retain date-selectable booking roster with stable refs, booking type, status and real people counts |
| Detailed report tables and operational printing | Existing business-specific gate, kitchen, discipline, seating and TBL reports | KEEP on report pages; do not duplicate full report tables on the dashboard |
| Overall report people/prisoner totals | Adds one prisoner to every paid booking, including TBL; ignores extra prisoners; visitor parsing differs from stored approved counts | IMPROVE: use stored count buckets and actual `prisonersOf` records; preserve financial/status definitions and print interfaces |
| TBL monetary summary | Includes cancelled/rejected in pending via total-minus-paid | IMPROVE: pending only awaiting-payment; reuse financial summary |
| Chart wrapper | Disposes/recreates chart on every data change; generic accessible name | IMPROVE: maintain instance, update data, resize, theme-aware recreation, descriptive labels and text/table alternatives |
| Data freshness | Browser-online badge says nothing about API polling success; global cache not tied to user | IMPROVE: show sync state and account-scoped cache; reset pending data on identity change |
| Detail opening / can I inspect without changing a booking? | Client OCR effect can attempt completion merely by opening a detail modal, without checking action rights | IMPROVE: retain server verification and explicit approval flow; make detail viewing read-only |
| New management insight | No period/type filter, comparison baseline, or next-seven-day summary | ADD using existing reservation dates/statuses; no fake growth, capacity or attendance |

## Implementation contract

1. Operational queues use valid, unarchived records and role-specific actions. Historical metrics use the dataset actually loaded, with an explicit archive-coverage indicator.
2. Analytics date filter is **visit date**, never payment date. Paid amount means booking value with status paid/completed; completed means workflow completion, not verified attendance. Awaiting-payment amounts exclude approval-pending and terminal bookings.
3. Booking types use explicit `bookingType`, with TBL reference fallback for legacy data. Cancellation/rejection are excluded from active booking/value/visitor metrics but retained in status distributions and report tables.
4. Previous comparison is an equal-length, immediately preceding date range. Zero baseline produces a neutral new/no-data label, never infinity or a fabricated percentage.
5. Missing date/amount data is visible; no fixed denominator of 20 for occupancy, no invented table number, no cashflow or conversion rate without source records.
6. Keep existing API contracts, database schemas, server pricing, mutation handlers, permissions and operational print documents. New calculations are pure and regression-tested without calling production APIs.

## Findings outside this frontend change

- Backend list endpoints return broad authenticated data, and several mutation handlers use authentication without consistent fine-grained permission checks. UI filtering is not a server-side security boundary. A backend authorization review is needed separately.
- Custom role creation exists but the frontend static permission/menu table cannot represent newly defined roles. Do not invent permissions for them in a visual upgrade.
- Forced first-password change currently only shows a toast. Authentication refresh can recurse if the server keeps returning unauthorized. Retry of write requests can repeat non-idempotent operations after uncertain failures. These require a dedicated authentication/API pass.
- Same-origin AI proxy functions lack authentication/rate/size guards in inspected source. Keep the chat capability but do not treat it as a source of dashboard facts.
- Public capacity has separate VIS/TBL pools, admin exceptions, cancellation-release rules and holds. Counts of dashboard rows are not a capacity model; omit occupancy percentages until using authoritative availability endpoints.
- No persisted table positions, confirmed check-in event, payment timestamps or status-history dataset was found. Those features require a backend/schema addition.
- No live database access, production writes, migrations or deployment were performed in this audit. Browser verification depends on available local tooling; report any limit explicitly.

## Delivered changes and verification

- Main dashboard now separates live operations, filtered analytics and daily booking rosters. VIS/TBL series, explicit visit-date money labels, equal-length comparisons, archive coverage, missing-data notices and synchronization state use existing records. No fabricated capacity, conversion, payment-date cashflow or seat positions remain in the main dashboard.
- Grouped desktop and mobile navigation share a role-aware definition. Report submenus collapse; menu search provides direct navigation. Route fallback respects allowed menus, including Finance.
- Existing approval/payment/detail modals, reservation CRUD, report printing and exports remain wired to the existing API. Detail viewing no longer starts a client OCR status mutation. Successful payment confirmation closes correctly and failures remain reviewable.
- Shared financial summaries count extra prisoners, exclude prisoners from TBL bookings and prefer authoritative stored age buckets. TBL pending value excludes cancelled/rejected records and approval-pending value. Report daily axes now follow the selected historical range.
- Account and API identity scope the reservation cache. Logout/identity changes reset visible data; stale in-flight responses cannot overwrite a new session. Cached loads release their request lock.
- Regression tests cover dates/leap years, metric exclusions, historical series, VIS/TBL classification, financial headcounts, six built-in roles, archived/expired queues, account races and cached reloads. No production API calls are made by tests.
- No dependency added. Automated validation uses `npm test`, `npm run check`, `npm run lint` and `npm run build`. Browser interaction and production database verification remain outside the validation available in this environment.

## Separate archived reservation menu

- `/reservations` contains only records without the server `_archived` marker; `/reservations/archive` contains only archived records. Past-dated live bookings are retained in the current table until the backend archives them. Dashboard/report historical analytics still use the complete loaded dataset.
- The archive menu is available to the same built-in staff roles as the booking menu, in desktop navigation, mobile navigation and menu search. User remains dashboard-only. Existing status restrictions for Finance/Tadtel are retained; Vinai can inspect archived history without the live-table past-date exclusion.
- Shared filtering, sorting, pagination, details, CSV and print functionality operates on the selected table. Archive browsing loads historical data even if history was previously disabled. Refresh/retry requests preserve archive coverage.
- Archive bulk selection, bulk approvals and new-booking creation are hidden. Existing Superadmin correction controls remain available. Archived rows retain full text contrast and a details action for other staff.
- Added regression coverage for disjoint table membership (including past live and future archived records), archive route access and archive loading/refresh.
