# Drift Review: biuro word pack

**Date:** 2026-11-21
**Reviewer:** independent sub-agent (REVIEW ONLY)
**Verdict:** Minor Drift

## Summary
- Contract gaps: 0 — the pack matches every locked GRILL answer and the word-lessons contract.
- Execution gaps: 1 — work is uncommitted; no PR opened (likely still owned by the parent after this review).
- Simulation gaps: 3 — `simulate.sh` under-demonstrates three items of the PRD §4 simulation contract.
- Design drift / doc overclaim: 1 — PRD/IMPL wording about `words` in "every" bundle contradicts the correct conditional implementation.
- Recommended action: fix docs and strengthen the sim, then commit and open the PR. No source fix needed.

## Contract Gaps
**None.** Each checklist item was verified against the shipped files:

| Locked item | Evidence |
|---|---|
| Pack name `biuro`, folder `v1/packs/biuro/` | `GRILL...txt:56`; `v1/packs/biuro/pack.json:2` |
| One deck `at-the-office` / "At the office" | `GRILL...txt:57`; `pack.json:10-11`; seeded `v1/public/packs/biuro.json` decks[0] |
| Four forms (gen./dat./loc./instr.) | `GRILL...txt:74`; `v1/packs/biuro/words.json:15-68` (biura, biuru, biurze, biurem) |
| Five pairs (base + four forms) | `GRILL...txt:74`; `words.json:69-75` |
| Five stage cards | `GRILL...txt:74`; `v1/packs/biuro/cards.json:3-123` |
| No new word fields | `words.json` uses only id/lemma/meaning/lang/note/forms(label,to,meaning,why,use)/pairs(target,meaning) — the locked model in `word-lessons/PRD-TRD...md:36-73` |
| No new answer surfaces | modes are cloze, type, picks, match (match is the allowed word-lessons mode) — `cards.json:17,40,63,86-90,110` |
| Text-only pages, 1 pack + 1 deck + 5 card | `GRILL...txt:63-65`; `v1/packs/biuro/pages.json:2-96`; no image/audio parts or covers |
| Stage→mode correct | story/cloze, spelling/type, forms/type, dialogue/picks, matching/match — `cards.json:28,51,74,101,121`; `STAGE_MODE` at `v1/src/lib/core/schema.ts:200` |
| All meanings in sourceLanguage English | `pack.json:7` sourceLanguage=en; `words.json:6,19,32,45,58,70-74` and all `why`/`note` parts carry `lang:"en"` |
| Word-check invariants pass | `v1/tests/seed-packs.test.ts:139` `lessonIssues(bundle.cards, bundle.words)` → `[]`; full suite 89 files / 1094 tests pass |
| Seed carries words, other packs unchanged | `make-seed.mjs:123-124,172`; only biuro has a top-level `words` key. Regenerating the seed was byte-identical for all six bundles. |
| Seven pages, card pages point at real cards | `pages.json` has 7 pages; `make-seed.mjs:139-147` maps `cardKey`→`cardId`; `seed-packs.test.ts:149-158` recomputes ids with the app's `deckCardId` and all five match |
| Pack/deck pages covers only, no unrendered body | pack/deck `parts: []` (`pages.json:7,14`); `EntityPage.tsx:105-147` renders only cover/lead/path, never body parts; card pages have non-empty parts |
| No other built-in pack gains a word link | `grep wordId public/packs/*.json` matches only `biuro.json` |

Identity stays clean: the seed's `deckCardId` helper (`make-seed.mjs:100-112`) and the app's `canonicalContent` (`core/card.ts:61-78`) both exclude `wordId`/`stage`, as required by PRD §5.

## Execution Gaps
### Phase 1–3: Pack files, seed, guard tests
**Status:** complete. All files in IMPL Phases 1–3 are present and verified above. `v1/packs/README.md:105-138` documents `words.json`, `words`, `wordId`, `stage` and `match`. `v1/tests/word-check.test.ts:50-193` already proves a broken authored word is refused, so IMPL's conditional "only if a new invariant appears" correctly added no new test there.

### Phase 4: Simulate and review
**Status:** partial. The post-impl sim and this review exist, but IMPL Phase 4's "Open the pull request after the gates pass" and the commit plan ("one commit for the pack and seed code, one for the sim and review fixes") are not done. `git status` shows all work uncommitted (`M README.md, index.json, make-seed.mjs, seed-packs.test.ts`; `?? docs/features/biuro-word-pack/, v1/packs/biuro/, v1/public/packs/biuro.json`) and `git log` ends at the word-lessons commits. GRILL Q8 (`GRILL...txt:80-87`) locked "open pr when done". This is process-pending, not a code defect, and is most likely the parent's step after review.

## Simulation Gaps
### 1. PRD §4 "the import check" is not demonstrated
**Expected:** PRD-TRD §4 (`simulate contract`) lists "the import check"; §3.3 says "A learner can import the seeded bundle without a lesson error."
**Demonstrated:** `simulate.sh:21-25` only prints `index lists biuro: true` (manifest presence) plus "all meanings non-empty" and a non-empty `cardId` string. It never calls `parseBundle` or `lessonIssues`. The real import proof lives in `seed-packs.test.ts:42-48,139`, not in the sim.
**Match:** no.

### 2. "Another pack folder can be copied with a different word" is only a printed instruction
**Expected:** PRD-TRD §4.
**Demonstrated:** `simulate.sh:40-42` is a hardcoded `printf` of file names and advice; nothing is copied or varied. `simulate-pre.sh:47` is equally narrative.
**Match:** no (weak).

### 3. Two sim assertions are shallower than the claims they look like
- `simulate.sh:36` prints "all meanings non-empty" — that does not prove meanings are in `sourceLanguage` English (PRD §2, word-lessons invariant 3). It only checks `typeof m === "string" && m.trim().length > 0`.
- `simulate.sh:33` "card pages name a card id" checks only a non-empty `cardId` string, not that it resolves to a real card (the test at `seed-packs.test.ts:149-158` does the real check).
**Match:** partial.

Positively, the sim does satisfy the rest of PRD §4: folder contents, seeded counts/fields, five stage/mode pairs, seven pages, and it reads the real seeded bundle (`simulate.sh:9-10`) rather than a hardcoded copy, as IMPL Phase 4 requires.

## Design Drift (pre-impl sim vs post-impl sim; doc overclaim)
### Drift 1: "`words` in every generated bundle" vs conditional inclusion
**Designed:** PRD-TRD §5 says "include `words` in every generated bundle so old packs stay byte-identical when they have none" and IMPL Phase 2 says "carry `words` in every bundle." Those two halves cannot both be true.
**Shipped:** `make-seed.mjs:172` emits `words` only when `words.length > 0`, so packs without `words.json` keep the exact old bundle. This is the correct, compatible behavior and preserves word-lessons PRD §8 ("old bundles... must not be rewritten"). The docs overclaim; the code is right.
**Action:** reword PRD §5 / IMPL Phase 2 to "include `words` when the pack declares one; packs without words keep their old bundle."

No pre/post-sim contradiction was found: both sims agree on folder shape, stage/mode rule, text-only pages and the copy-for-another-word claim.

## Drift Items to Log
- **D-48 (Low):** PRD-TRD §5 and IMPL Phase 2 say `words` is in "every" bundle; `make-seed.mjs:172` includes it only when non-empty. Fix the docs to match the correct conditional behavior.
- **D-49 (Low/Medium):** `simulate.sh` does not demonstrate PRD §4's "import check" — no `parseBundle`/`lessonIssues` call, only manifest presence and non-empty strings. Add a real import check to the sim or explicitly cite the test that covers it.
- **D-50 (Low):** `simulate.sh:40-42` "one folder to copy" is a printed instruction, not a demonstrated copy of a folder with a different word; the meaning check proves only non-empty, not English; the card-page check proves only a non-empty id, not a real card. Strengthen or soften these lines.
- **D-51 (Medium, execution):** GRILL Q8 and IMPL Phase 4 require a PR after the gates; work is uncommitted with no PR. Parent should make the two planned commits and open the PR after drift gates pass. (If logged as Open naming these files, the staged gate will refuse them until resolved — resolve in the same pass.)

## Verification performed
- `bash docs/features/biuro-word-pack/simulate.sh` → exit 0, all printed checks OK.
- Targeted tests: `npm test -- --run tests/seed-packs.test.ts tests/word-check.test.ts` → 2 files, 37 tests passed.
- Full suite: `npm test` → 89 files, 1094 tests passed. `npm run typecheck` clean.
- `node v1/scripts/make-seed.mjs` regenerated all six bundles byte-identically (hash comparison), confirming packs without `words.json` are unchanged.

## Recommendation
The shipped pack is substantively aligned with the locked contract: every GRILL answer, the word-lessons model, stage/mode pairs, English meanings, word-check invariants, seven pages, real card-page ids, cover-only pack/deck pages, and non-destructive seeding are all implemented and tested. What remains is Minor Drift in prose and evidence only. Before shipping: (1) correct the "words in every bundle" wording in PRD §5 and IMPL Phase 2; (2) add a real `parseBundle`/`lessonIssues` import check to `simulate.sh` and strengthen (or soften) the copy/meaning/card-page assertions; (3) make the two planned commits, pass the drift gates, and open the PR required by GRILL Q8. No change to the pack data or seed logic is needed.
