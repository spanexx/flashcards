# IMPL: Creation control

**Slug:** creation-control
**Status:** Complete
**Date:** 2026-10-22
**Completed:** 2026-10-23

## Progress

- Phase 0 complete: the delegated GRILL is locked with a why and source for every decision, and `simulate-pre.html` shows all five PRD scenarios with hardcoded data.
- Phase 1 complete: shared brief, defaults, validation and inventory; prompt builders accept brief and inventory.
- Phase 2 complete: style-aware generation, type/hear_type cards, style refusal, and language pass-through.
- Phase 3 complete: router validates the brief, authors get brief and inventory, and the authoring skill is 3.0.0.
- Phase 4 complete: the Create screen is split into `CreationBriefFields`, `ChatPromptEditor` and `PlacementPicker`; Generate and Chat share the brief, and Chat copy/download use the edited prompt.
- Phase 5 complete: `npm run simulate:creation-control` walks the five promises through the real router, the external Edge lane passed against the static build, and the drift check found no unresolved gap.

## Verification Results

- `npm test`: 36 files, 400 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; static Library page and client chunks contain the brief and prompt editor.
- `npm run simulate:creation-control`: passed all five scenarios.
- `npm run simulate:create-flow`: passed.
- External Edge lane against `http://172.25.126.9:4175`: saved a provider profile and key, put “ordering coffee” and `cloze` into the prepared prompt, refused a provider batch that returned `type`, and downloaded an edited Chat prompt whose edit survived.
- Drift check: the design simulation and built behavior agree on subject mode, sequence names, the editable prompt, style refusal, and the empty-container path. No unresolved drift.

## Phase Plan

### Phase 0: Design record and design simulation

**Build:**
- Keep the delegated decisions in `GRILL-creation-control.txt`.
- Add `simulate-pre.html` showing the brief, provider-choice mode, editable chat prompt, and style choices with placeholder data.
- Record that the user delegated design approval and asked not to be stopped for it.

**Verify:**
- The GRILL says `Status: Locked`, has a why and source for every decision, and ends with no open questions.
- The design simulation opens locally and contains all five scenarios from the PRD's simulation contract.

**Blocked by:** nothing

### Phase 1: Shared brief and prompt builders

**Build:**
- Add `v1/src/lib/shared/creation.ts` for `CardStyle`, `CreationBrief`, defaults, and validation.
- Extend `v1/src/lib/provider/prompt.ts` so pack, deck, and cards builders accept the brief and library inventory.
- Keep the prompt free of cards, evidence, settings, and the key.
- Add focused tests in `v1/tests/provider-prompt.test.ts` and a new `v1/tests/creation-brief.test.ts`.

**Verify:**
- `npx vitest run tests/provider-prompt.test.ts tests/creation-brief.test.ts` passes.
- A learner subject appears verbatim in all three generation prompts.
- Provider-choice mode names existing packs/decks and asks for a gap.
- A requested name appears; a blank name still lets the provider choose.

**Blocked by:** Phase 0

### Phase 2: Generated card styles

**Build:**
- Add `style` to the generated line schema and turn cloze, type, and hear-type lines into the existing card parts and answer modes.
- Carry the requested styles and pack language through `prepare.ts` and `browser/provider.ts`.
- Refuse a batch that ignores a specific requested style or lacks a translation for a type card.
- Extend `v1/tests/provider-flow.test.ts` and `v1/tests/provider-prompt.test.ts`.

**Verify:**
- `npx vitest run tests/provider-flow.test.ts tests/provider-prompt.test.ts` passes.
- Cloze, type, and hear-type cards render the expected prompt and answer shapes.
- One wrong style refuses the whole batch and saves nothing.

**Blocked by:** Phase 1

### Phase 3: Authoring context and router contract

**Build:**
- Extend `buildAuthoringPrompt` to accept the brief and a library inventory of pack names, descriptions, and deck names.
- Include the brief and inventory in pack, deck, and cards prompts.
- Pass the brief through `/api/authoring/prompt`; validate it in the router.
- Extend `v1/tests/browser-authoring.test.ts` and `v1/tests/browser-router.test.ts`.

**Verify:**
- `npx vitest run tests/browser-authoring.test.ts tests/browser-router.test.ts` passes.
- Chat prompts name existing packs/decks and the learner's subject.
- A missing subject in learner mode is refused.

**Blocked by:** Phase 2

### Phase 4: Create screen and editable Chat prompt

**Build:**
- Split the new brief fields, placement picker, and prompt editor into focused modules instead of growing `CreatePanel.tsx` into a larger monolith.
- Add subject mode, subject, deck focus, card style, and optional name fields for the matching targets.
- Prefill Deck/Cards subjects from the selected container.
- Render the Chat prompt in an editable textarea with Rebuild, Copy, and Download actions; copy/download use the edited text.
- Keep Write, Generate, Chat, and Import on the existing routes and after-create destinations.
- Add styles for the new fields and prompt editor, including phone widths.

**Verify:**
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- The built app shows the brief on Generate and Chat, disables Prepare on an empty learner subject, and keeps an edited chat prompt.
- Writing a pack/deck and then choosing Generate/Chat with it selected works without a second creation path.

**Blocked by:** Phase 3

### Phase 5: Simulations, drift, and full checks

**Build:**
- Add a post-implementation simulation test/script that exercises the PRD's five scenarios without a browser.
- Run an external browser lane against the static build for the brief, editable prompt, and style refusal.
- Compare the design simulation with the built behavior and record any drift.
- Collapse to one canonical simulation and update this IMPL with real results.

**Verify:**
- `npm run simulate:creation-control` passes.
- Full `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run simulate:create-flow` pass.
- The external browser lane passes with no console or page errors.
- The drift check has no unresolved gap.

**Blocked by:** Phase 4

## Dependencies

```text
Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5
```

## Test Strategy

- Pure prompt and style tests with Vitest.
- Memory-store/router tests for brief validation and inventory.
- Static build checks for no browser-only imports in prompt code.
- External Playwright lane for the actual screen; Playwright stays outside the bundle.
- Full suite once at the end, not after every edit.

## Risk Notes

- Existing generated prompts are copied by tests; update the expected shape deliberately.
- Type and hear-type cards already exist in the card model, so do not invent a parallel mode.
- Chat editing is a request edit, not a validation bypass.
- The library inventory must never include card text, evidence, settings, or the key.
- Do not add a runtime dependency.
