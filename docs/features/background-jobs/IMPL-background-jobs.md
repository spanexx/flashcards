# IMPL: Background jobs

Status: Implemented under delegated authority, 2026-10-23
Date: 2026-10-23
Pack: `background-jobs`
PRD-TRD: `PRD-TRD-background-jobs.md`

## Phase 0: storage seam

- Add `"jobs"` to `STORE_NAMES`.
- Bump the IndexedDB open version from 2 to 3.
- Add `onblocked` handling with a clear close-other-tabs message.
- Keep the `Store` interface unchanged. The memory adapter already covers the
  new store.

Verification: `npm run typecheck`; existing store/repository tests still pass.

## Phase 1: provider result reason and split

- Add required `reason: "timeout" | "unreachable" | "http" | "empty"` to the
  failure arm of `ProviderCallResult`.
- Set the reason in `callProvider` for timeout, network, HTTP and empty replies.
- Add `ProviderTimeoutError`.
- Split `generatePrepared(requestId)` into:
  - `generatePrepared` (take + delegate)
  - `generateFromPrepared(prepared)` (the existing body)
- Throw `ProviderTimeoutError` when `callProvider` returns `reason: "timeout"`,
  after the prompt log and before parse/import.
- Keep the synchronous route's success/error shape.

Verification: provider client tests and provider flow tests.

## Phase 2: job store, views and focus links

Create `v1/src/lib/browser/jobs.ts` with:

- Types: `JobKind`, `JobStatus`, `JobResult`, `JobView`, `BrowserJob`,
  `GenerationJobPayload`, `ImportJobPayload`.
- Constants: `MAX_GENERATION_ATTEMPTS = 4`, `MAX_IMPORT_ATTEMPTS = 1`,
  `RETRY_DELAY_MS = 60_000`, `FINISHED_LIMIT = 20`.
- Store helpers:
  - `readJobs()` (internal to `jobs.ts`, not exported; tests use the public
    actions and views)
  - `readJobViews()`
  - `writeJob()`
  - `deleteJob()`
  - `recoverInterruptedJobs()`
  - `pruneFinishedJobs()`
- Enqueue helpers:
  - `enqueueGenerationJob(prepared)`
  - `enqueueImportJob(input)`
- Actions:
  - `retryJob(id)`
  - `dismissJob(id)`
  - `interruptJobs(reason)`
- External store:
  - `subscribeJobs(listener)`
  - `getJobsSnapshot()`
  - `getServerJobsSnapshot()`
  - `onJobFinished(listener)`
- Link helper:
  - `jobResultHref(result)` and/or `jobHref(job)`.

Rules:

- Views never include `payload`.
- Generation stores the full taken `PreparedRequest`.
- Import stores `text`, `target`, `namePolicy`, `source`.
- `title` and `detail` are built at enqueue.
- `retryJob` deletes the failed job and creates a fresh queued job with a new id,
  the same payload, `attempts: 0` and the same `maxAttempts`.
- `dismissJob` only deletes finished jobs.
- `interruptJobs` marks every active job failed with the given sentence.
- `recoverInterruptedJobs` marks running jobs failed; queued/waiting stay.
- `pruneFinishedJobs` keeps the newest 20 finished and deletes older ones.
- View refresh uses a sequence guard so an older read cannot overwrite a newer
  one. Notify subscribers only after the snapshot is set.

Verification: `tests/browser-jobs.test.ts` for the pure store/actions.

## Phase 3: runner

Add to `jobs.ts`:

- `createJobRunner()` with `wake(): Promise<void>` and `stop(): void`.
- `startJobRunner()` page singleton and `stopJobRunner()` test/cleanup seam.
- `resetJobRuntimeForTests()` to clear the singleton, views and listeners.
- `runNextReadyJob()`:
  - pick the oldest ready job by `createdAt` / `nextAttemptAt`
  - re-read the job; skip if no longer ready
  - set Running, `attempts += 1`
  - dispatch to `runGenerationJob` / `runImportJob`
  - success -> Succeeded + result + finishedAt
  - timeout -> Waiting + nextAttemptAt, or Failed at max attempts
  - other error -> Failed + details + finishedAt
- Waiting jobs schedule one `setTimeout` for the remaining delay; the timer
  calls wake. No polling. The queue also schedules the timer when no job is
  ready, so a future retry resumes after a boot with no other work.
- `wake` uses a running guard and a rerun flag; `wake` returns the current idle
  promise so tests can await it.
- Register the wake callback for enqueue.
- Start:
  1. recover interrupted jobs
  2. prune finished jobs
  3. refresh views
  4. wake
- `runImportJob` throws a small `ImportJobError` carrying `details` from the
  bundle issues.
- Before any write, the runner re-reads the job. A job marked failed by restore
  is skipped.

Verification: `tests/background-jobs.test.ts` with fake timers and stubbed
`fetch`; run the whole suite at the end.

## Phase 4: routes

- Refactor the target parsing in `/api/packs/import` and `/api/jobs` into one
  helper.
- Add `POST /api/jobs`:
  - generation: `takePrepared`, kind check, `enqueueGenerationJob`
  - import: validate text, target and name policy, `enqueueImportJob`
  - return `{ job }`
- Add `GET /api/jobs` returning `{ jobs: readJobViews() }`.
- Add `POST /api/jobs/:id/retry`.
- Add `DELETE /api/jobs/:id`.
- In `/api/backup/restore`, validate the backup first. Only a valid backup calls
  `interruptJobs("The library was restored.")` before `restoreBackup`; pass the
  interrupt through `restoreBackup`'s `beforeApply` callback. A malformed backup
  leaves active jobs alone.
- Keep `/api/provider/generate` and `/api/packs/import`.

Verification: `tests/browser-router.test.ts` additions.

## Phase 5: boot and dock

- Add `v1/src/app/JobsBoot.tsx`:
  - `"use client"`, effect calls `startJobRunner()`, returns null.
- Add `v1/src/app/JobsDock.tsx`:
  - `useSyncExternalStore` over job views.
  - fixed Jobs control, active count, oldest active line.
  - panel with rows and actions.
  - toast for newly finished jobs, auto-dismiss after 8 seconds.
  - View uses `next/link` with `prefetch={false}` and dispatches
    `flashcards:library-focus`.
  - Dismiss calls `dismissJob`; Try again calls `retryJob`.
  - countdown timer only while a waiting job exists.
- Add both to `layout.tsx`.
- Add CSS for `.jobs-fab`, `.jobs-live`, `.jobs-panel`, `.job-row`,
  `.job-state`, `.job-actions`, `.job-toast`, and responsive rules.
- Keep the panel accessible: `aria-expanded`, `aria-controls`, `role="dialog"`,
  `aria-label="Jobs"`, focusable buttons, `role="status"` on the notice.

Verification: typecheck, lint, built-output test.

## Phase 6: CreatePanel

- `sendNow`: `POST /api/jobs` with `{ kind: "generation", requestId }`; clear
  prepared; notice; release busy.
- `importNow`: `POST /api/jobs` with `{ kind: "import", text, target,
  namePolicy: "strict", source: "file" }`; clear text; notice.
- `importChatAnswer`: `POST /api/jobs` with `source: "chat"` and
  `namePolicy: "auto-suffix"`; clear answer; notice.
- Remove the now-unused `GeneratedAnswer` / `ImportedAnswer` response handling
  for these paths. Keep `finish` and `onCreated` for Write.
- Keep prepare and the editable Chat prompt unchanged.
- Keep the old synchronous route callable by tests, but the screen no longer
  calls it.

Verification: `simulate-create-flow` and `simulate-creation-control` still pass
(the synchronous routes are intact); typecheck.

## Phase 7: Library focus

- `LibraryClient` subscribes to `onJobFinished`; on a successful job, `refresh()`.
- Add a `flashcards:library-focus` listener that sets `packsFocus` /
  `cardFocus` and the correct tab.
- On mount, read `?pack=` and `?deck=`:
  - `deck`: Cards tab + `cardFocus`
  - `pack`: Packs tab + `packsFocus`
- Keep the existing `?card=` behavior.
- Do not refresh on a failed job.

Verification: typecheck, built-output test, external lane.

## Phase 8: tests

- `tests/browser-jobs.test.ts` (store and actions)
- `tests/background-jobs.test.ts` (runner, fake timers), including a boot with a
  future waiting retry and no other work
- `tests/browser-router.test.ts` (routes), including a refused backup that
  leaves a running job alone
- `tests/provider-client.test.ts` (reasons)
- `tests/provider-flow.test.ts` (existing synchronous path; the runner timeout
  test proves the `ProviderTimeoutError` path before parse/import)
- `tests/simulate-background-jobs.test.ts` (post-implementation rehearsal and
  built chunk strings)
- Update any existing test that assumes Create's Generate/Import calls the
  synchronous route. Use the synchronous route tests as compatibility coverage;
  the new simulation uses `/api/jobs`.
- Result: 39 files / 426 tests passed after the build. No dedicated provider-flow
  timeout test was added; the runner test covers that path.

Verification: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.
Run the full suite once at the end. The build must precede the simulation tests.

## Phase 9: external lane

- Build the static app in the worktree.
- Start a static server on a free port and a fake provider on another.
- Use Edge via CDP with a fresh profile.
- Set the provider profile/key, run a generation, leave Create through the app's
  own Settings link (a hard navigation would interrupt the job), assert the Jobs
  live state and completion notice, click View and find the new pack.
- Run an import, assert the completion notice and the pack.
- Run a bad import and assert one failed row with field details.
- Start a provider call that hangs, reload the page and assert the interrupted
  sentence.
- Clean up all background processes and temp profiles.
- Write the lane report in the PRD/IMPL or the goal ledger.
- Result: passed 2026-10-23 with `background-jobs-lane.mjs`; the fake provider's
  slow marker is `"zzz"` because `"slow"` appears in a prompt example.

## Phase 10: docs and landing

Status: docs updated; commit and landing are the final step of this run.

- Update `docs/features/background-jobs/` with the post-sim notes. Done:
  `simulate-post.md` records the canonical rehearsal and deviations.
- Update `.reports/goal-overhaul.md` with verification, failures and next pack.
- Commit in the worktree with the `spanexx` identity.
- Review the diff, then land on `main` with a clean squash and push.
- Do not amend. Do not merge a malformed branch. Stage by path.
- Keep LF endings and no secrets.

## Run order

```text
npm run typecheck
npm run lint
npm run build
npm test
```

The build must run before the simulation tests that read `out/`.
