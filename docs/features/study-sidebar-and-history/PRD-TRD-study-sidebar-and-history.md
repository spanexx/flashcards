# PRD-TRD: Study sidebar and previous sessions

**Slug:** study-sidebar-and-history
**Status:** Approved (learner said "go", 2026-10-27)
**Date:** 2026-10-27

## Why This Exists

The Study plan is one wide column. The three things that explain the offer — the
tutor and hints, what to expect, and why these cards — sit under it as three
stacked disclosures, so the plan reads as a short page followed by a wall. The
learner asked for those to move beside the plan, and for the last few sessions to
take their old place as a short list, so the plan has continuity without
becoming another history page.

The learner then added: the previous lessons should have details and can be
re-learned. Details stay the plain row (time, scope, answered / offered,
finished or stopped); re-learning starts a fresh plan on the same pack and deck.

## Behavioral Spec

### Scenario 1: the plan keeps its wide column

**Given** a learner on the Study plan on a desktop screen
**When** the plan renders
**Then** the headline, scope, offer, Rebuild, Start and the two facts stay in one
wide main column, and the secondary material sits in a right-hand panel instead
of under the plan.

### Scenario 2: the right panel is tabbed

**Given** the plan screen with a tutor configured or not
**When** the learner uses the right panel
**Then** it offers "Tutorial and hints" (or "Hints" when there is no tutor), "What
to expect" and "Why these cards" as tabs; the first tab is open; the tutor
choice, its exact-shape disclosure and its words are unchanged.

The panel caps at the viewport height, with the tab row fixed and only the body
scrolling, so a long list of reasons never stretches the plan page.

### Scenario 3: previous sessions are a plain list

**Given** at least one ended session
**When** the plan renders
**Then** the main column shows "Previous sessions": up to five rows, newest
first, each with the local date and time, the scope it drew from, "answered /
offered", and finished or stopped. It is a list, not a disclosure or dropdown.

### Scenario 4: re-learn the same scope

**Given** a past session whose pack and deck were recorded
**When** the learner presses "Learn again" on its row
**Then** the plan rebuilds for that same pack and deck; the learner still
presses Start, and the exact cards are not replayed.

### Scenario 5: a row from before scopes were recorded

**Given** an ended session with no pack or deck recorded
**When** the plan renders
**Then** the row still shows its time, counts and status, leaves the scope blank,
and has no "Learn again" action.

### Scenario 6: no history

**Given** no ended sessions
**When** the plan renders
**Then** one calm line says no finished sessions yet, with no empty box.

### Scenario 7: the phone keeps the plan width

**Given** a screen narrower than 860px
**When** the plan renders
**Then** the right panel is hidden and one "Plan details" disclosure under the
plan holds the same three sections stacked; the previous sessions list stays in
the main column and narrows.

## Simulation Contract

The post-impl simulation runs the real `recentSessions` builder through the
project's TypeScript and checks the list rules; it also checks the shipped
source and built chunk for the panel and the action. The visual design is proven
by the pre-sim and the human review, because the suite has no DOM.

```
scenario 1 → the built chunk carries "Previous sessions" and "Learn again";
             StudyPlan still renders the headline and Start
scenario 2 → "Tutorial and hints", "What to expect", "Why these cards" are in the
             shipped source; "Plan details" is the phone fold label
scenario 3 → recentSessions pairs started+ended, newest first, cap 5, only ended
scenario 4 → a past row with pack "Polish" and deck "food" rebuilds those values
scenario 5 → an ended row with no started fact has no pack and no deck
scenario 6 → no ended events -> an empty list
scenario 7 → the 860px rule hides the aside and shows the fold
scenario 8 → Learn again sets the scope and rebuilds through loadPlan
scenario 9 → the aside caps at the viewport and scrolls its body
```

## Technical Design

### Data Models

- `SessionEvent` (`v1/src/lib/shared/types.ts:156-164`) gains optional `pack`
  and `deck`. A new session writes them from the plan request: `pack: ""` means
  the whole library. Old rows leave both absent, which is not the same as an
  empty pack.
- `PastSession` is the read shape: `{ id, at, offered, answered, completed,
  stopped, pack?, deck? }`.
- The sessions store keys facts by session id, so the ended fact replaces the
  started one. The ended fact therefore carries the pack/deck forward, and the
  builder also accepts a started fact's values for any store that keeps both.
- `recentSessions(events, limit = 5)` in `v1/src/lib/core/past-sessions.ts`:
  keep ended events, newest first, cap at five, and read the scope from the
  ended fact (or its started fact when present).

### API Contracts

`planAnswer` (`v1/src/lib/browser/router.ts:231`) reads the session facts once
and returns `past` with every response, including the empty-plan responses:

```ts
{ plan: Plan | null; message: string | null; past: PastSession[] }
```

The started fact it appends gains `pack: packName ?? ""` and `deck: deckId ?? ""`.
`/api/session/end` copies both onto the ended fact before that fact replaces the
start, so the finished row keeps its scope.

`StudyClient` (`v1/src/app/StudyClient.tsx`) keeps `past` beside `plan`, passes it
to `StudyPlan`, and handles re-learning by setting the scope and calling
`loadPlan(offerChoice, pack, deck)` — the same path the scope picker uses.

`StudyPlan` (`v1/src/app/study/StudyPlan.tsx`) splits into:

- the main column (unchanged head, scope, offer, Start, plus the new list),
- `PlanAside` with the three tabbed sections,
- a mobile `<details>` that stacks the same three sections.

`PreviousSessions` (`v1/src/app/study/PreviousSessions.tsx`) renders the list,
resolves a deck id to its current name through `packs`, and shows "Learn again"
only when `pack` is present.

### CSS

- `.study-plan-layout`: grid, `minmax(0, 860px) 320px`, 34px gap, max 1214px.
- `.study-aside`: sticky at 24px, bordered card.
- `.study-fold`: hidden on desktop; at `max-width: 860px` the aside is hidden and
  the fold is shown, single column.
- The standalone `.study-plan` (empty and done screens) keeps its 860px centring.

### Dependencies

None. No new package, no provider call, no new store. The backup schema accepts
the two optional session fields so a restore keeps them.

## Non-Goals

- No expander, no card list, no per-card answers in the history rows.
- No exact-card replay; "Learn again" rebuilds the same scope.
- No full history page, search, filter or "show more".
- No change to Progress, the algorithm, the session loop, the Resume snapshot,
  the scope picker or the offer control.
- No tab state persistence; the plan opens on the first tab each time.

## References

- `docs/features/study-sidebar-and-history/GRILL-study-sidebar-and-history.txt`
- `wayfinder/anything-learning-spec/tickets/study-sidebar-and-history.md`
- `v1/src/app/study/StudyPlan.tsx`, `v1/src/app/study/ScopePicker.tsx`
- `v1/src/lib/core/session.ts`, `v1/src/lib/browser/router.ts`,
  `v1/src/lib/browser/bundle.ts`
