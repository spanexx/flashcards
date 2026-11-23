# Drift review — mode-editor-design (2026-11-23)

**Reviewer:** fresh-eyes sub-agent, read-only
**Verdict:** Major Drift found; all items closed before ship

The implementation matched the approved two-tab design. The review caught
delivery and usability gaps, all closed:

1. Phase 5 was undelivered. `simulate.sh` was untracked and the handoff was
   stale. This note, the archived pre-sim, the delivery note and the final
   commit close it.
2. The JSON tree's `skillInstructions` link opened the Markdown tab but did not
   focus the source. It now focuses the textarea on the next frame.
3. JSON syntax colours were hardcoded for dark mode and illegible in light mode.
   They now come from `--json-key`, `--json-string`, `--json-bool` and
   `--json-num`, defined in both theme roots.
4. Numeric tree inputs committed on every keystroke, turning `-` into `NaN` and
   an empty box into `0`. They now keep the typed text and commit on blur.
5. The sessionStorage handoff had no tests. `mode-editor-handoff.test.ts` now
   proves draft/notice round trips, clear-on-read, malformed drafts and the
   no-storage guard.
6. Docs named handoff files that were never created; they now name
   `mode-editor-handoff.ts`. The archived wireframe comments carry the correct
   `PACK: mode-editor-design` tag.

**Evidence after fixes:** full suite 101 files / 1262 tests; 24 targeted tests;
build green with `check-pwa: passed` and `out/modes/editor/index.html`;
`simulate.sh` PASS; typecheck, changed-file eslint, both drift gates green.

**Reconciliation:** the approved HTML prototype is archived at
`archive/simulate-pre/`. `simulate.sh` is the single canonical rehearsal.
