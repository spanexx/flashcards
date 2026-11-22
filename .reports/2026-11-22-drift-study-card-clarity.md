# Drift Review: study-card-clarity
**Date:** 2026-11-22
**Reviewer:** sub-agent (fresh-eyes)
**Verdict:** Minor Drift

## Summary

- **Contract gaps:** 3 low-severity doc/code wording drifts. No functional gap found. No violation of any locked design decision.
- **Execution gaps:** 0 in IMPL Phases 1–6. Phase 7's gates are green; the commit/push/PR step is the parent's job and is out of scope for this review.
- **Simulation gaps:** 0 in PRD-TRD §3 items 1–11. Item 12 ("full suite, typecheck, lint, build and PWA check are green") is **not demonstrated by `simulate.sh` itself** — the script only runs the 11-scene vitest rehearsal — but it was independently verified by this reviewer via separate gate commands (all green).

`bash docs/features/study-card-clarity/simulate.sh` was run from the worktree root. It printed all 11 scene lines and `PASS: study-card-clarity contract` twice (once from the test, once from the script), with `Test Files 1 passed (1)`, `Tests 1 passed (1)`. See the "Simulation contract" section below for full output detail.

**Recommended action:** Proceed to Phase 7 commit/push/PR. Nothing here blocks the PR. Log the three low-severity doc drifts (or correct the two PRD-TRD wordings at the parent's discretion); do not change code.

## Contract Gaps

All findings below are wording/naming drifts in the locked docs versus the shipped code. None changes behavior, and none contradicts a locked GRILL answer.

1. **PRD-TRD §4.4 helper name.** PRD-TRD:171–173 says "`promptWords(source.prompt)` joins text parts into one searchable line." IMPL:79 says "`promptLine(parts)`: joins the readable prompt text with a space." Shipped code exports `promptLine`, not `promptWords`:
   - `v1/src/lib/core/prompt-context.ts:32` — `export function promptLine(parts: CardPart[]): string {`
   - The IMPL is the later, more specific doc and the code follows it; the PRD-TRD name is simply stale. Non-blocking.

2. **PRD-TRD §4.5 placement of the study-note rule.** PRD-TRD:194 says "`commonRules` gains the self-contained prompt rule and the study-note rule." In code, only the self-contained rule went into `commonRules` (`v1/src/lib/browser/authoring.ts:72–75`); `STUDY_NOTE_RULE` is injected separately in the pack branch at `authoring.ts:380`:
   ```
   ${STUDY_NOTE_RULE}

   ${rules}
   ```
   Effect: pack-target prompts carry both rules; deck/card fragment prompts carry only the self-contained rule. Because `studyInstruction` is a pack-level field and fragment prompts deliberately omit the pack header (`authoring.ts:407, 424`), this is functionally correct — but it is not literally what §4.5 words say. Non-blocking.

3. **Provider prompt wording is narrower than the contract sentence.** PRD-TRD:65–67 / §4.6:210 require the provider prompts to say "every cloze or transformation prompt must name the base word, owner, or context in the prompt when the sentence alone cannot tell the learner what to supply." Shipped wording is:
   - `v1/src/lib/provider/prompt.ts:238–240` (`SELF_CONTAINED_PROMPT_RULE`): `"When the app hides a word the sentence cannot identify, the fullLine must name the base word or owner first: \"Base word: cup. There are two cups on the table.\" or \"Owner: Anna. That is Anna's winter coat.\""`
   - `DEFAULT_GENERATION_TEMPLATE` (`prompt.ts:55`) carries the same wording.
   It covers base word and owner with both verbatim examples, but drops the words "transformation" and "context", and is phrased for `fullLine` rather than a cloze prompt. This is a lane-appropriate phrasing choice (the generation lane emits full lines, not blanked cards), not a behavioral gap — the authoring lane's `commonRules` keeps the full "cloze or transformation … base word, owner or context" wording. Non-blocking, but note it if strict wording parity is required.

**Not a gap — intentional narrow rule:** PRD-TRD:72–78, GRILL Q7:129–144 and IMPL:200–211 all specify that the validator refuses *only* two mechanical cases (ownerless possessive; counted plural without a named base). The code does exactly that (`prompt-context.ts:117–148`), and the prompt text covers the judgment cases (irregular plurals, context-only cards). This narrowness is a locked decision, not drift. The tests `prompt-context.test.ts:102–123` (no count/no plural, `ss` words, prefix fragments, "The capital of France is ___" with `Paris`) confirm sound cards are left alone.

**Not a gap — naming of singular-base helper detail:** PRD-TRD:174–176 describes `singularBase` returning null for "irregular-looking words"; code (`prompt-context.ts:78–84`) only special-cases short/`ss`/`-ies`/`ches|shes|xes|zes`. This helper is display-only; the validator uses prefix matching (`namesBase`, `prompt-context.ts:91–105`) and never calls `singularBase`. No behavior impact.

## Execution Gaps (per IMPL phase)

- **Phase 1 — plain card styles: complete.** `v1/src/app/globals.css` diff shows every bullet: `.study-card` neutral border + `--shadow-soft` (was `--edge-accent` + accent glow); four `[data-outcome]` wash blocks collapsed into one `--wash: transparent; border-color: var(--line)` block; `.study-outcome` neutral border + transparent background; three outcome-specific `.study-answer` rules deleted; `.study-hint`, `.layer-bar`, `.word-line` neutralized; `.study-card .btn.primary` and its hover use `var(--ink)`/`var(--card)`/`box-shadow: none`; `.study-card-actions` shadow removed. `PACK: study-card-clarity` comments added. No coloured `color-mix` remains in the study-card family (grep confirmed only comment text mentions "accent"). Outcome word colours remain via `.outcome-got_it` etc. (`globals.css:579–593`), as the contract requires.
- **Phase 2 — study goal leaves the card: complete.** `study-view.ts:14–18` drops `studyInstruction` from `StudyPackInstruction`; `studyCardInstruction` deletes the `own` branch and always builds the mode line (`study-view.ts:25–33`). `PacksPanel.tsx:209–214` renders `Study goal:` + trimmed text only when non-empty. `.pack-study-goal`/`-label` styles added (`globals.css:1334–1353`). No `studyInstruction` reference remains in `StudyClient.tsx` or `app/study/`.
- **Phase 3 — cloze context validator: complete.** New `prompt-context.ts` exports `COUNT_WORDS`, `promptLine`, `clozeContextIssue`, `singularBase`; whole-word matching is case-insensitive with non-letter boundaries; messages are the fixed ones from IMPL:91–92. `card.ts:149–155` calls `clozeContextIssue` in the cloze branch and appends with the card index. Tests: `prompt-context.test.ts`, `card.test.ts:174–204`.
- **Phase 4 — authoring skill 7.0.0: complete, with the two doc-wording drifts listed above.** Version bumped; `commonRules` carries the self-contained rule; `packHeader` takes `includeStudyNote` and writes the fixed placeholder; `packHeader`/`shapeForPack` never receive raw text; `briefSection` → `describeCreationBrief` quotes the raw preference once and asks for a distilled note; `wordLessonExample` story prompt changed; pack self-check extended. Tests: `browser-authoring.test.ts:74–107`, `creation-brief.test.ts:148–188, 278–292`.
- **Phase 5 — provider prompts and note precedence: complete, with the wording drift listed above.** `DEFAULT_GENERATION_TEMPLATE`, `SELF_CONTAINED_PROMPT_RULE`, `pairPromptLines`, `packShape`, and all three build*Prompt functions updated; `generatedPackBundle` (`generate.ts:327–334, 353–357`) stores only `parsed.data.pack.studyInstruction`; `withBriefOnPackText` (`creation.ts:205–216`) writes only the pair. Tests: `provider-prompt.test.ts:468–510`, `provider-flow.test.ts:404–447`, `creation-brief.test.ts`.
- **Phase 6 — tests and post-impl sim: complete.** Every test file named in IMPL:154–161 exists with the promised coverage. `simulate.sh` guards on `out/index.html` and runs the rehearsal through the repo's vitest binary. Verified green by this reviewer: `npm test` → 91 files / 1123 tests passed; `npm run typecheck` clean; `npm run lint` clean; `npm run check:pwa` → `check-pwa: passed (base path: /, files: 115, precache entries: 113)`; drift gates: `npm run check:drift` → `drift ok: 0 open, 0 awaiting, 47 resolved`, `check:drift:staged` → ok. (I did not re-run the full `npm run build` to avoid rewriting generated `out/` under the "report file only" write constraint; the build is evidenced by the existing `out/index.html` guard plus the PWA check on that tree, and by the parent goal report iteration 5.)
- **Phase 7 — gates and PR: gates green; commit/push/PR is the parent's job and is explicitly exempted by the brief.** No execution gap.

## Simulation Gaps (per PRD-TRD §3 scenario, Match yes/no)

| # | PRD-TRD §3 quote (line) | Shipped evidence | Match |
|---|---|---|---|
| 1 | "A card whose pack has a raw meta-prompt prints only the automatic mode line under the prompt. The raw text does not appear anywhere in the card." (97–98) | Sim scene 1 (`simulate-study-card-clarity.test.ts:67–70`) asserts mode line and absence of `rawRequest`; `studyCardInstruction` ignores the field. | yes |
| 2 | "The same pack shows `Study goal:` with its stored text in the Library Packs panel." (99–100) | Sim scene 2 (`:72–77`) asserts built tree contains `Study goal:` and `pack-study-goal` and not the raw request; rendering is `PacksPanel.tsx:209–214`. Note: the sim checks built strings, not a live render with data. | yes |
| 3 | "The card surface has no outcome wash, no coloured border, no coloured answer rule, no tinted hint block, no tinted layer bar and no tinted word line." (101–102) | Sim scene 3 (`:79–88`) checks the relevant CSS blocks and absence of `[data-outcome="got_it"]` rules. It reads source CSS, not the built CSS bundle. | yes |
| 4 | "The card's primary action is monochrome in both themes." (103) | Sim scene 4 (`:90–97`) checks `.study-card .btn.primary` background/color/shadow and that both `:root` and dark `:root[data-theme="dark"]` define `--ink`. Verified values `#23211d` (light ink) and `#ece9e2` (dark ink), `--card` `#ffffff`/`#232220`. | yes |
| 5 | "The authoring skill says `7.0.0` and contains both self-contained examples." (104) | Sim scene 5 (`:99–103`) checks version and both example strings. | yes |
| 6 | "The validator refuses `That is ___ winter coat.` with expected `Anna's` and names the owner." (105–106) | Sim scene 6 (`:105–110`) checks `clozeContextIssue(...).message` contains `Owner: Anna.`. | yes |
| 7 | "The validator refuses `There are two ___ on the table.` with expected `cups` and names the base word." (107–108) | Sim scene 7 (`:112–117`) checks message contains `Base word: cup.`. | yes |
| 8 | "The validator accepts `Owner: Anna. That is ___ winter coat.` and `Base word: cup. There are two ___ on the table.`" (109–110) | Sim scene 8 (`:119–133`) expects `null` for both. | yes |
| 9 | "The authoring prompt no longer prints the raw study request in its example pack shape." (111–112) | Sim scene 9 (`:135–144`) checks `exampleShape(authored)` lacks the raw request and carries the placeholder. | yes |
| 10 | "A generated pack keeps the provider's distilled note, not the raw brief." (113) | Sim scene 10 (`:146–163`) checks `generatedPackBundle` keeps the distilled note over the raw request. | yes |
| 11 | "An old pack with no note still loads and the card still shows the automatic mode line." (114–115) | Sim scene 11 (`:165–170`) checks `studyCardInstruction` on a note-less pack returns the type mode line. | yes |
| 12 | "The full suite, typecheck, lint, build and PWA check are green." (116) | **Not in the rehearsal.** `simulate.sh` only runs the 11-scene test. Verified externally by this reviewer: 91 files / 1123 tests, typecheck clean, lint clean, `check-pwa: passed`, drift gates green, `out/index.html` present. | partial (yes by external gates, no by sim script) |

## Design Drift (pre-impl vs post-impl sim)

- `simulate-pre.sh` has 7 design scenes; `simulate.sh` + `simulate-study-card-clarity.test.ts` have 11 rehearsal scenes. The post-impl set is a superset of the design promises, not a contradiction.
- Pre scene 3 ("card surface is monochrome", `simulate-pre.sh:48–51`) bundled the primary action into one string and checked only "ink on paper" (light theme). Post scenes 3 and 4 split the surface and primary action, and check both themes via CSS variables — stricter, aligned with PRD-TRD §3 item 4.
- Pre scene 5/6 (validator refuse/accept) map to post scenes 6/7/8 with the same two learner examples.
- Pre scene 7 (note is distilled, not copied) is implicitly covered by post scene 10, whose generated note is the distilled sentence from the design (`"Focus on plain-English word form changes without Latin grammar jargon."`). No conflicting promise.
- `simulate-pre.html` design preview shows the plain card with `Fill the blank in the Polish line.` and the pack overview line `Study goal: Answer in Polish. Ask for a hint if you get stuck.` — both match shipped behavior. No design drift.

## Drift Items to Log

- **D-40 (Low, suggested):** PRD-TRD:173 names the prompt-joining helper `promptWords(source.prompt)`; shipped code and IMPL use `promptLine(parts)` (`prompt-context.ts:32`). Doc naming only, no behavior impact.
- **D-41 (Low, suggested):** PRD-TRD:194 says `commonRules` gains both the self-contained and study-note rules; code puts the study-note rule in the pack branch only (`authoring.ts:380`), which is functionally correct because the note is pack-level. Doc wording only.
- **D-42 (Low, optional):** PRD-TRD §3 item 12 is not demonstrated within `simulate.sh`; it relies on external gate runs. Gate results are green, so this is a simulation-coverage nuance, not a behavioral drift.
- **No Medium/High drift items found.** The validator's two-case limit is a locked intentional rule (GRILL Q7), not drift.

## Parent disposition (2026-11-22)

- D-40 (helper name): reconciled in place. PRD-TRD §4.4 now names `promptLine(parts)`, the exported helper the code and IMPL already use. No drift entry filed: the locked decision never named the helper, and this is a doc correction inside the pack.
- D-41 (study-note rule placement): reconciled in place. PRD-TRD §4.5 now says the self-contained rule is in `commonRules` and the study-note rule is a pack-level line, which is why deck and card fragments omit it. No behavior change and no drift entry.
- D-42 (gate evidence outside the rehearsal): reconciled in place. PRD-TRD §3 item 12 now states that the gates are verified by their own commands and that the rehearsal only guards against a missing build. No drift entry.
- Provider wording: reconciled in place. PRD-TRD §4.6 now records that the provider lane phrases the same rule for `fullLine` while the chat lane phrases it for a cloze prompt.
- Reconcile phase: `simulate-pre.sh` and `simulate-pre.html` moved to `docs/features/study-card-clarity/archive/`; `simulate.sh` is the single canonical rehearsal. The reviewer's path references above are historical.

## Recommendation

Verdict **Minor Drift**: the implementation faithfully executes every locked design decision and all IMPL phases 1–6; the three findings are low-severity doc/coverage wordings, not functional gaps.

1. Let the parent proceed with Phase 7: commit, push, open the PR, do not merge. Gates (`check:drift`, staged drift, test, typecheck, lint, PWA, simulation) are green.
2. Log D-40/D-41 (and optionally D-42) as Low entries, or reconcile the two PRD-TRD wordings in a follow-up doc edit at the parent's discretion. Do not change code for them.
3. No re-run of the implementation or tests is needed on account of this review.
