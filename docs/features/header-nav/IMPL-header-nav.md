# IMPL: Header navigation experiment

**Slug:** `header-nav`
**Status:** Locked for isolated experiment, 2026-11-24
**Date:** 2026-11-24
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

- Keep the five links, `usePathname` active rule and `prefetch={false}`.
- Keep ThemeButton reachable in the header.

**Proof:** typecheck and lint; built HTML contains all five labels.

## Phase 4 — CSS

**Files:** `v1/src/app/globals.css`.

- One sticky header row; links scroll horizontally on narrow screens.
- Every fixed-height page subtracts `--topbar-h`.

**Proof:** `npm run build` with `check-pwa: passed`.

## Phase 5 — gates and preview

**Proof:** full tests once, typecheck, eslint, both drift gates; Windows
reachability check before opening the browser. No merge.

## Rollback

Discard `feature/header-nav` and rebuild `main`. No data migration.

## Out of scope

No route, prompt, data, schema or screen behavior change. No merge to `main`.
