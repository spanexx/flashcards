# Post-implementation simulation: PWA deploy

Status: Passed locally and live, 2026-10-23
Pack: `pwa-deploy`
Canonical checks: `v1/tests/paths.test.ts`,
`v1/tests/pwa-deploy.test.ts`, `v1/scripts/check-pwa.mjs`
External lane: `pwa-deploy-lane.mjs` (temporary, not committed)

## What this rehearsal proves

The pre-implementation simulation showed four promises as a design. This
post-implementation rehearsal uses the real base-path build, the generated
worker and Edge DevTools Protocol.

1. **Phone layout.** At 390px, Study, Library, Progress, Settings and the Create
   panel have no horizontal page scroll. The top bar is compact and the install
   button does not cover navigation.
2. **Install.** The browser finds the manifest at
   `/flashcards/manifest.webmanifest`, reports no installability errors, and
   offers its own install prompt. The fixed top-right button is present on
   every page.
3. **Offline.** The worker is scoped to `/flashcards/`, precaches 49 files, and
   controls the page. With the network emulated off, a reload still renders
   "Today's session".
4. **Deploy.** `npm run build` writes the export, generates `sw.js`, and passes
   `check-pwa`. The workflow published `v1/out` and curled the live page,
   manifest and worker.

## Results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `NEXT_PUBLIC_BASE_PATH=/flashcards npm run build`: passed.
- `check-pwa`: passed (base path `/flashcards`, 53 files, 51 precache lines).
- `NEXT_PUBLIC_BASE_PATH=/flashcards npm test`: 43 files / 439 tests passed.
- Live deploy: Pages run `39908324755` passed; the page, manifest and worker
  answer 200 at `https://spanexx.github.io/flashcards/`.
- External Edge lane, local and live:
  - app loads and seeds from `/flashcards/`;
  - manifest URL and fields valid, no installability errors;
  - worker scope `/flashcards/`, script `/flashcards/sw.js`, 49 cached files;
  - all routes, manifest and icon are cached;
  - page controlled by the worker;
  - 390px: no overflow, install button clear of navigation;
  - study card and Create panel fit;
  - all four screens fit at 390, 768 and 1280;
  - offline reload renders the shell and plan.

## What differs from the pre-implementation simulation

- The design simulation assumed the phone top bar would simply wrap. The real
  one-column grid stretched the sidebar to the viewport height, leaving a large
  blank band. `align-content: start` on the mobile shell fixed it.
- Installability needs a secure origin. The first lane run used the WSL LAN
  address and Edge reported `not-from-secure-origin`; the local lane now uses
  `127.0.0.1` and the live lane uses HTTPS.
- Headless Edge offers an install prompt, so the lane asserts the prompt path.
  The manual hint path is represented by `data-install-prompt="manual"` and the
  component state, but is not forced in this lane.
- The worker does not call `skipWaiting`. The design simulation did not name
  this; the implementation chose to protect open pages from losing hashed
  assets during a deploy.
- Error pages are excluded from the precache. `cache.addAll` rejects a non-2xx
  response, and a Pages error route is not guaranteed to be 200.

## Named limits

The live Pages address was verified after the branch landed and the workflow
ran; this rehearsal proves the artifact locally and repeats the same lane
against the live address. A real provider key remains unverified. The offline
test runs in Edge, not every browser. iOS Safari install behaviour is not
exercised.
