**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline (browser build)
**Blocks:** -
**Blocked by:** - (unblocked by [What owns the data](browser-owned-packs.md), resolved 2026-10-20)

# A deck you brought yourself: import without A, I

## Question

Victor proposes that learners can bring their own decks without using A, I, at all: import a J, S, O, N, file, or paste J, S, O, N, text into the app, and it becomes a deck. He is explicit that this also serves people who do not want to use A, I, at any point - the whole app must be worth using with every generation feature switched off.

Decide: what an imported artefact is - a full pack, or a deck of cards belonging to a pack that is already installed; whether import is one format or several, and whether a plain-text or delimited format exists alongside J, S, O, N, so that someone can paste from anywhere; what identity an imported deck carries, given that card identity is provenance plus content; whether imported cards skip the generation gate, since a human wrote them, and what happens when the importing human did not write them; what the origin note on an imported card says; whether import runs the pluggable checker, in warning mode, and whether a broken import is refused with the offending line named, the way a broken pack is; and how an imported deck sits next to generated cards when the tutor is on - can a tutor improve a deck the learner brought, or only generate new ones.

Constraints already locked and inherited, not re-litigated here: packs are plain files and never running code; import is all-or-nothing and chunked; broken cards are rejected by rule, out-of-place cards are flagged by a pluggable checker and never blocked; card identity is provenance plus content so progress cannot be orphaned; the app is fully usable with no provider.

## Interaction with existing tickets

- Sharpens the map's fog item **How a learner authors a pack** - this ticket is the one inlet into that fog, and does not settle the rest of it.
- Constrained by **What goes on a card** and **A pack's shape, and the library-ready gate**.
- Reshaped by [What owns the data](browser-owned-packs.md): the flat single-deck
  import becomes the pack/deck bundle.

## Resolution

1. **One format.** Import is the same JSON bundle locked in *What owns the data*:
   a pack, its decks, its cards, optional prompts. A file or pasted JSON text.
   There is no second, delimited or plain-text format.
2. **Three targets.** A whole pack creates a new pack. A decks-only file goes
   into a pack the learner picks, creating the decks it names. A cards-only file
   goes into a pack and deck the learner picks.
3. **Identity.** A card's identity is pack name plus deck id plus content. A
   re-import of the same card updates it in place and its evidence survives; the
   same content in a different deck is a different card. Deck ids are stable
   across versions. Import never deletes, moves or renames a card; those are
   separate learner actions.
4. **No gate.** Imported cards are the learner's cards and are schedulable on
   arrival. There is no proposal state (T11 withdrew it), so there is no review
   button and no edit history to create.
5. **Origin.** An imported card says "Imported by the learner." in its origin
   note. The importer is the human, never the model.
6. **Validation.** All-or-nothing. A broken import is refused with the offending
   item named by index and field, the way a broken pack is. The pluggable
   checker may flag out-of-place cards as warnings and never blocks.
7. **The tutor.** An imported deck is the learner's deck: the tutor may teach,
   hint and generate new cards into it, but it never edits an imported card in
   place; an edit makes a new card. The pack's own prompts govern the tutor.
8. **No provider needed.** Import, study and the learner's own judgement work
   with every generation feature off.

## Why

Import is the lane for people who never want A, I, at any point, and for decks
carried from elsewhere. Using the same bundle as create and export means one
shape, one validator, one set of errors, and no drift between the three.

**Source:** learner conversation, 2026-10-20.