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
translation, each text part carrying its own language tag
**When** the learner presses "Hear the answer" under the reveal
**Then** the Polish line is read with the Polish voice and the English
translation with the English voice, in display order; nothing is stored or sent.

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

### Scenario 6: an older card has no language tags

**Given** a card written before text parts carried language tags
**When** the learner presses the control
**Then** the pack pair is used: the translation is read in the question
language and the learning line in the learning language, so the card still
plays.

### Scenario 7: the existing speech and sound are untouched

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
scenario 1 → lines [{text:"Byłem w domu.", lang:"pl"},
             {text:"I was at home.", lang:"en"}] from the card's own tags,
             even when the pack pair says something else
scenario 2 → line {text:"There are 3 apples and 12 pears.", lang:"en"}
scenario 3 → before code "It prints 8. The double star is exponentiation.";
             after code "The double star is exponentiation. It prints 8.";
             no "(", ")", "{", "}"
scenario 4 → text "This answer is code. Read it on screen."; no code characters
scenario 5 → speechSupported() is false outside a browser
scenario 6 → an untagged older card falls back to pack pair pl/en
scenario 7 → "Hear it", "Play the line", "Listen to the layer" and the cue
             function are still present
```

## Technical Design

### Data Models

- `CardPart` (`v1/src/lib/shared/types.ts:46-51`) is the input: `text`, `code`,
  `speak`, `media`, `blank`. A `text` part gains an optional `lang` tag naming
  the language its words are written in; `speak` parts already had one.
- Card creation writes those tags from the pack's declared pair: a full line
  gets the learning language, a translation the question language, and a
  switching line is split into separate text parts.
- `TeachingPart` (`:27-34`) supplies the code explanation when present.
- Output is `SpeechLine[]` (`v1/src/lib/client/layer.ts:118-121`): one
  `{ text, lang }` per utterance. It is reused rather than inventing a second
  speech shape.

### API Contracts

`v1/src/lib/client/answer-speech.ts`

```ts
export const CODE_ANSWER_LINE = "This answer is code. Read it on screen.";

export function answerSpeech(
  parts: readonly CardPart[],
  options?: { lang?: string; sourceLang?: string; teaching?: readonly TeachingPart[] },
): SpeechLine[];
```

Rules, in order:

1. `text` and `speak` parts contribute their text, in display order.
2. A part's own non-empty `lang` is the line's language. Without a tag, a
   `translation` uses the trimmed `sourceLang`, and anything else uses the
   trimmed `lang`; both fall back to `""`.
3. Neighbouring parts with the same language join into one line, one space
   between them; a space before `, . ; : ! ? …` is removed.
4. The first `code` part contributes, at its own place in the order, the card's
   teaching text parts joined, when there are any; otherwise
   `CODE_ANSWER_LINE`. Later code parts add nothing, and the code text itself
   never contributes.
5. `blank` and `media` parts contribute nothing.

`v1/src/lib/client/speech.ts` gains:

```ts
export function speechSupported(): boolean;
export function speakLines(lines: readonly { text: string; lang: string }[]): void;
```

`speakLines` cancels once, then queues each line in its own language; a line
that errors is skipped so one missing voice does not silence the rest.
`speechSupported()` is false during server rendering and when the browser lacks
synthesis.

`StudyCard` gains `answerLang?: string` and `answerSourceLang?: string`. It
renders the button under the answer only when `speechSupported()` is true after
mount and there is at least one spoken line. `StudyClient` passes
`packLanguage` (already computed at `:782`) and the pack's `sourceLanguage`.

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
- No guessing a word's language at speak time; the card's tag decides.
- No automatic re-tagging of older cards; they use the pack pair fallback.
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
