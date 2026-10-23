# Goal: Flashcards overhaul

## Goal Contract

**Outcome:** A learner can direct what to learn and create, long-running generation/import work does not block them, study cards never reveal answers, the study screen feels deliberate on desktop and phone, and the app installs as a PWA from a working GitHub Pages deployment.

**Acceptance evidence:**
- Pack 1 `creation-control`: targeted Vitest, full `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and a built-app browser lane that chooses an explicit learning goal, edits a chat prompt with library inventory, and creates with Write then extends with Generate/Chat.
- Pack 2 `background-jobs`: 426 tests pass; fake-timer tests prove the retry schedule and terminal states; a built-app browser lane starts generation/import, leaves Create through the app's own navigation, sees live status and completion, imports a good file, explains a bad file, and recovers from a reload.
- Pack 3 `study-experience`: tests prove no answer leaks before judging, listening cards state the task and never print the answer, tutor hints return useful text, and a pack/deck can be chosen for study.
- Pack 4 `pwa-deploy`: built output has a manifest and service worker, phone-width browser checks pass, the existing full checks stay green, the GitHub Actions Pages workflow succeeds, and the live Pages URL returns the app shell.
- Final gate: full `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run simulate:create-flow`, external browser lane, and live deployment check.

**Scope:** `v1/` app code, styles, tests, static assets, `docs/features/`, `.github/workflows/`, and Pages deployment settings. The app must stay fully usable without a provider and must keep existing browser data readable. No new runtime dependency unless the pack records why.

**Authority:** `delegated` by the user on 2026-10-22. The user explicitly asked for autonomous decisions, isolated worktrees, repeated review/fix, and a GitHub Pages deployment, and said not to wait for approval. Decisions are recorded in each pack's GRILL file and this ledger.

**Budget:** Four packs. At most three attempts per failure class. Stop on missing access, an ethics conflict, an unowned public contract change, or a failure that survives a real strategy change.

**Stop conditions:** Verified acceptance evidence for all four packs; a hard blocker; or the attempt budget is exhausted.

## Pack Order

1. `creation-control` — issue 1.
2. `background-jobs` — issue 2 and the provider timeout retry behavior.
3. `study-experience` — issues 3, 4, and 5.
4. `pwa-deploy` — issues 6 and 7.

## Iterations

### 1 — 2026-10-22T04:00

**Action:** Activated the goal, wrote the contract, created `feature/creation-control` with `agent-worktree`, and selected feature-pipeline with delegated decisions. The original `prompt` file in the repository root was moved to `C:\Users\shuga\AppData\Local\Temp\opencode\flashcards-goal-prompt.txt` so the worktree tool could run; it was not part of the project.

**Verification:** `agent-worktree feature creation-control` -> `WORKTREE_READY=1`, branch `feature/creation-control`.

**Verdict:** pass

**Failure class:** none

**Pivot:** none

**Next:** Record delegated creation decisions, inspect the current creation flow, and build Pack 1.

### 2 — 2026-10-22T20:00

**Action:** Built Pack 1 backend and UI. Added the shared creation brief, library inventory, style-aware generation, type/hear-type card construction, brief validation through the router, and the Create screen split into brief fields, placement picker and editable Chat prompt editor. The Chat effect was keyed to the request so stale answers disappear without a synchronous state write in an effect.

**Verification:** Full `npm test` passed 399 tests before the final simulation test; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Added `library-create-utils` tests for subject defaults, target-only names and empty-subject refusal.

**Verdict:** pass

**Failure class:** React `set-state-in-effect` lint failure; fixed by keying prompt and answer state instead of clearing state inside the effect.

**Pivot:** none

**Next:** Add the five-scenario simulation, external browser proof and drift record.

### 3 — 2026-10-23T04:54

**Action:** Added `simulate-pre.html` with all five PRD scenarios, `tests/simulate-creation-control.test.ts`, and `scripts/simulate-creation-control.mjs` with `npm run simulate:creation-control`. Ran the external Edge lane against the static build with a fake provider: the learner subject reached the prepared prompt, a wrong style was refused, and an edited Chat prompt survived download preparation.

**Verification:** `npm test` 36 files / 400 tests passed; `npm run typecheck`, `npm run lint`, `npm run build`, `npm run simulate:creation-control`, and `npm run simulate:create-flow` passed. The Edge lane passed with no page errors. IMPL records the drift check as clean.

**Verdict:** pass

**Failure class:** The first detached WSL commands ran in the home directory because `Start-Process` lost the shell command; fixed with `/tmp/cc-run.sh` and explicit arguments. The external lane also needed boolean DOM waits and a second “Edit setup” click after saving a profile with an existing key.

**Pivot:** none

**Next:** Commit and merge Pack 1, then start Pack 2 `background-jobs` in a new worktree.

### 4 — 2026-10-23T05:05

**Action:** Landed Pack 1 on `main` as `6dcbd5f` and recorded the detached-command rule as `37ae40b`; pushed `main` to origin.

**Verification:** `git push origin main` updated `a9539c4..37ae40b`. The landed tree matches the tested feature tree; the only later change is the `AGENTS.md` command rule.

**Verdict:** pass

**Failure class:** The first feature commit message was truncated to `feat:` because shell quoting split the `-m` text at a semicolon. Per `docs/ethics/commit.md`, the commit was not amended. The same tested tree was landed as a clean squash commit instead.

**Pivot:** Land Pack 1 through a clean squash commit rather than merging the malformed feature commit.

**Next:** Start Pack 2 `background-jobs` from `main` in a new isolated worktree.

### 5 — 2026-10-23T06:05

**Action:** Built Pack 2 in `feature/background-jobs`: a persisted page-level job store and runner, the global Jobs control and notices, timeout retries, import jobs, restore interruption, docs, post-implementation rehearsal and external Edge lane. Create now enqueues Generate, Import and Chat import instead of holding the screen.

**Verification:** `npm run typecheck`, `npm run lint` and `npm run build` passed. Full `npm test` passed 39 files / 426 tests after the build. The external Edge lane passed provider setup, generation while navigating to Settings, success notice and View, valid import, bad-import details and reload recovery with no page errors. The post-sim is `v1/tests/simulate-background-jobs.test.ts`; `simulate-post.md` records it.

**Verdict:** pass

**Failure class:** Five implementation failures were found and fixed. The queue did not schedule a future waiting retry after a boot with no ready work; `processQueue` now schedules it and a runner test pins it. Restore interrupted jobs before validating the backup; restore now validates first and uses `beforeApply` to interrupt only a backup that will apply, with a router test for the refused case. The external lane's hard navigation interrupted the job; the lane now clicks the app's client-side Settings link. The fake provider's `"slow"` marker collided with a prompt example; the marker is now `"zzz"`. The built-output assertion also had to use stable phrases because template interpolation split the exact four-try sentence.

**Pivot:** Prove "keep working" with the app's own navigation, not a hard page load. Validate a backup before stopping live work.

**Next:** Land Pack 2 on `main`, then start Pack 3 `study-experience`.

### 6 — 2026-10-23T06:10

**Action:** Landed Pack 2 on `main` as `d1ab113` with a fast-forward from `feature/background-jobs`, then pushed `6749e63..d1ab113` to origin. The feature commit and the landed tree are the same tree that passed the full suite and the external lane.

**Verification:** `main` was clean before the merge and clean after the push. `git log` shows `d1ab113 feat: run generation and import as background jobs`.

**Verdict:** pass

**Failure class:** none

**Pivot:** none

**Commit note:** The first ledger commit message was truncated to `docs:` by shell quoting. Per `docs/ethics/commit.md` it was not amended; the follow-up commit records the correction and uses a message file.

**Next:** Start Pack 3 `study-experience` from `main` in a new isolated worktree.
