# PRD-TRD: Learner interface

**Slug:** learner-interface
**Status:** Approved under delegated authority, 2026-10-24
**Date:** 2026-10-24

## Why This Exists

The learner named three connected problems after the language and prompt pack.
Listening cards still offer a transcript before the answer, which turns a
dictation check into a reading check. The language pickers show a short list and
store a mix of names and codes. The whole interface sits in a narrow middle
column, so the sides of a desktop screen are empty and the dropdowns look
unfinished.

The learner also asked for a one-click full-screen card. The immediate use is
focus; the next use is image and video cards. The stage must be ready for that
without pretending videos are supported today.

This pack fixes the interface and the listening rule. It does not change the
judge, the four outcomes, the one-return rule, the session offer, the no-score
ending, or any saved record.

## Behavioral Spec

### Scenario 1: Listening is a dictation check

**Given** a `hear_type` card
**When** the card is shown before answering
**Then** it shows one "Play the line" control and a neutral instruction, with no
transcript, summary, translation, "Show the text" control, or reading-check
warning.

**When** the learner answers
**Then** the normal Answer block reveals the full line and translation.

**Given** a learner cannot hear the line
**When** they submit any answer
**Then** the Answer block reveals the line, and they can judge themselves
fairly with the existing correction controls.

### Scenario 2: The language picker is broad and honest

**Given** Write, Generate, Chat, or the pack editor
**When** the learner opens "Cards teach" or "Questions in"
**Then** one shared picker lists 73 sorted language names, a "Choose a
language" or "Not set" choice where appropriate, and "Other language".

**When** the learner chooses a listed language
**Then** the closed field shows its name and the saved value is its normalized
code.

**When** the learner chooses "Other language"
**Then** a text field appears and accepts a name or code the catalog does not
list; the saved value is lowercased and normalized by the existing route.

**Given** a pack already stores an unknown value or a region code
**Then** the picker keeps that value visible and does not silently replace it
with a different language.

### Scenario 3: The desktop uses its width

**Given** a window at 1440px
**When** the learner opens Library
**Then** the shell has a 240px sidebar, the content area uses up to 1420px, the
packs/cards sit in a wide main column, and a side rail shows real counts for
cards, packs, languages and decks.

**When** the learner opens Create
**Then** the target and method choices, the form, and the "What happens" rail
use the wide grid, and Write pack fields sit in two columns where they fit.

**When** the learner opens Study
**Then** the screen is one calm column: the plan uses up to 860px, the running
card about 720px, and no side rail competes with either. The approved design is
`docs/features/study-tab-redesign/PRD-TRD-study-tab-redesign.md`; it supersedes
the 820px card and both Study rails described in this pack.

**Given** the study plan, before a session starts
**Then** the count, the tutor state, "No score kept", the "Study from" and deck
pickers, the Offer field and a "Start session" control sit in that one column,
with "Why these cards", "What to expect" and the tutor details folded below.
Answered count, cards left, hints used and an end control do not exist yet.

**Given** a running session
**Then** the head shows "Card n of N", position pips, "Full screen" and "End";
there is no session rail.

### Scenario 4: Controls look like one family

**Given** any input, select or textarea
**Then** it is 44px high with an 11px radius and a shared border, focus ring and
disabled state; selects show a visible chevron and 16px text, so a phone does
not zoom when the picker takes focus.

**Given** any button
**Then** it shares the same border, focus ring and disabled state at 40px high
with a 10px radius, and a small button is 32px high. Buttons are deliberately
4px shorter than fields because they carry less text and sit in tighter rows.

**Given** the Settings profile form
**Then** its Level and Style labels use the same `field-label` and `form-grid`
classes as every other form, not inline text.

**Given** light or dark mode
**Then** picker choices and field text remain readable.

### Scenario 5: Full screen is one click

**Given** a running card
**When** the learner presses "Full screen"
**Then** the card enters browser fullscreen and the sidebar, page heading and
progress head leave the screen; the stage grows to 1100px and the same control
reads "Exit full screen".

**When** the learner presses Esc or "Exit full screen"
**Then** the normal Study layout returns and the card, answer, hint and progress
state are unchanged.

**Given** the browser refuses the Fullscreen API
**Then** a fixed CSS stage provides the same focused view and the same exit
control.

**When** the learner moves to the next card
**Then** full screen stays on.

**When** the session ends or the learner stops
**Then** full screen leaves.

**Given** a card contains an image, and later a video
**Then** the media is contained in the stage at up to 62% of the screen height
and never overflows the card.

### Scenario 6: Phone stays usable

**Given** a 390px window
**When** any changed screen is opened
**Then** the layout is one column, the side rails move below the main content,
but no control is clipped and `document.documentElement.scrollWidth` does not
exceed the viewport.

### Scenario 7: Nothing else moves

**Given** any existing pack, backup, session or record
**When** this pack ships
**Then** schemas, provider request shapes, judging, outcomes, session ending and
stored evidence are unchanged, and old packs still load.

## Simulation Contract

The post-implementation simulation runs the real tests and the built app:

```bash
cd v1
npm run typecheck
npm run lint
npm run build
npm test
```

It must show:

- `language.test.ts` proves 73 sorted languages and round-trips every name.
- `study-experience.test.ts` still proves the listening instruction and answer
  labels do not contain the card summary.
- `simulate-language-prompt-control.test.ts` no longer expects "Show the text"
  or "reading check"; it expects the post-answer line and the full-screen
  controls.
- The built Study page contains "Full screen", "Exit full screen", the plan
  facts and the position pips, and no "Show the text".
- A browser run at 1440x900 shows: no transcript before answering; the answer
  after; full screen enters, keeps state on next card, and exits; Library rail
  counts are real; Create pickers list more than 70 languages and accept an
  outside language.
- A browser run at 390x844 shows no horizontal overflow on Study, Library and
  Create.
- Screenshots of Study, full-screen Study, Library and Create are reviewed with
  the learner.

The manual browser steps and screenshot names live in
`simulate-post.md`; the pre-simulation remains available for comparison until
the two are reconciled.

## Technical Design

### Data Models

No stored shape changes. `PackStatus`, `PackStatus.decks`, `Card`, `Plan`,
`AnswerResult`, backup and bundle schemas are untouched. The existing
`language` and `sourceLanguage` strings are still normalized by the routes.

New UI-only types:

```ts
interface LanguageFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  allowUnset?: boolean;
  unsetLabel?: string;
}

type StudyPhase = "loading" | "empty" | "plan" | "running" | "done" | "error";
```

Study adds local state only: `answered`, `hintsUsed` and the `fullStage`
boolean. The full screen state is not saved.

### Language Catalog

`v1/src/lib/shared/language.ts` grows `LANGUAGE_NAMES` from 29 to the 73 names
shown in the pre-simulation, from Afrikaans to Zulu. `COMMON_LANGUAGES` stays a
sorted array of `{ code, name }`.

Aliases are derived from the names, so every catalog name normalizes to its
code. The existing extra aliases stay (`english`, `pt-br`, and so on). Unknown
text remains lowercased, not refused.

`LanguageField` is a client component in
`v1/src/app/library/LanguageField.tsx`:

- The select value is the stored code when it is in the catalog.
- If the current value is a region code whose base is known, a temporary option
  keeps the full value visible under the readable base name.
- If the current value is unknown, the select shows "Other language" and a text
  input carries the raw value.
- Choosing "Other language" clears the current value and shows the text input.
- The component never invents a code for an unlisted name; the save route
  normalizes it.

### API Contracts

No new route. Existing contracts stay:

- `POST /api/packs` normalizes `language` and `sourceLanguage`.
- `PATCH /api/packs/:name` accepts normalized or raw language text and stores
  the normalized value.
- `POST /api/authoring/prompt` and the generation routes consume the same
  `CreationBrief`; the screen now sends codes for listed languages and raw text
  for an outside language.
- `GET /api/plan`, `POST /api/answer`, `POST /api/session/end` and
  `POST /api/provider/hint` are untouched.

### Architecture Notes

- `StudyClient.tsx` owns the listening simplification, the full-screen stage and
  the card loop. A `stageRef` wraps the card and its controls.
- The plan, the session head and the card are separate modules under
  `app/study/` (see the study-tab-redesign pack). `StudySession` accepts an
  optional `aboveCard` element, which is the teaching-layers seam; it renders
  nothing when absent.
- `enterFullScreen` sets local state first, then calls
  `stageRef.current.requestFullscreen()` inside the click gesture. A refusal is
  caught and leaves the CSS overlay on. `exitFullScreen` clears local state and
  calls `document.exitFullscreen()` when present.
- A `fullscreenchange` listener clears the stage when the browser leaves
  fullscreen; an Escape key listener covers the CSS fallback. Both are removed
  on unmount. A mount cleanup releases the browser fullscreen on route change.
- `finish` exits full screen before it changes the phase. There is no separate
  phase effect, so React does not set state synchronously inside an effect.
- The session head reads the current queue and index. It does not write
  anything.
- `LibraryClient.tsx` keeps the tabs and wraps Packs/Cards in a
  `.library-layout` with a real `.rail`. Create keeps its own `create-grid`.
- `CreatePanel.tsx`, `CreationBriefFields.tsx` and `PackEditor.tsx` replace
  their datalists with `LanguageField`.
- `globals.css` gains the wide shell, shared controls, rail, form grid and
  full-screen rules. No new dependency.
- The native select is kept; the browser owns long-list scrolling on phone.

## Non-Goals

- No video card part; the stage is prepared for one.
- No pre-answer listening fallback. The full line appears after judging.
- No custom searchable combobox or flags; the native select plus "Other
  language" is enough.
- No global language setting, per-user theme or new theme system.
- No new navigation, route or page.
- No change to judging, outcomes, session rules, prompts, schemas or backups.
- No mobile drawer redesign; the existing stacked sidebar stays.
- No automatic language detection or translation of existing cards.

## Out of Scope (Future)

- A first-class video card part.
- Keyboard shortcuts beyond Escape.
- Remembering full-screen preference across sessions.
- Language flags or region-specific names.
- Per-card language overrides.

## Risks and Named Edges

- **No sound:** a learner who cannot hear cannot answer correctly before the
  reveal. They can submit once and read the line, then use the correction
  controls. A separate accessibility path would be a new pack.
- **Fullscreen refusal:** some embedded browsers refuse the API. The CSS overlay
  is the fallback, and `body.full-stage` is always cleaned up.
- **Escape double-exit:** the browser and the key listener may both try to exit.
  The exit helper catches the second call and local state is already false.
- **Long select:** 73 native options are long on phone but remain usable; the
  browser handles scrolling.
- **Wider layout:** long card text can become hard to read. The study column
  stays around 860px for the plan and 720px for the card, while the shell uses
  the extra width for Library and Create.
- **Old values:** a pack may store a name, a code or an unknown word. The picker
  must preserve what it cannot place, not silently rewrite it.

## References

- `docs/features/learner-interface/GRILL-learner-interface.txt` — locked decisions
- `docs/features/learner-interface/simulate-pre.html` — approved design simulation
- `docs/features/study-experience/PRD-TRD-study-experience.md` — listening rule
- `docs/features/language-prompt-control/PRD-TRD-language-prompt-control.md` —
  language pair and the superseded pre-answer fallback
- `v1/src/app/StudyClient.tsx` — current card loop
- `v1/src/app/library/` — current library and creation panels
- `v1/src/lib/shared/language.ts` — current 29-name catalog
- `v1/src/app/globals.css` — current narrow shell
- `IMPL-learner-interface.md` — execution plan (separate doc)
