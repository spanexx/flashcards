# PRD-TRD: Mode Studio UI

**Slug:** `mode-studio-ui`
**Status:** Locked by delegated decision, 2026-11-23
**Date:** 2026-11-23
**Origin:** `docs/features/mode-studio-ui/GRILL-mode-studio-ui.txt`
**Track:** 4 of 4. Tracks 1-3 own the mode contract, prompt layers and built-in
content. This track owns screens and pure screen helpers only.
**Design:** `docs/features/mode-studio-ui/archive/simulate-pre.html` (design contract)
**Canonical rehearsal:** `docs/features/mode-studio-ui/simulate.sh` (post-implementation, reads built output)

## 1. Why this exists

The app can store learning modes, seed five built-ins, and resolve a selected
mode into both prompt lanes. None of that is reachable from a screen. A learner
cannot pick a mode when creating a pack, cannot see or copy one, cannot turn a
built-in into their own, and cannot create one with the AI draft that Track 2
already ships.

This track adds the screens. It does not add an endpoint, a prompt rule, a mode
definition, or a dependency. Every write goes through the routes Tracks 1-2
already own.

## 2. What it does

### 2.1 A first-class Learning modes route

`/modes` is its own App Router page with a `ModesClient` shell, not a fourth
Library tab. The sidebar entry is labelled **"Learning modes"** — never bare
"Mode", which collides with `AnswerMode` and the provider mode. The route and
both `check-pwa.mjs` lists land in the same change, because the PWA check scans
every linked href and fails when its file is missing from `out/`.

### 2.2 New Pack fields, once, above the method branch

For `target === "pack"` the New Pack form renders one shared block: Learning
Mode, Subject, Target Language, Question Language, Card Mix and Extra Study
Preferences. All edits go through the existing `updateBrief` handler; the three
mode fields are already on `CreationBrief`.

Generate and Chat send `requestBrief`, so a chosen `modeId` reaches the prompt
through D-52. Write posts no brief, so the form states plainly that the
selection is for AI methods and is not stored on a hand-written pack.

### 2.3 Deck and cards show the truth about inheritance

`PackStatus` has no mode field. A deck or cards target shows a read-only notice:
"No learning mode is stored on this pack." Hidden mode fields are cleared when
the learner switches away from pack, so a stale id cannot reach a prompt.

### 2.4 Card Mix is collected, not yet rendered

Per the locked plan the field stays, seeded from the selected mode's
`defaultCardMix`. It is labelled "stored, not yet used in prompt wording" and
never replaces `cardStyle`. D-53 records why: `PromptInputs` is a reserved seam.

### 2.5 Mode actions

`GET /api/modes` returns built-ins first, then custom modes by name. Built-ins
offer Duplicate & Customize only. Custom modes offer Edit, Test preview and
Delete with typed-name confirmation. The router remains the real guard for
built-in edit/delete; the UI does not pretend to be one.

### 2.6 AI mode creator

`POST /api/modes/draft` shows a read-only prompt with a Copy button and a badge
from `MODE_DRAFT_VERSION` (`1.0.1`, not the prompt skill version). Sending the
held prompt through `POST /api/modes/draft/send` opens the editor with the
returned mode **unsaved**: nothing is written until the learner presses Save.

### 2.7 Test preview is local

`previewCardsFromExample` turns a mode's canonical bundle into card parts plus a
reveal map for `CardSide`. The preview writes nothing and calls no route. A pure
test asserts zero write calls; the visual result stays in the manual walkthrough
because this repo has no browser renderer in tests.

### 2.8 Inline validation and export/import

Before Save, `learningModeIssues()` checks the whole mode; server field-named
issues render through `errorLines`. No `/validate` endpoint is added. Export
writes a small JSON file containing only custom modes; import posts each parsed
mode to `POST /api/modes`, which forces `isBuiltIn: false` and validates it. The
file is a mode list, not a whole-app backup. No new route or schema is touched.

## 3. Behavioural spec

1. **Given** a fresh build, **when** the learner opens the sidebar, **then**
   "Learning modes" links to `/modes`, the built page exists, and the service
   worker precaches `./modes/`.
2. **Given** a pack target, **when** the learner selects a built-in, **then**
   the Learning Mode and Card Mix fields are prefilled from that mode, and
   Generate and Chat briefs carry its `modeId`. Extra preferences stay whatever
   the learner typed, because a mode does not store preferences.
3. **Given** a deck or cards target, **when** the screen renders, **then** it
   shows the no-mode notice and carries no hidden `modeId` from the pack target.
4. **Given** the mode list, **when** it loads, **then** built-ins sort first and
   custom modes by name; a built-in shows Duplicate & Customize but no Delete.
5. **Given** a built-in, **when** the learner duplicates it and saves an edit,
   **then** a new custom row appears immediately with `isBuiltIn: false`,
   `sourceModeId` set and a fresh `createdAt`; the source is unchanged.
6. **Given** an invalid canonical example, **when** the learner presses Save,
   **then** the editor stays open and names the offending field, with no row
   written.
7. **Given** a custom mode, **when** the learner opens Test preview, **then**
   card parts render with answers revealed and zero repository writes occur.
8. **Given** the AI creator, **when** a draft is prepared and sent, **then** the
   read-only prompt shows version `1.0.1`, Copy is available, and the returned
   mode opens in the editor unsaved until Save.
9. **Given** a custom mode, **when** export then import runs, **then** the JSON
   round-trips through the existing routes without adding an endpoint; built-ins
   are never exported.
10. **Given** any learner mode, **when** a backup is restored, **then** it is
    still present and a built-in row is never overwritten by an imported id.

## 4. Technical design

### 4.1 `v1/src/app/library/mode-studio-utils.ts` (new)

Pure helpers only: `cardMixForMode`, `inheritedModeNotice`, `previewCardsFromExample`,
`modeIssueLines`, `modeExportText`, `modeImportBody`, `canDeleteMode` and the
mode extension of `deleteName`. No React import, so the node test environment
can exercise all of them.

### 4.2 `LearningModeFields.tsx` (new)

Props `{ brief, modes, onChange }`. Uses `LanguageField` and existing
`.brief-block`/`.brief-grid`/`.field-label` classes. Renders the Card Mix note.

### 4.3 `CreatePanel.tsx` and `LibraryClient.tsx` (additive)

`CreatePanel` gains a `modes` prop and renders the shared block once at the
content-card seam for pack targets, plus the read-only notice for deck/cards.
`LibraryClient` adds `modes` state, adds `/api/modes` to `refresh()` and passes
the list down. Existing Create strings stay in the built chunks.

### 4.4 `v1/src/app/modes/*` (new)

`page.tsx` mirrors `library/page.tsx`. `ModesClient.tsx` owns the list, refresh,
actions and child components. `ModesPanel.tsx`, `ModeEditor.tsx`,
`AiModeCreator.tsx` and `ModePreview.tsx` consume only `apiGet`/`apiSend`, the
pure helpers and `CardSide`. Dialog pattern comes from `DeleteDialog.tsx`.

### 4.5 `Nav.tsx` and `v1/scripts/check-pwa.mjs` (additive)

One sidebar entry; `modes/index.html` in `requiredRoutes` and `./modes/` in the
precache list. Build-pwa needs no change.

### 4.6 Tests

- `mode-studio-utils.test.ts` — pure helpers, including zero-write preview.
- `browser-modes-ui.test.ts` — through `apiGet`/`apiSend`, real memory store:
  list order, duplicate, create, edit, delete refusals, draft unsaved, modeId
  prompt injection, export/import and backup survival.
- `simulate-mode-studio.test.ts` — node rehearsal printing every scenario in
  §3 and reading built artifacts where needed.

### 4.7 Boundaries

No change to Track 1 types/schema/repository/router, Track 2 prompt modules or
version, Track 3 mode content, `client/api.ts`, `layout.tsx`, `package.json`, or
a live Drift entry.

## 5. Non-goals

- No new endpoint, `/validate` route, provider schema or prompt wording.
- No mode content authored here and no default selected mode.
- No component tests or new test dependency.
- No claim that Card Mix changes prompt wording today.
- No promise that a hand-written pack stores a mode.

## 6. Acceptance evidence

```bash
cd v1
npm run build            # first: the simulation reads out/
npx vitest run tests/mode-studio-utils.test.ts tests/browser-modes-ui.test.ts tests/simulate-mode-studio.test.ts
npm test
npx tsc --noEmit
npx eslint <changed files>
npm run check:drift && npm run check:drift:staged
```

Build passes `check-pwa` with `/modes`; existing Create strings remain in built
chunks; all ten scenarios print evidence; full suite file and test counts are
reported.

## 7. Delivery note

- 2026-11-23: design direction confirmed by delegated decision. The learner
  asked the agent to make all decisions; each is recorded in the GRILL with its
  source. No interactive approval gate was used.
- 2026-11-23: red tests were executed before each phase's code, then committed
  with the green implementation, because `docs/ethics/commit.md` forbids
  committing failing tests. The test headers describe that execution, not a
  separate commit.
- 2026-11-23: fresh-eyes review found that an AI draft opened in the editor
  could not be saved: Save always PATCHed a row that did not exist. Save now
  picks POST for an unsaved draft through the pure `modeSaveRequest` helper.
