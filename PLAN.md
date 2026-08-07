# CCC Dashboard - Implementation Plan

**Stack**: Svelte 5 + TypeScript + Tailwind CSS + Vite + ECharts (tree-shaken) + PapaParse + Lucide Svelte
**Hosting**: Cloudflare Pages (Free tier, no credit card)
**Auth**: JWT Bearer tokens (accessToken in localStorage, refreshToken in sessionStorage)
**API**: Cloudflare Workers backend at `https://ccc-backend.pongsinbas.workers.dev`
**Protocol**: Legacy `?action=` endpoints + new JWT auth flow

---

## 1. Repository Setup

### New Repo: `ccc-dashboard`
```
ccc-dashboard/
├─ src/
│  ├─ lib/
│  │  ├─ api/
│  │  │  ├─ client.ts          # fetchWithAuth, auto-refresh, request queue
│  │  │  ├─ endpoints.ts       # typed action calls (getAll, login, etc.)
│  │  │  ├─ types.ts           # API response interfaces (copied from backend)
│  │  │  └─ pagination.ts      # pagination types & helpers
│  │  ├─ store/
│  │  │  ├─ auth.svelte.ts     # $state: user, tokens, login/logout/refresh
│  │  │  ├─ reservations.svelte.ts  # $state: rows, filters, pagination
│  │  │  ├─ ui.svelte.ts       # $state: sidebar, toasts, modals, dark mode
│  │  │  └─ filters.svelte.ts  # $state: persisted filter state
│  │  ├─ components/
│  │  │  ├─ ui/                # Button, Input, Select, Table, Modal, Card, Badge, Spinner, Tooltip
│  │  │  ├─ layout/            # Sidebar, Topbar, PageLayout, MobileNav
│  │  │  └─ charts/            # ECharts wrappers (Revenue, Trend, Heatmap, etc.)
│  │  └─ utils/
│  │     ├─ date.ts            # Thai locale formatting (Buddhist calendar)
│  │     ├─ currency.ts        # THB formatting
│  │     ├─ csv.ts             # PapaParse helpers (UTF-8)
│  │     ├─ permissions.ts     # role → permissions mapping
│  │     └─ validation.ts      # Zod schemas for forms
│  ├─ routes/                  # Page components (hash-based SPA routing)
│  │  ├─ Login.svelte
│  │  ├─ Dashboard.svelte      # Home (KPIs, charts, floor plan)
│  │  ├─ Reservations.svelte   # Main table + bulk actions
│  │  ├─ Reports.svelte
│  │  ├─ EventLog.svelte
│  │  ├─ Users.svelte          # Superadmin only
│  │  ├─ Prisoners.svelte      # Superadmin only
│  │  ├─ Connection.svelte
│  │  └─ Settings.svelte
│  ├─ app.html                 # HTML template
│  ├─ app.css                  # Tailwind imports + globals
│  └─ main.ts                  # Entry, router, init auth, error boundary
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ tailwind.config.js
├─ postcss.config.js
└─ .github/workflows/pages.yml # CI → Cloudflare Pages deploy
```

---

## 2. API Contract (Backend Coordination Required)

### Current Endpoints (Legacy `?action=`)
All POST to `/` with `Content-Type: text/plain;charset=utf-8`

| Action | Auth | Request Body | Response |
|--------|------|--------------|----------|
| `login` | ❌ | `{action, username, password}` | `{status, user, accessToken, refreshToken, mustChangePassword}` |
| `refresh` | ❌ | `{action: 'refresh', refreshToken}` | `{accessToken, refreshToken}` |
| `changePassword` | ❌ | `{action, username, oldPassword, newPassword, confirmPassword}` | `{status}` |
| `getAll` | ✅ | `{action, username?, password?}` | `{status, rows[]}` |
| `getArchivedReservations` | ✅ | `{action, username?, password?}` | `{status, rows[]}` |
| `getCountsByDate` | ❌ | `{action}` | `{status, counts: {dateISO: count}}` |
| `getPrisoners` | ❌ | `{action}` | `{status, prisoners[]}` |
| `lookupByRef` | ❌ | `{action, ref}` | `{status, rows[]}` |
| `getRoles` | ✅ | `{action}` | `{status, roles[]}` |
| `getUsers` | ✅ | `{action}` | `{status, users[]}` |
| `getEventLogs` | ✅ | `{action}` | `{status, logs[]}` |
| `getSettings` | ✅ | `{action}` | `{status, settings}` |
| `saveSettings` | ✅ | `{action, settings}` | `{status}` |
| `updateStatus` | ✅ | `{action, ref, status, reason?}` | `{status}` |
| `cancelBooking` | ✅ | `{action, ref, reason}` | `{status}` |
| `confirmPayment` | ✅ | `{action, ref}` | `{status}` |
| `updateVisitorApproval` | ✅ | `{action, ref, visitorApproved, extraVisitorApproved, visitorCount, total}` | `{status}` |
| `dedupeReservations` | ✅ | `{action}` | `{status, removed}` |
| `findDuplicateBookings` | ✅ | `{action}` | `{status, duplicates[]}` |
| `syncPrisonerWings` | ✅ | `{action}` | `{status}` |
| `importPrisoners` | ✅ | `{action, prisoners[]}` | `{status, imported}` |
| `createUser` | ✅ | `{action, username, password, role, displayName}` | `{status}` |
| `updateUser` | ✅ | `{action, username, ...}` | `{status}` |
| `deleteUser` | ✅ | `{action, username}` | `{status}` |
| `testConnection` | ❌ | `{action}` | `{status}` |
| `getBackendUrl` | ❌ | `{action}` | `{status, url}` |

### New Endpoints Needed (Server-Side Pagination)

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `getAllPaginated` | POST | ✅ | `{action, page, pageSize, filters: {search, status, date, wing}}` | `{status, rows[], total, page, pageSize, totalPages}` |
| `getArchivedPaginated` | POST | ✅ | `{action, page, pageSize, filters...}` | Same as above |
| `getEventLogsPaginated` | POST | ✅ | `{action, page, pageSize, filters...}` | Same |

> **Action Required**: Backend must implement these 3 endpoints. Until then, dashboard falls back to client-side pagination on full `getAll`/`getArchivedReservations`.

---

## 3. Role-Based Permissions (Exact Mapping from Reference)

### PERMISSIONS Matrix
```typescript
const PERMISSIONS = {
  Superadmin: [
    'approve', 'reject', 'approve_discipline', 'reject_discipline',
    'approve_participant', 'confirm_payment', 'reject_payment',
    'cancel', 'visitor_approval', 'view_slip', 'view_detail',
    'export', 'print', 'manage_users', 'manage_settings', 'view_eventlog'
  ],
  Admin: [
    'approve', 'reject', 'approve_discipline', 'reject_discipline',
    'approve_participant', 'confirm_payment', 'reject_payment',
    'cancel', 'visitor_approval', 'view_slip', 'view_detail',
    'export', 'print', 'view_eventlog'
  ],
  Finance: [
    'confirm_payment', 'reject_payment', 'cancel', 'view_slip', 'view_detail'
  ],
  Vinai: [
    'approve_discipline', 'reject_discipline', 'view_slip', 'view_detail'
  ],
  Tadtel: [
    'approve_participant', 'visitor_approval', 'view_slip', 'view_detail'
  ],
  User: ['print']
};
```

### SIDEBAR_MENU Visibility
```typescript
const SIDEBAR_MENU = {
  Superadmin: ['home', 'reservations', 'reports', 'eventlog', 'users', 'prisoners', 'connection', 'settings'],
  Admin:      ['home', 'reservations', 'reports', 'eventlog', 'prisoners', 'connection'],
  Finance:    ['reservations', 'reports'],
  Vinai:      ['home', 'reservations', 'reports'],
  Tadtel:     ['home', 'reservations', 'reports'],
  User:       ['home']
};
```

### KPI Visibility by Role
```typescript
const KPI_VISIBILITY = {
  Superadmin: ['statTotal', 'statWait', 'statOk', 'statReject', 'statUniquePrisoners', 'statThisWeek', 'statThisMonth', 'statUniqueVisitors'],
  Admin:      ['statTotal', 'statWait', 'statOk', 'statReject', 'statUniquePrisoners', 'statThisWeek', 'statThisMonth', 'statUniqueVisitors'],
  Vinai:      ['statWait', 'statThisWeek'],
  Tadtel:     ['statOk', 'statThisWeek'],
  Finance:    ['statOk', 'statThisWeek', 'statUniqueVisitors']
};
```

### Status Filter by Role (Rows Visible)
```typescript
const ALLOWED_STATUSES = {
  Superadmin: null,  // all
  Admin:      null,  // all
  Finance:    ['รอชำระเงิน', 'ชำระแล้ว', 'เสร็จสิ้น'],
  Tadtel:     ['รอตรวจสอบผู้เข้าร่วม', 'รอตรวจสอบ'],
  Vinai:      null,  // all (no date restriction)
  User:       null   // all (limited to print)
};
```

---

## 4. Auth Flow (JWT + Auto-Refresh)

### Token Storage
- **accessToken**: `localStorage` (persists across tabs, 15min expiry)
- **refreshToken**: `sessionStorage` (cleared on tab close, 7d expiry)
- **user**: `localStorage` (role, username, displayName, mustChangePassword)

### Login Flow
1. POST `action=login` with `{username, password}`
2. On success: store tokens + user, redirect to `/dashboard`
3. If `mustChangePassword=true` → show forced change modal before dashboard

### Auto-Refresh Logic
```typescript
// In client.ts
let refreshPromise: Promise<string> | null = null;
const requestQueue: Array<() => void> = [];

async function fetchWithAuth(url, options) {
  const token = getAccessToken();
  const res = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  
  if (res.status === 401) {
    // Queue this request
    return new Promise((resolve, reject) => {
      requestQueue.push(() => fetchWithAuth(url, options).then(resolve).catch(reject));
      triggerRefresh();
    });
  }
  return res;
}

async function triggerRefresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const newToken = await refreshAccessToken(); // POST action=refresh
    setAccessToken(newToken);
    requestQueue.forEach(fn => fn());
    requestQueue.length = 0;
    return newToken;
  })();
  return refreshPromise;
}
```

### Forced Password Change
- After login with `mustChangePassword=true`, show modal
- POST `action=changePassword` with `{username, newPassword, confirmPassword}`
- On success: clear tokens, return to login screen

---

## 5. Dashboard View (Home) - Must-Have Components

### KPI Cards (Role-Filtered)
| Card | Key | Data Source | Roles |
|------|-----|-------------|-------|
| Total Bookings | `statTotal` | `allRows.length` | Superadmin, Admin |
| Pending Discipline | `statWait` | `filter(status === 'รอตรวจสอบวินัย')` | Superadmin, Admin |
| Paid/Complete | `statOk` | `filter(paid statuses)` | All except Vinai |
| Rejected | `statReject` | `filter(status === 'ไม่อนุมัติ')` | Superadmin, Admin |
| Unique Prisoners | `statUniquePrisoners` | `new Set(prisonerId)` | Superadmin, Admin |
| This Week | `statThisWeek` | `visitDateISO >= startOfWeek` | All |
| This Month | `statThisMonth` | `visitDateISO >= startOfMonth` | Superadmin, Admin |
| Unique Visitors | `statUniqueVisitors` | `new Set(visitorId/name)` | Superadmin, Admin, Finance |

### Charts (ECharts, Tree-Shaken)
1. **Revenue Summary** (bar) - `getCountsByDate` + pricing
2. **14-Day Trend** (bar) - `getCountsByDate` last 14 days
3. **Weekly Heatmap** (calendar) - bookings by day-of-week × hour
4. **Wing Counts** (bar) - bookings grouped by `wing`
5. **Pipeline Waterfall** (bar) - status funnel counts
6. **Daily Revenue** (line) - 14-day revenue
7. **Zone Performance** (bar) - toggle count/revenue by wing
8. **Growth Line** (line) - week-over-week revenue

### Floor Plan
- Date selector (dropdown from `visitDateISO`)
- Grid of tables (configurable rows/cols)
- Cell states: occupied (prisoner), reserved (pre-booked), available
- Click → view/modal for that table's bookings

### Today's Visits
- Filter `visitDateISO === today`
- List with ref, visitor, prisoner, status badge

### Alerts
- Overdue payments (>2 days in `รอชำระเงิน`)
- Batch approve buttons for discipline/participant (role-gated)

### Welcome Banner
- Time-based greeting (Thai)
- Today's booking count

### Quick Actions (Role-Gated)
- New Booking (Admin+)
- Export CSV (Admin+)
- Payment Queue (Finance+)
- Manage Users (Superadmin)

---

## 6. Reservations View - Must-Have Features

### Toolbar (Unified Controls)
- Search box (debounced, filters all string fields)
- Status filter (dropdown, role-filtered options)
- Date filter (dropdown from `visitDateISO` values)
- Wing filter (dropdown from unique `wing` values)
- Archive toggle (lazy-load `getArchivedReservations`)
- Page size selector (5, 10, 20, 50)
- Date range picker for export
- Action buttons (role-gated):
  - New Booking (Admin+)
  - Export CSV (Admin+)
  - Print (Admin+)
  - Dedupe (Superadmin)
  - Find Duplicates (Superadmin)
  - Sync Wings (Superadmin)

### Table
- Columns: Select, Ref (click→detail), Prisoner/Visitor, Wing, Total, Status, Progress (3-step), Actions
- Sortable columns (ref, prisonerName, wing, total, status)
- Pagination (client-side if API not ready, server-side when available)
- Row checkboxes → bulk actions bar
- Status badge with Thai colors
- Progress bar: 1. Participant Check → 2. Discipline → 3. Payment

### Row Actions (Permission-Gated)
| Action | Permission | Status Trigger |
|--------|------------|----------------|
| View Slip | `view_slip` | Always |
| View Detail | `view_detail` | Always |
| Edit | Superadmin | Always |
| Approve Participant | `approve_participant` | `รอตรวจสอบผู้เข้าร่วม` |
| Reject Participant | `reject` | `รอตรวจสอบผู้เข้าร่วม` |
| Approve Discipline | `approve_discipline` | `รอตรวจสอบวินัย` |
| Reject Discipline | `reject_discipline` | `รอตรวจสอบวินัย` |
| Confirm Payment | `confirm_payment` | `รอชำระเงิน` |
| Complete | `confirm_payment` | `ชำระแล้ว` |
| Cancel | `cancel` | Not completed |
| Recheck Prisoner | Vinai | Has `prisonerId` |

### Bulk Actions
- Approve selected (discipline/participant based on status)
- Reject selected
- Complete selected
- Cancel selected (with reason modal)
- Export selected CSV

### Day Summary Panel
- Shown when date filter active
- Status counts for that day
- Batch approve buttons (discipline/participant)

---

## 7. Reports View

### Controls
- Search, status, date, wing filters
- Monthly report generator (date range picker)

### Charts
- Status Donut (all bookings)
- Monthly Revenue (bar)
- Status Funnel (bar)
- Visitor Type (pie)

### Monthly Report Output
- Table grouped by date
- Totals per status
- Print-optimized CSS

---

## 8. Event Log View

- Paginated table (server-side when API ready)
- Columns: Timestamp, User, Display Name, Action, Details, IP, User-Agent
- Local event log fallback (localStorage)

---

## 9. Users View (Superadmin Only)

- Create user modal (username, password, confirm, role, displayName)
- Table: username, role, displayName, actions (edit, delete, reset password)
- Edit modal (role, displayName, reset password)
- Delete confirmation

---

## 10. Prisoners View (Superadmin Only)

- CSV upload with preview (PapaParse)
- Required columns: `prisonerId, prisonerName, wing, status, vinaiDate, note`
- Upsert on `prisonerId`
- Sync Wings button (calls `syncPrisonerWings`)

---

## 11. Connection View

- Test connection button (calls `testConnection`)
- Current backend URL display
- Copy URL button
- Diagnostic info

---

## 12. Settings View

- Page size (5, 10, 20, 50) → localStorage
- Notifications toggle (toast, sound) → localStorage
- Dark mode toggle → localStorage + `document.documentElement.classList.toggle('dark')`
- Email notifications (future)
- Save to server (`saveSettings`) + local

---

## 13. Shared UI Components

### Core (Tailwind + Lucide)
- `Button` (filled, tonal, outlined, danger, icon, sizes)
- `Input` (text, password, search, date, number)
- `Select` (single, multi, searchable)
- `Table` (sortable, selectable, virtualized)
- `Modal` (backdrop, focus trap, ESC close)
- `Card` (header, content, footer)
- `Badge` (status colors, sizes)
- `Spinner` (sm, md, lg)
- `Tooltip` (hover, delay)
- `Toast` (success, error, warning, info, auto-dismiss)
- `Pagination` (page numbers, ellipsis, size selector)
- `ProgressBar` (3-step: participant → discipline → payment)
- `Avatar` (initials, role color)

### Chart Wrappers (ECharts)
- `BarChart`, `LineChart`, `DonutChart`, `HeatmapChart`, `FunnelChart`
- Props: `data`, `options`, `darkMode`, `onExport`
- Auto-resize on container change
- Destroy on unmount

### Layout
- `Sidebar` (collapsible, role-filtered links, mobile drawer)
- `Topbar` (title, connection indicator, notifications, dark mode, date)
- `PageLayout` (sidebar + main content, responsive)
- `MobileNav` (bottom tab bar for mobile)

---

## 14. State Management (Svelte 5 Runes)

### `auth.svelte.ts`
```typescript
export const auth = $state({
  user: null as User | null,
  accessToken: '',
  refreshToken: '',
  mustChangePassword: false,
  isLoading: false,
  
  async login(username, password) { ... },
  async logout() { ... },
  async refresh() { ... },
  async changePassword(oldP, newP) { ... },
  hasPermission(action) { ... },
  get visibleMenu() { return SIDEBAR_MENU[this.user?.role] || []; }
});
```

### `reservations.svelte.ts`
```typescript
export const reservations = $state({
  rows: [] as Reservation[],
  archiveRows: [] as Reservation[],
  archiveLoaded: false,
  filters: { search: '', status: '', date: '', wing: '' },
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
  sort: { key: '', dir: 'asc' },
  
  async fetch(page?, filters?) { ... },  // calls API
  setFilters(f) { ... },
  setPage(p) { ... },
  get filteredRows() { ... },  // client-side fallback
  get paginatedRows() { ... }
});
```

### `ui.svelte.ts`
```typescript
export const ui = $state({
  sidebarOpen: false,
  darkMode: false,
  toasts: [] as Toast[],
  activeModal: null,
  notifications: [] as Notification[],
  
  toggleSidebar() { ... },
  toggleDarkMode() { ... },
  showToast(msg, type) { ... },
  openModal(name, props) { ... },
  closeModal() { ... }
});
```

### `filters.svelte.ts`
```typescript
export const filters = $state({
  search: '',
  status: '',
  date: '',
  pageSize: 10,
  
  load() { ... },  // from localStorage
  save() { ... },  // to localStorage
  applyToElements() { ... }
});
```

---

## 15. Routing (Hash-Based SPA)

```typescript
// main.ts
const routes = {
  '/login': Login,
  '/dashboard': Dashboard,
  '/reservations': Reservations,
  '/reports': Reports,
  '/eventlog': EventLog,
  '/users': Users,
  '/prisoners': Prisoners,
  '/connection': Connection,
  '/settings': Settings
};

function router() {
  const hash = location.hash.slice(1) || '/dashboard';
  const [path, ...params] = hash.split('?');
  const Component = routes[path] || Dashboard;
  // Guard: check auth, role permissions
  return Component;
}
```

### Route Guards
- `/login` → redirect to `/dashboard` if authenticated
- All others → redirect to `/login` if not authenticated
- Role checks: `Users`, `Prisoners` → Superadmin only
- Sidebar visibility: `SIDEBAR_MENU[role]`

---

## 16. Stale-While-Revalidate Pattern

```typescript
// On mount (Reservations view)
const cached = localStorage.getItem('cc_admin_rows_cache');
if (cached) {
  const { rows, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp < 5 * 60 * 1000) {
    reservations.rows = rows.filter(r => !r._archived || reservations.archiveLoaded);
    render();  // Instant render
  }
}
// Then background fetch
reservations.fetch().then(() => {
  localStorage.setItem('cc_admin_rows_cache', JSON.stringify({ rows: reservations.rows, timestamp: Date.now() }));
});
```

---

## 17. Polling (30s Interval)

```typescript
// In auth store after login
let pollInterval: number;

function startPolling() {
  stopPolling();
  pollInterval = setInterval(async () => {
    const version = await api.getDataVersion();
    if (version !== lastVersion) {
      lastVersion = version;
      await reservations.fetch();
      // Also refresh dashboard KPIs if on home view
    }
  }, 30000);
}

function stopPolling() {
  if (pollInterval) clearInterval(pollInterval);
}
```

---

## 18. Offline Support (Service Worker)

- `vite-plugin-pwa` with Workbox
- Cache-first for static assets (JS, CSS, fonts, images)
- Network-first for API calls (with offline fallback to cache)
- `offline.html` fallback page

---

## 19. Accessibility (WCAG 2.1 AA)

- Semantic HTML (table, nav, main, aside, button, select)
- ARIA labels on icon buttons
- Focus visible outlines (Tailwind `focus-visible:ring-2`)
- Keyboard navigation (Tab, Enter, Escape)
- Color contrast (Tailwind default palette passes)
- Screen reader announcements for toasts (`role="alert"`)
- Thai language `lang="th"`

---

## 20. Internationalization (Thai Primary)

- All UI strings in Thai (from reference)
- Date formatting: `toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })`
- Number formatting: `toLocaleString('th-TH')` + ' บาท'
- Buddhist calendar support (year + 543)
- Structure ready for future EN: `$t('key')` pattern

---

## 21. Cloudflare Pages Deployment

### `.github/workflows/pages.yml`
```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ccc-dashboard
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

### Environment Variables (Pages Dashboard)
| Variable | Value |
|----------|-------|
| `PUBLIC_API_BASE` | `https://ccc-backend.pongsinbas.workers.dev` |
| `PUBLIC_TURNSTILE_SITEKEY` | `0x4AAAAAAEI6YrnAV4zCga9I` |

### Custom Domain
- Pages Dashboard → Custom Domains → Add `dashboard.yourdomain.com`
- DNS: CNAME `dashboard` → `ccc-dashboard.pages.dev`

---

## 22. Free Tier Constraints (Cloudflare Pages)

| Resource | Cloudflare Pages Free | Notes |
|----------|----------------------|-------|
| Requests/month | Unlimited | ✅ |
| Bandwidth | Unlimited | ✅ |
| Build minutes | 500/month | ✅ (build ~2-3 min) |
| Custom domains | Unlimited | ✅ |
| Functions | 100K/day | ✅ (if needed) |
| KV/D1 | N/A (separate) | Use Workers backend |
| **Credit Card** | **Not Required** | ✅ |

---

## 23. Phase Breakdown

### Phase 1: Scaffold & Auth (Days 1-2)
- [ ] `npm create vite@latest ccc-dashboard -- --template svelte-ts`
- [ ] Install: `tailwindcss @tailwindcss/vite echarts papa-parse lucide-svelte zod @tanstack/svelte-virtual`
- [ ] Configure Tailwind v4 + PostCSS
- [ ] Copy backend types → `src/lib/api/types.ts`
- [ ] Build `client.ts` (fetchWithAuth, auto-refresh, queue)
- [ ] Build `auth.svelte.ts` (login, logout, refresh, permissions)
- [ ] Build `Login.svelte` (exact UI from reference + Turnstile)
- [ ] Test login against live backend

### Phase 2: Reservations View (Days 3-5)
- [x] Build `reservations.svelte.ts` store
- [x] Build UI components: Table, Toolbar, Filters, Pagination, Modal, Badge, StatusSteps
- [x] Build `Reservations.svelte` page
- [x] Implement server-pagination API calls (with fallback)
- [x] Role-gated columns/actions/bulk
- [x] Stale-while-revalidate + polling
- [x] Day summary panel + batch actions
- [x] CSV export (filtered rows)

### Phase 3: Dashboard/Home (Days 5-7)
- [x] Build `Dashboard.svelte` layout
- [x] KPI cards (role-filtered)
- [x] Chart wrappers (ECharts) + 8 charts
- [x] Floor plan component
- [x] Today's visits + alerts + payment queue
- [x] Welcome banner + quick actions
- [x] Responsive grid (Tailwind)

### Phase 4: Remaining Views (Days 7-9)
- [x] `Reports.svelte` (charts + monthly generator)
- [x] `EventLog.svelte` (paginated table)
- [x] `Users.svelte` (Superadmin CRUD)
- [x] `Prisoners.svelte` (CSV import + preview)
- [x] `Connection.svelte` (test + URL)
- [x] `Settings.svelte` (local + server)

### Phase 5: Polish & Deploy (Days 9-10)
- [ ] Dark mode (Tailwind `dark:` + localStorage)
- [ ] Service Worker (Workbox)
- [ ] Accessibility audit
- [ ] Error boundaries + loading states
- [ ] GitHub Actions → Cloudflare Pages
- [ ] Custom domain setup
- [ ] README with dev/deploy instructions

---

## 24. Backend Coordination Checklist

- [ ] Implement `getAllPaginated(page, pageSize, filters)` endpoint
- [ ] Implement `getArchivedPaginated(page, pageSize, filters)` endpoint
- [ ] Implement `getEventLogsPaginated(page, pageSize, filters)` endpoint
- [ ] Ensure `getDataVersion` returns incrementing integer
- [ ] Verify CORS allows dashboard origin (`https://ccc-dashboard.pages.dev`)
- [ ] Confirm Turnstile secret works for login endpoint
- [ ] Test JWT refresh flow end-to-end

---

## 25. File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Button.svelte`, `DataTable.svelte` |
| Stores | camelCase + `.svelte.ts` | `auth.svelte.ts`, `reservations.svelte.ts` |
| Utils | camelCase | `date.ts`, `currency.ts` |
| Types | PascalCase + `.ts` | `api/types.ts`, `api/pagination.ts` |
| Routes/Pages | PascalCase | `Dashboard.svelte`, `Login.svelte` |
| Styles | kebab-case | `app.css`, `components.css` |

---

## 26. Git Workflow

```bash
# New repo
git init ccc-dashboard
cd ccc-dashboard
# ... add files ...
git add .
git commit -m "feat: initial scaffold (Svelte 5 + Tailwind + Vite)"
git remote add origin https://github.com/your-org/ccc-dashboard.git
git push -u origin main

# Feature branches
git checkout -b feat/auth
# ... work ...
git push -u origin feat/auth
# PR → review → merge to main (auto-deploys to Pages)
```

---

## 27. Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | Stores, utils, permissions, date/currency helpers |
| Component | Vitest + @testing-library/svelte | UI components (Button, Modal, Table) |
| E2E | Playwright | Login, Reservations CRUD, Role guards, Dark mode |
| Visual | Playwright + pixelmatch | Chart rendering, PDF print |

---

## 28. Future Enhancements (v2+)

- WebSocket real-time updates (replace polling)
- PWA manifest + install prompt
- Offline mutations (optimistic UI + sync)
- Multi-language (EN/TH toggle)
- Advanced floor plan (drag-drop table assignment)
- Email notifications (Cloudflare Email Workers)
- Audit log export (PDF/Excel)
- Mobile app wrapper (Capacitor)

---

## 29. Questions for Backend Team

1. **Pagination API**: Can you add `getAllPaginated`, `getArchivedPaginated`, `getEventLogsPaginated`? Required for 6K+ row performance.
2. **Filter Pushdown**: Should filters (search, status, date, wing) be applied server-side?
3. **Data Version**: Is `getDataVersion` guaranteed to increment on any write?
4. **CORS**: Confirm `ccc-dashboard.pages.dev` and `dashboard.yourdomain.com` are allowed.
5. **Turnstile**: Is the login endpoint protected by Turnstile? If so, need widget on login page.
6. **Rate Limits**: Any rate limits on API that dashboard polling might hit?

---

## 30. Quick Start Commands

```bash
# Clone & install
git clone https://github.com/your-org/ccc-dashboard.git
cd ccc-dashboard
npm install

# Dev server (HMR)
npm run dev

# Typecheck
npm run check

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy (auto via GitHub Actions on push to main)
git push origin main
```

---

**Document Version**: 1.0
**Last Updated**: 2025-08-07
**Author**: opencode agent
**Status**: Ready for implementation