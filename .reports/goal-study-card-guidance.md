# Goal: the typing card guides the learner instead of judging an empty card

**Contract**
- Outcome: a learner on a typed card cannot submit nothing, a beginner can
  finish the expected answer from an inline completion, a stuck learner can
  reveal the answer on purpose, and accepting a completion has a soft sound
  when sound is on.
- Acceptance evidence:
  - The learner's 2026-10-28 request is recorded in a resolved wayfinder
    ticket; the pack has a locked GRILL, a PRD-TRD and an IMPL.
  - Targeted pure tests pass for the attempt rule and the completion rule.
  - `npx tsc --noEmit` in `v1/` -> clean; changed-file eslint -> clean.
  - `npm run build` in `v1/` -> succeeds, including `check-pwa: passed`.
  - Full suite `node node_modules/vitest/vitest.mjs run --maxWorkers=2` ->
    every file passes.
  - Screenshots of the real built export: empty (Answer disabled), ghost
    completion, accepted answer, I don't know reveal, and phone width; all
    viewed before merging.
  - `npm run check:drift` and `npm run check:drift:staged` -> 0 open,
    0 awaiting.
  - main equals origin/main after the push; no merged worktree or branch is
    left; no server, headless browser, temp harness or build scratch remains.
- Scope: the study card's answering surface (`StudyCard`), the card level
  passed from `StudyClient`, two small core helpers, the sound cue list, the
  card CSS, tests and the pack docs. Must not change the judge, the evidence
  shape, the privacy boundary, the plan or the session loop; no completion for
  cloze blanks or picks; no automatic insertion.
- Authority: `delegated` by the learner on 2026-10-28 ("add more learner
  experience ... you can add other better experiences"). Commit, merge, push
  and branch removal were explicitly granted in the same message.
- Budget: one worktree; two attempts per failure class; bounded commands; stop
  with a written handoff if the clock or context runs out.
- Stop conditions: a visual check that fails twice; an ethics conflict; a
  decision that changes scope or a non-goal.

**Routing note:** the learner named `surgical-change`, but autocomplete and the
new sound are new learner-visible behavior. `docs/ethics/origin.md` routes new
behavior through `feature-pipeline`; this pack follows the repo's existing lean
shape (resolved wayfinder ticket + GRILL + PRD-TRD + IMPL + tests), and the
learner's explicit merge/push/cleanup instruction stands as the go.

**Worktree:** `/home/spanexx/.config/superpowers/worktrees/flashcards/fix-answer-required`
**Branch:** `fix/answer-required`

## Iterations

### 1 — 2026-10-28
Action: isolated the work in a worktree after moving the untracked session note
aside and restoring it. Read the card, judge, types, normalize, sound and
session files. Wrote the attempt-rule test first, saw it red (module missing),
then added `answer-attempt.ts`; 4 tests passed. Wired `StudyCard` to the rule;
typecheck and changed-file lint clean.
Next: record the decisions and finish the completion, I-don't-know and sound
work.

### 2 — 2026-10-28
Action: recorded the ticket, map entry, locked GRILL, PRD-TRD and this IMPL.
Wrote `answer-completion.ts` test first (6 tests), wired the ghost, Tab/arrow
and Complete routes, the I-don't-know control and the `complete` cue (sound
suite now 9 tests). Typecheck and changed-file lint clean; targeted 19 tests
pass. Built the webpack export and served it for the visual pass. The pass found
two real faults: Complete took the caret out of the field, and the ghost did not
share the input's baseline/font. Fixed both, rebuilt, and re-checked. Captured
and viewed empty-disabled, ghost, accepted, Got it, I-don't-know, phone width
and light theme; drove an intermediate card and saw no ghost or Complete.
Full suite 70 files / 746 tests pass.

### 3 — 2026-10-28 (close)
Action: restored the app profile (deleted the two throwaway packs, theme back
to dark), filled the IMPL verification and delivery note, ran both drift gates,
committed, fast-forwarded `main`, pushed, and removed the worktree, branch,
symlink, server and scratch. The worktree's node_modules symlink and the temp
packs never entered a commit.
