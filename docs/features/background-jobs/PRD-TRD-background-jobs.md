# PRD-TRD: Background jobs

Status: Implemented under delegated authority, 2026-10-23
Date: 2026-10-23
Pack: `background-jobs`
GRILL: `GRILL-background-jobs.txt`

## 1. Why

Generate and Import currently hold the Create screen and the learner's attention.
A provider timeout ends the attempt after 60 seconds with one sentence; there is
no retry, no global state and no notice if the learner moves to another screen.
A pasted Chat answer has the same problem even though it uses the same importer.

The learner asked for generation and import to keep working while they use the
rest of the app, to see the state, and to be told when the work is finished. They
also asked the provider timeout to be retried three times, one minute apart.

## 2. What this pack promises

1. **Start and leave.** Pressing Send or Check and import enqueues a job and
   releases Create immediately. The learner can open Packs, Cards, Study,
   Progress or Settings while the job runs.
2. **See the state.** A global Jobs control is present on every screen. It shows
   the active job, its state and a short countdown when a retry is waiting. The
   panel lists queued, running, waiting and recent finished jobs.
3. **Be told.** A successful or failed job produces a quiet notice. A successful
   job has a View link to the affected pack or to the filtered Cards tab.
4. **Retry only the timeout.** A provider timeout is retried after 60 seconds,
   up to three times after the first try (four tries total). A rejected key, an
   unreachable address, an HTTP error, an empty answer, an invalid batch or an
   invalid import is not retried.
5. **Keep the library whole.** Import remains strict and atomic. A failed job
   writes nothing. Duplicate protection is unchanged.
6. **Be honest across a reload.** A running provider call becomes Failed with
   "The page was reloaded before this job finished." Queued jobs and future
   retries continue. A waiting retry keeps its stored minute.
7. **Keep the prompt local and out of the backup.** The job store owns the
   prepared prompt or import text it needs; the learner-facing job view never
   includes that text; backups do not include jobs.

## 3. User-facing behaviour

### 3.1 Starting generation

`Create -> Generate -> Prepare the prompt -> Send it`

- Prepare remains a separate step. The learner still sees the exact prompt and
  presses Send.
- Send calls `POST /api/jobs` with `{ kind: "generation", requestId }`.
- The router takes the prepared request once. If it has expired or was already
  used, the call fails with the existing "That prepared prompt has expired"
  sentence and no job is created.
- The prepared request is stored with the job so retries and a reload can use it.
- The Create panel clears the prepared prompt and shows a short notice:
  "Generation started. You can keep working."
- The Create panel is not busy while the provider answers. Its Send button is
  released after the enqueue response.

### 3.2 Starting an import

`Create -> Import -> Check and import`

- The file or pasted JSON, the chosen target and the name policy are enqueued
  with `POST /api/jobs` and `{ kind: "import", ... }`.
- The target shape and name policy are validated by the route before the job is
  stored. A bad target fails the request; it does not create a job.
- A valid job clears the import text and shows: "Import started. You can keep
  working."
- `Create -> Chat -> Check and save` uses the same import job with
  `namePolicy: "auto-suffix"` and `source: "chat"`. The Chat text is cleared when
  the job is queued.

### 3.3 The Jobs control

- A fixed control sits at the bottom-right on every screen. It is only visible
  when there is at least one job in the store.
- It shows the oldest active job's title and a live sentence:
  - Queued: "Waiting for the current job to finish."
  - Running generation: "Asking the provider..."
  - Running import: "Checking the file..."
  - Waiting: "The provider took too long to answer. Retrying in 45s (try 2 of 4)."
  - Succeeded: "Saved 5 generated cards in “Starter”." /
    "Imported 12 cards into “Starter”."
  - Failed: the stored failure sentence.
- The control opens a panel with the same rows, a count of active jobs and a
  Close button. The panel is not modal and does not block the page.
- Each row has a state word: Queued, Working, Waiting, Done or Failed.
- A finished row has Dismiss. A failed row has Try again. A successful row with
  a result has View.
- The last 20 finished jobs are kept. Older finished jobs are pruned. Active jobs
  are never pruned.
- The panel and notice are visual only; every state change is also written to the
  store, so a reload rebuilds the panel.

### 3.4 Completion notice

- When a job reaches Succeeded or Failed, the UI shows a notice above the Jobs
  control for eight seconds.
- Success: "Generation finished" / "Import finished" plus the saved count and
  destination. A View link is present.
- Failure: "A job failed", the plain failure sentence and a Dismiss button. The
  failed row remains in the panel with Try again.
- A notice does not fire for a job that was already finished when the page
  mounted. History is visible in the panel, not re-announced.

### 3.5 Retry

- A timeout is the provider client returning
  `{ ok: false, reason: "timeout", message: "The provider took too long to answer." }`.
- The runner increments `attempts` when a try starts. After a timeout:
  - If `attempts < maxAttempts`, the job becomes Waiting, keeps the sentence,
    and stores `nextAttemptAt = now + 60_000`.
  - If `attempts >= maxAttempts`, the job becomes Failed and stores:
    "The provider took too long to answer. It was tried 4 times, one minute
    apart. Press Try again."
- `maxAttempts` is 4 for generation and 1 for import. It is stored on the job.
- A waiting job does not block a newer queued job. The runner picks the oldest
  ready job: queued work at `createdAt`, waiting work at `nextAttemptAt`.
- A manual Try again deletes the failed job and creates a fresh queued job with
  the same payload, `attempts: 0` and the same `maxAttempts`. It starts a fresh
  four-try budget.
- Try again is available for any failed job, including a non-retryable failure.
  The learner chooses; the runner never retries those automatically.

### 3.6 Reload and interrupted work

- On boot, every job with `status: "running"` becomes Failed:
  "The page was reloaded before this job finished."
- Queued jobs resume.
- Waiting jobs keep `nextAttemptAt`. If it is in the past, the retry starts on
  boot. If it is in the future, the runner waits for the remaining time.
- No automatic retry is started for an interrupted running job.

### 3.7 Restore and clear

- `POST /api/backup/restore` validates the backup first. Only a valid backup
  calls `interruptJobs("The library was restored.")` before the restore is
  applied. A malformed backup leaves active jobs alone.
- Every active job becomes Failed with that sentence and `finishedAt`.
- Finished job history stays until dismissed or pruned. The jobs store is not
  cleared by `clearLibrary` or by a restore.
- A job already writing at the moment of restore is not forcibly aborted; the
  next job read sees the failed state and stops before starting new work. This
  small in-flight edge is named, not hidden.

## 4. Job model

```ts
type JobKind = "generation" | "import";
type JobStatus = "queued" | "running" | "waiting" | "succeeded" | "failed";

interface JobResult {
  kind: "pack" | "deck" | "cards";
  packName: string;
  deckId: string | null;
  count: number;
  decksAdded: number;
  duplicates: number;
}

interface JobView {
  id: string;
  kind: JobKind;
  status: JobStatus;
  title: string;          // "Generating cards" / "Importing cards"
  detail: string;         // "5 cards · New pack" / "12 cards · Starter → Basics"
  targetKind: "pack" | "deck" | "cards";
  packName: string | null;
  deckId: string | null;
  count: number | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  errorDetails: string[];
  result: JobResult | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

interface BrowserJob extends JobView {
  payload:
    | { kind: "generation"; prepared: PreparedRequest }
    | {
        kind: "import";
        text: string;
        target: ImportTarget;
        namePolicy: "strict" | "auto-suffix";
        source: "file" | "chat";
      };
}
```

- `JobView` is the only shape returned to the UI and to `/api/jobs`.
- `payload` is internal to the runner and is never included in a view, a toast,
  a log line or the backup.
- `count`, `packName` and `deckId` are copied from the prepared request or the
  import target for display and linking.
- The generation job's `requestId` for card origin remains
  `prepared.id`, not the job id. A retry reuses the stored prepared request.

## 5. Storage

- Add `"jobs"` to `STORE_NAMES` in `v1/src/lib/browser/store.ts`.
- Bump IndexedDB from version 2 to 3. The new store uses `keyPath: "id"`.
- Add `request.onblocked` to the open request with a clear error: other open
  tabs must close before the library can update. The external lane uses a fresh
  profile.
- Jobs are not part of `exportBackup`; `restoreBackup` does not import them.
- `clearLibrary` does not clear jobs. `interruptJobs` owns that boundary.
- The job store is local to the browser. No job data is sent anywhere except the
  provider prompt that already has an explicit approval step.

## 6. Routes

### `POST /api/jobs`

Generation body:
```json
{ "kind": "generation", "requestId": "..." }
```
Import body:
```json
{
  "kind": "import",
  "text": "...",
  "target": { "kind": "cards", "packName": "starter", "deckId": "basics" },
  "namePolicy": "strict",
  "source": "file"
}
```
Returns `{ job: JobView }`.

- Generation takes the prepared request once. A missing/expired request fails
  with the existing prepared-prompt sentence. A non-generation prepared request
  is refused.
- Import parses the target with the same helper as `/api/packs/import`. It
  validates the name policy before storing. An empty text is refused.
- The route only enqueues. It does not run the job.

### `GET /api/jobs`

Returns `{ jobs: JobView[] }`, newest first. No payload.

### `POST /api/jobs/:id/retry`

Deletes the failed job and creates a new queued job with the same payload and a
fresh attempt budget. Returns `{ job: JobView }`. Refuses a job that is not
failed.

### `DELETE /api/jobs/:id`

Dismisses a finished job. Refuses an active job with "A running job cannot be
dismissed."

### Kept routes

- `POST /api/provider/prepare` is unchanged.
- `POST /api/provider/generate` stays as the synchronous route. It takes a
  prepared id and calls the same `generateFromPrepared` function. Existing tests
  and callers keep working.
- `POST /api/packs/import` stays for existing callers and tests.

## 7. Provider boundary

- The failure arm of `ProviderCallResult` gains a required reason:
  `"timeout" | "unreachable" | "http" | "empty"`.
- The existing 60-second timeout returns
  `{ ok: false, reason: "timeout", message: "The provider took too long to answer." }`.
- Add `ProviderTimeoutError` (name `ProviderTimeoutError`, reason `"timeout"`).
- Split generation:
  - `generatePrepared(requestId)` takes the prepared request and calls the new
    `generateFromPrepared(prepared)`.
  - `generateFromPrepared(prepared)` contains the existing provider call, prompt
    log, parse, style check and atomic import.
  - On a timeout result, it throws `ProviderTimeoutError` after logging the
    prompt. No parse or import has happened.
- The synchronous route keeps the same external result/error shape.

## 8. Runner

`v1/src/lib/browser/jobs.ts` owns the job store, views, runner and subscriptions.

- `startJobRunner()` creates one page-level runner, recovers interrupted jobs,
  prunes finished history, refreshes views and wakes the queue.
- Enqueue calls a registered wake callback if the runner exists.
- The runner processes one ready job at a time. A running guard prevents two
  loops in one tab. A wake during a loop sets a rerun flag.
- `runGenerationJob(job)` calls `generateFromPrepared(job.payload.prepared)` and
  converts the result to `JobResult`.
- `runImportJob(job)` calls `importBundle(text, target, { namePolicy })` and
  converts the result. It throws an `ImportJobError` with per-field details when
  the bundle is refused.
- On success: status Succeeded, result, no error, `finishedAt`, notify.
- On `ProviderTimeoutError`: retry or terminal as in section 3.5.
- On any other error: Failed immediately, store the plain message and details,
  `finishedAt`, notify.
- Before running a job, re-read it. If it is no longer queued/waiting (for
  example, restore marked it failed), skip it.
- Waiting jobs schedule a `setTimeout` for the remaining time. The timer calls
  wake. The runner does not poll.
- The runner never touches the library outside `generateFromPrepared` and
  `importBundle`.

The runner is page-scoped. It is not a service worker, Web Worker, server queue
or multi-tab leader. A closed tab cannot finish a provider call.

## 9. UI

### `v1/src/app/JobsBoot.tsx`

Client component mounted in `layout.tsx` next to `AutoSaveBoot`. Calls
`startJobRunner()` once in an effect. Renders nothing.

### `v1/src/app/JobsDock.tsx`

Client component mounted in `layout.tsx` after the shell. Uses
`useSyncExternalStore` over the in-memory `JobView[]` snapshot. Renders:

- A fixed Jobs control with active count and the oldest active state.
- A panel with rows, actions and a Close button.
- A toast area for newly finished jobs, with auto-dismiss after eight seconds.
- View links use `next/link` with `prefetch={false}` and
  `/library?pack=...&deck=...`.
- On View, also dispatch a `flashcards:library-focus` custom event with
  `{ packName, deckId }` so the already-mounted Library can focus without a
  remount.

### `LibraryClient`

- Subscribe to `onJobFinished`. On a successful job, call `refresh()`.
- Listen for `flashcards:library-focus` and set `packsFocus` or `cardFocus` and
  the correct tab.
- On mount, read `?pack=` and `?deck=`:
  - `deck` present: Cards tab with `cardFocus`.
  - `pack` only: Packs tab with `packsFocus`.
- Keep the existing Create/Write navigation for local writes.

### `CreatePanel`

- `sendNow` posts to `/api/jobs` and clears the prepared prompt.
- `importNow` posts to `/api/jobs` and clears the import text.
- `importChatAnswer` posts to `/api/jobs` with `source: "chat"` and
  `namePolicy: "auto-suffix"` and clears the answer.
- `busy` only covers the enqueue call. The old long `GeneratedAnswer` and
  `ImportedAnswer` handling for these three paths is removed. Write paths keep
  their existing `finish` navigation.
- The notices say the job started and that the learner can keep working.

### CSS

Add job control, panel, row, countdown, notice and responsive styles to
`globals.css` using the existing variables. No new dependency.

## 10. Data flow

```
Create -> prepare -> /api/jobs -> job store (queued) -> wake runner
runner -> generateFromPrepared -> provider -> parse -> importBundle -> library
      -> job store (succeeded, result) -> views -> dock + toast -> Library refresh
runner -> timeout -> job store (waiting, nextAttemptAt) -> 60s timer -> wake
```

Import follows the same path without the provider call.

## 11. Failure handling

| Failure | Job result | Automatic retry? |
|---|---|---|
| Provider timeout | Waiting, then Failed after 4 tries | Yes, 60s apart |
| No provider/key | Failed with the existing sentence | No |
| Network unreachable | Failed | No |
| HTTP 401/403/404/429/5xx | Failed with the existing sentence | No |
| Empty provider reply | Failed | No |
| Invalid generated batch | Failed whole; nothing saved | No |
| Invalid import | Failed with field details; nothing saved | No |
| Storage/write failure | Failed, plain message | No |
| Reload during running | Failed as interrupted | No |
| Restore during active | Failed as interrupted | No |
| Missing/expired prepared prompt | Enqueue request fails; no job | No |

## 12. Tests

### Unit / integration

- `tests/browser-jobs.test.ts`
  - enqueue generation/import stores a view without payload
  - the stored job keeps its payload; `readJobViews` omits it
  - generation has `maxAttempts: 4`; import has `1`
  - retry deletes the failed job and creates a fresh queued job
  - dismiss refuses active jobs
  - interrupt marks active jobs failed
  - recover marks running jobs failed
  - prune keeps 20 finished jobs and never prunes active ones
  - focus link is correct for pack/deck/cards
- `tests/provider-client.test.ts`
  - timeout result has `reason: "timeout"`
  - HTTP/network/empty results have their own reasons
- `tests/provider-flow.test.ts`
  - the synchronous `generatePrepared` path still works; the runner timeout test
    below proves the `ProviderTimeoutError` path before parse/import
- `tests/browser-router.test.ts`
  - `POST /api/jobs` enqueues generation/import
  - `GET /api/jobs` returns views without payload
  - retry/dismiss routes
  - a bad target/empty import is refused before a job exists
  - a refused backup leaves a running job alone
- `tests/background-jobs.test.ts` (runner)
  - success path writes a pack and a Succeeded view
  - timeout -> Waiting with a 60s `nextAttemptAt`
  - three retries then Failed with the four-try sentence (fake timers)
  - non-timeout failure is not retried
  - invalid import fails once with details and writes nothing
  - running job recovered as interrupted on a fresh runner
  - a future waiting retry resumes after boot with no other work
  - restore interrupt stops a waiting job
- `tests/simulate-background-jobs.test.ts` (post-implementation rehearsal)
  - walks the five scenarios through the real router and runner
  - reads built chunks for the Jobs control strings after `npm run build`

### External lane

- Static build on WSL, Edge via CDP, fake provider.
- Normal generation: start, leave Create through the app's own Settings link,
  see the completion notice, open View, find the new pack.
- Import: start, see completion, find the pack.
- Bad import: see one failed row with field details.
- Reload: start a provider call that hangs, reload, see the interrupted sentence.
- The built-output test and fake-timer tests cover the four-try timeout path; the
  external lane does not wait four minutes.
- Result: passed 2026-10-23 with `background-jobs-lane.mjs`. A hard page
  navigation is not a valid "keep working" proof; the lane uses the app's
  client-side Settings link.

### Post-implementation rehearsal

- `simulate-post.md` records the canonical rehearsal and what differs from the
  pre-implementation scenarios.
- The canonical script is `v1/tests/simulate-background-jobs.test.ts`.
- Result: 39 test files / 426 tests passed after `npm run build`; typecheck,
  lint and build passed. The external lane passed separately.
- Two implementation corrections were found by the rehearsal and are part of
  the shipped code: a future waiting retry now schedules its timer even when no
  other job is ready, and restore validates the backup before interrupting jobs.

## 13. Migration and compatibility

- Existing IndexedDB v2 data opens at v3; the only change is an additive store.
- Other tabs on v2 can block the upgrade; the app names that instead of hanging.
- `/api/provider/generate`, `/api/packs/import`, `/api/provider/prepare` and the
  Library/Create UI remain compatible.
- No new runtime dependency.
- No change to the card schema, pack schema, backup schema or AUTHORING_SKILL
  version.

## 14. Non-goals

- Service worker, Web Worker, OS background work or resume after tab close.
- Multi-tab leader election or a cross-tab queue.
- Cancelling an in-flight provider request.
- Background tutor hints, study-plan redesign or PWA/deploy.
- A provider connection test in Settings.
- Job history in the backup.
- Changing the provider timeout from 60 seconds.

## 15. Simulation contract

The post-implementation simulation must show these five outcomes:

1. Start a generation, leave Create, see the live Jobs state, then the
   completion notice and View result.
2. A timeout enters Waiting with a 60s countdown; retry attempts increment; the
   fourth timeout becomes Failed with the four-try sentence; Try again creates a
   fresh job.
3. A valid import runs as a job, writes atomically and produces a completion
   notice.
4. An invalid import fails once with field details, writes nothing and offers
   Try again.
5. A reload marks a running job interrupted; a queued job or future retry still
   runs.

The external lane proved 1, 3, 4 and 5 in a real browser on 2026-10-23. The
canonical post-implementation rehearsal is
`v1/tests/simulate-background-jobs.test.ts`; it walks all five outcomes through
the real router, store and runner and checks the built client strings. The
fake-timer runner test proves the four-try budget without waiting four minutes.

## 16. Risks and named edges

- **Page scope:** a closed or reloaded tab cannot finish a provider call. The app
  says so instead of showing a false running state.
- **Multi-tab:** two tabs can share the jobs store. The pack does not elect a
  leader; one-tab use is the supported path.
- **Restore in-flight:** a valid restore marks active jobs failed after
  validation and before it starts. A refused backup leaves jobs alone. A write
  already underway is not forcibly aborted.
- **Prompt storage:** the prepared prompt and import text are stored in the
  local jobs database for retry/reload. They are excluded from views and
  backups, but they are still local learner content.
- **IndexedDB upgrade:** another open v2 tab can block the v3 upgrade. The app
  gives a clear close-the-other-tab message.
