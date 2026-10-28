# PRD-TRD — Study card guidance

**Slug:** study-card-guidance
**Status:** Locked
**Date:** 2026-10-28
**Origin:** `wayfinder/anything-learning-spec/tickets/study-card-guidance.md`
and `docs/features/study-card-guidance/GRILL-study-card-guidance.txt`

## Why this exists

The typing card could be submitted with nothing in it. The judge then wrote a
real miss for an attempt the learner never made. The learner asked for a gate,
and in the same request for more help on the card: beginner autocomplete from
the answer, sound, and any other experience that makes studying better. This
pack adds the gate and a small, honest set of aids around it.

## What it does

### The attempt gate

- A typed card (type or hear-then-type) enables **Answer** only after at least
  one non-space character. A cloze card enables it after at least one filled
  blank. A picks card keeps its existing rule: one choice selected.
- Enter to check uses the same gate; an empty card cannot be submitted from the
  keyboard either.
- Spaces alone never enable the button. Clearing the field disables it again.

### Beginner inline completion

- Only a beginner deck, resolved from the card's own deck level (the level the
  teaching layer already uses).
- Only the single typed answer surface. No completion on cloze blanks or picks.
- After at least one typed character, if the typed text is a case- and
  diacritic-insensitive start of an expected answer, the rest of that answer
  appears as a muted ghost after the cursor. The shortest remaining suffix wins
  when several expected answers match.
- Nothing is inserted automatically. **Tab**, the **right arrow** with the
  cursor at the end of the line, or the small **Complete** control accepts the
  full expected answer. Enter still checks what was typed.
- Pointer acceptance hands the caret back to the field, at the end of the
  line, so the promised Enter still checks the answer after a click or tap.
- A completion is teaching, not a hint: it does not cap the outcome at Nearly.
  The completion is never stored and never leaves the machine.

### I don't know

- A quiet **I don't know** control on typed and cloze cards submits an empty
  attempt on purpose, reveals the answer and records the card as missed.
- It is not the Answer button and never enables it. It is the deliberate exit
  from the gate for a learner who is stuck.

### Sound

- Accepting a completion plays one short, soft cue when the learner has sound
  on. Sound stays off until the learner turns it on.
- The existing Got it, Nearly, Missed and Finish cues are unchanged.

### Accessibility and phone

- The ghost is decorative (`aria-hidden`); the input's value stays the source
  of truth. The **Complete** control is a real button, so touch and screen
  readers have a route without a keyboard.
- The aids row wraps at phone width; the ghost uses the input's own font and
  padding so it sits exactly on the line.
- Acceptance is ignored while the answer is being checked or while an input
  method is composing, and the arrow route only fires with the caret at the
  end.

## Simulation contract

The built page must show all of these before merge:

1. Empty typed card: **Answer** disabled, Enter does nothing.
2. A matching start: muted ghost suffix; typed text unchanged.
3. Tab and **Complete**: the full expected answer fills the field, the ghost
   disappears, **Answer** enables, the field keeps (or gets back) focus so
   Enter checks, and the completion cue plays when sound is on.
4. Clearing the field: the button disables again.
5. **I don't know**: the answer reveals and the card is recorded as missed.
6. An intermediate deck: no ghost, the rest of the gate unchanged.
7. Phone width (390px): ghost, **Complete** and **I don't know** fit without
   overflow.
8. Cloze: no ghost; one filled blank enables **Answer**. Picks: unchanged.

## Technical design

- `v1/src/lib/core/answer-attempt.ts` — `hasAnswerAttempt(card, answers)`, the
  one rule the button and Enter share.
- `v1/src/lib/core/answer-completion.ts` — `answerCompletion(typed, expected)`,
  pure prefix matching that reuses `normalizeAnswer`'s fold rule and returns
  the full value plus the raw suffix, or null.
- `v1/src/app/study/StudyCard.tsx` — receives the card's `level`; renders the
  ghost inside `.answer-field`; keydown for Tab/right arrow; the Complete and
  I-don't-know controls; plays the completion cue and returns the caret to the
  field. The ghost is absent once a result is shown or while busy.
- `v1/src/app/StudyClient.tsx` — passes `level` (already computed with
  `deckLevelFor`) to `StudyCard`.
- `v1/src/lib/client/sound.ts` — a `complete` cue in the existing cue list.
- `v1/src/app/globals.css` — `.answer-field`, `.answer-ghost`,
  `.study-answer-aids`, and the phone wrap.
- Tests — `v1/tests/answer-attempt.test.ts` (exists) and
  `v1/tests/answer-completion.test.ts` (new); the sound cue is covered by the
  existing cue tests.

## Non-goals

- No completion for cloze blanks or picks.
- No completion outside a beginner deck.
- No automatic insertion, no answer reveal before the first character.
- No outcome cap for a completion; no new evidence field or row shape.
- No autofocus on the answer field, so a phone does not throw its keyboard up
  on every card.
- No provider call, no stored ghost, no change to the plan, judge, session loop
  or privacy boundary.
- No visual restyle of the card beyond the ghost and the two small controls.
