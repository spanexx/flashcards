# PRD-TRD: Study card clarity

**Slug:** `study-card-clarity`
**Status:** Locked by delegated decision, 2026-11-22
**Date:** 2026-11-22
**Origin:** `docs/features/study-card-clarity/GRILL-study-card-clarity.txt`
**Design:** `archive/simulate-pre.html` (design preview), `archive/simulate-pre.sh` (design contract)
**Canonical rehearsal:** `simulate.sh` (post-implementation, reads the built app)

## 1. Why this exists

The study card is the one screen a learner looks at for most of a session. Two
problems made it louder than it needs to be:

1. The card surface carried too much colour: a green-tinted border and glow, an
   outcome wash, a coloured answer rule, a green hint block, a green teaching
   bar and a green word line. The learner asked for a plain, simple design.
2. The card printed `pack.studyInstruction` verbatim under the prompt. That
   field stores the learner's generation request, often a multi-sentence
   meta-prompt addressed to the AI. On a card it reads as clutter and pushes the
   answer down. The learner asked to move it to the pack overview.

The authoring prompt had the same leak in a different place. It copied the raw
request into the example pack shape, so a chat learned to store the raw request
as the study note. It also allowed cloze cards such as "That is ___ winter
coat." (expected "Anna's") or "There are two ___ on the table." without naming
the owner or the base word. The learner asked for a self-contained prompt rule,
a validation rule, and a distilled study note.

This pack changes the card surface and the prompt language. It does not change
the judge, the evidence, the session loop or the stored card shape.

## 2. What it does

### 2.1 The plain card

- The card border and shadow are neutral. The outcome no longer washes the card
  or colours its border.
- The outcome badge names the result in words. Its coloured pill background is
  removed; the word remains.
- The answer block keeps a left rule, but the rule is neutral. It is not green,
  amber or red.
- The hint block, the folded teaching-layer bar and the word line use the soft
  neutral surface and the ordinary line colour. The coloured left rules and
  tinted backgrounds are removed.
- The card's primary action (`Answer`, `Next card`, `Finish`) is monochrome:
  ink on paper in the light theme, paper on ink in the dark theme. The rest of
  the app keeps its accent colour.
- The serif prompt, the layout, the mode label, the tool buttons, the answer
  field, the footer and the full-screen stage are unchanged.

### 2.2 The study goal leaves the card

- `studyCardInstruction(card, pack)` returns only the automatic mode line. It
  never returns `pack.studyInstruction`.
- The pack's own note is shown in the Library Packs panel as a `Study goal:`
  line in the pack row, next to the version, deck count, card count and language
  pair.
- The pack editor keeps its `Study instruction` field. Existing raw text is not
  rewritten. The learner can replace it.
- The Dictionary pack page is not changed. It remains a cover, not a dashboard.

### 2.3 Self-contained prompts

- The authoring skill moves to `8.0.0`.
- The authoring prompt and the provider generation prompts say: every cloze or
  transformation prompt must name the base word, owner, or context in the prompt
  when the sentence alone cannot tell the learner what to supply.
- The prompt carries both worked examples:
  - `Base word: cup. There are two ___ on the table.`
  - `Owner: Anna. That is ___ winter coat.`
- The final self-check repeats the rule.
- A pure validator refuses two mechanical failures:
  - a possessive expected answer whose owner is absent from the prompt;
  - a count-word prompt with a regular plural expected answer whose singular
    base is absent from the prompt.
- The refusal names the missing word and tells the author what to write. The
  prompt instruction covers the judgment cases the validator cannot know, such
  as an irregular plural.

### 2.4 A distilled study note

- The authoring prompt and the provider prompts ask for one short
  learner-facing sentence in the question language. It says how to study. It
  must not address the AI, say "your job", mention cards, decks, JSON or
  generation, or copy the learner's request.
- The example pack shape carries a placeholder, never the learner's raw words.
- The generated note wins over the raw brief. The app no longer writes the raw
  brief onto the pack through `withBriefOnPackText` or
  `generatedPackBundle`.
- If the generator omits the note, the pack has no study note. The app does not
  fall back to the raw request.

## 3. Simulation contract

The post-implementation simulation must show all of these:

1. A card whose pack has a raw meta-prompt prints only the automatic mode line
   under the prompt. The raw text does not appear anywhere in the card.
2. The same pack shows `Study goal:` with its stored text in the Library Packs
   panel.
3. The card surface has no outcome wash, no coloured border, no coloured answer
   rule, no tinted hint block, no tinted layer bar and no tinted word line.
4. The card's primary action is monochrome in both themes.
5. The authoring skill says `8.0.0` and contains both self-contained examples.
6. The validator refuses `That is ___ winter coat.` with expected `Anna's` and
   names the owner.
7. The validator refuses `There are two ___ on the table.` with expected `cups`
   and names the base word.
8. The validator accepts `Owner: Anna. That is ___ winter coat.` and
   `Base word: cup. There are two ___ on the table.`
9. The authoring prompt no longer prints the raw study request in its example
   pack shape.
10. A generated pack keeps the provider's distilled note, not the raw brief.
11. An old pack with no note still loads and the card still shows the automatic
    mode line.
12. The full suite, typecheck, lint, build and PWA check are green. These are
    gate commands, so they are verified outside the rehearsal script; the
    script refuses to run before a build exists.

## 4. Technical design

### 4.1 Study instruction helper

`v1/src/lib/client/study-view.ts`

- `StudyPackInstruction` keeps only `language` and `sourceLanguage`. A caller
  may still pass a full pack; structural typing accepts the extra fields.
- `studyCardInstruction(card, pack)` ignores any `studyInstruction` field. The
  comment says why: the note belongs to the pack overview, not the card.
- The automatic mode lines stay exactly as they are.

`v1/src/app/StudyClient.tsx` keeps passing the card's pack. No state changes.

### 4.2 Pack overview

`v1/src/app/library/PacksPanel.tsx`

- In the pack row, after the description and before the error line, render:
  ```
  Study goal: <pack.studyInstruction>
  ```
  only when the trimmed text is non-empty.
- The line uses a `pack-study-goal` class and a quiet label. It does not become
  a button or a disclosure.

`v1/src/app/globals.css`

- `.pack-study-goal` is a quiet, wrapping line with a neutral left rule.
- `.pack-study-goal-label` is small, uppercase and quiet.

### 4.3 Card styles

`v1/src/app/globals.css` — scoped to the study card family:

- `.study-card`: `border-color: var(--line)`, `box-shadow: var(--shadow-soft)`.
- `.study-card[data-outcome]`: no wash, no coloured border. The `::before`
  element stays in the DOM for the reduced-motion rule but is transparent.
- `.study-outcome`: neutral border and transparent background. The outcome word
  keeps its text colour so the result is still readable without a pill.
- `.study-answer`: left rule `var(--line)` or `var(--ink)`; the outcome-specific
  overrides are removed.
- `.study-hint`: neutral soft background and a quiet left rule.
- `.layer-bar`: neutral border and a neutral left rule.
- `.word-line`: soft neutral background, no accent tint; the revealed form is
  ink, not green.
- `.study-card .btn.primary`: `background: var(--ink)`, `color: var(--card)`,
  `border-color: var(--ink)`, no glow. Hover keeps the same colours.
- `.study-card-actions`: no shadow; the neutral top rule stays.
- The body's radial aura is outside this pack and stays.

### 4.4 Self-contained validator

New module `v1/src/lib/core/prompt-context.ts`:

- `promptLine(parts)` joins text, code and spoken parts into one searchable line.
- `singularBase(word)` returns a conservative singular for a regular plural:
  `-ies -> -y`, `-es -> ""`, `-s -> ""`; returns null for short words, `-ss`
  and irregular-looking words.
- `COUNT_WORDS` is the fixed list: one through ten, `a pair`, `a couple`,
  `several`, `many`, `few`.
- `clozeContextIssue(source)` returns `{ field, message } | null`:
  - possessive: expected ends with `'s` or `’s`; the owner is the part before
    the suffix; the prompt must contain the owner as a whole word;
  - plural: the prompt contains a count word, the expected is a regular plural,
    and the prompt does not contain the singular base as a whole word.
- The helper is pure and exported for tests.

`v1/src/lib/core/card.ts` — `hardRuleIssues` calls `clozeContextIssue` for
`answerDef.mode === "cloze"` and appends the issue.

### 4.5 Authoring skill

`v1/src/lib/browser/authoring.ts`

- `AUTHORING_SKILL_VERSION = "8.0.0"`.
- `commonRules` gains the self-contained prompt rule. The study-note rule is a
  pack-level line in the pack-target prompt, because a note is stored only on a
  pack; deck and card fragments carry no pack header.
- `packHeader` takes a `studyNote` placeholder, not the raw brief.
- `buildAuthoringPrompt`:
  - when the brief has a study instruction, add a line that gives the raw
    preference as context and asks for a distilled note;
  - when the pack has a note and no brief, add a line that names it as the
    current note;
  - never put the raw text in the example JSON.
- `wordLessonExample` story prompt becomes
  `Base word: the base word. A line with ___.` so the shape teaches the rule.
- The final self-check adds: every cloze prompt names its base word, owner or
  context.

### 4.6 Provider prompts

`v1/src/lib/provider/prompt.ts`

- `DEFAULT_GENERATION_TEMPLATE` gains the self-contained prompt rule and the
  study-note rule.
- `pairPromptLines` changes "Store this study instruction..." to
  "The pack's study note is ..." and adds the distillation rule.
- `packShape` takes a placeholder note, never the raw brief.
- `buildPackGenerationPrompt`, `buildDeckGenerationPrompt` and
  `buildGenerationPrompt` add the self-contained rule to their user lines. The
  provider lane phrases it for `fullLine`, because that lane writes complete
  lines and the app hides the word; the chat lane phrases it for a cloze prompt.
  Both carry the same two worked examples and the same base/owner/context rule.
- `describeCreationBrief` in `v1/src/lib/shared/creation.ts` changes the raw
  "Store this study instruction" line to a distillation instruction.

### 4.7 Generation storage

`v1/src/lib/provider/generate.ts`

- `generatedPackBundle` prefers `parsed.data.pack.studyInstruction` and does not
  fall back to `options.studyInstruction`. The raw brief is never stored as the
  note.

`v1/src/lib/shared/creation.ts`

- `withBriefOnPackText` sets the pair only. It no longer writes the raw study
  instruction onto a Chat pack.

### 4.8 Tests

- `v1/tests/study-experience.test.ts`: the pack's instruction is ignored; the
  automatic mode line wins.
- `v1/tests/prompt-context.test.ts` (new): possessive, plural, count words,
  irregular plurals, base-word acceptance, owner acceptance and safe words.
- `v1/tests/card.test.ts` or the existing hard-rule test: the validator refuses
  the two examples through `hardRuleIssues`.
- `v1/tests/browser-authoring.test.ts`: version 8.0.0, both examples, the
  distilled note placeholder, no raw request in the example shape.
- `v1/tests/creation-brief.test.ts`: `withBriefOnPackText` keeps the pair and
  does not copy the raw instruction.
- `v1/tests/provider-flow.test.ts`: a generated pack keeps the provider's note
  over the raw brief.
- `v1/tests/simulate-study-card-clarity.test.ts` (new): reads the built Study
  and Library output and the source CSS to prove the contract.

## 5. Non-goals

- No new theme, palette, font or dependency.
- No change to the judge, outcomes, evidence rows, scheduling, one-return rule,
  hint cap, session loop, plan or offer.
- No change to the card, pack or bundle schema. `studyInstruction` stays an
  optional string.
- No data migration and no silent rewrite of an existing pack's note.
- No new drawer in the session head.
- No Dictionary pack-page redesign.
- No enforcement of a study-note length in the schema; the prompt asks for one
  short sentence, and the learner can edit the field.
- No provider request-shape change. Only prompt text and which returned note is
  stored change.

## 6. Acceptance evidence

- `npm test` green, with the new test files named above.
- `npm run typecheck` clean.
- `npm run lint` clean.
- `npm run build` green, including `check-pwa`.
- `bash docs/features/study-card-clarity/simulate.sh` prints `PASS`.
- `npm run check:drift` green.
- The built card carries no raw study request; the Library pack row carries the
  study goal.
