# IMPL: Course Dictionary

**Slug:** course-dictionary
**Status:** Approved under delegated authority (2026-10-29)
**Contract:** `PRD-TRD-course-dictionary.md`
**Worktree:** `/home/spanexx/.config/superpowers/worktrees/flashcards/feature-course-dictionary`

Every phase ends with `npm run typecheck` and its named test file. The
full suite runs once at the end, not after every phase.

## Phase 1 — Core rules

Files: `src/lib/core/pages.ts` (new), `src/lib/core/media-rules.ts`,
`src/lib/core/media.ts`, `src/lib/shared/types.ts`.

1. Add `PageLevel`, `PageContent`, `DictionaryPage`, `PageTrace`,
   `requirePageRead` to the shared types (`learnerEdited`,
   `editedFromShipped`, `shippedCopy` on the page).
2. `core/pages.ts`: page ids, title resolution (`pageTitle`), part count,
   `pageIsRead`, `tracedTextMs` (`max(5, words/10)` rounded up? —
   words/10, floor 5), `readCount`, `savedPageSchema` (title/lead
   optional, cover an image part, parts default empty), `pageRuleProblems`
   (a card page needs at least one part; pack and deck pages may carry
   none), `pageFromSave` (keeps the shipped page as `shippedCopy`).
3. `media-rules.ts`: `TOTAL_MEDIA_MAX_BYTES`, `BACKUP_WARN_BYTES`,
   `backupSizeWarning(totalBytes)`,
   `mediaCapProblem(total, adding, replacingBytes = 0)`,
   `isTouchFirstMobile(ua, touchPoints)`.
4. `media.ts`: `mediaIdsInPage` (page parts, cover and `shippedCopy`),
   `referencedMediaIds(cards, pages = [])`.

Proof: `npx vitest run tests/pages.test.ts tests/media-rules.test.ts`.
Cases: the trace thresholds; a page read only when every part traced; a
zero-part page never read; touch-first detection (Android, iPhone, iPad
Macintosh UA + touch, Windows touch laptop = computer); cap arithmetic at
299/300 MB.

## Phase 2 — Store and browser layer

Files: `src/lib/browser/store.ts` (version 6 + `pages`, `pageTraces`),
`src/lib/browser/pages.ts` (new), `src/lib/browser/media.ts`,
`src/lib/browser/bundle.ts`, `src/lib/browser/archive.ts`,
`src/lib/browser/repository.ts` (clearLibrary), `src/lib/browser/router.ts`,
`src/lib/browser/seed.ts`.

1. `browser/pages.ts`: `readPages(pack?)`, `readPage(id)`, `writePage`,
   `writeShippedPage` (skip a learner row, refresh its `shippedCopy`),
   `revertPage(id, at)` (restore the shipped copy at once, drop the
   trace), `deletePage`, `readTraces()` (no argument), `recordTracedPart(pageId, index, at)`
   (markChanged so autosave carries it).
2. `media.ts`: `totalMediaBytes`, cap refusal in `storeImageFile` and
   `storeVideoFile` (the replaced file's bytes passed as `replacingBytes`,
   so the net total is judged), `deleteMediaIfUnreferenced(id)` for a file
   the editor replaced or removed, mobile video refusal in
   `storeVideoFile`, `deviceIsTouchFirstMobile()`.
   Imports/restores are not refused by the cap (they carry whole files and
   restore is all-or-nothing); the meter still reports the total.
3. `bundle.ts`: optional `pages` in `packBundleSchema` (and deck/cards
   fragments carry none), pack header `requirePageRead`; `shareablePage`
   (a shared pack carries the shipped copy, never a learner's overlay);
   `exportPackBundle` includes the pack's pages; `backupSchema` gains
   `pages` (with `shippedCopy`), `pageTraces`, pack `requirePageRead`;
   `buildBackup` includes them and filters media by
   `referencedMediaIds(cards, pages)`; `applyBackup` restores pages, the
   shipped copies, traces and the rule.
4. `archive.ts`: `exportPackArchive` exports page media (the reference set
   is computed from the shareable pages); `backupMediaBytes()` reports the
   kept bytes a full backup would carry; `writeMediaEntries` unchanged.
5. `router.ts`: the seven page calls from the PRD; `GET /api/progress`
   gains `pages: { read, total }`; `PATCH /api/packs/<name>` accepts
   `requirePageRead`.
6. `seed.ts` calls `importBundle`; the overlay rule itself lives in
   `writeShippedPage` (`browser/pages.ts`), which the bundle importer
   calls for every shipped page.

Proof: `npx vitest run tests/browser-pages.test.ts tests/browser-bundle.test.ts`.
Cases: save/read/delete a page; a seed leaves an edited page and refreshes
its shipped copy; revert restores the shipped copy and drops the trace;
trace survives a reload; pack export carries the shipped copy and page
media ids; backup round-trip restores pages, shipped copies, traces and
the rule; clearing the library clears them; cap refusal messages,
including a replacement judged by the net total.

## Phase 3 — Reader

Files: `src/app/dictionary/page.tsx` (new), `src/app/DictionaryClient.tsx`
(new), `src/app/dictionary/{CardPage,EntityPage}.tsx` (new), `src/app/globals.css`.
(`PageParts` and `TraceMeter` were folded into `CardPage` and
`PageEditor`; see the reconcile note in Phase 6.)

1. `/dictionary` reads `pack`, `deck`, `card` and renders the deepest.
2. CardPage: one part at a time, all parts in one grid cell (tallest sets
   the height), dots (current + traced), arrows bottom right at every
   width, speaker per text part (stops on part change/leave), picture
   tap-to-enlarge, video progress, breadcrumbs up to deck and pack,
   `Page not written` empty state with an Edit button when nothing exists.
3. EntityPage (deck/pack): cover band, eyebrow, title, facts, Edit button,
   lead, contents window (capped, hidden scrollbar, search icon + slim
   input), rows with dot/level/chevron; pack rows open deck pages, deck
   rows open card pages.
4. Trace rules wired to the timers; `recordTracedPart` on earn; a linked
   YouTube player attaches its listener only once the ready probe has
   mounted the iframe; leaving stops every timer; traces loaded once and
   updated in place.
5. CSS: tokens only, 8px corners, 700px breakpoint for icon words.

Proof: `npm run typecheck` + the post-impl sim (Phase 6). Manual browser
check runs in Phase 6 before reporting.

## Phase 4 — Authoring

Files: `src/app/builder/page.tsx` (new), `src/app/BuilderClient.tsx`
(new), `src/app/dictionary/PageEditor.tsx` (new), `src/app/study/*`,
`src/app/library/PackEditor.tsx`.

1. Course Builder `/builder?pack=`: course tree (pack, decks, cards in
   order) with written/empty dots, page status, revert for an overlay;
   the right pane is the shared `PageEditor`.
2. `PageEditor`: title, lead (pack/deck), cover (pack/deck), parts
   (text/image/video, add/move/remove), kept vs linked pickers, the media
   meter, the mobile video refusal, Draft with AI (prompt preview →
   approve → unsaved answer), Save/Cancel/Preview.
3. Edit buttons in the reader open the same editor inline.
4. Pack editor: "Ask learners to read a card's page first" toggle.

Proof: `npx vitest run tests/library-create-utils.test.ts` (unchanged)
plus `npm run typecheck`; the authoring scenarios are exercised by the
post-impl sim through the router.

## Phase 5 — Entry points

Files: `src/app/library/CardsPanel.tsx`, `src/app/study/StudyCard.tsx`,
`src/app/StudyClient.tsx`, `src/app/study/ScopePicker.tsx`,
`src/app/study/TeachingLayer.tsx`, `src/app/progress/ProgressClient.tsx`,
`src/app/globals.css`.

1. Library card row: book button -> `/dictionary?card=<id>`.
2. Study card: Hint and Dictionary as the approved bordered buttons
   (icon + word wide, icon alone at 700px); reading chip when the pack
   rule is on and the card has a page; the warning after an answer.
3. StudyClient: fetch every page and trace on mount and on window focus
   and visibility change; keep sets of page ids and refresh on return.
4. Teaching layer: "Open the full card page" link.
5. ScopePicker: up-right arrow per pack and deck row, hover/focus, faint
   on touch, opens the page without changing the selection.
6. Progress: "Pages read N of M", separate from answers.

Proof: `npm run typecheck` + the post-impl sim scenarios 4 and 5.

## Phase 6 — Simulation, drift and close

1. `tests/simulate-course-dictionary.test.ts` walks scenarios 1-11
   through `localGet`/`localSend` and the memory store, printing
   `SCENARIO n ... -> PASS`.
2. `docs/features/course-dictionary/simulate.sh` refuses without
   `v1/out` and runs the test.
3. Run `npm test`, `npm run lint`, `npm run build`.
4. Drift sub-agent compares this IMPL/PRD with the code; gaps fixed,
   updated or logged.
5. Reconcile: the design simulation `simulate.html` moved to
   `archive/simulate-pre.html`, `simulate.sh` is canonical; ticket, map
   and docs updated; drift gates green.
6. Stop at the human gate: no commit, PR or merge without the learner's
   explicit go.

## Out of Scope

- Version tags, releases, stable blessing.
- Any new dependency.
- Streaming backup zip.
