# PRD-TRD: Language and prompt control

## 1. Why this exists

The learner reported seven connected problems after Pack 4:

1. The app assumed every pack was Polish. An English Adjective pack generated
   Polish cards because the generic prompt carried a Polish example and no
   language pair.
2. A pack had only one language field, so there was no way to say which language
   asks the question and which language is being learned.
3. Type cards did not say which language to answer in. A Polish line under
   "TYPE THE LINE" was ambiguous.
4. A hint request could finish after the learner moved on and appear on the next
   card.
5. Listening cards hid all text, with no fallback when sound was unavailable.
6. Packs had no short instruction saying exactly what the learner should do.
7. Generation and tutor prompts were hardcoded, with no editor.

This pack makes the language pair and study instruction explicit per pack, gives
the learner one place to edit prompts, and fixes the two study leaks.

## 2. What it does

### 2.1 Pack language pair

- Every new pack has a target language (`language`) and a question language
  (`sourceLanguage`). Existing packs may have only a target; that source stays
  unknown and uses neutral wording.
- A new pack must choose a target. The source starts as English and is editable.
- A deck or card created inside a pack inherits that pack's pair. Create shows
  the pair read-only for those targets, including the Write forms.
- Existing packs load without migration. The Polish starter pack declares
  `sourceLanguage: "en"`. A pack with no source language uses neutral wording
  until the learner sets it, and opening its editor does not silently add one.
- Language names are normalised to codes for common languages; unknown text is
  kept lowercased.

### 2.2 Study instruction

- A pack may carry one optional `studyInstruction`.
- The study card shows that instruction verbatim when present.
- Otherwise it shows one automatic instruction:
  - cloze: "Fill the blank in the {target} line."
  - type: "Read the {source} line, then type the full {target} line."
  - hear_type: "Listen, then type the full {target} line."
  - picks: "Choose the correct {source} meaning."
- If a language is unknown or source equals target, the neutral form is used.
- The card summary never returns to the top before the answer.

### 2.3 Listening text fallback

**Superseded 2026-10-24 by `learner-interface` Q1.** The pre-answer
"Show the text" control is removed. Listening cards now show only the play
control and a neutral note; the line appears in the Answer block after judging.
The rest of this section is kept as the historical decision.

- A listening card keeps one "Play the line" control.
- A "Show the text" control reveals the full line on request.
- The text never reveals automatically.
- The card says that showing the text turns the listening check into a reading
  check. It is an accessibility fallback, not a hint, so it does not cap the
  outcome.

### 2.4 Hint isolation

- Each hint request is tied to the card that started it.
- Starting a session, rebuilding the plan, or moving to another card invalidates
  pending hint work.
- A late response is discarded. Its busy state cannot overwrite the new card.
- Automatic and manual hints follow the same rule.

### 2.5 Pack editor and prompts

- Packs has an "Edit pack" panel with:
  - target language
  - question language
  - study instruction
  - generation system prompt
  - generation template
  - tutor system prompt
  - tutor hint template
- The panel shows the app defaults and offers "Customize prompts" and "Reset to
  app defaults".
- A saved override lives on that pack and travels in export, import and backup.
- Chat's authoring prompt remains editable in Create. There is no global prompt
  editor.

### 2.6 Creation

- The creation brief carries target language, source language and study
  instruction.
- Write pack asks for the pair and instruction.
- Generate and Chat name the pair in their prompts and carry the instruction into
  a new pack. The brief's values win over a provider's echo, and Chat puts them
  on the pack even when the pasted answer leaves them out.
- Generic prompts use an example in the target language. Polish-only wording
  remains only in the Polish starter pack.

## 3. Simulation contract

NOTE 2026-10-24 (learner-interface): item 4 and the "Show the text" design
below are superseded. A listening card now reveals its line only after judging.
See `docs/features/learner-interface/PRD-TRD-learner-interface.md` Scenario 1.

The post-implementation simulation must show:

1. Creating an English/English pack previews English text and no Polish.
2. Adding a deck or cards to the Polish starter pack shows the inherited
   `pl`/`en` pair and a read-only instruction.
3. A type card says "Read the English line, then type the full Polish line."
4. [SUPERSEDED 2026-10-24] A listening card hides its line until "Show the
   text" is pressed. Current behavior: reveal only after judging.
5. A hint pending on card A leaves no text, message or busy state on card B.
6. Editing a pack changes its pair, instruction and prompts; resetting clears
   only the prompt overrides.
7. Export/import/backup carry the new fields and old files still load.
8. No summary leaks before the answer.

## 4. Technical design

### 4.1 Data model

`PackStatus`, `PackRecord`, `BrowserPack`, `LibraryPackFact` and the backup pack
shape gain:

- `sourceLanguage?: string`
- `studyInstruction?: string`

`language` remains the target. `CreationBrief` gains:

- `sourceLanguage: string`
- `targetLanguage: string`
- `studyInstruction: string`

The bundle pack schema gains the same optional fields. Generated pack schema
gains them too, so a provider may echo them; the app applies the brief's
non-empty values on top, so the provider cannot replace the learner's choice.

### 4.2 Language helper

New `v1/src/lib/shared/language.ts`:

- `normalizeLanguage(value)` maps common names to codes and accepts short codes.
- `languageName(code)` returns the readable name when known.
- `languagePairLabel(pack)` returns "Polish -> English" or a neutral label.
- `studyLanguageWords(pack)` returns `{ targetName, sourceName }` with safe
  fallbacks.

### 4.3 Prompt building

`v1/src/lib/provider/prompt.ts`:

- Export the four default prompt strings for the editor.
- Add pair lines to pack, deck and cards generation prompts.
- Choose an example line in the target language; never default to Polish.
- Pass the pair to style rules.
- Include the study instruction when present.

`v1/src/lib/browser/authoring.ts`:

- Add pair and instruction lines to the authoring prompt.
- Put `language`, `sourceLanguage` and `studyInstruction` in the pack shape.
- Use a target-language example instead of the Polish-only example.

### 4.4 Pack editing API

`PATCH /api/packs/:name` accepts:

```json
{
  "targetLanguage": "en",
  "sourceLanguage": "pl",
  "studyInstruction": "Translate into English.",
  "prompts": null
}
```

- Target must be non-empty after normalisation.
- An omitted source keeps the pack's current value. A provided blank source
  removes it, so an old pack stays neutral; a new pack still starts at `en`.
- `prompts: null` clears overrides; an object is validated by
  `packPromptsSchema`.
- The response is the updated pack.
- A missing pack is refused with a plain message.

### 4.5 Study view

`v1/src/lib/client/study-view.ts` gains:

- `studyCardInstruction(card, pack)`.
- The existing `studyModeLabel` stays as the short mode label.

`StudyClient.tsx`:

- Finds the card's pack in the already-loaded pack list.
- Renders the instruction under the mode label.
- [SUPERSEDED 2026-10-24] Adds `listenTextVisible` state, reset with the card.
- [SUPERSEDED 2026-10-24] Adds the "Show the text" control and the
  reading-check note. Current code has neither; the answer reveals the line.
- Adds a hint request token ref; reset increments it; late responses are
  discarded; busy state is reset with the card.

### 4.6 Compatibility

- Old bundles, backups and packs without the new fields are valid.
- Existing `language` values are untouched.
- The Polish starter pack adds `sourceLanguage: "en"` and a study instruction.
- No card content is translated.
- No provider request shape changes; only prompt text changes.

## 5. Non-goals

- No global language setting.
- No automatic translation of existing cards.
- No per-card instruction.
- No separate prompt editor for decks or cards. *(Superseded 2026-10-27: the learner asked for every Generate prompt to be editable; see D-30 in `docs/drift.md`.)*
- No new provider, storage or dependency.
- No change to the judge, outcomes, session offer or no-score ending.
- No merge, release or stable action in this pack.

## 6. Acceptance evidence

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test`
- New unit tests for language normalisation, pair-aware prompts, study
  instructions, bundle fields and pack editing.
- A post-implementation browser simulation through the built output covering the
  eight simulation-contract items.
