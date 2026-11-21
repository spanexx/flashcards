# PRD-TRD: Word lessons

Pack: `word-lessons`
Date: 2026-11-21
Status: Locked

## 1. The problem

Today a language card teaches one sentence. A learner can drill `Piję kawę` fifty
times and still not know that `kawa` becomes `kawę`, or why. The teaching layer
helps with one card, but nothing in the app knows that five cards are about the
same word, so nothing can sequence them, compare them, or test the change on
purpose.

The fix is not a new game. It is one new record type and one new interaction:

- A **Word** is the trunk: the lemma, what it means, how it changes, why, and the
  pairings a learner must be able to make.
- A **card** is a leaf: one exercise, optionally pointing at a word and naming
  its stage in that word's lesson.
- **Matching** is the only new way to answer. Everything else reuses the four
  existing surfaces.

Non-language packs never grow a word, and must keep working byte for byte.

## 2. Who this is for

A learner studying Polish (or any language pack) who wants depth on one word
rather than breadth across many sentences. They already have the Dictionary and
the teaching layer, and they expect both to keep working.

## 3. The model

### 3.1 Word

```
Word {
  id       string     // stable, lowercase, unique in the pack
  lemma    string     // the base form, e.g. "biuro"
  meaning  string     // one plain line in the source language, e.g. "office"
  lang?    string     // target language code; falls back to the pack's language
  forms    WordForm[] // may be empty; an empty list means "no Forms stage"
  pairs    WordPair[] // matching pairs; may be empty
  note?    TeachingPart[]
}
```

### 3.2 WordForm

```
WordForm {
  label   string          // "locative", "plural", "past tense"
  to      string          // the changed form, e.g. "biurze"
  meaning string          // what the changed form means, in the pack's source language
  why     TeachingPart[]  // the rule, in the existing teaching format
  use?    string          // a fresh sentence with exactly one blank
}
```

`meaning` is not called `en`. A pack may teach English to a Polish speaker, so
every meaning is written in that pack's `sourceLanguage`.

`why` is `TeachingPart[]` on purpose: text, image and video already have one
renderer, one editor and one validation rule.

### 3.3 WordPair

```
WordPair { target: string; meaning: string }
```

A pair is the smallest unit the learner must be able to match: a target-language
form and its exact source-language meaning.

### 3.4 Card additions

```
Card {
  ...
  wordId?: string   // must name a Word in the same pack
  stage?: WordStage // must travel with wordId
}
```

`WordStage = "story" | "spelling" | "forms" | "dialogue" | "matching"`.

The stage fixes the answer mode:

| stage | mode | what the learner does |
|---|---|---|
| `story` | `cloze` | fill the missing form in a real sentence |
| `spelling` | `type` | type the base word |
| `forms` | `type` | see `base -> blank`, read why, apply the changed form |
| `dialogue` | `picks` | choose the right form or meaning in context |
| `matching` | `match` | pair forms with exact meanings |

### 3.5 The new answer mode

```
AnswerDef {
  mode: "match"
  // no pairs here: the linked Word supplies them at render time
}
```

Pairs live only on the Word. Duplicating them onto the card would let five
copies drift and would make the importer check the same fact five times.

## 4. Where the help comes from

One resolver, one order:

1. the card's own `teaching`, if the pack wrote it;
2. the Word's `note`, then the form's `why` that matches this card's stage;
3. the card's Dictionary page parts.

The first non-empty source is the pre-answer help. The Dictionary page remains
the deep material and stays reachable. No new page level is added.

## 5. What the learner sees

- A compact word line above a word card: the lemma and its meaning before the
  answer, then the changed form and its label after the answer. The form never
  appears before the learner has tried, so the line cannot leak the answer. It
  appears only when the card has a word.
- On Forms: the transformation, then the why, then the card's own sentence with
  one blank. The learner types the changed form.
- On Matching: two columns, target forms and source meanings, shuffled
  independently. The learner taps one from each side. A correct pair locks and
  fades. A wrong pair shakes once and clears. The card is answered when every
  pair is locked, or when the learner presses Check.
- A word with no forms never shows a Forms card, because the pack never writes
  one and the importer refuses one.
- The plan keeps a word's cards adjacent and in stage order.

## 6. Invariants the importer enforces

Every message names the card or word and the field, and nothing is written until
the whole bundle passes.

1. Word ids are unique in the pack and match `^[a-z0-9][a-z0-9-]*$`.
2. `lemma` and `meaning` are non-empty.
3. Every form has `label`, `to`, `meaning` (in the pack's source language) and at
   least one `why` part.
4. Every pair has a non-empty `target` and `meaning`; targets are distinct and
   meanings are distinct within a word.
5. `card.wordId` names a word in the same pack, or one already in the target pack
   for a cards fragment.
6. `wordId` and `stage` travel together.
7. The stage's required mode matches `answerDef.mode`.
8. A `forms` card requires `word.forms.length > 0`.
9. A `matching` card requires `word.pairs.length >= 2`.
10. A `match` card without `wordId` is refused.

## 7. Four tracks, one dependency

The four tracks are review units, not four parallel branches. A, then B, C and D
in parallel:

```
A (core model)  ->  B (study UI)
                ->  C (prompts + brief)
                ->  D (import guardrails)
```

A owns every file that B, C and D need to compile: `types.ts`, `schema.ts`, the
bundle field, the resolver. B, C and D share no file with each other.

### Track A — Core model and resolution

- `Word`, `WordForm`, `WordPair`, `WordStage`, `match` mode in `types.ts`.
- Validators in `core/schema.ts`; `words` on the pack bundle.
- `wordId`/`stage` on `CardSource` and `Card`, carried by `buildCard`.
- Identity stays unchanged, with the reason written down.
- One resolver that returns the help for a card in the fixed order of section 4.
- No UI, no prompt text, no import error copy beyond the schema's own.

### Track B — Study experience

- Word line above a word card.
- Forms presentation, using the existing `type` surface.
- Matching component and its judging, reusing the evidence model.
- Plan ordering: a word's cards adjacent and in stage order.
- Skips a stage the pack did not write.

### Track C — Prompts and creation brief

- `focusWord` on `CreationBrief`, validated and trimmed like every text field.
- Suggestions from installed packs only; never blocks an unseen word.
- Both prompt lanes ask for one cohesive lesson and the `words` shape.
- The brief's `focusWord` reaches both lanes.

### Track D — Import guardrails

- The ten invariants above, in the pack bundle path and the pack loader.
- Plain messages, all-or-nothing.
- Old bundles with no `words` import unchanged.

## 8. Compatibility

- A pack with no `words` is valid.
- A card with no `wordId` is valid.
- A bundle written before this pack has no `words` key and must not be rewritten
  or upgraded on read.
- The Polish starter pack stays valid as-is. A word lesson for it is a separate,
  later authoring change, not part of this pack.
- System Design and Browser Dev are the regression fixtures.

## 9. What this pack does not do

- No drone, board, puzzle gate, level solve or streak.
- No global lexicon or online dictionary lookup.
- No new `PageLevel`.
- No per-pair evidence rows.
- No stored word progress: a word's progress is read from its cards' rows.
- No change to `canonicalContent`.

## 10. Proof

- `npm run typecheck`
- `npm test -- card import browser-bundle creation-brief provider-prompt`
- A new fixture pack with one word and five stage cards imports and studies.
- The same fixture with each of the ten defects is refused with the named
  sentence and nothing written.
- Polish starter, System Design and Browser Dev import unchanged.

## 11. Risks

- **A stage card whose text repeats another stage's text.** Different prompt and
  answer keep the identity distinct, but the author should vary the sentence.
  The importer does not check for near-duplicates; that would refuse honest
  lessons.
- **Matching on a small screen.** Two columns of long Polish forms wrap badly.
  The component must use one column per side with equal row heights and must not
  use a drag-only interaction.
- **A word split across decks.** The model allows it because cards already name
  one deck. The plan keeps the lesson together only inside a selected scope; a
  scope that excludes half the lesson shows half the lesson, which is honest.
