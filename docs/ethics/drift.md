# Flashcards - Drift Ethics

## IMPORTANT!!!
  The drift log records the gap between a locked decision and the code.
  It is a gate, not a diary. A gap nobody closes is a decision nobody kept.

  ### The Log And Its Checker
    - `docs/drift.md` is the only drift log.
    - `node scripts/check-drift.mjs` (or `npm run check:drift`) checks it.

  ### Three Gates, Not One
    - `npm run check:drift` - the log is well formed: counts, fields, real
      `path:line` references, and quotes that match the cited lines.
    - `npm run check:drift:staged` - **the commit gate.** It reads the staging
      area, takes the files each live entry names in `Code reality:` and
      `To fix:`, and fails when a staged file belongs to an Open or Awaiting
      entry. An Open entry must be resolved in the same commit; an Awaiting
      entry must wait for the learner.
    - `npm run check:drift:release` - **the release gate.** It fails while any
      Open or Awaiting entry remains, and names each one.

  ### Turn The Commit Gate On
    - Once per clone, run `git config core.hooksPath .githooks`. Worktrees of
      that clone share the setting.
    - After that, `.githooks/pre-commit` runs the staged gate on every commit.
    - The hook is a tracked file, not a local trick. Commit it, or it protects
      only the checkout that has it.
    - This is configuration, so the learner runs it; an agent must not change
      git config.

  ### What Makes An Entry Policeable
    - The staged gate can only protect a file the entry names, so `Code reality:`
      must carry the path in backticks, with a line when the line matters.
    - An entry that names no file is still a true record, but it cannot stop a
      commit. Name the file.

  ### Three States
    - **Open** - a real gap in the code. It describes the gap, never the fix.
    - **Awaiting decision** - an extension or contradiction that needs the
      learner's call. It carries the exact question.
    - **Resolved** - fixed, with a `Verified by:` line saying how.

  ### Origin Before Code
    - `feature-pipeline` for new capability.
    - `surgical-change` only to close a gap against a decision already locked.
    - A surgical change cites a D-N that existed **before** the change began.

  ### What A Live Entry Carries
    - `Doc claim:` the words copied from the doc, plus `path:line`.
    - `Code reality:` what the code does, plus `path:line`.
    - `Why matters:`, `Owner:`, `To fix:`, `Related:`.

  ### DOs
    - Quote the doc. Never cite from memory; the checker compares the words
      with the line.
    - Run the checker after any code or doc change.
    - Run the staged gate before every commit, and the release gate before any
      tag or deploy.
    - Keep `.githooks/pre-commit` tracked, so every checkout gets the gate.
    - Keep the header counts true.
    - Fix a stale reference instead of deleting the entry.
    - File new design as Awaiting decision, with the question.
    - Leave every Awaiting decision to the learner to answer.

  ## DO NOTs
    - **DO NOT AUTHORISE YOUR OWN WORK** - never write the entry that permits
      the change you are making, in the same diff or at all.
    - **DO NOT CALL A FIX OPEN** - if the fix rides in the same diff, the
      entry is Resolved.
    - **DO NOT FILE NEW DESIGN AS DRIFT** - an extension is a decision, not a
      gap.
    - **DO NOT DELETE AN ENTRY TO SILENCE THE CHECKER** - fix it, or record
      why it cannot be fixed.
    - **DO NOT COMMIT A LIVE ENTRY'S FILE** - the staged gate refuses it. Resolve
      the entry in the same commit, or wait for the learner's decision.
    - **DO NOT RELEASE OVER A LIVE ENTRY** - the release gate refuses it.
    - **DO NOT LET THE LOG ROT** - a stale warning in history is still a lie
      waiting to be followed.

  ### Why
    2026-10-25: an interface-polish job was labelled `surgical-change`, wrote
    its own D-12 to D-14 in the same diff, and cited lines from memory. One
    citation pointed at the single word "column."; another quoted an "app
    mark" the doc never promised. The checker exists so that failure cannot
    repeat quietly.
