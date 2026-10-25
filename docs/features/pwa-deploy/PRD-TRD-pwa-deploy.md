# PRD-TRD: PWA deploy

Status: Shipped and live, 2026-10-23
Date: 2026-10-23
Pack: `pwa-deploy`
GRILL: `GRILL-pwa-deploy.txt`

## 1. Why

The app is browser-owned, but it still behaves like a desktop page served from a
developer machine. On a phone the top bar takes too much vertical room and a
wide progress table can push the page sideways. There is no manifest, no
service worker and no install affordance, so the browser cannot install it or
open it offline. The live GitHub Pages address is a 404 because nothing deploys
the static export.

This pack makes the app fit every screen, installable, usable offline and
deployable to `https://spanexx.github.io/flashcards/` from `v1/out`, with a
build gate that refuses an export that would break on Pages.

## 2. What this pack promises

1. **Every screen fits a phone.** Study, Library, Progress, Settings and Create
   have no horizontal page scroll at 390px. The shell is one column below 860px.
2. **The app installs.** A manifest, three real PNG icons (192, 512, maskable),
   a service worker with a fetch handler and a fixed top-right install button.
3. **The app opens offline.** The worker precaches every exported route, page
   payload, icon, pack and hashed asset. A reload with the network off renders
   the shell and the seeded plan.
4. **The project path is honest.** The build works at `/flashcards/`; the
   manifest, worker and app-written links all use the same base path.
5. **A deploy is a checked deploy.** CI runs typecheck, lint, build, tests and
   the export checker before publishing. After publishing it curls the live
   page, manifest and worker.
6. **Nothing else moves.** No API, schema, storage, judge or provider change.

## 3. User-facing behaviour

### 3.1 Responsive shell

- Above 860px the shell keeps the fixed-width sidebar and the centred content
  column.
- At 860px and below the shell becomes one grid column. The sidebar becomes a
  compact top bar: brand, then the four links. It no longer stretches to fill
  the viewport, so there is no large blank band above the page.
- On a phone the top bar is pinned while the page scrolls, and its background
  is translucent with a blur, so the four links stay reachable over moving
  content.
- The top bar reserves space on the right for the install button.
- Content padding drops to 16px. The create grid becomes one column at 760px.
- `.scroll-area` scrolls horizontally and the progress table has a minimum
  width, so a narrow phone scrolls the table inside its card instead of the
  whole page.
- Pack and deck rows wrap on a phone; their action rows take the full width.
- The install button sits at 16px/18px from the top right (12px/14px on a
  phone). Job toasts start below it instead of underneath it.
- Images, code blocks and inputs keep their existing `max-width` and wrapping
  rules. The study card keeps its Pack 3 phone layout.

### 3.2 Install button

- A round button with a download glyph is fixed at the top right of every page.
- It has `aria-label="Install app"` and `title="Install app"`.
- When the browser fires `beforeinstallprompt`, the button stores the event and
  clicking it opens the browser's install prompt. The button carries
  `data-install-prompt="ready"` in that state.
- When no prompt is available, clicking toggles a short hint: "Use the browser
  menu or Share -> Add to Home Screen." The button carries
  `data-install-prompt="manual"`.
- After `appinstalled`, the button disappears.
- The button is hidden by CSS when the app is already running with
  `display-mode: standalone`.
- It is never the only way to install; the browser menu remains available.

### 3.3 Manifest and icons

- `public/manifest.webmanifest`:
  - `name` and `short_name`: Flashcards
  - `display`: standalone
  - `start_url` and `scope`: `./`
  - theme `#2f5d50`, background `#f7f6f3`
  - icons: 192 any, 512 any, 512 maskable
- The icon generator is a dependency-free Node script that writes valid RGBA
  PNGs: a deep green field with the Lucide Layers mark, three stacked chevrons.
- `src/app/icon.svg` draws the same three chevrons, so the tab and install
  icons agree.
- The icons are committed and regenerated before every build.
- The root layout links the manifest and both icon sizes; the Apple touch icon
  uses the 192px file.

### 3.4 Service worker

- `scripts/build-pwa.mjs` runs after `next build` and writes `out/sw.js`.
- It walks every exported file except `sw.js` and the error pages
  (`404.html`, `404/index.html`, `_not-found/index.html`), so install cannot
  fail on a 404 status.
- The precache list uses relative URLs (`./`, `./library/`, ...), which resolve
  correctly at the root and under `/flashcards/`.
- The cache name is
  `flashcards:<registration scope>:<content hash>`. Activation only deletes
  caches with the same prefix and a different version; it never deletes another
  app's caches on the same Pages origin.
- Install fetches and stores the precache list. A new worker does **not** call
  `skipWaiting`; it waits until the old clients are gone. This avoids deleting
  hashed assets under a page that is still open.
- Activate claims clients.
- Fetch:
  - non-GET and cross-origin requests are left alone;
  - navigation is network-first, falling back to the cached request, then the
    cached shell, then a plain 503;
  - other same-origin GETs are cache-first and update the cache on a good
    network response.
- `PwaBoot` registers `/sw.js` with scope `/` (both prefixed by the base path)
  only in a production build. A failed registration is silent; online use is
  unaffected.

### 3.5 Base path

- `src/lib/shared/paths.ts` normalises `NEXT_PUBLIC_BASE_PATH` to `""` or
  `/name` and exposes `withBasePath(path)`.
- `next.config.ts` passes it to Next's `basePath`.
- `bundle.ts` uses `withBasePath` for the starter pack fetch.
- `CreatePanel` uses it for the "Open Settings in a new tab" link.
- Next `Link`s, assets and route links are prefixed by Next automatically.
- The manifest and worker stay relative so the export is not tied to one host
  path.

### 3.6 GitHub Pages deploy

- Workflow `.github/workflows/pages.yml` runs on pushes to `main` and by hand.
- Build job: Node 22, `npm ci`, typecheck, lint, build, test, export check.
- The build sets `NEXT_PUBLIC_BASE_PATH=/flashcards`.
- The artifact is `v1/out`; the deploy job uses `actions/deploy-pages@v4`.
- After deploy, the workflow curls the page URL, then the manifest and `sw.js`.
  It retries six times, ten seconds apart, and fails if the page is not 200.
- Live proof on 2026-10-23: run `39908324755` passed; the app, manifest and
  worker answer 200 at `https://spanexx.github.io/flashcards/`.

## 4. Build validation

`scripts/check-pwa.mjs` is run by `npm run build` and by `npm run check:pwa`.
It fails on any of these:

- `out/index.html` missing, or any of `library`, `progress`, `settings`,
  `404.html` missing.
- No `_next/static` assets.
- Manifest not valid JSON, missing required fields, missing icons, a non-PNG
  icon, or an icon whose real pixel size does not match its `sizes`.
- No maskable icon.
- A root-relative `href`/`src` in any HTML file that does not start with the
  configured base path, or points at a file that is not in `out`.
- A page without the manifest link, or with the wrong manifest URL.
- The home page without the install button or theme-color.
- `sw.js` missing, or missing install/activate/fetch handlers, a scope-based
  cache name, or a relative precache list.
- A precache entry that is missing from `out`, or a built `_next/static` asset
  that is not precached.
- A localhost URL in the worker.

## 5. Components

- `src/lib/shared/paths.ts` (new): base path normalisation.
- `src/app/PwaBoot.tsx` (new): production service-worker registration.
- `src/app/InstallButton.tsx` (new): install prompt, manual hint, standalone
  hide.
- `src/app/layout.tsx`: manifest/icon metadata, viewport theme, both components.
- `src/app/globals.css`: install styles, responsive fixes, toast offset.
- `next.config.ts`: basePath.
- `src/lib/browser/bundle.ts`: starter fetch under the base path.
- `src/app/library/CreatePanel.tsx`: settings link under the base path.
- `scripts/make-pwa-icons.mjs` (new): PNG icon generator.
- `scripts/build-pwa.mjs` (new): post-build worker generator.
- `scripts/check-pwa.mjs` (new): hard export gate.
- `package.json`: `prebuild`, `build`, `check:pwa`, `icons` scripts.
- `.github/workflows/pages.yml` (new): Pages CI and deploy.
- `public/manifest.webmanifest` and `public/icons/*.png` (new).

## 6. Edge cases

- **Root deploy:** `NEXT_PUBLIC_BASE_PATH` empty; manifest and worker still use
  relative URLs; checker expects `/manifest.webmanifest`.
- **Project deploy:** all local URLs start with `/flashcards/`; worker scope is
  `/flashcards/`.
- **No install prompt:** button shows the manual hint.
- **Prompt available:** button opens the browser prompt; no hint is forced.
- **Already standalone:** button is hidden by CSS.
- **Old worker + open page:** new worker waits, so hashed assets are not
  removed under the page.
- **Offline first visit:** nothing is cached yet, so the browser shows its own
  offline page; the app is offline-capable only after one online visit.
- **Offline navigation to an unknown path:** the cached shell is returned.
- **Bad icon:** build fails on the pixel-size check.
- **Missing asset link:** build fails before deploy.
- **404 pages:** excluded from precache so `cache.addAll` cannot reject.
- **Phone with a wide table:** the table scrolls inside `.scroll-area`.
- **Install button over the top bar:** the sidebar reserves right padding at
  mobile widths.

## 7. Tests

### Unit / integration

- `tests/paths.test.ts`: empty, `/`, `/flashcards`, `flashcards` and trailing
  slash all normalise to one prefix.
- `tests/pwa-deploy.test.ts`:
  - manifest fields and three real PNG icons with matching dimensions;
  - install button, manifest link, theme-color and one base path across the
    built HTML;
  - worker handlers, scoped cache name, relative precache, every route and
    every `_next/static` asset;
  - home and 404 routes exist.
- `npm run build` runs `check-pwa` and fails on any violation.

### External lane

- Build with `NEXT_PUBLIC_BASE_PATH=/flashcards`.
- Serve `out` under `/flashcards/` from a secure local origin.
- Edge DevTools Protocol:
  - the seeded plan loads through the base path;
  - `Page.getAppManifest` finds a valid manifest with no errors;
  - `Page.getInstallabilityErrors` is empty;
  - the worker scope and script are under `/flashcards/`, and its cache holds
    49 files including all routes, the manifest and an icon;
  - the page becomes controlled by the worker;
  - at 390px there is no page overflow and the install button does not cover
    navigation;
  - the study card and Create panel fit a phone;
  - Study, Library, Progress and Settings fit at 390, 768 and 1280px;
  - with the network off, a reload still renders "Today's session".
- Clean up the local server and headless Edge profile.

## 8. Non-goals

- A server, database or accounts.
- Push notifications, background sync or a custom offline editor.
- App-store packaging.
- Changing the visual language beyond responsive fixes.
- A custom domain or root Pages site.
- Testing iOS Safari install behaviour in CI.

## 9. Risks and named edges

- **Pages propagation:** the live curl can lag behind the deploy. The workflow
  retries for up to a minute.
- **Worker updates:** without `skipWaiting`, an update waits for old tabs. This
  is deliberate; a learner can close and reopen to get it.
- **Cache size:** the precache is the whole export (49 files, mostly hashed
  chunks). It is small for this app.
- **Headless installability:** it needs a secure origin. The lane uses
  `127.0.0.1`; a LAN IP is rejected as insecure.
- **Real provider:** still unverified without a key; this pack does not touch
  provider calls.
