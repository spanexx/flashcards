# IMPL: biuro word pack

## Phase 1 — Author the pack files

Files:
- `v1/packs/biuro/pack.json`
- `v1/packs/biuro/words.json`
- `v1/packs/biuro/cards.json`
- `v1/packs/biuro/pages.json`

Work:
- Original five-card example: one word, four forms, five pairs, seven pages.
  Superseded by the full-course revision below.
- Shipped course: 14 forms, nine pairs, five decks, 100 cards, 106 text pages.

Proof: JSON parses; card keys match page cardKeys; every topic is declared.

## Phase 2 — Teach the seed about words

Files:
- `v1/scripts/make-seed.mjs`
- `v1/packs/README.md`

Work:
- Add `biuro` to `seedPacks`.
- Read optional `words.json` and carry `words` only when the pack declares
  some, so a pack with no words keeps the same bundle.
- Document the new file and the two card fields.

Proof: `node v1/scripts/make-seed.mjs` lists four packs and a biuro word.

## Phase 3 — Guard the shipped example

Files:
- `v1/tests/seed-packs.test.ts`
- `v1/tests/word-check.test.ts` (only if a new invariant appears)

Work:
- Add biuro to the seed manifest check.
- Keep the ten-card rule for the original three packs; assert five for biuro.
- Assert the word's full paradigm, pairs, stage/mode pairs, five decks,
  hundred cards and 106 pages.
- Prove an authored broken word would be refused by the lesson check.

Proof: targeted tests, then the full suite and build once.

## Phase 4 — Simulate and review

Files:
- `docs/features/biuro-word-pack/simulate.sh`
- `.reports/` drift report

Work:
- Post-impl sim reads the seeded bundle, not a hardcoded copy.
- Fresh sub-agent compares docs, code and both sims.
- Open the pull request after the gates pass.

Commit plan: one commit for the pack and seed code, one for the sim and review
fixes. Docs land with the first commit.

## Full-course revision

Regrilled in `GRILL-full-course.txt`. Replace the five-card pack with the full
course, keeping the same files and the same seed path.

Phase 5 — Data:
- `words.json`: all 14 paradigm forms with reasons; nine distinct pairs.
- `cards.json`: about 100 cards in five decks, each card still naming wordId and
  one of the five locked stages.
- `pages.json`: one pack page, five deck pages and one page per card.

Phase 6 — Proof:
- Targeted seed test first: form count, pair count, deck count, card count,
  stage-to-mode pairs, page count and `lessonIssues` returning no problems.
- Full suite, build and simulation once.

No seed script change is needed: it already reads one pack folder with any
number of decks, cards and pages.
