# Goal: Course Dictionary in v1, through the feature pipeline

Contract:
- Outcome: every pack, deck and card in v1 has a Dictionary page that a
  learner can read (text, picture, video) from the library and from study,
  earns a "read" trace, and that an author can build in a Course Builder,
  with kept-media caps and a private overlay for built-in courses.
- Evidence: `npm run typecheck`, `npm run lint`, `npm test` all green in
  v1; `npm run build` green; `docs/features/course-dictionary/simulate.sh`
  runs and demonstrates every behavioral spec scenario; `npm run
  check:drift` and `npm run check:drift:staged` pass; GRILL locked with no
  open questions.
- Scope: v1 data layer (`src/lib/shared`, `core`, `browser`), v1 screens
  (`src/app`), tests, and the course-dictionary docs pack. No version tag,
  no release, no dependency added.
- Authority: delegated by the learner on 2026-10-29 ("make all other
  decisions and start implementing course dictionary with the feature
  pipeline"). Human gates still hold: commit, PR, merge and stable
  blessing need the learner's explicit go.
- Budget: 3 attempts per failure class; stop and report on the third.
- Stop conditions: the commit/PR gate, a contract change, missing access,
  or an ethics conflict.

Pipeline: feature-pipeline (Phase 0 locked 2026-10-29)
Worktree: /home/spanexx/.config/superpowers/worktrees/flashcards/feature-course-dictionary
Branch: feature/course-dictionary

## Iterations

### 1 — 2026-10-29T14:09
Action: isolation gate cleared (`agent-worktree feature course-dictionary`),
design docs moved from main into the worktree, temp stash dropped after
verifying the worktree held every design file. Read the v1 data layer
(store, repository, router, bundle, archive, media, authoring) and the
screens the feature touches.
Verification: `git branch --show-current` -> feature/course-dictionary;
`git status --short` -> only the design pack and ticket/map edits;
`git stash list` -> empty after the drop.
Verdict: pass
Failure class: none
Pivot: none
Next: write the four delegated GRILL decisions (done), the PRD-TRD and
the IMPL, then implement.

### 2 — 2026-10-29T14:09
Action: GRILL entries 29-32 recorded as [agent decision] with why and
source; status set to Locked; open list replaced with "No remaining open
questions".
Verification: tail of GRILL-course-dictionary.txt shows entries 29-32 and
the locked line.
Verdict: pass
Failure class: none
Pivot: none
Next: PRD-TRD + IMPL.

### 3 — 2026-10-29T15:31
Action: PRD-TRD and IMPL written under delegated authority; six phases
implemented (core rules, browser store, reader, Course Builder/editor,
entry points, simulation); the post-impl simulation built
(`v1/tests/simulate-course-dictionary.test.ts`, twelve scenarios) and the
design simulation archived to `docs/features/course-dictionary/archive/`.
Verification: `bash docs/features/course-dictionary/simulate.sh` ->
SCENARIO 1-11 plus the built-screens check, 12/12 PASS; typecheck clean.
Verdict: pass
Failure class: none
Pivot: none
Next: fresh-eyes drift review.

### 4 — 2026-10-29T15:31
Action: the fresh-eyes review found seven gaps plus one privacy leak; all
fixed in code (backup size statement, revert from the shipped snapshot,
YouTube ready probe, search close, chip and tool shape, net media cap,
shareable page on export) and logged as D-32–D-39. Docs reconciled:
PRD-TRD and IMPL match the shipped names and shapes, GRILL entry 30 keeps
its text with a dated amendment, ticket and map updated.
Verification: rebuild with `NEXT_PUBLIC_BASE_PATH=/flashcards` ->
`check-pwa: passed (base path: /flashcards, files: 92)`; full suite 87
files / 1019 tests; simulation 12/12 PASS; `npm run check:drift` and
`npm run check:drift:staged` -> 0 open, 0 awaiting, 39 resolved.
Verdict: pass
Failure class: the PWA check failed once because the base path was set
only for the build step; fixed by exporting it across build, PWA write
and PWA check.
Pivot: none
Next: stop at the human review/commit gate — no commit, PR, merge or
push without the learner's explicit go.

### 5 — 2026-10-29T15:44
Action: completion audit closed the last IMPL Phase 6 item (`npm run
lint` -> exit 0) and checked the built export (`out/dictionary/`,
`out/builder/`; the worker caches navigations, so a visited page opens
offline). The locked GRILL's plain-text citations were audited: entries
29 and 31 pointed at wrong code, so one appended block carries dated
source corrections with no locked line moved (D-40, Low, doc-only).
Verification: `npm run check:drift` and `npm run check:drift:staged` ->
0 open, 0 awaiting, 40 resolved, no warnings; each corrected line
re-read; ticket updated.
Verdict: pass
Failure class: none
Pivot: none
Next: hold at the human gate for the learner's commit/PR go.
