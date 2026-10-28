# IMPL: Ask the tutor for a progress summary

**Slug:** progress-summary
**Status:** Implemented; awaiting learner visual check
**Date:** 2026-10-27
**Origin:** `wayfinder/anything-learning-spec/tickets/progress-summary.md` (resolved GRILL, learner voice note 2026-10-26)

## What this pack builds

Progress has a third tab, **Summary**. Opening it sends nothing. The learner
presses **Ask the tutor for a summary**, sees the exact compact text that will
leave the machine, and chooses **Send and ask** or **Cancel**.

The payload is derived only:

- counts of improvements, faster cards, next topics and strengths;
- up to eight topic labels with card counts;
- up to eight most-recent outcomes, one per topic, as app categories;
- the saved level and learning style.

It never carries a card front/back, an answer, typed working, a card summary, or
any learner words. The payload is capped by construction at eight topic rows and
eight outcome rows.

- The provider's answer is shown in the tab with `white-space: pre-wrap` and is
  never written to the library, a job, or a new evidence row.
- The request is held for ten minutes and used once. A completed request cannot
  be replayed.
- A provider failure clears the preview and shows the reason; the learner can
  make a fresh request. The prepared request is not silently reused.
- No provider means the button is disabled and the tab says a provider is needed;
  Overview and Every card keep working.
- Every attempted send writes a prompt-log row with kind `summary`, the
  endpoint/model, the request id and the exact preview text. The provider's
  answer is not logged.
- Consent is per request. There is no remembered "always send" switch.

## Files

- `v1/src/lib/core/progress-summary.ts` — the compact payload builder and its
  caps. Topic labels come from the progress view's already-derived labels.
- `v1/src/lib/provider/summary.ts` — system instruction and the exact preview
  text.
- `v1/src/lib/browser/summary.ts` — provider check, held preview, one-shot send
  and prompt log.
- `v1/src/lib/browser/router.ts` — `POST /api/progress/summary` and
  `POST /api/progress/summary/send`.
- `v1/src/app/progress/ProgressClient.tsx` — Summary tab, preview, send, answer,
  error and provider note.
- `v1/src/app/globals.css` — summary panel, preview and answer styles.
- `v1/src/lib/shared/types.ts` — prompt-log kind `summary`.
- `v1/tests/progress-summary.test.ts`,
  `v1/tests/progress-summary-browser.test.ts`.

## Edge cases

- No reviewed cards: the payload is still a valid zero-count summary. The ticket
  did not ask for a gate on evidence, so the tab does not invent one.
- More than eight topics or outcomes: the payload keeps the highest-card topics
  and the newest outcome per topic, and drops the rest.
- Evidence is corrected after a preview is built: the preview and sent payload
  are the snapshot the learner approved, not a silent rebuild.
- Provider answer is blank: the tab shows an error and stores nothing.
- Page leaves and returns: the answer is gone because it only lived in component
  state; the next visit starts from the opt-in button.

## Out of scope

- No automatic summary on load or at session end.
- No stored summary or new evidence row.
- No learner/card text in the payload.
- No plan-setting or judging advice.
- No remembered consent.

## Verification

- [x] `node node_modules/vitest/vitest.mjs run tests/progress-summary.test.ts`
  — 4 passed.
- [x] `node node_modules/vitest/vitest.mjs run tests/progress-summary-browser.test.ts`
  — 3 passed: compact payload with no card text, provider-absent refusal, and
  one-shot answer plus exact prompt log.
- [x] `npm run typecheck` — clean.
- [x] `npm run lint` — clean.
- [x] `npm run build` — succeeds (PWA check passed).
- [ ] Live provider proof in the browser. The GitHub-hosted browser origin
  returned 401/no CORS header in this environment, so the browser route is
  proven with the fake provider in tests. The learner's own provider is the live
  leg.
