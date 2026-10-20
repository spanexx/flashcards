# Drift Review: browser-app

**Date:** 2026-10-20
**Reviewer:** sub-agent
**Feature pack:** `docs/features/browser-app`
**Verdict:** **SHIP-READY WITH FOLLOW-UPS** (reconciled after fixes)
**Original verdict:** NOT SHIP-READY

## Reconciliation After Fixes

The findings below are the original review. D1-D5 were fixed and verified after
this review; the original failure table is kept as history, not as current
status.

| Scenario | Current result | Evidence |
|---|---|---|
| 1 Seed | Pass | Static walkthrough: 1 pack, 6 decks, 32 cards. |
| 2 Create pack + card | Pass | Browser walkthrough created `walk-pack`, wrote a card, reloaded, still present. |
| 3 Whole-pack import | Pass | Simulation: import + bad-bundle refusal. |
| 4 Add deck / cards to a pack | Pass | Simulation adds a deck through the `pack` target; walkthrough imports a card through the `deck` target. |
| 5 Newer adds / older refuses | Pass | Bundle/router tests cover all three targets; simulation checks newer/older. |
| 6 Study across decks | Pass | Simulation plan spans 7 decks. |
| 7 Direct provider; local key | Pass | Missing-key fallback and key-present status tested; backup excludes key. |
| 8 Backup/restore | Pass | Simulation restores; malformed evidence row is refused before changes. |
| 9 Autosave | Pass with manual note | Unit seam covers choose/schedule/start; static walkthrough verifies the Settings card. A real OS file-picker run stays manual. |
| 10 Authoring return path | Pass | Walkthrough downloaded the `.md`, pasted an answer, imported 1 card, reloaded it. |

Current verification (2026-10-20): **326 tests pass** across 30 files; typecheck,
lint, static build, and `simulate:browser` pass. Global coverage is **93.45%
statements / 84.8% branches / 96.61% functions / 96.12% lines**. Browser folder
is 89.97/81.02; `router.ts` is 85.74/77.32. The former blanket "new modules
>=90%" claim was replaced with these honest numbers (N4).

Residual follow-ups: N6 (restore validates before clearing but is not one
transaction), the real desktop file-picker run (N9), and open questions Q1-Q5.
None was found to break the locked browser contract.

## Summary

The storage rewrite is real: IndexedDB is the only store, the static export has
no API routes, the Polish seed is correct, and the provider key stays out of the
backup. The domain layer also has meaningful tests.

The learner-facing and import-write contracts are not done. The build has no
in-app pack creation form, the deck-only import target cannot be chosen, deck
imports can rename an existing deck, a second pack with the same deck id can
send cards into the wrong pack, and `new` is the only target that enforces the
newer-version rule.

Blocking gaps found: **5**

- D1. No in-app create-pack form; Scenario 2 cannot be performed as written.
- D2. The deck-only import target is missing from the UI and is silently turned
  into `new` by the router.
- D3. Import can rename an existing deck, contrary to "an import never deletes,
  moves or renames".
- D4. Deck choices are keyed only by deck id, so two packs that both have
  `basics` can send a card or import into the wrong pack.
- D5. Only the `new` target checks versions. `pack` and `deck` imports overwrite
  the installed pack version, including downgrading it.

Non-blocking gaps found: **10** (N1-N10 below).
Open questions: **5** (Q1-Q5 below).

### Verification basis

- The test suite contains **301** `it(...)`/`test(...)` declarations across
  `v1/tests`. This matches the stated count.
- The existing `v1/coverage/coverage-final.json` says global **90.77%**
  statements, **80.76%** branches, **94.23%** functions. This matches the stated
  global figures.
- The existing `v1/out/` static export contains the four screens and the seed
  asset, and contains no `api` directory.
- I could not re-run the suite in this workspace. `npm test` cannot resolve
  `vitest`, and running the vitest entry point directly fails on a missing
  Rolldown native binding. Findings below come from source inspection plus the
  existing coverage and export artifacts. This does not change the code gaps;
  it only means the passing suite was not re-confirmed by me.
- Source was checked for client-reachable `server-only` and `node:*` imports.
  None were found in `src/app`, `src/lib/browser`, `src/lib/client`, or the pure
  core/provider modules. The old server-only modules remain outside the build.
- The workspace is not a git repository. This is a recorded process deviation in
  the GRILL, so it is not counted as a new gap.

## Scenario Evidence

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Seed Polish starter | Pass | `bundle.ts:479-493`; `browser-bundle.test.ts:250-284`; seed is 1 pack, 6 decks, 32 cards; `simulate-browser.test.ts:56-62` |
| 2 | Create a pack with one deck, then write a card | **Fail** | Card creation exists, but there is no pack form. Empty state says to drop a folder; router says "Create a pack first" (`LibraryClient.tsx:450-451`, `router.ts:250`). See D1. |
| 3 | Import a whole pack, refuse a broken bundle | Pass | `importBundle` validation and all-or-nothing tests (`browser-bundle.test.ts:81-94`, `:150-170`); simulation line 64. |
| 4 | Add cards or a deck to an existing pack | **Partial** | Cards-only works. The deck-only target is absent from UI/router; adding a deck through `new` changes the target rules. See D2. |
| 5 | Re-import a newer version; refuse older | **Partial** | Newer/older works for `new` (`browser-bundle.test.ts:106-121`). Rename and version writes still violate the update rule. See D3/D5. |
| 6 | Study across decks | Pass | Plan scoped by deck; `simulate-browser.test.ts:107-110` asserts more than one deck in a plan. |
| 7 | Provider called directly; prompt shown; key local; no host | Pass | Key read/write in IndexedDB; backup excludes it (`browser-bundle.test.ts:212-218`); provider tests use direct calls; prompt log appended in `browser-router.test.ts:208-264`. No host route is used. |
| 8 | Backup and restore; malformed backup refused | **Partial** | Round trip and key exclusion pass (`browser-bundle.test.ts:212-248`). Evidence/session/prompt rows are `z.unknown()`; valid JSON with bad rows is accepted. See N3. |
| 9 | Autosave on desktop; manual on phone | **Partial** | Code and unit tests exist (`browser-autosave.test.ts:96-135`). No browser walkthrough; `chooseAutosaveFile`, scheduling, and start are not exercised. See N9. |
| 10 | Authoring prompt copied, answer pasted back | **Partial** | Prompt builder and tests exist; the panel has copy but no Download .md or paste/file box. Prompt examples can produce a refused or downgraded import. See N1/N2. |

## Blocking Gaps

### D1. No in-app create-pack form (High)

**Contract**

- `wayfinder/anything-learning-spec/tickets/browser-owned-packs.md:114-116`:
  "The in-app create form builds it; import and export use it. At least one
  deck; cards may start empty."
- `docs/features/browser-app/PRD-TRD-browser-app.md:30-35`, Scenario 2: "the
  learner creates a pack with one deck and writes one card into it."
- `docs/features/browser-app/IMPL-browser-app.md:65-72` lists "create/import/
  export targets" and checks "Create a pack, deck and card; reload keeps them".

**Found**

- `v1/src/app/library/LibraryClient.tsx:492-502` offers only "Create or update a
  whole pack" (bundle import) and "Add cards to one deck"; there is no pack name,
  version, or first-deck form.
- `LibraryClient.tsx:636-645` has "Write a card" and "Import a batch" only.
- `LibraryClient.tsx:450-451` still says, "No packs found. Drop a pack folder
  into the packs folder and read it again."
- `v1/src/lib/browser/router.ts:248-250` and `:354-355` tell the learner to
  "Create a pack first." There is no create-pack route; `router.ts:411` handles
  `GET /api/packs` only.
- The simulation creates its pack with `importBundle(miniBundle(), {kind:
  "new"})` (`v1/tests/simulate-browser.test.ts:64`), not with a create form.

**Why it matters**

A brand-new learner with an empty library can only create a pack by importing a
complete JSON bundle or by generating one in an outside chat. The ticket
explicitly requires an in-app form, and the IMPL check is marked done. The empty
state is also still written for the old folder-scanned prototype.

**Fix**

Add a create-pack form (pack name, version, first deck id/name), build the same
bundle shape, and pass it through the same validator/import path. Remove the
folder wording. If import is intended to be "create", rewrite the ticket,
PRD Scenario 2, IMPL check, and UI copy to say so; do not leave the form promised
and absent.

### D2. The deck-only import target is not reachable (High)

**Contract**

- GRILL locked decision 5 (`GRILL-browser-app.txt:26-27`): three targets: whole
  pack, decks-only into a chosen pack, cards-only into a chosen pack and deck.
- PRD Scenario 4 (`PRD-TRD-browser-app.md:44-49`): "imports cards into a chosen
  deck, or a deck into the pack."
- `wayfinder/.../deck-import.md:29-31` repeats the three targets.

**Found**

- `v1/src/app/library/LibraryClient.tsx:499-502` has only `value="new"` and
  `value="deck"`. There is no "add a deck to a pack" option.
- The panel copy at `LibraryClient.tsx:495-496` says one file can "add decks to a
  pack", but the control cannot do it.
- `v1/src/lib/browser/router.ts:473-481` parses `{kind:"pack", packName}` as
  `{kind:"new"}` because it only checks `kind === "deck"`. A client sending the
  third target is silently downgraded.
- The domain layer does support `target.kind === "pack"` (`bundle.ts:217-231`),
  and `browser-bundle.test.ts:171-187` tests it. The surface is what is missing.
- The authoring panel can build a `{kind:"pack"}` prompt
  (`LibraryClient.tsx:341-344`), but the import panel cannot receive that target.

**Why it matters**

Scenario 4's deck branch cannot be performed as specified. Using "Create or
update a whole pack" for a deck-only file is not the same target: it applies the
new-pack version rule and updates pack metadata instead of adding a deck to the
chosen pack.

**Fix**

Add the third option to the import picker, send `{kind:"pack", packName}`, and
teach the router to parse it. Add a router test that imports a deck-only bundle
into an existing pack. Keep the copy on the panel truthful.

### D3. Import can rename an existing deck (High)

**Contract**

- GRILL locked decision 6 (`GRILL-browser-app.txt:28-30`): "An import never
  deletes, moves or renames."
- `wayfinder/.../deck-import.md:34-36`: "Deck ids are stable across versions.
  Import never deletes, moves or renames a card."

**Found**

- `v1/src/lib/browser/bundle.ts:262-265`:
  `const existing = decks.get(deck.id); if (existing) { existing.name = deck.name; }`
- This runs for `new` and `pack` targets, not only for a deck target. A bundle
  that contains an existing deck id with a different display name silently
  changes the stored deck name.
- The authoring prompt makes this likely: `v1/src/lib/browser/authoring.ts:55`
  prints the first existing deck id beside the generic name `Everyday basics`.
  A chat that copies the example can create this exact collision.
- The test named "adds a newer version without deleting or renaming anything"
  (`v1/tests/browser-bundle.test.ts:106-113`) does not include an existing deck
  with a changed name, so it does not catch the behaviour.

**Why it matters**

A re-import can silently change the learner's deck label. Evidence survives
because deck identity is the id, but the visible library is modified in a way the
contract forbids. It is also a one-step path from the shipped authoring prompt.

**Fix**

For an existing deck id, keep the stored name and ignore or refuse a different
incoming name. A deliberate rename must be a separate learner action. Add a test
with the same deck id and a different name for both `new` and `pack` targets.

### D4. Deck ids are not pack-qualified, so cards can land in the wrong pack (High)

**Contract**

- GRILL locked decision 2 (`GRILL-browser-app.txt:18-20`): pack -> deck -> card;
  a card belongs to exactly one deck; the pack declares its decks.
- GRILL decision 5: cards-only content goes into a chosen pack and deck.
- PRD Scenario 2/4: the learner writes into, or imports into, a chosen deck.

**Found**

- `v1/src/app/library/LibraryClient.tsx:79-87` builds one flat choice list with
  only `{id, name, pack}`.
- The write-card picker (`:669-671`), batch-import picker (`:714-717`), and
  bundle-deck picker (`:505-507`) all use `value={choice.id}`. The pack name is
  only a label.
- `writeCard` sends only `deckId` (`LibraryClient.tsx:207-213`); `runImport` sends
  only `deckId` (`:279-282`); `runBundleImport` looks up a choice by id
  (`:300-301`).
- `v1/src/lib/browser/router.ts:238-246` scans packs and takes the **first**
  deck with that id. `importFlatCards` at `:350-357` also falls back to the first
  placement and never receives a pack name from this UI.
- `v1/src/lib/browser/repository.ts:228` gives every pack the same
  `folder: "This browser"`, and `LibraryClient.tsx:466` uses `key={pack.folder}`.
  That is a duplicate React key for every pack, and it confirms the UI does not
  treat packs as distinct containers in these lists.

**Why it matters**

Deck ids only need to be unique inside a pack. Two packs that both have a
`basics` deck are normal. The picker shows `Pack B · Basics`, but the code sends
`basics` and the router writes into Pack A. This silently puts the card or import
in the wrong pack. The same ambiguity affects the bundle import and the authoring
deck picker.

**Fix**

Use a composite value such as `packName + "::" + deckId`, or send both
`packName` and `deckId` and resolve the pair. Do not scan by deck id alone.
Use `key={pack.name}` for packs. Add a test with two packs sharing a deck id.

### D5. Only the `new` target enforces the version rule, and other targets overwrite pack version (High contract, latent in the UI)

**Contract**

- GRILL locked decision 6: same name plus a newer version updates additively;
  an older version is refused with a plain reason.
- PRD Scenario 5: newer adds; older is refused.

**Found**

- `v1/src/lib/browser/bundle.ts:233-247` only compares versions when
  `installed && target.kind === "new"`.
- `bundle.ts:309-320` always writes `version: bundle.pack.version`, so a
  `deck` or `pack` target replaces the installed version with the file's
  version, even when that version is older.
- `compareVersions` returns `null` when either version cannot be coerced
  (`bundle.ts:146-152`); `order !== null && order < 0` therefore lets an
  unparseable older version through.
- This is currently hard to reach through the UI because the `pack` and `deck`
  targets are missing (D2), but the domain methods and tests call those targets,
  and the authoring deck prompt hardcodes `1.0.0` (N1).

**Why it matters**

Once the missing targets are wired, a cards-only import can move a pack
backwards. Even before that, direct router/domain use and future UI work will
exercise the hole. Version is part of pack identity and update ordering.

**Fix**

Apply the newer-only rule to every target that writes pack metadata. For a
`deck` target, preserve the installed pack version rather than copying the
file's version. Treat an unparseable version as a plain refusal or as equal, and
document which. Add tests for all three targets and for bad version strings.

## Non-Blocking Gaps

### N1. Authoring prompt contains wrong examples (Medium)

- `v1/src/lib/browser/authoring.ts:34` and `:53` hardcode
  `"version": "1.0.0"` in the worked examples. The prose at `:105` and `:123`
  correctly names the target pack's real version.
- `authoring.ts:55` pairs the first existing deck id with `Everyday basics`,
  even when that deck's real name is `Basics`. The prompt claims the answer is
  "shaped like this", so a chat may copy the wrong name and trigger D3.
- `v1/tests/browser-authoring.test.ts:40-45` only checks that the prose contains
  `1.2.3`; it does not check the example. There is no golden test that the prompt
  and validator agree, despite ticket resolution 6
  (`wayfinder/.../authoring-skill.md:47-48`).
- **Fix:** interpolate the real version and a real deck name; for an existing
  pack, either show `"decks": []` or a non-colliding new deck id. Add a test that
  extracts the example and parses it with `parseBundle`.

### N2. Authoring panel is missing its return path (Medium)

- `v1/src/app/library/LibraryClient.tsx:832-890` has the target picker, Build,
  Copy, and Clear. It has no Download .md, no paste box, and no file picker.
- The ticket says the panel should have "target picker, Copy prompt, Download
  .md, paste box, file picker, and three plain steps"
  (`wayfinder/.../authoring-skill.md:44-46`); IMPL Phase 4 says "paste/file
  import" (`IMPL-browser-app.md:67`).
- The panel copy instead sends the learner to Packs -> Import a bundle. That
  path works, but it is not the promised panel and it cannot import the
  `{kind:"pack"}` target (D2).
- **Fix:** add Download .md and a paste/file drop zone inside the panel, using
  the same import path and target picker. Or amend the ticket and IMPL and keep
  the cross-link.

### N3. Backup validation accepts malformed rows (Medium)

- `v1/src/lib/browser/bundle.ts:400-403` declares `evidence`, `sessions`, and
  `prompts` as `z.array(z.unknown())` and `settings` as `z.unknown()`.
- `restoreBackup` validates only that outer shape (`:443-444`), clears the
  library, then casts the unknown entries to `EvidenceRow`, `SessionEvent`, and
  `PromptLogEntry` (`:463-466`). A syntactically valid backup with garbage rows
  is accepted.
- The test at `v1/tests/browser-bundle.test.ts:233-239` only checks invalid JSON.
- Restore is also not transactional: `clearLibrary()` at `:451` happens before
  the writes, and a later quota or store error leaves a partly restored library.
  `suspendChanges` prevents autosave from overwriting the file, but it does not
  roll back IndexedDB.
- **Fix:** add zod schemas for the row shapes and validate before clearing.
  Prefer one transaction or a staging store plus swap. Add a test with valid
  JSON and an invalid evidence row.

### N4. The coverage checkbox is false for browser modules (Medium)

- `IMPL-browser-app.md:42` checks "Coverage for the new modules >= 90%".
- The existing report shows statements/branches:
  - `router.ts`: 78.79% / 63.72%
  - `autosave.ts`: 52.27% / 48.15%
  - `changes.ts`: 63.64% / 100%
  - `provider.ts`: 88.78% / 78.67%
  - `authoring.ts`: 95.24% / 71.43%
  - `bundle.ts`: 92.49% / 85.04%
  - `repository.ts`: 96.51% / 90.91%
- `v1/vitest.config.ts:39-46` excludes `src/lib/browser/store.ts` entirely,
  calling it browser-only. The ethics rule says the new modules should carry
  coverage, and the IndexedDB adapter is the production store.
- The global thresholds (lines 90, branches 80, functions 90) pass because the
  old core modules are well covered. That does not make the new-module claim
  true.
- **Fix:** add router target tests, autosave choose/schedule tests, changes
  subscription tests, and a browser adapter test or an explicit documented
  exclusion with a walkthrough. Then either meet 90% or rewrite the checkbox.

### N5. A duplicate card inside one bundle is not reported (Low)

- `v1/src/lib/browser/bundle.ts:303-306` builds `known` from stored cards only.
  `fresh = cards.filter((card) => !known.has(card.id))` does not add each kept id
  to `known`, so two identical cards in the same file both pass.
- Both are counted as added, but `upsertCards` stores one by id. The duplicate
  count is 0.
- Scenario 4 says a repeated card is reported as a duplicate. The tests cover a
  repeat across two imports, not within one file.
- **Fix:** add kept ids to `known` while filtering, or dedupe the incoming array
  by id before counting. Add a test.

### N6. Restore write failure is not atomic (Low; see N3)

- `restoreBackup` clears first (`bundle.ts:451`) and writes sequentially
  (`:453-466`). If a write throws, the function returns through `finally` with
  `restored = false`; the library is already gone or partly rebuilt.
- **Fix:** validate fully first and write in one transaction, or keep a staged
  copy until the new library is complete.

### N7. Stale prototype wording and missing edit origins (Low/Medium)

- `v1/src/app/library/LibraryClient.tsx:451`: "Drop a pack folder into the packs
  folder and read it again." There is no folder in the browser build.
- `LibraryClient.tsx:23`: "One attempt, resolved on the server." The server is
  gone.
- `LibraryClient.tsx:194`: "The pack folder was read again." Rescan is a no-op
  (`router.ts:468`).
- `v1/src/app/settings/SettingsClient.tsx:5`: "where the folders are."
- `v1/README.md:1-96` still describes a local process, folders, a server-side
  key, `npm run start`, and `npm run simulate`; the browser build has none of
  those.
- `LibraryClient.tsx`, `SettingsClient.tsx`, and `layout.tsx` carry only
  `PACK: v1-prototype` headers. They contain browser-build changes but no
  `2026-10-20 ... [pack: browser-app]` edit log. New browser files do carry the
  required headers.
- `router.ts` helpers such as `asRecord` (`:71`), `asString` (`:76`), `asNumber`
  (`:80`), and `asStringArray` (`:85`) have no comments above them. The file has
  a good module header and section comments, but the commenting rule asks for
  each piece of code to explain itself.
- **Fix:** replace folder/server wording, update the README to the browser
  build, add edit logs to modified screens, and document the helpers.

### N8. Duplicate React keys and folder status (Low)

- `packStatus` gives every pack `folder: "This browser"`
  (`v1/src/lib/browser/repository.ts:228`), and the pack table uses
  `key={pack.folder}` (`LibraryClient.tsx:466`). Every row has the same key.
- This is mostly a console warning today, but it is the same "packs are not
  distinct containers" mistake as D4.
- **Fix:** use `key={pack.name}` and stop using `folder` as browser identity.

### N9. Scenario 9 and 10 evidence is not end-to-end (Low/Medium)

- Autosave tests call `autosaveNow` and `autosaveState` with a fake handle
  (`browser-autosave.test.ts:96-135`). `chooseAutosaveFile`, `scheduleAutosave`,
  `startAutosave`, permission re-request, and a real desktop/phone walkthrough
  are not tested.
- The simulation test does not touch autosave, does not paste an authoring
  answer back through import, and does not try a malformed backup row.
- The PRD says the simulation walks every scenario; the IMPL check
  `simulate-browser passes every scenario` (`IMPL-browser-app.md:88`) is broader
  than what the script actually does.
- **Fix:** add a desktop walkthrough result (or a browser test), cover the
  chooser and scheduler, and add authoring paste-back and bad-backup-row cases
  to the simulation. Narrow the checkbox wording if the walkthrough remains
  manual.

### N10. `/api/autosave` is in the technical design but has no route (Low)

- `PRD-TRD-browser-app.md:149` lists `/api/autosave` among the technical URLs.
- `router.ts` has no such path, and no screen calls one; autosave imports the
  module directly. This is a doc-only route, not a missing screen path.
- **Fix:** remove it from the technical list or mark it as a direct module call.

## Questions To Settle

1. **Is "create" allowed to mean "import a complete bundle"?** The ticket says
   an in-app form; the code only has import and chat. If import is the intended
   create lane, the ticket, PRD Scenario 2, IMPL check, and empty state all need
   one consistent wording. If not, D1 is a real missing feature.
2. **Are manual cards exempt from the pack + deck + content identity rule?**
   `createCard` uses `manualCardId(crypto.randomUUID())` (`router.ts:272-276`),
   so two identical manual cards have different ids. GRILL decision 7 says a
   card is named by pack + deck + content. This may be a deliberate exception
   for edits, but it is not stated.
3. **Should a generated card that exactly matches an imported card overwrite
   the imported origin?** `generatePrepared` builds with `deckId`, so it uses
   content identity, and `upsertCards` replaces the row. The card content is the
   same, but the origin and timestamps change. GRILL decision 9 says the tutor
   never edits an imported card in place. Is this collision acceptable?
4. **Should unknown bundle fields be refused or stripped?** `cardSourceSchema`
   allows `key` and zod strips `topics`. A bundle with `topics` is accepted and
   ignored, which is friendlier but is not a field-name refusal. Decide which
   behaviour the validator promises.
5. **Should a CORS failure name CORS itself?** The provider status says some
   providers refuse browser calls (CORS) (`provider.ts:50`), but a failed
   request is reported as "could not be reached". The GRILL says CORS is
   "named, not hidden"; the status line may be enough, but the failure text
   should be clear.

## What Passed

- IndexedDB is the only store. There are no server API routes in `src/app` and no
  API output in `v1/out`.
- No client-reachable `server-only` or `node:*` imports were found.
- The static export exists with index, library, progress, settings, and the seed
  asset.
- The seed is correct: 1 pack, 6 decks (`cases`, `aspect`, `agreement`,
  `past-tense`, `basics`, `questions`), 32 cards, no card topics, no evidence.
- The seed runs once, only when the library is empty, and a missing seed does
  not block the app (`bundle.ts:479-493`).
- The provider key lives in IndexedDB, is never returned to the screen, and is
  excluded from backup and autosave (`repository.ts:196-208`;
  `browser-bundle.test.ts:212-218`; `browser-autosave.test.ts:110-114`).
- Direct browser provider calls, prompt preview, prompt log, no-key fallback,
  and prepared-prompt expiry are implemented and tested at the unit level.
- The router handles every URL the screens actually call. Extra routes are
  harmless; the only documented route with no handler is `/api/autosave` (N10).
- The import validator refuses known-field errors with index and field names,
  and the domain import is all-or-nothing on validation failure.
- New browser modules have `WHY` / `PACK` / `2026-10-20` headers. No unapproved
  dependency was added; `package.json` still has the same runtime dependencies.

## Execution Check Against IMPL

| Phase | Status | Note |
|---|---|---|
| 1 - Browser-safe core | Pass | Core tests exist; no server-only in client path. |
| 2 - Store, repository, bundle | Partial | Domain import works; coverage checkbox is false (N4); store adapter excluded. |
| 3 - Router and client seam | Pass | All screen URLs handled; static export; no server-only client imports. |
| 4 - Library surfaces | Partial | No create-pack form, no deck target, authoring panel lacks return path (D1, D2, N2). |
| 5 - Seed and static verification | Partial | Seed and export pass; simulation does not cover autosave, authoring paste-back, or malformed backup rows (N9). |

## Fix Order

1. Add the create-pack form and wire the missing `pack` import target; make the
   router preserve all three target kinds. (D1, D2)
2. Stop renaming decks on import and enforce the newer-version rule for every
   target that writes pack metadata. Preserve the installed version for a
   cards-only import. (D3, D5)
3. Make deck choices pack-qualified in the UI and router. Fix the duplicate pack
   key. (D4, N8)
4. Fix the authoring prompt examples and add the Download .md / paste / file
   return path. (N1, N2)
5. Validate backup rows fully and make restore atomic. (N3, N6)
6. Add the missing tests until the new-module coverage claim is true. (N4, N5)
7. Replace stale folder/server wording, update the README, add edit origins, and
   document the router helpers. (N7)
8. Re-run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and
   `npm run simulate:browser`; do a desktop autosave walkthrough and a phone
   manual-save check. Only then update the IMPL checkboxes and status. (N9)

## Final Verdict

**SHIP-READY WITH FOLLOW-UPS.**

The original blocking gaps are closed: create pack works in-app, all three
import targets are reachable, imports never rename a deck, deck choices are
pack-qualified, and every target enforces the newer-only version rule. The
static build, simulation, and browser walkthrough pass. The remaining items are
the low-risk non-transactional restore (N6), the manual real-file-picker check
(N9), and the open product questions (Q1-Q5); they are recorded, not hidden.
