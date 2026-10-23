// WHY: GitHub Pages serves this app from a project subpath. One small helper
// keeps the manifest, the service worker and the few plain links on the same
// base path as Next's own links.
// PACK: pwa-deploy
// 2026-10-23 opencode: created for the pwa-deploy pack [pack: pwa-deploy]

/** The deploy subpath, normalised to "" or "/name" with no trailing slash. */
export const BASE_PATH = (() => {
  const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();
  if (!raw || raw === "/") return "";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
})();

/** Prefix a root-relative path with the deploy subpath. */
export function withBasePath(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}
