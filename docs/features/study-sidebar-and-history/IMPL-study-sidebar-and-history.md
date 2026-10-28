# IMPL: Study sidebar and previous sessions

**Slug:** study-sidebar-and-history
**Status:** Implemented; awaiting human review
**Date:** 2026-10-27

## Phase Plan

**Before Phase 1:** no new external dependency, so no `opensrc` run is needed.
The worktree is `feature/study-sidebar-and-history`, created with
`agent-worktree feature study-sidebar-and-history`. It needs its own `npm ci`
because its `node_modules` lives on the Linux filesystem.

### Phase 1: the session fact and the list builder

**Build:**
- `v1/src/lib/shared/types.ts` — optional `pack` and `deck` on `SessionEvent`.
- `v1/src/lib/core/past-sessions.ts` — `PastSession` and
  `recentSessions(events, limit)`.
- `v1/src/lib/browser/router.ts` — read sessions once, return `past` on every
  plan response, write `pack`/`deck` on the started fact, and copy them onto the
  ended fact because the store keeps one fact per session.
- `v1/src/lib/browser/bundle.ts` — accept both fields in the backup schema.
- `v1/tests/past-sessions.test.ts` — pairing, order, cap, scope, old rows.

**Verify:**
- [x] `node node_modules/vitest/vitest.mjs run tests/past-sessions.test.ts`
- [x] `npx tsc --noEmit`

**Blocked by:** nothing.

### Phase 2: the right panel

**Build:**
- `v1/src/app/study/PlanAside.tsx` — the three sections, tabs for desktop, and
  the stacked mobile fold.
- `v1/src/app/study/StudyPlan.tsx` — use the layout wrapper; remove the three
  disclosures from the main column.
- `v1/src/app/globals.css` — grid, sticky aside capped at the viewport with its
  own scrolling body, breakpoint at 860px.

**Verify:**
- [x] `npx tsc --noEmit`
- [x] changed-file lint

**Blocked by:** Phase 1 for the types; the panel itself does not read `past`.

### Phase 3: previous sessions and re-learning

**Build:**
- `v1/src/app/study/PreviousSessions.tsx` — the five rows, the empty line, the
  scope label, "Learn again".
- `v1/src/app/StudyClient.tsx` — hold `past`, pass it in, handle
  `onRelearn(pack, deck)` through `loadPlan`.
- `v1/src/app/study/StudyPlan.tsx` — render the list under Start.
- `v1/src/app/globals.css` — list row and phone layout.

**Verify:**
- [x] `npx tsc --noEmit`
- [x] changed-file lint

**Blocked by:** Phases 1–2.

### Phase 4: the whole suite and the build

**Verify:**
- [x] `node node_modules/vitest/vitest.mjs run` — all files pass.
- [x] `npm run build` — succeeds; PWA check passes.

**Blocked by:** Phase 3.

### Phase 5: the post-impl simulation and drift

**Build:**
- `docs/features/study-sidebar-and-history/simulate.mjs` — the list rules
  through the real builder, plus shipped-source and built-chunk checks.

**Verify:**
- [x] `node docs/features/study-sidebar-and-history/simulate.mjs` — 9 scenarios,
  including the capped, self-scrolling panel.
- [x] served `out/` returns 200 from Windows on localhost and the WSL address.
- [x] drift sub-agent; gaps fixed or logged. Findings fixed: the tab now reads
  "Tutorial and hints", the tutor heading is back, old rows leave the scope
  blank, the status is only finished or stopped, and the docs now say the ended
  fact carries the scope.
- [x] `npm run check:drift` and `check:drift:staged`.

**Blocked by:** Phase 4.

### Phase 6: reconcile and hand off

**Build:**
- Archive `simulate-pre.html`; keep `simulate.mjs` as canonical.
- `.reports/goal-study-sidebar-and-history.md` iteration entries.

**Verify:**
- [x] pre-sim archived; no scenario contradicts the Behavioral Spec.
- [ ] PR opened with the evidence; human-review gate raised, loop stopped.

**Blocked by:** Phase 5.

## Phase Dependencies

Phase 1 → 2 → 3 → 4 → 5 → 6. The panel and the list share the plan layout, so
the build and the visual check happen after both are in place.

## Test Strategy

Pure tests for `recentSessions` in `v1/tests/past-sessions.test.ts` (node
environment). The router's `past` payload is covered through the existing plan
route tests once the suite runs. The panel is proven by the pre-sim, the built
chunk and human review; the suite has no DOM.

## Dependency Analysis (opensrc)

None. No new package.

## Rollout

No migration. Old session rows simply lack a scope. Removing the feature is a
revert of the layout and the added fields; the append-only session facts keep the
extra optional fields harmlessly.

## Risk Notes

- A pack or deck may be renamed or deleted after the row was written. The row
  still shows the stored name; "Learn again" then rebuilds into the empty-plan
  message rather than inventing cards.
- The plan endpoint writes a started fact on every rebuild, as it already did.
  The list only shows ended facts, so a rebuild that is never studied leaves no
  row.
- The date is formatted in the learner's locale on the client; there is no
  server-rendered history to mismatch.

## Amendment (2026-10-28): the phone fold reuses the tabs

The learner opened Plan details on a phone and found every section laid out at
once, with the whole "Why these cards" list running down the page. The fold now
renders the same tab row as the desktop panel, so one section shows at a time,
and its body caps at 52vh and scrolls. The desktop panel is unchanged.

- `v1/src/app/study/PlanAside.tsx` — `DetailTabs` is shared by the aside and
  the fold; each instance carries its own id prefix, and both read one tab
  state.
- `v1/src/app/globals.css` — under 860px the fold's tabs tighten and its body
  caps at 52vh.
- Verified with a 390px static harness: the three tabs fit, and the reason list
  scrolls inside the cap.
