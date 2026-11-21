# IMPL: biuro word pack

## Phase 1 — Author the pack files

Files:
- `v1/packs/biuro/pack.json`
- `v1/packs/biuro/words.json`
- `v1/packs/biuro/cards.json`
- `v1/packs/biuro/pages.json`

Work:
- One word, four forms, five pairs; meanings in English.
- Five stage cards with the locked stage-to-mode pairs.
- Seven text-only pages.

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
- Assert the word's forms, pairs, stage/mode pairs and seven pages.
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
