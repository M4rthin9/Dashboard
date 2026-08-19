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
4. Push — the workflow builds and deploys `dist/` automatically.

### Environments

`.github/workflows/pages.yml` picks its target from the branch it was pushed from:

| Branch | Pages environment | URL | `VITE_API_BASE` baked into the bundle |
| --- | --- | --- | --- |
| `main` | Production | `ccc-dashboard.pages.dev` | `https://ccc-backend.pongsinbas.workers.dev` |
| `dev` | Preview | `dev.ccc-dashboard.pages.dev` | `https://ccc-backend-dev.pongsinbas.workers.dev` |

`VITE_API_BASE` is a **build-time** value — Vite inlines it, so it is set in the
workflow rather than as a Pages runtime variable. Unset, `src/lib/store/auth.svelte.ts`
falls back to the production worker silently; check the Network tab to confirm which
backend a deployment is actually talking to.

The two Pages Functions (`functions/api/chat.ts`, `functions/api/verify-slip.ts`) are
same-origin, so they follow the deployment rather than `VITE_API_BASE`. Their
`CF_ACCOUNT_ID` / `AI_API_KEY` bindings must be set for **both** the Production and
Preview environments in the Pages dashboard, or those endpoints return
`{"error":"AI not configured"}`.

The dev deployment shows a persistent amber DEVELOPMENT banner and skips service-worker
registration (`src/lib/env.ts`) — `import.meta.env.PROD` is true for dev builds too, so
the hostname is what distinguishes them.

### Option B: Manual

```bash
npm run build
npx wrangler pages deploy dist --project-name ccc-dashboard                 # production
npx wrangler pages deploy dist --project-name ccc-dashboard --branch dev    # development
```

## Notes

- The backend's `getEventLogs` action filter param is `actionFilter` (not `action`, which is reserved for route selection).
- `getPrisoners` is only available via `GET /api/prisoners`; the dashboard uses that alias.
- Chart theming follows the app's dark mode toggle (ECharts `dark` theme registered in `src/lib/utils/echarts.ts`).
