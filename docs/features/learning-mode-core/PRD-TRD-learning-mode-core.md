# PRD-TRD: Learning mode core

**Slug:** `learning-mode-core`
**Status:** Locked by delegated decision, 2026-11-22
**Date:** 2026-11-22
**Origin:** `docs/features/learning-mode-core/GRILL-learning-mode-core.txt`
**Track:** 1 of 4. Track 2 owns the prompt assembler and the two AI-draft
routes; Track 3 owns the five built-in mode definitions and `make-seed.mjs`;
Track 4 owns Mode Studio.

## 1. Why this exists

The app teaches every subject through one shape: a pack of cards that names its
own answering rule. It has no vocabulary for a *way of studying* — a named mode
with its own skill text, its own preferred card mix, and one worked example that
shows the kind of card the mode wants.

Without that vocabulary, "Learning Mode" can only be a screen with a hardcoded
list. That would make a mode impossible to store, impossible to customise,
impossible to back up and impossible to teach a generator. It would also repeat
the five answer-mode names in a fourth place.

This track ships the contract only: the type, the storage row, the validation,
the seed loader and the base CRUD routes. The five built-ins, the prompt
assembler and the Mode Studio screens arrive in later tracks and consume this.

## 2. What it does

### 2.1 A mode is data

- A mode has an id, a name, a description, an author-written version, a card
  mix, a word-stage flag, skill instructions, one embedded canonical example, a
  built-in flag, an optional source mode id and a creation date.
- The id is a lowercase slug. The canonical example is a whole
  `flashcards.pack/v1` bundle object, never a JSON string inside JSON.
- A built-in is seeded from the app's manifest, refreshed when the manifest's
  version is newer, and never deleted or edited. A learner's mode is a duplicate
  that names its `sourceModeId`.

### 2.2 The creation brief can carry a mode

- `CreationBrief` gains three optional fields: `modeId`, `cardMix` and
  `modePreferences`.
- An old brief produces the same object as before, byte for byte. A new brief
  keeps the values it sent.
- A card mix may only name the five answer modes; anything else is refused with
  a plain sentence.

### 2.3 A canonical example is checked by the existing validators

- `validateCanonicalExample` reads the object as a pack bundle, then runs the
  hard card rules, the word-lesson link rules, and the spoiler rule.
- A spoiler is an answer token appearing in the card's teaching or hints. The
  token set is `answerDef.blanks[].expected`, `answerDef.expected` and
  `answerDef.correct`.
- A teaching line that names the rule is accepted. Only the answer token is
  refused.

### 2.4 Modes are stored and seeded

- IndexedDB gains a `modes` store at version 7. The upgrade is additive.
- `ensureModesSeeded()` reads `/modes/index.json` under `withBasePath`, installs
  a missing mode, updates a newer one, and leaves everything else alone.
- One broken mode file is silent and is retried on the next start. It never
  leaves a half-written row.
- A custom mode is included in a backup and restored with it. Built-ins are not
  backed up; they survive a restore and are refreshed by the next seed.

### 2.5 The API

- `GET /api/modes` returns the modes, built-ins first, then by name.
- `POST /api/modes` creates a mode, or duplicates one when `sourceModeId` is
  given. A duplicate keeps `sourceModeId` and is never built-in.
- `PATCH /api/modes/:id` edits a learner's mode.
- `DELETE /api/modes/:id` deletes a learner's mode.
- A built-in cannot be edited or deleted. A malformed body returns the plain
  `ValidationIssue[]` detail the other routes already return.

## 3. Simulation contract

Track 1 ships no screen, so the operator simulation is deferred to Track 4
(GRILL deviation D-A). The contract below is demonstrated by the named tests;
Track 4's simulation must reproduce scenes 1 to 10 through the real UI.

1. A complete mode passes the stored-shape check.
2. A bad id, an empty card mix, an unknown answer mode, a non-boolean
   `usesWordStages`, missing skill instructions, a non-ISO `createdAt` and a
   canonical example that is not a bundle are each refused, with the field
   named.
3. A canonical example that gives its answer away in the teaching is refused.
4. A canonical example that teaches the rule without naming the answer passes.
5. A fresh store installs a seeded mode with `isBuiltIn: true`.
6. A second seed pass with the same manifest writes nothing and fetches no
   mode file again.
7. A newer manifest version replaces the built-in row and keeps its id.
8. A malformed manifest changes nothing and throws nothing.
9. A mode whose file fails leaves the store untouched and installs on the next
   start.
10. A custom mode survives a re-seed and is the only mode a backup carries.
11. `GET /api/modes` lists what is stored.
12. Duplicating a mode keeps `sourceModeId` and creates a non-built-in row.
13. Deleting or editing a built-in is refused with a plain sentence.
14. A malformed create body returns `ValidationIssue[]` as the error detail.

## 4. Technical design

### 4.1 Shared type — `v1/src/lib/shared/types.ts`

- `ANSWER_MODES` is the one runtime list:
  `["cloze", "picks", "type", "hear_type", "match"] as const`.
  `AnswerMode` is derived from it, so no module copies the five names.
- `LearningMode` sits immediately after the `WordStage` block. Its
  `canonicalExample` is `unknown`: the shared layer does not depend on the
  browser's zod bundle schema.

### 4.2 Creation brief — `v1/src/lib/shared/creation.ts`

- `CreationBrief` gains `modeId?`, `cardMix?: AnswerMode[]`,
  `modePreferences?`.
- `DEFAULT_CREATION_BRIEF` is unchanged.
- `defaultCreationBrief` adds a new field only when the override supplied it.
- `validateCreationBrief` keeps every existing rule and default. It reads the
  three new fields after the old ones: text is trimmed, a non-string is
  refused, and a card mix must be an array of known `AnswerMode` values.
- The returned brief includes a new field only when it is non-empty.

### 4.3 Schema — `v1/src/lib/core/schema.ts`

- `answerModeSchema = z.enum(ANSWER_MODES)` is exported.
- `answerDefSchema.mode` uses it instead of its own enum literal.
- `learningModeSchema` is a peer of `packManifestSchema`:
  - `id` matches `^[a-z0-9][a-z0-9-]*$`;
  - `name`, `description`, `version` and `skillInstructions` are non-empty;
  - `defaultCardMix` is a non-empty array of `answerModeSchema`;
  - `usesWordStages` is a boolean;
  - `canonicalExample` is a non-array object (the deep check is composed in
    the browser layer, because `schema.ts` cannot import the bundle reader);
  - `isBuiltIn` is a boolean;
  - `sourceModeId` is optional;
  - `createdAt` is `z.iso.datetime()`, so "yesterday" is refused.

### 4.4 Spoiler validator — `v1/src/lib/core/prompt-context.ts`

- `spoilerIssues(source, index = 0): ValidationIssue[]` is the only new rule.
  The `ValidationIssue` import is type-only, so the existing zod field in the
  same module keeps working with no runtime cycle.
- Teaching readable text: text parts' `text`, image parts' `alt`, video parts'
  `alt` and `search`. Hints are the `hints` array.
- A token matches as a whole word, case-insensitively, reusing the module's
  existing `hasWholeWord`. Tokens shorter than three characters are skipped so
  ordinary prose is not refused.
- At most one issue per field. The message names the token and says the
  teaching must show how to work it out instead.

### 4.5 Canonical example — `v1/src/lib/browser/bundle.ts`

- `validateCanonicalExample(example: unknown): ValidationIssue[]`:
  1. `JSON.stringify` the embedded object, then `parseBundle` (a mode stores an
     object; the bundle reader is the one gate that already speaks that shape);
  2. for each card, build the `CardSource` the importer already builds
     (`topics: [deck name]`, pack name as fallback) and run `hardRuleIssues`;
  3. run `lessonIssues` over the bundle's cards and words;
  4. run `spoilerIssues` per card.
- No new zod shape. The only new code is the composition.

### 4.6 Mode validation seam — `v1/src/lib/browser/modes.ts`

- `learningModeIssues(value, index = 0)` checks the stored shape, then the
  canonical example, prefixing example fields with `canonicalExample.`.
- `readLearningMode(value)` returns the parsed mode or the issue list, so the
  loader and the router share one check instead of three copies.

### 4.7 Store — `v1/src/lib/browser/store.ts`

- `STORE_NAMES` gains `"modes"`.
- `indexedDB.open("flashcards", 7)`. The upgrade loop already creates any
  missing store, so no row is rewritten.

### 4.8 Repository — `v1/src/lib/browser/repository.ts`

- `BrowserLearningMode extends LearningMode, StoredValue`.
- `readMode`, `readModes`, `writeMode`, `deleteMode`, each marking the library
  changed like the pack and card writers.
- `clearLibrary` adds `"modes"` to the stores it empties.

### 4.9 Backup — `v1/src/lib/browser/bundle.ts`

- `backupSchema` gains `modes: z.array(learningModeSchema).default([])`, so an
  older backup still restores. No second mode shape.
- `buildBackup` carries `modes.filter((mode) => !mode.isBuiltIn)`.
- `applyBackup` reads the built-in rows before `clearLibrary`, writes them
  back, then writes the backup's custom rows. This mirrors the existing
  provider-key and subscription preservation and keeps the list complete after
  an offline restore.

### 4.10 Loader — `v1/src/lib/browser/modes.ts`

- `MODE_INDEX_SCHEMA = "flashcards.mode-index/v1"`,
  `MODES_INDEX_PATH = "/modes/index.json"`.
- `modeFileSchema` accepts only `/modes/...` with no `..`, matching
  `seed.ts:22-25`.
- One four-second `AbortSignal.timeout` for the whole pass, with the same
  no-AbortSignal fallback as `seed.ts`.
- `ensureModesSeeded()`:
  - a missing, non-OK or malformed manifest returns silently;
  - per entry: skip when a custom row already owns the id; skip when the
    installed version is not older; fetch the file, read it, require the file's
    id to equal the entry's id, stamp `isBuiltIn: true`, then write;
  - every entry is its own try/catch, so one failure leaves that row untouched
    and is retried next start;
  - no code path deletes a row.

### 4.11 Router — `v1/src/lib/browser/router.ts`

- `readyModeSeed()` holds one `ensureModesSeeded()` promise per app start, like
  the existing `seedPass`. `loadState` awaits it after the pack seed, so every
  library read has modes.
- `modesAnswer()` awaits the pass, reads the rows, sorts built-ins first then
  by name, and returns `{ modes, folder }`.
- Routes:
  - `GET /api/modes` after `/api/packs`;
  - `POST /api/modes` near the pack writes: duplicate when `sourceModeId` is a
    string, otherwise create from the body;
  - `PATCH /api/modes/:id` and `DELETE /api/modes/:id` beside the pack path.
- Duplicate: the visible name takes the first free label (`My roles`,
  `My roles 2`, …); the id is `slugFromName` of that label, then
  `uniquePackName` over the existing ids. The copy keeps the source's version,
  gains `sourceModeId`, and is not built-in.
- Create: `isBuiltIn` is forced false, `createdAt` defaults to now only when
  the field is absent, and the body goes through `readLearningMode`.
- Edit: merge over the stored row, force the stored id and `isBuiltIn: false`,
  then validate. A built-in is refused.
- Delete: a built-in is refused; a missing id is refused; otherwise the row
  leaves.
- A malformed body calls `fail("The learning mode needs fixing before it can be
  saved.", issues)`, so the error carries the same `ValidationIssue[]` detail the
  import routes use. Every refusal says "learning mode", never the bare word
  "mode", because that word already names an answer surface and a provider lane.

### 4.12 Tests

- `v1/tests/learning-mode-schema.test.ts` (new): shape cases, the shared answer
  list, mode validation wiring, and a spoiler-free canonical example.
- `v1/tests/seed-modes.test.ts` (new): install, idempotent pass, newer version,
  malformed manifest, failed file then retry, custom row survives.
- `v1/tests/browser-repository.test.ts` (extended): mode round-trip,
  `isBuiltIn` persistence, `clearLibrary`, custom-only backup.
- `v1/tests/browser-router.test.ts` (extended): list, duplicate, built-in
  refusals, malformed body detail.
- `v1/tests/prompt-context.test.ts` (extended): spoiler through the shared
  helper and through `validateCanonicalExample`.

## 5. Non-goals

- No built-in mode content, and no `v1/modes/**` or `v1/public/modes/**`.
- No `make-seed.mjs` change (Track 3 owns it).
- No prompt assembler: `v1/src/lib/provider/**`,
  `v1/src/lib/browser/authoring.ts` and `shared/prompt-layers.ts` are untouched.
- No UI and no client helper: `v1/src/app/**` and `v1/src/lib/client/**` are
  untouched.
- No widening of provider schemas in `v1/src/lib/provider/generate.ts`.
- No change to `flashcards.pack/v1`, to the four shipped packs, or to
  `v1/public/packs/**`.
- No Drift entry is authored by this track.
- No route for AI drafts; Track 2 adds those additively.

## 6. Acceptance evidence

- New and extended tests named in §4.12 are green.
- `npx tsc --noEmit` clean.
- `npx eslint` clean on every changed file.
- `npm run build` green, including `check-pwa`.
- Full `npx vitest run` green, with a total above the base count.
- `npm run check:drift` and `npm run check:drift:staged` green.
- `git status` shows only intended work, and no scratch file or process
  remains.
