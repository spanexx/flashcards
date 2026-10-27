# Goal: every Generate prompt teaches, carries the learner's level, and is editable

**Contract**
- Outcome: three learner-visible behaviours on `fix/generate-prompt-parity`: (1) cards added into an existing deck are asked for teaching layers exactly like pack and deck generation; (2) generated packs and decks carry the learner's level (deck level first, global level as fallback) instead of a fixed intermediate; (3) every prepared Generate prompt can be edited by the learner, and the edited text is what the provider receives.
- Acceptance evidence:
  - new unit tests: the cards builder includes the teaching lines and the level; all three builders agree on teaching wording; parsed generated packs and decks carry the passed level; a send-path test proves edited text is used.
  - `node node_modules/vitest/vitest.mjs run <file>` targeted, then the full suite -> 0 failures.
  - `npm run typecheck`, `npm run lint` -> clean.
  - `npm run check:drift` and `npm run check:drift:staged` -> exit 0.
  - PRD-TRD teaching-layers Scenarios 20/21 and the creation-control Generate section name the built behaviour; the language-prompt-control non-goal "No separate prompt editor for decks or cards" is marked superseded by the learner's 2026-10-27 request.
- Scope: `v1/src/lib/provider/prompt.ts`, `v1/src/lib/provider/generate.ts`, `v1/src/lib/browser/provider.ts`, `v1/src/app/library/CreatePanel.tsx` (plus one small new module if CreatePanel would otherwise grow), `v1/tests/**`, `docs/drift.md`, `docs/features/teaching-layers/*`, `docs/features/creation-control/*`, `docs/features/language-prompt-control/*`, this ledger. Not in scope: provider request shape beyond the user text, new dependencies, storage migration, key exposure, the CORS message work (`client.ts`), seed-pack content.
- Authority: delegated by the learner on 2026-10-27 for implementation inside this scope; the commit go, merge and push stay user-only.
- Budget: 3 attempts per failure class; bounded commands only.

**Pipeline:** surgical-change, three gaps: D-28 (cards builder lacks teaching), D-29 (level hard-coded intermediate), D-30 (Generate prompts are read-only while Chat's is editable). D-30 supersedes a locked non-goal; that is the learner's decision of 2026-10-27, recorded here and in the docs, not an agent reinterpretation.

**Worktree:** `/home/spanexx/.config/superpowers/worktrees/flashcards/fix-generate-prompt-parity` (branch `fix/generate-prompt-parity`, base `main`).

## Iterations

### 1 — 2026-10-27T03:20
Action: wrote the contract; created the worktree with `agent-worktree fix generate-prompt-parity --base main --allow-dirty` (only `sessions/.last-handoff` and `sessions/.handoff-log.md` were dirty, left untouched); linked `v1/node_modules` from the main checkout.
Verification: `agent-worktree` printed `WORKTREE_READY=1`, `BRANCH=fix/generate-prompt-parity`; `ls -ld v1/node_modules` -> symlink.
Verdict: pass.
Failure class: none.
Pivot: none.
Next: read the three prompt builders, the two hard-coded levels, the Generate send path and the Chat editor; then open D-28…D-30 before any code.

### 2 — 2026-10-27T03:28
Action: opened D-28 (cards prompt had no teaching rule under a pack's own template), D-29 (generated packs and decks fixed at intermediate; cards prompted at the global level) and D-30 (Generate prompt read-only, send used the held text; learner's 2026-10-27 request supersedes the older non-goal). Implemented: `buildGenerationPrompt` appends `teachingPromptLines()` for a pack's own template; `GeneratedCardOptions.level` feeds `generatedPackBundle`/`generatedDeckBundle`; `PreparedRequest.level` is set by `prepareGeneration` (deck level for cards, global level for new containers) and passed to the bundle readers; `applyPromptEdit` replaces a held prompt with the learner's words; the `/api/jobs` generation route applies an optional `prompt`; new `GenerationPromptEditor` replaces the read-only block and send carries the edited text. `ProfileSlots.level` is now `StudyLevel`.
Verification: `npx tsc --noEmit` -> no output (clean); `npm run check:drift` -> "drift ok: 3 open, 0 awaiting, 27 resolved".
Verdict: pass.
Failure class: none.
Pivot: none.
Next: write the tests for teaching parity, level threading, edited-prompt sending and the router flow.

### 3 — 2026-10-27T03:52
Action: tests written. `tests/provider-prompt.test.ts` pins all three builders agreeing on the teaching lines, the own-template pack asking for the layer, and the default template saying it once (split length 2). `tests/provider-flow.test.ts` pins `applyPromptEdit` (edited text becomes the only user message; blank/unchanged returns the held request) and the generated-deck level. `tests/browser-router.test.ts` pins the pack prompt and stored deck taking the global level, a cards prompt using its deck's level while a new container uses the global one, and a job whose provider body carries the edited prompt instead of the prepared one. `tests/simulate-create-flow.test.ts:183` now expects the generated deck at the session's beginner level.
Verification: two failures fixed on the way — the own-template test changed from exact equality to `startsWith` + teaching line, and the three-shape loop now uses the default-template pack because the own template has no shape line. Full run then needed a fresh `npx next build --webpack` for the `out/`-backed simulations and `node scripts/build-pwa.mjs` for `out/sw.js`. Final: `node node_modules/vitest/vitest.mjs run --maxWorkers=2` -> 60 files / 678 tests pass; `npx tsc --noEmit` clean; `npx eslint src tests` clean (plain `eslint .` crawls the Windows `v1/node_modules` symlink and hangs, so the scoped command is the honest gate).
Verdict: pass.
Failure class: test expectations pinned to the old text; missing build artefacts for simulations.
Pivot: none.
Next: drive the built export in the browser to prove the editable prompt end to end.

### 4 — 2026-10-27T04:08
Action: browser pass on the built export (static server on 4193 over the worktree's `out/`, reachable from Windows on localhost and 172.25.126.9). Library → Create → Cards → Generate with a saved provider profile; `Prepare the prompt` rendered the editable box with the teaching lines and `Learner level: beginner`; the text was replaced with a distinctive edit and sent.
Verification: first send hit `provider.invalid` because the page's fetch stub was absent after the earlier navigation; reinstalled the stub and repeated. The provider body was exactly `{"model":"browser-check","messages":[{"role":"user","content":"EDITED PROMPT ONLY: write one line about browser storage."}],"temperature":0.2}` — the edited words alone, not the prepared prompt — and the Jobs panel reported `DONE` / `Saved 1 generated card in “browser-dev”.`
Verdict: pass.
Failure class: page-context stub lost across a load.
Pivot: none.
Next: resolve D-28…D-30 with the gathered citations and run both gates.

### 5 — 2026-10-27T04:10
Action: D-28/D-29/D-30 moved to Resolved with Doc claim, Code reality (before fix), Why matters, Owner, To fix, Verified by and Related; header now `Open: 0  Resolved: 30`; the Open section is `_None…_`; D-30's doc claim repointed at the Chat promise on `creation-control.md:56` and the superseded non-goal on `language-prompt-control.md:217`; dated delivery notes appended to the teaching-layers and creation-control IMPLs.
Verification: `npm run check:drift` -> "drift ok: 0 open, 0 awaiting, 30 resolved"; `npm run check:drift:staged` -> same counts plus "drift staged ok: nothing is staged".
Verdict: pass.
Failure class: none.
Pivot: none.
Next: clean up the worktree (server, `out/`, `.next`, `tsconfig.tsbuildinfo`, logs) and hand off in plain English. Commit, merge and push stay with the learner.
