# IMPL: Library Create flow

**Slug:** library-create-flow
**Status:** Complete
**Date:** 2026-10-22

## Phase Plan

**Before Phase 1:** no new external dependency, so no `opensrc` pass is needed.

### Phase 0: Worktree dependency baseline — Complete 2026-10-21

**Build:**
- Run `npm ci` inside `v1/` in the feature worktree under WSL Debian.
- Do not symlink or copy the Windows-native `node_modules` from the main checkout.
- Record the install result in this file if it deviates from the lockfile.

**Verify:**
- [x] `npm test` passes from the worktree.
- [x] `npm run typecheck` passes from the worktree.
- [x] `npm run lint` passes from the worktree.

**Blocked by:** nothing

### Phase 1: Domain rules for targets and deletion — Complete 2026-10-22

**Build:**
- Extend the target and fragment validation in `v1/src/lib/browser/bundle.ts` to satisfy `PRD-TRD-library-create-flow.md` -> Target shapes.
- Add generated-name suffix helpers for pack names and deck name/id pairs.
- Add `deletePack` and `deleteDeck` to `v1/src/lib/browser/repository.ts`, including the last-deck refusal and evidence cleanup.
- Add focused tests in `v1/tests/browser-bundle.test.ts` and `v1/tests/browser-repository.test.ts`.

**Verify:**
- [x] `npm test -- tests/browser-bundle.test.ts tests/browser-repository.test.ts` passes.
- [x] A mismatched target shape writes nothing.
- [x] Deleting a deck removes its cards and evidence, and refuses the last deck.
- [x] Deleting a pack removes its containers and cards but leaves prompt history.

**Blocked by:** Phase 0

### Phase 2: Local API routes — Complete 2026-10-22

**Build:**
- Add deck-create and pack/deck-delete routes in `v1/src/lib/browser/router.ts` per `PRD-TRD-library-create-flow.md` -> API Contracts.
- Pass the `namePolicy` option through the import route.
- Extend `v1/tests/browser-router.test.ts` for the new routes and refusals.

**Verify:**
- [x] `npm test -- tests/browser-router.test.ts` passes.
- [x] Delete routes return the counts the UI needs.
- [x] Import with `namePolicy: "auto-suffix"` changes only generated names.

**Blocked by:** Phase 1

### Phase 3: Authoring prompts and provider generation — Complete 2026-10-22

**Build:**
- Change `v1/src/lib/browser/authoring.ts` to the Pack/Deck/Cards targets with no learner name field.
- Extend `v1/src/lib/browser/provider.ts` to prepare and generate Pack, Deck, and Cards results through the same validator.
- Update `v1/tests/browser-authoring.test.ts`, `v1/tests/provider-flow.test.ts`, and `v1/tests/provider-prompt.test.ts`.

**Verify:**
- [x] `npm test -- tests/browser-authoring.test.ts tests/provider-flow.test.ts tests/provider-prompt.test.ts` passes.
- [x] A fake provider response with one bad item saves nothing.
- [x] Generated pack/deck collisions get the expected suffix.
- [x] Chat prompts choose their own names and include the chosen parent only where needed.

**Blocked by:** Phase 2

### Phase 4: Library shell and Packs panel — Complete 2026-10-22

**Build:**
- Split `v1/src/app/library/LibraryClient.tsx` into a shell plus `PacksPanel.tsx`, `CardsPanel.tsx`, and `CreatePanel.tsx`.
- Add `DeleteDialog.tsx` for the typed-name confirmation.
- Build Packs search, expansion, deck counts, Add cards shortcut, Delete deck, and Delete pack.
- Keep Export, Refresh, and the evidence drawer working.
- Add the small styles needed for expandable pack rows and the delete dialog.

**Verify:**
- [x] `npm run typecheck` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] A browser click-through expands a pack, opens the delete dialog, and refuses the last deck.

**Blocked by:** Phase 3

### Phase 5: Create panel — Complete 2026-10-22

**Build:**
- Build the target-first Create panel: Pack/Deck/Cards, then Write/Generate/Chat/Import.
- Wire Write, Generate, Chat, and Import to the Phase 2/3 routes.
- Implement provider readiness messages, draft preservation, all-or-nothing errors, and after-create navigation.
- Pass the Cards filter and preselect state from Packs -> Add cards.

**Verify:**
- [x] `npm run typecheck` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] Create -> Pack and Create -> Deck open Packs expanded.
- [x] Create -> Cards opens Cards filtered to the created pack and deck.
- [x] A missing provider key keeps the draft and shows the Settings path.

**Blocked by:** Phase 4

### Phase 6: Cards panel — Complete 2026-10-22

**Build:**
- Move the existing card list, search, edit, delete, retired cards, and records into `CardsPanel.tsx`.
- Remove the old add-card and import forms from Cards.
- Add the pack/deck filter used after Create -> Cards.

**Verify:**
- [x] `npm run typecheck` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] Cards has no creation form and still edits/deletes/opens records.

**Blocked by:** Phase 5

### Phase 7: Post-implementation simulation and full checks — Complete 2026-10-22

**Build:**
- Add `v1/tests/simulate-create-flow.test.ts` and `v1/scripts/simulate-create-flow.mjs`.
- Add the `simulate:create-flow` package script.
- Run the post-implementation simulation against the real router and memory store, with a different script from the pre-implementation HTML.
- Reconcile the simulation with the PRD contract and record any variance.

**Verify:**
- [x] `npm run simulate:create-flow` passes.
- [x] `npm run build` passes.
- [x] `npm run lint` passes.
- [x] `npm test` passes in full.
- [x] The external Playwright browser lane covers the three tabs, target-first methods, typed delete, and after-create destination.
- [x] Evidence and prompt history checks match the PRD.

**Blocked by:** Phase 6

## Execution Log

**2026-10-22**
- Final full run after the insecure-context id fix: `npm run lint` passed; `npm test` passed 358 tests in 34 files.
- `npm run build` passed; `npm run simulate:create-flow` passed.
- External Playwright lane passed 12 steps on the static build, including the three tabs, target-first methods, typed deletes, Record/Edit/Delete, and after-create destinations. No console, page, or request errors.
- Fixed two post-implementation browser bugs: deleting a deck collapsed its pack, and `crypto.randomUUID` was unavailable on plain HTTP. Both fixes have automated coverage.
- Contract variances: none. The post-implementation simulation matches the PRD target shapes, validation, collision, deletion, evidence, prompt-history, and navigation rules.
- The live provider-key success path remains unverified; all generation checks use the fake provider.

## Phase Dependencies

```text
Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7
```

Phases 4-6 touch the same screen; do not parallelize them in one worktree.

## Test Strategy

- **Domain and router:** Vitest against `MemoryStore` and the real local router. Add cases in `v1/tests/browser-bundle.test.ts`, `browser-repository.test.ts`, `browser-router.test.ts`, `browser-authoring.test.ts`, and `provider-flow.test.ts`.
- **Fake provider:** use the existing provider test harness; never depend on a real key.
- **Post-implementation simulation:** `v1/tests/simulate-create-flow.test.ts`, run through `npm run simulate:create-flow`.
- **Browser:** the existing external Playwright lane, pointed at the static build, for tabs, target selection, delete confirmation, and navigation. Do not add Playwright to `package.json`; it stays outside the bundle.
- **Commands:** targeted Vitest first, then `npm run typecheck`, `npm run lint`, `npm run build`, and the full `npm test` once at the end.

## Dependency Analysis (opensrc)

No new external dependencies. The feature uses the existing Next.js, React, Zod, semver, and Vitest stack.

## Rollout

No data migration. Existing packs, cards, evidence, prompts, settings, and backups
stay readable. The bundle export format is unchanged. New target fragments are
accepted only on the import path, and existing full bundles continue to work.
The feature ships in the browser build; the static export and IndexedDB store
remain the deployment shape.

## Risk Notes

- The worktree has no `node_modules`; install Linux dependencies there. Windows
  native modules from the main checkout will fail under WSL.
- Pack names are stored slugs. Generated names must satisfy the existing bundle
  rule; do not add spaces to stored pack ids.
- Deck import and Pack import share a validator but not a shape. A shape leak
  would let a mismatch write something; test refusal paths first.
- Deletion spans packs, cards, and evidence. Use the serial write queue and test
  the counts the UI reports.
- The provider success path with a real key is still unverified. Use the fake
  provider for deterministic checks and keep the real-key check separate.
- Static export prefetch was already fixed with `prefetch={false}`. Do not
  reintroduce RSC prefetch links while editing Library screens.
