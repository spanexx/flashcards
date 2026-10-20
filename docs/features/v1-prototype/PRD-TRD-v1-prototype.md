# PRD-TRD — Flashcards v1 prototype

**Pack:** `v1-prototype`
**Status:** approved for prototype build by the user's request of 2026-10-19
**Behaviour source:** `wayfinder/anything-learning-spec/` tickets and map
**Runtime choices:** `GRILL-v1-prototype.txt` (R1–R18)

## 1. Why this exists

The project has a locked design and no working software. The learner cannot yet
feel the plan, the answering surfaces, the return of wrong cards, the no-report
ending, or the evidence-backed progress screen. This prototype exists to put
those behaviours in the learner's hands so the runtime questions in the grill
can be answered by use rather than by argument.

## 2. What it does

A single learner runs one local Next.js process on their own machine and opens
it in a browser tab. They install a pack by dropping a folder into the packs
directory. They study a session, answer cards with four different surfaces,
can ask for a hint, see wrong cards return once, stop whenever they like, and
read progress as named cards and next work.

The app works with no provider. With a provider key configured server-side,
the learner can generate cards from a visible prompt and ask the tutor for
hints. The browser never holds the key and never builds a prompt.

### 2.1 Operator-visible flow

1. **Library** — installed packs are listed with version, topics and card
   count. Broken packs are named with a plain reason and do not block anything.
   The learner can add a card by hand or import a JSON batch.
2. **Study** — the plan appears first: the offer, named groups of cards and a
   plain reason for each group. If the tutor is available, a per-session banner
   shows the prompt shape and asks for approval once.
3. **Card** — one card at a time. Prompt parts are laid out in order. The
   configured surface collects the answer: dotted blanks, picks, one typed
   answer, or hear-then-type. A hint button is always present.
4. **Reveal** — the answer side always appears. The outcome is one of Again,
   Got it, Nearly, No, or unjudged. The learner can correct a judged outcome.
   Wrong cards are queued to return once at the end.
5. **Ending** — when the queue and retry queue are empty the screen says only
   that this session is finished. There is no report or score. Stopping is a
   plain return home.
6. **Progress** — cards the learner used to get wrong and now gets right, cards
   that used to be slow and are now quick, next work by topic, strengths, and
   every card's raw evidence. Any evidence row can be corrected with a new row.
7. **Generate** — the learner chooses pack, topic and count. The server builds
   the exact prompt and shows it with a copy action. Sending uses a request id,
   not the browser's copy of the prompt. Valid lines become cards immediately,
   with an origin note naming the request.
8. **Settings** — level and learning style, provider endpoint/model/key, the
   prompt log, the algorithm receipt, folder paths and key-store name.

### 2.2 Behavioural rules that must be visible

- No score, percentage, grade, level bar, streak, rank or comparison anywhere.
- No summary screen or report at the end of a session.
- No nagging, guilt or withheld weakness.
- A hint caps the card at Nearly; the cap is stated as a fact.
- Wrong cards return once in the same session, plainly marked as returning.
- Progress only counts improvement when early attempts were wrong.
- Familiarity never appears as progress.
- A broken pack is named, refused and skipped.
- Import is all-or-nothing and names the bad item and field.
- A missing provider is plain, never a startup blocker.
- The page never shows the key, never builds a prompt, never calls a provider.

## 3. Simulation contract

The canonical simulation (`simulate.mjs`) must demonstrate, against the real
app with a temporary data directory:

1. The Polish starter pack loads; a broken pack is reported without blocking.
2. A plan returns cards, groups and reasons, with the default algorithm name.
3. A cloze answer is judged per blank and evidence rows are written.
4. A wrong answer is queued for return at the end.
5. A hint caps a correct answer at Nearly.
6. A correction row resolves the displayed evidence without editing the original.
7. Progress after a wrong-then-right history names the card as now doable.
8. A malformed import is refused with an item index; a valid batch lands.
9. A prompt can be prepared and displayed before any provider exists; sending
   without a key fails in plain words and changes nothing.
10. No response body contains the provider key.

The pre-implementation simulation mirrors the same flow with hardcoded state
and no app, so the two can be compared for drift.

## 4. Technical design

### 4.1 Runtime shape

```
browser (React client components)
   |  fetch JSON to /api/*
   v
Next.js route handlers on loopback (Node runtime)
   |-- src/lib/core       pure card, evidence, algorithm, progress logic
   |-- src/lib/packs      pack discovery, validation, adoption
   |-- src/lib/storage    atomic JSON files and append-only JSONL
   |-- src/lib/provider   server-only key store, prompt builder, HTTP client
   v
v1/data/*                 learner data, local only
v1/packs/*                plain-file packs, local only
provider endpoint         only when the learner approves a prepared prompt
```

No client component imports a provider module or the key store. Provider
modules are only imported by route handlers.

### 4.2 Card shape

```ts
CardPart =
  | { type: "text"; text: string; role?: "translation" | "note" }
  | { type: "code"; text: string; language?: string }
  | { type: "speak"; text: string; lang?: string; label?: string }
  | { type: "media"; src: string; alt?: string; mime?: string }
  | { type: "blank"; id: string; hint?: string; width?: "short" | "medium" | "long" }

AnswerDef = {
  mode: "cloze" | "picks" | "type" | "hear_type"
  blanks?: { id: string; expected: string[]; options?: string[] }[]
  options?: string[]
  correct?: string[]
  expected?: string[]
  judge?: "loose" | "exact"
  caseSensitive?: boolean
  working?: { label: string; expected: string }
}

Card = {
  id: string
  topics: string[]
  tags: string[]
  summary: string
  prompt: CardPart[]
  answer: CardPart[]
  answerDef: AnswerDef
  hints?: string[]
  fullLine?: string
  origin: {
    kind: "pack" | "learner" | "generated" | "imported"
    note: string
    packName?: string
    packVersion?: string
    requestId?: string
  }
  retired?: boolean
  createdAt: string
  editedFrom?: string
}
```

The core never interprets a topic, a tag or a language. It lays parts out in
order and hosts the surface the pack declared.

### 4.3 Pack shape

A pack is a folder:

```
pack.json       name, version, author, description, coreRange, topics, topicLabels
cards.json      { "cards": [ ...card sources... ] }
prompts.json    generation and tutor prompt text, with app-owned slots
```

`pack.json.name` is the provenance half of identity. Version moves but identity
does not include it. The core validates every pack; a broken pack produces an
error record and is skipped before it can touch learner data.

Pack cards are adopted into `data/cards.json` on boot and on rescan. Identity is
`sha256(packName + canonicalCardContent)`; unchanged cards survive reinstall.
The learner's copy keeps its topics, tags and summaries if the pack folder is
removed.

### 4.4 Evidence shape

```ts
EvidenceRow = {
  id: string
  cardId: string
  attemptId: string
  region: string | null       // blank id, or null for a whole-card answer
  outcome: "again" | "got_it" | "nearly" | "no" | "unjudged"
  timeMs: number
  seenBefore: number
  at: string
  kind: "answer" | "correction"
  supersedes?: string         // original row id for a correction
}
```

Rows are appended, never edited. A correction row carries the same attempt and
region and points at the row it disagrees with. Reads resolve to the latest row
for an attempt/region. A card attempt's outcome is the worst resolved outcome
among its rows. `seenBefore` counts prior attempts for the card.

### 4.5 Selection algorithm

`defaultAlgorithm` returns an ordered list plus display groups and reasons. It
scores unseen cards highest, recent wrong cards next, then stale correct cards,
then strength checks. It round-robins by topic so one topic cannot fill the
session. The app sanity-checks the result: enough cards, unique cards, at least
two topics when available, and at least one unseen card when one exists. A
failure falls back immediately to `simpleAlgorithm` (unseen, oldest, then
wrong). The plan response names which ran; settings keeps the count.

The offer is 20 by default. Two or more recent sessions stopped below half of
the offer lower it by five to a floor of five; completing a session raises it
back toward 20. No session screen shows this machinery.

### 4.6 API contracts

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness and version |
| GET | `/api/packs` | installed packs, errors, folder |
| POST | `/api/packs/rescan` | rescan and adopt |
| GET | `/api/plan` | plan, groups, reasons, offer, algorithm |
| POST | `/api/answer` | judge answers, write evidence, return reveal |
| POST | `/api/evidence/correction` | append a correction row |
| GET | `/api/evidence?cardId=` | card and raw evidence |
| GET | `/api/progress` | read-time progress, next work, strengths |
| POST | `/api/session/end` | append session ended fact |
| GET | `/api/cards` | learner cards |
| POST | `/api/cards` | create a manual card |
| PATCH | `/api/cards/:id` | edit: new card, retire old |
| DELETE | `/api/cards/:id` | delete card and its evidence |
| POST | `/api/cards/import` | all-or-nothing import |
| GET | `/api/settings` | profile, provider status, receipts, paths |
| PATCH | `/api/settings` | level, learning style, endpoint, model |
| POST | `/api/provider/key` | store key server-side |
| DELETE | `/api/provider/key` | remove key |
| POST | `/api/provider/test` | test provider in plain words |
| POST | `/api/provider/prepare` | build prompt, return id and exact text |
| POST | `/api/provider/generate` | send a prepared generation request |
| POST | `/api/provider/hint` | build and send a tutor hint |
| GET | `/api/prompts` | local prompt log |

All error responses are `{ error: string, detail?: string }` with plain words.
No API returns key material. The prompt preview endpoint returns the exact
prompt, which is the point; the prompt log is local.

### 4.7 Provider design

- OpenAI-compatible `POST {base}/chat/completions`, model, messages, 60s timeout.
- Endpoint and model are read at call time, never at module import.
- Key precedence: `FLASHCARDS_PROVIDER_KEY`, then the OS key-store adapter,
  then the 0600 file fallback. Settings reports which store is in use.
- On WSL only, a loopback provider URL is swapped for the host's default
  gateway at call time (falling back to the resolv-file nameserver), because
  WSL's loopback is not the host's loopback.
- Prompt preparation stores a short-lived in-memory request. The browser sends
  the request id back; the server sends the stored prompt. A restart simply
  asks the learner to prepare again.
- Generation asks for full correct lines, translations and a target word, and
  asks for varied nouns, verbs and sentence shapes. The server validates every
  line, derives the blank by replacing the target in the full line, and refuses
  the whole batch if any line is malformed. Exact repeats are stopped by card
  identity, not by batch memory.
- The tutor prompt sends card text and outcome categories only. It never sends
  the learner's typed answer.

### 4.8 Local judging

`loose` normalisation: Unicode NFC, then NFD with combining marks removed and
the stroked letters folded to plain ones (`ł`→`l`, `ø`→`o`, `đ`→`d`, `ß`→`ss`,
`æ`→`ae`, `œ`→`oe`), trim, collapse whitespace, lower-case (unless
`caseSensitive`), strip surrounding punctuation. `exact` for code, with no
folding. An exact match is Got it. A small edit distance (1–2 depending on
length) is Nearly. A wrong answer is Again when the card was seen before and No
when it was not. A used hint converts Got it to Nearly. With no expected
answers the row is unjudged and the learner chooses.

### 4.9 Storage

Atomic JSON writes under `FLASHCARDS_DATA_DIR` (default `v1/data`):
`cards.json`, `settings.json`, `pack-status.json`; append-only JSONL:
`evidence.jsonl`, `sessions.jsonl`, `prompt-log.jsonl`. A mutex serialises
writes inside the single process. No database, no migrations, no server.

### 4.10 Folders and environment

- `FLASHCARDS_PACKS_DIR` — default `packs` relative to app root.
- `FLASHCARDS_DATA_DIR` — default `data` relative to app root.
- `FLASHCARDS_HOST` — default `127.0.0.1`; `0.0.0.0` for the WSL guest-IP case.
- `FLASHCARDS_PROVIDER_URL`, `FLASHCARDS_PROVIDER_MODEL`,
  `FLASHCARDS_PROVIDER_KEY` — read at call time.
- The provider key is never placed in a `NEXT_PUBLIC_` variable.

### 4.11 Screen arrangement

A fixed left sidebar is the only navigation: Study, Library, Progress,
Settings. No top nav. Every screen follows one pattern — a header plus tabs or
disclosures, with compact spacing — so secondary material is one click away
and the page itself does not grow without limitation; lists scroll in place.

- **Study** keeps the centered card. The plan is a compact header row (offer,
  Rebuild, Start); reasons and the tutor banner fold into disclosures. During
  review the plan is hidden.
- **Library** has three tabs: Packs, Add cards, Generate. Add cards hides
  manual entry and import behind buttons; Generate holds prepare, exact
  preview, copy and send.
- **Progress** has Overview and Every card tabs. The evidence drawer is a
  right-hand panel; corrections live inside it.
- **Settings** has Profile, Provider, Prompts and Data tabs; only the active
  tab renders.

The arrangement is a presentation decision only: routes, API contracts, and
the answer/judge/evidence behavior are unchanged. Source:
`wayfinder/anything-learning-spec/tickets/ui-shell.md`.

## 5. Non-goals

- Accounts, hosted services, sharing, mobile.
- Provider answer judging, automatic tutor interruptions.
- Attachment uploads, pack editor, external pack library.
- Retention rules, evidence decay, fine-tuning, real Laya.
- Any score, streak, notification or comparison.

## 6. Acceptance

- Unit tests cover the pure core and the provider prompt boundary.
- Typecheck, lint, production build pass.
- `simulate.mjs` demonstrates all ten simulation-contract points.
- A learner can complete the whole loop in a browser with no provider.
- A learner can prepare and send a generation prompt only after explicitly
  approving the exact text; with no key, the send fails in plain words.
- No browser bundle imports the key store or provider client.

## 7. Reconcile (2026-10-19)

The build landed, the review sub-agent compared this contract with the code
(`.reports/2026-10-19-drift-v1-prototype.md`), and every finding was fixed:
`docs/drift.md` D-1…D-9, all resolved the same day. The canonical simulation is
`v1/scripts/simulate.mjs`; its latest run passed all ten points, including a
two-blank card writing two rows under one attempt and fourteen response bodies
swept for key material; it now isolates itself from any local `.env` provider.
240 unit tests pass with coverage above the thresholds (95.86 / 87.14 / 96.34 /
97.32 percent); typecheck, lint and the production build are clean. Where the
paper design and the working app now differ on purpose — storage split, screen
folders, generate living in the Library, progress wording — the IMPL reconcile
section records it.

Live review added three fixes the same day, recorded as D-10 and D-11 plus the
diacritics decision: the WSL host address now comes from the default route
instead of the nameserver (D-10); writing cards drops the cached boot state so
a saved card appears at once (D-11); loose judging folds diacritics
(`diacritics-not-required.md`, §4.8). The learner's own provider was exercised
end to end: test, generation (two valid cards), and a tutor hint, all answered
by the model on the learner's machine. The manual browser walkthrough is in
progress with the learner.
