**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# A kinder typing card

## Question

The typing card let the learner press Answer with nothing typed. An empty
submission is judged as a miss and written to the record, so a stray click or
Enter looks like an attempt the learner never made. The learner asked for a gate
and, in the same breath, for more help on the card: beginner autocomplete from
the answer, sound, and any other experience that makes studying better.

## Resolution

- **The Answer button waits for an attempt.** It stays disabled until a typed
  card holds at least one non-space character, a cloze card holds at least one
  filled blank, or a picks card has a choice. Enter to check follows the same
  gate. Spaces alone never count.
- **Beginners get an inline completion.** On a single-answer typed card (type or
  hear-then-type) in a beginner deck, once the learner has typed a matching
  start, the rest of the expected answer appears as a muted ghost after the
  cursor. The ghost is never inserted by itself.
- **Three ways to accept.** Tab, the right arrow with the cursor at the end of
  the line, or a small **Complete** control beside the input. The control exists
  because phones have no Tab key.
- **No completion elsewhere.** Not on cloze blanks, not on picks, not on
  intermediate or advanced decks.
- **The completion is teaching, not a hint.** Using it does not cap the outcome
  at Nearly, matching the teaching layer's rule that help is teaching and a
  hint is what caps a card.
- **A quiet "I don't know" is allowed.** It submits an empty attempt on purpose,
  reveals the answer and records the card as missed. The Answer button still
  never enables empty. This is the escape from the gate, not a hole in it.
- **One new sound cue.** Accepting a completion plays a short soft cue when the
  learner has sound on. The outcome cues and the finish cue stay as they are;
  sound stays off by default.
- **The card keeps its shape.** No new screen, no new card field, no judge
  change and no extra provider call.
- **The card level decides.** The level is the card's own deck level, the same
  level the teaching layer already uses.

## Why

The record is append-only evidence. An empty submission writes a real miss for
an attempt nobody made, and a disabled button says "you have not tried yet"
sooner than a judgement does. At the same time, a gate with no way out traps a
learner who is stuck, so "I don't know" stays as a deliberate, visible choice.

Autocomplete is limited to beginners because the learner asked for it there:
beginners are still learning the shape and spelling of the line, while stronger
levels should recall it unaided. It is inline rather than a list so the card
still feels like one line being typed.

## Source

Learner message, 2026-10-28, verbatim:

> "add validation to the flashcard so we dont allow no input, lerner must attempt
> to answer before answer button can be enabled"

and, after the gate was isolated:

> "add more learner experience to be better, like sound effects, use the answer
> to give auto complete fo beginner, you can add other better experiences. use
> @surgical-change and goal skill and merge to main then push when done. then
> remove all branches. make sure to screenshot, test visuals and view to make
> sure all works before merging, clean up after yourself"

Screenshot with the request: a "Type the line" card, an empty "Your answer"
field and an enabled Answer button.

The completion and the I-don't-know escape were not separately specified. They
are agent decisions under the learner's delegated authority ("you can add other
better experiences"), recorded in
`docs/features/study-card-guidance/GRILL-study-card-guidance.txt`.

Implementation: `docs/features/study-card-guidance/IMPL-study-card-guidance.md`.
