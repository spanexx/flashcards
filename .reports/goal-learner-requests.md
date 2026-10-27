# Goal: five learner requests have locked decision records

**Contract**
- Outcome: the five requests the learner made on 2026-10-26 — Study sidebar and
  recent sessions, spoken answers, import repair with the provider, an opt-in
  progress summary, and multi-pack/deck plan scope — each have a locked decision
  record in the wayfinder tracker, with the learner's words, the resolution, the
  non-goals, the why and the source.
- Acceptance evidence:
  - five new ticket files under
    `wayfinder/anything-learning-spec/tickets/` each carry `Type`, `Status`,
    `Delivery`, `Blocks`, and the sections `Question`, `Resolution`,
    `Deliberately not done`, `Why`, `Source`;
  - `wayfinder/anything-learning-spec/map.md` lists tickets 18–22 and carries one
    decision bullet each;
  - every agent-filled choice is marked `[agent decision]` and no learner quote
    is invented;
  - the import-repair ticket records the learner-approved exception to the
    privacy boundary explicitly.
- Scope: the five ticket files, `map.md`, this ledger, and the session handoff.
  No app code, no PRD-TRD, no build, no merge.
- Authority: `delegated` by Victor on 2026-10-27 ("handle the decisions"), limited
  to writing decision records. The learner's own answers of 2026-10-26/27 fix
  the substance. Commit, merge and push remain user-only.
- Budget: one pass; bounded reads and commands. Stop if a decision needs a
  change to scope, a locked non-goal, or the ethics.
- Stop conditions: the human gate (commit/merge), or a conflict with a locked
  decision that the learner must answer.

**Pipeline:** direct (doc-only decisions; no code). Implementation routes to
`feature-pipeline` afterwards, because all five are new surface.

**Worktree:** none. Doc-only work; no implementation file was touched.

## Iterations

### 1 — 2026-10-27T07:10
Action: anchored on the handoff and the wayfinder map; read the five requests
and the learner's clarifications; routed to direct doc-only work; read the
current Study plan, scope picker, job dock, speech helper, types and progress
types to ground the decisions.
Verification: `git log --oneline -12` -> `main` at `9117c12`; map ticket table
ends at row 17; `StudyPlan.tsx:97-173` holds the three disclosures;
`ScopePicker.tsx:16-19` holds the two single selects; `JobsDock.tsx:230-253`
holds the Try again / View / Dismiss row; `speech.ts:8` exposes `speak(text,
lang)`; types expose `SessionEvent`, `ProgressView`, `CardPart.code` and
`CardPart.speak`.
Verdict: pass.
Failure class: none.
Pivot: none.
Next: write the five tickets, then update the map and verify the structure.

### 2 — 2026-10-27T07:18
Action: wrote `study-sidebar-and-history.md`, `answer-speech.md`,
`import-repair.md`, `progress-summary.md` and `plan-multi-select.md`; recorded
the learner's typed confirmation for the Study layout; marked agent choices
(`[agent decision]`) for the 320px panel, the five-session cap, the code-answer
fallback line, the icon glyphs, the per-request consent and the scope-control
shape; recorded the import-repair privacy exception as the learner's own request.
Added the five decision bullets and rows 18–22 to `map.md`.
Verification: the five files exist and carry every required section; `map.md`
contains rows 18–22 and five matching links; no learner quote was invented —
each quote is taken from the learner's 2026-10-26/27 messages.
Verdict: pass.
Failure class: none.
Pivot: none.
Next: implementation needs `feature-pipeline` per request (or grouped packs),
because every item is new surface. The privacy exception needs the learner's
awareness, not a new question — they asked for it directly.
