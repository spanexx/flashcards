**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# Hear the answer

## Question

The learner asked for audio of the card answer in the answer section. In their
words: "I mean the text to speech of the answer." The voice must follow the
language being learned (Polish, English, Spanish, any declared language), speak
numbers in that language, and not read code as raw symbols — a code answer
needs a spoken explanation instead.

## Resolution

**The answer gets a "Hear the answer" control.** It sits in the answer area of
the reveal and speaks that card's answer once. It is a button, not autoplay, so
no audio starts by surprise. `[agent decision]`

**The spoken text is composed from the answer parts, in order:**

- `text` parts are spoken as written; a `translation` part is spoken too, so the
  learner hears the whole answer. `[agent decision]`
- Revealed blanks are spoken in place, using the expected word the reveal
  already shows.
- A `speak` part uses its own `text` and `lang` when it carries them.
- A `code` part is **not** read symbol by symbol. If the card has a teaching
  text part, that explanation is spoken after the rest of the answer. If there
  is no explanation text, the voice says: "This answer is code. Read it on the
  card." `[agent decision]`

**Language follows the pack, never the question language.** The pack's
`language` is normalised with the existing language helper and used as the
utterance language, so a Polish answer is spoken by a Polish voice and its
numbers come out in Polish. When the browser has no voice for that language,
the device default speaks it and the button still works. `[agent decision]`

**Reuse the device voice.** The existing helper
`v1/src/lib/client/speech.ts:8` (`speak(text, lang)`) already checks for
`speechSynthesis`, cancels the previous utterance and speaks. No provider call,
no key, no new dependency, no server. It works offline and with no provider.

## Deliberately not done

- No provider text-to-speech, no voice picker, no speed control.
- No automatic speech on reveal.
- No translation of the answer into another language.
- No new card field: the button reads the answer the card already has.

## Why

The browser voice is already part of the app (the `speak` part and the teaching
layer use it), so this adds a control over an existing capability instead of a
new service. Speaking the pack language is what makes a language card useful;
refusing to read code aloud keeps a programming card honest instead of turning
`==` into noise.

## Source

Learner voice note, 2026-10-26: "text to speech of the answer ... if it's in
Polish, it's just speaking ... speak the number in the language that the user is
learning from ... if it is code or something ... it should have some kind of
text that explains the answer." Existing code:
`v1/src/lib/client/speech.ts:8-14`, `v1/src/lib/shared/types.ts:46-51`
(`CardPart` `code` and `speak`), `v1/src/lib/shared/types.ts:251-265`
(`PackStatus.language`), `v1/src/lib/shared/language.ts:105-125`
(`normalizeLanguage`, `languageName`).
