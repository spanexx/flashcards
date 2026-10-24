# Goal: language-aware packs, clear study instructions, safe hints, editable prompts

Contract: A learner can choose a pack's target and question languages, sees an unambiguous instruction on every card, can reveal a listening card's text, never sees a stale hint, and can edit the pack's prompts. Evidence: unit tests, build, lint, browser simulation, and a live local lane. Scope: `v1` pack metadata, prompt building, creation fields, pack editor, study view, listening reveal, hint isolation. No global language setting, no bulk card translation, no provider API change. Authority: delegated by Victor on 2026-10-23. Budget: 3 attempts per failure class, 90 minutes wall clock, 80k context.
Pipeline: feature-pipeline (Phase 0 GRILL)
Worktree: /home/spanexx/.config/superpowers/worktrees/flashcards/feature-language-prompt-control

## Iterations

### 1 — 2026-10-23T06:15
Action: Created the isolated worktree and installed its Linux dependencies.
Verification: `agent-worktree feature language-prompt-control` -> `WORKTREE=/home/spanexx/.config/superpowers/worktrees/flashcards/feature-language-prompt-control`; `cd v1 && npm ci` -> `added 404 packages`.
Verdict: pass
Failure class:
Pivot:
Next: Write the locked GRILL and the design simulation.

### 2 — 2026-10-24
Action: Locked the GRILL, wrote the pre-implementation simulation, PRD-TRD and
IMPL, then implemented the pack metadata, pair-aware prompts, creation fields,
pack editor, listening reveal and card-scoped hint isolation.
Verification: Targeted unit and router tests passed; the Polish starter declares
`pl`/`en` and its instruction; old bundles still load.
Verdict: pass
Failure class:
Pivot:
Next: Run the canonical rehearsal and the built-output browser lane.

### 3 — 2026-10-24
Action: Added `tests/simulate-language-prompt-control.test.ts` and
`docs/features/language-prompt-control/simulate.sh`. The first rehearsal caught
the starter being seeded before the English preview; the test now previews first.
The browser lane caught the save notice being overwritten by the Packs refresh;
`PackEditor` now refreshes before it announces the save.
Verification: Canonical rehearsal passed after build; the browser lane passed
creation, inheritance, type/listening, hint isolation, summary, editor save and
reset.
Verdict: pass
Failure class:
Pivot:
Next: Run an independent docs-to-code drift check.

### 4 — 2026-10-24
Action: A separate audit found four gaps: same-language/missing-source wording,
old packs silently gaining an English source, provider echoes replacing the
brief, and missing inherited facts on the Write deck/cards forms. Fixed all four.
The brief now wins for generated packs, Chat applies it to a pasted pack, and a
blank PATCH source keeps an old pack neutral. Added tests for each rule.
Verification: Targeted five-file suite passed; build passed; canonical rehearsal
passed; browser lane passed with the Write deck facts; full suite passed
45 files / 466 tests; typecheck and lint passed.
Verdict: pass
Failure class:
Pivot:
Next: Stop at the commit/PR gate for Victor.

### 5 — 2026-10-24
Action: A second docs-to-code audit found two contradictions and three gaps:
a new pack could still be generated or pasted with no source, the canonical
same-language claim was only unit-tested, Write cards had no rendered check,
no test covered a source-less POST, and a `creation.ts` comment was stale.
Fixed the new-pack source default in `briefForTarget` and router
`optionalBriefFor`, corrected the comment, added canonical assertions for the
source-less POST and same-language wording, and extended the browser lane to
the Write cards facts.
Verification: `npm run typecheck` and `npm run lint` passed; `npm test` passed
45 files / 466 tests; build passed (`53 files`, `51 precache entries`);
canonical rehearsal passed; fresh-profile Edge lane passed including Write deck
and Write cards (`BROWSER LANE PASSED`).
Verdict: pass
Failure class:
Pivot:
Next: Stop at the commit/PR gate for Victor.

## Drift report

- No unresolved contradiction remains between the locked GRILL/PRD and the
  implemented behavior.
- A second audit found the new-pack source default, the canonical wording claim,
  the Write cards render gap, the source-less POST gap and a stale comment. All
  were fixed and verified in iteration 5.
- Documented limits: the browser lane is a temporary external Edge CDP script,
  not a committed test; export/import/backup are proven through the real router
  rather than the download controls; a real provider key was not used; bundle
  import keeps a language name as written while display normalises it.
- The PRD was corrected where it was stale: new packs (not every old pack) have
  both languages, PATCH keeps an omitted source and clears a blank one, and the
  brief's values are applied over a provider echo.
