# PRD-TRD: Five built-in modes

**Slug:** `built-in-modes`
**Status:** Locked by delegated decision, 2026-11-23
**Date:** 2026-11-23
**Origin:** `docs/features/built-in-modes/GRILL-built-in-modes.txt`
**Track:** 3 of 4. Tracks 1-2 own the mode contract and prompt layers; Track 4
owns Mode Studio. This track owns only the five definitions and the seed emit.
**Design:** `docs/features/built-in-modes/simulate-pre.sh` (design contract)
**Canonical rehearsal:** `docs/features/built-in-modes/simulate.sh` (post-implementation, reads generated files)

## 1. Why this exists

Track 1 shipped the storage row, the strict reader and the browser seed hook for
LearningModes. Track 2 taught both prompt lanes to read a mode's skill text.
Neither shipped a single mode. Mode Studio (Track 4) cannot offer a real list,
and generation cannot benefit from a mode, until five authored modes exist and
a fresh browser can receive them.

This track authors those five modes. Each carries a short Markdown skill and
one small worked example that passes the app's own validators. The generator
adds an output step beside the existing pack seed; it never rewrites a shipped
pack or a Track 1 file.

## 2. What it does

### 2.1 Five definitions, one version

The five ids are fixed: `grammar-roles`, `language-general`, `word-deep-dive`,
`system-architecture`, `programming-language`. Every mode ships at version
`1.0.0`. `usesWordStages` is true only for `word-deep-dive`; the other four
carry no stage or `wordId` in their examples.

- `grammar-roles`: plain-English job plus term in the deck name; role in the
  prompt; no basic -s/-ed drilling; teaching explains intuition. Mix cloze,
  picks, type.
- `language-general`: theme decks; accurate language codes; base-word and
  meaning cues in foreign-language clozes; hear_type with spelling hints. Mix
  cloze, type, hear_type, picks.
- `word-deep-dive`: one word, five progressive decks, stage-to-mode rule, never
  print a changed form, trigger or context stated. Mix cloze, type, picks,
  match.
- `system-architecture`: scenario-driven constraint → pattern prompts;
  trade-off picks; no dictionary definitions. Mix cloze, picks, type.
- `programming-language`: 1-5 line code snippets; language and goal in the
  prompt; picks for subtle bugs; hints explain why. Mix type, cloze, picks.

### 2.2 Authored shape and generated shape

An authored file under `v1/modes/<id>.json` is strict JSON with eight fields:
`id`, `name`, `description`, `version`, `defaultCardMix`, `usesWordStages`,
`skillInstructions`, `canonicalExample`. It does not carry `isBuiltIn` or
`createdAt`; the generator stamps both.

`canonicalExample` is an object, not a JSON string. It is a `flashcards.pack/v1`
bundle with 1-2 decks and 2-4 cards. Every card's `deckId` names a deck in that
same bundle. Every example pack is named `mode-demo-<id>` and is never seeded
or importable as a real pack. No teaching part points at an image or video.

A generated file under `v1/public/modes/<id>.json` adds `isBuiltIn: true` and
one fixed ISO `createdAt` so repeated generation is byte-stable.

### 2.3 Examples pass the app's real rules

Each canonical example must pass `parseBundle`, `hardRuleIssues`,
`spoilerIssues`, `lessonIssues` and `readLearningMode` with zero issues. The
validator does not enforce deck count, card count or deck-id membership, so
tests assert those separately. All five examples use English lines, as the
GRILL locked, so the English-only cloze context checker remains valid. A cloze
either avoids count and possessive answers or names `Base word` / `Owner`.

### 2.4 Additive seed emit

`v1/scripts/make-seed.mjs` gains one block after its current pack-index write.
It reads the five authored files, writes the five generated files and one
`v1/public/modes/index.json`, and prints one line per mode. The manifest
schema is `flashcards.mode-index/v1`; each entry is `{id, version, file}` with
`file` pointing at `/modes/<id>.json`. The track plan also lists `name`, but the
Track 1 reader strips unknown keys, so emitting it would be dead data.

No line of the existing pack loop changes. `v1/public/packs/**` stays
byte-for-byte identical after regeneration, proved with a hash snapshot and
`git diff --exit-code -- v1/public/packs`. `make-seed.mjs` is not part of
`npm run build`; stale generated files are a failure the tests must catch.

### 2.5 Browser install behaviour

Track 1's `ensureModesSeeded()` reads the manifest once on app start. A fresh
browser receives five built-in rows with `isBuiltIn: true`. Re-seeding the same
version fetches no files. A strictly newer version replaces that built-in row
only. A learner-owned row with the same id wins and is never replaced. A broken
manifest or one broken mode file is silent and isolated; the other four still
install and the next start retries. No mode is selected by default, so a
learner who never picks one keeps today's prompt wording.

## 3. Simulation contract

`docs/features/built-in-modes/simulate-pre.sh` is a print-only design walk with
hardcoded facts: five authored files, mode shape, validator rules, generated
manifest, fresh install, re-seed, broken input and what must not happen. It
writes no file and ends with the direction line.

`docs/features/built-in-modes/simulate.sh` reads the real generated files under
`v1/public/modes/` without a network call and without a build. It prints, in
order:

1. Exactly five generated mode files and five manifest entries.
2. The manifest schema and the three-field entry shape.
3. Per mode: version `1.0.0`, `isBuiltIn: true`, fixed `createdAt`, card mix,
   `usesWordStages`, 1-2 decks and 2-4 cards with real deck ids.
4. That `word-deep-dive` is the only mode with word stages.
5. That no example name starts `mode-demo-` in the pack manifest.
6. The four shipped pack bundles are unchanged.
7. A final `PASS: 0 problem(s)` line, or `FAIL: N problem(s)` with every problem
   and a non-zero exit code.

The pre-sim needs no user input; the post-sim fails with a non-zero exit when a
generated file is missing, malformed, or disagrees with the contract above.

## 4. Technical design

### 4.1 `v1/modes/*.json` (new)

Five files, one per id, owned by a single authoring job so version, wording and
cue style stay consistent. Markdown skill text, no image/video parts, English
example lines, demo pack namespace, fixed stage map for `word-deep-dive`.

### 4.2 `v1/scripts/make-seed.mjs` (additive only)

Add roots and the five-id list near the top; add one emit block after the
existing pack-index write. Read each authored file with the existing `readJson`
helper, stamp `isBuiltIn` and `createdAt`, write pretty JSON with a trailing
newline, and build the manifest in sorted id order. Never `rm` the output
folder; never touch the pack loop.

### 4.3 `v1/public/modes/**` (generated)

Six files: five mode bundles plus `index.json`. No other generated output.

### 4.4 `v1/tests/built-in-modes.test.ts` (new)

Strict `JSON.parse` on all eleven authored/generated files; exact five ids;
required fields and enums; version `1.0.0`; `usesWordStages` true only for
`word-deep-dive`; `readLearningMode` and `validateCanonicalExample` clean;
deck/card counts and deck-id membership; demo pack naming; no image/video
parts. Parametrize per mode so one file can be checked before all five land.

### 4.5 `v1/tests/mode-seed.test.ts` (new)

Reuse `v1/tests/seed-modes.test.ts` helpers: strict manifest parse, stubbed
fetch, fresh store. Prove fresh install, idempotent re-seed, newer-version
replace, learner copy left alone, wrong schema, broken file with retry, and id
mismatch. Add one check that the generated manifest serves the real files.

### 4.6 Boundaries

Track 3 does not edit `router.ts`, `modes.ts`, `seed.ts`, `repository.ts`,
`store.ts`, `schema.ts`, `card.ts`, `pages.ts`, `prompt-context.ts`,
`word-check.ts`, `bundle.ts`, `v1/packs/**`, `v1/public/packs/**`, any prompt
module, `v1/src/app/**`, or a live Drift entry.

## 5. Non-goals

- No Mode Studio screen and no default mode selection.
- No change to the four shipped packs or their manifest.
- No new core schema, card rule, word rule or page rule.
- No change to Track 1's loader or seed hook.
- No image or video asset added to an example.
- No new runtime dependency.

## 6. Acceptance evidence

```bash
cd v1
npx vitest run tests/built-in-modes.test.ts tests/mode-seed.test.ts tests/seed-modes.test.ts tests/seed-packs.test.ts
sha256sum public/packs/*.json > /tmp/opencode/packs-before.sha   # snapshot outside repo
node scripts/make-seed.mjs
sha256sum -c /tmp/opencode/packs-before.sha
git diff --exit-code -- public/packs
bash ../docs/features/built-in-modes/simulate.sh
npx tsc --noEmit
npx eslint <changed files>
npm run build
npm test
npm run check:drift && npm run check:drift:staged
```

All five examples pass the validators; five built-ins install with
`isBuiltIn: true`; no `mode-demo-*` pack appears in `/api/packs`; pack bytes are
unchanged. Report test file and test counts from the full run.
