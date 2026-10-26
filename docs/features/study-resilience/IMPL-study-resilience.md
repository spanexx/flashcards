# IMPL: Study Resilience

**Slug:** study-resilience
**Status:** Implemented (2026-10-26) — see Delivery Notes
**Date:** 2026-10-26

## Phase Plan

**Before Phase 1:** no new external dependency, so no `opensrc` run is needed.
The worktree was created with `agent-worktree feature study-resilience`; the
project's `node_modules` is symlinked into `v1/` for tests.

**Phase status (2026-10-26):** Phases 1–6 are complete and every verify item is
ticked with real evidence. Phase 7 is complete except for one live browser leg:
the in-app browser could not answer the app's own native restore confirmation, so
Scenario 14's refusal and the offline reload were not read from the screen. Both
are covered by tests and by the two proven halves named in `simulate-post.md`,
and the last Phase 7 checkbox stays unticked for that reason.

### Phase 1: teaching preference module

**Build:**
- `v1/src/lib/client/teaching.ts` — read/write `flashcards.teaching`, default on,
  silent on blocked storage (GRILL Q4–Q5).
- `v1/src/lib/client/layer.ts` — a pure `autoOpenPolicy(policy, autoOpen)` used
  by StudyClient, so the decision is testable without a DOM.

**Verify:**
- [x] `npx vitest run tests/teaching-preference.test.ts` — default, write,
      invalid value, blocked storage, auto-open helper truth table.

**Blocked by:** nothing.

### Phase 2: teaching UI

**Build:**
- `v1/src/app/StudyClient.tsx` — read the preference into state, fold it into the
  `layerOpen` default, expose `dismissAutoOpen` (set off, persist, collapse this
  entry), pass it to the layer.
- `v1/src/app/study/TeachingLayer.tsx` — a "Don't show again" button beside
  Collapse, shown only while automatic opening is on (GRILL Q1–Q2).
- `v1/src/app/settings/TeachingSwitch.tsx` + `SettingsClient.tsx` — the
  Appearance switch "Open the teaching layer automatically" (GRILL Q3).

**Verify:**
- [x] `npm run typecheck && npm run lint`
- [x] `npm run build` succeeds.
- [x] Browser: Scenarios 1–4 from PRD-TRD.

**Blocked by:** Phase 1.

### Phase 3: resume store and snapshot model

**Build:**
- `v1/src/lib/browser/store.ts` — database version 5, new `resume` store in the
  upgrade path and in the store list/MemoryStore.
- `v1/src/lib/browser/repository.ts` — `readStoredSession`, `writeStoredSession`,
  `clearStoredSession`; `clearLibrary` also clears the snapshot (GRILL Q11).
- `v1/src/lib/core/session-resume.ts` — `toStoredSession`, `parseStoredSession`,
  `pruneStoredSession`; version check and queue pruning by live card ids
  (GRILL Q6, Q9).
- `v1/src/lib/browser/session-save.ts` — serialised last-write-wins queue and a
  flush for page hide.

**Verify:**
- [x] `npx vitest run tests/session-resume.test.ts` — round trip, bad version,
      garbage row, prune current/missing/retired/empty, serialised writes, and
      the `resume` store name.
- [x] Existing storage tests still pass.

**Blocked by:** nothing (separate files from Phase 2 except StudyClient, which
Phase 4 owns).

### Phase 4: resume wiring in the Study screen

**Build:**
- `v1/src/app/StudyClient.tsx` — on mount read the snapshot before the plan;
  restore the full state; show "Picked up where you left off."; skip the plan
  endpoint when restored. Save on every meaningful change (debounced), on
  `visibilitychange`/`pagehide`, and on unmount. Clear on finish and stop
  (GRILL Q7–Q10).
- Keep the save/restore in small pure helpers so StudyClient stays readable and
  under the file cap.

**Verify:**
- [x] `npm run typecheck && npm run lint`
- [x] `npx vitest run tests/session-resume.test.ts tests/study-layout.test.ts`
- [x] Browser: Scenarios 5–9 from PRD-TRD, including a real reload and a
      changed-card prune.

**Blocked by:** Phase 3. Must run after Phase 2 because both edit StudyClient.

### Phase 5: repair scanner

**Build:**
- `v1/src/lib/core/json-repair.ts` — one scanner that rewrites syntax only and
  reports kinds; `parseJsonLoose` throws the existing plain error when the text
  is still broken (GRILL Q12, Q15–Q16).
- Unit tests for every kind, combinations, string safety (commas, escaped
  quotes, braces inside strings), idempotence and valid-JSON invariance.

**Verify:**
- [x] `npx vitest run tests/json-repair.test.ts`

**Blocked by:** nothing. Runs in parallel with Phases 1–4; touches different
files.

### Phase 6: repair integration

**Build:**
- `v1/src/lib/browser/bundle.ts` — `readJson` retries through `parseJsonLoose`
  and returns repair kinds; `ImportSuccess` carries `repairs`.
- `v1/src/lib/core/import.ts` — the legacy flat import uses the same repair.
- `v1/src/lib/browser/jobs.ts` — job result carries `repairs`.
- `v1/src/lib/core/json-repair.ts` — `repairClause()` turns the kinds into one
  plain sentence; the screens call it.
- `v1/src/app/JobsDock.tsx`, `v1/src/app/library/PacksPanel.tsx` — render that
  one sentence (`JobsDock.tsx:55`, `PacksPanel.tsx:108`).
- Do not touch backup parsing (GRILL Q13).

**Verify:**
- [x] `npx vitest run tests/browser-bundle.test.ts tests/import.test.ts tests/browser-jobs.test.ts`
- [x] A sloppy cards bundle imports through the job with `repairs` set; a
      truncated one still writes nothing.

**Blocked by:** Phase 5.

### Phase 7: docs, simulation, drift

**Build:**
- `docs/features/teaching-layers/PRD-TRD-teaching-layers.md` — note that
  automatic opening is now learner-controlled.
- `docs/features/background-jobs/PRD-TRD-background-jobs.md` — a malformed
  content import is retried through syntax repair before refusal; backups stay
  strict.
- `docs/features/study-resilience/archive/simulate-pre.html` and canonical
  `simulate.html` — reconciled behaviour.
- `simulate-post.md` — the real browser evidence table.

**Verify:**
- [x] Full suite, `npm run build`, `/flashcards` build, both drift gates.
- [x] Drift review by a fresh sub-agent; gaps fixed or logged.
- [ ] Browser run covers every Simulation Contract item.

**Blocked by:** Phases 2, 4 and 6.

## Phase Dependencies

Phase 1 → 2 → 4 (StudyClient order), Phase 3 → 4, Phase 5 → 6. Phase 7 last.
Phases 1–2 and 5–6 may run in parallel because they share no file.

## Test Strategy

Unit tests live in `v1/tests/` and run with `npx vitest run` from `v1/`. Pure
modules (`teaching.ts`, `layer.ts`, `session-resume.ts`, `json-repair.ts`) carry
the behaviour; the screens are proved by the browser simulation because the
project has no DOM test harness. The browser pass runs against the static export
served on port 4183, in the CI shape (`NEXT_PUBLIC_BASE_PATH=/flashcards`) as
well as at root.

## Dependency Analysis (opensrc)

No new dependency.

## Rollout

Static export; the database upgrade runs on first open (version 4 → 5, additive
store). An older tab without the upgrade ignores the new store. Rolling back the
code leaves an unused store, which is harmless; rolling back the preference
restores the old default.

## Risk Notes

- Restoring a session must not append a second `started` event; the plan route is
  bypassed on restore.
- Snapshot size: a plan with many cards is larger than a settings row; IndexedDB
  handles it, but saves are debounced and serialised to avoid write races.
- A page hide may cut an IndexedDB write; the previous snapshot still restores a
  slightly older position rather than nothing.
- Repair must never touch strings' internal punctuation beyond quote typography;
  the tests pin commas, braces and escaped quotes inside strings.

## Delivery Notes

**Delivered 2026-10-26** on `feature/study-resilience`, merged locally into
`main` before pushing.

### What shipped

- **Teaching layer.** `v1/src/lib/client/teaching.ts` holds the device
  preference; `autoOpenPolicy` in `v1/src/lib/client/layer.ts` carries the
  decision. The layer header offers "Don't show again"
  (`TeachingLayer.tsx:136-140`), and Settings → Appearance offers
  "Open the teaching layer automatically" (`SettingsClient.tsx:354-362`). Both
  write the same key; the folded bar always stays.
- **Resume.** Database version 5 with an additive `resume` store; one snapshot
  row; debounced serialised saves with a page-hide flush; restore before the plan
  load so `started` is recorded once; finish and stop clear the row; the prune
  keeps only active cards, so a deleted or edited card is skipped.
- **Repair.** `v1/src/lib/core/json-repair.ts` rewrites syntax only and reports
  the kinds; `readJson` and the legacy import parse through it; the job result
  and the library screens render one plain sentence; `parseBackup` keeps strict
  `JSON.parse`.

### Gates (run in the worktree, 2026-10-26)

| Check | Result |
|-------|--------|
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm test` | 60 files, 666 tests passing |
| `next build --webpack` + PWA build | succeeded |
| base-path export (`NEXT_PUBLIC_BASE_PATH=/flashcards`), `check-pwa` | passed — 79 files, 77 precache entries |
| `npm run check:drift` | 0 open, 0 awaiting, 25 resolved |
| `npm run check:drift:staged` | passed before the commit |

### Browser evidence

`simulate-post.md` records the run against the static export: Simulation
Contract items 1–6 pass live, item 7 passes by test, item 8 is covered by its
two proven halves. The two live legs that did not run — Scenario 14's refusal
and the offline reload — are stated with their cause, not papered over.

### Found and fixed during the run

- A return could read the snapshot before the debounced write landed;
  `loadResumableSession` now awaits the write chain. Pinned by a slow-store test.
- **D-20 (High):** an edited card did not drop out of the running queue, because
  the prune counted a retired row as live. Fixed in `session-save.ts` and pinned
  by two tests. Doc corrections D-21…D-25 are logged in `docs/drift.md`.

### Follow-up, 2026-10-26 — D-26

The learner's first real import after the push was refused with
`(bundle): the text is not valid JSON: ... at position 2555 (line 1 column
2556)` and nothing else. The file is one line of 15 KB, so the offset named a
character nobody could count to; the break was one glued key,
`{"type":"text bomb":""`, and finding it took a hand scan.

`parseJsonLoose` now quotes the words either side of the failure, capped at
forty characters each way, flattened to one line and marked with `…` where it
was clipped (`v1/src/lib/core/json-repair.ts:289-317`). The repair rules are
unchanged: it still refuses a glued key rather than guess which half was meant.
The learner's own file, unfixed, now reads:

```
The broken part is: …ext","text":"Bread"},{"type":"text bomb":"","text":"Bread"}],"answerDef":{"mode"…
```

Pinned by four tests (`v1/tests/json-repair.test.ts:184-214`) and promised in
Scenario 12 of the PRD.

