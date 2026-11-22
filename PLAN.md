# TRACK 2 — Prompt Assembler & Mode Meta-Skill (build SECOND, after Track 1)

Status: PLAN ONLY. Base: `feature/learning-mode-core`. Branch: `feature/prompt-assembler`.

## 1. Scope and non-goals

Replace the monolithic prompt text with three composable layers and add the AI-mode-draft meta-skill. Consume LearningMode from Track 1; write no mode content and no UI.

Non-goals: changing CreationBrief defaults/validation beyond Track 1's additive fields, widening provider schemas, editing mode definitions, building Mode Studio screens.

## 2. Current state (evidence from research)

- `buildPackGenerationPrompt` `v1/src/lib/provider/prompt.ts:402-448`; context type `:84-87` has only `brief?` and `inventory?`; universal tail `:431-439` (level line, deckId rule, `SELF_CONTAINED_PROMPT_RULE` `:239-240`, `teachingPromptLines()` `:246-252`, `generationWordLessonLines()` `:268-278`, `"Return JSON only, shaped like:"`, `packShape()` `:315-349`).
- `buildDeckGenerationPrompt` `:453-487` and `buildGenerationPrompt` `:91-140` need the same seam. The D-28 teaching append for pack-owned templates is at `:103-108` and must survive refactor.
- System strings: `DEFAULT_GENERATION_SYSTEM` `:45-46`, `STRUCTURED_SYSTEM` `:148-149`. Output contract: `:60-61`, `:437`, `:483`.
- Chat lane: `AUTHORING_SKILL_VERSION` `v1/src/lib/browser/authoring.ts:23-24`; header `:362`; `commonRules` `:62-90`; `authoringStyleLines` `:279-306`; router version returns `router.ts:1153-1174`.
- Duplication to eliminate: `exampleLine` `prompt.ts:209-232` vs `authoring.ts:39-60`; `teachingPromptLines` `prompt.ts:246-252` vs `commonRules` `authoring.ts:81-87`; self-contained rule `prompt.ts:239-240` vs `authoring.ts:75-78`; cardStyle rules `prompt.ts:372-399` vs `authoring.ts:279-306`.
- `STUDY_NOTE_RULE` is already shared from `creation.ts:17-18` into both lanes (`prompt.ts:20`, `authoring.ts:16`) — this is the pattern to follow.
- Provider schemas are strict `generate.ts:53-75`; stage enum limited to `story|spelling|forms` at `:46`; `chosenStyle` enforces line style `:92-105`.
- Page-draft precedent for AI draft: `core/page-draft.ts:70-91,93-138`, `browser/page-draft.ts:79-124`, `browser/provider/prepare.ts`.

## 3. Locked decisions

1. New pure browser-safe module `v1/src/lib/shared/prompt-layers.ts` owns layer 1 (system + output contract), layer 2 (universal card rules) and `assemblePrompt(...)`. Both lanes import it; no third copy.
2. Do NOT restructure `CreationBrief`. Track 1 added optional `modeId`/`cardMix`/`modePreferences`; add adapter `promptInputsFromBrief(brief, inventory, slots, count): PromptInputs` with fields subject, targetLanguage, questionLanguage, existingLibrarySummary, customFocus, cardMix, level, learningStyle, count.
3. Use local structural seam `ModePromptContribution { skillInstructions: string; canonicalExample: string }` — no full entity import. Add optional `mode?` and `inputs?` to `GenerationPromptContext` and `AuthoringContext`; all existing callers compile unchanged.
4. Inject mode skill exactly once, after universal rules and before `"Return JSON only, shaped like:"` in pack/deck/cards builders; mirror at `authoring.ts:383,410,427`.
5. One shared prompt version aliases `AUTHORING_SKILL_VERSION`; both lanes bump together. Update assertions at `browser-authoring.test.ts:92` and `simulate-study-card-clarity.test.ts:99`.
6. Track 2 owns the two AI-draft routes additively in `router.ts`: `POST /api/modes/draft` and `POST /api/modes/draft/send`, mirroring `/api/pages/draft*` `router.ts:918-937`. Send returns a draft, never saves.
7. No provider schemas widen; canonical examples must pass existing validators.

## 4. Proposed seams

- `prompt-layers.ts`: `layerOneSystemAndContract(target: "lines"|"pack"|"deck"): string`, `universalCardRules(inputs: PromptInputs): string[]`, `assemblePrompt(layers: { system; universal; mode?; inputs; shape }): BuiltPrompt`.
- `ModePromptContribution` and `PromptInputs` exported here; adapter lives in same module or `shared/prompt-inputs.ts`.
- Mode section rendered as skill text plus a short canonical-example note — not a second full `packShape`, to avoid competing shapes and once-only failures.

## 5. File ownership

**Own:** `shared/prompt-layers.ts` (new), optionally `shared/prompt-inputs.ts`, `provider/prompt.ts`, `browser/authoring.ts`, additive `browser/router.ts` draft routes, tests: new `prompt-assembler.test.ts`, `provider-prompt.test.ts`, `browser-authoring.test.ts`, `creation-brief.test.ts` (adapter cases only), `simulate-study-card-clarity.test.ts`, `simulate-language-prompt-control.test.ts`.

**Read-only:** `shared/creation.ts` (source of brief wording), `provider/generate.ts` (reference only), `browser/provider.ts` callers.

**Must not touch:** Track 1 type/schema/store/repository/CRUD routes; Track 3 mode content; `app/**`; provider schemas; Drift live entries.

## 6. Ordered steps with proof

1. Write `docs/features/prompt-assembler/{GRILL,PRD-TRD,IMPL}.md` from this plan.
2. Red tests: mode text once per lane; two modes change only layer 3; universal strings shared byte-for-byte; draft send does not persist.
3. Build `prompt-layers.ts`, refactor `prompt.ts` and `authoring.ts` to import all universal strings.
4. Add adapter/optional context fields; wire pass-through callers unchanged.
5. Add meta-skill prompt and two draft routes; keep version single-sourced.
6. Proof: targeted vitest; `npx tsc --noEmit`; changed-file eslint; `npm run build`; full `npx vitest run`; both drift gates.

## 7. Acceptance

- All five later modes can be dropped into the seam and change only layer 3.
- Universal rules appear once in every prompt; existing once-only teaching assertion still passes.
- No mode/empty skill leaves current output unchanged; examples parse through existing schemas.
- Draft prepare returns versioned prompt; send returns a draft object and adds nothing to storage.

## 8. Risks

Prompt duplication is the main regression; count assertions for every universal rule are mandatory. Chat version is user-visible. Keep module pure (no Node imports). Never inject learner evidence/provider keys/raw AI directives from a mode.
