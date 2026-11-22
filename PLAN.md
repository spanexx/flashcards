# TRACK 3 — Five Built-in Modes (build THIRD, after Track 2)

Status: PLAN ONLY. Base: `feature/prompt-assembler`. Branch: `feature/built-in-modes`.

## Scope

Author and seed the five default LearningModes and their Markdown skills / canonical examples. Consume Tracks 1-2; write no UI and no prompt-layer code.

## Locked decisions (delegated)

- Authored files: `v1/modes/<id>.json`, one flat hand-writable JSON per mode. Generated assets: `v1/public/modes/<id>.json` + `index.json` with a new schema `flashcards.mode-index/v1`.
- `canonicalExample` is an embedded `flashcards.pack/v1` object, 1-2 decks and 2-4 cards.
- Every demo pack is namespaced `mode-demo-*` and is NEVER seeded or imported as a real pack (avoids card-id collisions and evidence loss).
- Built-ins are versioned; a newer version overwrites. They are not deletable, only duplicable, so no tombstone kind is needed.
- No built-in image/video teaching parts in canonical examples: their `src` points at `/packs/system-design/images/...`, which a mode example does not ship.
- `word-deep-dive` example is small (1 word, 1-2 forms, 2-3 pairs, 2-3 cards across a few stages), not a copy of the 100-card biuro course.
- Track 3 owns `make-seed.mjs`; Track 1 owns the boot seed hook and all router routes. Track 3 does not edit `router.ts`.

## The five modes

1. `grammar-roles` — plain-English case/role decks; cloze + picks + type; `usesWordStages: false`.
2. `language-general` — theme decks, lang codes, base-word cues, hear_type; `usesWordStages: false`.
3. `word-deep-dive` — one word, 5-stage arc, stage-to-mode rule; `usesWordStages: true`.
4. `system-architecture` — scenario-driven pattern/trade-off prompts; `usesWordStages: false`.
5. `programming-language` — short code snippets, self-contained syntax intent, picks for bugs; `usesWordStages: false`.

## File ownership (may edit)

`v1/modes/**` (new), `v1/public/modes/**` (generated), additive `v1/scripts/make-seed.mjs`, new tests `built-in-modes.test.ts` and `mode-seed.test.ts`, new `docs/features/built-in-modes/` origin pack.

Must not touch: `v1/packs/**`, `v1/public/packs/**`, core schema/card/word-check/pages, `browser/bundle.ts`, `seed.ts`, `repository.ts`, `store.ts`, `router.ts`, provider/prompt modules, `app/**`.

## Ordered steps and proof

1. Write `docs/features/built-in-modes/{GRILL,PRD-TRD,IMPL}.md` plus pre-sim from this plan.
2. Red test: manifest has exactly five ids; each canonicalExample parses and passes hard/word rules.
3. Write the five `v1/modes/*.json` files and the Markdown skill text.
4. Add additive emit loop and index to `make-seed.mjs`; regenerate.
5. Add mode-seed install test (fresh, no-op, newer version, malformed silent) using Track 1's loader.
6. Green targeted tests, typecheck, changed-file lint, build, full suite, drift gates.

## Acceptance

- All five canonicalExamples pass `parseBundle`, `hardRuleIssues`, `lessonIssues` and Track 1's spoiler validator.
- `usesWordStages` is true only for `word-deep-dive`; every deckId is valid; pack output bytes unchanged.
- A fresh browser receives all five built-ins with `isBuiltIn: true` on first load.

## Risks

The cloze validator is English-only; non-English examples must carry explicit base/owner cues and must not claim mechanical judging. Namespaced demo packs must never collide with four seeded packs. Coverage threshold is 90% for new browser modules.
