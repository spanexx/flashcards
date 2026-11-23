# IMPL: Full-page mode editor

**Slug:** `mode-editor-design`
**Status:** Locked by delegated decision, 2026-11-23
**Date:** 2026-11-23
**Origin:** `docs/features/mode-editor-design/GRILL-mode-editor-design.txt`
**Contract:** `docs/features/mode-editor-design/PRD-TRD-mode-editor-design.md`
**Design:** `wireframe/mode-studio/editor/index.html`

## Phase order

Each phase is its own commit-sized change. Tests are written first and seen to
fail for the right reason, then committed with the green implementation.

1. Origin docs and the approved prototype as pre-sim.
2. Pure helper tests and `mode-editor-utils.ts`.
3. Thin renderers: `JsonTree`, `MarkdownPreview`.
4. Full-page shell, fixed route, sessionStorage handoff, ModesClient changes,
   PWA lists and theme CSS.
5. Post-sim, fresh-eyes review, reconciliation and full gates.

## Phase 1 — origin docs

**Files:** GRILL, PRD-TRD, IMPL, `wireframe/mode-studio/editor/`.

**Proof:** drift gate green; no code touched.

## Phase 2 — pure helpers

**Files:** `v1/tests/mode-editor-utils.test.ts`,
`v1/src/app/modes/mode-editor-utils.ts`.

- Tree path edits are immutable; mirror text tracks edits.
- Markdown preview escapes HTML before styling.
- `skillInstructions` link detection and tab deep link.
- `modeWithExampleText` shares the one parse/validate gate.

**Proof:** `npx vitest run tests/mode-editor-utils.test.ts` RED then GREEN.

## Phase 3 — thin renderers

**Files:** `JsonTree.tsx`, `MarkdownPreview.tsx`.

- Recursive tree with branch toggles, hover actions, path breadcrumb, key/value
  inputs, add/remove and the skill link.
- Markdown renderer outputs the helper's HTML.

**Proof:** typecheck and changed-file eslint; helper tests stay green.

## Phase 4 — route and handoff

**Files:** `v1/src/app/modes/editor/page.tsx`, `ModeEditorPage.tsx`,
`mode-draft-handoff.ts`, `mode-notice.ts`, `ModesClient.tsx`, `check-pwa.mjs`,
`globals.css`; retire `ModeEditor.tsx`.

- Fixed route behind Suspense; no dynamic segment.
- Edit → `?id=`; duplicate → `?id=` on the created row; AI draft → sessionStorage
  then `?new=1`.
- Save/Cancel return to `/modes`; notice carried in sessionStorage.
- PWA route and precache lists updated.

**Proof:** `npm run build` with check-pwa green; browser-modes-ui and simulation
tests updated and green.

## Phase 5 — post-sim, drift, reconcile, gates

**Files:** post-sim note, archived pre-sim, canonical sim, updated docs.

**Proof:** sim PASS; full suite once; typecheck, eslint, both drift gates; clean
`git status`.

## Out of scope

No endpoint, prompt, mode content, Track 1-3 file, dependency or live Drift entry.

## Risks and how they are handled

- **Static export.** Fixed route plus Suspense; no `[id]` segment.
- **Two editors.** Modal retired; one save path through existing helpers.
- **Theme leakage.** Use app CSS variables, never prototype hex colors.
- **Draft loss.** Guarded sessionStorage helper, cleared on read.
- **PWA gate.** Route file and both check-pwa lists land together.
