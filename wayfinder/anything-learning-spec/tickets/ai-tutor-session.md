**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# The A, I, tutor: the session where the tutor is the model

## Question

Victor proposes a fully A, I,-powered session: the model acts as the tutor, decides what the next deck is, generates cards depending on how the learner is doing, and makes the whole session very interactive. The first real subject is languages, so this lane matters. He is explicit that the reordering of existing cards need not be the model's job; the generation is the part he wants powered.

Decide: what the tutor is allowed to do that the ordinary algorithm does not; whether "decides the next deck" is one call at session start, a rolling call during the session, or generation on demand when a deck runs dry; how the tutor's requests obey the privacy boundary and the generation gate; what happens when the provider is unreachable mid-session; whether the tutor is a named toggle the learner can switch off and still have a session; and whether the tutor ever speaks outside the card surface, for example a short line of encouragement or a spoken correction, or whether the only words it contributes are the cards themselves.

Constraints already locked and inherited, not re-litigated here: selection is the learner's own pluggable algorithm, so a tutor is one algorithm option rather than a new kind of session; generation goes through the generation gate, so tutor-generated cards are proposals before they count; only app-chosen categories leave the machine and the prompt is visible first; the app is fully usable with no provider; algorithm failure falls back silently at once and implausible output counts as failure.

## Resolution (in progress)

**1. The tutor teaches mid-session, not only picks and generates.** The tutor may interrupt the card flow: a hint before the learner answers, a correction after, a line of encouragement. It is a tutor, not a scheduler, and the session is meant to be very interactive - languages first, where this lane is the point. It speaks on its own initiative rather than only when asked.

**2. A hint costs the point: a helped card cannot be recorded as "Got it".** The strongest cap available is "Nearly" - substantially correct, a detail slipped - because a hint means the answer was not produced unaided, and "Got it" means correct. Lapsed and gap outcomes stay as they are, since a hint does not change whether the learner knew the material.

Rationale for accepting the cost the ticket creator named against it, that it teaches the learner to refuse help: this is the only option of the three that leaves the evidence row **exactly as locked**. No hint field, no amendment to the evidence model, and the row's promise - how well, how long, times seen before, nothing else - survives intact. The learner is not lied to and is not lied *for*. The downside is real and accepted: a learner may learn to work without help, which is a worse teacher than one that admits when a card was too hard.

**3. A requested hint is capped exactly like an offered one.** The learner asking the tutor for help does not exempt them: a helped card cannot be recorded as "Got it", whether the tutor chose to help or the learner did. The learner was given the answer in both cases, so the row says the same thing in both cases.

This does not make asking a trap, and the reason is the shape of the cap. A hint converts a possible "Again" or "No" into a guaranteed "Nearly" - substantially correct, a detail slipped. Asking is therefore a rational trade the learner makes knowingly, not a penalty for asking. Offering the same help before the learner asks saves the same point at the same cap, which is why the tutor is free to do both without any asymmetry in the record.

Also locked with it: **asking is never rationed and never withheld to save money.** The tutor may be asked for a hint on any card, and the cost of that call falls on the provider, not on the learner's access to help. A system that made help harder to get because it was expensive would be the exact opposite of a tutor.

**4. The tutor chooses for itself when to speak.** It is not restricted to triggering on evidence of struggle. It may interrupt on its own judgement the way a human tutor does - before, during, or after a card - and the learner's response is the only brake. The evidence-reactive alternative was rejected as too much like the algorithm: it would make the tutor a second algorithm rather than a teacher.

Accepted costs, named rather than hidden: **cost becomes unpredictable**, because calls happen at the tutor's discretion rather than at a countable rate, and the tutor can talk more than a learner wants. **Interruptions can arrive at moments the algorithm would have kept quiet**, including after a correct answer, which the evidence model already accommodates because the outcome is recorded on the card, not on the tutor's commentary.

**5. One standing prompt per session, not one per interruption.** Before the session begins the learner sees the full shape of every prompt the tutor will send while that session runs - the standing request, the weak topics, the level, the learning style, the card text already decided to be shown, and the shape of the tutor's own instructions - and approves it once. Every interruption the tutor makes afterwards rides on that banner. Per-interruption prompts were rejected because a tutor that interrupts freely would then interrupt the learner with permission dialogs, and the interactivity would die on arrival.

This resolves the tension with the privacy boundary without weakening it: the boundary promises the learner **sees the prompt before it leaves the machine**, and a session banner is still the learner seeing the prompt before it leaves, just amortised across the interruptions of one sitting rather than repeated per call. The banner is per session and does not persist; each new session asks again.

Also locked with it: the tutor's speech never widens what leaves the machine. Anything the tutor says back that was not already inside the approved banner is refused rather than sent, exactly as a pack asking for unsanctioned learner text is refused. A tutor that tried to widen its own reach would be treated as a pack overreach, not as a tutor being helpful.

**6. The tutor's explanations become cards, reviewed like any generated card.** When the tutor teaches - a correction, a clarification, a rule the learner did not have - the teaching is not chatter that evaporates and not a note bolted onto an existing card. It becomes a **card**, proposed through the generation gate exactly as any other generated card is. The learner accepts it, edits it, or rejects it, and only an accepted card enters the deck.

Inherited, not optional, and recorded here because this decision leans on all of them:

- **The generation gate does not bend.** Proposed or yours, nothing between; every proposal judged individually; an edit makes a new card with zero history; rejection is remembered as a shape and never as wording. A tutor explanation gets no special treatment because it is good.
- **This is the batch-aware problem in its sharpest form** and collides head-on with the open ticket **Should generation be batch-aware**. A tutor that teaches freely now produces a queue of proposals, and the gate locked to reviews one at a time will interrupt the session the tutor was meant to make interactive. That ticket should be resolved as part of this one or before it.
- **A tutor card is a free-recall card**, which is the expensive lane: no fixed answer set exists, so the provider judges it or the learner does. The tutor's teaching raises the cost of learning rather than lowering it, and this is accepted rather than pretended away.
- **The tutor is a fourth prompt shape.** The generation gate locked three app-owned prompt slots and no more - request, questions, deck. Tutor instructions are not any of those three. This is an open amendment to that locked decision, not a quiet exception, and it must be written into the generation gate's own resolution rather than living only here.
- **A tutor card must not inflate progress.** The progress view answers what the learner can do now that they could not before, and reads only card-scoped evidence. Tutor cards are study material; if they began showing as progress, the read would be flattering itself.

**7. The tutor does not repeat itself, and it needs no memory of its own to do it.** The tutor is told what it has already proposed and it will not propose the same teaching twice.

Crucially, **this adds no new stored state.** The tutor's memory *is* the card set plus the generation history, both of which already exist: cards carry provenance and content, so "have I explained this before" is a question answerable by reading what is already on disk, and the generation gate already remembers every rejection as a shape. That list is handed to the tutor in its prompt rather than kept in a tutor-shaped store of its own.

This matters because it keeps a promise the evidence model made. Storing what the tutor has said would be storing a conclusion, and conclusions are derived at read time and never stored. What the tutor has said is not a conclusion about the learner - it is a fact about the deck - and it is recoverable from what the deck already holds. A tutor memory file would have been a conclusion wearing a disguise.

**8. "No repeats" governs proposals, not teaching; the evidence decides repetition.** The tutor will not re-propose a card the learner already has, but it may teach a point again when the learner's own evidence says the point was lost. Absolute non-repetition and time-limited memory were both rejected: the first refuses to re-teach what the learner demonstrably forgot, the second invents a clock rule where a better rule already exists in the evidence.

This reads the four locked outcomes directly, which is the strongest argument for it:

- **"Again"** - wrong but familiar, a lapse - is precisely the case where teaching it again is repair, not repetition.
- **"No"** - wrong and not previously known, a gap - is not a repeat at all. It is a first teaching of something the learner has never had, so the non-repetition rule does not touch it.

So the tutor needs no memory of whether it personally taught before, and no lapse bookkeeping of its own. The read side already answers the question, from evidence the learner can see and correct.

**9. When the provider dies mid-session the tutor degrades to local rather than vanishing.** The session never stalls and never stops to ask. What survives is whatever can be done offline on the learner's own machine, and the tutor goes quiet only in the part that genuinely cannot be done.

**The honest scope of that fallback, recorded because it is smaller than it sounds:** Laya is a typed decision engine that picks from a supplied answer set. It does not generate text, so it cannot produce a hint, a correction, or a teaching line - there is nothing for it to say. What it can carry is **judgement where a fixed answer set exists**. So a free-recall card still falls back to the learner calling it, exactly as the evidence model locked, and the tutor's teaching stops while the session continues. Silence is not a bug; it is the absence of a provider.

This sharpens the judge's seam rather than solving it: offline, the interesting cards are still the ones no local judge can check.

**Noted as a possible floor, not decided:** a pack may ship pre-written hints, which are local, free, and always available. That would give the tutor a local voice when the provider is gone. Whether packs may carry hints is a pack-shape question and belongs to **A pack's shape, and the library-ready gate**, not to this ticket.

**10. Both, and the card chooses - the pack declares the channel, the tutor fills in the words.** A hint or correction may be written or spoken, and the pack declares which, exactly as the answering surface is pack-declared and the core merely hosts. The tutor supplies the words either way.

**This solves accessibility for free, and the reason is worth stating:** the tutor writes the words and the voice merely reads them. The text always exists, because it is what the voice is reading. Nothing the tutor says exists only as sound, so a spoken hint is never a barrier to a learner who cannot hear it, and a written hint is always re-readable later.

Two consequences accepted with it: the voice is a local, free, offline capability while the words are a provider call, so a spoken hint needs the provider for the words but not for the voice; and the tutor's words still become cards, so a spoken correction produces a card with the same gate review as a written one.

**11. The tutor talks in texts, not in an open line.** Every exchange is a message out and a message back. There is no held-open connection of any kind - no socket, no call waiting on the other end, nothing alive while the learner thinks.

Three things follow, and all three were stated as the point of the decision:

- **The tutor reacts to what the learner answered, never to time.** It does not watch the clock during silence and has nothing to say during it.
- **Time taken is recorded locally and sent later, in its own batch**, after the learner has answered. It is never part of the live reply, so a slow answer is never seen by the model as hesitation in the moment.
- **The tutor cannot nag.** With no line held open there is no channel on which it could say "why are you not answering". Silence belongs to the learner. This is a flashcard, not a proctor.

This also keeps the privacy boundary honest in a way an open connection would not: while the learner is thinking, nothing is pending on a provider and nothing is being measured off-machine.

**12. Generated decks are machine-validated and accepted, not reviewed by hand.** The learner rejected a review button for generated cards as well as imports. The system checks that the output is well-formed and that blanks are placed in sane positions, and then the cards are cards. There is no proposal state, no per-card judgement, and no accept button.

**This reverses a locked decision and must be recorded as an amendment, not smuggled in.** The generation gate locked: proposed or yours, nothing between; every proposal judged individually; rejection remembered as a shape; an edit makes a new card with zero history.

What dies: the proposal state, per-card human judgement, and the accept step.
What survives: an edit still makes a new card with zero history; the origin note still names the generation request on every generated card; the three app-owned prompt slots still stand, with the tutor's prompt already logged above as a fourth shape needing its own amendment.

**The reason the reversal is survivable, and the thing that replaces the gate:** the evidence model becomes the detector. A card that is false cannot hide, because every time it is shown it produces bad evidence, and a card that is missed over and over while its topic neighbours are fine looks exactly like a card that is wrong. The gate was a door; this is a floor. The safety net is the record the learner already keeps.

**13. The model writes the whole correct thing; the app makes the exercise out of it.** This is the decision that answers the blank-placement problem at the root, and it came from the ticket creator, not from the questions.

A generated card does not arrive with blanks in it. It arrives as **the full, correct line** - the complete Polish sentence, the complete working function - and the application then blanks out pieces for the learner to attempt. The model is never asked to place a blank correctly, because the model never places blanks. It writes truth; the app derives the exercise.

Three things this buys:

- **The truth lives in exactly one place per card.** Every blank is a view of the same full line, so a card cannot disagree with itself, and a mistake in the content is visible in one spot rather than scattered across gaps.
- **The full line is always available.** The learner can see the complete thing the card was made from, which is a far better check than any dialog: something wrong is wrong in a way you can see.
- **Blank placement stops being a guessing problem.** The earlier worry that a system would misplace a blank by guessing mostly dissolves, because there is no guessing - there is a full line and a rule for hiding part of it.

**14. More than one answer can be right, and this is a real gap in the judge.** For a programming card, "so many ways to arrive at the answer" is the normal case, not an edge case. A judge that string-matches one expected answer will mark correct work wrong. This belongs to the judge's seam - equivalence rules authored by the pack, or a provider judge that reasons about equivalence - and is recorded here as a consequence rather than solved here. The multiple-answer problem is named, not answered.

**15. Reaffirmed, already locked in the evidence model:** with a provider available, the A, I, judges the learner's answer rather than the learner calling it themselves. The tutor decision adds no new judging path; it is the existing pluggable judge being used.

**16. Where the truth comes from depends on the subject, and the pack is the source of truth where it can be - but not exclusively.** The ticket creator rejected the framing that forced one answer for everything. Some decks can inherit their truth entirely from the pack, because a pack may carry material that is simply correct - a Polish grammar table, a set of working functions. Other subjects reach past what any pack contains.

**17. Two things are judged, not one: the answer reached, and how it was reached.** An open-ended question can be arrived at many ways. The judge is asked about the answer the learner landed on, and separately about the route taken. This is the sharpest thing in the ticket and it does not fit the locked evidence model as stated, so how it fits is recorded below.

**How the method judgement fits without breaking the evidence model:** the method is judged **at answer time and folded into the single outcome the row already carries**. A correct answer reached by faulty reasoning is "Nearly" - right, a detail slipped - which is exactly what "Nearly" means. A correct answer reached by sound reasoning is "Got it". Nothing is added to the row: how well the learner did now *includes* how they did it, and the four locked outcomes still carry it. Storing the method separately would have meant storing a conclusion about the learner's reasoning, which the evidence model forbids, so it is judged into the outcome and not kept.

**What this forces, named rather than discovered later:** judging the method requires the learner to **show it**, so cards need a place to show working beside the place to give the answer. That is a second kind of editable region alongside the dotted blank, pack-declared like every other surface. And every free-recall card now needs a provider for **two** judgements instead of one, so the expensive lane doubles in breadth. That cost is accepted here, not quietly carried.

**18. The learner's shown working is shown back to them, beside the correct one.** Not folded silently into a score, not discarded: the learner sees their own route next to the working route, so they can see *where* it went wrong. For a language this is the valuable part - knowing you said "nie jem chleba" is much less useful than seeing it sitting beside "nie jem chleba" with the ending explained.

**19. And the algorithm adapts to it.** The learner added this, and it is the half that makes the feedback structural rather than decorative. The adaptation runs entirely through the locked evidence model, which is why it costs nothing new: the method was judged into the single outcome at decision 17, the outcome is the row, and the algorithm reads the row. So the algorithm adapts **to the outcome the method produced**, never to the reasoning text itself.

**What this means in practice, and it is worth stating plainly:** the learner's shown working is displayed during the answer and then **discarded - never stored**. A card where the learner always lands on the right answer by a bad route sits at "Nearly" for good, and the algorithm therefore keeps it in rotation, because on the evidence it is a card not yet properly learned. Sloppiness becomes visible as persistent weakness, which is exactly what weakness should mean in this system. The text of the reasoning is not kept; the consequence of it is.

This also keeps the evidence model's promise intact under pressure: no conclusion about the learner's reasoning is stored anywhere. The adaptation is a read-time conclusion, derived fresh from a row, exactly as the model requires.

**20. No ceiling on what the tutor may spend.** Every call is a call, the price is named, and the learner pays it. A per-session cap and a per-call price display were both considered and rejected: a cap turns the tutor into something that must be rationed, and a budget the tutor can exhaust mid-session is the tutor going silent for reasons the learner chose earlier rather than reasons that happened.

Accepted with it: **the tutor's cost is unbounded by design, and the shape of the tutor makes it larger than it first appears** - it may speak unprompted, it generates full lines, and each free-recall card costs a provider call for the answer plus another for the method. The learner's protection is visibility and consent, not a limit: the standing session banner names every prompt, the key is the learner's own, and nothing is ever sent that the learner has not approved for that session.

## Resolution

The tutor is an **algorithm choice**, not a new kind of session, which is why it fits the system at all: selection was always the learner's own swappable thing, so "the tutor decides the deck" is one implementation of an existing seam rather than a new authority in the app. It teaches mid-session - before, during, after - through words it writes and an optional voice that reads them. It talks in texts, never in an open line, reacts to what the learner answered rather than to time, and cannot nag because no channel exists on which to nag. When the provider dies it degrades to local, which in practice means judging survives and teaching stops, since Laya generates no text.

Three of its decisions were reversals of earlier locked decisions, recorded here and carried into the tickets that own them: **decision 12** withdraws the generation gate's proposal state and per-card human judgement, **decision 12 with the tutor's prompt** makes a fourth app prompt shape beyond the three the gate locked, and **decision 17** folds a judged method into the single outcome rather than storing it. The evidence model itself was not amended — every one of those fits the row exactly as locked, which was the point of choosing them.

The deepest result is decision 13: **the model writes the whole correct thing and the application derives the exercise.** The model never places a blank. That single move dissolved the blank-placement worry, made the truth readable on every card, and turned card generation from "ask a model to build an exercise" into "ask a model for truth, then take it apart".

**Still owed to other tickets and not solved here:** equivalence for many-valid answers (the judge's seam); whether packs may ship pre-written hints as a free offline floor (pack shape); and **Should generation be batch-aware**, which decision 12 largely dissolves and which should be revisited rather than grilled.

## Interaction with existing tickets

- Touches **Should generation be batch-aware** - decision 12 largely dissolves it. That ticket asked how bulk generation should be reviewed without drowning the learner in review; the answer is now that the review does not happen, and a batch of forty is simply forty cards. That ticket should be revisited and most likely closed rather than grilled.
- **Requires an amendment to The generation gate**, which is written there, not here: the proposal state, per-card judgement, and the accept step are withdrawn by decision 12 above.
- **Requires a fourth prompt shape in that same amendment** - the tutor's prompt is not one of the three app-owned slots.
- Named as a consequence, not solved here: **The judge seam** - multiple valid answers to a code card need equivalence, which neither string-matching nor a base Laya checkpoint supplies.
- Constrained by **What the learner knows, and what leaves their machine** and **One session, end to end**.