# PRD-TRD: Library Create flow

**Slug:** library-create-flow
**Status:** Approved (pre-implementation simulation approved, 2026-10-21)
**Date:** 2026-10-21

## Why This Exists

Library creation is split by method. A learner who wants a deck has to know
whether that means New pack, Import, Generate, or Create with a chat before they
can start. The same target is offered in several places with different rules,
and Generate only works for cards in an existing deck, so packs and decks have
no generated path at all.

This feature puts the object first. The learner chooses Pack, Deck, or Cards,
then chooses Write, Generate, Chat, or Import. Every path uses the one bundle
validator, so a half-created pack or a mismatched import cannot slip through.
Packs becomes a browse surface, Cards becomes a management surface, and Create
is the only place that makes new content.

The gap is visible in daily use: packs cannot be deleted, decks cannot be
deleted, and generated packs cannot exist. The learner has to leave the app,
edit files, or live with stale containers. Deletion and generation close that
gap without changing the pack -> deck -> card hierarchy or the study loop.

## Behavioral Spec

### Scenario 1: Library has three jobs

**Given** a library with packs and cards
**When** the learner opens Library
**Then** the tabs are Packs, Cards, and Create only; Packs has no create forms,
Cards has no create forms, and Create is the only place that makes a pack, deck,
or card.

### Scenario 2: Target first, method second

**Given** the Create tab
**When** the learner chooses Pack, Deck, or Cards
**Then** the methods shown are Write, Generate, Chat, and Import; choosing a
different target changes the form but never silently changes the target.

### Scenario 3: Write a pack

**Given** Create -> Pack -> Write
**When** the learner enters a pack name, a version (default 1.0.0), and a first
deck name
**Then** a pack with one deck is saved, the deck may have zero cards, a
duplicate learner-written pack name is refused, and Packs opens with the new
pack expanded.

### Scenario 4: Write a deck or a card

**Given** Create -> Deck -> Write
**When** the learner chooses a parent pack and enters a deck name
**Then** an empty deck is added to that pack and Packs opens with the pack
expanded.
**Given** Create -> Cards -> Write
**When** the learner chooses a pack and deck and enters front and back
**Then** the existing card shape is saved into that deck and Cards opens
filtered to that pack and deck.

### Scenario 5: Generate readiness

**Given** no provider URL or model is saved
**When** the learner opens Generate under any target
**Then** an inline setup message appears with a link to Settings and the draft
is not lost.
**Given** a provider URL and model but no key
**When** the learner presses Generate
**Then** an inline key prompt appears, the draft stays, and Chat is offered as
an alternative.
**Given** a saved URL, model, and key
**When** the learner generates
**Then** the exact prompt is shown and nothing leaves until the learner sends it.

### Scenario 6: Generate Pack

**Given** a ready provider and Create -> Pack -> Generate
**When** the learner asks for a total card count (default 10, maximum 20)
**Then** the provider chooses the pack name and deck split, the whole result is
validated, the pack is saved only if every part passes, a name collision appends
2, 3, and so on, and Packs opens with the new pack expanded.

### Scenario 7: Generate Deck and Cards

**Given** Create -> Deck -> Generate
**When** the learner chooses a parent pack and asks for cards in the new deck
(default 5, maximum 20)
**Then** the provider names the deck, a collision appends 2, 3, and so on to the
deck label and the matching suffix to its id, and the new deck plus its cards are
saved together or not at all.
**Given** Create -> Cards -> Generate
**When** the learner chooses a pack and deck and asks for cards (default 5,
maximum 20)
**Then** the cards are saved into that deck only after the whole batch passes.

### Scenario 8: Chat at every target

**Given** Create -> any target -> Chat
**When** the learner builds the prompt
**Then** the prompt names the chosen parent where one is needed, asks the chat
to choose a pack or deck name for Pack and Deck targets, and has no learner name
field.
**When** the chat answer is pasted back
**Then** the same validator checks it; Pack and Deck answers use generated-name
suffixes on collision, Cards answers join only the chosen deck, and no provider
key is needed.

### Scenario 9: Strict import targets

**Given** Create -> Import
**When** the target is Pack
**Then** only a whole-pack bundle with a `pack` header is accepted; it creates or
updates by the existing newer-version rule.
**When** the target is Deck
**Then** only a bundle with `decks` and no `pack` header is accepted; it adds new
decks to the chosen pack and may carry cards for those new decks only.
**When** the target is Cards
**Then** only a bundle with `cards` and no `pack` or `decks` header is accepted;
it joins the chosen pack and deck.
**Then** a mismatched shape is refused with a plain message that names the target
to try, no auto-detection changes the target, and file and pasted text behave the
same.

### Scenario 10: Validation is the gate

**Given** a generated, chat, or imported result
**When** one item is invalid
**Then** nothing is written, the error names the item and field, and no partial
pack, deck, or card batch is kept.

### Scenario 11: Packs browses and expands

**Given** the Packs tab
**When** the learner searches, refreshes, or exports a pack
**Then** the existing behavior remains.
**When** the learner expands a pack
**Then** each deck shows its card count, an Add cards shortcut, and Delete deck;
the pack row shows Delete pack.

### Scenario 12: Delete a pack

**Given** an expanded pack
**When** the learner chooses Delete pack and types the pack name exactly
**Then** the pack, its decks, its cards, and those cards' evidence are removed,
the list refreshes, and a short notice names what was removed.
**Then** prompt history stays, the one-time seed fact is untouched, and deleting
the starter pack does not bring it back on reload.

### Scenario 13: Delete a deck

**Given** an expanded pack with more than one deck
**When** the learner chooses Delete deck and types the deck name exactly
**Then** that deck, its cards, and their evidence are removed and the pack stays.
**Given** the only deck in a pack
**When** the learner tries to delete it
**Then** the action is refused with a plain message that the last deck must stay
and the pack should be deleted instead.
**Given** the confirmation is cancelled or the name is wrong
**Then** nothing changes.

### Scenario 14: After create

**Given** any successful create
**When** the result is saved
**Then** Pack and Deck results open Packs with the relevant pack expanded, Cards
results open Cards filtered to the created pack and deck, and a short notice
names what was created.

### Scenario 15: Cards manages, does not create

**Given** the Cards tab
**When** the learner lists, searches, edits, deletes, views retired cards, or
opens a record
**Then** the existing behavior remains, and no add-card, import, or generate
form is present.

## Simulation Contract

The post-implementation simulation drives the real router and memory store, then
checks the built Library page. It must print the state after each group:

```bash
npm run simulate:create-flow
# -> Write pack -> one deck, zero cards; duplicate refused
# -> Write deck -> empty deck; Write card -> card in chosen deck
# -> Generate Pack/Deck/Cards with a fake provider -> all-or-nothing
# -> generated collision gets -2 (and -3); deck label/id stay paired
# -> Chat prompt has no name field; Chat Pack/Deck collision auto-numbers
# -> Import Pack/Deck/Cards accept only their shape; mismatch writes nothing
# -> Delete deck removes its cards + evidence; last deck refused
# -> Delete pack removes pack/decks/cards/evidence; prompt history stays
# -> seed fact unchanged after deleting the starter pack
# -> create result navigation selects Packs expanded or Cards filtered
```

The UI portion uses the built static page and the existing browser test lane:
the three tabs, target-first methods, typed-name delete dialog, and after-create
destination are exercised against the real render, not the design simulation.

## Technical Design

### Data Models

```ts
type CreateTarget = "pack" | "deck" | "cards";
type CreateMethod = "write" | "generate" | "chat" | "import";

type CreateResult =
  | { kind: "pack"; packName: string }
  | { kind: "deck"; packName: string; deckId: string }
  | { kind: "cards"; packName: string; deckId: string; count: number };

type ImportTarget =
  | { kind: "pack" }
  | { kind: "deck"; packName: string }
  | { kind: "cards"; packName: string; deckId: string };

interface DeletionResult {
  removedDecks: number;
  removedCards: number;
  removedEvidenceRows: number;
}
```

Pack names and deck ids keep the existing bundle identity rules: pack names and
deck ids are lowercase slugs, deck names are labels. Generated collisions append
`-2`, `-3` to pack names and deck ids and ` 2`, ` 3` to deck labels; learner and
import names never auto-number. This keeps the bundle format unchanged.

Target shapes are fixed:

| Target | Required top level | May contain | Never contains |
| --- | --- | --- | --- |
| Pack | `pack`, `decks` | cards for the pack's decks | another pack |
| Deck | `decks` | cards for the new decks only | `pack` header |
| Cards | `cards` | cards for the chosen deck | `pack`, `decks` |

### API Contracts

- `POST /api/packs` stays the manual pack create route. The screen derives the
  first deck id from the deck name and keeps the existing duplicate rule.
- `POST /api/packs/:packName/decks` with `{ name, id? }` adds one empty deck and
  returns `{ pack, deck }`; duplicate ids are refused.
- `DELETE /api/packs/:packName` returns `DeletionResult` and removes the pack,
  its decks, cards, and those cards' evidence.
- `DELETE /api/packs/:packName/decks/:deckId` returns `DeletionResult`; it
  refuses when the deck is the last one in the pack.
- `POST /api/packs/import` accepts `{ json, target, namePolicy? }`, where
  `namePolicy` is `"strict"` by default and `"auto-suffix"` for Chat answers.
  Both file and pasted text use this route.
- `POST /api/provider/prepare` accepts
  `{ target, packName?, deckId?, count }`; `POST /api/provider/generate` returns
  a `CreateResult` plus the created cards or pack.
- `POST /api/authoring/prompt` accepts the same target shape without a name:
  `{ kind: "pack" }`, `{ kind: "deck", packName }`, or
  `{ kind: "cards", packName, deckId }`.
- Existing `POST /api/cards`, edit, delete, export, backup, restore, and settings
  routes keep their contracts.

### Dependencies

No new packages. The feature uses the existing Next.js, React, Zod, semver, and
Vitest stack.

### Architecture Notes

- `LibraryClient.tsx` becomes the shell: load packs/cards/provider, own tab and
  notices, and render one of three panels. The current create, generate, chat,
  and card-management blocks move out.
- New `PacksPanel.tsx`, `CardsPanel.tsx`, and `CreatePanel.tsx` keep each tab's
  state local. A shared `DeleteDialog.tsx` owns the typed-name confirmation.
- `repository.ts` gains `deletePack` and `deleteDeck`. They use the serial write
  queue and delete cards/evidence before changing the pack row.
- `bundle.ts` gains target-specific parsing and validation. The full
  `flashcards.pack/v1` bundle stays the export/backup shape; deck and cards
  fragments are accepted only for their matching target.
- `authoring.ts` drops the old whole-pack target and the learner name field.
  `provider.ts` gains Pack and Deck generation prompts while reusing the same
  all-or-nothing import path for saving.
- Deletion keeps prompt history and session facts. Only packs, decks, their
  cards, and those cards' evidence are removed.

## Non-Goals

- No preview or approval step before generated content is saved; delete is the
  undo.
- No automatic import target detection.
- No pack or deck rename.
- No deletion by import.
- No change to the bundle format, backup format, provider key rules, judging,
  evidence shape, sessions, or progress.
- No cloud sync or server-side storage.
- No special protection for the starter pack beyond the existing one-time seed
  fact.

## Out of Scope (Future)

- Drag-and-drop between decks or packs.
- Bulk card move or merge.
- Restore preview or selective restore.
- Per-deck export separate from the pack bundle.
- AI regenerating an existing container in place.

## References

- `docs/features/library-create-flow/GRILL-library-create-flow.txt` — locked decisions
- `docs/features/library-create-flow/simulate-pre.html` — approved design simulation
- `docs/features/browser-app/PRD-TRD-browser-app.md` — pack/deck/card hierarchy
- `CONTEXT.md` — glossary
- `IMPL-library-create-flow.md` — execution plan (separate doc)
- `v1/src/app/library/LibraryClient.tsx` — current creation and management surface
- `v1/src/lib/browser/bundle.ts` — the one validator
- `v1/src/lib/browser/router.ts` — local API routes
- `v1/src/lib/browser/provider.ts` — generation
- `v1/src/lib/browser/authoring.ts` — Chat prompt
