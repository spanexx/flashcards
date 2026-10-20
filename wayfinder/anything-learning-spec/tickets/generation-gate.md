**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** T6

# The generation gate: proposed cards become the learner's cards

## Question

A, I, generated cards are proposals, not cards. Lock the gate between them.

Decide: card states and the transitions between them (proposed, accepted, edited, rejected, scheduled, retired); what the learner sees when reviewing a batch of proposals; what actions they can take per card and per batch; whether rejection teaches the system anything; whether a proposal can become schedulable without being accepted (for example, a low-stakes warm-up); what happens to evidence once a card is accepted and edited; and what the prompt looks like â€” weak topics, level, learning style, plus whatever the pack asks for.

Concrete scenarios: the learner rejects forty proposals in a row; a generated card is wrong; the learner wants to write the answer themselves; a proposal is good but badly worded.

## Resolution

A card has two states: **proposed** and **yours**. Nothing in between. The learner keeps it, edits it and keeps it, or throws it away.

A thrown-away card is gone - not stored, not kept for later. But the rejection itself is remembered as a **shape, not as wording**: what was rejected, in the form of a shape, never the learner`s or the provider`s text. Rationale: discarding outright teaches nothing, and the provider will offer the same unwanted card again next week because it has no signal. Keeping the shape lets it stop offering that shape while keeping no rejected wording anywhere on disk.

Proposals are reviewed **one at a time, in full**, and every card is judged on its own. No grouping, no bulk decisions, no "keep the rest" shortcut. Rationale: a screen of many cards is where judgement dies, and this is the last point at which a wrong fact can enter the learner`s deck permanently. Speed does not matter here. Accepted cost: twenty clicks when the provider has gone off the rails, and no chance to change one`s mind partway through a batch.

Judging an answer is configurable by the learner, per card and per pack - Laya where a fixed answer set exists, the provider for free text, the learner as a deliberate choice, or nothing. With judging off, the answer is recorded as **unjudged**, which is a distinct state from wrong, and the record can tell them apart.

Editing a card makes it a **brand new card**: zero times seen, zero answered. The prior evidence described a card that no longer exists, and carrying it forward would let the learner be recorded as strong at something that is not there any more. Accepted cost: a learner who edits every proposal - reasonable when the provider`s wording is poor - relearns more than necessary. The pre-edit card survives in the origin note, so nothing is destroyed; its history is simply not attached to the edited card.

The prompt has **exactly three slots, all owned by the app**: weak topics, level, learning style. Packs own the prompt text and may not declare additional slots. Rationale: every slot is a door, and a pack able to request one could request a slot shaped like the learner`s recent wrong answers, which would defeat the per-item opt-in boundary locked in T2. Accepted cost: packs cannot be as clever as they might like, because they cannot ask anything specific about the learner.

## Amendment - withdrawn in part by The A, I, tutor

Locked here, then reversed there. The reversal is recorded in both places deliberately, so neither ticket can be read without the other.

**Withdrawn by decision 12 of the tutor ticket:** the two-state gate itself. **Proposed and yours, nothing between, is gone.** There is no proposal state, no per-card human judgement, and no accept step. Generated cards are machine-validated - well-formed output, blanks in sane positions - and then they are the learner's cards. The reason given was friction at volume: a deck is validated in the ground, not click-approved one card at a time.

This reverses three lines above: the two-state model, one-at-a-time review, and the accept step. **The reasoning that justified them is not hereby revived** - "a screen of many cards is where judgement dies" was true of a review screen, and there is no longer a review screen.

**What survives the reversal:**

- **Editing still makes a brand new card**, zero history. Untouched.
- **The origin note still names the generation request** on every generated card, so a generated card is never mistaken for a pack's own material.
- **The three app-owned prompt slots stand** as the shape of a generation prompt.
- **Judging stays configurable**, per card and per pack. Untouched.

**What is now owed here and unresolved:** the tutor's prompt is a **fourth app-owned shape** beyond the three locked above. The reasoning that closed the door - every slot is a door, and a pack able to request one could request the learner's recent wrong answers - still holds for packs, and the tutor's slot is app-owned rather than pack-requested, so the door is closed the same way. It is recorded as owed rather than silently absorbed.

**What replaces the gate as the safety net:** the evidence model. A card that is false cannot hide, because every time it is shown it produces bad evidence, and a card missed repeatedly while its neighbours are fine looks exactly like a card that is wrong. Combined with decision 13 of the tutor ticket - the model writes the whole correct thing and the app derives the blanks - the full line is always present on the card, so a false card is wrong in a way the learner can see rather than in a way they must trust.

**Consequence for the open question this ticket never answered:** **Should generation be batch-aware** was only a question because of per-card review. With the review withdrawn, a batch of forty is forty cards. That ticket should be revisited rather than grilled.

## Answers given during the session

1. What are the states between proposed and yours? -> Two only. Proposed, then yours or gone.
2. What happens on rejection? -> The card is discarded; the rejection is remembered as a shape, not as content.
3. How are batches reviewed? -> One card at a time, in full, every card judged individually. No grouping.
4. What happens to evidence after an edit? -> Reset. The edited card is new, with zero history.
5. What goes in the prompt? -> Three app-owned slots - weak topics, level, learning style. Packs declare no others.
6. Can the learner turn judging off? -> Yes, per card and per pack. Unjudged is recorded distinctly from wrong.
