# Goal: resolve PR 11 after PR 10 merged

Contract: outcome = PR 11 has no conflicts with main and keeps all of PR 10; evidence = PR mergeable, full suite green, build green, drift gates green; scope = only the import-time study-note normalisation and D-48 record that PR 10 did not have; authority = delegated; budget = 3 attempts.

## Iterations

### 1 — 2026-11-22
Action: discovered local main was behind; used origin/main (f948056, PR 10) as the base, backed up the old PR branch to backup/card-context-pr11, reset the PR branch to origin/main, and reapplied only the unique changes: studyInstructionField/normalizeStudyInstruction in prompt-context.ts, wiring in schema/bundle/generate, tests, D-48 resolved entry, and a study-card-clarity delivery note. Local main was then pulled to f948056.
Verification: targeted tests 71 passed; typecheck clean; changed-file lint clean; build check-pwa passed; full suite 91 files / 1129 tests; drift gates 0 open / 0 awaiting / 48 resolved.
Verdict: pass
Pivot: dropped duplicate prompt/UI changes because PR 10 already implemented them more fully; kept PR 10's cloze validator and card/pack UI intact.
Next: commit, force-push feature branch, confirm PR 11 mergeable.

Backup: backup/card-context-pr11 (old duplicate implementation) remains local until the user confirms it can be deleted.
