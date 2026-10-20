# Pack format

A pack is one folder inside `packs/`. Everything is plain JSON, readable and
writable by hand. Files: `pack.json` (required), `cards.json` (optional) and
`prompts.json` (optional).

```
packs/
  polish-starter/
    pack.json
    cards.json
    prompts.json
```

## pack.json

```json
{
  "name": "polish-starter",
  "version": "1.0.0",
  "description": "Starting Polish: cases, verb aspect, agreement.",
  "language": "pl",
  "coreRange": "*",
  "topics": ["cases", "aspect", "basics"],
  "topicLabels": { "cases": "Cases", "aspect": "Verb aspect" }
}
```

- `name` — the pack's identity; also the first half of every card's id.
- `coreRange` — a semver range for the app version (this prototype is 0.1.0).
  A pack that needs a newer app is refused with a plain reason, never loaded
  half-way.
- `topics` — the allowed topic words for the pack's cards.
- `topicLabels` — human words shown on screens and in plans.

## cards.json

```json
{
  "cards": [
    {
      "summary": "Piję kawę",
      "topics": ["cases"],
      "tags": [],
      "prompt": [
        { "type": "text", "text": "Piję " },
        { "type": "blank", "id": "b1", "hint": "a drink, accusative" },
        { "type": "text", "text": "." }
      ],
      "answer": [{ "type": "text", "text": "Piję kawę." }],
      "answerDef": { "mode": "cloze", "blanks": [{ "id": "b1", "expected": ["kawę"] }] },
      "hints": ["Drinking takes the accusative."],
      "fullLine": "Piję kawę."
    }
  ]
}
```

A card is one side (`prompt`) and one answer (`answer`), plus the rule the
local judge follows (`answerDef`). Four answering surfaces exist:

| `mode`      | What the learner does                          | `answerDef` fields              |
| ----------- | ---------------------------------------------- | ------------------------------- |
| `cloze`     | fills each blank in the prompt                 | `blanks[].expected`             |
| `type`      | types the answer                               | `expected`, optional `judge`    |
| `picks`     | picks the correct options                      | `options`, `correct`            |
| `hear_type` | listens (the question is read aloud), then types | `expected`                    |

Parts available inside `prompt` and `answer`:

- `{ "type": "text", "text": "…" }` — plain text; `role: "translation"` marks
  an answer-side translation.
- `{ "type": "code", "text": "…", "language": "pl" }` — code or script.
- `{ "type": "speak", "text": "…", "lang": "pl-pl" }` — read aloud.
- `{ "type": "media", "src": "…", "alt": "…" }` — image or audio reference.
- `{ "type": "blank", "id": "b1", "hint": "…" }` — a blank the learner fills.

Hard rules, enforced when a pack loads: top-level `cards` array, every card
has a prompt, an answer, an answerDef, at least one topic, and the two sides of
a card are not the same text. Every topic a card uses must also appear in
`pack.json`'s `topics` list, so a typo fails the pack instead of quietly
inventing a topic group. A broken card fails the whole pack with the card
number and the field named — nothing half-loads.

## prompts.json

Optional. When a pack ships no prompts, the app's own careful words are used.
Both entries are templates where `{{slots}}` are filled by the app:

```json
{
  "generation": {
    "system": "You write correct Polish study lines…",
    "template": "Write {{count}} lines about {{topic}} for a {{level}} learner…"
  },
  "tutor": {
    "system": "You are a patient Polish tutor…",
    "hintTemplate": "The learner is looking at this card:\n{{cardText}}\n…"
  }
}
```

Slots the app can fill — and nothing else: `cardText`, `topic`, `level`,
`learningStyle`, `weakTopics`, `outcomeCategory`, `count`. Packs may not invent
slots, and the learner's typed answers are never available to any prompt.

## Trying a pack

Drop the folder into `packs/` and press "Rescan the folder" in the Library.
If anything is wrong, the pack appears in the list with a plain reason; fix the
file and rescan. Removing a pack folder leaves cards you already studied in
your deck, reported as orphans in the Library.
