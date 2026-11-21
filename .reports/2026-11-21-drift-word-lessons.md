# Drift Review: word-lessons

**Date:** 2026-11-21
**Reviewer:** sub-agent
**Verdict:** Minor Drift

## Summary
- Contract gaps: 1
- Execution gaps: 2
- Simulation gaps: 2
- Recommended action: update docs

## Contract Gaps
### Gap 1: The "nothing matched → No" outcome for Matching cannot be reached in the study UI
**Expected (from PRD-TRD):** > PRD-TRD §5 says "The card is answered when every pair is locked, or when the learner presses Check." The locked GRILL decision Q3 is stronger: "a partly finished or partly wrong board is `nearly`; nothing matched before the learner gives up is `no`." `simulate-pre.sh` scene 6 states it as a learner step: "Press Check with none matched: outcome no." (line 53).
**Found (in code):** ```
v1/src/app/study/StudyCard.tsx:150   const canSubmit = hasAnswerAttempt(card, answers);
v1/src/app/study/StudyCard.tsx:413   {mode !== "picks" && mode !== "match" ? ( ..."I don't know"... ) : null}
v1/src/app/study/StudyCard.tsx:444-451 <button ... disabled={busy || !canSubmit}>Answer</button>
v1/src/lib/core/answer-attempt.ts:24  return (answers.answer ?? "").trim().length > 0;
v1/src/app/study/MatchBoard.tsx:64     onProgress(next.length, total);   // only after a pair LOCKS
```
The judge itself does map zero matched to `no` (`v1/src/lib/core/judge.ts:102-109`; tested at `v1/tests/judge.test.ts:116-121`), but `answers.answer` is only set by `MatchBoard` after at least one correct pair is locked, so `canSubmit` is false with an empty board. There is no I-don't-know control and no text input to carry Enter for a match card.
**Plain English:** The design says a learner who gives up on a matching card with nothing matched gets a "No" outcome. In the shipped screen, the Answer button stays disabled until at least one pair is correct, so the learner cannot answer the card at all from a zero-matched board. The "no" verdict for matching lives only in the unit test; the end-to-end learner path never reaches it.
**Recommendation:** fix code (add a give-up/Check control for match that submits `0/total`, or enable Answer on match from the start), or, if that path is intentionally dropped, update PRD-TRD §5 and GRILL Q3 to say a match card must have at least one locked pair and log the change as drift.

## Execution Gaps
### Phase A: Core model, storage and resolution (6445f6b)
**Status:** complete
**Notes:** All nine planned files present. Behavior verified: `wordId`/`stage` on `Card`/`CardSource` (`v1/src/lib/shared/types.ts:149-173`), `wordSchema`/`wordFormSchema`/`wordPairSchema` and `STAGE_MODE` (`schema.ts:158-225`), `words` default `[]` on `packCardsSchema`, `packBundleSchema` and `backupSchema`, resolver in `core/word.ts`, folder loader reads `cards.json.words` (`packs/loader.ts:93-156`). Identity untouched with WHY comment (`card.ts:55-78`) and a test (`word.test.ts:142-150`). Minor naming deviation only: IMPL asked for `STAGE_ORDER`/`STAGE_MODE` in `types.ts`; shipped uses `WORD_STAGES`/`STAGE_MODE` in `schema.ts` plus `stageRank` in `word.ts` — behaviorally equivalent.

### Phase B: Study experience (6c1d54a)
**Status:** partial
**Notes:** Feature work is complete and correct: `WordLine` hides the changed form until `revealed` (`WordLine.tsx:26-35`), `MatchBoard` is tap-only with independent shuffles (`MatchBoard.tsx:36-37,52-78`), `StudyCard` renders it only for `mode === "match"` and refuses typed text/aid buttons for that mode (`StudyCard.tsx:350-366,384,413,437`), `judgeCard` handles match with one region/one row (`judge.ts:97-118`), and `orderWordCards` keeps word blocks adjacent (`plan.ts:24-51`; tests in `judge.test.ts`, `plan.test.ts`). Two plan deviations: (1) IMPL specified a new `core/match.ts` with `judgeMatch`; shipped folded this into `judgeCard` in `judge.ts` and no `core/match.ts` exists — behaviorally equivalent. (2) IMPL's proof item "Browser check at 390, 820 and 1416 wide" has no evidence in `simulate-post.md`; it cites only CSS (`globals.css:2713-2783`, which does keep two tap columns with 46px rows) and unit tests, not an actual viewport run.

### Phase C: Creation brief and prompt lanes (50f666b)
**Status:** complete
**Notes:** `focusWord` added to `CreationBrief`, defaults and `validateCreationBrief` (trimmed, optional, `creation.ts:37-52,66-79,120-170`). Brief emits two exact lesson lines (`creation.ts:307-314`). Datalist of installed lemmas with pack + language and no blocking (`CreationBriefFields.tsx:64-75,165-186`). Both lanes carry the `words` shape and stage-to-mode rule and the no-leak rule (`prompt.ts:245-254,366-372`; `authoring.ts:366-367`), and fragments refuse to define words (`prompt.ts:218-220,394,456`; `authoring.ts:394,411`). Tests present in all three named files. `CreatePanel.tsx` was listed in IMPL but unchanged — the field already lives in `CreationBriefFields.tsx`, so no behavior is missing.

### Phase D: Import guardrails (b7b034b)
**Status:** partial
**Notes:** `lessonIssues` enforces all ten invariants (`word-check.ts:35-156`) and is wired into whole-bundle, deck fragment, cards fragment, flat import and folder loader (`bundle.ts:574,707,768`; `import.ts:138`; `loader.ts:134`). Plain messages match GRILL Q14 exactly (`word-check.ts:18-21,142`) and all-or-nothing writes are preserved (`bundle.ts:591-625`). Word-preserving update behavior is implemented at `bundle.ts:614-618` and tested. Gap: IMPL listed `v1/tests/import.test.ts`, but that file has no word-lesson case, so the flat-import guard at `import.ts:138` is not directly tested; the ten-defect proof rests on `word-check.test.ts` and `browser-bundle.test.ts` only.

## Simulation Gaps
### Scenario 1: Matching "none matched → No" as a learner step
**Expected:** "Press Check with none matched: outcome no." (`simulate-pre.sh:53`) and PRD-TRD §5 "when the learner presses Check".
**Demonstrated:** `simulate-post.md` scene 6 says only "the judge turns ... none into `no`" and separately that there is "no I-don't-know ... aid on a matching card." It never shows a UI path that produces a zero-matched submission; the button is labelled "Answer", not "Check" (`StudyCard.tsx:450`).
**Match:** no

### Scenario 2: "The same fixture with each of the ten defects is refused with the named sentence and nothing written" (PRD-TRD §10)
**Expected:** One fixture with each of the ten defects refused with the named sentence.
**Demonstrated:** `simulate-post.md` scene 9 cites "16 cases covering all ten invariants" in `word-check.test.ts`. In reality that file covers link pairing, stage/mode, forms-with-no-forms, matching-with-<2-pairs, duplicate ids and distinct pairs (invariants 5–10 plus parts of 1 and 4). Invariants 2 (non-empty lemma/meaning), 3 (all form fields) and 4's non-empty pair sides are enforced by `wordSchema` but only partly tested (`word.test.ts:172-190` tests a bad id and an empty `why`, not empty lemma/meaning/pair side or missing `to`/`meaning`). There is no single ten-defect fixture.
**Match:** no

## Design Drift (pre-impl sim vs post-impl sim)
### Drift 1: Forms `use` sentence described as a second rendered exercise
**Designed:** `simulate-pre.sh:33-37` shows three visible blocks: "The card shows: 'biuro -> ___'", "Then the why: 'After w, neuter -o becomes -e.'", "Then the fresh sentence: 'Jestem w ___.'" GRILL Q8 adds "The learner types the changed form, often inside the form's fresh `use` sentence."
**Shipped:** `simulate-post.md:49-55` says "the script described three visible blocks ... The implementation shows the `why` in the layer and leaves the card's own sentence as the one exercise. `use` is kept in the word record as authoring material but is not rendered as a second blank." Code confirms: `WordLine.tsx` never reads `form.use`, and the `use` field is only declared in `types.ts:198` and `schema.ts:173`.
**Plain English:** Shipping shows the transformation, the why as help, and the card's own sentence as the single exercise — no second blank from the word's `use` text. That is a sound no-leak choice and is honestly explained in the post-impl doc. However, the post-impl reconciliation claim at line 155-157 — "the GRILL, PRD-TRD, IMPL and pre-impl script were all corrected to match" — is not true for this item: commit 72c8e6f only added `simulate-post.md`, and the earlier correction in 6c1d54a fixed the story word line, not scene 4. `simulate-pre.sh:36` and GRILL Q8 still describe the old behavior, so the deviation is explained in prose but not reconciled in the design script.

### Drift 2: Brief lesson-line wording
**Designed:** `simulate-pre.sh:80` — "Both prompt lanes carry: 'Build the whole lesson around the word \"biuro\".'"
**Shipped:** `simulate-post.md:129-133` quotes the actual lines from `creation.ts:310-313`: "Teach one word in this batch: the lemma \"biuro\"." followed by "Every card belongs to one lesson about \"biuro\", not five unrelated lines."
**Plain English:** The exact sentence changed, but the hard instruction (one word, one lesson) is preserved in both lanes. This deviation is honestly resolved: the post-impl doc quotes the real shipped text and does not falsely claim the design script was rewritten.

## Drift Items to Log
- D-N: Matching's `no` outcome is unreachable from the study UI; locked GRILL Q3 and `simulate-pre.sh:53` expect a give-up path. Decide: add the control, or amend PRD-TRD §5 / GRILL Q3.
- D-N: `simulate-post.md:155-157` overstates reconciliation — `simulate-pre.sh` scene 4 and GRILL Q8 still describe the `use` sentence as a second rendered exercise. Fix the design script (or correct the claim).
- D-N: PRD-TRD §10's ten-defect fixture proof is only partially evidenced; schema-level invariants (non-empty lemma/meaning/pair side, full form fields) lack direct tests.
- D-N: IMPL Phase B's 390/820/1416 viewport check has no recorded evidence; only CSS and unit tests are cited.
- D-N (minor): IMPL file/constant names not matched — no `core/match.ts` (judging lives in `judge.ts`), no `STAGE_ORDER` in `types.ts` (uses `WORD_STAGES` + `stageRank`), `StudySession.tsx` and `CreatePanel.tsx` untouched. All behaviorally equivalent; no action needed unless strict plan fidelity is required.

## Recommendation
The shipped feature is substantively aligned with the locked contract: word fields, stage-to-mode rule, no pre-answer leak, one card-wide matching outcome, help resolution order, source-language meanings, optionality for non-language packs, and an untouched identity hash are all implemented and tested across the five commits in the expected order. What remains is Minor Drift, mostly in evidence and prose. Update the docs first: fix `simulate-pre.sh` scene 4 (and GRILL Q8) to say the `use` text is authoring material, correct the overstated reconciliation sentence in `simulate-post.md`, and record the missing viewport check. Then make one small code decision: either give the matching board a real give-up/Check path so the documented "none matched → No" outcome is reachable, or amend PRD-TRD §5 and GRILL Q3 and log that as accepted drift. Add a flat-import word-link test in `import.test.ts` and explicit schema tests for the non-empty invariants to close the proof gap. With those done, ship.
