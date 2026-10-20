# Drift Review: v1-prototype

**Date:** 2026-10-19
**Reviewer:** sub-agent
**Verdict:** Minor Drift

## Summary

Counts:

- **Contract gaps:** 10 (5 touch locked decisions: R16, R11, R7, the stop/no-report rule, and the retry-marking rule).
- **Execution gaps:** 3 phases partial (Phase 4, Phase 7, Phase 8); Phase 9 verified by this review except the manual browser walkthrough; Phases 0, 1, 2, 3, 5, 6 pass; Phase 10 is this report.
- **Simulation gaps:** 3 of 10 points partial (points 3, 4, 10); 7 of 10 fully demonstrated.

Verification runs from this review (WSL Debian, after `npm run build`):

- `npm run typecheck` — pass, no output.
- `npm run lint` — pass, no output.
- `npm test` — 23 files, 228 tests, all pass.
- `npm run build` — pass (Next.js 16.4.2, 24 pages/routes).
- `npm run simulate` — 10 checks, 10 passed, 0 failed.

Recommended action: fix the small set of locked-behaviour gaps in the UI and offer maths before the prototype is used for the runtime trial; update the docs where the implementation legitimately moved (file layout, evidence drawer location) or log the rest as drift items.

## Contract Gaps

### 1. Working region is half-built (locked decision R16)

- **Expected:** GRILL R16 (lines 198–203): "The learner's working is held in the browser, shown beside the pack's correct working after the answer, and never sent to the server or written to evidence."
- **Found:** `v1/src/app/StudyClient.tsx:545-552` renders the working textarea before answering. After the answer, the reveal at `StudyClient.tsx:562-565` shows only the answer side and the judged rows. The learner's `working` state and `answerDef.working.expected` are never rendered anywhere (checked by grep: `working` only appears in the type, the schema, and that one textarea).
- **Plain English impact:** The learner types working, it is discarded as promised, but the promised side-by-side comparison with the pack's correct working never happens. The sample pack has 0 cards with a working region, so a user would not hit it, but the locked capability is incomplete.
- **Recommendation:** fix code (render the learner's working beside `answerDef.working.expected` after the reveal, still browser-only), or consciously descope and log drift.

### 2. Returning cards are not marked, and nearly/unjudged cards return too

- **Expected:** PRD 2.2 (line 61): "Wrong cards return once in the same session, plainly marked as returning." GRILL (line 39): "A card answered wrongly returns once at the end of the same session."
- **Found:** `StudyClient.tsx:231-234` queues a card whenever `response.cardOutcome !== "got_it"` — that includes `nearly` (a hint-capped correct answer) and `unjudged`. The running screen (`StudyClient.tsx:474-477`) only shows "Card X of Y"; nothing says a card is returning or why.
- **Plain English impact:** A correct answer that used a hint comes back, and a card the learner cannot yet judge comes back, but the screen never explains why a card reappeared.
- **Recommendation:** fix code — queue only genuinely wrong outcomes (`again`, `no`, using `isWrong` from `core/outcome`) and show a plain "this one came back" marker.

### 3. Stopping is treated as an ending, and the ending says more than "finished"

- **Expected:** GRILL (line 40): "Stopping is not an ending. No summary, no report, no sign-off." PRD 2.1 item 5 (lines 42–44): "when the queue and retry queue are empty the screen says only that this session is finished. There is no report or score. Stopping is a plain return home."
- **Found:** `StudyClient.tsx:479-480` — "End here" calls `finish(false, true)`. `finish` (`StudyClient.tsx:197-217`) always sets phase `"done"`, and the done screen (`StudyClient.tsx:349-365`) shows "That's the session." plus "Nothing else to report — no score, no streak. Next time's plan already takes today into account." and two buttons. Stopping and finishing land on the same sign-off screen.
- **Plain English impact:** A stop is dressed up as an ending with a small report — exactly the behaviour the locked decisions say not to do.
- **Recommendation:** fix code — stopping returns to the plan/home with no sign-off; finishing shows one sentence and no commentary.

### 4. Offer reduction is per short stop, not "two or more" short stops

- **Expected:** GRILL R11 (lines 160–165) and PRD 4.5 (lines 209–211): "Two or more recent short stops lower the offer by five, to a floor of five."
- **Found:** `v1/src/lib/core/session.ts:24-30` walks the last 5 ended sessions and subtracts 5 for **each** short stop (line 28). Two short stops therefore give −10, not −5.
- **Plain English impact:** The session offer shrinks about twice as fast as the locked rule says, reaching the floor of five after a few stops.
- **Recommendation:** fix code — one −5 when at least two recent short stops qualify, or update docs if per-stop reduction is the intended trial (but that changes a locked decision, so fix code).

### 5. Progress screen has no raw evidence and no place to correct an old row

- **Expected:** PRD 2.1 item 6 (lines 45–47): "Progress — ... and every card's raw evidence. Any evidence row can be corrected with a new row." README (`v1/README.md`, "Everyday use"): "Progress — named cards you can now do, work worth another pass, and an evidence drawer per card."
- **Found:** `ProgressClient.tsx:90-119` shows a table of cards with topics, attempt count and last outcome — no raw evidence, no link to it, no correction. The raw-evidence drawer lives in the Library (`LibraryClient.tsx:574-615`), and it, too, has no correction control. Corrections exist only during the reveal of the current answer (`StudyClient.tsx:280-307`, buttons at `StudyClient.tsx:577-587`).
- **Plain English impact:** Away from the reveal moment, the learner cannot correct a wrongly judged row; the Progress screen promised evidence the learner cannot reach from there.
- **Recommendation:** fix code (put the evidence drawer and a correction control on Progress, or move/copy them there and update the README), or update docs to say Library holds evidence and corrections.

### 6. Correction choices miss "No"

- **Expected:** PRD 2.1 item 4 (lines 39–41): "The outcome is one of Again, Got it, Nearly, No, or unjudged. The learner can correct a judged outcome." GRILL R4: "Where no expected answer exists, the answer is recorded as unjudged and the learner states the outcome."
- **Found:** The reveal offers three buttons: "I got it", "Nearly", "I missed it" (`StudyClient.tsx:578-586`). There is no way to state "No" (wrong, not previously known), even though the correction route accepts it (`api/evidence/correction/route.ts:13`).
- **Plain English impact:** A learner whose unjudged answer was a genuine gap ("No") can only record Again, Nearly or Got it; the unjudged case says "the learner chooses" but only three of the four words are on offer.
- **Recommendation:** fix code — add the fourth correction button (or a clearer learner-judging control for unjudged rows).

### 7. Prompt preview has no copy action

- **Expected:** PRD 2.1 item 7 (lines 48–51): "The server builds the exact prompt and shows it with a copy action." GRILL R13: "returns a request id plus the exact text for display and copying."
- **Found:** `LibraryClient.tsx:393-407` shows the prompt in a `<pre>` with "Send it" and "Cancel" buttons. There is no copy button (the text is selectable, but no action exists).
- **Plain English impact:** The learner can read the prompt but cannot copy it with one action as promised.
- **Recommendation:** fix code — add a Copy button (`navigator.clipboard.writeText`), or update docs.

### 8. Generate section is hidden without a provider; "prepare before any provider exists" is unreachable in the UI

- **Expected:** Simulation contract point 9 (PRD line 82–83): "A prompt can be prepared and displayed before any provider exists; sending without a key fails in plain words and changes nothing." Acceptance (PRD lines 301–302): "A learner can prepare and send a generation prompt only after explicitly approving the exact text; with no key, the send fails in plain words."
- **Found:** `LibraryClient.tsx:338` renders the whole Generate block only when `provider?.configured && provider.hasKey`. The prepare API works without a provider (`api/provider/prepare/route.ts` never calls `getProviderConfig`), and the simulation proves it, but the browser cannot reach it until the learner has already set up a provider and key.
- **Plain English impact:** The promise that a missing provider is never a blocker is weakened for generation: the learner cannot even see or prepare the exact prompt until they configure a provider.
- **Recommendation:** fix code — always show the Generate block; let prepare work offline and let Send show the plain "No provider is set up" refusal, as the acceptance test describes.

### 9. Import has no file chooser

- **Expected:** GRILL R7 (line 131): "JSON pasted or chosen from a file, either an array of cards or { "cards": [...] }."
- **Found:** `LibraryClient.tsx:468-480` is a paste textarea only. The import API takes a JSON string (`api/cards/import/route.ts:16`); no file input exists.
- **Plain English impact:** Learners who have a deck file must open it externally and paste the text; "chosen from a file" is not implemented.
- **Recommendation:** fix code (add a file input that reads the chosen file into the textarea), or update docs to say paste-only in v1.

### 10. Sanity check's unseen-card rule is shadowed for small offers

- **Expected:** PRD 4.5 (lines 203–207): "The app sanity-checks the result: enough cards, unique cards, at least two topics when available, and at least one unseen card when one exists."
- **Found:** `v1/src/lib/core/algorithm/run.ts:51` only enforces the unseen rule when `selection.cards.length >= 5`. Offers of 1–4 (the plan route accepts `offer >= 1`, and the plan screen's number input is only clamped in code to `>= 1` at `StudyClient.tsx:388`) can ignore unseen cards without triggering a fallback.
- **Plain English impact:** Edge case: a learner who asks for a very short session can be given no unseen cards even though they exist, and no fallback/notification happens.
- **Recommendation:** fix code (drop the length guard or clamp offers to the minimum the sanity check assumes), or log drift as a deliberate edge-case allowance.

## Execution Gaps

| Phase | Status | Notes |
|---|---|---|
| 0 — Scaffold | Complete | All listed files exist; tests, typecheck, lint, build run. |
| 1 — Card and pack core | Complete | Types, canonical content, identity, hard rules, pack schemas, adoption all present; tests pass. |
| 2 — Evidence and judging | Complete | Per-region rows, attempt aggregation, corrections, append-only repository; tests pass. |
| 3 — Algorithm, plan, progress | Complete | Fallback sanity and receipt behave as designed; offer maths deviates (contract gap 4). |
| 4 — Storage and configuration | Partial | IMPL lists `v1/src/lib/config.ts` (IMPL line 54); no such file exists — path logic lives in `src/lib/storage/paths.ts` and settings in `src/lib/core/settings.ts`. Bootstrap does not "load settings" (routes read them lazily), which is a documentation/file-plan difference, not a break. |
| 5 — Provider boundary | Complete | Keystore, client, WSL swap, prepare store, generation validation, prompt log; tests pass. |
| 6 — API routes | Complete | All 23 PRD routes exist; all use `runtime = "nodejs"`; plain error shapes. |
| 7 — Interface | Partial | No `v1/src/components/` directory (components live in `app/`); no dedicated `/generate` page — generation lives in the Library (PRD flow exists, location differs); Progress lacks the evidence drawer (also contract gap 5). |
| 8 — Sample pack and docs | Partial | 30 cards, 6 topics, prompts, pack README — good. But 0 `hear_type` cards (IMPL line 106–107 promises hear-then-type); the two "Listen" cards declare `mode: "type"`. No multi-blank card (R1 unexercised by data), no working card (R16 unexercised). No distinct "vocabulary" topic (IMPL wording; pack uses "basics"). |
| 9 — Verification | Verified except manual walkthrough | typecheck, lint, tests (228), build, simulate (10/10) all pass under this review. The manual browser walkthrough was not performed by this reviewer. |
| 10 — Drift and reconcile | In progress | Post-impl sim is a different script from the pre-impl mirror (`.mjs` vs `.html`); this review is the sub-agent step; the report is being written to `.reports/`; `simulate.mjs` is the canonical sim. The pre-impl mirror remains in `docs/features/v1-prototype/` (its "archived" status is a location convention, not a defect). |

## Simulation Gaps

| Point | Expected | Demonstrated | Match |
|---|---|---|---|
| 1 | Polish pack loads; broken pack named without blocking | 30 cards; broken pack named; health answers 0.1.0 | Yes |
| 2 | Plan with cards, groups, reasons, default algorithm | 20 cards, 6 groups, algorithm default, fallback count 0, settings receipt | Yes |
| 3 | Cloze judged per blank; evidence rows written | Only single-blank cloze cards are chosen (`simulate.mjs:131-141`), so "per blank" is a one-row case; multi-row sharing of an attempt id is never shown (sample pack has no multi-blank card; code and unit tests do support it) | **Partial** |
| 4 | Wrong answer queued for return at the end | The sim posts a second answer directly (`simulate.mjs:257-267`); the client retry queue is never exercised, and "plainly marked as returning" is never checked (and is missing in the UI) | **Partial** |
| 5 | Hint caps a correct answer at Nearly | Pack hint works with no provider; hinted correct answer judged Nearly; `capped: true` | Yes |
| 6 | Correction resolves displayed evidence; original untouched | Original row still on disk unchanged; correction row supersedes it; drawer resolves to corrected outcome | Yes |
| 7 | Wrong-then-right names the card as now doable | Improvement named from the wrong-then-right card | Yes |
| 8 | Malformed import refused with item index; valid batch lands | Refused at item index 1 with field detail; nothing written; valid batch imports | Yes |
| 9 | Prepare/display prompt before a provider; send without key fails plainly, changes nothing | Prompt prepares with no provider; send fails with "No provider is set up..."; deck and prompt log unchanged | Yes |
| 10 | No response body contains the provider key | Only four bodies checked: `/api/settings`, `/api/prompts`, `/api/health`, `/api/provider/prepare` (`simulate.mjs:398-418`). Other bodies (plan, cards, progress, evidence, hint/test/generate under a key) are not checked even though the code appears safe by inspection | **Partial** |

## Design Drift (pre-impl mirror vs shipped)

- **Retry step:** the mirror shows a dedicated "One card came back" step with "because it was answered wrong earlier in this session" (`simulate-pre.html:121-132`). Shipped: no retry step, no marker — returned cards silently reappear at the end of the queue.
- **Working shown then discarded:** the mirror shows "Show your working ... the learner's line appears here beside the correct working, then is discarded" (`simulate-pre.html:107`). Shipped: the working is never shown after the answer (also contract gap 1).
- **Hint cap timing:** the mirror states the cap when the hint is taken ("A hint is used, so this card can be recorded at most as Nearly", `simulate-pre.html:93`). Shipped: the cap is only stated after the reveal ("A hint capped this at Nearly.", `StudyClient.tsx:574`).
- **Outcome choice:** the mirror shows four outcome buttons including "No" (`simulate-pre.html:108-113`). Shipped: the app auto-judges and offers three correction buttons, no "No" (also contract gap 6).
- **Progress contents:** the mirror shows "What you can do now", "Next work", "Still strong" and an evidence list with rows, and says "Each named thing opens its raw evidence" (`simulate-pre.html:134-147`). Shipped: sections renamed ("Cards you now handle", "Worth another pass", "Solid ground") and no evidence section on Progress (also contract gap 5).
- **Stopping:** the mirror's "Stop here" returns to Progress (`simulate-pre.html:130`). Shipped: stopping shows the same "That's the session." screen as finishing (also contract gap 3).
- **Plan screen:** the mirror has a "Not now" button (`simulate-pre.html:74`); shipped relies on the top navigation. Trivial flow difference.
- Wording elsewhere matches the spirit of the mirror (plan reasons, tutor banner as a disclosure, no scores/percentages language).

## Drift Items to Log

- Working-after-answer missing (R16 half-built) — study reveal must show the learner's working beside the pack's correct working.
- Returned cards not marked as returning, and `nearly`/`unjudged` cards are queued as if wrong.
- Stopping is treated as an ending, with a sign-off sentence; locked rule says stopping is not an ending and there is no report.
- Offer reduction is −5 per short stop instead of −5 once when two or more recent stops are short.
- Progress screen lacks raw evidence and any correction entry point; README says Progress has an evidence drawer per card.
- Correction choices omit "No"; unjudged "learner chooses" flow is incomplete.
- Prompt preview lacks the promised copy action.
- Generate UI hidden without a provider/key; prepare-before-provider and plain send failure are unreachable in the browser.
- Import lacks the "chosen from a file" path from R7.
- Sanity check's unseen-card rule does not apply to offers smaller than 5.
- Sample pack has no `hear_type` (or multi-blank, or working) card despite IMPL Phase 8; two "Listen" cards use `type`.
- IMPL file-plan drift: `src/lib/config.ts` missing; no `src/components/` directory; no dedicated `/generate` page (generation lives in Library).
- Simulation points 3, 4 and 10 demonstrate less than the contract wording claims (single-blank cloze, no client retry queue, four bodies checked for the key).
- Pack README says pack `topics` are the allowed topic words, but the loader never checks a card's topics against `pack.topics` (generated cards are filtered; adopted/imported ones are not).

## Recommendation

The prototype is real and stable — the full loop works, the offline path works, the provider boundary holds, and all automated gates pass (228 tests, typecheck, lint, build, simulation 10/10). The drift is concentrated in behaviours the prototype exists to trial: the retry marking, the no-report stopping rule, the working display, the offer maths, and the progress evidence/correction surface. None of these are large code changes, but five touch locked decisions, so fix the code for gaps 1–4 and 6 before using the prototype with real learners; add the progress evidence/correction drawer (gap 5) and the copy action and provider-free Generate path (gaps 7–8) as small UI fixes; either implement or consciously log the file-based import (gap 9) and the sanity-edge case (gap 10). Update the README/IMPL where the implementation legitimately moved (drawer location, file layout, Generate page) and keep the simulation as canonical; then re-run simulate and this review.
