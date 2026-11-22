# TRACK 1 — Learning Mode Core (build FIRST)

Status: PLAN ONLY. Base: `main` at `8acc181`. Branch: `feature/learning-mode-core`.

## Scope

Own the data model, storage, validation contract and base API for `LearningMode`. Ship no final mode content and no prompt/UI code.

## Locked decisions (delegated)

- `LearningMode` lives in `shared/types.ts`; schema in `core/schema.ts`. `canonicalExample` is an embedded `flashcards.pack/v1` object, not a JSON string.
- Additive optional fields to `CreationBrief`: `modeId?`, `cardMix?: AnswerMode[]`, `modePreferences?`. Never change existing defaults or validation of old fields. Track 2 and Track 4 consume these; nobody else edits `creation.ts`.
- Built-ins are versioned and overwrite on update; they are not deletable, only duplicable. "Duplicate & Customize" creates a new row carrying `sourceModeId`; no new tombstone kind is needed.
- Customised modes are included in backup/restore; built-ins are re-seedable.
- One shared spoiler-free validator is added to `core/prompt-context.ts` and reused by canonical-example validation. It does not invent a new pack rule.
- Track 1 owns ALL base `/api/modes` CRUD routes and the boot seed hook in `router.ts`. Track 2 will add only the two AI-draft routes additively later.

## File ownership (may edit)

`v1/src/lib/shared/types.ts`, `v1/src/lib/shared/creation.ts`, `v1/src/lib/core/schema.ts`, `v1/src/lib/core/prompt-context.ts`, `v1/src/lib/browser/store.ts` (version 7 + `modes` store), `v1/src/lib/browser/repository.ts`, new `v1/src/lib/browser/modes.ts`, `v1/src/lib/browser/router.ts` (base routes + seed hook), `v1/src/lib/browser/bundle.ts` (thin canonical-example validator + backup/restore for custom modes), tests: `learning-mode-schema`, `browser-repository`, `browser-seed`, `seed-modes`, `browser-router`, `prompt-context`, `card`.

Must not touch: `provider/prompt.ts`, `browser/authoring.ts`, `app/**`, `v1/modes/**`, `public/modes/**`, `make-seed.mjs`, Drift live entries.

## Ordered steps and proof

1. Write `docs/features/learning-mode-core/{GRILL,PRD-TRD,IMPL}.txt|md` from this plan (feature-pipeline origin).
2. Red tests for schema, repository round-trip, canonical-example validation, base routes.
3. Add type + additive brief fields + `learningModeSchema` + shared validator.
4. Add IndexedDB store and repository CRUD/backup.
5. Add `modes.ts` loader and seed hook; add base `/api/modes` routes.
6. Green targeted tests, then `npx tsc --noEmit`, changed-file eslint, `npm run build`, full `npx vitest run`, both drift gates.

## Acceptance

- A full LearningMode passes its schema; bad id/mix/instructions/JSON fail.
- `canonicalExample` is validated by `parseBundle` + `hardRuleIssues` + `lessonIssues` + the shared spoiler check; no duplicated zod.
- Modes survive MemoryStore round-trip and backup/restore; custom rows are not overwritten by re-seed.
- `GET/POST/PATCH/DELETE /api/modes` work; built-in delete is refused; duplication keeps `sourceModeId`.

## Risks

IndexedDB version bump blocks old tabs; keep additive. `router.ts` must be a single small commit before Track 2. No Drift entry may be self-authored here.
