# TRACK 1 — Learning Mode Core (build FIRST)

Status: PLAN ONLY. Base: `main` at `8acc181`. Branch: `feature/learning-mode-core`.

## 1. Scope and non-goals

Own the `LearningMode` data model, IndexedDB storage, seeding/loader, validation contract and base `/api/modes` CRUD. Ship **no** final mode content, no prompt changes and no UI.

Non-goals: the five built-in definitions (Track 3), prompt assembler (Track 2), Mode Studio screens (Track 4), changing `flashcards.pack/v1`, widening provider schemas.

## 2. Current state (evidence from research)

- `LearningMode` does not exist anywhere in `v1/src` (grep confirmed).
- `AnswerMode` is `v1/src/lib/shared/types.ts:104-105`; `WordStage` at `:179`; `PackStatus` and its optional `studyInstruction` at `:384-403`.
- `v1/src/lib/core/schema.ts:11-12` imports `AnswerMode`/`WordStage` and `studyInstructionField`. `answerDefSchema.mode` hardcodes the five modes at `:146-147`. `packManifestSchema` is at `:228-243`, `packPromptsSchema` at `:251-263`, `ValidationIssue` at `:265-270`.
- `BrowserPack` row pattern: `v1/src/lib/browser/repository.ts:27-48`; legacy repair `:81-87`; CRUD `:89-104`; `clearLibrary` enumerates stores at `:532-550`.
- Store: `STORE_NAMES` `v1/src/lib/browser/store.ts:14-32`; `MemoryStore` creates stores lazily `:59-66`; IndexedDB version 6 at `:113`, additive upgrade `:114-118`, `onblocked` `:122-123`.
- Pack seeding: `v1/scripts/make-seed.mjs:13-18,114-186`; `v1/src/lib/browser/seed.ts:14-36,61-71,73-80,105-130`; one-shot hook `v1/src/lib/browser/router.ts:189-204` (`seedPass ??= ensureSeeded()`).
- Validation already available: `parseBundle` `bundle.ts:240-248`; `hardRuleIssues` `core/card.ts:125-182`; `clozeContextIssue` `core/prompt-context.ts:118-149`; `lessonIssues` `core/word-check.ts:35-156`; `normalizeStudyInstruction`/`studyInstructionField` `prompt-context.ts:162-199`. `parseBundle` alone does NOT run hard rules — this is the key reuse point.
- Backup/restore: `bundle.ts:881-1009`, `1019-1054`, `1084-1143`.
- Router: reads at `:784-849`, writes at `:851-1179`; `/api/packs` at `:791`, pack CRUD at `:977-992`; authoring version returns at `:1153-1174`.

## 3. Locked decisions (delegated by the learner's goal instruction)

1. `LearningMode` goes in `shared/types.ts`, immediately after `WordStage`; `canonicalExample` is an embedded `flashcards.pack/v1` object, not a JSON-in-JSON string.
2. Additive optional `CreationBrief` fields: `modeId?`, `cardMix?: AnswerMode[]`, `modePreferences?`. Existing defaults and validation of old fields stay byte-stable. Track 4 consumes these; nobody else edits `creation.ts`.
3. Built-ins are versioned and overwritten on update. They are not deletable — only duplicable. "Duplicate & Customize" writes a new row with `sourceModeId`, so no tombstone kind is needed.
4. Customised modes ride in backup/restore; built-ins are re-seedable and need not be backed up.
5. One shared spoiler-free validator is added to `core/prompt-context.ts` and reused by canonical-example validation. This is a new shared rule, not a copy. The rule: teaching/hints must not contain any `answerDef.blanks[].expected`, `expected`, or `correct` token.
6. Track 1 owns ALL base `/api/modes` CRUD and the boot seed hook in `router.ts`. Track 2 adds only the two AI-draft routes additively later. Track 3 does not edit `router.ts`.
7. `make-seed.mjs` is owned by Track 3, not Track 1.

## 4. Proposed seams and signatures

- `types.ts`: `interface LearningMode { id; name; description; version: string; defaultCardMix: AnswerMode[]; usesWordStages: boolean; skillInstructions: string; canonicalExample: unknown; isBuiltIn: boolean; sourceModeId?: string; createdAt: string }`.
- `schema.ts`: export `answerModeSchema` from the `answerDefSchema.mode` enum and reuse it in `learningModeSchema.defaultCardMix`; add `learningModeSchema` as a peer of `packManifestSchema`. `canonicalExample` is validated by a thin wrapper, not a second zod shape.
- `core/prompt-context.ts`: add `spoilerIssues(card: CardSource): ValidationIssue[]`, imported by the canonical-example validator.
- `bundle.ts`: add `validateCanonicalExample(example: unknown): ValidationIssue[]` = strict `JSON.parse`/`parseBundle` + `hardRuleIssues` per card + `lessonIssues` + `spoilerIssues`; reuse `ValidationIssue` shape.
- `store.ts`: add `"modes"` to `STORE_NAMES`, bump DB version to 7.
- `repository.ts`: `BrowserLearningMode extends StoredValue`; `readMode/readModes/writeMode/deleteMode`; include custom modes in backup rows and `clearLibrary`.
- new `browser/modes.ts`: `MODES_INDEX_PATH`, `flashcards.mode-index/v1` schema with the same path-traversal guard as `seed.ts:21-25`, bounded fetch, `ensureModesSeeded()` with per-mode silent try/catch and version compare via `compareVersions`.
- `router.ts`: `modesAnswer()` beside `packsAnswer()` (`:234-237`), `GET /api/modes` after `/api/packs` (`:791`), CRUD near pack CRUD (`:977-992`), and `await ensureModesSeeded()` in `loadState` (`:192`).

## 5. File ownership

**Own:** `shared/types.ts`, `shared/creation.ts`, `core/schema.ts`, `core/prompt-context.ts`, `browser/store.ts`, `browser/repository.ts`, new `browser/modes.ts`, `browser/router.ts`, thin additions to `browser/bundle.ts`, tests: new `learning-mode-schema.test.ts`, extend `browser-repository`, `browser-seed`, new `seed-modes`, extend `browser-router`, `prompt-context`, `card`.

**Read-only/coordinate:** `core/card.ts`, `core/word-check.ts`, `lib/packs/*`.

**Must not touch:** provider modules, `app/**`, `v1/modes/**`, `public/modes/**`, `make-seed.mjs`, Drift live entries.

## 6. Ordered steps with proof

1. Write `docs/features/learning-mode-core/{GRILL,PRD-TRD,IMPL}.md` from this plan (origin gate).
2. Red tests: schema accepts/rejects; repository round-trip; canonicalExample refuses spoiler and missing-owner examples; routes reject malformed bodies.
3. Add type + additive brief fields + schema + spoiler validator.
4. Add IndexedDB store, repository CRUD and backup inclusion.
5. Add `modes.ts` loader and one-line router seed hook; add base CRUD routes.
6. Proof: targeted vitest green; `npx tsc --noEmit`; changed-file `npx eslint`; `npm run build`; full `npx vitest run`; `npm run check:drift` and `check:drift:staged`.

## 7. Acceptance

- Full mode passes schema; bad id, empty mix, unknown answer mode, non-boolean `usesWordStages`, missing skill and invalid canonicalExample fail.
- Canonical example is validated through existing validators only; a spoiler or ownerless cloze is refused.
- Modes round-trip through MemoryStore and backup/restore; custom rows survive re-seed; built-ins cannot be deleted via API.
- Base CRUD returns plain `ValidationIssue` details; unknown paths still fail as before.

## 8. Risks

IndexedDB v6→v7 blocks old tabs until closed (additive upgrade is lossless). `router.ts` must be one small commit before Track 2. No Drift entry may be self-authored. Spoiler validator must not reject legitimate teaching that names a rule but not the token.
