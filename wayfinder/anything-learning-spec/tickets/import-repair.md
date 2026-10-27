**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# Fix a refused import with the provider

## Question

The job dock already offers "Try again" and "Dismiss". The learner pointed out
that a refused import will fail again almost every time, because the same broken
text is sent to the same validator. They asked to keep "Try again" and add
another action: "fix with AI or something", so the provider can see the broken
content and repair it. They also said: "I don't want to have text buttons", and
asked for a round icon for Try again, "like the how telegram icon looks".

## Resolution

**Import failures get a second action: "Fix with AI".** Generation failures keep
only "Try again", because a provider failure may be transient and the same
prompt can succeed; an import refusal is deterministic and the same bytes will
be refused again.

**The repair path is explicit and validated.** Pressing "Fix with AI":

1. shows the exact text that will leave the machine (the refused import text
   plus the validator's refusal), following the standing "learner sees the
   prompt first" rule;
2. sends it to the learner's configured provider and asks for corrected JSON
   only;
3. runs the corrected text through the **normal import validator**;
4. saves nothing unless that validator passes.

If the provider is not set up, the action is absent and the job says a provider
is needed. `[agent decision]`

**This is a learner-approved exception to the privacy boundary.** The privacy
ticket allows only app-chosen categories to leave the machine. The learner
asked, on 2026-10-26, for the provider to see the broken pack and fix it. The
exception is narrow: it applies to the one refused import the learner presses
the action on, it is never automatic, and the exact text is shown before sending.

**Job actions become round, icon-only controls.** No text labels. Each control
carries an `aria-label` and a `title`:

- **Try again** — a circular arrow, round like the Telegram control the learner
  named.
- **Fix with AI** — a sparkle/wand mark.
- **View** — an arrow.
- **Dismiss** — an X.
- **Close** — an X in the dock header.

The exact glyphs are `[agent decision]`; the round, label-free shape is the
learner's.

## Deliberately not done

- No automatic repair on failure; the learner always presses the action.
- No silent upload; the preview comes first.
- No change to the validator's refusal rules — the provider's answer is still
  refused if it does not validate.
- No AI repair for a failed generation; that keeps Try again.

## Why

"Try again" is honest for a transient provider failure and dishonest for a
deterministic parse failure: it asks the learner to repeat a step that cannot
change. The provider is already the app's repair tool for generated content, so
letting it see the broken import closes the loop the learner was fixing by hand.
Keeping the send explicit and revalidating keeps the app truthful and the
library safe.

## Source

Learner voice note, 2026-10-26: "leave the try again and just add another button
which is ... fixed with AI or something ... I don't want to have text buttons ...
try again should be an icon ... roundish ... like the how telegram icon looks."
Current dock: `v1/src/app/JobsDock.tsx:230-253`. Privacy promise:
`docs/ethics/dev-lane/data.md:16-24`; locked boundary in
`wayfinder/anything-learning-spec/tickets/privacy-boundary.md`.
