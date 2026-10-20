**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** T3

# Reading progress back

## Question

Blocked by T3 (Evidence model).

The learner needs to see what they know. Decide what progress looks like: what is shown at card, deck, topic, and whole-subject level; how a weakness is surfaced without shaming; how strengths are shown at all (the algorithm leans on showing strength to teach weakness); whether the learner's derived conclusions can be inspected or overridden; and whether progress survives across sessions or resets with a pack reinstall.

Concrete scenarios: a learner who has studied for months and feels no better; a topic that is genuinely mastered and should stop appearing; a learner who wants to see raw evidence rather than conclusions.

## Resolution

**No scores anywhere.** No percentage, no grade, no level bar, no streak. The screen shows named things, and each named thing carries a link to the raw evidence beneath it. Rationale: any number here was calculated just now from evidence that is retuned over time, so a score would be a claim with no stable meaning and would go stale silently. Evidence is append-only and therefore trustworthy; the summary is a convenience that the learner can always check rather than a verdict they must accept.

**The screen answers one question: what can I do now that I could not do before.** It shows cards, not metrics - cards the learner used to answer wrongly that they now answer correctly, and cards that used to take them a long time that now take little. Rationale: "I have studied for months and feel no better" is the motivating problem behind this whole system, and it is only answerable in terms of specific capability, not in terms of a statistic.

**Familiarity is never sold as progress.** A card counts as improved only if the learner`s early attempts were genuinely poor. A card answered correctly on its first exposure can never appear as an achievement because there is nothing to show. Rationale: with repeated exposure a learner naturally gets faster and more accurate at any card; that is familiarity, not learning, and presenting it as achievement would be a lie the learner would eventually notice.

**Weakness appears as work to do, never as a lack.** The screen says "past tense is next", never "you are bad at past tense". Rationale: a weakness is simply a topic the algorithm has plans for, and framing matters structurally as well as emotionally - a weak area framed as a lack invites avoidance, whereas a weak area framed as next work is simply the menu.

**No comparison to other people.** No percentile, no average learner, no leaderboard, no rank. Rationale: not a matter of kindness, but of truth. Every selection in this system is personalised to one learner by that learner`s own algorithm, so there is no population the learner is being averaged against. A percentile placed beside a personalised plan is a fabrication.

**The learner inspects anything and corrects evidence, but never edits a conclusion directly.** Any displayed conclusion can be opened down to the evidence behind it, and the learner can add a correction row when evidence is wrong. Conclusions themselves are computed on read and are not editable. Rationale: an editable conclusion would have to be stored, and stored conclusions are the exact thing this design deliberately avoids everywhere else. A wrong conclusion has only two causes - wrong evidence, fixed by a correction row, or a wrong reading by the learner`s algorithm, fixed by retuning the algorithm. Both fixes exist outside the screen.

**Evidence travels with the cards, not with packs.** Uninstalling a pack does not remove the learner`s cards or their evidence, and reinstalling the pack does not restore or reset anything. Deleting cards deletes their evidence, and that is a deliberate learner act. Rationale: evidence is attached to cards, and cards belong to the learner, not to the pack that suggested them.

**A learner-owned card is identified by where it came from and what it says.** Reinstalling the same pack does not duplicate its cards, and updating a pack does not orphan them. Rationale, with the failure mode named: packs ship cards, so installing a pack twice - or installing v1 then v2 - could otherwise produce the same card twice, each with its own evidence history. The algorithm would then see one card the learner is strong at and one they are weak at, with no way to know they are the same card. This is the pack-identity principle (T4) applied one level down: identity is provenance plus content, not content alone, so updates do not orphan, and not provenance alone, so duplicates cannot accumulate.

## Answers given during the session

1. Does anything get a number? -> No. Named things, each linked to its raw evidence.
2. What does a learner who feels they have not improved see? -> The specific cards they can now handle and could not before.
3. How is familiarity prevented from reading as progress? -> A card counts as improved only if early attempts were genuinely poor.
4. How is weakness framed? -> As next work, never as a lack.
5. Are learners compared to each other? -> No. There is no population to average against a personalised plan.
6. Can conclusions be inspected or overridden? -> Inspected freely. Evidence can be corrected with a new row. Conclusions are never edited directly.
7. Does progress survive a pack reinstall? -> It cannot be affected by one. Evidence belongs to cards, and cards belong to the learner.
8. Can the same card arrive twice from a pack? -> No. Identity is provenance plus content.
