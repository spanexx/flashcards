# IMPL: Teaching Layers

**Slug:** teaching-layers
**Status:** Draft
**Date:** 2026-10-25
**Contract:** `PRD-TRD-teaching-layers.md` (approved 2026-10-25)

## Order and Gates

Each phase ends with `npm run typecheck`, the named tests, and a short note in
this file. Later phases do not start before the previous phase passes. The
user's instruction on 2026-10-25 authorized starting with phases 1–4 (core
storage and bundle logic); phases 5+ keep their own gate.

## Phase 1: Types and schema foundation

**Files:** `src/lib/shared/types.ts`, `src/lib/core/schema.ts`,
`src/lib/core/card.ts`

- Add `StudyLevel`, `TeachingPart`, `MediaRecord`, `Tombstone`; add `level` to
  `Deck`, `teaching` to `Card` and `CardSource`, and both flags to `EvidenceRow`.
- Add the teaching-part schema: only text/image/video; image alt required;
  http(s) web sources; `media-*` local ids; 11-character YouTube ids; whole
  second start/end with `end > start`; builtin paths under `/packs/` with no
  `..`.
- Add `studyLevelSchema`; use it for bundle decks with a default of intermediate.
- `buildCard` carries `teaching`; `canonicalContent` still omits it.
- Tests: valid/invalid teaching parts, identity unchanged by teaching, build
  round trip.

## Phase 2: Storage seam

**Files:** `src/lib/browser/store.ts`, `src/lib/browser/repository.ts`,
`src/lib/browser/media.ts`, `src/lib/core/media.ts` (new)

- Add `media` and `tombstones` stores; raise IndexedDB version to 4 additively.
- Normalise missing deck levels to intermediate in `readPacks`/`readPack`.
- Media helpers: write a Blob record, read one, read all, delete one, list
  referenced ids from cards (teaching local parts and side media parts), and
  delete unreferenced media without touching retired cards' references.
- `clearLibrary` deliberately keeps `media` and `tombstones`.
- Tests: memory store round trip, normalization, reference collection and GC.

## Phase 3: Identity, bundle and pack reconciliation

**Files:** `src/lib/browser/bundle.ts`, `src/lib/core/card.ts`

- Export and import teaching on bundle cards; decks carry `level`.
- Whole-pack import: matching ids update teaching and the version note in
  place; absent pack-origin cards in decks named by the bundle are retired
  (evidence kept); existing deck ids take the bundle's level and keep their
  name; deck/card fragments never retire.
- Backup schema carries both evidence flags, teaching and optional tombstones;
  restore preserves tombstones and media.
- Tests: layer-only update, side change retirement, fragment safety, level
  update, backup round trip.

## Phase 4: Zip backup, pack archive and autosave

**Files:** `src/lib/browser/archive.ts` (new), `src/lib/browser/bundle.ts`,
`src/lib/browser/autosave.ts`, `package.json`

- Add `fflate@0.8.3` (MIT).
- `exportBackupZip`: `backup.json` plus `media/<id>.<ext>`, media stored without
  compression.
- `restoreBackupFile(blob)`: sniff zip vs JSON; validate before writing;
  restore rows; write media without deleting existing media.
- `exportPackArchive(name)`: JSON when no local media, zip with `pack.json`
  plus `media/` otherwise.
- `importPackFile(blob, target)`: validate, write new media, import; roll back
  newly written media if the import refuses.
- Autosave writes the zip Blob, suggests `.zip`, and disconnects an old `.json`
  handle with a plain message.
- Tests: zip round trip, JSON fallback, pack zip only with media, rollback,
  no overwrite of existing media.
- This phase stays headless on purpose. The Settings screen still downloads
  JSON and accepts pasted text; wiring its file download, file restore and pack
  archive picker to the archive module moves to Phase 8, where the other file
  pickers land.

## Phase 5: Seed engine and manifest

**Files:** `src/lib/browser/seed.ts` (new), `src/lib/browser/router.ts`,
`scripts/make-seed.mjs`, `public/packs/index.json`

- Manifest install/update per pack, dismissals, deleted-card tombstones, silent
  retry, never blocking reads.
- Extend the seed script to emit both bundles, levels, teaching and built-in
  SVG.
- Tests: fresh install, newer update, dismissed pack, deleted card, failure
  retry.

## Phase 6: Media pipeline

- Image resize to 1600 px / 1 MB (JPEG, PNG, WebP); video cap 20 MB; plain
  refusals; Blob storage.
- Failure rendering: web image placeholder, YouTube thumbnail pre-check and
  fallbacks, missing local file with "Choose the file again".
- Tests: pure validators and browser sim for failures.

## Phase 7: Study layer and cold repeat

- Per-card level resolution; beginner auto-open, intermediate folded, advanced
  after reveal; collapsible modal above the full stage.
- Queue entries keyed by instance; `helpSeen` and `coldCheck` flags on answer
  rows; one return per card; suppress the layer on the repeat.
- Progress and scheduling exclude cold-check rows.
- Tests: return-rule helper, evidence rows, level resolution.

## Phase 8: Editor and authoring

- Three-step teaching editor with add/move/remove, preview, required alt,
  local image/video pickers, YouTube id extraction.
- Separate "Teaching" action updates in place; side edits copy the layer and
  retire the old card.
- Settings: download the backup zip, restore from a chosen file, and offer the
  pack archive from the pack screen; keep the paste path for JSON.
- Generation prompt and authoring skill ask for a short layer, optional media,
  no answer leak.
- Tests: save-in-place identity, editor validation, prompt text.

## Phase 9: Built-in packs

- Browser Dev (14 decks) and Polish from Scratch (12 decks), ten cards each,
  levels per the PRD; one authored SVG and one verified YouTube video per
  Browser Dev deck.
- Human fact and language check is a release gate; the agent flags anything it
  cannot verify.

## Phase 10: Post-impl simulation, drift, reconcile

- Build `simulate.html` against the real app, run every item in the Simulation
  Contract, run the drift sub-agent, then collapse the pre/post sims into one
  canonical file.

## Validation Commands

```bash
cd v1
npm run typecheck
npm run test -- tests/teaching-schema.test.ts tests/card.test.ts \
  tests/browser-media.test.ts tests/browser-bundle.test.ts \
  tests/browser-archive.test.ts tests/browser-autosave.test.ts
npm run lint
```

## Notes

- 2026-10-25: phases 1–4 authorized by the user's "start implementation of
  the core storage and bundle logic". No UI or pack content in this slice.
- 2026-10-25: phases 1–4 complete. `typecheck`, `lint`, and 112 targeted tests
  pass. Local media ids use `media-<uuid>` so a zip entry is safe on Windows;
  the PRD wording was synced to match.
- 2026-10-25: final check green: `typecheck`, `lint`, and the full v1 suite
  (48 files, 501 tests) pass, including the five simulation suites after
  `npm run build`. Provider-generated decks now carry `level: "intermediate"`,
  the bundle default, so generated packs and decks match imported ones.
- 2026-10-25: the worktree branch predates main's drift tooling (main has
  `1bfcf4d`); `check:drift` is deferred until the branch is brought up to date
  at the commit/review gate.
- 2026-10-25: phase 5 complete. `src/lib/browser/seed.ts` owns manifest
  install/update, pack dismissals and deleted-card tombstones; the router
  remembers one pass per start. `scripts/make-seed.mjs` writes both bundles
  and `public/packs/index.json`, and `check-pwa` refuses a manifest entry that
  names a missing or mismatched file. Typecheck, lint, 10 seed tests, 36
  bundle tests and 47 router tests pass. The `seeded` meta flag was removed
  because the manifest is now consulted on every start; tests that still write
  it are harmless.
- 2026-10-25: phase 6 complete. `core/media-rules.ts` owns the 1600 px / 1 MB
  image limits and the 20 MB video limit with plain refusals;
  `browser/media.ts` resizes through a canvas (PNG stays PNG, then falls back
  to WebP) and stores the result. `app/TeachingMedia.tsx` renders built-in,
  web, YouTube and local media with one plain failure message each; a YouTube
  still check gives up after six seconds. Typecheck, lint and 17 media tests
  pass.
- 2026-10-25: phase 7 complete. `client/layer.ts` owns the pure rules
  (deck level, placement, one-return, wording, speech lines). The study queue is
  keyed by instance (`entryId`) so a returning card gets its own result, while
  `returnedRef` keeps the one-return-per-card promise. The layer panel sits
  above the stage (no backdrop, no `aria-modal`) so the card stays answerable;
  Listen uses device speech only. Answer rows carry `helpSeen` and `coldCheck`,
  corrections copy both, and `realAttempts()` keeps cold checks out of
  summaries and progress. Flag chips appear in both record surfaces.
  Typecheck, lint and the full suite (51 files, 542 tests, after `npm run
  build`) pass. Reconcile note: the pre-impl sim showed a wrong return without
  the layer; PRD Scenario 8 keeps the normal presentation, and the
  implementation follows the PRD. The beginner case submits `helpSeen: true`
  when the layer was open: `StudyClient.tsx:402` submits
  `layerOpen || peeked`. (Phase 7 first said `false`; the post-impl run
  corrected it, and the code has always submitted the truth the layer shows.)
- 2026-10-25: phase 8 complete. `client/teaching-editor.ts` holds the pure
  row/part conversions, and `app/library/TeachingEditor.tsx` is the three-step
  wizard; it saves through `PATCH /api/cards/:id/teaching`, so the card keeps
  its identity and evidence. A side edit copies the layer to the new card. A
  new deck follows the learner's current level unless the form chooses one.
  Settings download and restore a zip (the paste path stays for old JSON
  backups), and the pack screen exports or imports a pack archive. The
  authoring skill is 5.0.0 and both prompt builders ask for a short layer that
  never gives the answer away and never claims a video is verified;
  `generatedLineSchema` validates `teaching` with the shared part schema.
  Typecheck, lint and the full suite (52 files, 565 tests, after `npm run
  build`) pass. The create-flow sim now expects a second deck at the learner's
  level (beginner in a fresh store), not the bundle's intermediate default.
- 2026-10-25: phase 9 complete. `packs/browser-dev` ships 14 decks and 140
  cards, one authored SVG per deck and one YouTube video per deck. Every video
  id passed oEmbed and the hqdefault still check: VSMqUF6kNA0, fxplz32rgEQ,
  NO5kUNxGIu0, rIO5326FgPE, NmH7qRscP28, 69IbzTWg5PM, 2CC0fugc_2o,
  ZaOZFkHTloM, 07c9vKj47vk, e2nkq3h1P68, cGiSr0MilsI, 6IlTjqU_Tc0,
  M2Cm_Q_i8PI, VInAd-GJZec. No start or end times were invented.
  `packs/polish-from-scratch` ships 12 decks and 120 typing cards. `make-seed`
  writes both bundles and `public/packs/index.json`; `tests/seed-packs.test.ts`
  (9 tests) pins the manifest, deck ids and levels, ten cards per deck, 1–3
  part layers, 11-character YouTube ids, built-in image files and Polish
  typing mode. Typecheck, lint, `npm run build` (PWA check passed) and the full
  suite (53 files, 574 tests) pass. Content check: all 110 Polish word entries
  matched English Wiktionary, and the ten letter names matched the Polish
  alphabet table (three homographs and one failed request made the table the
  deciding source for those). `sklep` appears twice by design; `dzień dobry`,
  `dobry wieczór` and `do widzenia` stay as two-word entries. Seven Browser Dev
  teaching lines that stated their own answer were rewritten, and an
  answer-leak scan over both packs reports zero. Human release gate still
  applies to every browser fact, every Polish word, every pronunciation
  respelling, and whether each video still plays and allows embedding (oEmbed
  cannot prove embedding permission); `jabłko` → YAHP-koh is the respelling to
  eyeball. `public/packs/polish-starter.json` stays tracked as the fixture for
  four older simulation tests and is not in the manifest.
- 2026-10-25: phase 10 complete. Drove the real export in Chrome (localhost:4183,
  service worker `ac24d627b6ad5a0b`) through all thirteen contract items; the
  evidence is in `simulate-post.md`. One real defect surfaced and was fixed: a
  dead YouTube id looked alive because its 404 body is a valid 120x90 JPEG, so
  `youtubeStillIsDead` now judges the still by size and the dead id falls back to
  a plain link. The contract wording for item 1 was wrong (a beginner never gets
  a cold repeat; `returnReason` returns "cold" only for an intermediate peek),
  and the phase 7 `helpSeen` note was corrected above. The simulations are
  reconciled into `simulate.html` (canonical) with the pre-impl copy kept in
  `archive/`. Three behaviours outside the contract are recorded, not changed:
  the pack row counts pack-origin cards while the shelf total counts all cards;
  a pack re-imported after dismissal keeps its tombstone, so a later manifest
  bump skips it; a restored media record keeps bytes but not width/height.
- 2026-10-27: D-28 and D-29 fixed after the learner noticed Generate still sent
  the old prompt. The cards builder now appends the same teaching rule when a
  pack ships its own template, and only once when the app's default template
  already carries it. Generated packs and decks store the level the request was
  prepared with, and cards are prompted at the deck's level while the global
  level stays the fallback for a new container. Scenarios 20 and 21 name both
  behaviours; `tests/provider-prompt.test.ts`, `tests/provider-flow.test.ts`,
  `tests/browser-router.test.ts` and `tests/simulate-create-flow.test.ts` pin
  them. Full suite 60 files / 678 tests, typecheck and `npx eslint src tests`
  clean, both drift gates green.
