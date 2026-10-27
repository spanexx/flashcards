# Anything-Learning Spec

**Type:** `wayfinder:map`

## Destination

A hand-off-able spec for an anything-learning system: subject content arrives as plug-in packs over one flat card shape, A, I, generated cards are reviewed by the learner before they count, progress is recorded as evidence and read as strengths and weaknesses, and an algorithm the learner owns decides what is shown next. The app is hosted, but learner data and the provider key stay in the learner's browser; no learner data on any server; the A, I, provider is the learner's own key.

Finished means every decision on the spine is locked: pack install, card flow, one full session end to end, and progress. Onboarding polish, notifications, streaks are named but not designed.

## Notes

Domain: personal learning software, local-first in the browser. The first real subject is languages, but the destination is agnostic to any subject.

Skills every session should consult: `grill-with-docs` and `domain-modeling`. Use `say` to speak updates aloud.

**Standing preference - spoken updates:** Victor listens. Invoke the `say` skill (`speechspark-client.exe --speak --text '...'`) to narrate starts, deviations, completions, and blockers as tickets are resolved. Chat stays for code and links. Keep spoken updates to 4-8 short sentences, plain English, no jargon walls.

**Jargon rule:** plain English first, technical term second. Spell acronyms aloud with comma pauses (A, I, not A I).

**Map layout:** local-markdown tracker. This file is the map. Each ticket is a file in `tickets/` with `Type`, `Status`, and `Blocks` fields. A ticket is the frontier when every ticket it is blocked by is closed and it is unclaimed.

## Decisions so far

- [What goes on a card](tickets/card-shape.md) - two sides, each an ordered list of parts; attachments allowed; subject knowledge on the pack; cards carry plain tags, a pack-built plain-text summary, and an origin note; import is all-or-nothing and chunked; broken cards are rejected by rule, out-of-place cards are flagged by a pluggable checker and never blocked.
- [What the learner knows, and what leaves their machine](tickets/privacy-boundary.md) - only app-chosen categories leave the machine, in a prompt the learner sees first; the key lives in the OS key store; the app is fully usable with no provider; a pack may request learner text only per item, learner-selected and visible. *(Key-store detail superseded for the hosted build by [What owns the data](tickets/browser-owned-packs.md): the key lives in IndexedDB and the browser calls the provider directly.)*
- [Evidence, and reading it as strength and weakness](tickets/evidence-model.md) - one append-only row per answer, scoped to the card only; grouping computed at read time by the pack; conclusions never stored; four outcomes where lapse and gap stay distinct in the record; judgement is pluggable and configurable, the core judging nothing. *(Grouping superseded by [What owns the data](tickets/browser-owned-packs.md): a card now belongs to one stored deck, tags stay cross-cutting, and strength/weakness are still computed at read time.)*
- [The generation gate: proposed cards become the learner's cards](tickets/generation-gate.md) - proposed or yours, nothing between; rejection remembered as a shape not wording; every proposal judged individually; an edit makes a new card with no history; three app-owned prompt slots and no more.
- [One session, end to end](tickets/session-loop.md) - the learner sees the plan and reason first; no fixed length and abandonment is evidence not a verdict; wrong cards return within the same session; stopping is not an ending; algorithm failure falls back silently at once, and implausible-but-not-crashed output counts as failure.
- [Reading progress back](tickets/progress-view.md) - no scores anywhere, every named thing links to its raw evidence; the screen answers "what can I do now that I could not before"; familiarity never reads as progress; weakness is next work, never a lack; no comparison to other people; evidence can be corrected but conclusions never edited; card identity is provenance plus content so packs cannot duplicate or orphan progress.
- [Polish, end to end](tickets/polish-walkthrough.md) - the walkthrough artifact exists at [wireframe/polish-walkthrough/](../../wireframe/polish-walkthrough/index.html). Every locked decision survived Polish. Three frictions: grouping is a list per card (correction owed to T4), generation is not batch-aware (closed: identity stops exact repeats, and the prompt asks for variety), and free recall is the expensive lane (cost named, revisit later with local fine-tuning or pack-authored equivalence rules).
- [How a card is answered - the answering surface](tickets/answering-surface.md) - the core hosts pack-declared answering surfaces: dotted editable regions typed in place inside the sentence, a fixed set of picks, or one typed answer, including hear-then-type. One friction logged as an addendum to T3: a multi-blank card is several answers on one card.
- [A pack's shape, and the library-ready gate](tickets/pack-shape.md) - a pack is plain files and never running code; name plus author-written version for identity so cards survive updates; broken packs are named and refused, never blocking the app. **The library-ready gate passes**, so inside-first holds and external publishing is a later addition. *(Discovery superseded by [What owns the data](tickets/browser-owned-packs.md): packs are one JSON bundle stored in IndexedDB; plain-files-never-code and the identity rule stand.)*
- [The A, I, tutor: the session where the tutor is the model](tickets/ai-tutor-session.md) - the tutor is an algorithm choice, not a new kind of session; it teaches mid-session in texts rather than an open line, reacts to what the learner answered and never to time, and cannot nag; a hint caps a card at "Nearly" whether offered or asked for, and asking is never rationed; one standing prompt per session; its explanations become cards through the gate; its memory is the deck itself; repetition is decided by the evidence; when the provider dies it degrades to local, which means judging survives and teaching stops; hints may be written or spoken, pack-declared; no ceiling on spend; **the model writes the whole correct thing and the app derives the exercise**; **two things are judged - the answer reached and the method reached by - folded into one outcome so the row never changes**; and generated cards are machine-validated with no review button, which **withdraws the generation gate's proposal state** in that ticket.
- [How the learner opens the app](tickets/how-you-open-it.md) - a browser tab on the learner's own machine, served by a local Express process on loopback; **the OS key store survives intact**, because the page cannot reach it and never needs to - the local process holds the key and makes every provider call, so the front end provably never holds it. *(Superseded for the hosted build by [What owns the data](tickets/browser-owned-packs.md): the browser holds the key and calls the provider directly.)*
- [How the screens are arranged](tickets/ui-shell.md) - a fixed left sidebar is the only navigation; every screen is a header plus tabs or disclosures, never one long wall; compact rhythm; lists scroll in place; Study keeps the centered card, Library and Settings are tabbed, Progress opens evidence in a right-hand panel.
- [What the alphabet requires](tickets/diacritics-not-required.md) - loose judging folds diacritics (NFD marks removed, stroked letters mapped) so an answer typed on a keyboard without ą/ę/ł/ż still counts; exact judging stays strict; the accepted cost (z matches ż in loose cards) is named, and packs can use exact or list both spellings.
- [Should generation be batch-aware](tickets/batch-aware.md) - no batch memory and no second pass; exact repeats are already stopped by content identity (pack, full line, target), and one sentence in the default generation prompt asks for varied nouns, verbs and sentence shapes; near-duplicates are accepted as different cards, and the same-line-different-topic cost is named.
- [What owns the data: browser-owned packs, decks and cards](tickets/browser-owned-packs.md) - IndexedDB is the only store; the host serves files and sees nothing. pack -> deck -> card, one deck per card, decks replace topics while tags stay free labels; a deck is a container, not a session boundary. One JSON bundle (pack/decks/cards/prompts) is create, import and export; a whole pack creates, a partial file goes into a chosen pack/deck, same name plus newer version updates additively and never deletes. Key in IndexedDB, browser -> provider direct, no relay, no third-party scripts; no key still works. A full backup includes evidence and never the key; restore replaces; desktop autosaves to a picked file, phones save manually, cloud sync later. The Polish pack's topics become decks.
- [A deck you brought yourself](tickets/deck-import.md) - import is that same JSON pack bundle; a whole pack creates, decks-only joins a picked pack, cards-only joins a picked pack and deck; identity is pack + deck + content so a re-import updates in place and evidence survives; no gate, origin "Imported by the learner.", all-or-nothing with the offending item named; the tutor may teach, hint and generate in an imported deck but never edits a card in place; works with no provider.
- [The authoring skill](tickets/authoring-skill.md) - a versioned, copyable Markdown prompt, filled with the target's real pack and deck ids, that makes a whole pack, decks or cards in a browser chat and returns JSON only; pasted or loaded through the same all-or-nothing validator; lives in a "Create with a chat" panel and needs no provider.
- [Study sidebar and previous sessions](tickets/study-sidebar-and-history.md) - the plan keeps its wide column; a right-hand tabbed panel holds the tutor and hints, what to expect and why these cards; previous sessions replaces the old dropdown spot as a plain list of the last five ended sessions, and never more.
- [Hear the answer](tickets/answer-speech.md) - the answer gets a "Hear the answer" button; the device voice speaks the pack's language, numbers follow that language, and a code answer is explained by its teaching text instead of read as raw symbols.
- [Fix a refused import with the provider](tickets/import-repair.md) - a refused import keeps Try again and gains "Fix with AI", which shows the exact text first, asks the provider for corrected JSON only, and revalidates before saving; job actions become round icon-only controls.
- [Ask the tutor to summarise progress](tickets/progress-summary.md) - a Summary tab on Progress sends only counts and topic labels, shows the exact short shape first, stores nothing, and needs a fresh press each time.
- [Build a plan from many packs and decks](tickets/plan-multi-select.md) - the plan scope is a multi-select of packs and decks (a union, with all decks included); individual cards stay the algorithm's job.

*Locked during charting, before any ticket was resolved:*

- Packs are plugins; the pack boundary is a hard architectural rule.
- Cards are one flat shape; optional fields plus one general attachment slot for subject oddities.
- A, I, generation is gated: generated cards are proposals the learner accepts or edits before they are schedulable.
- Record evidence, conclude later - strength and weakness are not stored, they are derived.
- Evidence per answer: how well, how long, how many times seen before.
- Generation prompt carries weak topics, level, and learning style; packs may request extras.
- Everything local (now: in the learner's browser); no learner data on a server; A, I, is bring-your-own-key.
- The selection algorithm runs on the learner's machine and is the learner's to swap.
- Spine-and-name-the-rest: pack install, card flow, one full session, progress are specified; the rest is known-later.

## Open Tickets

Ticket files live in `tickets/`.

| # | Ticket | Type | Blocks | Status |
|---|--------|------|--------|--------|
| 1 | What goes on a card | grilling | T4, T5 | resolved |
| 2 | What the learner knows, and what leaves their machine | grilling | T5 | resolved |
| 3 | Evidence, and reading it as strength and weakness | grilling | T6 | resolved |
| 4 | A pack's shape, and the library-ready gate | grilling | T8 | resolved |
| 5 | The generation gate: proposed cards become the learner's cards | grilling | T6 | resolved |
| 6 | One session, end to end | grilling | - | resolved |
| 7 | Reading progress back | grilling | T3 | resolved |
| 8 | Polish, end to end | prototype | T4, T6, T7 | resolved |
| 9 | Should generation be batch-aware | grilling | - | resolved |
| 10 | How a card is answered - the answering surface | prototype | - | resolved |
| 11 | The A, I, tutor: the session where the tutor is the model | grilling | - | resolved |
| 12 | A deck you brought yourself: import without A, I | grilling | - | resolved |
| 13 | How the learner opens the app | grilling | - | resolved |
| 14 | How the screens are arranged | grilling | - | resolved |
| 15 | What the alphabet requires | grilling | - | resolved |
| 16 | What owns the data: browser-owned packs, decks and cards | grilling | T12 | resolved |
| 17 | The authoring skill: a copyable prompt for packs, decks and cards | grilling | - | resolved |
| 18 | Study sidebar and previous sessions | grilling | - | resolved |
| 19 | Hear the answer | grilling | - | resolved |
| 20 | Fix a refused import with the provider | grilling | - | resolved |
| 21 | Ask the tutor to summarise progress | grilling | - | resolved |
| 22 | Build a plan from many packs and decks | grilling | - | resolved |

## Not yet specified

- **Retention and forgetting** - when a card leaves the deck, and whether evidence decays. The evidence shape is locked but nothing yet consumes it; no ticket decides how long a gap stays a gap.
- **The judge seam** - judging is pluggable and configurable, but which judge a learner gets by default, and whether fine-tuning a local judge is offered in-app, are unresolved. Laya needs fine-tuning on learner card data to be sharp; the base checkpoint is general-purpose. Surfaced sharply by T8: free recall - the common case in a language pack - is the lane Laya cannot judge locally, so the interesting cards cost money by default. Sharpened by T11: **many answers can be right**, which is the normal case for a code card and not an edge case, and no string-matching or base Laya checkpoint supplies equivalence. Fixes that fit the locked design: local fine-tuning on the subject's own material, or pack-authored equivalence rules. Neither chosen.
- **Grouping is a list, and T4's wording owes the correction** - surfaced by T8. A card belongs to a *list* of topics, not one. The pack-shape ticket said grouping happens at the pack's word but never said one-topic-per-card; the walkthrough found that unsaid assumption and had to break it. Write the correction back into T4's resolution by the drift or surgical-change path.
- **Multi-blank cards produce several answers on one card** - surfaced by T10. The evidence model records one row per answer attached to one card, but a dotted-blank card carries several blanks, each judged. Whether a row can carry a region index, or a blank is its own micro-card, is an addendum to T3 that a future resolution answers.
- **Categories can still be identifying** - a prompt category is derived from learner cards, so "rare medical condition" identifies even with no learner text in it. Whether categories are generalised, coarsened, or bounded is undecided. Surfaced by T2.
- **What the checker defaults to when it abstains** - a checker that has never seen the subject may flag everything or abstain. Neither is decided. Surfaced by T1.
- **Attachment storage** - attachments exist on cards, but where the bytes live, how they are referenced, and what the pack supplies versus what the learner supplies is undecided.
- **Pack distribution beyond files** - packs travel as JSON bundles. An outside library with an index, signing and version resolution across authors is a separate question, not a blocker, and stays in the fog.
- **Fuller authoring aids** - the copyable skill (ticket 17) covers provider-less creation; a richer in-app editor beyond name/deck/card forms stays in the fog.
- **Sessions detail** - length, interruption, what is reported. The session loop itself is ticket 6.
- **Lessons and exams across decks** - a lesson may draw from several decks; how an exam or test is scoped, timed and recorded as evidence is named (learner note, 2026-10-20) but not designed.
- **Deck lifecycle** - creating a deck is inside *What owns the data*; renaming, merging and deleting decks stay in the fog.
- **Cross-device autosave** - a cloud drive or WebDAV destination so a backup follows the learner between phone and computer; deferred by *What owns the data*.
- **Error and absence handling** - what the app does when a provider is unreachable, a prompt is refused, or a pack is malformed.

## Out of scope

- Accounts and logins.
- Any server holding learner data.
- A pack marketplace or library; packs travel as files.
- A mobile app (the hosted site works in a phone browser).