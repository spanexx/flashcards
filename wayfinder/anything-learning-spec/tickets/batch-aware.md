**Type:** grilling
**Status:** resolved
**Delivery:** small-change
**Blocks:** -

# Should generation be batch-aware

## Question

Surfaced by [Polish, end to end](polish-walkthrough.md) (ticket 8).

Polish reuses the same noun across seven case topics. When the provider generated a batch of cards for the genitive, it offered *kot → kota*, then the same card again, differing only by the case being asked. Twenty proposals, three nouns, no variety.

Nothing in the locked design stops this, and nothing in it wants it.

Decide: should generation know what is already proposed in the same batch, so it does not repeat itself? If yes — how does it know, what does it see, and does that conflict with the privacy boundary (only app-chosen categories may leave)? If no — is a repetition-prone generator acceptable because the learner throws away repeats at the gate, and the rejection-as-shape signal eventually teaches it?

Note: any solution must keep the pack to three prompt slots and must never put learner text into a prompt.

## Where it came from

[Polish, end to end](polish-walkthrough.md) — friction 2. Full account in [wireframe/polish-walkthrough/friction.md](../../wireframe/polish-walkthrough/friction.md).

## Resolution

**No batch memory. Generation is not batch-aware.** The repeats do not need the
model to see its own earlier cards, because card identity already stops exact
repeats: a generated card's id is the pack name, the full line and the hidden
target, so the same line inside one reply collapses before saving, and the same
line against the deck overwrites itself. The gate the old question leaned on is
gone — the tutor ticket withdrew the proposal state — so what protects the deck
is identity plus machine validation, not a learner throwing repeats away.

**Variety is a prompt instruction, not a memory.** The walkthrough showed
twenty cards built from three nouns. The cheapest honest fix is one sentence in
the generation prompt — the app default and the Polish pack's own template,
since that pack owns its prompt — asking to vary the nouns, verbs and sentence
shapes and not to reuse a line. No second provider call, no feedback loop, no
learner text, no new prompt slot.

**Accepted costs, named:** the same line asked under two topics keeps only the
last topic, because topic is not part of card identity; and a prompt sentence
does not guarantee variety. If real batches still repeat after this, the
friction returns as evidence, not as a feature built on speculation.

## Deliberately not done

- No two-pass generation (ask for nouns first, then lines).
- No memory of earlier batches.
- No near-duplicate clustering; the same noun in a different sentence is a
  different card and often a useful one.
- No change to the pack's three prompt slots and no learner text in any prompt.

## Why

Batch memory would add calls, cost and a privacy surface for a problem already
covered by identity and one instruction. The prompt sentence keeps the pack in
charge of its own words and the app thin.

## Source

Learner review, 2026-10-19: "close" to the recommendation; GRILL Round 2 U3.
Code: `v1/src/lib/provider/generate.ts` (content identity and batch dedupe),
`v1/src/lib/provider/prompt.ts` (default generation template).
