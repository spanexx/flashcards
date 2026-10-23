# IMPL: PWA deploy

Status: Implemented under delegated authority, 2026-10-23
Date: 2026-10-23
Pack: `pwa-deploy`
PRD-TRD: `PRD-TRD-pwa-deploy.md`

## Phase 1: base path

Files: `v1/src/lib/shared/paths.ts` (new), `v1/next.config.ts`,
`v1/src/lib/browser/bundle.ts`, `v1/src/app/library/CreatePanel.tsx`,
`v1/tests/paths.test.ts` (new).

- Add `BASE_PATH` normalised from `NEXT_PUBLIC_BASE_PATH`.
- Add `withBasePath(path)`.
- Pass `basePath` to Next.
- Prefix the starter pack fetch and the plain settings link.
- Test empty, root and project spellings.

Verification: targeted `npx vitest run tests/paths.test.ts`.

## Phase 2: manifest and install affordance

Files: `v1/public/manifest.webmanifest` (new),
`v1/scripts/make-pwa-icons.mjs` (new), `v1/public/icons/*.png` (new),
`v1/src/app/InstallButton.tsx` (new), `v1/src/app/layout.tsx`,
`v1/src/app/globals.css`.

- Write the standalone manifest with relative start/scope and three icons.
- Generate valid RGBA PNGs without a dependency.
- Add the fixed top-right install button:
  - capture `beforeinstallprompt`;
  - prompt when available;
  - toggle a plain hint when not;
  - hide on `appinstalled` and under `display-mode: standalone`;
  - expose `data-install-prompt` for the lane.
- Add manifest/icon metadata and viewport theme to the root layout.
- Style the button and reserve top-bar space on mobile.

Verification: typecheck, lint, visual screenshots at 390px.

## Phase 3: service worker and hard build gate

Files: `v1/scripts/build-pwa.mjs` (new), `v1/scripts/check-pwa.mjs` (new),
`v1/src/app/PwaBoot.tsx` (new), `v1/package.json`.

- `prebuild` regenerates icons.
- `build` runs `next build`, then `build-pwa`, then `check-pwa`.
- `build-pwa` walks `out/`, excludes the worker and error pages, hashes the
  remaining content and writes a relative precache list plus a scoped worker.
- The worker is network-first for navigation and cache-first for same-origin
  assets. It does not call `skipWaiting`; activation only deletes caches with
  the same app-path prefix.
- `check-pwa` validates routes, manifest, icon pixels, HTML links, base path,
  worker handlers, precache entries and every `_next/static` asset.
- `PwaBoot` registers the worker only in production.

Verification: `NEXT_PUBLIC_BASE_PATH=/flashcards npm run build`; inspect
`out/sw.js` and `out/index.html`.

## Phase 4: responsive fixes

Files: `v1/src/app/globals.css`.

- Add `align-content: start` to the one-column shell so the top bar does not
  stretch to a full viewport.
- Reserve right padding for the install button at 860px and below.
- Move job toasts below the install button.
- Allow `.scroll-area` to scroll horizontally and give its table a minimum
  width.
- Wrap pack and deck rows on a phone.
- Keep the study and Create breakpoints.
- Add a standalone display-mode rule.

Verification: external lane at 390, 768 and 1280px.

## Phase 5: GitHub Pages workflow

Files: `.github/workflows/pages.yml` (new).

- Trigger on `main` and `workflow_dispatch`.
- Build with Node 22 and `NEXT_PUBLIC_BASE_PATH=/flashcards`.
- Run typecheck, lint, build, test and `check:pwa`.
- Upload `v1/out` as the Pages artifact.
- Deploy with `actions/deploy-pages@v4`.
- Curl the live page, manifest and worker with bounded retries.

Verification: workflow YAML review; live run after push.

## Phase 6: tests and rehearsal

Files: `v1/tests/pwa-deploy.test.ts` (new),
`v1/tests/paths.test.ts` (new).

- Pin the manifest, icon dimensions, one base path in the built HTML, worker
  scope and precache coverage.
- Run the full suite after a base-path build.
- Run the external lane against a secure local origin.
- Capture phone and desktop screenshots.
- Clean up the server and headless browser.

Verification: `npm run typecheck`, `npm run lint`, `npm run build`,
`NEXT_PUBLIC_BASE_PATH=/flashcards npm test`, external lane.

## Phase 7: docs and landing

- Write the GRILL, PRD-TRD, IMPL and both simulations.
- Commit with the `spanexx` identity using a message file.
- Fast-forward `main`, push, watch the Pages workflow, curl the live app.
- Update the ledger. Do not amend or force-push.

## Run order

```text
npm run typecheck
npm run lint
NEXT_PUBLIC_BASE_PATH=/flashcards npm run build
NEXT_PUBLIC_BASE_PATH=/flashcards npm test
```

## Implementation record

Implemented on 2026-10-23 in the `feature/pwa-deploy` worktree.

- `paths.ts` is the single base-path helper.
- `InstallButton` and `PwaBoot` are shell components; the install button is on
  every page.
- The manifest and icons are committed; the icon generator is deterministic.
- `build-pwa.mjs` wrote a 49-file precache in the final build.
- `check-pwa.mjs` passed the base-path export and is part of `npm run build`.
- The responsive pass fixed a real phone bug: the one-column shell was
  stretching the top bar to the viewport height, leaving a large blank band.
- The Pages workflow is ready; the live deploy is verified after landing.

Verification:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `NEXT_PUBLIC_BASE_PATH=/flashcards npm run build` passed.
- `NEXT_PUBLIC_BASE_PATH=/flashcards npm test` passed: 43 files, 439 tests.
- External Edge lane passed: base path seed, valid manifest, no installability
  errors, scoped worker, 49-file cache, controlled page, no phone overflow,
  install button clear of navigation, study/Create phone fit, all four screens
  at 390/768/1280, offline reload.

Deviations:

- The installability check must run on `127.0.0.1` (secure local origin); a LAN
  address is reported as `not-from-secure-origin`.
- Headless Edge offers an install prompt, so the lane asserts the prompt path
  and does not force the manual hint path. The hint path remains covered by the
  component state and the `data-install-prompt` attribute.
- Error pages are excluded from the precache because `cache.addAll` rejects a
  non-2xx response.
- `skipWaiting` is deliberately omitted to protect open pages during a deploy.
