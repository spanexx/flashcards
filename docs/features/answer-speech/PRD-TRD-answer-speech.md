# PRD-TRD: Answer Speech

**Slug:** answer-speech
**Status:** Approved (learner asked for full implementation, 2026-10-27)
**Date:** 2026-10-27

## Why This Exists

The learner can already hear the question on a listening card, a speak part and
the teaching layer, but the answer itself is silent. They study languages and
programming, and they asked to hear the answer read back in the language they
are learning, with numbers read in that language too.

A code answer is the hard case: reading brackets and semicolons is noise. The
learner asked for the meaning instead, so the card's own teaching text explains
it, and a short line stands in when there is none.

Without this, the learner has to read the answer aloud in their head and guess
at the pronunciation the pack intended.

## Behavioral Spec

### Scenario 1: a language answer is spoken

**Given** a Polish pack and an answer with a Polish line and an English
translation
**When** the learner presses "Hear the answer" under the reveal
**Then** the device voice speaks both parts in display order with the Polish
language tag; nothing is stored or sent.

### Scenario 2: numbers follow the learning language

**Given** an English pack answer containing "3" and "12"
**When** the learner presses the control
**Then** the voice is the English one and speaks "three" and "twelve", not a
default-language reading.

### Scenario 3: a code answer is explained, never read

**Given** a Python answer made of a code part and a text explanation, with
teaching text on the card
**When** the learner presses the control
**Then** the explanation and teaching text are spoken; no braces, parentheses
or semicolons are spoken.

### Scenario 4: code with no teaching still says something

**Given** a code-only answer on a card with no teaching layer
**When** the learner presses the control
**Then** one short line says the answer is code and to read it on screen; the
raw code is not spoken.

### Scenario 5: no voice on the device

**Given** a browser without speech synthesis
**When** the answer is revealed
**Then** no "Hear the answer" control appears and no error is shown.

### Scenario 6: the existing speech and sound are untouched

**Given** an answer with a speak part, a listening card and the feedback cues
**When** the learner uses any of them
**Then** they behave exactly as before; the new control is additive.

## Simulation Contract

The post-impl simulation (`simulate.mjs`) runs the real helper and shows, for
each scenario, the exact text and language tag the device would receive. It
also checks the no-voice guard and that the existing speech controls are still
in the shipped source. A CLI runner is the right shape here: the observable is
text, not a visual state.

```
scenario 1 → text "My jedliśmy obiad. We were eating dinner." lang "pl"
scenario 2 → text "There are 3 apples and 12 pears." lang "en"
scenario 3 → text before code "It prints 8. The double star is exponentiation.";
             text after code "The double star is exponentiation. It prints 8.";
             no "(", ")", "{", "}"
scenario 4 → text "This answer is code. Read it on screen."; no code characters
scenario 5 → speechSupported() is false outside a browser
scenario 6 → "Hear it", "Play the line", "Listen to the layer" and the cue
             function are still present
```

## Technical Design

### Data Models

- `CardPart` (`v1/src/lib/shared/types.ts:46-51`) is the input: `text`, `code`,
  `speak`, `media`, `blank`.
- `TeachingPart` (`:27-34`) supplies the code explanation when present.
- Output is `SpeechLine` (`v1/src/lib/client/layer.ts:118-121`): `{ text, lang }`.
  It is reused rather than inventing a second speech shape.

### API Contracts

`v1/src/lib/client/answer-speech.ts`

```ts
export const CODE_ANSWER_LINE = "This answer is code. Read it on screen.";

export function answerSpeech(
  parts: readonly CardPart[],
  options?: { lang?: string; teaching?: readonly TeachingPart[] },
): SpeechLine;
```

Rules, in order:

1. `text` and `speak` parts contribute their text.
2. The first `code` part contributes, at its own place in the order, the card's
   teaching text parts joined, when there are any; otherwise
   `CODE_ANSWER_LINE`. Later code parts add nothing, and the code text itself
   never contributes.
3. `blank` and `media` parts contribute nothing.
4. Segments join with one space; a space before `, . ; : ! ? …` is removed.
5. `lang` is the trimmed pack language, or `""` when the pack has none.

`v1/src/lib/client/speech.ts` gains:

```ts
export function speechSupported(): boolean;
```

It is false during server rendering and when the browser lacks synthesis.

`StudyCard` gains `answerLang?: string`. It renders the button under the answer
only when `speechSupported()` is true after mount and the spoken text is not
empty. `StudyClient` passes `packLanguage` (already computed at `:782`).

### Dependencies

None. Uses the browser's own `speechSynthesis`, already used by
`CardSide.tsx:69`, `StudyCard.tsx:158` and `TeachingLayer.tsx`. No provider call,
no audio asset, no new package.

### Architecture Notes

The text builder is pure and lives beside `layerSpeech`, so it is tested without
a DOM. The browser check and the `speak` call stay in the client layer. The card
component only decides whether to show the control; the pack lookup stays in
`StudyClient`, which already knows the running card's pack.

## Non-Goals

- No autoplay on reveal; audio only after a press.
- No speed, pitch or voice picker; the device default voice for the language.
- No per-part voice switching; one utterance per press.
- No recorded audio, cache or offline voice pack.
- No change to the feedback cues, the speak part, the listening card or the
  teaching layer's Listen.
- No speaking of the prompt, the hint, the regions or the summary.

## Out of Scope (Future)

- A global "read answers aloud" preference.
- Word-by-word highlighting while speech plays.
- A fallback recorded voice when the device has none.

## References

- `docs/features/answer-speech/GRILL-answer-speech.txt`
- `wayfinder/anything-learning-spec/tickets/answer-speech.md`
- `CONTEXT.md`
- `docs/features/answer-speech/IMPL-answer-speech.md`
- `v1/src/app/study/StudyCard.tsx`, `v1/src/app/study/CardSide.tsx`,
  `v1/src/lib/client/speech.ts`, `v1/src/lib/client/layer.ts`
