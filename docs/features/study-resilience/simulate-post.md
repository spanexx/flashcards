# Post-implementation simulation — study-resilience

Run on 2026-10-26 against the real build, not a mock. The build is the static
export in `v1/out`, served at `http://127.0.0.1:4183` by a local file server and
driven in the in-app browser through the browser-use tools. The server was
started from Windows, bound to `0.0.0.0`, and answered 200 on both
`localhost:4183` and `172.25.126.9:4183` before the run began.

Prerequisites: the seeded library has `browser-dev` (14 decks, 140 cards) and
`polish-from-scratch` (12 decks, 120 cards). Data lives in IndexedDB
`flashcards` v5, which added the `resume` store on first open.

## What the run changed

One real gap was found and fixed while proving the in-app return path. Leaving
Study starts a debounced write; returning a moment later could mount and read
the `resume` row before that write landed, so the learner resumed one answer
behind. `loadResumableSession()` now waits for the write chain before it reads
(`v1/src/lib/browser/session-save.ts`), and
`tests/session-resume.test.ts` pins it with a slow store: red without the fix
("expected undefined to be 2"), green with it.

The browser pass also added `tests/browser-bundle.test.ts` coverage for a
hand-edited backup with a trailing comma, because the live leg of Scenario 14
could not be completed (see "Tool limits").

## Drift review, before commit

A fresh-eyes review compared these docs with the code and found one behaviour
gap plus a set of stale citations. The gap is fixed in code: editing a card
retires the old row instead of deleting it, so `loadResumableSession` now builds
its live set from active cards only. Without that, Scenario 9's edited-card
branch kept the pre-edit card in the queue. Two tests pin it —
"drops an edited card, because an edit retires the old identity" and "clears the
row when every card in it was retired" in `tests/session-resume.test.ts`. The
doc corrections are recorded as D-20…D-25 in `docs/drift.md`.

## Contract items

| # | Item | Evidence from the run | Verdict |
|---|------|----------------------|---------|
| 1 | Scenarios 1–4: open, dismiss, fold, reopen, Settings on | Card 1 (Airport, beginner) auto-opened its layer with Collapse and "Don't show again". Pressing "Don't show again" folded it at once, left the folded bar with "Show the teaching layer", and wrote `localStorage["flashcards.teaching"] = {"autoOpen":false}`. Card 2 (Apple) arrived folded. "Show the teaching layer" opened it by hand with the dismiss button absent. The Settings switch showed off; toggling it wrote `{"autoOpen":true}`; after returning, card 3 (Autumn) auto-opened again. | Pass |
| 2 | Scenarios 5–7: trip, reload, drafts | Draft "jab" and the pack hint text on card 2 survived a trip to Settings and back: the screen returned to "Card 2 of 20" with "Picked up where you left off." and the same hint. After answering and advancing, card 3 carried draft "jesie" and a collapsed layer. IndexedDB then held `index: 2`, `sessionId: 9c4219ac-…`, `layerUi.open: false`, and drafts `["lotnisko","jabłko","jesie"]`. A real reload returned "Card 3 of 20", the note, the textbox value "jesie" and the folded layer. The `sessions` store held two rows before and after the reload — `2895ea16-…` (the plan build) and `9c4219ac-…` (the running session) — so reload added no second row for the session id. | Pass |
| 3 | Scenario 8: finish clears the resume row | "End the session" landed on the plan screen ("20 cards are laid out.", Start session) and the `resume` store went from one row to zero. The running session's row became `type: "ended"` with `answered: 2, stopped: true`. The plan then rebuilt, which wrote a fresh `started` row (`ce1fa476-…`) — pre-existing `/api/plan` behaviour, outside this pack. | Pass |
| 4 | Scenario 9: a vanished card is skipped | With the session live on card 3 ("Autumn"), the stored card row `deck-polish-from-scratch-weather-and-seasons:34cc6297f9d31eca` was deleted directly in IndexedDB, as another tab context would. Library then showed 259 cards. Returning to Study showed "Card 3 of 19" with the next surviving card, "Bathroom", and the resume note. The edited-card branch is pinned by two tests in `tests/session-resume.test.ts`: a retired id is treated as gone, and a row whose cards were all retired is cleared. The all-gone branch is also pinned by "returns null when only already-passed cards survive". | Pass |
| 5 | Scenarios 10–11: sloppy imports repair, clean imports do not | A Cards-target paste containing a markdown fence, a `//` comment, bare keys, single quotes, smart quotes and trailing commas finished with: "Repaired a markdown fence, comments, an unquoted key, single quotes, smart quotes and a trailing comma, then imported 2 cards into “browser-dev”." Both cards landed (261 total; answers "four" and "hello", the smart-quoted value repaired to a plain string). A clean one-card paste then said only "Imported 1 card into “browser-dev”." with no repair sentence (262 total). | Pass |
| 6 | Scenarios 12–13: damage still refused; valid text untouched | A truncated cards paste produced "A job failed — Nothing was imported, because the file needs fixing."; the library stayed at 262 cards and held no partial "Broken card". `tests/json-repair.test.ts` proves a valid document is returned unchanged with no repairs, alongside idempotence and string-safety cases. | Pass |
| 7 | Scenario 14: a backup stays strict | The browser leg stopped at the app's own `window.confirm("Restoring replaces everything in this browser. The provider key stays. Continue?")` (`v1/src/app/settings/SettingsClient.tsx:281`): the native dialog wedged the in-app browser's tool session before the refusal could be read. The refusal path is unchanged (`parseBackup` calls `JSON.parse`, `v1/src/lib/browser/bundle.ts:839-859`), and the new test "refuses a hand-edited backup with a trailing comma, where a content bundle is repaired" proves the sloppy backup is refused with `(backup): the text is not valid JSON` while cards and the provider key stay as they were. | Pass by test — live leg blocked by the tool, stated below |
| 8 | Offline: storage still drives the screen | Not re-run: the same wedged session blocked the reload. The two halves were proven separately — a live reload restored the session and the layer preference from storage in this pack, and the service worker served the app with the server stopped in the teaching-layers pack (item 13). | Not run — covered by its two proven halves |

## Tool limits, stated plainly

- The in-app browser has no way to answer a native `window.confirm`. Pressing
  "Restore this backup" opened the app's own confirmation dialog, and every
  later page command (snapshot, script, reload, key press, dialog handler)
  timed out while the renderer waited. Browser-level calls (`list_pages`,
  `select_page`) still answered. The tab was left open with the dialog; nothing
  was restored, so no data changed.
- Scenario 14's live refusal therefore rests on the unit test and the unchanged
  parse path, not on a screen reading. The confirm itself is expected product
  behaviour, not a bug.
- Offline was skipped for the same reason. Its asset half is the same cached
  build proven in the teaching-layers run; its storage half is the reload
  recorded in item 2.
- The deleted card in item 4 was removed with a direct IndexedDB write rather
  than by editing it in a second tab, because the driver exposes one page. The
  code path under test (prune against live card ids) is the same.

## Doc corrections made in this phase

1. `IMPL-study-resilience.md`, Phase 6: it named `library-utils.ts` for the
   repair sentence. The clause is produced by `repairClause()` in
   `v1/src/lib/core/json-repair.ts:311` and used by
   `v1/src/app/JobsDock.tsx:55` and `v1/src/app/library/PacksPanel.tsx:108`;
   `library-utils.ts` does not carry it.
2. `PRD-TRD-study-resilience.md`, Architecture Notes: the layer decision was
   cited at `StudyClient.tsx:108-110`; after the session wiring it sits at
   `StudyClient.tsx:118-122`. The note now cites the current lines.
3. The pre-implementation simulation (`archive/simulate-pre.html`) drew the
   folded bar only after an answer, pre-filled a draft with no session, and
   used a fictional `flashcards.cards/v1` shape with a regex repair that could
   touch string content. The canonical `simulate.html` now mirrors the shipped
   rule (bar available whenever the layer is folded; an empty draft until a
   session exists), the real cards-fragment shape, and the syntax-only repair
   order.

## Observed, not in the contract

- Ending a session records `ended` for the running id and the plan rebuild that
  follows records a new `started` row for the next plan. That is how the plan
  endpoint has always written history (`v1/src/lib/browser/router.ts`), and the
  resume promise only requires that a reload adds no second row for the running
  session, which it does not.
- A restored plan keeps the card count it was built with. Deleting a card does
  not edit the plan object; the queue shortens on the next load, which is what
  item 4 shows as "Card 3 of 19".
