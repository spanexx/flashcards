# IMPL: Learner interface

**Slug:** learner-interface
**Status:** Approved under delegated authority, 2026-10-24
**Date:** 2026-10-24

## Phase Plan

**Before Phase 1:** no new external dependency, so no `opensrc` pass is needed.

### Phase 1: language catalog and shared picker

**Build:**
- `v1/src/lib/shared/language.ts`: grow the catalog from 29 to the 73 names in
  the pre-simulation; derive aliases from names; keep unknown values.
- `v1/src/app/library/LanguageField.tsx`: one label, select and optional
  "Other language" text input. Preserve region and unknown values.
- `v1/tests/language.test.ts`: count, sorting, every name round-trips, new
  samples.

**Verify:**
- [x] `npm test -- tests/language.test.ts` passes.
- [x] The 73 names match the pre-simulation.
- [x] `languageName("fil")` is "Filipino"; `normalizeLanguage("Zulu")` is "zu".
- [x] An unknown value still round-trips as its stable lowercased value.

**Blocked by:** nothing

### Phase 2: use the picker everywhere

**Build:**
- `v1/src/app/library/CreationBriefFields.tsx`: replace both datalists.
- `v1/src/app/library/CreatePanel.tsx`: replace the Write pack datalist and
  move the Write pack fields into a two-column `form-grid`.
- `v1/src/app/library/PackEditor.tsx`: replace both datalists.

**Verify:**
- [x] Write pack shows a closed language name and a chevron.
- [x] Generate, Chat and the pack editor use the same control.
- [x] Choosing "Other language" reveals a text field and saves the typed value.
- [x] A pack with `en-US` or an unknown value keeps its value when opened.
- [x] `npm run typecheck` passes.

**Blocked by:** Phase 1

### Phase 3: listening is dictation

**Build:**
- `v1/src/app/StudyClient.tsx`: remove `showListeningText`, its resets and the
  "Show the text" block. Keep one play control and a neutral post-answer note.
- `v1/src/app/globals.css`: remove the pre-answer transcript style.
- `v1/tests/simulate-language-prompt-control.test.ts`: remove the old built-word
  expectations and assert the post-answer line instead.
- `v1/tests/study-experience.test.ts`: keep the no-leak listening assertions.

**Verify:**
- [x] The pre-answer listening card has one play control and no transcript.
- [x] Answering reveals the line in the Answer block.
- [x] `npm test -- tests/study-experience.test.ts tests/simulate-language-prompt-control.test.ts`
      passes.
- [x] `grep` finds no "Show the text" or "reading check" in `v1/src`.

**Blocked by:** nothing; can run beside Phase 1

### Phase 4: wide shell, controls, library rail

**Build:**
- `v1/src/app/globals.css`: 240px sidebar, 1420px content, larger headings and
  cards, one field/select/textarea/button family, select chevron, `.form-grid`,
  `.library-layout`, `.rail`, `.stat-grid`, `.stat`.
- `v1/src/app/library/LibraryClient.tsx`: wrap Packs/Cards in a library layout
  with a real side rail; compute cards, packs, languages and decks from the
  loaded data; add "Start in Create" and "Study a pack".
- `v1/src/app/library/PacksPanel.tsx`: keep the existing pack rows; the wider
  row treatment lives in `globals.css`.
- `v1/src/app/library/CardsPanel.tsx`: keep the existing card list; the wider
  list treatment lives in `globals.css`.
- `v1/src/app/library/CreatePanel.tsx`: make the side note a rail card.

**Verify:**
- [x] At 1440px the sidebar is 240px and the content uses the remaining width,
      staying within the 1420px cap.
- [x] Library shows four real counts and the rail sits beside the main column.
- [x] Create shows a two-column Write pack form.
- [x] At 390px the rails move below and scrollWidth is 390.
- [x] `npm run typecheck` and `npm run lint` pass.

**Blocked by:** Phase 2 for the Write form grid

### Phase 5: session rail and full-screen stage

**Build:**
- `v1/src/app/StudyClient.tsx`: wrap the running card in a stage and a session
  rail; add `answered` and `fullStage`; add enter/exit helpers, Escape,
  `fullscreenchange`, body class cleanup and phase exit; keep full screen across
  Next card.
- `v1/src/app/globals.css`: `.study-layout`, `.study-stage`, `.stage-full`,
  `.study-rail`, media containment at 62vh, phone stacking, reduced motion.
- Tests: built-word assertions for "Full screen", "Exit full screen" and the
  session rail labels.

**Verify:**
- [x] "Full screen" enters the stage; "Exit full screen" and Escape leave.
- [x] The card state survives Next card while full screen.
- [x] Ending or stopping the session removes full screen and the body class.
- [x] The rail shows the offer, answered, left, hints and tutor state.
- [x] The CSS contains both image and video elements at up to 62vh.
- [x] `npm run typecheck` passes.

**Blocked by:** Phase 3 for the listening card start

### Phase 6: full verification and docs truth

**Build:**
- `docs/features/language-prompt-control/GRILL-language-prompt-control.txt`:
  mark Q4 superseded by this pack.
- `docs/features/language-prompt-control/PRD-TRD-language-prompt-control.md`:
  mark the pre-answer fallback superseded, with a pointer to this pack.
- `docs/features/learner-interface/simulate-post.md`: real browser steps,
  screenshot names and the comparison with the pre-simulation.
- `.reports/goal-learner-interface.md`: final iteration.

**Verify:**
- [x] `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` pass.
- [x] Built Study page has the new words and no "Show the text".
- [x] Browser run at 1440x900 and 390x844 matches the PRD scenarios.
- [x] Screenshots of Study, full-screen Study, Library and Create are captured.
- [x] The learner signed off the screenshots on 2026-10-24 before commit or PR.

**Blocked by:** Phases 1–5

## Phase Dependencies

```text
1 catalog ──> 2 use picker ──> 4 wide forms
3 listening ────────────────> 5 session/full screen
1,2,3,4,5 ─────────────────> 6 verification
```

## Test Strategy

- Unit: `v1/tests/language.test.ts` for the catalog and normalization.
- Unit: `v1/tests/study-experience.test.ts` for listening labels and hints.
- Build-output: `v1/tests/simulate-language-prompt-control.test.ts` and
  `v1/tests/simulate-study-experience.test.ts` read `out/` and assert the words
  the client ships.
- Browser: manual Edge run against the static build at 1440x900 and 390x844;
  check layout metrics with CDP, then screenshot. No new test dependency.
- Full gate: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.

## Dependency Analysis (opensrc)

No new external dependency. The pack uses the existing Next.js, React, Zod,
semver and Vitest stack.

## Rollout

No migration and no flag. The change ships in the existing static browser app.
Old packs keep their stored values; the new picker displays them. The listening
change applies to every `hear_type` card immediately. Full screen is local to
the running card and never persisted.

## Risk Notes

- **Fullscreen API:** request must happen inside the click gesture. Set the CSS
  stage first so a refusal still leaves a usable focused view.
- **Body class leak:** remove `full-stage` on unmount and whenever the phase
  leaves `running`.
- **Native select length:** 73 options are acceptable but long on phone; do not
  replace the native control without a new dependency decision.
- **Language value drift:** the picker must not normalize a region code down to
  its base when the learner only opens and closes it.
- **Visual scope:** the CSS changes touch every screen. Capture Study, Library
  and Create before asking for sign-off, not only one page.
- **Old docs:** the pre-answer listening fallback is deliberately reversed.
  Update the old feature docs in the same change so the next agent does not
  restore it.

## Delivery note 2026-10-25: Study tab redesign

The plan rail and the session rail described above were removed by the
`study-tab-redesign` pack, which keeps this pack's full-screen mechanism (stage
ref, CSS fallback, Escape, next-card) and its listening and picker rules
unchanged. The Study column is now 860px for the plan and 720px for the card.
See `docs/features/study-tab-redesign/`.

Verification: typecheck, lint, 46 test files / 479 tests, static build, and a
browser pass at 1440x900 and 390x844 with no horizontal overflow.
