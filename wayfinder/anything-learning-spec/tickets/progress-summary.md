**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# Ask the tutor to summarise progress

## Question

The learner asked for the A, I to be able to read their progress and give a
summary of what they have been learning and where they are. They were clear that
"this should be up to the user because the data that will be sent to the A, I
should not be too long."

## Resolution

**The Progress screen gains a "Summary" tab.** Overview and Every card stay as
they are. The new tab is opt-in: nothing is sent when it opens.

**The learner presses "Ask the tutor for a summary".** Before anything leaves,
the tab shows the exact, short shape that would be sent — the same
"show the exact shape" pattern the tutor banner already uses
(`StudyPlan.tsx:140-143`). The learner confirms or cancels.

**Only derived progress data is sent, never learner text or card text.**
The payload is a compact record of:

- the counts of improvements, faster cards, next topics and strengths;
- topic labels and their card counts;
- the most recent outcomes, by topic, without card summaries;
- the learner's level and learning style.

It carries no card front or back, no answer, no typed working and no learner
words. The payload is capped in size by construction, because it is counts and
topic names only. `[agent decision]`

**The summary is not stored.** It is shown in the tab for that visit and
regenerated on request; no new record is written, so progress conclusions stay
derived, never stored.

**No provider means no summary.** The tab says a provider is needed and the rest
of Progress still works.

**Consent is per request.** There is no remembered "always send" switch in this
pass; every summary is a fresh choice, which is the plainest reading of "this
should be up to the user". `[agent decision]`

## Deliberately not done

- No automatic summary on page load or at session end.
- No card text or learner text in the payload.
- No stored summary and no new evidence row.
- No advice engine: the summary describes, it does not set the plan or judge.

## Why

The learner's own words put the control in their hands and the size limit on the
data. Counts, topic labels and recent outcomes are already app-chosen
categories, so they fit the existing privacy boundary; showing the exact shape
first is the same promise the tutor already keeps. Keeping the summary unstored
protects the rule that conclusions are derived, not written down.

## Source

Learner voice note, 2026-10-26: "for the A, I ... to have access to our progress
... give summary to what we've been learning, where we are ... this should be up
to the user because the data that will be sent to the A, I should not be too
long." Derived-only view: `v1/src/lib/shared/types.ts:234-248` (`ProgressView`).
Privacy boundary: `wayfinder/anything-learning-spec/tickets/privacy-boundary.md`;
`docs/ethics/dev-lane/data.md:16-24`.
