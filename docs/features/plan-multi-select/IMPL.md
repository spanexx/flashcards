# IMPL: Build a plan from many packs and decks

**Slug:** plan-multi-select
**Status:** Implemented; awaiting learner visual check
**Date:** 2026-10-27
**Origin:** `wayfinder/anything-learning-spec/tickets/plan-multi-select.md` (resolved GRILL, learner voice note 2026-10-26)

## What this pack builds

The two single dropdowns are replaced by one compact, searchable dropdown. The
learner chooses sources; the algorithm still chooses cards.

- The trigger shows the current selection using the shared summary.
- A search field at the top filters packs and decks by name. A deck match opens
  its pack and shows the matching decks; a pack match shows all of its decks.
- **All cards** is the default and means the whole library. An empty scope and
  All cards are the same state.
- Choosing a pack includes every deck in it. A chevron opens the pack's nested
  deck list so one deck can be narrowed without hiding its pack.
- A green dot marks a chosen source; an unchosen row has no dot. A partly
  selected pack shows a half-green dot, and choosing it returns the pack to all
  decks.
- An open deck list has a capped height and scrolls on its own, so a pack with
  many decks cannot take over the menu.
- Several packs and decks can be active at once. The plan draws from the union.
- A pack with no decks is disabled and says "no decks".
- Individual cards are never selectable. There is no saved plan and no named
  plan.
- The choice lives in component state for the visit. Leaving Study resets it to
  All cards.
- The trigger names the selection using the shared summary: the whole library,
  one pack, `pack / deck`, `N decks in pack`, `all decks in N packs`, or
  `N packs`.
- The finished session fact carries `scope`. Recent sessions replay the same
  scope. Older one-pack rows use their saved `pack`/`deck` and today's deck list;
  rows whose pack or deck is gone are not offered.
- A resumed snapshot now stores the whole scope. Version-1 snapshots migrate and
  are rewritten as version 2 with no old `scopePack`/`scopeDeck` fields.
- Old `?pack=&deck=` plan links still work. New requests use the JSON `?scope=`
  form, and `?scope=` wins when both are present.

## Files

- `v1/src/lib/shared/types.ts` — `PlanScopeItem`, `PlanScope`, and
  `SessionEvent.scope`.
- `v1/src/lib/core/plan-scope.ts` — validation, encode/parse, library-order
  normalization, union membership, history replay, plain labels, and the
  all-decks helper.
- `v1/src/lib/core/past-sessions.ts` — carry the whole scope alongside the
  legacy one-pack fields.
- `v1/src/lib/core/session-resume.ts` — version 2 snapshots, v1 migration, and
  forward normalization.
- `v1/src/lib/browser/router.ts` — scope parsing, legacy compatibility, union
  filtering, scope on the started fact, and history replay.
- `v1/src/app/study/ScopePicker.tsx` — the searchable dropdown, green-dot
  selection, nested deck disclosure and selection rules.
- `v1/src/app/study/StudyPlan.tsx` — scoped lede and picker callback.
- `v1/src/app/study/PreviousSessions.tsx` — scope label and relearn.
- `v1/src/app/StudyClient.tsx` — scope state, plan requests, snapshot, stop,
  restart and relearn.
- `v1/src/app/globals.css` — dropdown, search, green dots, the capped scrolling
  deck list, the flat menu edge and the phone layout.
- `v1/tests/plan-scope.test.ts`, `v1/tests/session-resume.test.ts`,
  `v1/tests/browser-router.test.ts`.

## Control revision after learner review

The first build used a visible checkbox panel. On 2026-10-28 the learner called
it bulky and not minimal, and asked for the pack dropdown back with the decks
folded inside it and a comfortable search. The selection rules stayed the same;
the control did not.

A second review on the same day asked for two changes: no checkboxes, only a
green dot on a chosen row, and a capped, scrolling deck list under each pack.
A half-green dot marks a partly chosen pack, and an unchosen row keeps only the
empty space where a dot would sit, so names stay lined up.

A third review asked to drop the menu's shadow. The menu now sits flat against
the page and keeps only its one-pixel border, which reads the same in both
themes.

- The page now shows one trigger, not a list of every pack and deck.
- Opening it shows a sticky search, All cards, and one row per pack.
- A pack chevron opens its decks as a nested list. A pack with no decks stays
  disabled and says "no decks".
- Search matches pack names and deck names. A deck match reveals only the
  matching decks inside its pack.
- Choosing a source refreshes the plan without unmounting the plan screen, so
  the menu stays open while several packs or decks are picked. The newest
  request wins, and Start waits until the new plan is in.
- The menu closes on an outside click or Escape. Escape returns focus to the
  trigger.
- The dropdown lives in the plan's existing scope row and wraps to the phone
  width like the old pack dropdown.

## Edge cases

- A scope that names an unknown pack or deck is refused with a plain message; no
  cards are drawn from an invented source.
- A scope with duplicate packs or decks is merged and put back into library
  order.
- A selected pack whose decks are all removed is refused until the learner
  chooses again.
- A card with no deck id cannot match a narrowed scope. It still matches the
  whole library.
- A v1 snapshot with a pack but no deck recovers the decks named by its plan
  cards. This is a migration limitation: the original all-decks source cannot be
  fully reconstructed after the fact, but the queued cards themselves are
  unchanged.
- A stale history row whose pack or deck no longer exists shows no **Learn
  again** action.
- A finished or stopped session still reports the scope recorded when its plan
  was built; the ended fact copies that scope forward.

## Out of scope

- No per-card selection or card search in the plan.
- No saved or named plans.
- No change to the selection algorithm, offer, or session loop.
- No cross-pack deck merging.
- No stored preference for scope.

## Verification

- [x] `node node_modules/vitest/vitest.mjs run tests/plan-scope.test.ts`
  — 12 passed: encode/parse, invalid values, known-order normalization, labels,
  union membership, all-decks, old and new history rows.
- [x] `node node_modules/vitest/vitest.mjs run tests/session-resume.test.ts`
  — 23 passed, including v1-to-v2 migration and refusing an unknown version.
- [x] `node node_modules/vitest/vitest.mjs run tests/browser-router.test.ts`
  — 56 passed, including a plan drawn from two packs and two decks, with the
  scope recorded on the started fact.
- [x] `npm run typecheck` — clean.
- [x] `npm run lint` — clean.
- [x] `npm run build` — succeeds after the dot and scrolling revision (PWA check
  passed).
- [ ] Learner visual check of the dots with two packs, a narrowed pack, a long
  deck list that scrolls, then search, then a phone width.
