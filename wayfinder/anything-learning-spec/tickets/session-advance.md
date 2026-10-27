**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# Advance without reaching for Next

## Question

The question card and the answer card have different heights. In a short browser
window — and in full screen, which is now the browser's own size — the
**Next card** button falls below the visible area, so reaching it needs Tab. The
learner asked for a way to move on without that.

## Options (simulation, 2026-10-27)

The learner asked for all options in one simulation so they can compare them:

1. **Pinned action row.** The main button (Answer, then Next card) sticks to the
   bottom of the window while the card scrolls; it only pins when it would
   otherwise fall out of view.
2. **Enter continues.** Enter already checks before the answer; after the answer
   it moves to the next card, with an "Enter to continue" hint.
3. **Minimum card height.** The question card reserves about the answer's height,
   so the card jumps less when the answer appears; the button still sits below
   the answer.
4. **1+2 (agent recommendation).** The button is always reachable and the
   keyboard moves on without aiming.

Simulation: `docs/features/session-advance/simulate-pre.html`.

## Resolution

Chosen 2026-10-27 after the simulation: **all three, together.** The learner
asked for 1, 2 and 3, and said the minimum height should be there anyway.

- **1. Pinned action row.** The main button (Answer, then Next card) sticks to
  the bottom of the visible area only while it would otherwise fall below it.
  It keeps the card's width, a solid card background and a soft shadow, in the
  normal page and in full screen.
- **2. Enter continues.** After the answer is shown, Enter moves to the next
  card (Finish on the last), with an "Enter to continue" hint beside the button.
  Enter on a focused field, link, button, summary or inside the teaching layer
  keeps its own meaning.
- **3. Minimum card height.** The card reserves 420px, so the question and the
  answer states differ less in height; a long answer can still grow past it.

The learner also said the simulated card looks better than the live card. This
ticket keeps the live card's type, colours and content; only the action row and
the reserved height change. A fuller visual restyle needs its own decision.

Implementation: `docs/features/session-advance/IMPL.md`.
