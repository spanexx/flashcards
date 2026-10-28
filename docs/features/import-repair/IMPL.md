# IMPL: Repair a refused import

**Slug:** import-repair
**Status:** Implemented; awaiting learner visual check
**Date:** 2026-10-27
**Origin:** `wayfinder/anything-learning-spec/tickets/import-repair.md` (resolved GRILL, learner voice note 2026-10-26)

## What this pack builds

A deterministic import refusal can now be shown to the learner's provider for
one explicit repair. The action stays narrow: it is only on a failed import,
only runs after the learner sees the exact refused text and validator lines, and
only saves when the normal import validator accepts the provider's answer.

- A failed import row offers **Try again** and, when a provider is configured,
  **Fix with AI**. A failed generation still offers only **Try again**.
- **Fix with AI** first asks the browser route to build and hold the request. No
  provider call happens while the preview is open.
- The preview is a dialog that shows the refused text and every validator line
  in a `<pre>`. **Cancel** sends nothing; **Send and repair** sends once.
- The held request lasts ten minutes and is deleted when sent, cancelled, or
  replaced by expiry. Sending it twice is refused.
- While the provider runs, the job row reads **Working / Checking the file...**.
  On success the row becomes **Done** and carries `repairedByAI` in its result.
  A provider failure or a validator failure returns the row to **Failed** with
  the latest reason. Nothing is imported on either failure.
- Every attempted send writes a prompt-log row with kind `import-repair`, the
  endpoint/model, the request id and the exact preview text. The log stores no
  provider answer.
- If no provider is set up, the repair action is absent and the row says a
  provider is needed, with a link to Settings.
- Job actions are round, icon-only controls with `aria-label` and `title`:
  retry, fix, view, dismiss, and close. No text action labels.

## Files

- `v1/src/lib/provider/repair.ts` — repair system/user messages and the exact
  preview text. The refused file and validator lines are copied verbatim.
- `v1/src/lib/browser/import-repair.ts` — held preview, provider call, validator
  re-run, prompt log, and one-shot send.
- `v1/src/lib/browser/jobs.ts` — `importJobResult`, `readImportRepairInput`,
  `markImportRepairStarted`, `finishImportRepair`, `failImportRepair`, and the
  optional `repairedByAI` result flag.
- `v1/src/lib/browser/router.ts` — `POST /api/import-repair` and
  `POST /api/import-repair/send`.
- `v1/src/app/JobsDock.tsx` — provider readiness, failed-import action, preview
  dialog, round icons, provider note and repair error.
- `v1/src/app/globals.css` — round job controls, preview dialog and repair note.
- `v1/src/lib/shared/types.ts` — prompt-log kind and `repairedByAI`.
- `v1/tests/import-repair-prompt.test.ts`,
  `v1/tests/import-repair-browser.test.ts`.

## Edge cases

- Provider is configured after the Jobs panel opened: reopening the panel reads
  the provider again. If the action is shown from a stale state, preparing the
  request still re-checks the provider before holding it.
- The provider answers with invalid JSON or a valid file for the wrong target:
  the normal validator refuses it, the job stays failed, and no cards or packs
  are written.
- The provider call fails: the job returns to failed with the provider's message,
  and the original refused file is still there for another explicit attempt.
- The user cancels the preview: the held request is dropped and nothing is sent.
- The original import is dismissed or changes before send: the start step
  refuses, and no provider call is made.

## Out of scope

- No automatic repair on failure.
- No AI repair for failed generations.
- No change to the validator's rules.
- No saving of a partially valid or unvalidated provider answer.
- No system-prompt text in the preview; the data preview is the refused file
  plus the validator's words, matching the ticket.

## Verification

- [x] `node node_modules/vitest/vitest.mjs run tests/import-repair-prompt.test.ts`
  — 3 passed.
- [x] `node node_modules/vitest/vitest.mjs run tests/import-repair-browser.test.ts`
  — 4 passed: preview holds the exact text and sends nothing; a valid repair is
  saved and marked; an invalid repair writes nothing and stays failed; a request
  cannot be sent twice.
- [x] `npm run typecheck` — clean.
- [x] `npm run lint` — clean.
- [x] `npm run build` — succeeds (PWA check passed).
- [ ] Live provider proof in the browser. The GitHub-hosted browser origin
  returned 401/no CORS header in this environment, so the route and validator
  path are proven with the fake provider in tests. The learner's own configured
  provider is the live leg.
