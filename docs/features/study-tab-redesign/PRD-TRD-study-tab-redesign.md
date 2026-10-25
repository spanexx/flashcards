# PRD-TRD: Study tab redesign

**Slug:** study-tab-redesign
**Status:** Approved by the learner, 2026-10-25
**Date:** 2026-10-25
**Design:** `simulate-pre.html` (approved in the browser on 2026-10-25)

## Why

The Study tab worked but did not feel like the centre of the app. The plan
screen was a wide page with a second column of facts, and the running screen
carried a rail of counts beside the card. Both competed with the card.

The learner asked for a calmer Study tab and approved the design simulation:
one column, one action, and the card as the hero. This pack changes how Study
looks and how its screens are built. It does not change what Study does.

## What this pack promises

1. **One calm column.** The plan and the running session each use a single
   centred column. The plan rail and the session rail are gone.
2. **The card is the hero.** The prompt is set in a serif face at reading size,
   blanks sit inline in the line, and the answer button is the only primary
   action.
3. **Position is a row of pips.** The running head carries `Card n of N` and a
   row of pips. Earlier cards are filled, the current card is marked, later
   cards are quiet. The row shrinks to fit a phone and never scrolls sideways.
4. **The plan states its facts plainly.** A headline says how many cards are
   laid out, a quiet line names the scope, and two facts name the tutor state
   and that no score is kept. Scope, offer, Start session, Why these cards and
   What to expect stay.
5. **The reveal keeps its meaning.** The outcome badge, the answer block with
   translations, the region line, the `Was this fair?` corrections, the working
   block, the record link and Next card / Finish all remain. The prompt is shown
   again with the correct word marked.
6. **Nothing behavioural moves.** The judge, outcomes, evidence rows, queue and
   one-return rule, hints and automatic tutor hint, offer algorithm, session
   ending, scope filtering, full screen and autosave are untouched.
7. **The view is ready for teaching layers.** The session shell exposes one
   above-card slot. It renders nothing today. The teaching-layers pack fills it
   with its collapsible layer (GRILL entries 3 and 13) without rewriting the
   Study shell.

## Scenarios

### Scenario 1: The plan

**Given** a plan with 20 cards from the whole library
**When** Study opens
**Then** the screen shows `Study` as an eyebrow, the headline
`20 cards are laid out.`, the line `From the whole library. It's an offer —
stop whenever you like.`, and two facts: `Tutor off` and `No score kept`.
The scope row holds Study from, Deck, Offer and `Rebuild the plan`. The primary
action is `Start session`. `Stopping is not an ending.` sits beside it. The
disclosures are `Why these cards`, `What to expect` and `The tutor and hints`.

**Given** one card
**Then** the headline reads `1 card is laid out.`

### Scenario 2: Answering

**Given** a running session at card 4 of 20
**Then** the head shows `Card 4 of 20`, three filled pips, one marked pip and
sixteen quiet pips, plus `Full screen` and `End`.
**And** the card shows the mode label (`Fill the blank`, `Type the line`,
`Listen and type` or `Choose the meaning`) and an `Ask for a hint` link.
**And** a cloze card sets its blanks inline in the serif prompt.
**And** the instruction sits under the prompt, and `Enter` checks the answer.

### Scenario 3: The reveal

**Given** a submitted answer
**Then** the card top shows the mode label and the outcome badge.
**And** the prompt is shown again with the correct word marked.
**And** the answer block holds the full answer and any translation on its own
line.
**And** one region line says what the learner wrote and what was expected for
each region.
**And** the corrections live under `Was this fair?`.
**And** the secondary action is `Look at this card's record`, and the primary
action is `Next card` or `Finish`.
**And** when no hint was used, a quiet line under the card says
`Hints were not used on this card.`

### Scenario 4: Phone

**Given** a 390px window
**Then** the plan and session are one column, the pips shrink to fit, the card
actions stack with the primary action last, and
`document.documentElement.scrollWidth` does not exceed the viewport.

### Scenario 5: Full screen

**Given** a running card
**When** the learner presses `Full screen`
**Then** the fixed stage covers the sidebar and the page, the card grows, and
`Exit full screen`, Escape and next-card keep their current behaviour.

### Scenario 6: The teaching seam

**Given** the Study session shell
**Then** it accepts one optional element above the card and renders nothing when
the element is absent. A card with no teaching layer looks exactly as described
above.

## Behaviour kept

- `studyModeLabel`, `LISTEN_INSTRUCTION`, `listenPrompt`, `shouldAutoHint`.
- `/api/plan` scope filtering and the offer algorithm.
- `/api/answer`, `/api/provider/hint`, `/api/evidence/correction`,
  `/api/session/end`.
- The four outcomes and their labels, the hint cap, the one-return rule and the
  no-score ending.
- The working block and its "nothing saved or sent" note.
- Full-screen state, Escape handling and `body.full-stage` cleanup.

## Components

- `v1/src/lib/client/study-layout.ts` — pure copy and pip helpers.
- `v1/src/app/study/ScopePicker.tsx` — pack and deck selects.
- `v1/src/app/study/StudyPlan.tsx` — the plan screen and its disclosures.
- `v1/src/app/study/StudySession.tsx` — session head, pips, stage, full-screen
  controls and the above-card slot.
- `v1/src/app/study/StudyCard.tsx` — pre-answer card, reveal, hints, working and
  corrections.
- `v1/src/app/study/CardSide.tsx` — the prompt/answer side renderer.
- `v1/src/app/StudyClient.tsx` — state and handlers; composes the modules.
- `v1/src/app/globals.css` — the redesigned Study styles.

No route, schema, package or stored shape changes.

## Tests

- `v1/tests/study-layout.test.ts` — headline copy, lede copy, pip states for
  first, middle, last, empty and over-run positions.
- `v1/tests/simulate-study-experience.test.ts` — the built Study screen carries
  the new plan shell and pips, and still carries the locked labels.
- `v1/tests/study-experience.test.ts` — unchanged: neutral labels, listening
  rule and automatic hint.
- `v1/tests/simulate-language-prompt-control.test.ts` — unchanged: the
  `study-instruction` class is still present.

## Non-goals

- No change to judging, evidence, scheduling, hints, session ending or offer.
- No teaching-layer implementation, editor, media or level resolution. Only the
  empty above-card seam.
- No Library, Create, Progress or Settings redesign.
- No new dependency, animation library or font file. The serif is the device's
  own serif stack.
- No score, streak, timer or gamification.

## Supersedes

The learner approved this shape on 2026-10-25, superseding:

- `docs/features/learner-interface/GRILL-learner-interface.txt:44` (820px card
  plus a session rail) and its Scenario 3 rail paragraphs.
- `docs/features/study-experience/GRILL-study-experience.txt:44` (progress bar)
  in favour of position pips.

## References

- `docs/features/study-tab-redesign/simulate-pre.html` — approved design
- `docs/features/learner-interface/PRD-TRD-learner-interface.md` — shell and full
  screen
- `docs/features/study-experience/PRD-TRD-study-experience.md` — labels, hints
  and reveal rules
- `docs/features/teaching-layers/PRD-TRD-teaching-layers.md` — the layer that
  will use the seam (in the teaching-layers worktree until it merges)
- `v1/src/app/StudyClient.tsx` — the current screen
- `v1/src/app/globals.css` — the current Study styles
