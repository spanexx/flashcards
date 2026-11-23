# Goal: pluggable learning modes and Mode Studio — plan only

Contract: outcome = a complete, conflict-free build plan for the mode architecture, prompt assembler, Mode Studio UI and five built-in modes, with isolated worktrees created and labelled in build order; evidence = four worktrees exist, each with a PLAN.md covering scope, file ownership, sequence, decisions and acceptance; no implementation code changed. Scope = planning docs and worktree creation only; no source edits. Authority = delegated ("use my goal skill make all decision"). Budget = 3 attempts per failure class.

Pipeline: feature-pipeline, Phase 0 planning only (no implementation)

Worktree: main checkout is the anchor; four feature worktrees created below.

## Iterations

### 1 — 2026-11-22
Action: activated goal skill, accepted delegated authority, decided to split into four stacked worktrees to avoid file clashes.
Verification: committed goal anchor 8acc181; drift staged gate green.
Verdict: pass
Failure class: none
Pivot: none
Next: create worktrees in order, research each surface, write plan docs.

### 2 — 2026-11-22
Action: created four worktrees in a linear dependency chain so later tracks build on earlier ones and never collide: (1) feature/learning-mode-core from main, (2) feature/prompt-assembler from core, (3) feature/built-in-modes from prompt-assembler, (4) feature/mode-studio-ui from built-in-modes. Launched one read-only research agent per worktree.
Verification: agent-worktree returned WORKTREE_READY=1 four times with the expected BASE/branch/path; no source files changed.
Verdict: pass
Failure class: none
Pivot: none
Next: collect the four research reports, then write PLAN.md in each worktree with decisions, file ownership, sequence and acceptance.

### 3 — 2026-11-22
Action: first research report (Track 1) received. Recorded delegated decisions: Track 1 owns the mode mechanism and validation only; Track 3 owns the five mode definitions; duplicating a built-in creates a new row with sourceModeId rather than overwriting; custom modes are included in backup/restore; a shared no-spoiler validator will be added to prompt-context.ts and reused by canonicalExample validation; Track 1 owns all /api/modes routes so router.ts is edited once.
Verification: research report cites types.ts, schema.ts, store.ts, repository.ts, seed.ts, bundle.ts, router.ts and tests with file:line.
Verdict: pass
Failure class: none
Pivot: none
Next: collect remaining three reports, then write the four PLAN.md files.

### 4 — 2026-11-22
Action: Track 2 research received. Locked delegated decisions: do not extend CreationBrief (use optional PromptInputs and ModePromptContribution on existing contexts); one new pure shared module owns the three layers and universal rules; both chat and generation lanes import them; one shared prompt version aliases the authoring skill version; no provider schemas are widened.
Verification: report cites prompt.ts, authoring.ts, creation.ts, generate.ts, router.ts and tests with file:line.
Verdict: pass
Failure class: none
Pivot: none
Next: collect Tracks 3 and 4 reports, then write PLAN.md files.

### 5 — 2026-11-22
Action: Track 3 research received. Locked delegated decisions: canonicalExample is an embedded bundle object, not a JSON string; every demo pack is namespaced mode-demo-* and never seeded as a real pack; built-in modes are versioned and overwrite on update, are not deletable (only duplicable), so no tombstone kind is needed; Track 3 owns make-seed.mjs and v1/modes/** plus public/modes/**; Track 1 owns all router.ts changes including the seed hook, so Track 3 does not edit router.ts.
Verification: report cites make-seed.mjs, seed.ts, bundle.ts, card.ts, word-check.ts, pages.ts and tests with file:line.
Verdict: pass
Failure class: none
Pivot: moved router.ts:199 ownership from Track 3 to Track 1 to avoid a shared-file clash.
Next: collect Track 4 report, then write the four PLAN.md files.

### 6 — 2026-11-22
Action: Track 4 research received. Locked decisions: first-class `/modes` route (not a fourth Library tab); read-only prompt preview with copy; no backend for Test Preview; Save validates through Track 1 routes; label is always "Learning mode". Expanded all four PLAN.md files from ~20 lines each to 60-70 lines with exact file:line seams, proposed signatures, ownership, test files, commands, acceptance and risks.
Verification: all four research reports received; PLAN.md line counts 70/64/60/65; git status in each worktree shows only PLAN.md modified; no source files changed.
Verdict: pass
Failure class: none
Pivot: none
Next: commit expanded plans on each branch, commit the ledger on main, report the four track labels and build order.

### 7 — 2026-11-22
Action: found and fixed a sequencing flaw — the stacked branches were created before plan commits landed, so their bases were stale. Rebased Track 2 onto Track 1, Track 3 onto Track 2, Track 4 onto Track 3; resolved the PLAN.md conflicts by keeping the rebased branch's own track plan.
Verification: git log shows Track 2 contains Track 1's two plan commits, Track 3 contains Tracks 1+2, Track 4 contains Tracks 1+2+3; each PLAN.md header labels its own track; no source files changed.
Verdict: pass
Failure class: stale branch bases from creating all worktrees before commits landed.
Pivot: rebase the stack instead of recreating worktrees.
Next: commit ledger on main and report.

### 8 — 2026-11-22
Action: learner asked to execute Track 1 with a subagent. Confirmed worktree `feature/learning-mode-core` is clean at `06426f5` containing PLAN.md only, and that it has no `v1/node_modules`. Launched one general subagent instructed to follow `feature-pipeline` with delegated decisions, scope limited to the mode model, schema, spoiler validator, canonical-example validator, modes store/repository, loader and base `/api/modes` CRUD — explicitly excluding the five mode definitions, `make-seed.mjs`, prompt assembler, UI, push and PR.
Verification: pending subagent report; expected evidence is feature docs, new and extended tests, typecheck, lint, build, full suite and both drift gates.
Verdict: pending
Failure class: none
Pivot: none
Next: review the subagent report, verify gates independently on the branch, then report to the learner.

### 9 — 2026-11-23
Action: the subagent died at the free-usage limit after writing the feature docs, the type/schema/validator/store/repository/loader work and four of the five test files, but it left `router.ts` half-edited: `createDeck` had lost its `readPack` line and no `/api/modes` write routes existed. Resumed in-session. Restored `createDeck`, added `createMode`/`updateMode`/`removeMode` with a local `uniqueModeName` helper and `uniquePath` id reuse, registered `GET/POST/PATCH/DELETE /api/modes`, added four router tests and a backup-restore test, fixed two lint warnings, and aligned the GRILL Q10 and PRD route wording to the code (visible name "My roles 2"; supplied `createdAt` kept).
Verification: `npx tsc --noEmit` clean; changed-file eslint clean; `npm run build` passed check-pwa; full suite 93 files / 1173 tests pass (43 added over the 1130 base); `check:drift` and `check:drift:staged` pass; two commits on `feature/learning-mode-core` (`138cdc4` docs, `439f001` code); worktree clean; `out/`, `.next/` and temp scripts removed.
Verdict: pass
Failure class: subagent died mid-edit, leaving a syntax-broken shared file.
Pivot: finished the router by hand rather than relaunching, and verified the whole branch independently.
Next: report Track 1 complete; Track 2 (`feature/prompt-assembler`) is unblocked and still unbuilt.

### 10 — 2026-11-23
Action: learner asked for Track 2 to run with a subagent and gave two standing rules: maintain reasonable logic isolation for easy scaling, and do not rush — find the issue, split the job, get full context for each task before implementing. Checked the Track 2 worktree and found it stale (it did not contain Track 1's implementation commits); rebased `feature/prompt-assembler` onto `feature/learning-mode-core`, confirmed the Track 1 code is present and the plan header still names Track 2, installed `v1/node_modules`, and verified typecheck. Launched one general subagent with the learner's two rules verbatim, a seven-phase split (map → origin docs → shared layer → generation lane → chat lane → adapter → draft routes → gates), a no-half-edits rule, and explicit isolation boundaries.
Verification: pending subagent work; expected evidence is feature docs, new/changed prompt modules, once-only rule tests, two working draft routes, and all gates green.
Verdict: pending
Failure class: stale stack branch, fixed by rebase before handoff.
Pivot: none
Next: review the subagent's report and verify gates independently on the branch.
