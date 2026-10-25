# IMPL: Study tab redesign

**Slug:** study-tab-redesign
**Status:** In progress
**Date:** 2026-10-25
**Contract:** `PRD-TRD-study-tab-redesign.md`

## Order and gates

Each phase ends with its named test or a typecheck. The full gate is
`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` from `v1/`,
then a browser pass at 1440x900 and 390x844.

## Phase 1: Layout helpers (TDD)

**Files:** `v1/src/lib/client/study-layout.ts` (new),
`v1/tests/study-layout.test.ts` (new)

- `planHeadline(count)` — `1 card is laid out.` / `N cards are laid out.`
- `planLede(scopeText)` — `From <scope>. It's an offer — stop whenever you
  like.`
- `pipStates(index, total)` — `done` before the current card, `now` on it,
  `future` after it; empty for no cards; clamp an over-run index to the last
  pip.
- Tests first, then the minimal helper.

Verification: `npx vitest run tests/study-layout.test.ts`.

## Phase 2: Split the screen into modules

**Files:** `v1/src/app/study/ScopePicker.tsx`, `StudyPlan.tsx`,
`StudySession.tsx`, `StudyCard.tsx`, `CardSide.tsx` (new);
`v1/src/app/StudyClient.tsx`

- Move `Side` to `CardSide`; move the scope picker to `ScopePicker`.
- `StudyPlan` receives the plan, scope, offer, tutor approval and handlers.
- `StudySession` receives the head state, full-screen controls, the card
  children and an optional `aboveCard` element.
- `StudyCard` receives the card, answers, hint state, result, working copy and
  handlers.
- `StudyClient` keeps every state transition, request and effect. No behaviour
  moves.

Verification: `npm run typecheck`.

## Phase 3: Plan screen

- Replace the plan grid and rail with the single column in the simulation.
- Headline, lede, facts, scope row, Start session and the calm line.
- Keep the three disclosures; `Why these cards` keeps the group reasons and
  counts.
- Keep the empty, error and done phases working.

Verification: typecheck plus a browser pass on the plan.

## Phase 4: Running card and reveal

- Head: `Card n of N`, pips with a progressbar role, `Full screen`, `End`.
- Pre-answer: mode label, hint link, serif prompt with inline blanks, helper,
  Enter to check, primary Answer.
- Reveal: outcome badge, marked prompt, answer block, region lines, fair
  disclosure, working block, record link, Next / Finish.
- Remove the answered and hints-used rail state; nothing else reads it.

Verification: typecheck; browser pass on cloze, type, hear_type and picks.

## Phase 5: Teaching seam

- Give `StudySession` one optional `aboveCard` element.
- Render it between the head and the card; render nothing when absent.
- Comment it as the teaching-layers seam (GRILL entries 3 and 13).

Verification: the card with no layer is pixel-identical to Phase 4.

## Phase 6: Docs and gates

- Amend `docs/features/learner-interface/PRD-TRD-learner-interface.md` Scenario
  3 and Scenario 5 to the single-column Study screens.
- Amend `docs/features/study-experience/PRD-TRD-study-experience.md` sections
  3.2 and 3.6 (quiet mode label, position pips).
- Add delivery notes to both IMPLs.
- Update the built-screen assertion in `simulate-study-experience.test.ts`.
- Run typecheck, lint, the full suite and the build.
- Browser pass at 1440x900 and 390x844; no horizontal overflow.

## Delivery note

Delivered on 2026-10-25 on branch `fix/study-tab-redesign` as commit `69cd77b`,
with both drift gates green.

- `study-layout.ts` holds the headline, lede and pip helpers; eight tests pin
  the copy and the first, middle, last, empty and over-run pip states.
- `StudyClient.tsx` keeps every state field, handler, effect and saved call,
  and now composes `StudyPlan`, `StudySession` and `StudyCard`. The rail-only
  `answered` and `hintsUsed` state was removed.
- `StudySession` exposes `aboveCard` and renders nothing when it is absent;
  `StudyClient` passes no layer today.
- `StudyCard` owns the pre-answer card, hint block, reveal, working block and
  corrections. The duplicate summary line was removed from the reveal because
  the answer block already carries the full line.
- `globals.css` replaces both Study rails with one column, adds the serif
  display/prompt, facts, pips, card shadow, reveal and phone rules, and adds the
  `--soft`, `--serif`, `--shadow-card` and `--shadow-soft` tokens. The
  `study-select` 16px rule is unchanged.
- `simulate-study-experience.test.ts` now asserts the new plan shell, pips,
  start control and "No score kept"; `simulate-language-prompt-control.test.ts`
  expects "End the session" in place of the removed rail control.

Verification (WSL Debian):

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 46 files, 479 tests.
- Static export built and the PWA check passed. Turbopack could not resolve the
  `next` package through the worktree's symlinked `node_modules` on a Windows
  mount, so the verification build used `next build --webpack`; the produced
  files are the same static export.
- Browser pass at 1440x900: plan column 860px, card column 720px, no horizontal
  overflow, full-screen CSS fallback covers the viewport, exit restores the
  card.
- Browser pass at 390x844: plan, answer and reveal all stay at or under the
  viewport (`scrollWidth` 390 during plan and answer, 375 during reveal); pips
  wrap to their own row; card actions stack with the primary action on top.
- Cloze and type cards were checked live; the hear_type listening rule stays
  covered by `study-experience.test.ts` and the built "Play the line" label.
  The live reveal shows the marked prompt, answer, translation, region line and
  fair disclosure.
