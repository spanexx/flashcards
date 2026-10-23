# PRD-TRD: Study experience

Status: Implemented under delegated authority, 2026-10-23
Date: 2026-10-23
Pack: `study-experience`
GRILL: `GRILL-study-experience.txt`

## 1. Why

The study screen is the centre of the app, but it gives the answer away before
the learner answers. A summary chip often prints the exact phrase being asked
for, and a listening card prints the line it asks the learner to hear. The tutor
can be switched on but does nothing unless the learner presses a hint button,
and the card itself is visually plain. The learner also cannot choose a pack to
study; the system always chooses.

This pack fixes those four things without changing the judging rules, the four
outcome words, the one-return rule, the session offer, or the no-score ending.

## 2. What this pack promises

1. **No answer before the answer.** A card never shows its summary or answer
   side before the learner submits. A neutral mode label replaces the summary.
2. **Listening is listening.** A `hear_type` card shows one play control and the
   instruction "Listen, then type what you hear." It prints no summary, no full
   line and no translation before the answer.
3. **The tutor does something.** When the tutor is on, the first wrong answer on
   a card automatically asks for one tutor hint. Hints are labelled by source.
   The learner can still ask for more, and pack hints remain the fallback.
4. **The learner chooses the scope.** The plan screen offers All cards or one
   installed pack, plus a deck inside that pack. The chosen scope filters the
   plan; the offer count still applies.
5. **The card looks deliberate.** A progress bar, a clear mode label, a larger
   prompt, a distinct answer block with translations on their own line, a calm
   outcome badge and a phone-sized layout. Corrections move behind a small
   disclosure.
6. **Nothing else moves.** The judge, evidence, session ending, algorithm,
   provider prompt, card schema, pack schema and backup schema are unchanged.

## 3. User-facing behaviour

### 3.1 Plan scope

`Study -> Today's session`

- The plan screen has a "Study from" select. The default is "All cards".
- The options are the installed packs from `GET /api/packs`.
- When a pack is selected, a second select offers "All decks" and the pack's
  decks. Choosing a deck narrows the plan further.
- Changing either select rebuilds the plan from the chosen scope. The offer
  count is kept.
- The plan line names the scope: "12 cards from Polish Starter are laid out."
  With All cards it says "from the whole library". The count is the number of
  cards actually planned, not the requested offer.
- An empty scope shows a plain message and a "Study all cards" button. It does
  not trap the learner in an empty plan.
- `Rebuild the plan` uses the current scope and the chosen offer.

### 3.2 The pre-answer card

- The top row shows a mode label, not `card.summary`:
  - cloze: "Fill the blank"
  - type: "Type the line"
  - hear_type: "Listen and type"
  - picks: "Choose the meaning"
- The mode label is a chip. It may also show "tutor on" when the tutor was
  approved.
- The prompt side renders only what the card author put in `card.prompt`.
- The summary is not rendered anywhere before the answer is judged.

### 3.3 Listening cards

- A `hear_type` card renders one prominent "Play the line" button.
- The button speaks the `speak` part of the prompt, or `fullLine`, or `summary`
  as a last resort.
- The instruction below it is "Listen, then type what you hear."
- The duplicate "Play it again" and inline "Hear it" controls are gone for this
  mode.
- The answer input is a single text field with placeholder "Type what you
  hear".
- After submission the answer side is revealed like any other card.

### 3.4 The tutor

- The plan disclosure already explains what the tutor sees. It now also says:
  "The tutor will offer a hint after a missed answer."
- Turning the tutor on is still a per-session choice. It is never persisted.
- When the tutor is on and a submitted answer is wrong (`again` or `no`), the
  screen automatically asks `/api/provider/hint` once for that card. The request
  carries the outcome label and the hints already shown.
- The automatic hint is once per card per session. A returned card does not
  trigger a second automatic hint.
- Manual "Ask for a hint" still works, whether the tutor is on or off.
- Every hint block has a source label:
  - "Tutor hint" when the provider answered.
  - "Pack hint" when the card's own hints answered.
- If the tutor fails, the pack hint is still used and the provider message is
  shown in plain words.
- A hint still marks the card as hint-used for a future attempt, as before.

### 3.5 The answer reveal

- The answer side is a distinct block with a left accent line.
- The first answer line is the full line or answer; translation parts render on
  their own line, muted and italic.
- The outcome is a badge: Got it, Nearly, Again or No. The region line says what
  the learner wrote and what was expected.
- The four correction buttons live under a "Was this fair?" disclosure. The
  current outcome remains visible.
- The primary action is Next card, or Finish on the last card.
- The record link remains a secondary action.
- The working-memory side-by-side block is unchanged.

### 3.6 Visual language

- The study screen uses a narrower shell than the library and keeps the card
  centred.
- A slim progress bar shows position in the session.
- The card has a soft gradient, a larger prompt, and generous spacing.
- The reveal fades in; motion is short and respects `prefers-reduced-motion`.
- At phone width the card fills the available width, the play button is
  full-width, and the primary action stays easy to reach.
- All colours come from the existing CSS variables.

## 4. API and data

### 4.1 Plan query

`GET /api/plan?offer=20&pack=Polish%20Starter&deck=basics`

- `pack` and `deck` are optional.
- The route filters active cards before planning:
  - no pack: every active card
  - pack: cards whose `packName` matches
  - deck: cards whose `packName` and `deckId` match
- The route validates that the named pack exists. An unknown pack returns
  `{ plan: null, message: "There is no pack ... here." }`.
- An empty scope returns `{ plan: null, message: "No cards in ... yet." }`.
- No new response field is required; the UI already knows the selected scope.
- The existing session-started event is still written for each plan.

### 4.2 No schema change

- `Card`, `Plan`, `AnswerResult`, `EvidenceRow`, `SessionEvent`, `PackStatus`,
  the pack bundle and the backup are unchanged.
- No new dependency.
- No change to the provider prompt contract.

## 5. Components

- `StudyClient.tsx` owns the scope selectors, the tutor auto-hint, the mode
  labels, the listening block, the reveal layout and the progress bar.
- `Side` gains a translation block style; it does not interpret card content.
- `router.ts` gains pack/deck filtering in `planAnswer`.
- `globals.css` gains `.study-*` classes and a phone breakpoint. Existing
  library and settings styles are not changed.
- No new page or route.

## 6. Edge cases

- **Returned card:** it shows the same neutral mode label; its summary is still
  hidden until the second answer.
- **Hint already used:** the automatic hint still runs after the first wrong
  answer; the hint-used flag is already true, so a returned attempt remains
  capped.
- **Tutor off:** no automatic request. Manual hints use pack hints.
- **Provider fails:** the pack hint is shown with the provider message; no crash.
- **No hints at all:** the hint block says "No hint is available for this card."
- **Pack deleted while planning:** the plan route returns the unknown-pack
  message; the learner can choose All cards.
- **Pack with no decks:** the deck select is hidden.
- **Phone width:** controls wrap; no horizontal scroll.

## 7. Tests

### Unit / integration

- `tests/browser-router.test.ts`
  - `/api/plan?pack=...` contains only that pack's cards.
  - `/api/plan?pack=...&deck=...` contains only that deck's cards.
  - an unknown pack returns `plan: null` with a plain message.
  - an empty scope returns `plan: null` with a plain message.
  - the offer still bounds the filtered plan.
- `tests/study-experience.test.ts`
  - mode labels are neutral and never the card summary.
  - a listening card's pre-answer presentation contains only the listen
    instruction and play control.
  - the automatic tutor hint is requested once for the first wrong answer and
    not for a correct answer.
- `tests/simulate-study-experience.test.ts`
  - seeds two packs, plans one pack, answers a card, asks for a hint, and checks
    the built study chunk carries the new labels and instructions.
  - the external lane checks that the answer is absent before submission.

### External lane

- Build the static app in the worktree.
- Seed the Polish pack; open Study.
- Choose the pack; assert the plan only draws that pack.
- Start; assert the answer phrase is not in the card's visible text before
  submitting.
- Find a `hear_type` card; assert its line is not printed and only one play
  control is present.
- Turn the tutor on; submit a wrong answer; assert a "Tutor hint" appears.
- Check the reveal shows the answer and translation on separate lines.
- Check the phone-width layout has no horizontal overflow.
- Clean up the server, fake provider and Edge profile.

## 8. Non-goals

- A new study algorithm, score, streak, timer or gamification.
- A global tutor chat.
- Changing the provider hint prompt or adding a new model.
- Editing cards from the study screen.
- Deck-level progress or study plans beyond the scope filter.
- PWA, deployment or app-wide responsive work (Pack 4).

## 9. Risks and named edges

- **Auto-hint latency:** the provider can take up to 60 seconds. The card stays
  usable; the hint block shows "Asking the tutor…" and the learner can continue.
- **Auto-hint cost:** one extra provider call per wrong card when the tutor is
  on. This is the point of turning it on; it is bounded to once per card.
- **Scope recording:** each plan rebuild writes a started event, as it already
  did. The offer algorithm is unchanged.
- **Answer leak in card data:** the UI can hide the summary, but a pack author
  could still put the answer in the prompt. This pack fixes the app's own leak,
  not malformed pack content.
- **Tutor source:** the pack fallback is intentionally still shown when the
  provider fails; the label makes the source honest.
## 10. Implementation record

Implemented on 2026-10-23 in the `feature/study-experience` worktree.

- The scope filter lives in `planAnswer`; the route validates the pack and
  deck before planning.
- `v1/src/lib/client/study-view.ts` holds the neutral labels, the listen
  prompt choice and the auto-hint decision.
- `StudyClient` owns the scope selects, one play control for listening cards,
  the automatic hint, the source label, the progress bar and the reveal.
- `Side` joins separate text parts with a space and gives translations their
  own block. This fixes the run-together answer shown in the screenshots.
- The reveal keeps corrections behind "Was this fair?" and the record link is
  secondary.
- The mode label and outcome are chip-shaped; the card has a soft gradient;
  the reveal fades in and respects reduced motion; the phone layout makes the
  play button full-width.

Verification:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm test` passed: 41 files, 432 tests.
- External Edge lane passed: provider setup, two pack imports, pack scope,
  no answer before submission, one listen control, one automatic tutor hint,
  answer/translation layout, phone width.

Deviation: the plan line uses the actual planned card count, not the requested
offer count. The "Cards offered" field still holds the requested number.
