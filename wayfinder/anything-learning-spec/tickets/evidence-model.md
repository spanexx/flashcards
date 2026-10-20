**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** T6

# Evidence, and reading it as strength and weakness

## Question

Lock what the system records and what it concludes.

Recorded per answer: how well, how long, how many times seen before. Conclusions (strength, weakness, per card, per topic, per skill) are derived, never stored, because the learner's algorithm will be retuned repeatedly and stored conclusions would mean rewriting history.

Decide: the exact evidence fields and their units; when evidence is written and whether it is immutable; how the learner reads their own evidence back; what the interface of the read layer looks like for a pluggable algorithm; whether evidence is scoped to card, deck, topic, tag, or some combination; and whether evidence can be corrected or discarded.

Note: whether the algorithm is code or data is a separate question â€” see the map's Not yet specified.

## Resolution

The record is one row per answer, attached only to the card it came from. A row holds facts and nothing else: the outcome, the time taken, and how many times the card had been seen before. It never claims to know about a deck or a topic.

Grouping happens at read time. When the learner`s algorithm asks "how am I doing on past tense", the pack supplies which cards are past-tense cards, the algorithm reads the evidence on those cards, and the conclusion is worked out fresh. Conclusions are never stored. Rationale: deck names and tags change, and packs get rewritten. A row that recorded "weak in past tense" would go stale the moment the topic was renamed, and nothing would ever correct it because rows are append-only. Evidence that never claims to know about a group cannot go stale. Accepted cost: grouping is recomputed on every read rather than served from a stored summary, so reads are slower and a pack that changes its grouping legitimately shifts past conclusions.

Rows are append-only and never edited. If the learner disagrees with a judgement, a second row is written recording the disagreement; the original stands. Rationale: the learner`s algorithm is retuned over months and must be able to trust the record completely. Editable rows mean the algorithm reads something that moved underneath it.

Answering and judging:

1. The card shows the question.
2. The learner answers before seeing the answer - by choosing from a fixed set where the card offers one, or by typing in their own words.
3. The answer is always shown.
4. One of four outcomes is recorded:
   - **Again** - wrong, but familiar. A lapse in something already known.
   - **Got it** - correct.
   - **Nearly** - substantially correct, a word or detail slipped.
   - **No** - wrong, and it was not previously known. A gap.

Lapse and gap are kept apart in the record itself, not merely in the label: `Again` and `No` are distinct kinds of failure because a lapse is a slip in existing knowledge and a gap is missing knowledge, and an algorithm must treat them differently. The same split governs `Got it` versus `Nearly`.

The core judges nothing. It asks who decides. Judgement is pluggable and configurable by the learner, per pack and per card:

- **Laya** - when the card offers a fixed set of answers. Local, free, roughly 33 ms. Laya picks from a supplied answer set and cannot hallucinate.
- **The provider** - when the learner typed free text, where no answer set exists and equivalence must be judged. Costs money.
- **The learner** - when they choose it, or when no judge is configured or reachable.

Nothing breaks when no judge is available. The answer still shows, the learner states the outcome, and the row is still written. Time taken and prior exposure are recorded because they are the two facts a learner cannot overstate about themselves, unlike their own judgement, which they can be generous with.

## Drift found during the session

The charting-era framing said "how well" was self-rated. That was wrong and was corrected mid-session. The core does not rate; it delegates. See the resolution above.

## Answers given during the session

1. How is an answer judged? -> Not by the learner by default and not by the core. A pluggable judge decides, chosen per pack and per card.
2. What are the outcomes? -> Again / Got it / Nearly / No, with lapse (Again) and gap (No) kept distinct in the record.
3. Can Laya judge every answer? -> Only where a fixed answer set exists. Free text needs the provider, or the learner.
4. When is evidence written, and is it editable? -> Written when the answer is judged, append-only, never edited.
5. What is evidence scoped to? -> The single card only. Grouping is computed at read time by the pack.
