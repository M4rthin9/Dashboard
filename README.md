# CCC Dashboard

Admin dashboard for the CCC (prison visitor reservation) system. Consumes the Cloudflare Workers backend at `https://ccc-backend.pongsinbas.workers.dev`.

**Stack**: Svelte 5 (runes) + TypeScript + Tailwind CSS v4 + Vite + ECharts (tree-shaken) + PapaParse + Lucide

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
npm install
```

## Environment

Create `.env.local` (optional; falls back to the live backend):

```
VITE_API_BASE=https://ccc-backend.pongsinbas.workers.dev
```

| Variable         | Default                                    | Purpose                     |
|------------------|--------------------------------------------|-----------------------------|
| `VITE_API_BASE`  | `https://ccc-backend.pongsinbas.workers.dev` | Backend base URL           |

## Commands

```bash
npm run dev        # dev server with HMR
npm run check      # svelte-check + tsc (typecheck)
npm run lint       # ESLint
npm run lint:fix   # ESLint with --fix
npm run build      # production build to dist/
npm run preview    # preview the production build
```

## Architecture

- `src/lib/router.ts` — hash-based SPA routing with auth + role guards
- `src/lib/store/` — `auth.svelte.ts` (JWT + auto-refresh), `reservations.svelte.ts` (SWR + 5-min cache + polling), `ui.svelte.ts` (sidebar, dark mode, toasts)
- `src/lib/api/` — typed endpoint wrappers (`endpoints.ts`), API client (`client.ts`), types
- `src/routes/` — pages: Dashboard, Reservations, Reports, EventLog, Users, Prisoners, Connection, Settings, Login

## Deploy (Cloudflare Pages)

### Option A: GitHub Actions (recommended)

1. Create a GitHub repo and push the dashboard code to `main`.
2. In the repo settings add secrets:
   - `CLOUDFLARE_API_TOKEN` (Pages:Edit permission)
   - `CLOUDFLARE_ACCOUNT_ID`
   - `GITHUB_TOKEN` (auto-provided)
3. Create the Pages project `ccc-dashboard` (or set `projectName` in `.github/workflows/pages.yml`).
4. Push to `main` — the workflow builds and deploys `dist/` automatically.

### Option B: Manual

```bash
npm run build
npx wrangler pages deploy dist --project-name ccc-dashboard
```

## Notes

- The backend's `getEventLogs` action filter param is `actionFilter` (not `action`, which is reserved for route selection).
- `getPrisoners` is only available via `GET /api/prisoners`; the dashboard uses that alias.
- Chart theming follows the app's dark mode toggle (ECharts `dark` theme registered in `src/lib/utils/echarts.ts`).
