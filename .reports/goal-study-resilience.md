# Goal: the study flow never nags, never loses a running session, and repairs sloppy JSON imports

**Contract**
- Outcome: three learner behaviours ship together on `feature/study-resilience`: a dismissible teaching-layer auto-open, a running session that survives in-app navigation and reload, and a JSON import that repairs syntax before refusing.
- Evidence: targeted unit tests per module; full suite; typecheck, lint, build at root and with `NEXT_PUBLIC_BASE_PATH=/flashcards`; a browser pass over all 14 PRD scenarios recorded in `simulate-post.md`; `check:drift` and `check:drift:staged` green; Pages workflow green after push.
- Scope: `v1/src/app/StudyClient.tsx`, `v1/src/app/study/TeachingLayer.tsx`, `v1/src/app/settings/*`, `v1/src/lib/client/{teaching,layer}.ts`, `v1/src/lib/core/{session-resume,json-repair,import}.ts`, `v1/src/lib/browser/{store,repository,session-save,bundle,jobs}.ts`, import summaries in `JobsDock`/`PacksPanel`, docs under `docs/features/study-resilience/` plus short notes in two shipped packs, `docs/drift.md` if a gap is found. No change to plan, offer, scoring, evidence rules or backups.
- Authority: delegated by the learner on 2026-10-26 for design inside this scope; the learner's message explicitly authorises commit and push at the end. Decisions recorded in `GRILL-study-resilience.txt`.
- Budget: 4 attempts per failure class; bounded commands only.

**Pipeline:** feature-pipeline, entry at Phase 0 (GRILL written and locked by agent under delegation), then pre-impl sim, PRD-TRD, IMPL, implementation, post-impl browser sim, drift review, reconcile.

**Worktree:** `/home/spanexx/.config/superpowers/worktrees/flashcards/feature-study-resilience` (branch `feature/study-resilience`).

## Iterations

### 1 — 2026-10-26T00:44
Action: read the goal skill, ethics, feature-pipeline and surgical-change; classified all three requests as new behaviour (feature-pipeline) because no locked decision covers them; created the worktree with `agent-worktree feature study-resilience`; symlinked `v1/node_modules`.
Verification: `git rev-parse --abbrev-ref HEAD` -> `feature/study-resilience`; `npx vitest --version` -> 4.1.12.
Verdict: pass.
Failure class: none.
Pivot: none.
Next: write GRILL, pre-sim, PRD-TRD, IMPL; delegate implementation.

### 2 — 2026-10-26T00:44
Action: wrote `GRILL-study-resilience.txt` (16 locked decisions), `simulate-pre.html` (design stubs for all three behaviours), `PRD-TRD-study-resilience.md` (14 scenarios) and `IMPL-study-resilience.md` (7 phases).
Verification: files exist at the worktree paths; GRILL ends with "No remaining open questions."
Verdict: pass.
Failure class: none.
Pivot: pre-sim sign-off cannot be a user gate in this run (the learner asked for end-to-end completion); the design sim is preserved and the agent ran it as the delegated reviewer. Recorded in the GRILL header.
Next: delegate Phases 1–4 (study) and 5–6 (import) to parallel sub-agents with disjoint files.

### 3 — 2026-10-26
Action: delegated implementation to two sub-agents with disjoint files (teaching preference + UI, resume store + wiring; repair scanner + integration), then integrated their work and read every changed file.
Verification: `npm run typecheck` -> 0; `npm run lint` -> 0; targeted suites for teaching, resume, repair and bundle pass.
Verdict: pass.
Failure class: none.
Pivot: none.
Next: build the export and run the browser contract.

### 4 — 2026-10-26
Action: built the static export, served it at `127.0.0.1:4183` from Windows-bound WSL, and walked Simulation Contract items 1–5 in the in-app browser.
Verification: the in-app return resumed one keystroke behind — `loadResumableSession` read the row before the debounced write landed. Fixed by awaiting the write chain; pinned by a slow-store test that failed first ("expected undefined to be 2").
Verdict: pass after the fix.
Failure class: read-before-write race.
Pivot: none.
Next: finish the contract, including the backup and offline legs.

### 5 — 2026-10-26
Action: walked the remaining live legs. Scenario 14 opened the app's native restore confirmation, which wedged the in-app browser's page commands (browser-level calls still answered); recorded the limit and added a unit test that pins the strict backup refusal.
Verification: Scenarios 1–13 pass live; the new backup test passes; offline not run, covered by its two proven halves.
Verdict: pass by test where the tool blocked the live leg.
Failure class: tool limitation (native dialog), not product code.
Pivot: replaced the un-runnable live leg with a test rather than claiming a screen reading.
Next: write the post-impl simulation and reconcile the pack docs.

### 6 — 2026-10-26
Action: wrote `simulate-post.md`, made the reconciled `simulate.html` canonical, archived the pre sim, and corrected the IMPL file list after grep showed `repairClause()` lives in `json-repair.ts`, not `library-utils.ts`.
Verification: every cited path and test name read back from the tree.
Verdict: pass.
Failure class: none.
Pivot: none.
Next: run the full gates, then the drift review.

### 7 — 2026-10-26
Action: ran the gates and the base-path build.
Verification: typecheck 0, lint 0, 60 files / 663 tests; webpack build succeeded; base-path export validated by `check-pwa` (79 files, 77 precache entries). The first check run failed because the env var was scoped to the build command only — the export was correct, and re-running the checker with `NEXT_PUBLIC_BASE_PATH` set passed.
Verdict: pass.
Failure class: command shape, not code.
Pivot: none.
Next: fresh-eyes drift review.

### 8 — 2026-10-26
Action: a fresh-eyes sub-agent compared every doc claim with the code. It found one behaviour gap — an edited card (retired old row) stayed in the running queue — and five documentation gaps (nonexistent test file, Q11 contradiction on restore, stale line cites plus a nonexistent error type, a cross-pack scenario reference, and the refused-import sentence).
Verification: fixed the prune to use active cards only, added two tests (one fails without the fix), repointed every citation, and logged D-20…D-25. `npm run check:drift` -> 0 open, 0 awaiting, 25 resolved. Full gates after the fix: typecheck 0, lint 0, 60 files / 666 tests.
Verdict: pass.
Failure class: doc-vs-code drift; one real behaviour gap.
Pivot: none — the fix sat inside the locked decision for Q9.
Next: stage, run the staged gate, commit, merge into main locally, push.

