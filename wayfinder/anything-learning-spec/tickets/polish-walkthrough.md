**Type:** prototype
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** T4, T6, T7

# Polish, end to end

## Question

Build one rough, concrete artifact that carries a real subject all the way through, to test whether the other decisions hold together: a learner installs a Polish pack, generates their first cards, reviews and edits the proposals, runs a session, and sees progress.

The value is not a design immediately it is the friction it exposes. Anything that requires the core to know what Polish is, or that forces a decision already claimed as locked, shows up here as a crack in the design. Link the artifact from the ticket; do not paste it in.

## Asset

- [wireframe/polish-walkthrough/](../../../wireframe/polish-walkthrough/index.html) — the walkthrough: pack → plan → gate → session → progress. Open `index.html` in the hub folder.
- [wireframe/polish-walkthrough/friction.md](../../../wireframe/polish-walkthrough/friction.md) — what Polish pressed on. This is the valuable output.

## Resolution

Polish was substituted for Spanish before building, because it is a harder test: seven cases, verb aspect, gender agreement. A design that survives Polish survives anything; Spanish would have let sloppiness hide.

**What held.** Every locked decision expressed Polish without the core learning what Polish is. The plain-text summary, two-sided card shape, append-only evidence, four outcomes, no-scores progress, pack-as-data, and three prompt slots all carried a language the core knows nothing about.

**What did not hold — three frictions:**

1. **Grouping assumed one topic per card.** A Polish noun belongs to seven case topics at once. T4's wording never said per-card topics are single, but the walkthrough's pack format had to make grouping a *list*, not a label. Correction owed to T4's resolution — route via drift/surgical-change.

2. **Generation is not batch-aware.** Polish reuses one noun across seven cases, so the generator offered the same card seven times in one batch, differing only by asked case. Nothing in the locked design stops or wants this. New question, needs its own ticket: should generation know what is already proposed in the same batch?

3. **Free recall is the expensive lane.** For Polish, the interesting cards are typed text with diacritics — exactly the lane Laya cannot judge locally. Fixed-answer sets are real but are the *narrower* kind of card. Consequence named: free recall costs by default; the learner judges when the provider is off. Worth revisiting: local fine-tuning on the subject's own material, or pack-authored equivalence rules. Both fit the locked design; neither is chosen.

## Answers given during the session

1. Is Polish an acceptable substitute for Spanish? -> Better. Harder test; exposes what Spanish would hide.
2. Was the artifact built? -> Yes — a five-page wireframe plus a friction log, linked above.
3. Did any locked decision need reopening? -> No. One unsaid assumption in T4 needs wording back; one new question (batch-aware generation) needs a ticket; one cost (free recall) was named for the first time.
