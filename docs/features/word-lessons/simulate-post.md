# Word lessons — post-implementation simulation

This is the evidence pass for `simulate-pre.sh`. It walks the same eleven
scenes, but instead of stating the design it records what the implementation
actually does and which check proves it. Differences from the pre-impl script
are called out where they exist; they are not smoothed over.

Run context: WSL Debian, worktree `feature-word-lessons`, `v1/` package root.
Full suite after the build: 89 files, 1081 tests, all green. `npx tsc --noEmit`
and `npx eslint` on every touched source file are clean. `npm run build`
produced a static export with `check-pwa: passed`.

## 1. A language pack declares one word and five leaves

Observed: a bundle may carry `words` beside `cards`. A word has `id`, `lemma`,
`meaning`, optional `lang`, `forms`, `pairs` and an optional `note`. A form has
`label`, `to`, `meaning`, at least one `why` part and an optional `use`. A pair
has `target` and `meaning`. Every card may name `wordId` and `stage`.

Evidence: `tests/word.test.ts` (`wordSchema`), `tests/browser-bundle.test.ts`
("imports one whole lesson and keeps the words on the pack" — five linked cards
land with stages `story, spelling, forms, dialogue, matching`).

## 2. The plan keeps the lesson together

Observed: `orderWordCards` is applied inside `buildPlan`. A word block is placed
at that word's first selected card; its cards are sorted by stage with a stable
sort, so two cards of the same stage keep the algorithm's order. Cards with no
word keep their original position.

Evidence: `tests/plan.test.ts` (`orderWordCards` adjacency, two-word placement,
unknown stage last, and an unchanged no-word plan).

## 3. Story stage

Observed: the word line renders `lemma` and `meaning` before the answer. The
changed form is appended only when `result` exists, so a learner still has to
find `biurze`. The card is still a cloze with one blank; judging and evidence
are unchanged.

Evidence: `v1/src/app/study/WordLine.tsx`, `tests/word.test.ts` (`formForCard`
resolver), `tests/browser-bundle.test.ts` (evidence row survives a word link).

## 4. Forms stage

Observed: there is no new answer surface. A `forms` card is a `type` card; the
reason comes from the matched form's `why` through the teaching layer.

Deviation from the pre-impl script: the script described three visible blocks
(`base -> blank`, then `why`, then the `use` sentence as a second exercise). The
implementation shows the `why` in the layer and leaves the card's own sentence
as the one exercise. `use` is kept in the word record as authoring material but
is not rendered as a second blank, because that would put the changed form in
front of the learner twice and give away the exercise. This is the deliberate
answer-leak rule already recorded in the docs.

Evidence: `tests/word-check.test.ts` (a `forms` card needs at least one form),
`tests/word.test.ts` (`resolveCardHelp` joins the note and the matched form's
reason).

## 5. Forms is skipped when a word has no forms

Observed: nothing writes a forms card when the word has no forms, and the
importer refuses one if a bad bundle tries. There is no placeholder, no
"forms unavailable" message and no empty screen.

Evidence: `tests/word-check.test.ts` ("refuses a forms card on a word with no
forms"), `tests/word.test.ts` ("defaults forms and pairs so a bare word is
still valid").

## 6. Matching stage

Observed: `MatchBoard` renders two independently shuffled columns of tap
buttons. A correct pair locks and is disabled; a wrong pair shows for 420 ms
and clears with no score kept against the learner. The board reports one count
as `"got/total"`; the judge turns all pairs into `got_it`, some into `nearly`,
none into `no`, and a malformed or impossible count into `unjudged`. After the
answer the board freezes in place rather than unmounting, so the learner can
still see what they matched. There is no typing input, no Enter-to-check hint
and no Complete aid on a matching card. The I-don't-know control is present:
it sends `0/total`, so a learner who gives up on an empty board gets `No`
instead of being stuck behind a disabled Answer button.

Evidence: `tests/judge.test.ts` (five matching cases including hint cap),
`tests/study-experience.test.ts` (the give-up answer judges as No),
`tests/word-check.test.ts` (matching needs at least two distinct pairs).

## 7. Help comes from one place, in one order

Observed: `resolveCardHelp` returns the card's own teaching first, then the
word's note and the matched form's reason, then the page parts. The page is a
last fallback for a word card only: a plain card never turns its Dictionary
page into pre-answer help. The layer renders exactly that resolved list, so a
word card's help appears at the level policy's chosen moment.

Evidence: `tests/word.test.ts` (`resolveCardHelp` cases, including "never turns
a plain card's page into pre-answer help").

## 8. A non-language pack is untouched

Observed: `words` is optional everywhere and defaults to `[]`. No word line
renders without a `wordId`. A plain card's teaching still comes from its own
teaching field, and its page is still opened only from the Dictionary button.

Evidence: full suite green, including the System Design and Browser Dev
fixtures in `tests/packs.test.ts`, `tests/browser-bundle.test.ts` and the
simulation tests that read the fresh `out/` export.

## 9. Import refuses a broken lesson, all at once

Observed: `lessonIssues` runs in the whole-bundle import, the deck and cards
fragments, the folder loader and the flat import. Messages name the card or
word in plain words, for example:
`Card 3 ("Piję kawę"): stage "forms" needs at least one form on word "kawa".`
Nothing is written when any issue is found. Bundle updates only replace words
when the incoming file has some, so a word-less update cannot wipe a lesson.

Evidence: `tests/word-check.test.ts` (16 cases covering all ten invariants),
`tests/browser-bundle.test.ts` ("refuses a link to a word the file never
defines, and writes nothing").

## 10. Creation brief names the focus word

Observed: `focusWord` is an optional, trimmed brief field. The Create screen
offers installed lemmas in a datalist and, when the typed word matches one,
names the pack and language. An unseen word is accepted without an error.
The brief reaches both prompt lanes. The generation lane can write a `words`
array and link story, spelling and forms cards, which are the modes its line
schema can express. The copy-paste lane shows and asks for the whole five-stage
lesson; its deck and cards fragments explicitly cannot define a word.

Deviation from the pre-impl script: the prompt line reads
`Teach one word in this batch: the lemma "biuro".` followed by
`Every card belongs to one lesson about "biuro", not five unrelated lines.`
It is not the exact sentence in the design script, but it carries the same
hard instruction.

Evidence: `tests/creation-brief.test.ts`, `tests/provider-prompt.test.ts`
(generation rules, fragment restriction, generated word carried into the
bundle), `tests/browser-authoring.test.ts` (the whole example parses through
the real importer and the focus word reaches both targets).

## 11. What must not happen

Observed: identity ignores `wordId` and `stage`, so a link added in an update
keeps the card id and its evidence. A matching card cannot be answered by
typing. A stage with the wrong answer mode is refused at import. A half-written
lesson is refused before storage or rendering. No word line appears on a plain
card.

Evidence: `tests/word.test.ts` ("hashes a linked card exactly like an unlinked
one"), `tests/browser-bundle.test.ts` ("adds a word link on update without
changing the card id or its evidence"), full suite green.

## Reconciliation

The one substantive difference is scene 4: the `use` sentence is not a second
rendered exercise. That is the no-leak rule. At the first review the pre-impl
script and GRILL Q8 still described the old two-blank version; both have now
been corrected, so the design script and the shipped behavior agree. A second
gap from that review — the matching "No" outcome being unreachable — was fixed
by adding the give-up control described in scene 6. The word layer is optional
at the pack and card level; it changes no existing answer surface except the
new matching board, and it leaves every non-language pack as it was.
