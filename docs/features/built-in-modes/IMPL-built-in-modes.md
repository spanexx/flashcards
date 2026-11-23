# IMPL: Five built-in modes

**Slug:** `built-in-modes`
**Status:** Locked by delegated decision, 2026-11-23
**Date:** 2026-11-23
**Origin:** `docs/features/built-in-modes/GRILL-built-in-modes.txt`
**Contract:** `docs/features/built-in-modes/PRD-TRD-built-in-modes.md`
**Design:** `docs/features/built-in-modes/archive/simulate-pre.sh`

## Phase order

Each phase is its own commit-sized change. Tests are written first and seen to
fail for the right reason before code lands. One logical change per commit.

1. Origin docs and design sim (GRILL, PRD-TRD, IMPL, simulate-pre.sh).
2. Red tests and the seam contract.
3. Five authored mode files.
4. Additive seed generator and generated output.
5. Post-sim, drift review, reconciliation and gates.

## Phase 1 — origin docs and design sim

**Files:** `GRILL-built-in-modes.txt`, `PRD-TRD-built-in-modes.md`,
`IMPL-built-in-modes.md`, `simulate-pre.sh`.

- GRILL locks English examples, no default mode, version `1.0.0`.
- Pre-sim prints nine design sections with hardcoded facts; no repo writes.

**Proof:** `bash docs/features/built-in-modes/archive/simulate-pre.sh` exits 0 and prints
the direction line. Design direction confirmed by the learner.

## Phase 2 — red tests

**Files:** `v1/tests/built-in-modes.test.ts`, `v1/tests/mode-seed.test.ts` (new).

- Parametrize content checks per mode id so a single file can be validated
  before all five exist.
- Assert the full mode shape, strict JSON, `readLearningMode`, validator clean,
  deck/card counts and real deck ids.
- Reuse `seed-modes.test.ts` stubs for install, idempotence, newer version,
  learner copy, broken file and id mismatch.
- Add a manifest check against generated files only after Phase 4.

**Proof:** `npx vitest run tests/built-in-modes.test.ts tests/mode-seed.test.ts`
fails because `v1/modes/**` and `v1/public/modes/**` do not exist.

## Phase 3 — five authored mode files (one isolated authoring job)

**Files:** `v1/modes/grammar-roles.json`, `language-general.json`,
`word-deep-dive.json`, `system-architecture.json`, `programming-language.json`.

- One job owns all five files so version, cue style and Markdown tone match.
- Each example is English, 1-2 decks, 2-4 cards, namespaced `mode-demo-<id>`.
- `word-deep-dive` carries the one word and stage cards; no stage fields on the
  other four.
- No image or video teaching parts.

**Proof:** `npx vitest run tests/built-in-modes.test.ts` green. One file failing
must name that file, not the whole set.

## Phase 4 — additive seed generator (serial after Phase 3)

**Files:** `v1/scripts/make-seed.mjs` (additive block only),
`v1/public/modes/**` (generated).

- Add mode roots, five-id list and a fixed ISO stamp.
- Emit five generated modes and `index.json` after the existing pack-index
  write; sorted, pretty JSON with trailing newline.
- Never alter the pack loop and never delete the output folder.

**Proof:** `node scripts/make-seed.mjs`; hash snapshot proves
`v1/public/packs/**` unchanged; `git diff --exit-code -- v1/public/packs`;
`npx vitest run tests/mode-seed.test.ts tests/seed-packs.test.ts` green.

## Phase 5 — post-sim, drift review, reconcile, gates

**Files:** `simulate.sh`, optional `simulate-post.md`, `archive/simulate-pre.sh`.

- Post-sim reads real generated files, no network and no build, prints one line
  per PRD-TRD scenario and ends `PASS: 0 problem(s)` or a non-zero `FAIL`.
- Fresh-eyes sub-agent compares PRD-TRD + IMPL against code and the sim; fix or
  document gaps with the learner before reconciliation.
- Collapse both sims to one canonical `simulate.sh`.

**Proof:** `bash docs/features/built-in-modes/simulate.sh` green;
`npx tsc --noEmit`; eslint on changed files; `npm run build`; full `npm test`
once; both drift gates; clean `git status`.

## Out of scope

No UI, no default mode, no Track 1 file, no pack change, no provider schema, no
new dependency, no live Drift entry.

## Risks and how they are handled

- **Manifest `name` mismatch.** PLAN §3.1 lists `name`; the reader strips it.
  PRD-TRD §2.4 locks the three-field entry; tests assert it.
- **Validator does not check deck ids or counts.** Tests assert membership and
  1-2 decks / 2-4 cards explicitly.
- **English-only cloze checker.** GRILL locks English examples; count and
  possessive cards use explicit cues.
- **Strict vs loose JSON.** `parseBundle` repairs JSON; the seed does not.
  Tests strict-parse every authored and generated file.
- **Stale generated files.** `make-seed` is not run by the build; the sim and
  tests read the generated files directly.
- **Fixture id collision.** `browser-router.test.ts` already uses
  `grammar-roles`; install tests use fresh stores and direct
  `ensureModesSeeded()` calls, never the cached router seed pass.

## Delivery note — 2026-11-23

- Fresh-eyes review closed before ship: added the fourth `matching`-stage card
  to `word-deep-dive`, replaced the printed plural distractor, aligned three
  skill lines with their examples, corrected the five-stage wording, added
  wrong-schema and id-mismatch install tests, and made the post-sim print a
  `FAIL` summary for unreadable files.
- Regenerated `v1/public/modes/**`; all six shipped pack hashes unchanged.
- Full gates: build green with `check-pwa: passed`; full suite 96 files /
  1220 tests; 56 targeted tests; typecheck, eslint, both drift gates green.
- Reconciled sims: `archive/simulate-pre.sh` keeps the design record;
  `simulate.sh` is canonical. Review evidence is in `simulate-post.md`.

## Open Drift — 2026-11-23

- **D-54 Resolved.** `built-in-modes.test.ts` now fails when a generated mode
  file no longer matches its authored source. Evidence is in `docs/drift.md`.
