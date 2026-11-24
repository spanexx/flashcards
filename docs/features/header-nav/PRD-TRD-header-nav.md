# PRD-TRD: Header navigation experiment

**Slug:** `header-nav`
**Status:** Locked for isolated experiment, 2026-11-24
**Date:** 2026-11-24
**Origin:** `docs/features/header-nav/GRILL-header-nav.txt`
**Branch:** `feature/header-nav` only. Not merged to `main`.

## 1. Why this exists

The sidebar was locked in `ui-shell.md`, but Victor asked to try a top header.
The goal is to see the five destinations in one compact row and reclaim the
left column. The experiment must be reversible without a migration.

## 2. What it does

### 2.1 One sticky header

`layout.tsx` renders one header bar above the content column instead of an
aside. `Nav.tsx` puts the brand on the left, the same five text links inline,
and the theme toggle on the right. Active-link logic is unchanged.

### 2.2 Same routes, same behavior

Study, Library, Learning modes, Progress and Settings keep their paths, labels
and `prefetch={false}` links. No route, schema, prompt or screen logic changes.

### 2.3 Viewport-aware shell

The header height is a CSS variable. Every page that reserves one-screen height
subtracts it, so the compact editor, modes, library and study layouts still
fill exactly one viewport. Narrow screens keep one header row with horizontal
link scrolling instead of a second navigation bar.

## 3. Behavioural spec

1. **Given** any screen, **when** it loads, **then** one header shows all five
   links and no sidebar is present.
2. **Given** the current route, **when** the header renders, **then** exactly
   one link has `aria-current="page"`.
3. **Given** a narrow viewport, **when** the header renders, **then** links stay
   in one row and scroll horizontally; no second bar appears.
4. **Given** a page with a fixed one-screen layout, **when** it renders, **then**
   its content still fits below the header and does not double-scroll.
5. **Given** Victor rejects the experiment, **when** the branch is discarded,
   **then** `main` is untouched and needs no migration.

## 4. Technical design

- `v1/src/app/layout.tsx`: header wrapper instead of aside wrapper.
- `v1/src/app/Nav.tsx`: inline navigation markup, same link list and hook.
- `v1/src/app/globals.css`: `.topbar*` classes, `--topbar-h`, height calc updates,
  narrow-screen link scroll.
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
