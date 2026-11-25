# IMPL: Header navigation experiment

**Slug:** `header-nav`
**Status:** Locked for isolated experiment, 2026-11-24
**Date:** 2026-11-24
**Refined:** 2026-11-25 - tab treatment and one right-hand action group
**Origin:** `docs/features/header-nav/GRILL-header-nav.txt`
**Contract:** `docs/features/header-nav/PRD-TRD-header-nav.md`

## Phase order

1. Record the decision override in the wayfinder ticket and map.
2. Replace the shell wrapper in `layout.tsx`.
3. Restyle `Nav.tsx` as an inline header with the same link list.
4. Update CSS: topbar, `--topbar-h`, page height calcs, narrow-screen scroll.
5. Gates and local preview on port 4173. Do not merge.

## Phase 1 — decision record

**Proof:** ticket and map name the override and rollback path.

## Phase 2/3 — shell and nav

**Files:** `v1/src/app/layout.tsx`, `v1/src/app/Nav.tsx`.

- Keep the five links, `usePathname` active rule and `prefetch={false}` in one
  shared list; desktop tabs and the phone menu both read from it.
- Keep ThemeButton reachable in the header, with the install control and the
  phone menu button beside it in one `top-actions` group.
- The phone menu closes on route change, Escape or a tap outside, and has an
  `aria-expanded` button plus a labelled panel.

**Proof:** typecheck and lint; built HTML contains all five labels.

## Phase 4 — CSS

**Files:** `v1/src/app/header-nav.css` (new), `v1/src/app/layout.tsx`.
`v1/src/app/globals.css` stays as it is on `main`, so the experiment is one seam.

- `header-nav.css` holds every header-nav rule and override under one
  `WHY / PACK / date` banner. `layout.tsx` imports it after `globals.css` and
  adds one `shell--header` class, which scopes all page overrides.
- One sticky header row; desktop tabs scroll the current link into view. Below
  860px the tab row is hidden and one menu button opens a panel of the same five
  routes, marked with the shared active rule.
- Links are full-height tabs with a transparent bottom border; the current
  route paints it with a muted accent. The base stylesheet's pill background
  and inset shadow are cleared on hover and on the active tab, so only a quiet
  line and slightly stronger text mark the route.
- The install and theme controls share one ghost button shape and size.
- `--shell-max` caps the header and content together at 1760px, and one
  `--shell-gutter` token keeps their left and right edges equal at every width.
- Overrides, not deletions: `.shell--header .study-plan-layout` drops the
  1214px centred cap and `.shell--header .modes-page` drops the 980px cap.
- Small screens: page heights use the real 76px content inset below 860px;
  Library stops being a fixed-height page below 1100px; editor panes stack;
  touch devices see mode actions without hover; sticky side panels clear the
  header; installed PWA still hides the install control.

**Proof:** `npm run build` with `check-pwa: passed`; true 390px viewport checked
through Chrome DevTools Protocol, not a cropped headless screenshot.

## Phase 5 — gates and preview

**Proof:** 1264 tests in 101 files, build with `check-pwa: passed`, typecheck,
changed-file eslint, both drift gates; Windows reachability check before opening
the browser. A true 390px viewport through Chrome DevTools Protocol measured
`scrollWidth = 390` on all five routes after the stacked Library grid was given
a zero minimum. The phone menu was checked at 390px: five links, the current
route marked, Escape and an outside tap both close it, a link navigates and
closes it, and desktop still shows the tab row with no menu button. The
study-sidebar simulation's scenario 7 passes; its scenario 8 was already failing
before this branch because the re-learn callback was renamed. No merge.

## Rollback

Discard `feature/header-nav` and rebuild `main`. No data migration.

## Out of scope

No route, prompt, data, schema or screen behavior change. No merge to `main`.
