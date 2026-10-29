# feat(dictionary): course material for every pack, deck and card

## Summary

- Adds the **Dictionary**: a reader at `/dictionary?pack=&deck=&card=` with stepped card pages (one part at a time, arrows bottom right at every width) and cover-style pack/deck pages whose contents sit in a capped, searchable window.
- Adds authoring: a Course Builder at `/builder?pack=` and one `PageEditor` shared with the Edit button on every page. Parts are kept in the browser (image ≤1 MB at 1600px, video ≤20 MB, 300 MB net total, freed at once on replace/remove) or linked (YouTube, Drive, any address). On touch-first mobile a video must be linked; a touch-screen laptop may keep video.
- Reading is earned by traces and shown as coverage, never score: text `max(5s, words/10)` or a full speaker read, picture 3s or tap-to-enlarge, video 80% (a linked YouTube player counts once ready). Progress gains a separate "Pages read N of M" line over card pages that carry at least one part.
- "Read the card page first" is a per-course rule that warns after the answer, with a reading chip and a link; no button is ever disabled. The chip, Hint and Dictionary keep icon + word, accessible names and tooltips, and become 34×34 icon-only buttons below 700px.
- A learner's edit of a built-in page is a private overlay (`learnerEdited`, `editedFromShipped`) with the shipped page kept as `shippedCopy`: revert restores it at once, offline, and drops the trace; a later seed refreshes the snapshot and leaves the learner's words alone. Shared packs carry the shipped copy via `shareablePage`, never the overlay. The full backup carries pages, shipped copies and traces; the Settings screen states the kept size before building, and autosave stays silent.
- Draft with AI uses the existing provider lane: one call, exact prompt shown and approved, answer lands unsaved in the editor.

## Contract

- GRILL locked at 32 entries (four delegated decisions, entries 29–32), entry 30 carrying a dated amendment for immediate revert. Design simulation archived at `docs/features/course-dictionary/archive/simulate-pre.html`.
- PRD-TRD and IMPL describe the shipped behaviour: data model, API table (`/api/pages…`), pure core (`tracedTextMs`, `savedPageSchema`, `pageRuleProblems`), media rules (`mediaCapProblem(total, adding, replacingBytes = 0)`, `backupSizeWarning`) and architecture notes.

## Verification

| Check | Result |
|---|---|
| `npm run check:drift` / `check:drift:staged` | 0 open, 0 awaiting, **40 resolved**, no warnings |
| Full suite (`vitest run`) | **87 files / 1019 tests** passed |
| `bash docs/features/course-dictionary/simulate.sh` | **12/12 PASS** (scenarios 1–11 + built-screens check) |
| Build (`next build --webpack`) + `build-pwa` + `check-pwa` | `check-pwa: passed` (base path `/flashcards`, 92 files, 90 precache entries) |
| `npm run lint` | exit 0 |
| Built export | carries `/dictionary` and `/builder`; worker caches navigations with a cache fallback |

Drift history: D-32–D-37 record the review's seven fixes (the chip and the tools share one entry); D-38 closed a privacy leak the review did not name (`shareablePage`); D-39 reconciled the PRD-TRD and IMPL with shipped names and shapes; D-40 corrected two design-time source lines in the locked GRILL without moving a locked answer.

## Docs touched

- `docs/features/course-dictionary/` — GRILL (dated amendment + source corrections), PRD-TRD, IMPL, `simulate.sh`, `archive/simulate-pre.html`.
- `wayfinder/anything-learning-spec/tickets/course-dictionary.md`, `wayfinder/anything-learning-spec/map.md`.
- `docs/drift.md` — D-32…D-40.

## How to try it

Run the export under the app's base path (CI's shape): `/flashcards/dictionary?pack=polish-starter&card=<id>` and `/flashcards/builder?pack=polish-starter`.

## Notes

- Built in the `feature/course-dictionary` worktree; the tree's `node_modules` is a symlink, so the build uses `--webpack`.
- No new dependencies.
