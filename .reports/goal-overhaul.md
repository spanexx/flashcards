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

### 7 — 2026-10-23T06:55

**Action:** Built Pack 3 in `feature/study-experience`: a pack/deck filter in `planAnswer`, neutral mode labels, one listen control, an automatic tutor hint after the first miss, source-labelled hints, the reveal layout, the scope selectors and the `.study-*` styles. Added the router test, helper tests, canonical rehearsal, `simulate-pre.html`, `simulate-post.md` and the external Edge lane.

**Verification:** `npm run typecheck`, `npm run lint` and `npm run build` passed. Full `npm test` passed 41 files / 432 tests after the build. The external Edge lane passed two pack imports, pack scope, no answer before submission, one play control, one automatic Tutor hint, separate answer/translation lines and a 390px phone width with no overflow. The final result screenshot is `C:\Users\shuga\AppData\Local\Temp\opencode\study-result.png`. The static server, fake provider and headless Edge were stopped and the profile removed.

**Verdict:** pass

**Failure class:** The first lane assumed a cleared library had only the two imported packs; the app also seeds the Polish starter pack, so All cards shows 20 cards. The lane now checks "from the whole library" and then narrows to the travel pack. The plan line said "1 cards"; it now uses the actual planned count and pluralizes. Answer parts ran together as "obiad.We"; `Side` now joins text parts with a space and gives translations their own block. The final lane found the headless Edge page target missing; a fresh target was opened with `/json/new` before the rerun. A docs append heredoc mangled control characters; the record was truncated at the marker and appended through a temp file.

**Pivot:** Report the planned card count, not the requested offer; treat the seeded starter pack as part of All cards; recreate a CDP target when the headless page disappears.

**Next:** Land Pack 3 on `main`, then start Pack 4 `pwa-deploy`.

### 8 — 2026-10-23T07:00

**Action:** Landed Pack 3 on `main` as `6157763` with a fast-forward from `feature/study-experience`, then pushed `5ab4c23..6157763` to origin. The feature commit and the landed tree are the same tree that passed the full suite and the external lane.

**Verification:** `main` was clean before the merge and clean after the push. `git log` shows `6157763 feat: make study scoped, quiet and tutor-aware`.

**Verdict:** pass

**Failure class:** none

**Pivot:** none

**Next:** Start Pack 4 `pwa-deploy` from `main` in a new isolated worktree.

### 9 — 2026-10-23T07:30

**Action:** Built Pack 4 in `feature/pwa-deploy`: base-path helper and static export base path, standalone manifest and generated icons, fixed top-right install button with prompt/manual paths, production service-worker boot, post-build precache worker, hard export checker, GitHub Pages workflow, phone/tablet/desktop CSS fixes, tests and docs.

**Verification:** `npm run typecheck`, `npm run lint` and `NEXT_PUBLIC_BASE_PATH=/flashcards npm run build` passed. The build wrote a 49-file precache; `check-pwa` passed with 53 files and 51 precache lines. Full `NEXT_PUBLIC_BASE_PATH=/flashcards npm test` passed 43 files / 439 tests. The external Edge lane passed locally: valid manifest, no installability errors, scoped worker, controlled page, 49 cached files, offline reload, no overflow at 390/768/1280, and the study/Create screens fit a phone. Screenshots are `pwa-phone.png`, `pwa-desktop.png` and `pwa-create-phone.png`.

**Verdict:** pass

**Failure class:** The first installability run used the WSL LAN address and Edge reported `not-from-secure-origin`; the lane moved to `127.0.0.1`. The one-column shell stretched the sidebar to the viewport height, leaving a blank band; `align-content: start` fixed it. A detached Windows static-server start timed out because `Start-Process` was given one redirect; it was restarted detached with separate output files. The install prompt is single-use; the button now clears the prompt after `userChoice` and on a prompt error. `check-pwa` now ignores source maps so its file set matches the worker's.

**Pivot:** Serve the lane from a secure local origin. Hide standalone mode in CSS instead of a synchronous state write in an effect. Keep `skipWaiting` out so a deploy cannot swap assets under an open page.

**Next:** Commit Pack 4, fast-forward `main`, push and verify Pages.

### 10 — 2026-10-23T07:58

**Action:** Committed Pack 4 as `682e93c`, fast-forwarded `main` from `2c10fef`, pushed `main`, and watched the Pages workflow. The deploy published `v1/out`. The workflow's live curl gate passed, then the same external Edge lane passed against `https://spanexx.github.io/flashcards/`. The local WSL/Windows static servers and the headless Edge profile were stopped and removed.

**Verification:** Pages run `39908324755` passed: build 53s, deploy 16s. The live page, manifest, worker, library route and 192px icon all answer 200. The live lane found a valid manifest, no installability errors, scope `/flashcards/`, 49 cached files, a controlled page, no overflow at 390/768/1280, phone-fit study/Create screens and an offline reload. `NEXT_PUBLIC_BASE_PATH=/flashcards npm run simulate:create-flow` also passed on the built tree. The final gate checks typecheck, lint, build, 439 tests and the live lane are green.

**Verdict:** pass

**Failure class:** The main checkout's `node_modules` was built for Windows, so the final `simulate:create-flow` failed there with a missing Rolldown native binding; the same command passed in the WSL worktree that had a Linux `npm ci`. No source change was needed.

**Pivot:** Run the final simulation from the Linux worktree; do not repair the Windows dependency tree for this pack.

**Next:** All four packs are landed and live. Record the final Pack 4 docs and ledger state, then close the goal.
