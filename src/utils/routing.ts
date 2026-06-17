// ===== Routing Utilities =====
// Helpers for handling routes in a base-path-aware way.
// GitHub Pages serves the site under /<repo-name>/, so all internal
// routing must be resolved relative to the configured base.
//
// The base path is detected from `import.meta.env.BASE_URL` (set by Vite
// from `vite.config.ts > base`). It always ends with `/`.

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, ''); // e.g. "" or "/stemmagraph"

/**
 * Strip the base prefix from a pathname so routing code can match
 * against logical routes like "/dashboard" regardless of deployment path.
 *
 *   "/stemmagraph/family-tree/x" → "/family-tree/x"
 *   "/dashboard"                 → "/dashboard"
 */
export function stripBase(pathname: string): string {
  if (BASE && pathname.startsWith(BASE)) {
    return pathname.slice(BASE.length) || '/';
  }
  return pathname;
}

/**
 * Get the current logical route (without base prefix).
 */
export function currentRoute(): string {
  return stripBase(window.location.pathname);
}

/**
 * Build a full URL (with base prefix) for a logical route.
 * Use this with `window.history.pushState` so the URL bar reflects the
 * correct absolute path.
 */
export function buildUrl(logicalRoute: string): string {
  const route = logicalRoute.startsWith('/') ? logicalRoute : `/${logicalRoute}`;
  return `${BASE}${route}`;
}

/**
 * Push a logical route onto the history stack (base-aware).
 */
export function pushRoute(logicalRoute: string): void {
  window.history.pushState({}, '', buildUrl(logicalRoute));
}

/**
 * Replace the current history entry with a logical route (base-aware).
 */
export function replaceRoute(logicalRoute: string): void {
  window.history.replaceState({}, '', buildUrl(logicalRoute));
}

/**
 * Build an absolute URL (including base prefix) for a logical route.
 * Use this with `window.location.href` when you want a full page reload
 * (e.g. after creating a tree, after upgrade).
 *
 *   navigate('/family-tree/abc')  → window.location.href = '/stemmagraph/family-tree/abc'
 */
export function navigate(logicalRoute: string): void {
  window.location.href = buildUrl(logicalRoute);
}
