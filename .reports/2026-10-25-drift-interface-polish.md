# Drift Review: interface-polish (pwa-deploy + learner-interface follow-up)

**Date:** 2026-10-25
**Reviewer:** fresh sub-agent (read-only)
**Scope:** uncommitted branch fix/interface-polish at 69805ef772c0e9cb22812b0b8d8e35f4144a2ff9
**Verdict:** Major Drift

## Summary
- Findings: 7 — 2 real gaps, 3 extensions, 1 contradiction, 1 stale-reference cluster.
- Origin classification verified: **no**. The goal report says `surgical-change` (`.reports/goal-interface-polish.md:19`), but at least three items are new design, not gaps: the Lucide icon artwork, the pinned phone bar, and the Study plan rail. D-12, D-13 and D-14 were written in this same uncommitted change (`git diff docs/drift.md` adds all three), so they cannot be the pre-existing D-N entry that authorises surgery. Only the missing favicon and the 16px select sizing are genuine bug/gap fixes. Per `docs/ethics/origin.md:14`, "Cannot tell? It is a feature."
- Recommended action: **stop and get a decision**. The icon identity contradicts a shipped PRD and the plan rail / pinned bar exceed what the locked docs say. Then fix code for F3 (commit the favicon), correct the drift entries, and update the PRD lines.

**Premise note:** only the two GRILL files carry `Status: Locked`. `PRD-TRD-pwa-deploy.md:3` says "Shipped and live, 2026-10-23"; `PRD-TRD-learner-interface.md:4` says "Approved under delegated authority, 2026-10-24". I treated the GRILL decisions plus the shipped PRD/IMPL text as the contract, since the GRILLs point to them as the build record.

**Contract checks that passed:**
- Manifest has exactly 192 any, 512 any, 512 maskable (`v1/public/manifest.webmanifest:13-31`). The three files really are 192x192, 512x512 and 512x512, bit depth 8, colour type 6 (RGBA). The two 512 files are byte-identical (same md5), so the maskable file has no separate safe-zone padding; the Layers mark sits inside the central 80%, so this is acceptable, not drift.
- Root layout links manifest and both PNG sizes with `withBasePath`, and the Apple touch icon uses the 192 file (`v1/src/app/layout.tsx:27`, `:35-40`). The existing base-path export confirms all five icon links plus the manifest are prefixed and every target exists in `out/` (`v1/out/index.html`); nothing links to a 404.
- `/` already opened Study before this branch: `v1/src/app/page.tsx:8-10` returns `<StudyClient />`, and the file is unmodified (last touched in baseline commit `59ba030`). The goal report's iteration 1 plan to "reproduce the root/favicon 404" (`.reports/goal-interface-polish.md:33`) is wrong about the root; only the favicon was missing.

## Findings

### F1: The phone bar is pinned and blurred; the doc never promised a sticky bar
**Verdict:** extension
**Doc claim:** "At 860px and below the shell becomes one grid column. The sidebar becomes a compact top bar: brand, then the four links." (`docs/features/pwa-deploy/PRD-TRD-pwa-deploy.md:43-44`); "The top bar reserves space on the right for the install button." (`:46`). No sentence in §3.1 promises pinning or a backdrop.
**Code reality:** `.sidebar` is now `position: sticky; top: 0; z-index: 30;` with `backdrop-filter: blur(14px)` and `padding: 10px 70px 10px 14px` inside the 860px block (`v1/src/app/globals.css:161-176`, sticky at `:162`). The bar is two grid rows (brand, then four links, `:165-189`), not one compact row.
**Plain English:** the phone navigation now stays on screen while scrolling and has a frosted background. The written promise only says the sidebar "becomes a compact top bar", so the lasting bar is extra behaviour the learner was never promised. The job brief did ask for it ("a visible sticky header at 390x844", `.reports/goal-interface-polish.md:7-8`), but the shipped PRD was not updated.
**Origin:** feature-pipeline
**Recommendation:** update docs — add the pinned-bar rule to pwa-deploy §3.1 (or revert to the static bar). This is a design decision, so record it in the PRD, not only in a drift entry.

### F2: The icon generator now draws Layers, contradicting the locked card artwork
**Verdict:** contradiction
**Doc claim:** "The icon generator is a dependency-free Node script that writes valid RGBA PNGs: a deep green field with two stacked cards and three text lines." (`docs/features/pwa-deploy/PRD-TRD-pwa-deploy.md:80-81`)
**Code reality:** the generator header now says "the Lucide Layers mark" (`v1/scripts/make-pwa-icons.mjs:3`) and the drawing code strokes eight diagonals into three stacked chevrons (`:82-95`). `v1/src/app/icon.svg:3-7` draws the same three Layers paths. The committed PNGs were regenerated at 12:25 and no longer contain cards or text lines.
**Plain English:** the app icon changed from two stacked cards to a stack of Layers diamonds. The shipped doc still describes the cards, so the doc now describes artwork that no longer exists. Anyone who reads the doc and regenerates, or reviews the store/install icon against it, will be misled. This is not a gap the doc already promised; it reverses the doc.
**Origin:** feature-pipeline (a new visual identity). The job brief asked for "a real Lucide logo/favicon" (`.reports/goal-interface-polish.md:4-5`), but a brief is not a locked decision and the PRD was not amended.
**Recommendation:** get a decision — either approve Layers and rewrite PRD §3.3 (and the icon.svg history note), or restore the card artwork. Do not merge with a shipped PRD contradicting the code.

### F3: `favicon.ico` is generated but not committed
**Verdict:** real gap
**Doc claim:** "The icons are committed and regenerated before every build." (`docs/features/pwa-deploy/PRD-TRD-pwa-deploy.md:82`)
**Code reality:** `git status` shows `?? v1/public/favicon.ico`. It is not ignored (`git check-ignore` says "not ignored"), so it simply was never added. The file itself is valid: ICO header reserved 0, type 1, count 3, entries 16, 32 and 48 at 32 bpp, each holding a PNG (colour type 6). It is written by `v1/scripts/make-pwa-icons.mjs:184`, and `prebuild` runs that script (`v1/package.json:8`), so a build regenerates it — but the "committed" half of the promise is false.
**Plain English:** a fresh checkout has no favicon until someone runs a build or the icons script. The tab icon depends on a generated file that is not in the repo. The build is self-healing, so this is housekeeping, not a broken page.
**Origin:** surgical-change (commit the generated asset; the missing favicon was a genuine bug). Note the browser's origin-root `/favicon.ico` request still 404s on GitHub Pages under `/flashcards`; the `<link rel="icon" href="/flashcards/favicon.ico">` is what browsers use, which is fine but worth stating in the PRD.
**Recommendation:** fix code — commit `v1/public/favicon.ico` (and the regenerated PNGs) with the branch.

### F4: The Study plan rail is new design; the promised rail is the running one and already exists
**Verdict:** extension
**Doc claim:** "**When** the learner opens Study / **Then** the card column is about 820px and a session rail shows the scope, the offer, answered count, cards left, hints used, tutor state and an end control." (`docs/features/learner-interface/PRD-TRD-learner-interface.md:73-75`); GRILL Q3 says "Study keeps a readable 820px card and adds a session rail with the offer, progress, tutor state and an end control" (`GRILL-learner-interface.txt:44-46`).
**Code reality:** the running rail already does exactly that: cards offered, answered, left, hints used, tutor on/off and "End this session" (`v1/src/app/StudyClient.tsx:1046-1081`). The branch adds a second rail to the **plan** screen (`:642`, `:688-726`) with different facts: a count, "Tutor", "Score / None kept" (`:698-707`), "Start session" (`:714`) and "What to expect" (`:722`). The doc's facts (answered, cards left, hints used, end control) cannot exist before a session starts.
**Plain English:** the plan screen was never described in the locked pack. The rail there is a new design that looks consistent, but calling it the promised "Study rail" rewrites the promise after the fact. No learner-facing behaviour breaks.
**Origin:** feature-pipeline
**Recommendation:** update docs — add the plan shape and its facts to learner-interface Scenario 3, and reclassify D-13 from "real gap" to "extension". Alternatively revert the plan rail; do not leave it undocumented.

### F5: 16px on selects is scoped correctly, but the "one family" height and radius still differ
**Verdict:** real gap (minor, pre-existing and slightly widened)
**Doc claim:** "**Given** any input, select, textarea or button / **Then** it shares a consistent height, radius, border, focus ring and disabled state; selects show a visible chevron and a comfortable hit area." (`docs/features/learner-interface/PRD-TRD-learner-interface.md:79-81`)
**Code reality:** font size is not one of the promised properties, and it is scoped properly: `input.field, select.field, textarea.field` are `font-size: 1rem`, `min-height: 44px`, `border-radius: 11px` (`v1/src/app/globals.css:482-496`); `.study-select` repeats the same metrics (`:1309-1323`) and is not given a `field` class (`v1/src/app/StudyClient.tsx:162-163`, `:180-181`). Buttons are still `min-height: 40px; border-radius: 10px` (`globals.css:240-249`), and `.btn.small` is 32px (`:267-271`). Before the branch, fields were 42px and buttons 40px, both radius 10; the change made the gap 4px and the radius 1px apart.
**Plain English:** the 16px fix is right and does not break the control family. The family promise was already imperfect: buttons and fields do not literally share one height or radius, and this change widens that slightly. The duplicated `.study-select` rule can drift from `.field` later.
**Origin:** surgical-change (aligning controls) or a decision to accept two sizes.
**Recommendation:** get a decision — either bring buttons to 44px/11px, or record in the PRD that buttons are 40px/10px and fields 44px/11px. In code, add `.field` to `.study-select` (or merge the rule) so there is one source.

### F6: Settings labels moved to `form-grid` / `field-label` with no specific promise
**Verdict:** extension
**Doc claim:** no line names Settings. The nearest hook is GRILL Q5: "Form sections have clear headings and spacing, not inline style patches." (`docs/features/learner-interface/GRILL-learner-interface.txt:63-64`). Scenario 4 is about control appearance, not labels (`PRD-TRD-learner-interface.md:77-81`).
**Code reality:** the profile block replaces inline `Level:` / `Style:` text with `form-grid` and `field-label` (`v1/src/app/settings/SettingsClient.tsx:298-315`). Both classes already existed from the learner-interface pack at the previous commit (`git show HEAD:v1/src/app/globals.css` has `.field-label` at 730 and `.form-grid` at 766), so this reuses the family rather than inventing one.
**Plain English:** the Settings labels now stack like the rest of the forms. It is a small consistency improvement, but no locked doc promised this screen, so it is extra scope.
**Origin:** feature-pipeline (weakly justified by Q5; if accepted as Q5 cleanup, it is surgical).
**Recommendation:** log drift — note it as an extension in the learner-interface doc; no code change needed.

### F7: Drift entries D-12, D-13 and D-14 misquote the docs and point at the wrong lines
**Verdict:** stale reference
**Doc claim / code reality:** detailed in the table below. The worst case is D-14 citing `PRD-TRD-pwa-deploy.md:42`, which is the single word "column." — the tail of the desktop sentence. The phone-bar promise is at `:43-44`, and the install reservation at `:46`.
**Plain English:** the log itself is unreliable: three entries were written from memory, and two of them quote promises the docs do not make. A future agent following the citations will land on the wrong text and may "fix" the wrong thing.
**Origin:** process (drift-log correction), not code.
**Recommendation:** log drift — rewrite the three entries with the corrected claims and lines. Keep them Open only for the unfinished doc updates.

## StudyClient logic check

**No logic changed.** The diff is 153 insertions and 106 deletions (259 changed lines) across seven hunks, all inside the `phase === "plan"` render block that starts at `v1/src/app/StudyClient.tsx:634` (`return` at `:641`). The only other hunk is the file header comment (`:11-12`).

What moved: the plan title/lead into `.study-plan-head`, `ScopePicker` into `.study-plan-main`, the offer input and "Rebuild the plan" into a restyled `.plan-bar`, the Start button into the new `study-plan-rail` as "Start session", and the two `<details>` blocks into `.study-plan-details`. The only behavioural-looking edits are presentational: inline `style={{ width: "5.5rem" }}` became `.plan-offer .field { width: 5.5rem }` (`globals.css:322-325`), and the button label changed from "Start" to "Start session".

Untouched: every hook, `loadPlan`, `startSession`, `finish`, grading, scheduling, queue construction, evidence writes and IDB calls. `startSession` is still the same handler passed to the moved button (`StudyClient.tsx:714`). The running rail, full-screen logic and card loop are outside the diff. The "no study logic change" claim holds.

## Existing drift entries D-12..D-14

| Entry | Claim accurate? | Line refs correct? | Still open? | What it needs |
|---|---|---|---|---|
| D-12 | **No.** It says the doc promises "the PWA icons carry the app mark" and cites `pwa-deploy:80`; that line says the opposite ("a deep green field with two stacked cards and three text lines", `:80-81`). Also "no SVG mark was shipped" is false: `v1/src/app/icon.svg` existed at HEAD with the old card artwork (`git show HEAD:v1/src/app/icon.svg`). | `layout.tsx:33` is the icons block in the **current** file; it was `:32` before the change. `icon.svg` is given with no line because it was rewritten, not added. | Yes. Code mostly done (ICO valid, links added, checker requires them), but `favicon.ico` is untracked and the PRD still locks the card artwork. | Correct the claim, cite `:82` for "committed" and `:83-84` for layout, restore or update the artwork line, commit the favicon, and update the docs (the "To fix" says "code and docs"; docs were not touched). |
| D-13 | **Partly.** It calls the plan rail a promised "wide main-plus-rail shape", but the Study promise lists answered/left/hints/end facts that only exist while running (`learner-interface:73-75`). The running rail already exists (`StudyClient.tsx:1046-1081`). | `StudyClient.tsx:642` is correct. `globals.css:1323` is wrong: that is the closing brace of `.study-select`. `.study-plan-layout` is at `:1339`. | Yes. Code done; docs untouched (no plan-shape lines added). | Reclassify as extension, fix the CSS line, and record the plan shape in the PRD or revert it. |
| D-14 | **Partly.** The phone-bar claim is real, but "offer text at 13.6px" is unsupported: the offer field is `input.field` in `.plan-bar`, not inside `.study-scope-field`, so it inherited 16px before the change; only the two `.study-select` values inherited `0.85rem`. | Three wrong refs: `pwa-deploy:42` is the word "column." (claim is `:43-44`, reserve `:46`); `learner-interface:77` is the Scenario 4 heading (promise is `:79-81`); `globals.css:157` is `grid-template-columns: 1fr` (sticky is `:162`); `globals.css:1295` is `.study-scope-field {` (font sizes are `:486` and `:1311`). | Yes. Code done (sticky, 16px), but the phone rule is not in the PRD. | Correct the refs and the 13.6px sentence, and add the pinned-bar/16px rule to the docs. |

Also note the shape problem: all three are **Open** entries yet their "Code reality" describes the fixed state ("it now uses…", "the fix is…"). An Open entry should record the gap; describing the remedy as current reality hides that the fix is uncommitted. Either mark them Resolved on commit or keep the "before" wording.

## Test honesty

- `v1/tests/pwa-deploy.test.ts:61-78` ("ships a real favicon and links the SVG mark") checks **artifacts**, not behaviour: the built `index.html` contains `rel="icon"`, `favicon.ico` and `icon.svg`; `out/icon.svg` exists; the ICO header says at least two entries (`:70`); and the worker precache JSON contains both names. That is stronger than a class-name check, but it never fetches the icon, never validates the entries decode, and never checks the entry sizes (16/32/48) or that the file is reachable under the base path. It passes vacuously when there is no build (`if (!hasBuild) return;`, `:62`, with the guard defined at `:15`).
- `v1/tests/simulate-study-experience.test.ts:123-129` is **text only**. It asserts that the built tree contains the strings "study-plan-layout" and "Start session" (they match the class name in a JS chunk, not a rendered layout), and it regex-matches the built CSS text for `font-size: 1rem; font-weight: 400` in `select.field` and `.study-select`. It does not measure a rendered control, does not prove 16px wins the cascade on the server-rendered page, and does not test the plan rail at 1440 or 390. It also skips silently when `out/` is absent (`:116`).
- Nothing tests the sticky bar, the plan grid, the icon artwork (which is good, because the artwork contradicts the doc), or the Settings label change.
- Plainly: the PWA test checks real files and headers; the Study rehearsal checks that words and CSS declarations appear somewhere in the build. Neither is a browser-behaviour test, and both can pass without a build.

## Drift Items to Log

- **Favicon not committed** (real gap, pwa-deploy §3.3 `:82`): commit `v1/public/favicon.ico` and the regenerated PNGs; correct D-12 to cite `:82` for "committed" and drop the false "no SVG mark" sentence.
- **Control family** (minor real gap, learner-interface Scenario 4 `:79-81`): buttons 40px/10px vs fields 44px/11px; decide one height/radius or document the exception. The 16px select fix itself is correct and needs no change.
- **Doc updates for accepted extensions/contradiction:** icon artwork (pwa §3.3 `:80-81`), pinned phone bar (pwa §3.1 `:43-46`), Study plan rail (learner Scenario 3 `:73-75`), Settings label markup (learner Q5 `:63-64`). These are decision records, not drift fixes; do not fold them into D-12..D-14 as if the doc already promised them.

## Recommendation

Stop and get a decision before committing. The execution is clean — StudyClient only rearranged plan-phase markup, and nothing in scheduling, grading, evidence or storage moved — but the branch knowingly replaces the icon design a shipped PRD still locks, adds a pinned phone bar and a plan rail the PRD never describes, and labels the whole job `surgical-change` while writing its own D-12..D-14 entries in the same diff. Approve the new visual identity and the two layout additions, then update the PRD lines in the same commit and commit the favicon; or revert the parts that were not decided. Either way, rewrite D-12, D-13 and D-14 first: their doc quotes are wrong (`pwa-deploy:42` lands on "column.", `:80` describes cards while the entry claims an "app mark"), which is exactly how the previous memory-written log went wrong.
