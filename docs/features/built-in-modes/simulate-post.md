# Drift review — built-in-modes (2026-11-23)

**Reviewer:** fresh-eyes sub-agent, read-only
**Verdict:** Minor Drift — fixed before ship

The five modes, generated files, manifest, version stamp and additive generator
matched the locked contract. The review found these gaps, all closed:

1. `word-deep-dive` declared `match` in its card mix but had no `match` card.
   Added a fourth `matching`-stage card with `answerDef.mode: "match"`.
2. Its picks options printed `signals`, the very form its own skill forbids
   printing. Replaced with `siren`.
3. The plan and PRD-TRD said "five progressive decks" while the example cap is
   1-2 decks. Both now say five stages named in the skill, with 2-4 stage cards.
4. Three skill lines described behavior their examples did not show. Reworded
   to match the shipped cards.
5. The manifest schema and id-mismatch cases were only covered in Track 1's
   generic tests. Added both to `mode-seed.test.ts`.
6. A broken generated file made `simulate.sh` throw a stack trace instead of the
   promised `FAIL: N problem(s)` line. Its strict reader now prints that line.

**Evidence after fixes:** 56 targeted tests green; regenerate hash check on all
six shipped pack files unchanged; `simulate.sh` PASS with 0 problems; pack bytes
unchanged in git. Full suite, build, typecheck, lint and drift gates recorded in
the pack's delivery note.

**Reconciliation:** `simulate-pre.sh` moved to `archive/` as the design record;
`simulate.sh` is the single canonical rehearsal.
