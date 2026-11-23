# PRD-TRD: Prompt assembler & mode meta-skill

**Slug:** `prompt-assembler`
**Status:** Locked by delegated decision, 2026-11-23
**Date:** 2026-11-23
**Origin:** `docs/features/prompt-assembler/GRILL-prompt-assembler.txt`
**Track:** 2 of 4. Track 1 shipped the LearningMode contract, Track 3 owns the
five built-in definitions, Track 4 owns Mode Studio. This track consumes the
contract; it writes no mode content and no UI.

## 1. Why this exists

Two prompt lanes — provider generation and the chat authoring skill — currently
repeat the same rules in their own files. The self-contained rule, the teaching
rules, the style rules and the example line each have two copies. A change to
one copy silently leaves the other behind, and the two lanes start teaching
different card rules. There is also no way to put a learning mode's authored
skill text into a prompt: the entity exists (Track 1) but nothing reads it.

This pack replaces the duplication with three composable layers. Layer 1 is the
system text and the output contract. Layer 2 is the universal card rules. Layer
3 is the selected mode, injected once. Both lanes build their prompts from the
same shared module. It also adds the AI draft meta-skill so Mode Studio can
later offer "Draft with AI" without this track owning a screen.

## 2. What it does

### 2.1 One shared source for the rule text

- A pure browser-safe module owns layer 1, layer 2, `assemblePrompt`, the
  `PromptInputs` and `ModePromptContribution` types, the shared example line,
  and one prompt version.
- The generation lane and the chat lane import those strings. Neither keeps a
  private copy of a rule the other also teaches.
- The version is one constant, aliased under the chat lane's existing public
  name so current callers keep compiling. It moves from 8.0.0 to 9.0.0.

### 2.2 A mode changes only layer 3

- A mode contributes two strings: its skill instructions and its canonical
  example. No other part of the mode entity enters a prompt.
- When a mode is supplied the lane adds one short section after the universal
  rules and before the output contract. Skill text appears once; the example
  is a compact note, not a second output shape.
- Selecting a different mode changes only that section. Supplying no mode, or
  an empty skill, leaves the prompt as it was before this pack.

### 2.3 The brief becomes prompt inputs through an adapter

- `promptInputsFromBrief` reads the already-validated brief and the profile
  slots into `PromptInputs`. It changes no default and no validation rule.
- The adapter is the only bridge: the shared layers never accept a whole
  `CreationBrief`.

### 2.4 AI mode drafts are prepared and sent, never saved

- A versioned meta-skill prompt asks for JSON only and describes the
  LearningMode shape. The learner sees the exact prompt before it leaves.
- `POST /api/modes/draft` returns `{ requestId, prompt, version }`.
  `POST /api/modes/draft/send` takes the held prompt once, calls the learner's
  provider, parses loosely, forces the server-owned fields, validates through
  the Track 1 reader and returns `{ mode }`.
- Nothing is written to the library by either route. The draft goes back to a
  screen that Track 4 owns.

## 3. Simulation contract

There is no operator screen in this track (GRILL Q11). The following scenes
are demonstrated by the named tests instead of a shell play; Track 4's
simulation must reproduce them through Mode Studio.

1. A pack prompt, a deck prompt, a cards prompt and all three chat prompts
   contain the mode's skill text exactly once and its example note exactly once.
2. Two different modes produce prompts that differ only in the mode section;
   layer 1 and layer 2 are byte-identical.
3. Every universal rule appears once per prompt, including the existing
   once-only teaching assertion; identical rule strings are the same constant.
4. No mode, or a mode with empty skill text, produces the same prompt the lanes
   produced before this pack.
5. The canonical examples used by the seam still pass the existing bundle
   schemas and validators; no provider schema widens.
6. `promptInputsFromBrief` maps a brief to every input field without mutating
   the brief or changing its defaults.
7. Draft prepare returns a versioned prompt and holds it once; draft send
   returns a validated LearningMode object and adds nothing to storage.
8. A second send of the same request id is refused because the held prompt is
   one-time; a malformed provider answer is refused with a plain message.

## 4. Technical design

### 4.1 `v1/src/lib/shared/prompt-layers.ts` (new)

- Pure and browser-safe: no `node:` import, no zod, no store, no AI answer.
- Exports `PROMPT_SKILL_VERSION`, `PromptInputs`, `ModePromptContribution`,
  `layerOneSystemAndContract(target)`, `universalCardRules(inputs)`,
  `modeSection(mode?)`, `assemblePrompt(layers)` and `promptInputsFromBrief`.
- Also exports the single-copy rule strings and the shared example line so
  both lanes import the same values.
- Layer 1 holds the system strings and the one `"Return JSON only, shaped
  like:"` contract line. Layer 2 holds the universal card rules. The mode
  section is rendered only by `modeSection`, never by layer 1 or 2.

### 4.2 `v1/src/lib/provider/prompt.ts`

- Imports all shared strings from `prompt-layers.ts`; re-exports the system and
  template constants its callers and tests already import.
- `GenerationPromptContext` gains optional `mode?` and `inputs?`.
- Pack, deck and cards builders receive the optional mode section; the D-28
  teaching append keeps its position and wording.
- The output contract and shape stay last, so the chat example-extraction
  helpers keep working.

### 4.3 `v1/src/lib/browser/authoring.ts`

- `AUTHORING_SKILL_VERSION` aliases the shared version.
- `AuthoringContext` gains optional `mode?` and `inputs?`.
- The duplicated self-contained, teaching, style and example-line text is
  removed; `commonRules` composes the imported strings into its existing
  bullet block, so the chat-only shape rules stay where they belong.
- The same mode section is inserted at the three existing points after the
  rules block and before each shape.

### 4.4 `v1/src/lib/provider/prepare.ts`

- `PreparedRequest.kind` gains `"mode"`. No other change; all current consumers
  use equality checks.

### 4.5 `v1/src/lib/browser/mode-draft.ts` (new)

- Follows `page-draft.ts`: a pure prompt builder and reader in the module, a
  held request, one provider call, one prompt-log row, no storage write.
- `MODE_DRAFT_VERSION = "1.0.0"` is separate from the prompt skill version.
- The reader uses `parseJsonLoose(...).value`, forces `isBuiltIn: false` and a
  fresh ISO `createdAt`, then calls `readLearningMode` (Track 1). A refusal is
  a plain sentence, never a stack trace.

### 4.6 `v1/src/lib/browser/router.ts`

- Two additive POST routes beside `/api/pages/draft*`; the Track 1 CRUD routes
  are not edited.
- No schema, store or provider request type widens.

### 4.7 Tests

- New `v1/tests/prompt-assembler.test.ts`: exact layer strings and ordering,
  once-only rules, mode isolation to layer 3, no Node imports in the shared
  module, adapter mapping.
- Extended `provider-prompt.test.ts`, `browser-authoring.test.ts`,
  `creation-brief.test.ts`, `simulate-study-card-clarity.test.ts` and
  `browser-router.test.ts`.

## 5. Non-goals

- No edit to Track 1 files: `shared/types.ts`, brief defaults and validation,
  `core/schema.ts`, `core/prompt-context.ts`, the modes store and repository,
  or the base `/api/modes` CRUD routes.
- No mode content, no `v1/modes/**`, no `make-seed.mjs` (Track 3).
- No UI under `v1/src/app/**` (Track 4).
- No provider schema change in `generate.ts`, no stage added.
- No Drift entry authored by this track.
- No simulation shell script; the contract above is proven by tests.

## 6. Acceptance evidence

- New and extended tests named in §4.7 are green, with the base count preserved
  or raised.
- `npx tsc --noEmit` clean; `npx eslint` clean on every changed file.
- `npm run build` green; full `npx vitest run` green.
- `npm run check:drift` and `npm run check:drift:staged` green.
- `git status` shows only intended work; no scratch file, log or process left.
