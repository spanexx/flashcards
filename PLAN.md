# TRACK 3 — Five Built-in Modes (build THIRD, after Track 2)

Status: PLAN ONLY. Base: `feature/prompt-assembler`. Branch: `feature/built-in-modes`.

## 1. Scope and non-goals

Author and seed five default LearningModes with Markdown skills and valid canonical pack examples. Consume Tracks 1-2; write no UI and no prompt-layer code.

Non-goals: changing the four shipped packs, regenerating `public/packs/*`, editing core schema/card/word rules, adding image/video assets to examples.

## 2. Current state (evidence from research)

- Pack seeding pattern: authored `v1/packs/<slug>/` → `v1/scripts/make-seed.mjs:13-18,114-186` → `v1/public/packs/<slug>.json` + `index.json`; browser reader `v1/src/lib/browser/seed.ts:14-36,61-71,73-80,105-130`, one-shot hook `router.ts:190-200`.
- `parseBundle` `bundle.ts:240-248` validates shape only; hard rules `card.ts:125-182`, word rules `word-check.ts:35-156`, page rules `pages.ts:150-171` must be composed in tests.
- `clozeContextIssue` `prompt-context.ts:118-149` is English-only (`COUNT_WORDS` `:14-30`, Saxon possessive `:61-66`), so non-English examples need explicit base/owner cues.
- Existing reusable content: `polish-starter/cards.json:3-20`; `biuro/words.json:1-239`, `cards.json:3-115`, `pack.json:1-31`; `polish-from-scratch/cards/greetings.json:3-24`; `system-design/cards/foundations.json:3-63`; browser-dev shape examples `cards/console.json:3-53`; pack schema docs `packs/README.md:52-103`.
- Generated pack ids are content hashes (`card.ts:96-98`), so example packs must be namespaced to avoid evidence collisions.

## 3. Locked decisions

1. Authored files `v1/modes/<id>.json`, one flat JSON per mode; generated `v1/public/modes/<id>.json` + `index.json` with schema `flashcards.mode-index/v1` and entries `{id,name,version,file}`.
2. `canonicalExample` is an embedded `flashcards.pack/v1` object, 1-2 decks, 2-4 cards.
3. Every example pack is `mode-demo-<id>` and is never seeded/imported as a real pack.
4. Built-ins are versioned and overwritten; not deletable, only duplicable — no tombstone kind.
5. No image/video teaching parts in examples (their `src` points at pack-local images that modes do not ship).
6. `word-deep-dive` example is small: 1 word, 1-2 forms, 2-3 pairs, 2-3 cards across a few stages; not the 100-card biuro pack.
7. Track 3 owns `make-seed.mjs`; Track 1 owns router/seed hook. Track 3 never edits `router.ts`.

## 4. The five definitions

1. `grammar-roles` — decks named with plain-English job + term in parentheses; role stated in prompt; no basic -s/-ed drilling; teaching explains intuition. Mix cloze/picks/type; `usesWordStages: false`.
2. `language-general` — theme decks; accurate `lang` codes; base-word/meaning cues in foreign-language clozes; hear_type with spelling hints. Mix cloze/type/hear_type/picks; `usesWordStages: false`.
3. `word-deep-dive` — exactly one word in `words`; five progressive decks; stage-to-mode rule; never print changed form; state trigger/context. Mix cloze/type/picks/match; `usesWordStages: true`.
4. `system-architecture` — scenario-driven constraint→pattern prompts; trade-off picks; no dictionary definitions. Mix cloze/picks/type; `usesWordStages: false`.
5. `programming-language` — mobile-sized 1-5 line code snippets; prompt names language and goal; picks for subtle bugs; hints explain why. Mix type/cloze/picks; `usesWordStages: false`.

## 5. File ownership

**Own:** `v1/modes/**` (new), `v1/public/modes/**` (generated), additive `v1/scripts/make-seed.mjs`, new tests `built-in-modes.test.ts` and `mode-seed.test.ts`, new `docs/features/built-in-modes/` origin pack with pre-sim.

**Must not touch:** `v1/packs/**`, `v1/public/packs/**`, `core/schema.ts`, `card.ts`, `pages.ts`, `prompt-context.ts`, `word-check.ts`, `browser/bundle.ts`, `seed.ts`, `repository.ts`, `store.ts`, `router.ts`, provider/prompt modules, `app/**`, Drift live entries.

## 6. Ordered steps with proof

1. Write `docs/features/built-in-modes/{GRILL,PRD-TRD,IMPL}.md` and pre-simulation from this plan.
2. Red test: manifest exactly five ids; every canonicalExample parses and passes hard/word/spoiler rules; strict JSON parse.
3. Write five `v1/modes/*.json` files with Markdown skill text.
4. Add additive emit loop + index to `make-seed.mjs`; regenerate; assert `public/packs/*` bytes unchanged.
5. Add mode-seed install tests: fresh install, no-op, newer version update, malformed silent and retry, no real pack created.
6. Proof: targeted vitest; typecheck; changed-file lint; build; full suite; both drift gates.

## 7. Acceptance

- All five canonicalExamples pass `parseBundle` + `hardRuleIssues` + `lessonIssues` + spoiler validator; 1-2 decks, 2-4 cards, valid deckIds.
- `usesWordStages` true only for word-deep-dive; no stage/wordId on the other four.
- A fresh browser receives five built-ins with `isBuiltIn: true`; re-seed is idempotent; no `mode-demo-*` pack appears in `/api/packs`.

## 8. Risks

English-only cloze validator; explicit cues in non-English examples. Lang codes must be consistent (`pl`, `en`, `pl-pl`). Demo pack namespace avoids card-id collisions. New browser module falls under 90% coverage threshold. Keep `make-seed.mjs` additive or `seed-packs.test.ts` fails.
