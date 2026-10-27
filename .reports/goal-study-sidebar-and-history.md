# Goal: the Study plan shows its moved panels beside it and its last five sessions in the main column

**Contract**
- Outcome: on the Study plan, the tutor/hints, what to expect and why these
  cards sit in a right-hand tabbed panel, while the main column shows the last
  five ended sessions as a plain list; the phone folds the panel into one
  disclosure and keeps the plan width.
- Acceptance evidence:
  - `GRILL-study-sidebar-and-history.txt` exists, `Status: Locked`, ends with
    `No remaining open questions`.
  - The new pure tests pass: `node node_modules/vitest/vitest.mjs run
    tests/<new>.test.ts` -> all pass.
  - `npx tsc --noEmit` in `v1/` -> clean.
  - `npm run build` in `v1/` -> succeeds; PWA check passes.
  - Full suite `node node_modules/vitest/vitest.mjs run` -> 61+ files, 0 failed.
  - `node docs/features/study-sidebar-and-history/simulate.mjs` -> all
    scenarios pass.
  - Built page served from `out/`, HTTP 200 from Windows on `localhost` and the
    WSL address; the served chunk carries the right-panel tabs and the previous
    sessions heading.
  - `npm run check:drift` and `npm run check:drift:staged` -> 0 open, 0 awaiting.
- Scope: Study plan screen layout; the moved disclosures' container; a
  read-only last-five list; an optional `scope` on the session's started fact.
  Must not change the Progress screen, the algorithm, the session loop, the
  Resume snapshot, the scope picker or the offer control, and must not add a
  store.
- Authority: `user-decides` for the pre-sim sign-off, PR review/merge and the
  commit go. The agent decides implementation details inside the locked GRILL
  and records each in the GRILL or IMPL. Design details already locked in
  `wayfinder/anything-learning-spec/tickets/study-sidebar-and-history.md`
  (decision 18).
- Budget: one worktree, one implementation pass, one drift pass, two attempts
  per failure class, and a bounded command per check.
- Stop conditions: pre-sim sign-off, PR approval/merge, the commit go, a missing
  decision the contract cannot resolve, or a genuine blocker.

**Pipeline:** feature-pipeline. Phase 0.5 done; waiting on the pre-sim gate.
Worktree: `/home/spanexx/.config/superpowers/worktrees/flashcards/feature-study-sidebar-and-history`
Branch: `feature/study-sidebar-and-history`

## Iterations

### 1 — 2026-10-27T08:05
Action: routed decision 18 to `feature-pipeline`; created the worktree with
`agent-worktree feature study-sidebar-and-history`; read `StudyPlan.tsx`,
`ScopePicker.tsx`, the plan phase of `StudyClient.tsx`, `SessionEvent`,
`readSessions`, the plan route and the study CSS; installed the worktree's
`node_modules` with `npm ci`; wrote the locked GRILL and the design-time
simulation.
Verification: `agent-worktree` printed
`WORKTREE=.../feature-study-sidebar-and-history` and
`BRANCH=feature/study-sidebar-and-history`; `npm ci` -> 405 packages in 37s;
`GRILL-study-sidebar-and-history.txt` -> `Status: Locked`, ends with
`No remaining open questions`; `simulate-pre.html` written and opened from
`C:\Users\shuga\AppData\Local\Temp\opencode\study-sidebar-pre.html`.
Verdict: pass for exploration and design; no implementation yet.
Failure class: none.
Pivot: none.
Next: the learner checks the pre-sim and confirms the design; then PRD-TRD,
IMPL, implementation, post-impl sim, drift, PR.

### 2 — 2026-10-27T08:20
Action: the learner added "the previous lessons should have details and can be
re learnt", then chose plain details and a fresh session on the same pack/deck.
Amended the wayfinder ticket and map row; changed the session fact to carry
optional `pack` and `deck`; added the "Learn again" action to the GRILL and the
pre-sim; kept the exact cards out of scope.
Verification: `wayfinder/.../tickets/study-sidebar-and-history.md` has the
Amendment section; `map.md` row 18 names the action; the GRILL still reports
`Status: Locked` and ends with `No remaining open questions`; the pre-sim has a
button per known-scope row and one old row with no scope/action.
Verdict: pass; the design moved inside the learner's new instruction, so the
pre-sim gate is open again.
Failure class: scope change discovered at the design gate.
Pivot: the ticket is amended, not silently reinterpreted.
Next: learner signs off the updated pre-sim; then PRD-TRD and IMPL.

### 3 — 2026-10-27T20:55
Action: the learner said "go", so the pre-sim gate passed. Wrote the PRD-TRD and
IMPL, then built: `PastSession` and `recentSessions` in a new pure module;
optional `pack`/`deck` on the session fact; the plan answer returns `past`;
the ended fact carries the start's scope forward because the store keeps one
fact per session; the backup schema accepts both fields; `PlanAside` with three
tabs and a phone fold; `PreviousSessions` with "Learn again"; the two-column
layout and the 860px rule.
Verification: `past-sessions.test.ts` 7 passed; `browser-router.test.ts` 55
passed, including the new finished-session-with-scope case; `npx tsc --noEmit`
clean; changed-file eslint clean; `npm run build` succeeded with
`check-pwa: passed`; full suite 62 files / 703 tests passed.
Verdict: pass; implementation matches the PRD-TRD.
Failure class: the first history attempt lost the scope because the sessions
store keys by id, so the ended fact overwrote the start. Fixed by copying the
scope onto the ended fact and letting the builder read either shape.
Pivot: none; the fix is inside the locked design.
Next: post-impl sim, serve the built page, drift, then the commit go.

### 4 — 2026-10-27T21:02
Action: wrote and ran the canonical `simulate.mjs`; served `out/` from Windows
on port 3000 with the WSL server bound to `0.0.0.0`; opened the page for the
learner; ran both drift checks. Copied the ticket amendment and map row, which
lived only in the main checkout, into the branch so the record travels with the
pack.
Verification: `ALL 8 SCENARIOS PASS`; `localhost` and `172.25.126.9` both
returned `200` on `/`; drift `0 open, 0 awaiting, 30 resolved`; staged drift
`nothing is staged`.
Verdict: pass for the agent side; the visual review is the learner's.
Failure class: none.
Pivot: none.
Next: the learner's commit go; then commit, push, PR and the human-review gate.

### 5 — 2026-10-27T21:05
Action: ran the drift sub-agent over the GRILL, ticket amendment, PRD/IMPL and
the code. Fixed every finding inside the locked design: the tab now says
"Tutorial and hints"; the tutor heading is back so the moved words are
unchanged; an old row leaves the scope blank instead of drawing a dash; the row
status is only finished or stopped; the id tie-break was removed; and the docs
now say the ended fact carries the scope because the store keeps one fact per
session.
Verification: typecheck and changed-file lint clean; `npm run build` succeeded
(`check-pwa: passed`); sim `ALL 8 SCENARIOS PASS`; full suite 62 files / 703
tests passed; served `/` returned `200` on localhost and `172.25.126.9`; drift
`0 open, 0 awaiting, 30 resolved`; staged drift clean.
Verdict: pass; the branch is ready for the learner's visual check and commit go.
Failure class: documentation drift around the tab name, old-row scope and the
one-fact session store, all found by the drift review.
Pivot: none.
Next: commit go, then commit and push, then PR #? and the human-review gate.

### 6 — 2026-10-27T21:10
Action: the learner saw a long "Why these cards" list stretch the page and asked
for a fixed panel height with its own scroll. Capped the aside at
`calc(100vh - 48px)`, made it a flex column, and gave the body
`overflow-y: auto` so the tab row stays put. Recorded the change in the ticket,
GRILL, PRD and IMPL; added sim scenario 9.
Verification: typecheck clean; sim 9/9; build passed; full suite 703; served
page 200 on localhost and the WSL address.
Verdict: pass; the panel no longer drags the page.
Failure class: missing height cap in the first implementation.
Pivot: none.
Next: the learner's visual check, then the commit go.

### 7 — 2026-10-27T21:20
Action: committed the plan pack (`271dc1a`), then took the learner's follow-up as
a surgical change: full screen must stay inside the browser. Locked the new
decision ticket `full-screen-in-browser.md`, logged D-31, removed the Fullscreen
API calls, the `fullscreenchange` listener and the stage ref, and marked D-31
resolved.
Verification: no Fullscreen API in `v1/src`; built chunks carry `stage-full` and
no `requestFullscreen`; typecheck and lint clean; build passed; full suite 703;
served page 200 on localhost and the WSL address.
Verdict: pass; ready to merge both commits to `main`.
Failure class: the system-fullscreen request went outside the browser.
Pivot: the learner asked for a browser-bound stage; recorded as D-31.
Next: merge the branch to local `main` and push, no pull request.
