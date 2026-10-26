# IMPL: Browser-owned flashcards

**Slug:** browser-app
**Status:** Implemented (drift blockers D1-D5 fixed; Q1-Q5 open)
**Date:** 2026-10-20

## Phase Plan

### Phase 1: Browser-safe core

**Build:**
- Replace `node:crypto` hashing in `core/card.ts` with a synchronous
  browser-safe hash; keep prefixes and stability.
- Replace `node:crypto` UUID imports in `core/evidence.ts` and `core/plan.ts`
  with global `crypto.randomUUID()`.
- Move settings pure helpers out of the file-backed module so the browser can
  normalize settings without `server-only`.
- Remove `server-only` from provider prompt/client/generate/hint; inject the
  provider config instead of reading `.env`.
- Keep the existing core tests green.

**Verify:**
- [x] `npm test` — core suite passes
- [x] `npm run typecheck`

**Blocked by:** nothing

### Phase 2: Store, repository and bundle

**Build:**
- `lib/browser/store.ts` — IndexedDB adapter + memory adapter with one
  interface.
- `lib/browser/repository.ts` — packs, cards, evidence, sessions, settings,
  prompt log, meta, provider key.
- `lib/browser/bundle.ts` — zod bundle schema, validate, import (whole pack,
  decks into a pack, cards into a deck), export pack, backup/restore, seeding.
- Tests: identity, additivity, duplicates, version refusal, all-or-nothing,
  backup round trip, key exclusion.

**Verify:**
- [x] `npm test` — new browser repository/bundle tests pass
- [x] 326 tests pass. Global coverage thresholds pass: 93.45% statements,
  84.8% branches, 96.61% functions, 96.12% lines. Reported honestly per module:
  `router.ts` 85.74/77.32, `provider.ts` 91.83/81.33, `authoring.ts` 100/90,
  `autosave.ts` 91.83/82.75; the browser folder is 89.97/81.02. These are
  reported, not rounded up to a blanket ≥90 claim.

**Blocked by:** Phase 1

### Phase 3: Local router and client seam

**Build:**
- `lib/browser/router.ts` — every URL the screens use, backed by the repository.
- `lib/browser/provider.ts` — status/key/test/prepare/generate/hint with direct
  browser fetch and the local prompt log.
- `lib/client/api.ts` — call the router instead of `fetch`.
- Remove API routes from the build; archive the server-only modules.

**Verify:**
- [x] The four screens load and study with the local store
- [x] No client module imports `server-only` or `node:*`
- [x] `npm run build` produces a static export

**Blocked by:** Phase 2

### Phase 4: Library surfaces

**Build:**
- Library shows packs and their decks, with create/import/export targets.
- Card creation and import choose a deck.
- Authoring-skill panel: target picker, copy prompt, paste/file import.
- Backup and autosave controls in Settings.

**Verify:**
- [x] Create a pack, deck and card; reload keeps them
- [x] Import a bundle into each target; broken bundle refuses
- [x] Authoring prompt contains the target's real ids; Download .md and
  paste/file answer import work in the browser walkthrough

**Blocked by:** Phase 3

### Phase 5: Seed migration and static verification

**Build:**
- Convert `packs/polish-starter` (topics -> decks) plus the learner's extra
  cards into `public/packs/polish-starter.json`.
- Seed on first boot when the library is empty.
- `scripts/simulate-browser.mjs` walks the simulation contract with the memory
  adapter.

**Verify:**
- [x] First boot: 1 pack, 6 decks, 32 cards
- [x] `npm run simulate:browser` walks seed, create, all three import targets,
  newer/older versions, duplicates, plan, provider fallback, backup/restore,
  malformed-backup refusal, authoring prompt and answer import, and the built
  pages. The real desktop file picker stays a manual/unit-tested path.
- [x] `npm run typecheck`, `npm run lint`, `npm run build`

**Blocked by:** Phase 4

## Phase Dependencies

1 -> 2 -> 3 -> 4 -> 5. Phase 3 can start only after the bundle contract in
Phase 2 is stable.

## Drift Reconciliation

The 2026-10-20 drift report found five blockers. They are closed in code and
covered by tests:

| Gap | Resolution |
|---|---|
| D1 | The Library has a create-pack form (name, version, first deck); it posts `/api/packs` through the same bundle validator. The simulation uses it. |
| D2 | Bundle import and chat authoring both offer `new`, `pack` and `deck`; the router preserves all three targets. |
| D3 | An existing deck id keeps its stored name; imports never rename, delete or move. |
| D4 | Deck choices send `pack::deck`; the router resolves pack + deck and refuses a missing pair. Pack rows use `pack.name` as the key. |
| D5 | Every target applies the newer-only rule. `deck` imports keep the installed version. Unparseable versions are refused rather than treated as older. |

Non-blocking follow-up: N1-N5 and N7-N8 are fixed; N9 now covers the browser
walkthrough and simulation paths, with the real desktop file picker left to its
unit seam; N10 is removed from the technical route list. N6 remains the low-risk
residual: restore validates everything before clearing, but the clear/write
sequence is not one transaction. Questions Q1-Q5 remain open in the drift report
and do not block the browser rebuild.

## Test Strategy

- Existing `vitest` suite stays. Core tests are updated only where identity or
  UUID mechanics changed.
- New tests live in `v1/tests/browser-*.test.ts` and use the memory adapter.
- The static build is checked by `next build`; the simulation script runs the
  domain logic directly.

## Dependency Analysis (opensrc)

No new external dependencies. `zod`, `semver`, `next`, `react` already exist.
IndexedDB is a platform API; tests use the project's own memory adapter.

## Rollout

- `v1/` is replaced in place. The old server routes are archived under
  `v1/archive/server-app-api/` for history; they are not part of the build.
- First boot seeds the converted Polish pack.
- No learner data migrates from the prototype except the converted cards; the
  evidence and logs stay behind by decision.

## Risk Notes

- `next build` with `output: "export"` fails if any client module imports
  `server-only` or `node:*`.
- Some providers block direct browser calls (CORS). The UI must name that in
  plain words and never pretend the call happened.
- IndexedDB writes are asynchronous; the repository must serialize writes for
  cards/evidence so a fast answer loop cannot interleave a read-modify-write.
- File System Access API is Chromium-only; the phone path must stay manual.

## Delivery note 2026-10-26: CORS refusal named

A live provider call from the deployed site was stopped by the browser's CORS
preflight, and `callProvider` flattened it into "could not be reached", which
read like a dead network. The unreachable sentence now says the provider is
probably refusing calls from this site (CORS) and tells the learner to ask the
provider to allow the site or use one that does. The timeout, HTTP and empty
sentences are unchanged, and the call still is not retried.

Verification: `tests/provider-client.test.ts` pins the CORS sentence; full suite,
typecheck, lint and both drift gates pass.
