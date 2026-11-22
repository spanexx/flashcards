# Goal: a plain study card, a study goal that stays off the card, and a self-contained authoring prompt

Contract:
- Outcome: The study card is a plain monochrome surface with no pack meta-prompt on it; the pack's study goal is readable in the Library pack overview; and the authoring prompt (7.0.0) asks for self-contained cloze prompts and a short learner-facing study note.
- Acceptance evidence:
  - `npm test` green, with the new tests named in the IMPL.
  - `npm run typecheck` and `npm run lint` clean.
  - `npm run build` green, including `check-pwa`.
  - `bash docs/features/study-card-clarity/simulate.sh` prints `PASS`.
  - `npm run check:drift` green; `npm run check:drift:staged` green at commit time.
  - The built card carries the plain classes and no raw `studyInstruction` text; the Library pack row carries the study goal.
- Scope: Study card styles, the study instruction helper, the Library pack overview, the authoring and provider prompt rules, the cloze context validator, tests, and the feature docs. No judge, evidence, scheduling, session loop, storage shape, or new dependency.
- Authority: delegated by the learner on 2026-11-22 for all design decisions inside this scope. The learner keeps the merge and release gates. The learner asked for a PR when done, so commit, push and PR creation are authorized; merge is not.
- Budget: 3 attempts per failure class; stop after two identical failures and change the failure class. No wall-clock ceiling was set.
- Stop conditions: a hard human gate (PR merge, stable blessing), an ethics conflict, or a missing decision outside the delegated scope.

Pipeline: feature-pipeline (GRILL -> pre-impl sim -> PRD-TRD -> IMPL -> implement -> post-impl sim -> drift check -> reconcile)
Worktree: /home/spanexx/.config/superpowers/worktrees/flashcards/feature-study-card-clarity
Branch: feature/study-card-clarity

## Iterations

### 1 — 2026-11-22
Action: Created the goal contract and the feature worktree with `agent-worktree feature study-card-clarity`; read the ethics, the dev lane, the study card, the authoring prompt and the locked language-prompt-control decisions.
Verification: `agent-worktree` printed `WORKTREE_READY=1`, `BRANCH=feature/study-card-clarity`; `git status --short` was empty before the worktree.
Verdict: pass
Failure class: none
Pivot: none
Next: Write the locked GRILL decision record, the pre-impl simulation, PRD-TRD and IMPL.

### 2 — 2026-11-22
Action: Wrote the locked GRILL, the pre-impl simulation, the PRD-TRD and the IMPL. Read the ethics, the dev lane and the relevant source; installed the worktree's dependencies with `npm ci` so checks could run. Audited the uncommitted source edits: phases 1-4 and part of 5 were present, with no new tests or post-impl simulation.
Verification: the targeted baseline showed 4 failing tests and one typecheck error, all from old assertions about the superseded decisions; lint was clean.
Verdict: pass
Failure class: none
Pivot: none
Next: Split the remaining work into five tasks: validator proof, note precedence, superseded decision, post-impl simulation, gates and PR.

### 3 — 2026-11-22
Action: Added `tests/prompt-context.test.ts` (17 tests) and two import-lane cases in `tests/card.test.ts` for the learner's two underspecified cards. Finished Phase 5 by making `generatedPackBundle` store only the provider's distilled note. Added tests for the shared study-note rule, the authoring placeholder and the Chat brief boundary, then extracted one `STUDY_NOTE_RULE` into `shared/creation.ts` so both generation lanes teach the same words.
Verification: 43 validator/card tests green; 109 prompt/authoring/brief/flow tests green; targeted tests were red before each code change where a real gap existed.
Verdict: pass
Failure class: none
Pivot: none
Next: Update the decisions that this pack supersedes in the existing tests and docs.

### 4 — 2026-11-22
Action: Updated `study-experience.test.ts` and the language-prompt-control canonical simulation to the new card-note boundary; marked Q3 and Q7 in that pack's GRILL and its PRD-TRD as superseded by this pack's decisions, as the GRILL requires (decision, not drift). Added the colon to the Library `Study goal:` label to match the locked wording.
Verification: both affected test files green after a full build; `npm run check:drift` green with 0 open and 0 awaiting.
Verdict: pass
Failure class: none
Pivot: none
Next: Build the post-impl simulation and run the full gates.

### 5 — 2026-11-22
Action: Wrote `tests/simulate-study-card-clarity.test.ts` with the eleven PRD scenes against real helpers, the source stylesheet and the built output, plus `simulate.sh` with the repo's no-stale-build guard. Full verification: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (with check-pwa) and the simulation.
Verification: 91 files / 1123 tests passed; typecheck and lint clean; `check-pwa: passed`; `bash docs/features/study-card-clarity/simulate.sh` printed all scenes and `PASS`.
Verdict: pass
Failure class: none
Pivot: none
Next: Fresh-eyes drift review, reconcile the two simulations, commit, push and open the pull request. Stop at the human-review gate.

### 6 — 2026-11-22
Action: A fresh sub-agent reviewed PRD-TRD and IMPL against the code, tests and both simulations. It found no functional gaps: all IMPL phases are complete and PRD-TRD's eleven behavioral simulation scenes are demonstrated. It reported three low-severity wording/coverage drifts and suggested D-40/D-41/D-42. The parent reconciled all three by correcting the PRD-TRD wording in place (helper name, pack-level note rule, gate evidence outside the rehearsal, and the provider lane's `fullLine` phrasing), recorded the disposition in `.reports/2026-11-22-drift-study-card-clarity.md`, and moved `simulate-pre.sh` and `simulate-pre.html` to `archive/`. No drift entries were filed: the locked decisions never said otherwise, so these were doc corrections, not gaps against a decision.
Verification: reviewer independently ran the sim, full suite, typecheck, lint, PWA check and drift gates — all green. `npm run check:drift` re-run after the doc edits.
Verdict: pass
Failure class: none
Pivot: none
Next: Stage named files, re-run the staged drift gate, commit, push, open the PR, and stop for human review.

### 7 — 2026-11-22
Action: Staged 28 named files, read the staged source diff, and ran both drift gates by hand. Committed as `c525a3c` with the pre-commit hook green, pushed `feature/study-card-clarity`, and opened PR https://github.com/spanexx/flashcards/pull/10. Reconciled the two simulations by archiving the pre-impl artifacts and keeping `simulate.sh` canonical.
Verification: `check:drift` and `check:drift:staged` green; all staged files LF; `git status` clean after the commit; push and `gh pr create` both succeeded. Full gates recorded in iteration 5 and confirmed independently by the drift reviewer.
Verdict: pass
Failure class: none
Pivot: none
Next: Human review gate — the learner reviews PR #10. No merge until the learner replies.
