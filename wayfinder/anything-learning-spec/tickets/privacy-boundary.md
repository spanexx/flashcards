**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** T5

# What the learner knows, and what leaves their machine

## Question

Lock the privacy boundary. Everything is local and the A, I, is bring-your-own-key â€” but the provider still receives the generated prompt, and a prompt that names "past tense verbs" is the learner's data leaving the machine.

Decide: exactly what a prompt contains and what it must never contain; whether the learner can see the prompt before it is sent; whether any card content or evidence is ever transmitted; how the key is stored and revoked; what happens when the provider call fails or the key is missing; and whether a pack can request prompt fields that carry learner-originated text.

Concrete scenarios: a learner whose weak topic is a stigmatised medical condition; a pack that wants to include the learner's own example sentences in a prompt; a learner on a shared machine; a provider that logs prompts.

## Resolution

Nothing about the learner is transmitted anywhere except to the learner`s own provider, and only in a prompt. Card content, evidence, conclusions, the algorithm, and all decks live on the learner`s machine and never leave it. There is no server operated by the project, so there is nothing for learner data to reach.

A prompt contains only app-chosen categories about the learner - weak topics, level, learning style - and never anything the learner wrote. Not the learner`s sentences, not their cards, not how they failed on them. The distinction is deliberate: learner-written text reads as the learner; a category reads as a label.

The learner sees the exact prompt before it is sent, with a copy action beside the send, and the app keeps a local log of what was sent and when. The visible prompt is also the point where a local check can scan outbound text.

The provider key is stored in the operating system key store (Credential Manager / Keychain / Secret Service), not a plain file. It is encrypted, scoped to the learner`s OS account, and does not wander into backups or synced folders. Accepted cost: a new machine needs the key re-entered.

Generation and checking are strictly optional. The app is fully usable with no provider at all: studying, writing cards by hand, and importing cards by paste all work offline. A failed, expired, missing, or unreachable provider is reported in plain words, never retried silently forever, and never blocks work in progress. A missing key is never a startup blocker.

Packs may request learner-originated text but can never include it unilaterally. Inclusion is per item, deliberate, and visible: the learner selects the item, sees exactly what will be sent, and confirms that one item. Install-time blanket consent is forbidden - consent granted once is consent forever and is not read. Rationale: this is the only route by which the learner`s own writing could leave the machine without the learner choosing to send it.

## Unresolved, carried to the fog

Categories are themselves derived from learner evidence, which comes from learner cards, so a category can be identifying on its own. A learner studying a rare medical condition puts "rare medical condition" into a prompt even with no learner text in it. Whether categories are generalised, coarsened, or bounded is not decided here.

## Answers given during the session

1. What goes in the prompt? -> App-chosen categories only; never learner-written text.
2. Can the learner see the prompt before it is sent? -> Yes, always, with a copy action and a local log of what was sent and when.
3. Where does the provider key live? -> The operating system key store, not a plain file.
4. What happens when the provider fails, the key is missing, or the machine is offline? -> Generation and checking are optional; the app is fully usable offline; failures explain themselves and block nothing.
5. Can a pack put learner-written text in a prompt? -> Only per item, learner-selected and visible. Never by pack-installed consent.
