**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# One session, end to end

## Question

Specify one full session from start to finish: the learner opens the app, gets cards chosen for them, answers, and reaches the end.

Decide: how the session is opened and what it says about why these cards; how cards are chosen (this is where the learner's algorithm runs â€” its input, its output, and what happens if the algorithm cannot choose); whether a session has a fixed length or ends when the material runs out; how a card is presented and answered, including free-text versus self-rating; what an incorrect answer does; what happens when interrupted; how the session ends and what it reports; and how the learner sees progress after.

## Resolution

**The plan is shown before the session starts.** The learner algorithm is given the evidence and returns an ordered list. The app never receives or stores a reason, but the learner sees the plan and the reason in plain words before beginning - for example, "twenty cards, sixteen from past tense because you have been getting them wrong, four from vocabulary because you are strong there and they check you are still strong". Rationale: the algorithm was written to suit this learner; without seeing what it chose and why, the learner cannot tell whether it is learning their pattern or inventing one. A silent decider of what to study is exactly what this project exists to avoid. Accepted cost: reasons are sometimes ugly, including "no idea, these came first", and the learner sees that.

**There is no fixed session length.** The app offers a number - twenty cards as a default offer - as an offer and not a rule. The learner may stop at any point. Rationale: a fixed length is a decision made for a person the app knows nothing about; some days have two minutes and some have an hour. A number set once and never revisited would be exactly the stale stored conclusion banned elsewhere in this design.

**Abandonment is evidence, never a verdict.** If the learner repeatedly stops early, the app records that as a fact and adjusts the offer accordingly - fifteen good cards rather than twenty with five wasted. It does not nag, does not display a streak, does not show guilt, does not withhold weak cards as leverage. Rationale: the app already treats slowness on a card as a fact rather than a failing; abandonment is the same kind of fact. Accepted weakness, named honestly: the app can distinguish a learner who consistently stops from one who does not, and that knowledge could be misused to shape the offer towards avoidance. That possibility is the reason the rule is stated as data-with-no-verdict.

**A card answered wrongly returns at the end of the same session, once.** Not in three days, not at the algorithm`s spaced position. Rationale: this is a learning session, not a memory test. A learner who got it wrong and never saw the right answer while still holding the question in their head has lost the moment where the learning would have occurred, and the moment is discarded for the sake of a tidier schedule. Accepted cost: a session of twenty becomes longer than twenty; if the learner stops before the end, those cards return next time.

**Stopping is not an ending.** No summary screen, no report, no sign-off, nothing evaluative. The learner closes the app and the next session plans afresh from the evidence that exists, including the fact of stopping. Rationale: a report makes stopping something that gets judged, which contradicts the no-verdict rule. Worse, report-driven stopping teaches the system that certain days end early, and it will quietly stop placing weak cards on those days - shielding the learner from the exact material they most need.

**Algorithm failure falls back silently and immediately.** The algorithm is tried once. On failure the app falls back at once to the simplest available selection - unseen cards first, then oldest, then previously answered wrongly. It does not retry in a loop. Rationale: waiting through retries is the app prioritising the learner`s algorithm over the learner`s learning, and on a bad morning that is the worst possible moment to make someone wait. The card is better than the message. A card is the only job this app has.

**Silent fallback is invisible in the moment and visible on reflection.** Failures are counted, and a quiet line in settings names which algorithm ran. Not an error, not a warning - just the name, so a learner who looks one day can notice the fallback has been running since March. Accepted cost: if nobody looks, a broken algorithm can silently govern study for months.

**The app sanity-checks what came back.** Beyond crashing, a returned session is checked for plausibility - enough cards, enough unseen cards, enough variety. If it does not look like a real session it counts as a failure and the fallback takes over, even though nothing crashed. Rationale: a non-crashing failure is far more dangerous than a crash. An algorithm returning the same three cards daily for a year produces no error and no log, and the learner studies three cards for a year unable to see why they are not improving. Accepted cost: the app is second-guessing a learner-owned algorithm and can wrongly judge good output as poor, silently overriding the learner. This is deliberately accepted: a false-positive fallback costs one unremarkable session, while an undetected degenerate algorithm costs a year of study.

## Answers given during the session

1. Does the learner see the plan and reason before starting? -> Yes, in plain words. The app stores no reason.
2. Is there a fixed session length? -> No. Twenty is an offer.
3. Does the app react to the learner being lazy? -> It records it as evidence and adjusts the offer. No nag, no streak, no guilt, no leverage.
4. What happens to a card answered wrongly? -> It returns at the end of the same session, once.
5. What happens when the learner stops mid-session? -> Nothing. No report. Stopping is recorded as evidence and the next session plans afresh.
6. What happens when the algorithm cannot choose? -> Try once, then fall back immediately and silently: unseen, then oldest, then previously wrong.
7. Is there a retry mechanism? -> Not a loop. Fallback is immediate; a failure counter and a quiet receipt in settings make it visible later.
8. Does the app check the quality of the algorithm output? -> Yes. Implausible output counts as failure and falls back, without requiring a crash.
