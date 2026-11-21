# Drift Review: biuro full-course revision

**Date:** 2026-11-21
**Reviewer:** independent sub-agent (REVIEW ONLY)
**Scope:** `GRILL-full-course.txt`, PRD-TRD §7, IMPL "Full-course revision", both sims, seed bundles, `seed-packs.test.ts`
**Verdict:** Minor Drift

## Summary
- **Contract gaps:** 0 — the locked full-course requirements are met and every Polish form and taught trigger is correct.
- **Data-quality gaps:** 3 — five malformed "Meet" cards, widespread wrong `lang` tags, two trigger rules from the reviewer checklist not taught.
- **Test gaps:** 2 — the exact-form assertion was *removed* in the revision; `lessonIssues` proves only structural integrity.
- **Simulation gaps:** 2 — the sim prints `false` for the index check (stale `1.0.0`); PRD §4 still promises "seven pages".
- **Doc leftovers:** 2 — PRD §4 and IMPL phases 1/3 still describe the rejected five-card pack.
- **Bottom line:** the *content* the learner asked for is correct and complete. The problems are in evidence, presentation and prose, not in the paradigm. No redesign needed; four items should be fixed before shipping.

## Contract Gaps
**None.** Verified against the locked GRILL (`GRILL-full-course.txt:9-13,38,46-47,64-65`) and PRD §7 (`PRD-TRD-biuro-word-pack.md:73-88`):

| Locked item | Evidence |
|---|---|
| One word only | `words.json:2-3`; `words` length 1 (`packs/biuro/words.json`) |
| 14 paradigm forms, each with a reason | `words.json:15-197` — 7 singular + 7 plural; all 14 have non-empty `why` |
| 9 distinct pairs | `words.json:199-236`; 9 targets, 9 distinct |
| 5 decks with locked names | `pack.json:10-15` (`meet-biuro`, `every-form`, `what-triggers-what`, `in-a-sentence`, `fast-recall`) |
| ~100 cards | exactly 100; deck split 20/30/20/20/10; all `wordId=biuro` |
| 106 pages | 1 pack + 5 deck + 100 card; `pages.json` 106 entries; bundle `cardId` unique 100/100 |
| No new schema fields | word/card/page keys unchanged from HEAD; modes still `cloze,type,picks,match` (`schema.ts:200-206`); page levels still `pack,deck,card` |
| All meanings English | `pack.json:7` `sourceLanguage:en`; `word.meaning="office"`, 14 form meanings, 9 pair meanings all English; `why`/`note` parts `lang:"en"` |
| Stage→mode | 0 mismatches across 100 cards; matches `STAGE_MODE` exactly |
| No answer leak | 0 leaks in prompt text, and 0 in `hints`/`teaching` (checked independently; test at `seed-packs.test.ts:135-159` agrees) |

**Polish forms** (`words.json:15-197`) match the Wiktionary reference exactly: nom `biuro`, gen `biura`, dat `biuru`, acc `biuro`, ins `biurem`, loc `biurze`, voc `biuro`; plural nom/acc/voc `biura`, gen `biur`, dat `biurom`, ins `biurami`, loc `biurach`. Nine distinct surfaces — correct.

**Triggers** used in cards are all correct:
- genitive: `do` (:2223, :2771), `z`=from ("Wracam z ___", :74), `bez`, `dla`, `nie ma` (:53), `szukam` (:54), numbers 5+ (:67, :100).
- dative: `pomagać` (:57), `dziękować` (:58), `daję` (:59), `ufam` (:60), `przeciwko` (:69).
- instrumental: `zarządzać` (:64, :81), `kierować` (:82), `interesować się` (:70, :83), `z`=with (:65).
- locative: `w` (:62), `o`=about (:66, :84), `przy` (:68, :85).

## Data-Quality Gaps
### 1. Five "Meet" cards have a malformed prompt and answer (Medium)
`biuro-001`–`biuro-005` carry a literal `___` **inside** the text part *and* a separate `blank` part and a trailing `"."` part (`cards.json:12-27`). The answer renders as `To jest ___ .biuro.` (`cards.json:31`) — the placeholder is left in and the answer is glued on with no space. Summaries are `Meet: To jest biuro .`, and the generated Dictionary card page reads `The full line is To jest biuro ..` (double period) at `biuro.json:4915`. The other 95 story cards are well-formed (`cards.json:71` → `Pracuję w biurze.`). Learner-facing text is garbled on 5 cards and 5 pages.

### 2. Wrong `lang` tags (Medium)
- 10 Polish spelling prompts tagged `en` — e.g. `Idę do ___.` at `cards.json:2234-2235`, all of `biuro-051`…`060`.
- ~16 English case-name answers tagged `pl` — e.g. `nominative singular` on forms cards `biuro-022`…`040`.
- English "Which case follows…" prompts tagged `pl` (`biuro-061` at `cards.json:2651+`), and "Give me the form after…" prompts (`biuro-096`…`100`).
These affect any TTS/voice path and contradict the `sourceLanguage` rule; the test never checks card-level `lang`.

### 3. Two checklist triggers never taught (Low)
`od` (→ genitive) and `dzięki` (→ dative) appear in no card. They are absent from the locked GRILL trigger list (`GRILL-full-course.txt:47`), so this is a coverage note against the review checklist, not a breach. `z`-with is only asked as a meta question (`biuro-065`), never in a sentence.

## Simulation Gaps
### 1. The sim actively misreports the index (Medium)
`simulate.sh:19` checks `p.version === '1.0.0'`, but `pack.json:3` and `index.json:6` are `2.0.0`. The sim therefore prints `index lists biuro: false`. This line was not updated during the revision (confirmed by `git diff docs/features/biuro-word-pack/simulate.sh`). It directly contradicts PRD §3.2 and §4.

### 2. PRD §4 contract is stale (Low/Medium)
`PRD-TRD-biuro-word-pack.md:41` still requires the sim to demonstrate "the seven pages". The revision supersedes only §§2,3,5 (`:76`), not §4. The sim actually demonstrates 106 pages (`simulate.sh:18,25-28`), so the doc, not the script, is wrong. Positively, the sim does read the seeded bundle (`:11`), shows counts/fields, stage/mode per card, pages, and now runs the real test (`:37`) — the earlier "no import check" gap (`D-49`) is now closed via the test citation at `:33`.

### 3. Remaining shallow assertions (Low)
`simulate.sh:31-32` proves only non-empty meanings, not English; `:30` proves only a non-empty `cardId`, not that it resolves to a card; `:39-42` is a printed instruction, not a demonstrated copy. Same weaknesses as the prior review (D-50), unchanged.

## Test Gaps
### 1. Exact Polish forms are no longer asserted (Medium)
The old test asserted `word.forms.map(f=>f.to)` equals `["biura","biuru","biurze","biurem"]` (see `git diff v1/tests/seed-packs.test.ts`). The new test at `seed-packs.test.ts:123-126` asserts only *count* (14) and *distinct labels* (14), and 9 pair targets. A wrong form value or a wrong pair meaning would now pass. Given GRILL Q6 (`GRILL-full-course.txt:64-68`) makes accuracy the whole point, this is a real weakening of the guard.

### 2. `lessonIssues` is shallow (Low)
`seed-packs.test.ts:132` expects `[]`, but `word-check.ts:35-156` only checks word-id uniqueness, pair target/meaning uniqueness, word↔stage pairing, stage→mode, "forms" has forms and "matching" has ≥2 pairs. It does **not** validate any form value, trigger, meaning language or `lang` tag. The test title "ships one word, its whole paradigm" overstates what is proven.

### What the test *does* prove
Counts (1/14/9/5/100), deck coverage, all `wordId`, stage→mode per card, no prompt leak, page counts (1/5/100) with ids recomputed via `deckCardId`, non-empty meanings and English `why` language, and structural lesson integrity. Verified independently: all pass.

## Design Drift / Doc Overclaim
### Stale five-card leftovers (Low)
- `PRD-TRD-biuro-word-pack.md:41` (§4) — "seven pages" — not in the §7 supersede note (`:76`).
- `IMPL-biuro-word-pack.md:12` — "One word, four forms, five pairs"; `:41` — "seven pages". The "Full-course revision" section (`:60-77`) never marks phases 1/3 superseded.
- Acceptable historical leftovers: `GRILL-biuro-word-pack.txt` and `archive/simulate-pre.sh` are the superseded five-card design; §§2,3,5 of the PRD are explicitly superseded at `:76`.
- `GRILL-full-course.txt:35` quotes the learner's "five cards" complaint verbatim — correct.

No contradiction between the archived design sim and the post-impl sim beyond the expected scope change; both agree on folder shape, stage→mode rule and text-only pages.

## Drift Items to Log (candidates, next free number is D-48)
- **D-48 (Medium):** `simulate.sh:19` checks index version `1.0.0` while the pack ships `2.0.0` (`index.json:6`); sim prints `false`.
- **D-49 (Medium):** five Meet cards carry a doubled blank and garbled answer/pages (`cards.json:12-31`; `biuro.json:4915`).
- **D-50 (Medium):** card-level `lang` tags wrong on ~36 items (`cards.json:2235`, `2651+`, forms answers).
- **D-51 (Medium):** test dropped the exact-form assertion (`seed-packs.test.ts:123-126`), so forms/triggers are no longer guarded.
- **D-52 (Low):** PRD §4 (`PRD-TRD...:41`) and IMPL phases 1/3 (`:12,:41`) still describe seven pages / four forms / five pairs.

## Verification performed
Static review only — no source, test or doc was modified and no test/build was executed, per the REVIEW-ONLY mandate. Counts, forms, triggers, stage→mode, leaks, `lang` tags, page structure and schema keys were derived by parsing the authored files and the seeded bundle with Node. `git diff`/`git show HEAD` were used to confirm what the revision changed and which fields are genuinely new (none).

## Recommendation
The revision delivers what the learner locked: one word, a full 14-form paradigm with reasons, 9 pairs, 5 decks, 100 cards, 106 pages, correct forms and triggers, correct stage/mode mapping, no leaks, no new schema, English meanings. Verdict is **Minor Drift** because every gap is in evidence, presentation or prose. Before shipping: (1) fix `simulate.sh:19` to `2.0.0`; (2) repair `biuro-001`…`005` prompt/answer/summary and regenerate the seed; (3) correct the `lang` tags; (4) restore an exact-form assertion in `seed-packs.test.ts`; (5) reword PRD §4 and IMPL phases 1/3. No change to the paradigm, deck design or mode mapping is needed.
