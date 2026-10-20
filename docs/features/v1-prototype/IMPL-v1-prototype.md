# IMPL — Flashcards v1 prototype

**Pack:** `v1-prototype`
**Status:** approved for prototype build by the user's request of 2026-10-19
**Contract:** `PRD-TRD-v1-prototype.md`

## Phase 0 — Scaffold

Files: `v1/package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`,
`vitest.config.ts`, `.gitignore`, `.env.example`, `README.md`.

Proves: `npm run test` runs a smoke test; `npm run typecheck` runs.

## Phase 1 — Card and pack core

Files under `v1/src/lib/core/`, `v1/src/lib/packs/`.

- Card types, canonical content, stable identity, hard-rule validation.
- Part and answer-surface validation.
- Pack manifest/cards/prompts schemas, semver range check, broken-pack errors.
- Adoption into learner cards, duplicate prevention, retired-card handling.

Tests: identity stability, duplicate collapse, validation failures, broken pack
is skipped without throwing, changed content makes a new card.

## Phase 2 — Evidence and judging

Files under `v1/src/lib/core/`.

- Outcome vocabulary and ranking.
- Loose/exact normalisation, edit distance, hint cap, Again/No choice.
- Per-region rows, attempt aggregation, correction resolution.
- Append-only repository read/write.

Tests: each outcome, hint cap, correction resolution, seen-before count, card
attempt aggregation, append-only guarantee.

## Phase 3 — Algorithm, plan and progress

Files under `v1/src/lib/core/algorithm/`, `plan.ts`, `progress.ts`.

- Default selection with topic round-robin and reasons.
- Sanity check and immediate fallback.
- Offer adjustment from session facts.
- Progress read: improvements, faster cards, next work, strengths.
- No stored conclusions.

Tests: unseen first, wrong cards chosen, variety, sanity failure falls back,
improvement requires early wrong, first-time correct never improves, weakness
is work not a lack.

## Phase 4 — Storage and configuration

Files under `v1/src/lib/storage/` (`paths.ts`, `json.ts`, `jsonl.ts`, `mutex.ts`),
`v1/src/lib/core/settings.ts`, `v1/src/lib/bootstrap.ts` and
`v1/src/lib/repository.ts`.

- Path resolution, atomic JSON, append-only JSONL, mutex.
- Settings defaults, profile fields, folders.
- Bootstrapping: ensure folders, adopt packs, load settings.

Tests: missing files return defaults, concurrent writes do not interleave,
data survives a restart, folder environment works.

## Phase 5 — Provider boundary

Files under `v1/src/lib/provider/`.

- Key store adapter and 0600 fallback; provider status.
- OpenAI-compatible client, call-time configuration, WSL loopback swap.
- Prompt builder for generation and hints from pack text plus three app slots.
- Prepared-request store; exact preview text.
- Generation parser, full-line-to-blank derivation, all-or-nothing validation.
- Prompt log.

Tests: key never in status, prompt contains only categories, prepared prompt is
exactly what is sent, malformed generation is refused, WSL swap happens only on
WSL, provider URL is built correctly.

## Phase 6 — API routes

Files under `v1/src/app/api/`.

Thin route handlers over the core. Each route validates its body, catches known
errors, and returns plain messages. All routes are Node runtime. No route
imports into a client component.

Tests: covered by the post-impl simulation against the running app.

## Phase 7 — Interface

Files under `v1/src/app/`: one folder per screen, each with a small client
component beside it (`StudyClient.tsx`, `library/LibraryClient.tsx`,
`progress/ProgressClient.tsx`, `settings/SettingsClient.tsx`). There is no
separate components folder.

- A fixed left sidebar as the only navigation, with a compact content column.
- Home, study, progress, library, settings.
- Study loop with plan, four surfaces, hint, reveal, working comparison,
  correction, returning cards, no-report ending. The plan is a compact header
  with reasons and tutor banner in disclosures; review hides the plan.
- Progress with Overview and Every card tabs, and an evidence panel sliding in
  from the right (correction entry points per row).
- Library with Packs / Add cards / Generate tabs; pack list in a scroll area;
  manual entry and import behind buttons with a file chooser; generate holds
  prepare, exact prompt preview, copy and send.
- Settings with Profile / Provider / Prompts / Data tabs, one rendered at a
  time.

Delivery note 2026-10-19: the learner reviewed the first layout and asked for
a compact, patterned shell — sidebar, tabs, disclosures, lists that scroll in
place. Locked in `wayfinder/anything-learning-spec/tickets/ui-shell.md` and
GRILL round 2 (U1); arrangement only, no route or behavior change.

Tests: the post-impl simulation; a manual browser walkthrough.

## Phase 8 — Sample pack and docs

Files under `v1/packs/polish-starter/`, `v1/README.md`.

- Manifest, 32 Polish cards over cases, aspect, agreement, past tense,
  vocabulary, picks and hear-then-type, including a two-blank cloze card and a
  working-region card.
- Prompts for generation and the tutor.
- Pack README explains the plain-file format.

## Phase 9 — Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:coverage`
- `npm run build`
- `npm run simulate` against a production server with a temporary data folder
- Manual browser walkthrough on loopback

## Phase 10 — Drift and reconcile

- Post-impl simulation is a different script from the pre-impl design mirror.
- A review sub-agent compares the contract, the code and the sims.
- Gaps are fixed or logged in `.reports/`.
- `simulate.mjs` becomes the canonical simulation; the pre-impl mirror is
  archived.

Done 2026-10-19: review report in `.reports/2026-10-19-drift-v1-prototype.md`;
every gap fixed in code or docs (see `docs/drift.md` D-1…D-9); canonical
simulation is `v1/scripts/simulate.mjs`; `simulate-pre.html` carries an archive
note. Live review added D-10 and D-11 the same day. The manual browser
walkthrough is in progress with the learner.

## Reconciliation (2026-10-19)

- `npm run test:coverage`: 240 tests in 23 files; 95.86 / 87.14 / 96.34 /
  97.32 percent (statements / branches / functions / lines) — thresholds met.
- Typecheck, lint and production build pass with no warnings.
- `npm run simulate`: 10 of 10 checks against a production server, including a
  two-blank card writing two rows under one attempt and 14 response bodies
  swept for key material. The simulation clears the provider variables itself,
  so a local `.env` provider cannot leak into the run.
- The drift review's nine findings became `docs/drift.md` D-1…D-9; all resolved
  the same day. Live review added D-10 (WSL host address now comes from the
  default route, not the nameserver) and D-11 (saving cards drops the cached
  boot state, so a written card appears at once), plus the diacritics decision
  (`diacritics-not-required.md`, PRD §4.8): loose judging folds diacritics,
  exact stays strict.
- The learner's provider was exercised live from the browser host: `provider
  test` ok, generation produced two validated Polish cards, and a tutor hint
  answered in the session — all against the model on the learner's machine.
- Deliberate movement from the paper design, now recorded here: storage split
  into `storage/` and `core/settings.ts`; screens live in `app/` with their
  client component beside them; generate is a block inside the Library, not a
  page; progress section words follow the PRD; the study screen shows the
  pack's working beside the learner's working (R16).

## Build order

1 → 2 → 4 → 3 → 5 → 6 → 7 → 8 → 9 → 10. Storage comes before algorithm because
the algorithm reads stored evidence; provider comes after the offline loop is
solid, so the app never depends on it.
