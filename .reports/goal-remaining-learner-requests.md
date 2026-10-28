# Goal: the three remaining learner requests work

**Contract**
- Outcome: import repair, the progress summary, and multi-pack/deck plan scope
  are implemented in the app and match their locked wayfinder tickets.
- Acceptance evidence:
  - Each pack records its built behaviour in an IMPL, citing its locked ticket.
  - Targeted pure tests pass for the new logic: union scope and lede, summary
    payload (counts and topic labels only), import-repair prompt and validation.
  - `npx tsc --noEmit` in `v1/` -> clean; changed-file eslint -> clean.
  - `npm run build` in `v1/` -> succeeds, including `check-pwa: passed`.
  - Full suite `node node_modules/vitest/vitest.mjs run` -> every file passes.
  - Each pack's simulation (or served built-page check) -> passes.
  - `npm run check:drift` and `npm run check:drift:staged` -> 0 open, 0 awaiting.
  - The learner's visual check of the three surfaces; the commit stays their go.
- Scope: the jobs dock and import-repair path; the Progress screen's new
  Summary tab and its provider request; the Study plan's scope control, plan
  request and the session fact's scope so history can restore it. Must not
  change the privacy boundary beyond the learner-approved, one-press import
  exception; must not store summaries or plans; must not select individual
  cards; must not change the selection algorithm, offer or session loop.
- Authority: `delegated` by Victor on 2026-10-27 ("use /goal to implement all"),
  limited to the three locked tickets and the workspace ethics. Commit, merge
  and push remain user-only.
- Budget: one worktree; one implementation pass per pack (three); two attempts
  per failure class; bounded commands; stop if context or the clock runs out
  with a written handoff.
- Stop conditions: the commit go; a decision that changes scope, a non-goal or
  the privacy boundary; a missing provider needed for live proof; an ethics
  conflict.

**Pipeline:** feature-pipeline per pack, entering at IMPL because the wayfinder
tickets are locked decisions (case A source, recorded as GRILLs).
**Worktree:** `/home/spanexx/.config/superpowers/worktrees/flashcards/feature-remaining-learner-requests`
**Branch:** `feature/remaining-learner-requests`

## Iterations

### 1 — 2026-10-27T21:58
Action: anchored on the five learner requests and their resolved tickets;
identified the three still unbuilt: import repair (20), progress summary (21),
multi-pack/deck scope (22). Routed each to feature-pipeline at IMPL. Created the
worktree with `agent-worktree feature remaining-learner-requests` and installed
its dependencies with `npm ci`.
Verification: `WORKTREE_READY=1`, `BRANCH=feature/remaining-learner-requests`;
`npm ci` -> 0 vulnerabilities.
Verdict: pass for setup; no implementation yet.
Failure class: none.
Pivot: none.
Next: read the jobs dock, provider, Progress and plan code; write the locked
GRILL record and IMPL for import repair first.

### 2 — 2026-10-27T22:39
Action: built the three packs end to end. Import repair now holds a preview,
calls the provider once, re-runs the normal validator and only then saves;
the Jobs dock has round icon actions and a provider-needed note. Progress has
an opt-in Summary tab with a capped derived payload, exact preview and no
stored answer. Study has a multi-pack/deck checkbox scope, the plan route
draws from the union, session facts and resume snapshots carry the scope, and
history can replay it. Added/updated the pure and browser tests for all three.
Verification: targeted 98 tests passed; npm run typecheck and npm run lint
clean; full suite 68 files / 735 tests passed; npm run build succeeded with
check-pwa: passed.
Verdict: pass for implementation and automated checks.
Failure class: none.
Pivot: one UI fix after review: a failed summary send clears the used preview;
history scopes with a missing pack/deck are refused. Both are covered.
Next: write the three IMPLs and the post-impl rehearsal; run drift gates and
serve the build for the learner's visual check.

### 3 — 2026-10-27T22:45
Action: wrote docs/features/import-repair/IMPL.md,
docs/features/progress-summary/IMPL.md,
docs/features/plan-multi-select/IMPL.md and
docs/features/remaining-learner-requests/simulate-post.md. Served v1/out
from WSL on port 4173.
Verification: Windows got 200 and <title>Flashcards</title> from both
localhost:4173 and the WSL address; the built chunks carry the summary,
repair and scope words.
Verdict: automated and served-build evidence pass; learner visual sign-off and
commit remain.
Failure class: none.
Pivot: live provider proof still needs the learner's provider/key because the
GitHub Pages origin returned 401/no CORS header here.
Next: stop the server, run both drift gates, show the learner the three
surfaces, then wait for the commit go.

### 4 — 2026-10-27T22:48
Action: stopped the WSL static server and closed port 4173. Ran both drift gates.
Verification: npm run check:drift -> 0 open, 0 awaiting, 31 resolved;
npm run check:drift:staged -> same, with nothing staged.
Verdict: pass for cleanup and drift.
Next: learner visual check of Study scope, Jobs repair and Progress Summary;
then the learner's commit go.

### 5 — 2026-10-28T01:26
Action: learner review called the first scope panel bulky and not minimal.
Restyled only the presentation: removed the boxed fieldset, flattened pack
metadata, made decks a quiet wrapping row, and tightened sizes and gaps.
Behavior and the locked checkbox model are unchanged.
Verification: npm run build succeeded; PWA check passed. A static harness
using the shipped CSS was captured for a visual read.
Verdict: restyle built; learner needs to reload the fresh build.
Next: serve the new build on a fresh port so the old service worker cannot
hide the new CSS.

### 6 — 2026-10-28T01:33
Action: the learner clarified that the pack and deck selects should stay
dropdowns, with decks folded inside the pack dropdown and a comfortable search.
Replaced the visible checkbox panel with one searchable dropdown: sticky search,
All cards reset, pack checkbox, chevron-opened nested deck list, outside-click
and Escape close. Multi-pack/deck rules are unchanged. Updated the locked ticket
with the revision and the IMPL/rehearsal wording.
Verification: npm run typecheck, npm run lint and npm run build pass, PWA
check passes. A static harness using the shipped CSS was captured for a visual
read.
Verdict: control revision built; learner should review the fresh build.
Next: serve the new build on a fresh port, then wait for the learner's read.

### 7 — 2026-10-28T01:46
Action: the learner reported that every scope pick closed the dropdown. The
scope change rebuilt the plan through the loading phase, which unmounted the
plan screen and the picker with it. A scope change now refreshes behind the
current plan instead: the plan screen stays mounted, the dropdown stays open,
and the newest request wins. Start and Rebuild wait while the new plan lands.
Verification: npm run typecheck and npm run lint pass; npm run build succeeds
and the PWA check passes (version 0e5e3956be51e3c6).
Verdict: the picker now supports several picks without closing.
Next: serve the new build on a fresh port for the learner's read.

### 8 — 2026-10-28T01:58
Action: the learner asked for a green dot instead of a checkbox and a capped,
scrolling deck list per pack. Rows are buttons with a green dot for a chosen
source, no dot for an unchosen one and a half-green dot for a partly chosen
pack. Each open deck list now scrolls inside a 160px cap.
Verification: npm run typecheck and npm run lint pass; npm run build succeeds
and the PWA check passes (version c97503dee7a60756).
Verdict: the control matches the requested dot and scroll behavior.
Next: serve the new build on a fresh port for the learner's read.

### 9 — 2026-10-28T02:20
Action: the learner asked to remove the dropdown menu's shadow. The menu now
sits flat against the page with only its one-pixel border. The dated stylesheet
note, the locked ticket and the IMPL record the change.
Verification: npm run typecheck and npm run lint pass; npm run build succeeds
and the PWA check passes (version 6901e19283612fbd).
Verdict: the menu has no shadow in either theme.
Next: serve the new build on a fresh port for the learner's read.

### 10 — 2026-10-28T02:35
Action: the learner opened Plan details at phone width and found every section
stacked, with the whole "Why these cards" list running down the page. The fold
now reuses the same tabs as the desktop panel, so one section shows at a time,
and its body caps at 52vh with its own scroll. The fold stays a disclosure in
the page flow; the desktop aside is unchanged.
Verification: npm run typecheck and npm run lint pass; npm run build succeeds
and the PWA check passes (version 306f4c9d9abfbabf). A static harness in a
390px column shows the three tabs fit and the reason list scrolls.
Verdict: the phone plan details shows one tab at a time inside a scrolling cap.
Next: serve the new build on a fresh port for the learner's read.
