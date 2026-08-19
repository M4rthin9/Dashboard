/**
 * Which deployment is this bundle running in?
 *
 * `import.meta.env.PROD` is true for BOTH the production Pages deployment and
 * the dev one — `vite build` always sets it — so it cannot be used to tell them
 * apart. The deploy hostname is the only reliable runtime signal:
 *
 *   production   ccc-dashboard-6jh.pages.dev  /  dashboard.cida.dpdns.org
 *   development  dev.ccc-dashboard-6jh.pages.dev
 *   local        localhost / 127.0.0.1
 */

const host = typeof location === 'undefined' ? '' : location.hostname;

/** True on the dev Pages deployment (the `dev` branch alias). */
export const isDevDeployment = host.startsWith('dev.');

/** True when served by `vite dev` on a developer machine. */
export const isLocal = host === 'localhost' || host === '127.0.0.1';

/**
 * Production is the only place the service worker should run. public/sw.js uses
 * a static cache name (`ccc-dashboard-v1`) with no versioned invalidation, so on
 * dev it happily serves the bundle from before the change you are testing.
 */
export const shouldRegisterServiceWorker = import.meta.env.PROD && !isDevDeployment && !isLocal;
