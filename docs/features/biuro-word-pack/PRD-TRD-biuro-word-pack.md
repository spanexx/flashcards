# PRD-TRD: biuro word pack

## 1. Why this exists

The word-lessons pack added the model and the study screens but shipped no
built-in lesson. A learner cannot see the feature, and an author has no file to
copy. This pack ships one complete, correct word lesson as a built-in pack and
documents the folder shape for later words.

## 2. What it does

- Ships `v1/packs/biuro/` with `pack.json`, `words.json`, `cards.json` and
  `pages.json`.
- Declares one word `biuro` (Polish, "office") with four inflected forms and
  five matching pairs.
- Declares five cards: story (cloze), spelling (type), forms (type), dialogue
  (picks) and matching (match). Every card names `wordId` and `stage`.
- Ships one pack page, one deck page and five card pages, all with text teaching
  parts.
- Teaches form, meaning and use: the word line and pairs carry meaning, the form
  reasons explain the changes, and the story, forms and dialogue cards ask the
  learner to use the word in a sentence.
- Keeps every meaning in English, the pack's `sourceLanguage`, never hard-coded
  in code.

## 3. Behavioral spec

1. `node v1/scripts/make-seed.mjs` writes `public/packs/biuro.json` with the
   pack, one deck, the word, five cards and seven pages.
2. `public/packs/index.json` lists `biuro` at version 1.0.0.
3. A learner can import the seeded bundle without a lesson error.
4. The five cards judge with the five locked modes and keep one evidence row
   each.
5. The word line hides the changed form until the answer; the forms card gets
   its reason from the word record.
6. No card in any other built-in pack gains a word link.

## 4. Simulation contract

`simulate.sh` must demonstrate: the folder contents, the seeded bundle's counts
and fields, the five stage/mode pairs, the seven pages, the import check, and the
fact that another pack folder can be copied with a different word.

## 5. Technical design

- `v1/packs/biuro/pack.json`: name `biuro`, language `pl`, sourceLanguage `en`,
  one topic `at-the-office`.
- `v1/packs/biuro/words.json`: `{ "words": [ ... ] }`. Each form has `label`,
  `to`, `meaning`, `why` and `use`. Each pair has `target` and `meaning`.
- `v1/packs/biuro/cards.json`: five cards with `key`, `topics`,
  `wordId`, `stage`, and the locked answer modes.
- `v1/packs/biuro/pages.json`: pack page, deck page, and five card pages whose
  `cardKey` matches a card key.
- `v1/scripts/make-seed.mjs`: add `biuro` to `seedPacks`; read `words.json`
  (optional, default `[]`); include `words` only when the pack declares some,
  so a pack with no words keeps the exact bundle it had before.
- `v1/tests/seed-packs.test.ts`: include the new pack, relax the ten-cards-per-
  deck rule for this single-word pack, and assert its word, stages and pages.
- `v1/packs/README.md`: document `words.json`, `words` in the bundle, `wordId`,
  `stage` and the `match` mode.

The seed's `deckCardId` helper stays free of `wordId` and `stage`, matching the
locked identity rule.

## 6. Non-goals

- No new word fields, answer modes or page levels.
- No UI changes to Create, Study or Dictionary.
- No images, audio or video assets.
- No change to any existing built-in pack's cards.
- No global lexicon or online lookup at runtime.

## 7. Compatibility

- Packs without `words.json` keep producing the same bundle they did before.
- The seed test still checks the other three packs at ten cards per deck.
- Old browsers get the pack as a new built-in; nothing already installed is
  rewritten.
