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
