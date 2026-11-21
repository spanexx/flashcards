# IMPL: Word lessons

Four phases. Phase A must land first because B, C and D compile against it.
B, C and D touch disjoint files and may run in parallel after A.

## Phase A — Core model, storage and resolution

Files:
- `v1/src/lib/shared/types.ts`
- `v1/src/lib/core/schema.ts`
- `v1/src/lib/core/card.ts`
- `v1/src/lib/core/word.ts` (new)
- `v1/src/lib/browser/repository.ts`
- `v1/src/lib/packs/types.ts`
- `v1/src/lib/packs/loader.ts`
- `v1/src/lib/browser/bundle.ts` (the bundle schema field only)
- `v1/tests/word.test.ts` (new)

Work:
- Add `Word`, `WordForm`, `WordPair`, `WordStage`, `STAGE_ORDER` and
  `STAGE_MODE` to `types.ts`.
- Add `match` to `AnswerMode`. Add `wordId?` and `stage?` to `Card` and
  `CardSource`.
- Add `wordSchema`, `wordFormSchema`, `wordPairSchema` to `schema.ts`; add
  `words` (default `[]`) to `packCardsSchema` and to the pack bundle schema.
- Carry `wordId`/`stage` through `buildCard`. Do **not** touch
  `canonicalContent`; add the WHY comment that says why the link is context.
- Add `wordById(words, id)`, `formForStage(word, stage)` and
  `resolveCardHelp({ card, word, pageParts })` in `core/word.ts`. The resolver
  returns `TeachingPart[]` in the fixed order: card teaching, word note/form
  why, page parts.
- Add `words` to `BrowserPack` as an optional field so old rows read unchanged,
  and to `PackRecord`.
- Read `words` from `cards.json` in the folder loader. An absent key is `[]`.

Proof:
- `npm run typecheck`
- `npm test -- word card packs`
- A card with no word still hashes to the same id before and after this phase.

## Phase B — Study experience

Files:
- `v1/src/lib/core/plan.ts`
- `v1/src/lib/core/match.ts` (new)
- `v1/src/lib/client/study-view.ts`
- `v1/src/app/study/WordLine.tsx` (new)
- `v1/src/app/study/MatchBoard.tsx` (new)
- `v1/src/app/study/StudyCard.tsx`
- `v1/src/app/study/StudySession.tsx`
- `v1/src/app/StudyClient.tsx`
- `v1/src/app/globals.css`
- `v1/tests/match.test.ts` (new)
- `v1/tests/plan.test.ts`

Work:
- Order a plan's cards so one word's cards are adjacent and run in
  `STAGE_ORDER`. A word with one selected card is untouched.
- Add `WordLine`: `lemma -> form` with the form label. Render only when the card
  has a word and the word has something to show.
- Forms needs no new surface: the card is a `type` card. Show the transformation
  above the prompt and the why as help.
- Add `MatchBoard`: two independently shuffled columns, tap-to-pair, lock a
  correct pair, shake a wrong one, `Check` ends the attempt.
- Add `judgeMatch` in `core/match.ts`: all pairs right -> `got_it`; some right ->
  `nearly`; none -> `no`. One `AnswerResult` for the card, one evidence row.
- Add the `match` instruction and label to `study-view.ts`.
- Render `MatchBoard` from `StudyCard` when `mode === "match"`; never accept
  typed text for it.

Proof:
- `npm test -- match plan`
- `npm run typecheck`
- Browser check at 390, 820 and 1416 wide: two columns readable, no drag needed.

## Phase C — Creation brief and prompt lanes

Files:
- `v1/src/lib/shared/creation.ts`
- `v1/src/app/library/CreationBriefFields.tsx`
- `v1/src/app/library/CreatePanel.tsx`
- `v1/src/lib/provider/prompt.ts`
- `v1/src/lib/browser/authoring.ts`
- `v1/tests/creation-brief.test.ts`
- `v1/tests/provider-prompt.test.ts`
- `v1/tests/browser-authoring.test.ts`

Work:
- Add `focusWord` to `CreationBrief`, the defaults, `defaultCreationBrief` and
  `validateCreationBrief`. It is optional, trimmed, and never required.
- Emit two prompt lines when set: the lesson instruction, and the expected
  `lemma`.
- Suggest installed lemmas in the field from a `<datalist>`; show the word's
  language when a match exists. Never block an unseen word.
- Add the `words` JSON shape and the stage-to-mode rule to both default prompt
  text and the authoring prompt. Ask for one lesson, not five lines.

Proof:
- `npm test -- creation-brief provider-prompt browser-authoring`
- An empty `focusWord` leaves both prompts byte-identical to today.

## Phase D — Import guardrails

Files:
- `v1/src/lib/core/word-check.ts` (new)
- `v1/src/lib/core/import.ts`
- `v1/src/lib/browser/bundle.ts`
- `v1/src/lib/packs/loader.ts`
- `v1/tests/word-check.test.ts` (new)
- `v1/tests/browser-bundle.test.ts`
- `v1/tests/import.test.ts`

Work:
- Add `lessonIssues(cards, words, existingWords?)` returning `ValidationIssue[]`
  with one plain sentence per defect, naming the card summary or word id.
- Enforce the ten invariants from the PRD.
- Call it from the pack bundle validation and the folder loader, before any
  write. Keep all-or-nothing.
- A bundle with no `words` key and no `wordId` passes untouched.
- A cards fragment may link only to words already in the target pack.

Proof:
- `npm test -- word-check browser-bundle import`
- One fixture with each of the ten defects is refused and nothing is written.
- Polish starter, System Design and Browser Dev import unchanged.

## Commit plan

One commit per phase. Each commit message names the phase and the pack. The
docs land with Phase A so the code trail is never ahead of its decision.
