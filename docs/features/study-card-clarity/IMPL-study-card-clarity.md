# IMPL: Study card clarity

**Slug:** `study-card-clarity`
**Status:** Locked by delegated decision, 2026-11-22
**Date:** 2026-11-22
**Origin:** `docs/features/study-card-clarity/GRILL-study-card-clarity.txt`
**Contract:** `docs/features/study-card-clarity/PRD-TRD-study-card-clarity.md`

## Phase order

1. The plain card styles.
2. The study goal leaves the card and lands in the Library pack row.
3. The cloze context validator.
4. The authoring skill 8.0.0.
5. The provider prompt rules and the generated-note precedence.
6. Tests, the post-implementation simulation, and the gates.

Each phase is a separate commit-sized change. A phase may not start before the
one above it is green in the targeted test lane.

## Phase 1 — the plain card styles

**Files:** `v1/src/app/globals.css`

- `.study-card`: `border: 1px solid var(--line)`, `box-shadow: var(--shadow-soft)`.
  The accent glow is removed.
- Delete the four `[data-outcome]` wash and border blocks. Add one block that
  sets `--wash: transparent` and `border-color: var(--line)` so the `::before`
  layer still exists for the reduced-motion rule and paints nothing.
- `.study-outcome`: a neutral `1px solid var(--line)` border, transparent
  background. The outcome-specific background rules are deleted; the outcome
  word keeps its existing text colour.
- `.study-answer`: `border-left: 3px solid var(--line)`. Delete the three
  outcome-specific rule overrides.
- `.study-hint`: `border-left-color: var(--line)`, `background: var(--soft)`.
- `.study-hint-label`: `color: var(--quiet)`.
- `.layer-bar`: `border-left: 3px solid var(--line)`, `background: var(--soft)`,
  and an ordinary `border` so the bar keeps its shape without the accent.
- `.layer-bar-icon`: `color: var(--quiet)`.
- `.word-line`: `background: var(--soft)`.
- `.word-line-form`: `color: var(--ink)`.
- `.study-card .btn.primary`: `background: var(--ink)`, `color: var(--card)`,
  `border-color: var(--ink)`, `box-shadow: none`. The hover keeps the same
  colours and drops the glow.
- `.study-card-actions`: `box-shadow: none`.
- Add a `PACK: study-card-clarity` note to each changed block that no longer
  explains itself.

**Proof:** `npm test -- tests/simulate-study-card-clarity.test.ts` (the CSS
contract assertions) after Phase 6 exists; until then, a targeted `vitest` run
on the new test file is allowed to fail only on the not-yet-written parts.

## Phase 2 — the study goal leaves the card

**Files:** `v1/src/lib/client/study-view.ts`,
`v1/src/app/library/PacksPanel.tsx`, `v1/src/app/globals.css`

- `StudyPackInstruction` drops `studyInstruction`. The interface is only the
  pair, because that is all the mode line reads.
- `studyCardInstruction` deletes the `own` branch and always builds the mode
  line. The doc comment says the pack's note lives in the pack overview.
- `StudyClient.tsx` needs no change; its `cardPack` still satisfies the smaller
  interface.
- `PacksPanel.tsx`: after the description line, render a `pack-study-goal`
  block only when `pack.studyInstruction?.trim()` is non-empty. The block holds
  a `Study goal` label and the text. It is not a button and has no disclosure.
- `globals.css`: `.pack-study-goal` is a wrapping, quiet line with a neutral
  left rule; `.pack-study-goal-label` is small, uppercase and quiet.

**Proof:** `npx vitest run tests/study-experience.test.ts`.

## Phase 3 — the cloze context validator

**Files:** `v1/src/lib/core/prompt-context.ts` (new),
`v1/src/lib/core/card.ts`

- `prompt-context.ts` exports:
  - `COUNT_WORDS`: one to ten, `a pair`, `a couple`, `several`, `many`, `few`.
  - `promptLine(parts)`: joins the readable prompt text with a space.
  - `clozeContextIssue(source)`: returns `{ field, message } | null`.
  - `singularBase(word)`: a display-only helper for the message and tests.
- Whole-word matching is case-insensitive and uses a non-letter boundary, so
  `Anna` does not match `Annabel` and `cup` does not match `cupboard`.
- Possessive rule: an expected answer ending in `'s` or `’s` must have its owner
  as a whole word in the prompt.
- Plural rule: when the prompt contains a count word, an expected answer that
  ends in `s` and is not `ss` must have a whole word in the prompt that is a
  strict prefix of it, or the `-ies -> -y` base. This accepts `cup`, `box`,
  `bus` and `city` without a dictionary.
- The messages are fixed and safe:
  - `the prompt asks for "Anna's" but never names its owner; write the owner first, for example "Owner: Anna. That is ___ winter coat."`
  - `the prompt asks for "cups" after a count but never names its base word; write the base word first, for example "Base word: cup. There are two ___ on the table."`
- `hardRuleIssues` calls `clozeContextIssue(source)` for a cloze card and
  appends the result with the card index.
- The module carries a `PACK: study-card-clarity` header and a WHY comment
  that names the narrow scope: two mechanical cases only, because a semantic
  guess would refuse sound cards.

**Proof:** `npx vitest run tests/prompt-context.test.ts tests/card.test.ts`.

## Phase 4 — the authoring skill 8.0.0

**Files:** `v1/src/lib/browser/authoring.ts`,
`v1/src/lib/shared/creation.ts`

- `AUTHORING_SKILL_VERSION = "8.0.0"`.
- `commonRules` gains:
  - every cloze or transformation prompt names the base word, owner or context
    when the sentence alone cannot tell the learner what to supply;
  - both worked examples, verbatim;
  - one sentence on the learner-facing study note and the ban on copying the
    learner's request.
- `packHeader` takes `includeStudyNote: boolean`, never the raw text. When true
  it writes the fixed placeholder `"<one short learner-facing sentence on how to
  study>"`.
- `buildAuthoringPrompt` replaces the raw "Store this study instruction" line:
  - a raw brief preference is quoted once as context, with an instruction to
    distill it and not copy it;
  - an existing pack note is named as the current note;
  - the example JSON carries the placeholder only when the brief has a raw
    preference.
- `wordLessonExample`'s story prompt becomes
  `Base word: the base word. A line with ___.`
- The pack self-check adds the self-contained prompt rule and the study-note
  rule.
- `describeCreationBrief` replaces the raw "Store this study instruction" line
  with the distillation instruction.
- `withBriefOnPackText` stops writing the raw note; it still writes the pair.
- No schema change; `studyInstruction` remains an optional string.

**Proof:** `npx vitest run tests/browser-authoring.test.ts tests/creation-brief.test.ts`.

## Phase 5 — provider prompts and note precedence

**Files:** `v1/src/lib/provider/prompt.ts`,
`v1/src/lib/provider/generate.ts`

- `DEFAULT_GENERATION_TEMPLATE` gains the self-contained prompt rule and the
  study-note rule.
- `pairPromptLines` names the pack's current note and asks for a distilled note
  instead of telling the provider to store the raw instruction.
- `packShape` takes a `includeStudyNote` flag and writes the placeholder, never
  the raw brief.
- `buildPackGenerationPrompt`, `buildDeckGenerationPrompt` and
  `buildGenerationPrompt` add the self-contained rule to their user lines.
- `generatedPackBundle` stores `parsed.data.pack.studyInstruction` only. The
  raw `options.studyInstruction` no longer wins and no longer becomes a
  fallback. The pair still prefers the brief.

**Proof:** `npx vitest run tests/provider-prompt.test.ts tests/provider-flow.test.ts`.

## Phase 6 — tests and the post-implementation simulation

**Files:** `v1/tests/prompt-context.test.ts` (new),
`v1/tests/study-experience.test.ts`,
`v1/tests/card.test.ts`,
`v1/tests/browser-authoring.test.ts`,
`v1/tests/creation-brief.test.ts`,
`v1/tests/provider-flow.test.ts`,
`v1/tests/simulate-study-card-clarity.test.ts` (new),
`docs/features/study-card-clarity/simulate.sh` (new)

- The new validator test covers: owner present and absent; base word present
  and absent; `-ies`; `-es`; `ss` words left alone; a count with no plural; a
  plural with no count word; a prompt word that is only a prefix fragment.
- `card.test.ts` proves the two learner examples are refused through
  `hardRuleIssues`, and the self-contained versions pass.
- `study-experience.test.ts` proves the pack's raw note is ignored and the mode
  line wins.
- `browser-authoring.test.ts` proves 8.0.0, both examples, the placeholder, and
  the absence of the raw request from the example JSON.
- `creation-brief.test.ts` proves `withBriefOnPackText` keeps the pair and does
  not copy the raw note.
- `provider-flow.test.ts` proves a provider note beats the raw brief, and a
  provider omission leaves no note.
- `simulate-study-card-clarity.test.ts` is the post-implementation rehearsal.
  It uses the real helpers and reads the real CSS, and it refuses to run when
  `v1/out/index.html` is missing. It prints one line per contract scene and a
  final `PASS`.
- `simulate.sh` runs that test through the repo's vitest binary with the same
  guard style as `scripts/simulate-browser.mjs`.

**Proof:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
`bash docs/features/study-card-clarity/simulate.sh`.

## Phase 7 — gates and the pull request

- `npm run check:drift` and `npm run check:drift:staged` must pass.
- The commit is WSL-only, stages named files, and follows
  `docs/ethics/commit.md`.
- Push the branch and open a pull request. Do not merge.

## Out of scope

Everything in PRD-TRD §5. In particular: no schema change, no data migration,
no new dependency, no new route, no Dictionary redesign, no session-head drawer.

## Risks and how they are handled

- **A false refusal on a sound plural.** The validator only refuses when a count
  word is present and no prompt word is a prefix of the expected plural. A
  sentence that already carries the base word passes. A sentence that carries
  neither is the case the learner asked to refuse.
- **A raw note still reaching a pack.** The chat lane no longer writes it, the
  provider lane no longer falls back to it, and the card no longer prints it.
  The only remaining copy is an old pack's stored text, which the learner can
  edit.
- **The prompt and the validator disagreeing.** The prompt teaches the judgment
  cases; the validator refuses only the two mechanical cases. The validator is
  narrower on purpose, so a sound card is never refused for a rule the prompt
  only describes.

## Delivery note — 2026-11-22 (D-48)

- The residual risk "a raw note still reaching a pack" is now closed at storage.
  `normalizeStudyInstruction` and `studyInstructionField` in
  `v1/src/lib/core/prompt-context.ts` are used by the pack manifest, the bundle
  and the generated-pack schemas. An echoed `Store this study instruction...`
  wrapper is unwrapped; AI-addressed text is refused with a plain message.
- The field stays optional, so an old pack with no note still imports. The card
  face and pack overview behaviour from this pack are unchanged.
- Proof: `tests/prompt-context.test.ts`, `tests/browser-bundle.test.ts`, full
  suite, build and both drift gates. D-48 is resolved in `docs/drift.md`.
