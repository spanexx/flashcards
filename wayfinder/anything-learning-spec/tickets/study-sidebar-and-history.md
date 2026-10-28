**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# Study sidebar and previous sessions

## Question

The learner said the Study plan screen is too thin. In their words: "the study is
scanty. So keep the wide." They asked for the "why these cards" and "what to
expect" panels to move out of the main column into a right-hand tabbed panel,
and for the previous sessions to take the old place of those dropdowns in the
main area, as a short list rather than a dropdown.

## Resolution

**The wide plan column stays.** Study keeps its single centered column for the
headline, scope, offer, Rebuild, Start and the plan facts.

**A right-hand panel holds the secondary material, on the plan screen only.**
It is tabbed:

- **Tutorial and hints** — the existing tutor disclosure, unchanged in content:
  the tutor availability, the exact shape of what it would see, and the
  turn-on/off control.
- **What to expect** — the three lines now at `StudyPlan.tsx:116-123`.
- **Why these cards** — the reason groups now at `StudyPlan.tsx:97-114`.

The panel is hidden while a card is running, matching the locked rule that plan
material disappears during review.

**Previous sessions replaces the old dropdown row in the main column.** It is a
plain list, not a disclosure, showing the **last five ended sessions**, newest
first. Each row names the date and time, the scope it drew from, and
"answered / offered", and says whether it finished or was stopped. If there is
no history, one calm line says so.

**Agent decisions, marked `[agent decision]`:**

- The right panel is about 320px on desktop; below 860px it folds into one
  disclosure under the plan, so the phone does not lose the plan width.
- The hard cap is five sessions; there is no "show more" in this pass.
- The list reads the existing `SessionEvent` rows through `readSessions()`
  (`v1/src/lib/browser/repository.ts:214`, shape at
  `v1/src/lib/shared/types.ts:156-164`); no new store.

## Deliberately not done

- No full session-history page, search or filter.
- No per-card statistics on the plan.
- No change to the Progress screen, the algorithm or the session loop.
- No new persistence: the panel tab and the list are read-only views.

## Why

The plan is an offer: its reasons and expectations belong beside it, at the same
glance, instead of under it in three stacked disclosures. Recent sessions give
continuity without turning the plan into a long wall, which is the same reason
the learner asked for five and no more.

## Source

Learner voice note, 2026-10-26. Typed confirmation from the learner,
2026-10-27: "main area = previous sessions, right sidebar = the moved panels".
Current code: `v1/src/app/study/StudyPlan.tsx:97-173` (the three disclosures),
`v1/src/app/study/ScopePicker.tsx:16-19` (the single pack/deck choice),
`v1/src/lib/browser/repository.ts:214` (`readSessions`).

## Amendment (2026-10-27): details and re-learning

The learner added, verbatim: "the previous lessons should have details and can
be re learnt". Asked what that meant, they chose:

- **Details stay plain.** The row itself is the detail: local date and time,
  the scope it drew from, "answered / offered", and finished or stopped. No
  expander, no card list, no per-card answers.
- **Re-learn starts a fresh session on the same pack/deck.** One "Learn again"
  action on the row scopes the plan to that session's pack and deck and rebuilds
  it. The learner still presses Start; the plan is still an offer. The exact
  cards are not replayed.

What this changes in the resolution above:

- The list is no longer read-only. Each row may carry one "Learn again" action.
- A session's started fact gains optional `pack` and `deck` fields, written when
  the session starts. `pack: ""` means the whole library; an absent `pack` means
  the row predates this change, so it shows no scope and no "Learn again".
- Nothing else changes: no expander, no saved card list, no history page, no new
  store.

Recorded by: agent, 2026-10-27, at the learner's instruction. This supersedes
the "read-only views" line and the "no new persistence" line in the
"Deliberately not done" section for the two optional fields and the action
only. The rest of that section still holds.

## Amendment (2026-10-27): the panel has a ceiling

The learner noticed a long "Why these cards" list stretched the whole plan page.
The right panel now caps at the viewport height (`calc(100vh - 48px)`, matching
its 24px sticky offset) and scrolls its own body; the tab row stays in place.
The page itself no longer grows because of the panel. On a phone the fold stays
in the page flow, because it is a disclosure, not a fixed panel.

## Amendment (2026-10-28): the phone fold uses the tabs

The learner opened Plan details on a phone and found every section laid out at
once, with the full "Why these cards" list running down the page. The fold now
carries the same three tabs as the desktop panel, so one section shows at a
time, and its body caps at 52vh and scrolls. The panel stays a disclosure in
the page flow; only its contents change.
