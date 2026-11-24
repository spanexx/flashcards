# PRD-TRD: Full-page mode editor

**Slug:** `mode-editor-design`
**Status:** Locked by delegated decision, 2026-11-23
**Date:** 2026-11-23
**Origin:** `docs/features/mode-editor-design/GRILL-mode-editor-design.txt`
**Design:** `docs/features/mode-editor-design/archive/simulate-pre/index.html` (Victor-reviewed prototype)
**Track:** follow-up to Track 4. Consumes Tracks 1-3; writes no endpoint or mode content.

## 1. Why this exists

Track 4 shipped a usable mode editor in a modal. The screenshot Victor reviewed
showed the problem: a cramped box, a tiny JSON textarea and a split between two
unrelated surfaces. The approved prototype replaces it with one full page per
task: Markdown rules with a rendered preview, and a JSON object with a read-only
source mirror and an editable explorer.

## 2. What it does

### 2.1 Two tabs, one box each

The page has exactly two tabs. The active tab owns the full content area. Each
tab shows one full-width view at a time, with a small Preview/Edit toggle:
- Markdown skill: the Markdown source, or its rendered preview.
- JSON example: the editable explorer, or the read-only syntax-coloured JSON
  source.

No sidebar, no second editor, no glowing focus treatment. Inputs are large
enough to use, row actions appear on hover, and the panes stack on narrow
screens.

### 2.2 The explorer is the JSON editor

Every object or array is a branch that opens like a file tree. Keys and values
are inputs; add and remove work; a path breadcrumb shows where an edit landed.
The raw JSON pane is a derived, read-only mirror and updates on every edit.
`canonicalExample` stays an object, never a JSON string.

`skillInstructions` is not edited here. Its row is a link that opens the
Markdown tab and focuses the source.

App-owned fields stay visible but are never editable: `id`, `isBuiltIn`,
`createdAt`, `sourceModeId` and the example's `schema` literal. The router
forces these on write, so changing them in the explorer would be ignored or
would break the stored row. They render as quiet values with an "app-owned"
badge.

### 2.3 Route and handoff

`/modes/editor` is a fixed static-export route wrapped in Suspense. `?id=` loads
a stored mode from `GET /api/modes`; `?new=1` takes an unsaved AI draft from a
guarded sessionStorage helper. Neither the draft nor the mode bundle is put in
the URL. Save uses the existing `modeSaveRequest`, `learningModeIssues` and
`modeIssueLines`; Cancel and Save return to `/modes`. A second sessionStorage
key carries the save notice to the list.

### 2.4 One editor

The Track 4 modal editor is retired. Preview and delete stay as list-page
dialogs because they are quick actions, not editing surfaces.

## 3. Behavioural spec

1. **Given** a stored mode, **when** the learner opens Edit, **then** the editor
   route loads that mode and starts on the Markdown tab with its source and
   rendered preview in one connected box.
2. **Given** the JSON tab, **when** the learner edits a key or value in the
   explorer, **then** the raw JSON mirror updates and the underlying object keeps
   the same shape.
3. **Given** `skillInstructions` in the explorer, **when** the learner clicks its
   link, **then** the Markdown tab opens and the source is focused; the value is
   not editable in the tree.
4. **Given** an AI draft, **when** Send opens the editor, **then** the unsaved
   mode is taken from sessionStorage once and Save creates it via POST.
5. **Given** an invalid example, **when** Save is pressed, **then** field-named
   issues stay on the page and no row is written.
6. **Given** a valid example, **when** Save is pressed, **then** the row is
   written through PATCH for a stored mode or POST for a draft, and the list
   shows the save notice after returning.
7. **Given** a missing mode id or expired draft, **when** the page loads,
   **then** a plain message and a link back to `/modes` are shown.
8. **Given** either theme, **when** the page renders, **then** surfaces use the
   app's CSS variables with no hardcoded prototype colours.

## 4. Technical design

### 4.1 `v1/src/app/modes/mode-editor-utils.ts` (new)

Pure helpers: `getAt`, immutable `setAt`, `deleteAt`, `renameKeyAt`, `pathText`,
`escapeHtml`, `highlightJson`, `renderMarkdown`, `mirrorJsonText`,
`isSkillInstructionsLink`, `initialTabFromSearch`, `treeRowsFor`,
`modeWithExampleText`. Reuse `previewCardsFromExample`, `modeIssueLines` and
`modeSaveRequest` from Track 4's helper module.

### 4.2 `JsonTree.tsx` and `MarkdownPreview.tsx` (new)

Thin renderers over the helpers. No data logic in components.

### 4.3 `ModeEditorPage.tsx` and `modes/editor/page.tsx` (new)

The page owns tab state, draft state, save/issue state and the Ctrl+S handler.
The route wrapper is the dictionary-style Suspense shell.

### 4.4 Handoff modules (new)

`mode-editor-handoff.ts` in `v1/src/lib/browser/` with
guarded sessionStorage access that clears on read.

### 4.5 Changed files

`ModesClient.tsx` (navigate instead of opening a modal, read return notice),
`check-pwa.mjs` (route and precache lists), `globals.css` (small tab/tree rules),
`ModeEditor.tsx` (retired/deleted).

### 4.6 Tests

`v1/tests/mode-editor-utils.test.ts` (new, pure helpers), plus extensions to
`browser-modes-ui.test.ts` and `simulate-mode-studio.test.ts` for the route and
built output.

## 5. Non-goals

No new endpoint, schema, provider schema, prompt wording, mode content,
dependency, dynamic route, or live Drift entry.

## 6. Acceptance evidence

```bash
cd v1
npm run build
npx vitest run tests/mode-editor-utils.test.ts tests/browser-modes-ui.test.ts tests/simulate-mode-studio.test.ts
npm test
npx tsc --noEmit
npx eslint <changed files>
npm run check:drift && npm run check:drift:staged
```

Build passes `check-pwa` with `modes/editor/index.html`; the two-tab editor uses
theme variables; no Track 1-3 file changed.

## 7. Delivery note

- 2026-11-23: design approved by Victor through prototype iterations; all
  decisions are delegated and recorded in the GRILL.
- 2026-11-23: the explorer no longer offers editable controls for app-owned
  fields. The full router write contract was checked, not just `isBuiltIn`.
- 2026-11-24: Victor asked to stop showing two panes at once. Each tab now has
  one full-width view and a small Preview/Edit toggle. The toggle lives inside
  the tab, so switching tabs always returns to the editing view.
- 2026-11-24: the Learning modes list was redesigned with the same mindset: a
  compact head, one quiet surface, calm rows with hover-only actions, and theme
  variables instead of hardcoded borders.
- 2026-11-24: the Library shell got the same convention. Its head is compact,
  the page fills one viewport, the main panel and rail scroll quietly, and
  narrow screens fall back to normal page scrolling.
- 2026-11-24: Packs panel actions became labelled icon buttons. Create now uses
  two selects for object and method instead of large choice cards; behavior and
  validation are unchanged.
