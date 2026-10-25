# Goal: fix production entry, branding and phone/Study polish

Contract:
- Outcome: `/` opens the Study screen, the app has a real Lucide logo/favicon,
  phone dropdowns and header behave deliberately, and the Study tab looks
  finished without changing study logic.
- Evidence: `npm run build`; no horizontal overflow and a visible sticky header
  at 390x844; both language dropdowns usable; `/` and `/favicon.ico` return 200
  from the built static server; Study, Library, Create and phone screenshots;
  `npm run typecheck`, `npm run lint`, `npm test`; learner visual sign-off.
- Scope: `v1` UI/CSS/assets/root route; affected feature docs; no data, judge,
  session, provider or schema change; no new runtime dependency.
- Authority: delegated by the learner for implementation details. Visual
  sign-off, PR/merge and the commit go remain human gates.
- Budget: three attempts per failure class, 90 minutes, current context.
- Stop conditions: visual sign-off, commit go, a missing decision, or an ethics
  conflict.

Pipeline: surgical-change (learner-interface follow-up + pwa-deploy entry)
Worktree: /home/spanexx/.config/superpowers/worktrees/flashcards/fix-interface-polish
Branch: fix/interface-polish

## Iterations

### 1 — 2026-10-25T06:05
Action: Read the goal contract, routing, decisions, verification and ledger
skills; inspected learner-interface, study-experience and pwa-deploy packs.
Verification: GRILL files are `Status: Locked`; learner-interface and
pwa-deploy both require the root export and phone fit.
Verdict: pass
Failure class: none
Pivot: none
Next: inspect the implementation and reproduce the root/favicon 404.

### 2 — 2026-10-25T06:08
Action: Created `fix/interface-polish` with `agent-worktree` from Windows.
Verification: WSL git rejected the worktree metadata; the Windows checkout
reported every tracked file modified by line endings.
Verdict: fail
Failure class: worktree location/line endings
Pivot: removed only the failed worktree and branch, then created the worktree
from WSL with the sanctioned script.
Next: re-run the same worktree command under WSL Debian.
