# IMPL: Study experience

Status: Implemented under delegated authority, 2026-10-23
Date: 2026-10-23
Pack: `study-experience`
PRD-TRD: `PRD-TRD-study-experience.md`

## Phase 1: plan scope

Files: `v1/src/lib/browser/router.ts`, `v1/tests/browser-router.test.ts`.

- Extend `planAnswer(offerRaw, packName, deckId)`.
- Read `pack` and `deck` from the query in `/api/plan`.
- Validate a named pack against `state.packs`; return a plain null-plan message
  when it is missing.
- Filter active cards by pack and deck before `buildPlan`.
- Return the existing `{ plan, message }` shape.
- Keep the session-started write for a non-empty plan.
- Add router tests for pack, deck, unknown pack and empty scope.

Verification: targeted `npx vitest run tests/browser-router.test.ts`.

## Phase 2: study view helpers

Files: `v1/src/lib/client/study-view.ts` (new), `v1/tests/study-experience.test.ts`
(new).

- Add `studyModeLabel(mode)` returning the four neutral labels.
- Add `LISTEN_INSTRUCTION` = "Listen, then type what you hear.".
- Add `listenPrompt(card)` choosing the prompt speak text, then `fullLine`, then
  `summary`.
- Add `answerDisplayParts(card)`? No; keep the answer side rendering in the
  component. The helper is only for the three pure decisions.
- Tests pin that no label equals a card summary and that the listen helper never
  returns the answer as visible text.

Verification: targeted `npx vitest run tests/study-experience.test.ts`.

## Phase 3: StudyClient

Files: `v1/src/app/StudyClient.tsx`, `v1/src/lib/client/study-view.ts`,
`v1/src/app/globals.css`.

- Add pack state:
  - `packs: PackStatus[]`
  - `scopePack: string`
  - `scopeDeck: string`
  - load `/api/packs` once on mount.
- Change `loadPlan(offer?, packName?, deckId?)` to build the query with
  `URLSearchParams`.
- Add the "Study from" and deck selects to the plan screen.
- Change the plan line to name the scope when one is chosen.
- Add "Study all cards" to the empty phase when a scope is active.
- Replace the summary chip with `studyModeLabel(card.answerDef.mode)`.
- Remove the duplicate hear_type "Play it again" block and the inline `Side`
  speak button for hear_type. Render one `.study-listen` block.
- Hide `card.summary` before `result`; show it after the answer.
- Add the progress bar.
- Add `hintSource` state and a `requestHint(outcomeCategory?, automatic?)`
  helper.
- In `submitAnswer`, after a wrong result, if `approved === "yes"` and the card
  has not auto-hinted, call `requestHint(label)` once.
- Add `autoHintedRef` reset on session start.
- Label hint blocks "Tutor hint" or "Pack hint".
- Move correction buttons under a "Was this fair?" disclosure.
- Keep the answer side, working block and record link.
- Add `.study-*` CSS and a phone breakpoint.

Verification: typecheck, lint, built-output test, external lane.

## Phase 4: tests and rehearsal

Files: `v1/tests/study-experience.test.ts`,
`v1/tests/simulate-study-experience.test.ts` (new),
`v1/tests/simulate-browser.test.ts` (only if an existing promise needs the new
strings).

- Unit test the pure view helpers and the automatic-hint decision.
- Rehearsal:
  - seed two packs
  - plan one pack and assert the card set
  - answer a card and assert the outcome; the listen helper's instruction stays
    free of the card summary
  - ask for a hint and assert the source
  - check the built study chunk contains the new labels and instructions
- Keep the existing full suite green.

Verification: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.

## Phase 5: external lane

- Build the static app.
- Start the static server and a fake provider.
- Use Edge via CDP with a fresh profile.
- Seed the Polish pack.
- Choose the pack in Study; assert the plan scope.
- Start and assert no answer text is visible before Answer.
- Find a hear_type card; assert the line is absent and only one play control.
- Turn the tutor on; submit a wrong answer; assert "Tutor hint".
- Check the answer/translation layout.
- Check phone width for no horizontal overflow.
- Clean up all background processes.

## Phase 6: docs and landing

- Update the PRD/IMPL status and record deviations.
- Write `simulate-post.md` with the canonical rehearsal.
- Update `.reports/goal-overhaul.md`.
- Commit with the `spanexx` identity using a message file.
- Land on `main` with a fast-forward or clean squash; push.
- Do not amend. Do not force-push.

## Run order

```text
npm run typecheck
npm run lint
npm run build
npm test
```
## Implementation record

Implemented on 2026-10-23 in the `feature/study-experience` worktree.

- `v1/src/lib/client/study-view.ts` holds the neutral labels, the listen
  prompt choice and the auto-hint decision.
- `planAnswer` accepts pack and deck filters; the route reads them from the
  query and validates the pack and deck.
- `StudyClient` owns the scope selects, one play control for listening cards,
  the automatic hint, the source label, the progress bar and the reveal.
- `Side` now joins separate text parts with a space and gives translations
  their own block, fixing the run-together answer.
- The reveal keeps corrections behind "Was this fair?" and the record link is
  secondary.
- `globals.css` carries the `.study-*` styles, a soft gradient, a short reveal
  animation, a reduced-motion fallback and a phone breakpoint.

Verification:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm test` passed: 41 files, 432 tests.
- External Edge lane passed: provider setup, two pack imports, pack scope,
  no answer before submission, one listen control, one automatic tutor hint,
  answer/translation layout, phone width.
- Services were cleaned up after the lane.

Deviation: the plan line uses the actual planned card count, not the requested
offer count, so a one-card scope reads "1 card" even when the offer field is
still 20.
