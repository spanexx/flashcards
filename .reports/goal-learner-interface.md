# Goal: Learner interface

## Goal Contract

**Outcome:** A learner can study a pack with a broad language choice, listening cards work as real dictation, the running card can move into a full-screen stage for focus and future media, and the app uses a wide desktop layout with readable forms and styled controls.

**Acceptance evidence:**
- Unit and router tests prove a listening card shows no full line, translation, summary or text-reveal control before the answer is judged, and reveals the line only after judging.
- Unit and router tests prove the shared language catalog is broad and searchable enough for both pack and creation fields, stores stable codes, and still accepts a language the catalog does not list.
- Built-app browser checks at 1440x900 and 390x844 show no horizontal overflow, a content area that uses the desktop width, multi-column library and form layouts, and styled pickers.
- The running card enters full screen from one control, keeps its card state while full screen, leaves with Esc or the same control, and falls back to a fixed CSS stage when the browser refuses the Fullscreen API.
- Captured screenshots of Study, Library, Create and full-screen are reviewed with the learner, because "looks terrible" is a visual judgement that a test cannot settle.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and the browser lane are green.

**Scope:** `v1/src/app`, `v1/src/lib/client`, `v1/src/lib/shared/language.ts`, `v1/src/app/globals.css`, related tests and feature docs. The listening change restores the locked `study-experience` Q2 rule. No change to judging, card/backup/pack schema, provider contract, or stored browser data. No new runtime dependency.

**Authority:** `delegated` by the learner on 2026-10-24 for this interface pass. The learner named the three problems and approved the work. Design choices are recorded in the pack's GRILL file and this ledger; the learner still gives the visual sign-off and the commit/PR gate.

**Budget:** One pack. At most three attempts per failure class. Stop on a missing decision, an ethics conflict, a public contract change, or a failure that survives a real strategy change.

**Stop conditions:** A verified pack with the learner's visual sign-off; or a hard blocker; or the attempt budget is exhausted.

## Pack Order

1. `learner-interface` — listening dictation, broad language picker, wide interface and control styling.

## Iterations

### 1 — 2026-10-24

**Action:** Committed the dev-lane docs on `main` as `5421059`, committed the finished language/prompt pack as `5d15497`, rebased that pack onto the docs commit, and created `feature/learner-interface` with `agent-worktree` from `feature/language-prompt-control`. Removed the merged local branches `feature/background-jobs`, `feature/pwa-deploy`, and `feature/study-experience` and their clean worktrees. Kept unmerged `feature/creation-control` and its worktree.

**Verification:** `agent-worktree` returned `WORKTREE_READY=1`, base `feature/language-prompt-control`, branch `feature/learner-interface`. `origin` has only `main`; there were no remote feature branches to remove. The new worktree is clean.

**Verdict:** pass

**Failure class:** The first rebase stopped on a missing Git committer identity. Re-ran the commit and `rebase --continue` with the approved `-c user.name` and `-c user.email` values.

**Pivot:** none

**Next:** Lock the GRILL decisions, inspect the current layout and picker code, and write the pre-implementation simulation.

### 2 — 2026-10-24

**Action:** Locked the GRILL: listening becomes dictation with no pre-answer transcript, the language control gets a visible 73-name catalog plus a custom fallback, and the shell uses the desktop width with a Library side rail and a Study session rail. Built `simulate-pre.html` with Study, Library and Create views, a working listening answer reveal, the new language selects, and mobile stacking.

**Verification:** The pre-simulation served on `http://127.0.0.1:4180/simulate-pre.html`. Screenshots reviewed at 1440x1000 and 500x900. A CDP mobile override at 390x844 measured `scrollWidth=390` with no element past the right edge. The language catalog has 73 entries.

**Verdict:** pass for the pre-simulation; waiting on the learner's visual sign-off.

**Failure class:** Edge headless enforces a minimum window width, so the first 390-wide screenshot was a crop of a 492-wide viewport. Measured the narrow view through CDP instead; no layout overflow.

**Pivot:** Added a Study session rail after the first desktop screenshot showed the card alone in the middle, which repeated the complaint the pack is meant to fix.

**Next:** Learner reviews the pre-simulation and either signs it off or names changes; then write PRD-TRD and IMPL.

### 3 — 2026-10-24

**Action:** Added the learner's full-screen request to the locked decisions and the pre-simulation. The running card now has one Full screen control, a 1100px stage, an Exit full screen control, an Esc path, and a CSS overlay fallback when the Fullscreen API is refused. The stage keeps images and videos contained for the coming media cards.

**Verification:** Full-screen screenshots reviewed at 1440x1000 and 500x900. The pre-simulation still shows no transcript before answering, and the 73-language selects are unchanged. The visible screen is the card and its controls; the sidebar, page heading and session rail are outside the stage.

**Verdict:** pass for the updated pre-simulation; waiting on the learner's sign-off.

**Failure class:** none; the CSS overlay is deliberate so full screen works in environments where the browser refuses the Fullscreen API.

**Pivot:** none

**Next:** Learner signs off the pre-simulation; then write PRD-TRD and IMPL.

### 4 — 2026-10-24

**Action:** Implemented the pack in five phases: grew the language catalog to 73
names and added the shared `LanguageField` in Write, Generate, Chat and the pack
editor; removed the pre-answer listening transcript; widened the shell and added
Library and Study rails, the Create form grid and one control family; and added
the full-screen stage with API, CSS fallback, Escape, next-card persistence and
session-end cleanup. Ran the drift audit, fixed all three hard gaps (bare selects,
disabled fields, unknown-language switching), corrected the stale docs, and
shared `LISTEN_INSTRUCTION` between the Study screen and its tests. Wrote
`simulate-post.md` and the drift report.

**Verification:** `npm run typecheck`, `npm run lint` and `npm run build` pass;
the build reports `check-pwa: passed (files: 53, precache entries: 51)` with
`sw.js` version `9f4a1e76691fff7d`. `npm test` passes **45 files / 467 tests**.
The external Edge lanes pass no-transcript listening, post-answer reveal, API
full screen, forced CSS fallback at 1416x808, Escape, next-card persistence,
session-end cleanup, known/unknown pack switching, Library/Create rails and
390px no-overflow checks. The static server answers on both
`http://127.0.0.1:4190/` and `http://172.25.126.9:4190/` with `200`.
Screenshots of Study, full screen (API and CSS), Library and Create are captured
at desktop and phone sizes.

**Verdict:** pass for implementation and the post-implementation simulation;
waiting on the learner's visual sign-off. No commit or PR.

**Failure class:** Headless Edge gives the Fullscreen API an 800x600 stage; the
CSS fallback was forced separately at 1416x808. One first browser-lane attempt
hit a transient CDP exception while the page navigated; a guarded retry passed.
Neither was an app failure.

**Pivot:** The drift audit found that an unknown language could vanish after a
known-parent switch and that several native selects lacked the required chevron.
Both were fixed and re-checked before the final build and browser run.

**Next:** Learner reviews the screenshots and post-simulation. On sign-off, run
the commit gate and open the PR; otherwise record the requested change and
re-run the affected lane.

### 5 — 2026-10-24

**Action:** The learner reviewed the screenshots and the post-implementation
simulation and approved them ("all is good, merge to main locally then commit").
Updated the sign-off in the IMPL, post-simulation and drift report. Re-ran the
full suite and all three browser lanes against the final build.

**Verification:** On build `9f4a1e76691fff7d`, `npm test` passes **45 files /
467 tests**. The post, learner and mobile Edge lanes pass on the same build; the
desktop and phone screenshots have no horizontal overflow.

**Verdict:** pass; the human visual gate is closed.

**Failure class:** none.

**Pivot:** The learner asked for a local commit and merge into `main` rather
than a pull request.

**Next:** Commit the feature on `feature/learner-interface`, fast-forward local
`main`, and stop the static server. Do not push or open a PR.
