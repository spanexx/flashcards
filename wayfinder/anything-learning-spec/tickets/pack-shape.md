**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** T8

# A pack's shape, and the library-ready gate

## Question

A pack is a pluggable unit of subject knowledge. Lock what a pack contains, how it plugs in, and â€” critically â€” whether the in-app format is genuinely library-ready.

Gate: the pack format must be usable in an outside library without reshaping. If it cannot be, the inside-first decision reverses and the effort restarts from an outside library. Say plainly whether the format passes this gate.

Decide: pack contents (card sources, A, I, prompts, rules, metadata, identity); how the core discovers and loads a pack; what the core is permitted to know about a pack versus what only the pack knows; pack identity and versioning; how a pack declares its dependencies on the core; what happens when a pack is malformed or a core version breaks it; and how a learner installs, removes, and updates a pack.

## Resolution

A pack is a folder of plain files, never running code.

Contents:
- **Manifest** - name and version, written by the pack author.
- **Cards** - the pack`s own starter cards, if it ships any.
- **Prompts** - what it asks the provider, in prompt-shaped data.
- **Grouping rules** - how it groups cards into topics. The pack owns grouping; the core never guesses.
- **Plain-text builder** - how a card becomes the readable summary a judge and a checker can read.
- **Declared questions** - anything the pack needs to ask of the provider or a judge, declared as questions. No logic, no scripts.

Packs may not execute code. Rationale: a running-code pack can damage the learner`s whole history, and packs cannot be hand-reviewed by the learner. A pack that needs cleverness declares a question; the core asks it on the pack`s behalf. Declared questions are reviewable because they are questions, not logic.

Discovery: the core looks in one known folder on the learner`s machine at startup, treating it like a library into which albums are dropped. There is no server and nothing to browse.

Identity is the pack name. A version number moves forward as the author updates it. Content fingerprints, hashes, and generated ids are explicitly not used. Rationale: if identity changed when files changed, updating a pack would make every card it created look orphaned. This is deliberately the opposite of normal software identity, and it exists so the learner`s cards survive pack updates.

A pack declares the range of core versions it needs. If the installed core does not satisfy that range, the pack is refused before it can act - not half-loaded and then stopped.

A broken pack never touches learner data and never prevents the app from opening. The app names the broken pack, states plainly what is wrong with it, and continues with everything else. Nothing is deleted, nothing is migrated, nothing is half applied. A pack broken at one in the morning must not produce an app that will not start.

## The library-ready gate: PASSES

The condition set during charting was that the in-app pack format must be usable in an outside library without reshaping, or the inside-first decision reverses. It passes.

The format is plain files, self-contained, readable by hand in any text editor, with no absolute paths anywhere. A pack folder can be copied out of the app, placed in any library on any machine, and still work unreshaped. Inside-first stands, and publishing externally is a later addition rather than a redesign.

Consequence accepted: there is no signature and no way to distinguish an authentic pack from an edited one. That is the price of packs being readable, copyable, and code-free, and it means a pack from a stranger is trusted. Acceptable while sharing is out of scope; it must be revisited if sharing ever comes into scope.

## Answers given during the session

1. What is inside a pack? -> Data only. Manifest, cards, prompts, grouping rules, plain-text builder, declared questions. No running code.
2. How does the core find packs? -> One known folder on the learner`s machine, scanned at startup.
3. Does the format pass the library-ready gate? -> Yes. Plain self-contained files, readable by hand, no absolute paths, copyable unreshaped.
4. What is a pack`s identity? -> Its name plus an author-written version. Contents are not part of identity, so cards survive updates.
5. What happens when a pack is broken or too new? -> It is named with its error, refused before acting, and never blocks the app or touches data.
