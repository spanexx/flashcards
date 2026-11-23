# IMPL: Mode Studio UI

**Slug:** `mode-studio-ui`
**Status:** Locked by delegated decision, 2026-11-23
**Date:** 2026-11-23
**Origin:** `docs/features/mode-studio-ui/GRILL-mode-studio-ui.txt`
**Contract:** `docs/features/mode-studio-ui/PRD-TRD-mode-studio-ui.md`
**Design:** `docs/features/mode-studio-ui/simulate-pre.html`

## Phase order

Each phase is its own commit-sized change. Tests are written first and seen to
fail for the right reason. One logical change per commit.

1. Origin docs and design sim (GRILL, PRD-TRD, IMPL, simulate-pre.html).
2. Red tests for the pure helpers and the route-level flows.
3. Pure helpers in `mode-studio-utils.ts`.
4. New Pack fields and Library mode state.
5. `/modes` route, panels, editor, AI creator, preview, Nav and PWA lists.
6. Post-sim, fresh-eyes drift review, reconciliation and full gates.

## Phase 1 — origin docs and design sim

**Files:** `GRILL-mode-studio-ui.txt`, `PRD-TRD-mode-studio-ui.md`,
`IMPL-mode-studio-ui.md`, `simulate-pre.html`.

- Twelve decisions locked with reasons and sources; no open questions.
- The HTML sim prints ten hardcoded scenes: New Pack, inherited notice, list,
  built-in restrictions, editor validation, AI draft, preview, export/import.

**Proof:** a static scene check finds all ten markers in the file. Direction
confirmed by delegated decision, recorded in PRD-TRD §7.

## Phase 2 — red tests

**Files:** `v1/tests/mode-studio-utils.test.ts`, `v1/tests/browser-modes-ui.test.ts`,
`v1/tests/simulate-mode-studio.test.ts`.

- Pure helper tests call functions that do not exist yet.
- Route tests go through `apiGet`/`apiSend` with `MemoryStore`, not component
  rendering; this repo has no jsdom and `package.json` is off-limits.
- The node rehearsal asserts built-artifact strings and prints `->` lines.

**Proof:** targeted vitest fails for missing modules/helpers, not for setup.

## Phase 3 — pure helpers

**Files:** `v1/src/app/library/mode-studio-utils.ts` (new),
`v1/tests/mode-studio-utils.test.ts`.

- Card mix from a mode, honest inherited notice, preview mapping with zero
  writes, issue lines, export/import JSON, mode delete name and guard.
- All helpers stay free of React and repository imports.

**Proof:** `npx vitest run tests/mode-studio-utils.test.ts` green.

## Phase 4 — New Pack fields and mode state (serial after Phase 3)

**Files:** `LearningModeFields.tsx` (new), `CreatePanel.tsx`,
`LibraryClient.tsx`, `library-utils.ts`.

- One shared block for pack targets at the content-card seam; `updateBrief` is
  the only setter path.
- Deck/cards show the read-only notice; hidden mode fields clear on target switch.
- `LibraryClient.refresh()` reads `/api/modes` and passes the list down.

**Proof:** built chunks still contain the legacy Create strings; route-level
tests prove the brief reaches Generate and Chat prompts.

## Phase 5 — the Learning modes route (serial after Phase 4)

**Files:** `v1/src/app/modes/page.tsx`, `ModesClient.tsx`, `ModesPanel.tsx`,
`ModeEditor.tsx`, `AiModeCreator.tsx`, `ModePreview.tsx`, `Nav.tsx`,
`check-pwa.mjs`, `globals.css` only if a new class is unavoidable.

- Add the route folder before the Nav link so check-pwa finds `out/modes/index.html`.
- Built-ins get Duplicate & Customize; custom rows get Edit / Preview / Delete.
- AI draft shows version `1.0.1`, read-only prompt with Copy, and opens unsaved.
- Reuse existing modal/form classes and 44px controls for 390px screens.

**Proof:** `npm run build` green with `check-pwa: passed`; PWA lists contain the
route; `browser-modes-ui.test.ts` green.

## Phase 6 — post-sim, drift, reconcile, gates

**Files:** `simulate.sh`, `simulate-post.md`, `archive/simulate-pre.html`.

- Post-sim reads real built artifacts and exercises the same ten scenarios
  through the real router/store; it ends PASS or FAIL with a non-zero exit.
- Fresh-eyes review compares PRD-TRD + IMPL against code and both sims.
- Collapse to one canonical `simulate.sh`; archive the design HTML.

**Proof:** sim PASS; typecheck; changed-file eslint; full `npm test` once; both
drift gates; clean `git status`.

## Out of scope

No endpoint, prompt, mode content, provider schema, new dependency, component
test renderer, default mode, or live Drift entry.

## Risks and how they are handled

- **No inherited mode source.** `PackStatus` has no mode field; the UI says so
  and clears stale selection rather than inventing a value.
- **Card Mix is inert.** Labeled as stored-only; D-53 is the record.
- **Two versions.** AI badge uses `MODE_DRAFT_VERSION`, not the prompt skill.
- **PWA ordering.** Route folder lands with the Nav link and both list edits.
- **Broken/stale ids are silent.** The Modes screen cross-checks a selected id
  against the loaded list before showing its label.
- **Mobile height.** Reuse stack/modal classes and existing 44px inputs; no new
  layout system.
