**Type:** prototype
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# How a card is answered — the answering surface

## Question

Raised by Victor as a request for the full experience: flashcards must not be one plain input in one place. The answer should be collected **where the question is asked** — a dotted line in a sentence means "edit here".

Decide what the answering surface is, as a presentation-layer rule the core can host without knowing any subject:

- A card may collect its answer **inline**: dotted, editable regions sitting inside the prompt text itself, typed in place.
- A card may collect by **pick**: fixed chips from a known set — the free, local, Laya lane.
- A card may collect as **one typed free-text answer** — the provider lane.
- A card may collect after **audio**: hear it, then type.

Question behind the question: is the answering surface pack-authored data (the pack decides which regions are editable, like every other pack rule), and the core just hosts a dotted-blank editor? That is the shape consistent with packs-as-data.

Friction found while building (to resolve or swallow): a cloze card has **multiple blanks**, and the locked outcomes — Again / Got it / Nearly / No — are per answer. Multiple blanks means multiple judgments on one card, which the evidence model did not anticipate.

## Asset

- [wireframe/polish-walkthrough/experience/](../../../wireframe/polish-walkthrough/experience/index.html) — the full interactive experience: plan, then cards you type into, chips, and listen-and-type; reveal; four outcomes; wrong cards return; the no-report ending.

## Resolution

The answering surface is **pack-authored and the core hosts it**. The card's prompt side may carry **editable regions** — dotted spaces in a running sentence, typed in place — alongside the surfaces already locked: a fixed set of picks and one typed free-text answer, including hear-then-type. A dotted region means "this is where your answer belongs"; it is no different in kind from an attachment slot, because it is declared by the pack and the core only hosts it. The core never needs to know what case or aspect means to host a dotted blank.

**Which surface a given card gets depends on the question, and that choice belongs to the pack/deck — never a global setting.** A dotted blank exists because the question is asked inside a sentence; a chip list exists because the answer has a known set; one typed answer exists because there is nothing to point at. The same deck can carry all four side by side, and the deck decides, card by card.

**Friction this ticket surfaced and did not resolve: a multi-blank card is multiple answers on one card.** The evidence model (T3) is one row per answer attached to one card; a cloze card with two blanks produces two judgments. The walkthrough settled them per blank as an interim, but whether a row can carry a region index — or whether a blank is its own micro-card — is a real design question for the evidence ticket, and it is logged there as an addendum, not reopened here.

## Answers given during the session

1. Should typing be part of the experience? -> Yes, everywhere answering happens, not one plain input.
2. Should editable dotted regions exist wherever the question asks? -> Yes. The dash means "edit here", declared by the pack, hosted by the core.
3. Did this create a locked-decision conflict? -> One: multi-blank cards produce several judgments on one card, which the evidence model did not anticipate. Logged as an addendum to T3.
