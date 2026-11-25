# PRD-TRD: Header navigation experiment

**Slug:** `header-nav`
**Status:** Locked for isolated experiment, 2026-11-24
**Date:** 2026-11-24
**Refined:** 2026-11-25 - quiet tab links, one action group
**Origin:** `docs/features/header-nav/GRILL-header-nav.txt`
**Branch:** `feature/header-nav` only. Not merged to `main`.

## 1. Why this exists

The sidebar was locked in `ui-shell.md`, but Victor asked to try a top header.
The goal is to see the five destinations in one compact row and reclaim the
left column. The experiment must be reversible without a migration.

## 2. What it does

### 2.1 One sticky header

`layout.tsx` renders one header bar above the content column instead of an
aside. `Nav.tsx` puts the brand on the left, the same five text links as quiet
underline tabs, and one right-hand group holding the install and theme
controls. Active-link logic is unchanged. The tab treatment keeps the row calm:
no floating pills, one accent underline on the current route.

### 2.2 Same routes, same behavior

Study, Library, Learning modes, Progress and Settings keep their paths, labels
and `prefetch={false}` links. No route, schema, prompt or screen logic changes.

### 2.3 Viewport-aware shell

The header height is a CSS variable. Every page that reserves one-screen height
subtracts it, so the compact editor, modes, library and study layouts still
fill exactly one viewport. Header and content share one width cap, so a wide
monitor keeps modest gutters instead of the large empty columns the sidebar used
to hide. The Study plan and the modes list no longer keep their own narrower
caps, so every page body starts and ends at the same edges. On a narrow screen
the header keeps one row and swaps the five-link tab row for a menu button; the
button opens one panel with the same routes instead of a second navigation bar.

## 3. Behavioural spec

1. **Given** any screen, **when** it loads, **then** one header shows all five
   links and no sidebar is present.
2. **Given** the current route, **when** the header renders, **then** exactly
   one link has `aria-current="page"`.
3. **Given** a narrow viewport, **when** the header renders, **then** the tab row
   is replaced by one menu button in the header; opening it shows the same five
   routes, with the current one marked, and no second bar appears.
4. **Given** a page with a fixed one-screen layout, **when** it renders, **then**
   its content still fits below the header and does not double-scroll.
5. **Given** Victor rejects the experiment, **when** the branch is discarded,
   **then** `main` is untouched and needs no migration.

## 4. Technical design

- `v1/src/app/layout.tsx`: header wrapper instead of aside wrapper; adds one
  `shell--header` class and imports the experiment stylesheet after `globals.css`.
- `v1/src/app/Nav.tsx`: one shared link list and active-path rule; desktop tabs
  scroll the active link into view, phones show a menu button and panel that
  closes on route change, Escape or a tap outside.
- `v1/src/app/header-nav.css`: all `.topbar*` classes, shell tokens, page
  overrides and narrow-screen rules in one branch-only file. `globals.css`
  keeps the base rules from `main`.
- `wayfinder/anything-learning-spec/tickets/ui-shell.md` and `map.md`: decision
  override and rollback note.

## 5. Non-goals

No new route, dependency, data change, prompt change or screen behavior change.
No merge to `main` without a separate approval.

## 6. Acceptance evidence

```bash
cd v1
npm run build
npm test
npx tsc --noEmit
npx eslint <changed files>
npm run check:drift && npm run check:drift:staged
```

Build passes `check-pwa`; the header links appear in built HTML; no screen logic
changed.
