# PRD-TRD: Study Resilience

**Slug:** study-resilience
**Status:** Shipped (2026-10-26)
**Date:** 2026-10-26

## Why This Exists

Three everyday moments cost the learner work. A beginner opens a card and the
teaching layer covers the question before they have read it; the only way out is
Collapse, which asks again on the next card. A learner answers four cards, opens
the Library to check a word, and comes back to a fresh plan — the session, the
queue and the half-typed answer are gone. And a hand-written JSON import with a
trailing comma or a smart quote dies as a failed job, even though the mistake is
purely typographic and the system could see it.

Each is small on its own and expensive together: they teach the learner that the
app nags, forgets and gives up. This pack fixes all three in one place, with the
same rule behind each: the study flow keeps the learner's work and keeps quiet
until asked.

## Behavioral Spec

### Scenario 1: a beginner card opens its layer by default

**Given** a fresh device with no stored preference
**When** the learner reaches a beginner card that has a teaching layer
**Then** the layer is open above the question, exactly as today.

### Scenario 2: "Don't show again" ends the automatic opening

**Given** the layer is open on a beginner card
**When** the learner presses "Don't show again"
**Then** the layer collapses at once, the folded "Teaching layer" bar remains,
and the next beginner card shows the folded bar instead of the open layer. The
choice survives a reload.

### Scenario 3: manual opening still works

**Given** automatic opening is off
**When** the learner presses "Show the teaching layer" on any card
**Then** the layer opens normally, with Collapse and Listen as before, and the
preference stays off for later cards.

### Scenario 4: the learner turns it back on

**Given** automatic opening is off
**When** the learner turns on "Open the teaching layer automatically" in
Settings → Appearance
**Then** the next beginner card opens its layer automatically again.

### Scenario 5: a running session survives an in-app trip

**Given** a session at card 4 of 12 with two answers typed, one hint used and a
peek at an intermediate card
**When** the learner visits Library, Progress or Settings and returns to Study
**Then** the same card is on screen with the same queue, answers, hints and
position; no card is re-asked and no answer is lost.

### Scenario 6: a running session survives a reload

**Given** the same session
**When** the page is reloaded
**Then** the session returns exactly, with the note "Picked up where you left
off.", and the session history gains no second started event.

### Scenario 7: scratch text comes back

**Given** the learner has typed half of an answer and some scratch working but
has not submitted
**When** they leave Study and return
**Then** the typed text and the working are still there.

### Scenario 8: finishing or stopping clears the resume

**Given** a running session
**When** the learner finishes it or presses "End the session"
**Then** returning to Study shows the plan screen, not the old card.

### Scenario 9: a changed or deleted card drops out safely

**Given** a stored session whose current card was edited (new identity) or
deleted
**When** the learner returns
**Then** the vanished entry is skipped, the next surviving card is shown, and if
none survive the plan screen appears and the snapshot is cleared.

### Scenario 10: a hand-typed JSON import repairs itself

**Given** the Create Import target set to Cards (or Pack, or Chat answer) and a
pasted bundle containing any mix of a byte-order mark, a markdown fence, curly
quotes, `//` or `/* */` comments, trailing commas, unquoted keys or
single-quoted strings
**When** the learner imports it
**Then** the import succeeds, writes the same cards the corrected text would
write, and the job line names the kinds repaired.

### Scenario 11: a clean import stays silent

**Given** valid JSON
**When** the learner imports it
**Then** nothing about repair is shown.

### Scenario 12: irreversible damage is still refused

**Given** JSON that is still broken after every repair (for example a truncated
object or a missing field)
**When** the learner imports it
**Then** nothing is written and the refusal names the item and field as today;
it quotes the words around the failure; when a repair was attempted first,
the same sentence ends with "(syntax repair was tried first)".

### Scenario 13: repair never changes a valid document

**Given** any valid JSON document
**When** it passes through the repair path
**Then** the parsed value is identical and no repair is reported.

### Scenario 14: a backup stays strict

**Given** a backup file with a trailing comma
**When** the learner restores it
**Then** it is refused as today; only content bundles are repaired.

## Simulation Contract

The post-impl run must demonstrate, against the built app in a browser:

1. Scenarios 1–4 in one pass: open, dismiss, fold, reopen, Settings toggle on,
   next beginner card auto-opens again.
2. Scenarios 5–7: start a session, answer two cards, type but do not submit on
   the third, use a hint, peek at an intermediate card; navigate away and back;
   then reload; the same card, drafts and hint state return, and
   `sessions` holds one started row for the session id.
3. Scenario 8: finish clears the resume row and lands on the plan.
4. Scenario 9: delete the current stored card in another tab context (or edit
   its text), return, and see the session skip it.
5. Scenarios 10–11: import a deliberately sloppy cards bundle; the job line
   names the repairs and the library holds the cards; import a clean bundle and
   see no repair line.
6. Scenarios 12–13: a truncated bundle still fails with nothing written; a unit
   check proves valid JSON is returned untouched.
7. Scenario 14: a sloppy backup still fails.
8. Offline: after one load, go offline and reload; the restored session and the
   layer preference still work from storage.

## Technical Design

### Data Models

**Preference (browser only).** `localStorage["flashcards.teaching"]` holds
`{"autoOpen": boolean}`. Missing, unreadable or invalid means `{autoOpen:true}`.

**Resume row.** IndexedDB `flashcards` version 5 adds store `resume`
(`keyPath: "id"`). One row, id `active`. It is device-local live state: a
backup never carries it, and anything that replaces the library — including a
backup restore through `clearLibrary` — removes it because its cards are gone.
Its shape:

```ts
interface StoredSession {
  version: 1;
  savedAt: string;
  sessionId: string;
  scopePack: string;
  scopeDeck: string;
  offerChoice: number;
  plan: Plan;
  queue: QueueEntry[];
  index: number;
  results: Record<string, AnswerResult>;
  answersByEntry: Record<string, Record<string, string>>;
  working: string;
  hintTexts: string[];
  hintUsed: boolean;
  hintSource: string | null;
  approved: "none" | "yes" | "no";
  returned: string[];
  peeked: string[];
  autoHinted: string[];
  attempts: number;
  startedAt: number;
  layerUi: { entryId: string; open: boolean } | null;
}
```

**Repair result.** `{ value: unknown; repairs: RepairKind[] }` where
`RepairKind` is one of `bom | code-fence | smart-quotes | comments |
trailing-comma | unquoted-key | single-quoted-string`.

### API Contracts

- `v1/src/lib/client/teaching.ts`: `readTeachingPrefs()`,
  `writeTeachingAutoOpen(autoOpen: boolean)`, `DEFAULT_TEACHING_PREFS`.
- `v1/src/lib/core/session-resume.ts`: `toStoredSession(input): StoredSession`,
  `parseStoredSession(raw): StoredSession | null`,
  `pruneStoredSession(session, liveCardIds): StoredSession | null` — pure, no
  storage access.
- `v1/src/lib/browser/repository.ts`: `readStoredSession()`,
  `writeStoredSession(session)`, `clearStoredSession()`.
- `v1/src/lib/browser/session-save.ts`: `queueSessionSave(session)` — serialised
  last-write-wins, plus `flushSessionSave()` for page hide.
- `v1/src/lib/core/json-repair.ts`: `parseJsonLoose(text): { value, repairs }`,
  throwing a plain `Error` when repair is not enough: "the text is not valid
  JSON: <reason>", then ". The broken part is: <the words either side of the
  failure>", then " (syntax repair was tried first)" when a kind applied.
  `v1/src/lib/browser/bundle.ts` threads `repairs` into `ImportSuccess`;
  `v1/src/lib/browser/jobs.ts` stores them in `JobResult`.

### Dependencies

No new package. The scanner, storage helpers and preference module use the
platform only (localStorage, IndexedDB, JSON).

### Architecture Notes

- The layer's only auto-open decision is `StudyClient.tsx:118-122`; the
  preference joins that expression and nothing else changes in `layerPolicy`.
- The session snapshot goes through one save path — `queueSessionSave`, debounced
  — plus an eager flush when a session starts, so the first position cannot be
  lost. Restore happens before the initial plan load and bypasses the plan
  endpoint, so `started` is recorded once.
- The live set a snapshot is pruned against holds only cards that are not
  retired, because an edit retires the old row and mints a new identity
  (`session-save.ts` `loadResumableSession`).
- Repair sits in one place: `readJson` (`bundle.ts:173-190`), which parses
  through `parseJsonLoose` for every bundle target, and the legacy flat-import
  parser. Validation runs after repair exactly as before, so atomicity and
  identity are untouched.
- The repaired kinds travel with the import result; the job dock and the pack
  panel render one plain sentence.

## Non-Goals

- Semantic repair (missing fields, wrong kinds) — guessing content is not a fix.
- Repairing backups — machine-written and carries evidence.
- Cross-device session sync, session inside a backup.
- Changing the offer, scoring, plan or evidence rules.
- Restoring full-screen mode, spinners, speech playback or error banners.

## References

- `GRILL-study-resilience.txt` — locked decisions Q1–Q16
- `IMPL-study-resilience.md` — execution plan
- `v1/src/app/StudyClient.tsx`, `v1/src/app/study/TeachingLayer.tsx`
- `v1/src/lib/browser/{store,repository,bundle,jobs}.ts`
- `v1/src/lib/core/{session,card,import}.ts`
