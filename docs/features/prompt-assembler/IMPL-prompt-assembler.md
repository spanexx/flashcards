# IMPL: Prompt assembler & mode meta-skill

**Slug:** `prompt-assembler`
**Status:** Locked by delegated decision, 2026-11-23
**Date:** 2026-11-23
**Origin:** `docs/features/prompt-assembler/GRILL-prompt-assembler.txt`
**Contract:** `docs/features/prompt-assembler/PRD-TRD-prompt-assembler.md`

## Phase order

0. Map the current seams; no edits.
1. Write the three origin docs.
2. Build the shared layer with TDD.
3. Refactor the generation lane onto the shared layer.
4. Refactor the chat lane onto the shared layer.
5. Add the brief-to-inputs adapter cases.
6. Add the AI mode draft module and the two additive routes.
7. Run all gates, clean up, commit on `feature/prompt-assembler` only.

A phase starts only after the targeted proof of the phase above is green.
After every edit to a shared file (`prompt.ts`, `authoring.ts`, `router.ts`,
`prepare.ts`) run `npx tsc --noEmit` immediately, before any other action.

## Phase 0 — map, no edits

**Read:** `provider/prompt.ts`, `browser/authoring.ts`, `shared/creation.ts`,
`provider/generate.ts`, `browser/provider.ts`, `browser/router.ts`,
`core/page-draft.ts`, `browser/page-draft.ts`, `provider/prepare.ts` and every
test named in PLAN.md §5. Record the map in a scratch note outside the repo.

**Proof:** none; no repository file changes.

## Phase 1 — origin docs

**Files:** `docs/features/prompt-assembler/GRILL-prompt-assembler.txt`,
`PRD-TRD-prompt-assembler.md`, `IMPL-prompt-assembler.md`.

**Proof:** all three exist, GRILL status Locked with no open questions.

## Phase 2 — the shared layer, TDD

**Files:** `v1/src/lib/shared/prompt-layers.ts` (new),
`v1/tests/prompt-assembler.test.ts` (new).

- Red first: exact layer strings and ordering, once-only for each universal
  rule, no mode text in layers 1 or 2, no Node-only imports, adapter mapping.
- Then implement the pure module and the version alias.

**Proof:** `npx vitest run tests/prompt-assembler.test.ts` and
`npx tsc --noEmit`.

## Phase 3 — the generation lane

**Files:** `v1/src/lib/provider/prompt.ts`, `v1/tests/provider-prompt.test.ts`.

- Import shared strings; remove private copies.
- Add optional `mode?` and `inputs?` to `GenerationPromptContext`.
- Inject the mode section once after universal rules and before the output
  contract in pack, deck and cards builders. Keep the D-28 append.

**Proof:** `npx vitest run tests/provider-prompt.test.ts` and
`npx tsc --noEmit` immediately after the shared-file edit.

## Phase 4 — the chat lane

**Files:** `v1/src/lib/browser/authoring.ts`, `v1/tests/browser-authoring.test.ts`,
`v1/tests/simulate-study-card-clarity.test.ts`.

- Import the same strings; delete the duplicated copies.
- Add optional `mode?` and `inputs?` to `AuthoringContext`; alias the version.
- Inject the mode section at the three insertion points.
- Update the two hard-coded version assertions.

**Proof:** targeted vitest on the two test files and `npx tsc --noEmit`.

## Phase 5 — the adapter

**Files:** `v1/tests/creation-brief.test.ts` (adapter cases),
`v1/src/lib/shared/prompt-layers.ts` if the red test needs refinement.

- `promptInputsFromBrief` maps subject, target language, question language,
  library summary, custom focus, card mix, level, learning style and count.
- No change to `CreationBrief` defaults or validation; existing callers compile
  unchanged.

**Proof:** `npx vitest run tests/creation-brief.test.ts` and `npx tsc --noEmit`.

## Phase 6 — AI mode draft

**Files:** `v1/src/lib/browser/mode-draft.ts` (new),
`v1/src/lib/provider/prepare.ts` (one union member),
`v1/src/lib/browser/router.ts` (two additive routes),
`v1/tests/browser-router.test.ts` (draft cases).

- Meta-skill prompt with its own version; demands JSON only and describes the
  LearningMode shape.
- Prepare holds the prompt; send takes it once, calls the provider, logs the
  prompt, forces server-owned fields, validates with `readLearningMode`, and
  returns the mode without saving it.

**Proof:** router/browser targeted vitest and `npx tsc --noEmit` immediately
after each edit to `router.ts`.

## Phase 7 — gates and commit

1. `npm run build` first, because the simulation tests read `out/`.
2. Full `npx vitest run`; compare the total with the base run.
3. `npx tsc --noEmit`.
4. `npx eslint` on every changed file.
5. `npm run check:drift` and `npm run check:drift:staged`.
6. Stage path by path, read `git diff --cached`, and commit with `git commit -F`.
   Do not push, open a PR, merge, or run `git config core.hooksPath`.
7. Delete `out/`, `.next/`, logs and scratch files; confirm `git status`.

## Delivery note — 2026-11-23

- The shared style rule first carried only the generation voice. The chat lane
  imported it and began teaching `style` on cards, which have `answerDef.mode`
  instead. Added a `card` voice to `cardStyleRuleLines`, passed it from
  `briefSection`, and pinned both lane vocabularies in
  `browser-authoring.test.ts` and `provider-prompt.test.ts`.
- Verification: targeted `npx vitest run` on both test files (62 passing),
  `npm run typecheck` clean, and a scratch comparison of the chat style lines
  against `feature/learning-mode-core` across three styles and two language
  pairs — byte-identical in all six cases. The scratch files were deleted.
- A full-prompt comparison found the self-contained and teaching wordings were
  merged as GRILL Q8 asked. `PLAN.md` §7 and PRD-TRD §2.2 had called a no-mode
  prompt unchanged; both now say "adds no mode text." Doc-only, no behavior
  change.

## Delivery note — 2026-11-23 (post-impl review gap)

- The fresh-eyes review found that a pack-owned cards template without the
  output-contract line got mode text between the template and the universal
  rules the app appends. Moved the seam after the append, so every lane puts
  mode after the universal rules. PRD-TRD §4.2 now describes the shipped order.
- Verified by a new contract-less-template pin in `provider-prompt.test.ts`
  (RED before the move, GREEN after) and the existing mode-seam tests.

## Out of scope

Everything in PRD-TRD §5. In particular: no Track 1 file, no mode content, no
UI, no provider schema change, no Drift entry, no new dependency.

## Risks and how they are handled

- **Prompt duplication returns.** Every universal rule gets a count assertion;
  the shared module is the only string source.
- **The chat example parser breaks.** The mode section is injected before the
  output contract, never after the example JSON.
- **A held mode draft is mistaken for a page draft.** `PreparedRequest.kind`
  gains its own value, and send checks it before doing anything.
- **An AI answer tries to create a built-in or a backdated mode.** The send
  path forces `isBuiltIn: false` and a fresh ISO `createdAt` before validation.
- **A half-edited shared file is committed.** A typecheck runs immediately
  after every shared-file edit, and the staged drift gate runs before commit.

## Open Drift — 2026-11-23

- **D-52 Resolved.** Runtime generation and chat routes now resolve
  `brief.modeId` through `browser/mode-prompt.ts`; a missing mode adds no layer
  3. **D-53 Resolved.** `PromptInputs` is documented as a reserved seam.
  Evidence is in `docs/drift.md`.
