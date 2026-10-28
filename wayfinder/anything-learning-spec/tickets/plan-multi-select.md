**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# Build a plan from many packs and decks

## Question

The plan builder currently picks one pack and, inside it, one deck
(`ScopePicker.tsx:16-19`). The learner asked to "select more than one pack. And
to select more than one deck." They did not ask for individual cards: "you can
select packs and decks now. This is enough. We don't have to select individual
cards. Based on the algorithm, I think the algorithm is able to choose the cards
and packs for us."

## Resolution

**The scope becomes a multi-select of packs and decks.** The two single dropdowns
are replaced by a scope panel:

- The default stays **All cards** — the whole library.
- Any number of packs can be ticked. Ticking a pack includes all of its decks.
- Under a ticked pack, individual decks can be unticked to narrow it. Decks from
  several packs can be active at the same time.
- The plan draws from the **union** of the selected packs and decks.
- An empty selection means the whole library, the same as All cards.

**Individual cards are never selectable.** The selection algorithm still chooses
which cards appear, as locked in the session-loop ticket; the learner chooses the
source, not the cards.

**The choice lives for the visit.** It is component state, not a stored setting;
leaving Study and returning resets it to All cards. `[agent decision]`

**The plan names the selection.** The lede reads the selection plainly — one
pack by name, "3 packs", "All decks in 2 packs", or "the whole library" — so the
learner can see the breadth before starting.

**Agent decision on the control (revised 2026-10-28):** one compact dropdown,
not a list spread across the page. The first pass used a visible checkbox panel;
the learner called it "bulky" and "not minimal" and asked for the pack dropdown
back, with the decks folded inside it and a comfortable search. The multi-select
rules did not change.

Inside the dropdown:

- a search field filters packs and decks by name;
- **All cards** resets the choice to the whole library;
- a green dot marks a chosen source; an unchosen row has no dot;
- each pack has a dot for all of its decks and a chevron that opens the nested
  deck list;
- a partly selected pack keeps a half-green dot;
- each open deck list has a capped height and scrolls, so a pack with many
  decks cannot take over the menu;
- the menu has no shadow; a plain one-pixel edge separates it from the page;
- picking or unpicking a source keeps the dropdown open while the plan
  refreshes behind it;
- the trigger names the current selection, so the breadth is still visible
  before starting.

## Deliberately not done

- No per-card selection and no card-level search in the plan.
- No saved or named plans.
- No change to the selection algorithm, the offer, or the session loop.
- No cross-pack deck merging: a deck keeps its pack identity.

## Why

The learner's own rule is that the algorithm owns card choice and the learner
owns the source. Multi-select packs and decks widens the source without
weakening that split, and the union rule keeps the plan honest about what it drew
from.

## Source

Learner voice note, 2026-10-26: "I need to be able to select more than one pack.
And to select more than one deck ... You can select packs and decks now. This is
enough. We don't have to select individual cards." Current code:
`v1/src/app/study/ScopePicker.tsx:16-19`, `v1/src/app/study/StudyPlan.tsx:65-66`.
Locked algorithm ownership: `wayfinder/anything-learning-spec/tickets/session-loop.md`.
