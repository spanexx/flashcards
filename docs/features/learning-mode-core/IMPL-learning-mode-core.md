# IMPL: Learning mode core

**Slug:** `learning-mode-core`
**Status:** Locked by delegated decision, 2026-11-22
**Date:** 2026-11-22
**Origin:** `docs/features/learning-mode-core/GRILL-learning-mode-core.txt`
**Contract:** `docs/features/learning-mode-core/PRD-TRD-learning-mode-core.md`

## Phase order

1. The mode type, the shared answer-mode list and the additive brief fields.
2. The stored-shape schema, the spoiler rule and the canonical-example
   validator.
3. The `modes` store, the repository rows and backup/restore.
4. The mode loader and the base `/api/modes` routes.
5. The gates.

Each phase is its own commit-sized change. A phase starts only after the
targeted tests of the phase above are green. Tests are written first and are
seen to fail for the right reason before the code exists.

## Phase 1 — the type and the brief

**Files:** `v1/src/lib/shared/types.ts`,
`v1/src/lib/shared/creation.ts`

- `ANSWER_MODES` is the one runtime tuple; `AnswerMode` is derived from it. The
  existing five names and their order do not change.
- `LearningMode` sits after the `WordStage` block, with the fields and types
  fixed by GRILL Q1.
- `CreationBrief` gains the three optional fields. The defaults object does not
  change; `defaultCreationBrief` emits a new field only when supplied.
- `validateCreationBrief` carries the new fields through with the three narrow
  checks in GRILL Q2. No old rule, default or refusal changes.

**Proof:** `npx vitest run tests/creation-brief.test.ts` still green, which
pins the old brief byte for byte. Type checking covers the new fields.

## Phase 2 — the schema, the spoiler rule and the example

**Files:** `v1/src/lib/core/schema.ts`,
`v1/src/lib/core/prompt-context.ts`,
`v1/src/lib/browser/bundle.ts`,
`v1/src/lib/browser/modes.ts` (validation seam only),
`v1/tests/learning-mode-schema.test.ts` (new),
`v1/tests/prompt-context.test.ts` (extended)

- Export `answerModeSchema`; use it in `answerDefSchema.mode` and in
  `learningModeSchema.defaultCardMix`.
- Add `learningModeSchema` as the peer of `packManifestSchema`, with
  `z.iso.datetime()` for `createdAt`.
- Add `spoilerIssues` to `prompt-context.ts`: answer tokens against teaching
  and hints, whole-word and case-insensitive, three-character floor, one issue
  per field.
- Add `validateCanonicalExample` to `bundle.ts`: stringify, `parseBundle`,
  `hardRuleIssues` per card with the importer's topic rule, `lessonIssues`,
  then `spoilerIssues`.
- Add `readLearningMode` and `learningModeIssues` to `modes.ts`; the loader
  arrives in Phase 4.

**Proof:** `npx vitest run tests/learning-mode-schema.test.ts
tests/prompt-context.test.ts`.

## Phase 3 — store, repository and backup

**Files:** `v1/src/lib/browser/store.ts`,
`v1/src/lib/browser/repository.ts`,
`v1/src/lib/browser/bundle.ts`,
`v1/tests/browser-repository.test.ts` (extended)

- `"modes"` joins `STORE_NAMES`; the database version is 7.
- `BrowserLearningMode` and the four CRUD functions, each marking the library
  changed.
- `clearLibrary` empties `"modes"`.
- `backupSchema` carries custom modes with `learningModeSchema`; export filters
  built-ins; restore keeps the existing built-ins across `clearLibrary` and
  writes the backup's custom rows.

**Proof:** `npx vitest run tests/browser-repository.test.ts`.

## Phase 4 — the loader and the routes

**Files:** `v1/src/lib/browser/modes.ts`,
`v1/src/lib/browser/router.ts`,
`v1/tests/seed-modes.test.ts` (new),
`v1/tests/browser-router.test.ts` (extended)

- The manifest schema, the `/modes/` path guard, the bounded fetch, and
  `ensureModesSeeded` with the rules in GRILL Q8.
- `readyModeSeed` in the router, awaited by `loadState`.
- `modesAnswer` and the four routes in GRILL Q9, with duplicate, built-in
  refusals and `ValidationIssue[]` details.

**Proof:** `npx vitest run tests/seed-modes.test.ts
tests/browser-router.test.ts`.

## Phase 5 — the gates

- `npx tsc --noEmit`.
- `npx eslint` on every changed file.
- `npm run build`.
- `npx vitest run` (full suite), with the total compared to the base.
- `npm run check:drift` and `npm run check:drift:staged`.
- Cleanup: no server, no scratch log, no build output left behind that the
  repo does not expect.

## Out of scope

Everything in PRD-TRD §5. In particular: no mode content, no `make-seed.mjs`,
no prompt work, no UI, no provider schema change, no new dependency.

## Risks and how they are handled

- **An old tab holds the version 6 database.** The upgrade is additive and
  lossless; the existing `onblocked` refusal already explains that other tabs
  must close. No row is read or rewritten by the upgrade.
- **A spoiler rule that refuses sound teaching.** Only the literal answer token
  is refused, as a whole word; a rule that names the topic passes. Tokens under
  three characters are skipped so ordinary prose is never a spoiler.
- **A broken mode file writing a half row.** The file is parsed and validated
  before the first write, and each entry has its own try/catch.
- **A duplicate colliding with a built-in id.** The duplicate takes a free id
  from the naming helpers, and the loader refuses to overwrite a row the
  learner owns even if an id ever collided.
- **A restore emptying the mode list.** Built-in rows are read before
  `clearLibrary` and written back, so an offline restore still shows them.
- **`router.ts` churn before Track 2.** Track 1's router change is one small
  commit with all base routes, so Track 2 only appends.
