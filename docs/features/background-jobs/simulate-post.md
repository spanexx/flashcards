# Post-implementation simulation: Background jobs

Status: Passed, 2026-10-23
Pack: `background-jobs`
Canonical script: `v1/tests/simulate-background-jobs.test.ts`
External lane: `background-jobs-lane.mjs` (temporary, not committed)

## What this rehearsal proves

The pre-implementation simulation was a design walk-through of five promises.
This post-implementation rehearsal uses the real browser router, memory store and
job runner, then reads the built client chunks after `npm run build`.

1. **Continue.** A generation is enqueued and a second prompt can be prepared
   before the first batch runs. The external lane leaves Create through the app's
   own Settings link, not a hard page load.
2. **Timeout retry.** Fake timers take a provider timeout through four tries,
   one minute apart. The fourth try stores the terminal four-try sentence. A
   manual Try again creates a fresh job and succeeds.
3. **Import.** A valid pack import is queued, runs, writes atomically and stores
   a result with the pack name and card count.
4. **Bad import.** One invalid import fails once, writes nothing and keeps field
   details for the panel.
5. **Reload.** A running job is recovered as failed with
   "The page was reloaded before this job finished." The external lane starts a
   provider call that hangs, reloads the real page and sees that row.

The built client is checked for the queue, retry, completion and recovery words:
"Generation started. You can keep working.", "Generation finished",
"Waiting for the current job to finish.", "Try again", "one minute apart",
"Press Try again.", "The page was reloaded before this job finished." and
"What needs fixing".

## What differs from the pre-implementation simulation

- The pre-simulation treated "switch to another screen" as a navigation. The
  external lane proved that a hard `Page.navigate` reloads the page and correctly
  interrupts the running job. The real "keep working" path is a client-side link;
  the lane now clicks the app's Settings link.
- The pre-simulation did not name how a future waiting retry wakes after a boot.
  The runner now schedules its timer even when no job is ready.
- The pre-simulation said restore interrupts before `restoreBackup`. The
  implementation validates the backup first, then interrupts, then applies. A
  malformed backup leaves a running job alone.

## Results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm test`: 39 files / 426 tests passed.
- External Edge lane: passed all five scenarios without page errors.

## Named limits

The lane does not wait four real minutes for the timeout path; fake timers cover
it. The external lane does not test the IndexedDB upgrade from v2 to v3; the
storage tests cover the additive store and the blocked-upgrade message.
