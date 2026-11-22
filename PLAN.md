# TRACK 2 — Prompt Assembler & Mode Meta-Skill (build SECOND, after Track 1)

Status: PLAN ONLY. Base: `feature/learning-mode-core`. Branch: `feature/prompt-assembler`.

## Scope

Replace the monolithic prompt text with a three-layer assembler and add the AI-draft meta-skill endpoints. Consume the LearningMode seam from Track 1; write no mode content and no UI.

## Locked decisions (delegated)

- One new pure browser-safe module `v1/src/lib/shared/prompt-layers.ts` owns: layer 1 system + output contract, layer 2 universal card rules, and `assemblePrompt(...)`. Both chat and generation lanes import it; no third copy of rules.
- Do NOT restructure `CreationBrief` here. Track 1 added optional `modeId`/`cardMix`/`modePreferences`; add an adapter `promptInputsFromBrief(...)` producing `PromptInputs` (subject, targetLanguage, questionLanguage, library summary, customFocus, cardMix, level, style, count).
- Use a local structural `ModePromptContribution { skillInstructions; canonicalExample }`; no import of the full entity. Optional `mode?` and `inputs?` on existing contexts keep all callers compiling.
- Inject the mode skill once, after universal rules and before "Return JSON only, shaped like:". Mirror in all three generation builders and the chat lane.
- One shared prompt version aliases `AUTHORING_SKILL_VERSION`; one bump updates both lanes. Update the two hard-coded assertions to the new value.
- Track 2 owns the two AI-draft routes in `router.ts` (additive to Track 1's CRUD): `POST /api/modes/draft` and `POST /api/modes/draft/send`, using `holdPrepared`/`callBrowserProvider`/`parseJsonLoose` like page drafts. Nothing is saved by send.
- No provider schema is widened. A mode's canonical example must pass the existing strict schemas.

## File ownership (may edit)

`v1/src/lib/shared/prompt-layers.ts` (new), `v1/src/lib/provider/prompt.ts`, `v1/src/lib/browser/authoring.ts`, additive `v1/src/lib/browser/router.ts` draft routes, tests: `prompt-assembler` (new), `provider-prompt`, `browser-authoring`, `creation-brief` (adapter cases only), `simulate-study-card-clarity`, `simulate-language-prompt-control`.

Must not touch: Track 1 type/schema/store/repository/CRUD routes; `CreationBrief` defaults/validation; Track 3 mode content; `app/**`; provider schemas.

## Ordered steps and proof

1. Write `docs/features/prompt-assembler/{GRILL,PRD-TRD,IMPL}.md` from this plan.
2. Red tests: mode text appears exactly once in all lanes; two modes change only layer 3; universal rule strings come from the shared module; draft prepare/send does not save.
3. Build `prompt-layers.ts`, refactor `prompt.ts` and `authoring.ts` to import it.
4. Add adapter and optional context fields; wire selected mode through existing callers without changing their signatures.
5. Add draft prompt builder and the two router routes.
6. Green targeted tests, then typecheck, changed-file lint, build, full suite, drift gates.

## Acceptance

- Selecting a mode injects its `skillInstructions` and `canonicalExample` once in pack, deck, cards and chat prompts.
- Universal rules are byte-identical across lanes and appear once.
- No mode/empty skill leaves current prompt output unchanged.
- Draft send returns a LearningMode JSON into the editor without saving; it passes Track 1 validation.

## Risks

Once-only assertions (teaching, self-contained rule) are the main regression guard. The chat preview version is user-visible; bump deliberately. Keep the module pure for the browser.
