# IMPL — Study card guidance

**Slug:** study-card-guidance
**Status:** Implemented — verified
**Date:** 2026-10-28
**Origin:** `wayfinder/anything-learning-spec/tickets/study-card-guidance.md`
**Contract:** `docs/features/study-card-guidance/PRD-TRD-study-card-guidance.md`

## What this pack builds

One gate and three aids on the typing card: an Answer button that waits for a
real attempt, a beginner inline completion taken from the card's expected
answer, a deliberate "I don't know" reveal, and a soft completion cue. The card
keeps its shape; no screen, field, judge rule or provider call is added.

## Phases

1. **The attempt rule.** Test first in `v1/tests/answer-attempt.test.ts`; then
   `v1/src/lib/core/answer-attempt.ts`; wire `StudyCard`'s `canSubmit` and Enter
   guard to it. Prove: typed empty/space/full, cloze none/one, picks none/one,
   hear-then-type. (Done.)
2. **The completion rule.** Test first in `v1/tests/answer-completion.test.ts`;
   then `v1/src/lib/core/answer-completion.ts`. Prove: no ghost before typing,
   prefix match, case and diacritic fold, shortest suffix among variants, null
   on a full match and on a non-match, spaces.
3. **The card UI.** Pass `level` from `StudyClient`; add the ghost, Tab/arrow
   accept, the Complete control, the I-don't-know control, and the completion
   cue. Hide all aids while busy or after the result. Prove with typecheck,
   changed-file lint and the served page.
4. **The sound cue.** Add `complete` to `sound.ts`; keep the existing cues and
   the off-by-default rule. Prove with the existing sound tests and a live
   acceptance with sound on.
5. **Docs and checks.** Fill this IMPL's verification, write the visual
   checklist, run both drift gates, and update the map/ticket if the shape
   changed.

## Files

- `v1/src/lib/core/answer-attempt.ts` — the attempt rule.
- `v1/src/lib/core/answer-completion.ts` — the ghost rule.
- `v1/src/app/study/StudyCard.tsx` — level prop, ghost, accept routes, two
  controls, cue.
- `v1/src/app/StudyClient.tsx` — pass `level` to the card.
- `v1/src/lib/client/sound.ts` — the `complete` cue.
- `v1/src/app/globals.css` — ghost overlay, aids row, phone wrap.
- `v1/tests/answer-attempt.test.ts`, `v1/tests/answer-completion.test.ts`,
  `v1/tests/sound.test.ts` if the cue list is asserted.
- `docs/features/study-card-guidance/*`,
  `wayfinder/anything-learning-spec/tickets/study-card-guidance.md`,
  `wayfinder/anything-learning-spec/map.md`.

## Edge cases

- Spaces, tabs or a cleared field disable Answer again.
- A cloze card with one blank filled enables Answer; the empty blanks are judged
  as misses, as they were before.
- Picks keep their own rule; no completion and no I-don't-know control.
- The ghost only appears after a real character and only while the caret can
  accept it; ArrowRight with the caret mid-line moves the caret normally.
- Tab accepts instead of moving focus only while a ghost is shown; otherwise
  Tab keeps its browser meaning.
- A right arrow during an input-method composition, while busy, or after a
  result is ignored.
- The card's expected answers may be several spellings; the shortest suffix is
  shown. A typed full match shows no ghost.
- A very long line can push the ghost past the field; the wrapper clips it and
  the input keeps its own scroll. The typed value is never changed by display.
- The completion cue is silent when sound is off or the audio engine is
  blocked, like every other cue.

## Out of scope

- Cloze-blank and picks completion.
- Intermediate or advanced completion.
- Outcome caps for a completion.
- Autofocus, a new card screen, a provider hint or stored completion.
- Any change to the judge, evidence shape, plan, session loop or privacy rule.

## Verification

- [x] Targeted `answer-attempt` and `answer-completion` tests.
- [x] `npx tsc --noEmit`.
- [x] Changed-file eslint.
- [x] `npm run build` (webpack lane) and `check-pwa`.
- [x] Full suite.
- [x] Served built page screenshots: empty disabled, ghost, accepted, I don't
      know, phone width, and a non-beginner card.
- [x] `npm run check:drift` and `npm run check:drift:staged`.

## Delivery note — 2026-10-28

- **Targeted rule tests:** `npx vitest run tests/answer-attempt.test.ts
  tests/answer-completion.test.ts tests/sound.test.ts` → 3 files, 19 tests
  passed.
- **Typecheck and lint:** `npx tsc --noEmit` clean; eslint on every changed
  TypeScript file clean.
- **Build:** `npm run build` (webpack lane) exit 0; `check-pwa: passed (base
  path: /, files: 78, precache entries: 76)`.
- **Full suite:** `npx vitest run` → 70 files, 746 tests passed.
- **Served page:** the rebuilt export was exercised at `localhost:4179`.
  Captured and viewed: the empty card with Answer disabled, the beginner ghost,
  the accepted full answer, the I-don't-know reveal, the 390px phone layout
  (same-origin iframe harness) and the light theme. The intermediate card was
  driven on the same export: after `G` the field holds the letter, Answer
  enables, and no ghost or Complete control appears. Clearing the field dims
  Answer again.
- **Fix found by the visual pass:** clicking **Complete** moved the caret out of
  the field, so the promised Enter did nothing. `acceptCompletion` now returns
  focus to the input and puts the caret at the end. Re-checked on the rebuilt
  export: `Gdzie` → Complete → Enter → **Got it**.
- **Look correction:** the ghost initially sat on a different baseline than the
  input text, and the full-stage input font shrank without the ghost. The ghost
  now flex-centres inside the same box and the full-stage rule sizes both.
- **Browser limit:** two late captures were refused with
  `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE` while the in-app browser surface was
  hidden. Structure and values were read from the live DOM instead; the phone
  pass used the same-origin 390px iframe because the browser window cannot be
  resized.
- **Drift:** both gates reported `0 open, 0 awaiting, 31 resolved`.
