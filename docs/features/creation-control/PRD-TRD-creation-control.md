# PRD-TRD: Creation control

**Slug:** creation-control
**Status:** Approved under delegated authority, 2026-10-22
**Pack:** 1 of the flashcards overhaul goal

## Why This Exists

The current Create flow chooses the target and method, then sends a prompt that
does not contain the learner's actual goal. The provider decides the subject,
decks, and card style from container names alone. Chat gives the learner a
read-only prompt and no view of the existing library. This pack makes the
learner's intent the input and keeps AI naming as a presentation choice.

## What It Does

### The brief

Generate and Chat share one **creation brief**:

- **Subject mode:** `learner` or `provider`.
  - `learner`: the learner writes what the cards should teach.
  - `provider`: the provider chooses from the library inventory and fills a gap.
- **Subject:** a short plain-English goal, e.g. "ordering coffee and asking for
  the bill". Required in learner mode. Disabled in provider mode.
- **Deck focus:** optional. For a new pack or deck, names the kinds of decks the
  learner wants. For cards, it narrows the card focus.
- **Card style:** one of `mixed`, `cloze`, `type`, `hear_type`.
  - `mixed` lets the provider choose per line; an omitted style means cloze.
  - A specific style is enforced by the validator.
- **Pack name / deck name:** optional for the matching target. A blank name lets
  the provider or chat choose. A supplied name is used, then the existing
  auto-suffix rule still applies on collision.

For Deck and Cards targets the subject is prefilled from the selected pack or
deck and remains editable. For a Pack target it starts blank.

### Generate

The Generate form shows the brief before `Prepare the prompt`. The prepared
prompt preview names the learner's subject, deck focus, requested styles, any
requested name, and the library inventory when the provider is choosing. The
existing all-or-nothing validation remains.

The prepared prompt is editable. The words in the box are what gets sent: the
learner can change them, copy them, rebuild them from the brief, or cancel. A
blank or unchanged box sends the prepared text. The answer still goes through
the strict importer, so an edit cannot bypass validation.

### Chat

The Chat prompt includes the brief and a library inventory: pack names,
descriptions, languages, and deck names only. It never includes cards, evidence,
settings, or the provider key.

The prompt is editable. The learner can:

- edit the text in place before copying or downloading;
- rebuild it from the current brief;
- paste the chat answer and run the same strict importer.

When the target or brief changes, the prompt is rebuilt and old edits are
discarded, because they belonged to a different request.

### Generated card styles

The provider must return one style per line in structured generation. The app
turns that line into:

- `cloze`: blank the target inside the full line;
- `type`: show the translation and expect the full line;
- `hear_type`: speak the full line and expect the full line.

For a specific requested style, a line with another style or an unlabeled style
refuses the whole batch with a plain reason. `type` lines require a translation.
`hear_type` uses the pack language when present.

## API and Data Contract

No stored data shape changes. The key is never sent to a prompt.

`POST /api/provider/prepare` accepts:

```json
{
  "target": {"kind": "pack"},
  "count": 10,
  "brief": {
    "subjectMode": "learner",
    "subject": "ordering coffee",
    "deckFocus": "drinks, paying",
    "cardStyle": "mixed",
    "packName": "",
    "deckName": ""
  }
}
```

`POST /api/authoring/prompt` accepts the same `brief` beside `target` and returns
the built prompt. The browser keeps the edited text; only the pasted answer is
imported.

## Edge Cases

- No readable packs: provider mode still works for a new Pack. Deck/Cards targets
  show the existing "create a pack first" message.
- Learner mode with a blank subject: Prepare is disabled and Chat shows the
  prompt as incomplete rather than sending a nameless request.
- Provider returns a different style than requested: whole batch refused.
- `type` line without a translation: whole batch refused.
- Duplicate generated names: existing auto-suffix.
- Write names: unchanged; strict, no auto-suffix.

## Simulation Contract

The post-implementation proof must demonstrate:

1. A learner chooses Pack + Generate, types a subject, and sees that subject in
   the prepared prompt.
2. Provider-choice mode includes existing packs and decks and asks for a gap.
3. Chat shows an editable prompt containing the library inventory; an edit
   survives copy preparation and the pasted answer still validates.
4. A specific card style produces that style; a wrong style is refused.
5. Writing an empty pack/deck and then generating or chatting into it does not
   require a second creation path.
6. A prepared Generate prompt is edited before sending, and the provider
   receives the edited words rather than the prepared text.

## Non-goals

- Background jobs and retries (pack 2).
- Study screen redesign (pack 3).
- PWA, install UI, and Pages deployment (pack 4).
- New storage fields or changes to the backup format.
- A new provider or a server relay.
