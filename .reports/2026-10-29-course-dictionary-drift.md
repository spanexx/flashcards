# Course Dictionary — Phase 5 drift review

**Feature:** Course Dictionary (`course-dictionary`)
**Worktree:** `/home/spanexx/.config/superpowers/worktrees/flashcards/feature-course-dictionary`
**Branch:** `feature/course-dictionary`
**Date:** 2026-10-29
**Mode:** audit only. No code or document was modified except this report.

## What was checked

- All 32 locked GRILL entries in `docs/features/course-dictionary/GRILL-course-dictionary.txt`.
- All 11 Behavioral Spec scenarios and the Simulation Contract in `docs/features/course-dictionary/PRD-TRD-course-dictionary.md`.
- Every IMPL phase in `docs/features/course-dictionary/IMPL-course-dictionary.md`, including named files that were folded.
- The post-implementation simulation (`v1/tests/simulate-course-dictionary.test.ts`, `simulate.sh`) and the shipped code paths it claims to cover.

The simulation was run during this audit:

```
npm test -- --run tests/simulate-course-dictionary.test.ts
12 tests passed (12)
```

`v1/out/dictionary/index.html` exists. The simulation prints PASS for Scenarios 1-11 and for the built dictionary route. Those PASS lines are real, but several scenarios only assert source strings, CSS fragments, or pure functions. Three contract failures below are invisible to the current simulation.

## Scenario results against code

Simulation PASS is not treated as proof where the test only greps source.

| Scenario | Sim | Audit verdict | Evidence |
|---|---|---|---|
| 1. Card page steps one part at a time | PASS | PASS | `v1/src/app/dictionary/CardPage.tsx:140-159` and `:259-333`; `.dict-step-stack` / `.dict-step-part` grid in `v1/src/app/globals.css:3637-3655`; arrows bottom-right `CardPage.tsx:305-333`; entry points `v1/src/app/library/CardsPanel.tsx:188-195`, `v1/src/app/study/StudyCard.tsx:267-270`, `v1/src/app/study/TeachingLayer.tsx:137-141`. The sim only checks CSS strings (`simulate-course-dictionary.test.ts:187-221`). |
| 2. Reading is earned by traces | PASS | PARTIAL — YouTube part can never trace | Text and picture timers `CardPage.tsx:149-159`; picture tap traces immediately `:285-296`; local video threshold `:60-67`; page-read rule `v1/src/lib/core/pages.ts:87-91`. The linked YouTube path is broken: `v1/src/app/TeachingMedia.tsx:224-257` and `:291-301`. See Gap G3. |
| 3. Reading shows coverage, never score | PASS | PASS | `v1/src/lib/core/pages.ts:94-104`; `v1/src/app/progress/ProgressClient.tsx:179-184`; `v1/src/lib/browser/router.ts:800-804`. Traces write no evidence row (sim `:290-300`). |
| 4. Where pages open from | PASS | PASS | Library book button `CardsPanel.tsx:188-195`; study Dictionary `StudyCard.tsx:267-270`; teaching layer link `TeachingLayer.tsx:137-141`; pack/deck arrows `v1/src/app/study/ScopePicker.tsx:69-86` and `:262-289`; deck/pack rows `v1/src/app/dictionary/EntityPage.tsx:163-201`; builder tree `v1/src/app/BuilderClient.tsx:278-316`. Sim only checks source strings (`:304-321`). |
| 5. A course rule warns, never blocks | PASS | PASS (placement note) | `StudyCard.tsx:242-250` and `:404` and `:412-421`; pack toggle `v1/src/app/library/PackEditor.tsx:159-175`; pack PATCH `router.ts:506-510`; answer records without a trace (sim `:323-350`). The warning sits at the top of the result panel rather than literally under the answer buttons; see Accepted drift A2. |
| 6. Pack/deck pages are covers, not dashboards | PASS | PASS for the PRD text; GRILL 19 search-close missing | Cover `EntityPage.tsx:77-81`; head/facts/Edit `:83-107`; lead `:109-119`; one-column capped list `:163-201`; CSS `.dict-list.scroll` `globals.css:3834-3843`; search input `:126-137`; size `globals.css:3814-3820`. Escape/outside close is absent; see Gap G4. Sim checks only selected CSS/source strings (`:352-392`). |
| 7. Authoring: kept or linked | PASS | PASS for the scenario; quota replacement leak remains | Media limits `v1/src/lib/core/media-rules.ts:8-26` and `:45-48`; image resize/1 MB `v1/src/lib/browser/media.ts:121-148`; video 20 MB `media-rules.ts:78`; mobile refusal `media.ts:187-195`; meter `v1/src/app/dictionary/PageEditor.tsx:671-681`; pack zip media `v1/src/lib/browser/archive.ts:178-202`. Replacement/removal quota leak is Gap G7. |
| 8. A draft is reviewed, never auto-saved | PASS | PASS | Prepare prompt `v1/src/lib/browser/router.ts:918-932`; send `:933-936`; prompt contents `v1/src/lib/core/page-draft.ts:31-92`; editor dialog and unsaved merge `PageEditor.tsx:300-343` and `:744-822`. The sim never makes a successful provider call; it only proves the refused/reused path (`simulate-course-dictionary.test.ts:441-487`). |
| 9. A built-in course stays one course | PASS | FAIL — revert does not restore on next start | Overlay skip `v1/src/lib/browser/pages.ts:51-56`; delete `:59-63`; seed skips unchanged packs `v1/src/lib/browser/seed.ts:74-79` and `:113-118`; UI notice `v1/src/app/DictionaryClient.tsx:176-187`, `BuilderClient.tsx:158-167`; sim manually re-imports the shipped page (`simulate-course-dictionary.test.ts:511-520`). See Gap G2. |
| 10. Pages travel; traces stay the learner's | PASS | FAIL — backup size is never stated | Pack export pages/media `archive.ts:178-202`; backup pages/traces `v1/src/lib/browser/bundle.ts:886-984`; pack export excludes traces `bundle.ts:783-818`; backup warning absent from UI; pure helper only `media-rules.ts:51-55`, tested at `simulate-course-dictionary.test.ts:562-563`. See Gap G1. |
| 11. A page edit is not a card edit | PASS | PASS | `v1/src/lib/browser/pages.ts:26-40`; `v1/src/lib/browser/router.ts:696-704`; evidence unchanged (sim `:576-600`). |

## GRILL locked decisions

Entries 1-9 all pass in substance. The evidence is grouped here rather than repeated in full:

| GRILL | Verdict | Evidence |
|---|---|---|
| 1. Dictionary is detailed knowledge, not word definitions | PASS | Card parts and media `v1/src/app/dictionary/CardPage.tsx:259-301`; page editor `PageEditor.tsx:476-669`. |
| 2. One page per pack, deck and card; upward connection; authoring later | PASS | IDs `v1/src/lib/core/pages.ts:26-43`; builder tree `BuilderClient.tsx:278-316`; page writer `router.ts:696-704`. |
| 3. Lessons in order plus reference | PASS | Study queue plus card page stepping `CardPage.tsx:140-159`; deck card list `EntityPage.tsx:182-199`. |
| 4. Manual and AI writing; shared authoring tools | PASS | `PageEditor` shared by builder and reader; shared row helpers `v1/src/lib/client/teaching-editor.ts`; draft path `router.ts:918-937`. |
| 5. Central Course Builder plus Edit buttons | PASS | `BuilderClient.tsx:278-334`; Edit on card page and entity page `CardPage.tsx:224-237`, `EntityPage.tsx:104-106`. |
| 6. Personal changes private to the learner | PASS | Overlay model `pages.ts:51-56`; `learnerEdited` `v1/src/lib/shared/types.ts:70-71`; bundle backup `bundle.ts:899-908`. |
| 7. Teaching layer stays short and links to the card page | PASS | `TeachingLayer.tsx:137-141`; study Dictionary `StudyCard.tsx:267-270`. |
| 8. Never gate the Dictionary; card -> deck -> pack | PASS | Card breadcrumb `CardPage.tsx:179-193`; pack/deck pages `EntityPage.tsx`; no lock in `pageIsWritten`/`pageIsRead`. |
| 9. Card page is stepped B | PASS | `CardPage.tsx:140-159`, dots `:251-257`, arrows `:305-333`; grid CSS `globals.css:3637-3655`. |

Entries 10-32:

| GRILL | Verdict | Evidence |
|---|---|---|
| 10. Arrows bottom-right; speaker on text only; tallest-part grid; pack/deck pages exist | PASS | `CardPage.tsx:259-333`; speaker only on text `:268-280`; grid `globals.css:3637-3655`; `EntityPage.tsx:52-205`. |
| 11. Reading chip: book/check icon, icon-only narrow, words + accessible name/tooltip wide | FAIL | `StudyCard.tsx:242-250` is a text-only pill; no icon and no `title`. `globals.css:541-548` is `border-radius: 999px`. See Gap G5. |
| 12. Hint/Dictionary icon + word, 700px breakpoint, accessible name + tooltip | FAIL | Hint has `aria-label` but no `title`; Dictionary has neither. Word hidden at 700 leaves the link unnamed because the SVG is `aria-hidden`. `StudyCard.tsx:256-270`; `globals.css:3557-3568`. See Gap G6. |
| 13. Warn, never block; warning after an answer | PASS with placement note | Answer remains enabled for page-read purposes `StudyCard.tsx:404`; warning `:412-421`; no trace written by answering (sim `:323-350`). Warning is at top of result, not literally under the buttons; Accepted drift A2. |
| 14. Hint/Dictionary are plain bordered buttons | PASS | `StudyCard.tsx:256-270` uses `btn small study-tool`; no sticker decoration. |
| 15. 8px corners; icon-only 34x34; reading chip not a pill | FAIL | `.chip` 999px `globals.css:541-548`; `.btn` 10px `:431-436`; `.study-tool` 32x32 at 700 `:3557-3568`; `.option` is 9px and matches the answer-button rule. See Gaps G5 and G6. |
| 16. Library book button plus study Dictionary | PASS | `CardsPanel.tsx:188-195`; `StudyCard.tsx:267-270`. |
| 17. Up-right arrow on pack/deck rows; hover/focus; faint touch; own control | PASS | `ScopePicker.tsx:69-86`; CSS `globals.css:2141-2179`; `stopPropagation` `:78`. |
| 18. Cover shape, no sidebar, one column | PASS | `EntityPage.tsx:52-205`; no sidebar markup; one `dict-list` column. |
| 19. Capped list, hidden bar, search 180px/40vw/30px, Escape or outside closes and clears | FAIL | List and size pass (`EntityPage.tsx:126-151`; `globals.css:3814-3843`), but there is no `keydown` or outside-pointer handler. Only the toggle closes. See Gap G4. |
| 20. Coverage, not score; page read only when every part traced; dots persist | PASS | `pages.ts:87-104`; `CardPage.tsx:142-143`, `:251-257`; `browser/pages.ts:84-97`. |
| 21. Text dwell, picture 3s/tap, video 80%, speaker to end, traces device-local | FAIL for linked YouTube video | Text/picture/local video pass `CardPage.tsx:149-159`, `:285-296`, `:60-67`; YouTube progress never attaches `TeachingMedia.tsx:224-257`, `:291-301`. See Gap G3. |
| 22. Tap-to-enlarge earns the picture trace at once | PASS | `CardPage.tsx:285-296`; zoom overlay `:363-383`. |
| 23. Kept vs linked; kept travels; dead file leaves a gone note | PASS | `v1/src/lib/core/media.ts:36-55`; `archive.ts:178-202`; `TeachingMedia.tsx:286-301` failure note. |
| 24. 20 MB per-video cap with the plain refusal | PASS | `media-rules.ts:24-26`, `:78`; `media.ts:187-195`; picker copy `PageEditor.tsx:585-588`. |
| 25. Overall cap, not per-file | PASS | `media-rules.ts:17`, `:45-48`; `media.ts:152-155`, `:168`, `:192`; meter `PageEditor.tsx:671-681`. |
| 26. 300 MB across the library; plain refusal; meter | PARTIAL — quota cannot be freed by removing/replacing | Cap and meter pass; replacement/removal leak in `media.ts:168`, `:192`, `:214-221`; `PageEditor.tsx:194-196`, `:202-219`. See Gap G7. |
| 27. On a phone, video must be linked; pictures may be kept | PASS in the page editor | `PageEditor.tsx:573-583`; `media.ts:187-195`; shared `isTouchFirstMobile` `media-rules.ts:63-67`. The older teaching-layer editor still lists Local file, but the shared store refuses; Accepted drift A4. |
| 28. Tablets too; touch-first mobile, including iPad desktop UA | PASS | `media-rules.ts:63-67`; test `v1/tests/media-rules.test.ts:82-103`; `simulate-course-dictionary.test.ts:430-433`. |
| 29. Pages/media travel with pack; pages/traces in backup; no traces in shared pack; size stated before backup | FAIL on the size statement | Travel rules pass `archive.ts:178-202`, `bundle.ts:783-818`, `:886-984`; no UI statement in `SettingsClient.tsx:295-309`. See Gap G1. |
| 30. Overlay; seed leaves edit alone; delete brings shipped page back | PARTIAL/FAIL on restore | Skip edited row `pages.ts:51-56`; delete `:59-63`; next start does not seed an unchanged pack `seed.ts:74-79`, `:113-118`; notices claim otherwise `DictionaryClient.tsx:176-187`. See Gap G2. |
| 31. One provider lane, one call, exact prompt approved, unsaved answer, limited context | PASS | `router.ts:918-936`; `v1/src/lib/browser/page-draft.ts:27-125`; `v1/src/lib/core/page-draft.ts:31-92`; editor dialog `PageEditor.tsx:744-822`. |
| 32. Editing a page never changes card identity or evidence | PASS | `pages.ts:26-40`; `router.ts:696-704`; sim `:576-600`. |

## Gaps (must fix)

### G1. A full backup starts with no statement of its size

**Evidence**

- `v1/src/app/settings/SettingsClient.tsx:295-309` calls `exportBackupZip()` directly. Both export buttons (`:756` and `:772`) use it. There is no size text and no confirm.
- `v1/src/lib/browser/archive.ts:115-122` builds the zip with no warning.
- `v1/src/lib/core/media-rules.ts:51-55` defines `backupSizeWarning`, but it is referenced nowhere in `v1/src`; only the simulation calls it (`v1/tests/simulate-course-dictionary.test.ts:562-563`).
- `v1/src/lib/browser/autosave.ts:109` also calls `exportBackupZip` for the background autosave, so a confirm must not be put inside the archive function blindly.

**Verdict:** Scenario 10 and GRILL 29 fail. A 300 MB library can start a backup with no size or memory warning. Wire a size statement/confirm in Settings before both export buttons, with the one-pack suggestion only on a touch-first device; keep the background autosave path silent.

### G2. Revert deletes the page instead of restoring the shipped page

**Evidence**

- `v1/src/lib/browser/pages.ts:51-56` writes a shipped page only during bundle import and skips it when the row is learner-edited.
- `v1/src/lib/browser/pages.ts:59-63` deletes the page row and its trace. There is no separate shipped copy.
- `v1/src/lib/browser/seed.ts:74-79` returns `"none"` when the manifest version equals the installed version; `:113-118` skips every `"none"` entry. Deleting an overlay does not change the pack version, so the next start does not re-import the pack.
- `v1/src/app/DictionaryClient.tsx:176-187` deletes and says "The shipped page comes back the next time the app starts." `v1/src/app/BuilderClient.tsx:158-167` says the same.
- `v1/tests/simulate-course-dictionary.test.ts:511-520` makes the simulation pass by manually calling `writeShippedPage(shipped)` after the DELETE. The real start path never does that.

**Verdict:** Scenario 9 and GRILL 30 fail in the normal case: "Revert to shipped page" leaves an empty page until the built-in pack version changes. Fix by keeping the shipped record separately, or by re-importing the pack on revert/start when an overlay is deleted. If the intended behavior is "next seed", change the UI wording and the PRD; do not claim "next start".

### G3. A linked YouTube video can never earn its 80% trace

**Evidence**

- `v1/src/app/TeachingMedia.tsx:224-257` runs the progress effect on mount. At that moment `frameRef.current` is null because the iframe is only rendered after the probe says `"ready"` (`:291-301`). The effect returns early at `:226-227`.
- The effect dependency is only `[onProgress]` (`:257`). When the probe flips to ready, the iframe mounts, but the parent does not re-render `YouTubeVideo` with a new `onProgress`; the effect does not run again. No `message` listener is attached.
- `v1/src/app/dictionary/CardPage.tsx:60-67` correctly maps `share >= 0.8` to a trace, but it never receives a progress event from the YouTube path. Local and web `<video>` paths do report progress (`TeachingMedia.tsx:157-172`).
- The simulation never plays a video; it calls `trace()` directly (`simulate-course-dictionary.test.ts:223-251`).

**Verdict:** Scenario 2 and GRILL 21 fail for linked YouTube video parts. A card page with a YouTube part can never become "read". Fix the effect dependency/ref timing (for example, include the probe state or attach the listener from a callback ref once the iframe exists).

### G4. Search cannot be closed with Escape or an outside press

**Evidence**

- `v1/src/app/dictionary/EntityPage.tsx:53-54` holds `searchOpen` and `query`; `:126-151` renders the input and the toggle.
- The only close path is pressing the toggle (`:144-147`), which also clears the query. There is no `keydown`, `pointerdown`, or document listener in the component.
- GRILL 19 requires: "Escape or a press outside closes it and clears the filter." The rest of the search rules pass: input hidden until pressed, 180px/40vw/30px, same line, hidden scrollbar.

**Verdict:** GRILL 19 fails. Add Escape and outside-press close, and clear `query` on both.

### G5. The reading chip is not the locked icon chip

**Evidence**

- `v1/src/app/study/StudyCard.tsx:242-250` renders a `Link` with class `chip` and the text "Page not read" / "Page read". There is no book icon, no check icon, no `title`, and no icon-only narrow variant.
- `v1/src/app/globals.css:541-548` gives `.chip` a 999px pill radius, not the locked 8px corner. GRILL 11/13/15 call for a book/check icon, icon-only on a narrow screen with the words as accessible name and tooltip, and an 8px corner.
- The link behavior is correct: it opens the page and does not mark it read (`StudyCard.tsx:243-247`; `DictionaryClient` does not trace on open).

**Verdict:** GRILL 11 and 15 fail. The state and the way in are right; the visual and accessible form is wrong.

### G6. Hint and Dictionary do not meet the locked 8px/34x34/accessibility rules

**Evidence**

- `v1/src/app/study/StudyCard.tsx:256-265`: Hint has `aria-label="Ask for a hint"` but no `title`; its icon is `aria-hidden`.
- `v1/src/app/study/StudyCard.tsx:267-270`: the Dictionary `Link` has no `aria-label` and no `title`. Its only text is `.study-tool-word`, which `v1/src/app/globals.css:3558-3560` hides at `max-width: 700px`. With `BOOK` marked `aria-hidden` (`StudyCard.tsx:38-42`), the link has no accessible name on a narrow screen.
- `v1/src/app/globals.css:3562-3566` makes `.study-tool` 32x32, not the locked 34x34.
- `v1/src/app/globals.css:431-436` gives `.btn` a 10px radius; `.study-tool` (`:3531-3535`) does not override it, so the buttons are not the locked 8px.
- The 700px word breakpoint itself is correct (`globals.css:3557-3560`), and the buttons are plain bordered buttons as GRILL 14 requires.

**Verdict:** GRILL 12/14/15 fail on tooltip, accessible name, corner radius, and icon-button size. The Dictionary link is unusable by name on a phone-sized screen.

### G7. Kept-media quota cannot be freed by replacing or removing a file

**Evidence**

- `v1/src/lib/core/media-rules.ts:45-48` supports `replacingBytes`, and the IMPL explicitly requires "existing records excluded when replacing" (`IMPL-course-dictionary.md:43-44`).
- `v1/src/lib/browser/media.ts:168` (image) and `:192` (video) call `mediaCapProblem(total, adding)` without the old record's bytes. The old blob remains in the media store, so a replacement is counted against the cap twice.
- `v1/src/app/dictionary/PageEditor.tsx:202-219` stores a new record and repoints the part, but never deletes the old record. `:194-196` removes a row from editor state only.
- `v1/src/lib/browser/media.ts:214-221` defines `deleteUnreferenced`, but no production code calls it. The simulation calls it directly (`simulate-course-dictionary.test.ts:407`), which hides the leak.

**Verdict:** GRILL 26 and IMPL Phase 2 are not met. Replacing a kept file can be refused even when the net size fits, and "remove a kept file" does not reclaim the 300 MB budget. Pass the replaced id's bytes to the cap check and run orphan cleanup after save/replace/remove.

## Doc updates needed

### D1. The API table does not match the router

- `PRD-TRD-course-dictionary.md:215` says `POST /api/pages/<id>/traced` takes `{ part }`; the router reads `record.index` (`v1/src/lib/browser/router.ts:941`) and the client sends `{ index }` (`v1/src/app/DictionaryClient.tsx:139-161`).
- `PRD-TRD-course-dictionary.md:216` says `POST /api/pages/draft` takes `{ page, instruction }`; the router reads flattened `level`, `packName`, `deckId`, `cardId`, `instruction` (`router.ts:918-932`), and `PageEditor.tsx:304-314` sends that shape.
- `PRD-TRD-course-dictionary.md:217` says `POST /api/pages/draft/send` returns `{ text }`; the router returns `{ draft }` (`router.ts:933-936`), and the editor reads `answer.draft` (`PageEditor.tsx:328-331`).

**Verdict:** Update the table to the shipped shapes (or change the code). The simulation uses the shipped shapes, so the PRD is the drift.

### D2. Core and browser symbol names drifted

- `IMPL-course-dictionary.md:19` names `tracedSecondsForText`; the code exports `tracedTextMs` (`v1/src/lib/core/pages.ts:52`).
- `IMPL-course-dictionary.md:20-21` names `pageSchema` and `pageIssues`; the code exports `savedPageSchema` (`pages.ts:164`) and `pageRuleProblems` (`:140`).
- `IMPL-course-dictionary.md:41` names `readTraces(pack page ids)` and `recordTrace`; the code exports `readTraces()` with no argument (`v1/src/lib/browser/pages.ts:66`) and `recordTracedPart` (`:84`).
- `IMPL-course-dictionary.md:42` names `pageMediaIds`; no such symbol exists. The walker is `mediaIdsInPage` (`v1/src/lib/core/media.ts:36-43`).

**Verdict:** Rename the IMPL list or add compatibility aliases. The behavior is present; the phase document would mislead the next implementer.

### D3. "Parts min 1" is only true for card pages

- `IMPL-course-dictionary.md:20-21` says `pageSchema` has "parts min 1".
- `v1/src/lib/core/pages.ts:173` defaults `parts` to `[]`, and `pageRuleProblems` only rejects zero parts for card pages (`:148-153`).
- `v1/src/app/dictionary/PageEditor.tsx:242-245` only blocks an empty card page; `:264-267` preserves pack/deck parts.
- The simulation itself saves pack and deck pages with `parts: []` (`simulate-course-dictionary.test.ts:265-278`), and Scenario 6 expects that.

**Verdict:** Document "card pages need at least one part; pack/deck pages may be cover/lead only." Do not change the schema unless the PRD model is also changed.

### D4. The seed/overlay location and trace reader wording drifted

- `IMPL-course-dictionary.md:59-60` puts the overlay rule in `seed.ts`; the rule is implemented by `writeShippedPage` in `v1/src/lib/browser/pages.ts:51-56`, called by `bundle.ts:597`. `seed.ts:122` only calls `importBundle`.
- `IMPL-course-dictionary.md:41` says `readTraces(pack page ids)`; the implementation reads every trace (`pages.ts:66-68`).

**Verdict:** Update the phase file list and signatures to the shipped layering.

### D5. `editedFromShipped` is implemented but undocumented

- The field exists at `v1/src/lib/shared/types.ts:72-73`, is set at `v1/src/lib/core/pages.ts:208-212`, gates revert at `v1/src/app/DictionaryClient.tsx:223` and `v1/src/app/BuilderClient.tsx:329-333`, is carried in backups at `v1/src/lib/browser/bundle.ts:905`, and is exercised by the sim at `:507` and `:520`.
- Neither the PRD data model (`PRD-TRD-course-dictionary.md:168-186`) nor the API table (`:213-218`) nor the IMPL mention it.

**Verdict:** Add `editedFromShipped` to the data model/API notes. It is the marker that distinguishes "the learner made this page" from "this is an overlay of a shipped page"; without it, revert cannot be gated safely. It does not contradict GRILL 30.

### D6. `learnerEdited` is documented too narrowly

- `PRD-TRD-course-dictionary.md:184-185` says `learnerEdited` is "Set when the learner changed a shipped page."
- `v1/src/lib/core/pages.ts:206` sets `learnerEdited: true` on every page saved through `pageFromSave`, including a brand-new learner-created page. `editedFromShipped` (`:208-212`) is what actually means "overlay of a shipped page."
- `PRD-TRD-course-dictionary.md:213` repeats "marks `learnerEdited` on a shipped page."

**Verdict:** Define `learnerEdited` as "this row was saved by the learner" and use `editedFromShipped` for the shipped-overlay case. The current wording invites a future regression where a user-created page is treated as a shipped overlay.

### D7. Study page loading is not "pack pages once per session"

- `PRD-TRD-course-dictionary.md:247-249` says Study fetches the pack's pages once per session and keeps a `cardId -> read` map.
- `v1/src/app/StudyClient.tsx:377-414` fetches all `/api/pages` (every pack), on mount and again on window focus and visibility change; it stores sets of page ids, not a `cardId` map.

**Verdict:** Update the architecture note. The shipped behavior is fresher and simpler for this data size; see Accepted drift A3.

### D8. "Pages read N of M" counts card pages only

- `v1/src/lib/core/pages.ts:94-104` explicitly filters `level === "card"` and `parts.length > 0`.
- `PRD-TRD-course-dictionary.md:218` and GRILL 20 only say "Pages read N of M"; neither states the scope.
- Pack/deck pages are covers with no readable parts, so including them would make the denominator unreadable pages.

**Verdict:** Document "card pages with at least one part." This is a correct reading of GRILL 20, not a behavior bug; see Accepted drift A3.

### D9. Scenario 2's "spoken video" has no implementation

- `PRD-TRD-course-dictionary.md:39` says "hears a spoken video to the end."
- The speaker is only attached to text parts (`CardPage.tsx:268-280`); video parts use the 80% playback trace (`:60-67`), and there is no speak control for a video.

**Verdict:** Change the PRD line to "hears a text part read to the end" (the GRILL 21 rule) or remove the video-speaker clause. The implemented rule is the text speaker plus 80% video.

### D10. `simulate-pre.html` does not exist under that name

- `IMPL-course-dictionary.md:140` says "`simulate-pre.html` archived."
- The feature directory contains `simulate.html`, not `simulate-pre.html` (`docs/features/course-dictionary/`).

**Verdict:** Rename/archive the intended pre-implementation file, or correct the IMPL to name `simulate.html`. As written, the reconciliation instruction cannot be followed.

### D11. The PRD and GRILL disagree on when a reverted page returns

- `PRD-TRD-course-dictionary.md:121-122` says the shipped page "returns on the next start."
- GRILL 30 says "on the next seed."
- The code only re-imports on install/update (`seed.ts:74-79`, `:113-118`), so neither "next start" nor an immediate revert works today.

**Verdict:** Pick one canonical behavior and state it in both documents. The gap fix in G2 should make the chosen wording true; do not leave "next start" in the PRD while the seed only runs on a version bump.

### D12. The "one PageParts renderer" architecture note is false after the fold

- `PRD-TRD-course-dictionary.md:245-246` says one `PageParts` renderer serves the reader and the preview.
- `PageParts.tsx` and `TraceMeter.tsx` do not exist. The reader renders parts inside `CardPage.tsx:259-301`; the preview re-renders them inline at `PageEditor.tsx:729-739`; the meter is inline at `:671-681`.

**Verdict:** Update the architecture note to say `CardPage` owns the reader rendering and `PageEditor` owns the preview. See Accepted drift A1.

### D13. The "orphan cleanup" claim is not wired

- `PRD-TRD-course-dictionary.md:227-228` says export, backup, archive and orphan cleanup keep page media.
- `deleteUnreferenced` exists (`v1/src/lib/browser/media.ts:214-221`) but is never called in production; only the simulation calls it (`simulate-course-dictionary.test.ts:407`).

**Verdict:** Either wire cleanup after page/media saves (G7) or change the note to say orphan cleanup is defined but not run. The current sentence implies a cleanup that does not happen.

## Accepted drift (recommended)

These are drifts I recommend accepting and documenting rather than reworking for this feature.

### A1. `PageParts.tsx` and `TraceMeter.tsx` were folded into `CardPage.tsx` and `PageEditor.tsx`

`IMPL-course-dictionary.md:71` still lists the two files. The reader, dots, arrows, and meter are inline in `CardPage.tsx:140-333`; the editor meter and preview are inline in `PageEditor.tsx:671-681` and `:713-741`. The fold is reasonable for the amount of UI; the only real cost is the false "one renderer" note (D12).

**Verdict:** Accept the fold. Update the IMPL file list and the PRD architecture note; do not split the components just to match the plan.

### A2. The warning is at the top of the result panel, not literally under the answer buttons

`v1/src/app/study/StudyCard.tsx:411-421` renders the warning inside `.study-result`, after the answer action and before the answer text. GRILL 13 says "under the answer buttons." It is still after the answer, visible at the start of the result, and contains the required link; the page-read rule does not disable anything (`:404`).

Separately, the Answer button is disabled by `!canSubmit` (`:404`) until the card holds an attempt. That comes from the existing study-card-guidance pack, not from `requirePageRead`; the Dictionary rule itself never blocks.

**Verdict:** Accept both. If GRILL 13 is read absolutely, add a cross-reference noting the unrelated attempt gate; do not remove the study-card guidance.

### A3. Scope choices: card-only page count, all-pages Study fetch, broad `learnerEdited`, empty pack/deck pages

- Page count is card-only (`v1/src/lib/core/pages.ts:94-104`). Pack/deck pages are covers and cannot be "read" in the trace sense; counting them would make the denominator misleading.
- Study fetches all pages on focus rather than the pack's pages once (`v1/src/app/StudyClient.tsx:377-414`). This keeps the chip fresh after reading in another tab and is cheap at this scale.
- `learnerEdited` marks every saved page (`v1/src/lib/core/pages.ts:206`); `editedFromShipped` marks the actual overlay (`:208-212`). This is a cleaner internal distinction than the PRD wording.
- Pack/deck saves may carry no parts (`v1/src/lib/core/pages.ts:173`; `PageEditor.tsx:242-245`), because those pages are lead/cover pages. The IMPL's "parts min 1" is the outlier.

**Verdict:** Accept all four; document them in the PRD/IMPL. None changes a GRILL-visible behavior.

### A4. The older teaching-layer editor still offers Local file on mobile

`v1/src/app/library/TeachingEditor.tsx:318-345` still renders the Local file option for a video on a touch-first mobile browser. The shared `storeVideoFile` refuses it (`v1/src/lib/browser/media.ts:187-195`), so no local video can be kept; only the UI offers a dead choice. GRILL 27's "offers only the address field" is implemented in the new `PageEditor` (`PageEditor.tsx:573-583`) but not in the pre-existing teaching editor.

**Verdict:** Accept for this feature. If a follow-up touches `TeachingEditor`, hide the Local option with the same `deviceIsTouchFirstMobile()` check; the data rule is already enforced.

### A5. The simulation is a rehearsal, not a UI test

- Scenario 1 checks CSS fragments, not the rendered page (`simulate-course-dictionary.test.ts:187-221`).
- Scenarios 4, 5, and 6 primarily check source strings (`:304-392`).
- Scenario 2 calls `trace()` directly and never plays a video (`:223-251`).
- Scenario 7 calls `deleteUnreferenced()` directly (`:407`), which no production code does.
- Scenario 8 never makes a successful provider call; it only checks the refused/reused path (`:441-487`).
- Scenario 9 manually calls `writeShippedPage` after the DELETE (`:511-520`), masking G2.
- Scenario 10 calls `backupSizeWarning` as a pure function (`:562-563`), masking G1.

**Verdict:** Accept the sim as a regression contract for the pure rules and router shape, but add UI-level assertions for Scenarios 2, 9, and 10, and for the GRILL 11/12/15/19 controls. The current green run should not be read as full coverage.

## Summary

The data model, router, media rules, pack/backup travel, draft lane, progress line, and page/card separation are in good shape. The post-implementation simulation is green, and most of GRILL 1-10 and 20-32 hold.

The hard failures are:

1. No backup size statement before export (G1).
2. Revert does not restore the shipped page on the next start (G2).
3. Linked YouTube videos can never earn the 80% trace (G3).
4. Search cannot close with Escape or an outside press (G4).
5. The reading chip is not the locked icon chip (G5).
6. Hint/Dictionary miss the 8px/34x34/accessibility rules, and Dictionary has no name at 700px (G6).
7. Replacing/removing kept media does not free the 300 MB quota (G7).

The documentation needs the API-shape, naming, `editedFromShipped`, `learnerEdited`, Study-fetch, card-only count, "spoken video", `simulate-pre.html`, and folded-component corrections listed above.
