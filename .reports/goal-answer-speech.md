# Goal: answer speech, full implementation

**Contract**
- Outcome: the learner presses one control under the answer and hears it in the
  pack's language; a code answer is explained, never read as symbols.
- Acceptance evidence: the 12 pure tests, the full suite, the build, the
  six-scenario sim, the served page, and a clean drift gate.
- Scope: wayfinder decision 19 only. No other learner request, no provider call,
  no new package.
- Authority: `explicit` — Victor, 2026-10-27: "commit what we have handle the
  answer speech full implementation 1st". Commit and push are allowed on the
  feature branch; merge stays a human gate.
- Budget: one worktree, one implementation pass, one drift pass.
- Stop conditions: the PR human gate, or a decision the ticket does not cover.

**Pipeline:** feature-pipeline. Worktree `feature/answer-speech`.

## Iterations

### 1 — 2026-10-27T06:40
Action: anchored on the committed decision (073f057), routed to
`feature-pipeline`, created the worktree, read `StudyCard`, `CardSide`,
`StudyClient`, `speech.ts`, `layer.ts`, the card types and the tests.
Verification: branch `feature/answer-speech`, not `main`; `packLanguage` already
exists at `StudyClient.tsx:782`; `speak(text, lang)` exists; the answer is
rendered at `StudyCard.tsx:233`.
Verdict: pass. Failure class: none. Pivot: none.
Next: write the GRILL, the pre-impl sim and the pack docs.

### 2 — 2026-10-27T06:52
Action: wrote the GRILL, the pre-impl sim, the PRD-TRD and the IMPL; implemented
`answerSpeech`, `speechSupported`, the card control and the CSS; wrote 12 tests.
Verification: targeted 10/10 first; typecheck clean; changed-file lint clean;
build passed; full suite 61 files / 688 tests.
Verdict: pass. Failure class: the worktree had no `node_modules`; a symlink to
the Windows checkout broke Turbopack, so `npm ci` ran inside the worktree.
Pivot: reinstall, not restructure.
Next: post-impl sim and drift.

### 3 — 2026-10-27T07:07
Action: ran the node sim, then a drift sub-agent. The agent found one real gap:
the code explanation was appended last instead of taking the code's place.
Verification: fixed `answerSpeech` to push the explanation at the first code
part; added two tests (code before text, several code parts); extended the sim
to both orders, the no-voice guard and the existing controls.
Verdict: pass after the fix — targeted 12/12, full suite 61/690, build passed,
sim 6/6, served `out/` 200 from Windows on localhost and the WSL address.
Failure class: ordering, caught by drift. Pivot: none.
Next: commit, push, open PR #3, raise the human-review gate and stop.

### 4 — 2026-10-27T07:15
Action: committed `e8d671b`, pushed `feature/answer-speech`, opened PR #3, and
created the hub event `answer-speech-review`.
Verification: event note carries the PR URL, publisher `opencode`, full ask.
The voice mouth is missing (`hermes` not on PATH), so only the text poke is
queued; `pending-victor.md` stayed empty because the CLI crashes in the voice
step. Raised in chat instead.
Verdict: human gate reached. Waiting for review.
