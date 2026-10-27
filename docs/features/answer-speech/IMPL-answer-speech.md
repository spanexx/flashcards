# IMPL: Answer Speech

**Slug:** answer-speech
**Status:** Complete (2026-10-27)
**Date:** 2026-10-27

## Phase Plan

**Before Phase 1:** no new external dependency, so no `opensrc` run is needed.
The worktree is `feature/answer-speech`, created with
`agent-worktree feature answer-speech`. The worktree needed its own
`npm ci` because its `node_modules` is on the Linux filesystem, not a symlink
into the Windows checkout.

### Phase 1: the text builder — ✅ Complete 2026-10-27

**Build:**
- `v1/src/lib/client/answer-speech.ts` — `CODE_ANSWER_LINE` and
  `answerSpeech(parts, options)` per PRD-TRD `API Contracts`.
- `v1/tests/answer-speech.test.ts` — the pure helper, no DOM.

**Verify:**
- [x] `node node_modules/vitest/vitest.mjs run tests/answer-speech.test.ts`
      — 12 tests: order, translation, language, code + teaching, code alone,
      text before and after code, several code parts, media and blanks skipped,
      punctuation spacing, empty answer.

**Blocked by:** nothing.

### Phase 2: the device check — ✅ Complete 2026-10-27

**Build:**
- `v1/src/lib/client/speech.ts` — export `speechSupported()`, false during SSR
  and when synthesis is absent; `speak` now reuses it.
- `v1/tests/answer-speech.test.ts` — the node path reports false and `speak`
  does not throw.

**Verify:**
- [x] The targeted test file passes (12/12).

**Blocked by:** Phase 1.

### Phase 3: the control — ✅ Complete 2026-10-27

**Build:**
- `v1/src/app/study/StudyCard.tsx` — `answerLang` prop; compute the spoken line;
  after mount show "Hear the answer" under the answer when supported and the
  text is not empty; pressing calls `speak(text, lang)`.
- `v1/src/app/StudyClient.tsx` — pass `answerLang={packLanguage}`.
- `v1/src/app/globals.css` — `.study-hear` spacing only.

**Verify:**
- [x] `npx tsc --noEmit` — clean.
- [x] `npx eslint src tests` — clean (the whole-tree lint was slow over the
      worktree; the changed files were linted directly and the full build's
      type pass was clean).
- [x] `npm run build` — succeeds; PWA check passed (74 files, 72 precache).

**Blocked by:** Phases 1–2.

### Phase 4: the whole suite — ✅ Complete 2026-10-27

**Verify:**
- [x] `node node_modules/vitest/vitest.mjs run` — 61 files, 690 tests passed
      (the ordering fix added two cases).
- [x] The existing speech, sound and teaching tests still pass.

**Blocked by:** Phase 3.

### Phase 5: the post-impl simulation and drift — ✅ Complete 2026-10-27

**Build:**
- `docs/features/answer-speech/simulate.mjs` — runs the real helper through the
  project's TypeScript, checks the six PRD scenarios, the no-voice guard and the
  existing controls.

**Verify:**
- [x] `node docs/features/answer-speech/simulate.mjs` — all 6 scenarios pass.
- [x] The built chunk carries "Hear the answer" and "This answer is code"
      (`v1/out/_next/static/chunks/3dil4go4_yab2.js`).
- [x] The built page serves from `out/`: `http://localhost:8137/` and
      `http://172.25.126.9:8137/` both returned 200 from Windows; the server was
      stopped and the port closed after the check.
- [x] A sub-agent compared PRD-TRD, IMPL and code; its one real gap (the code
      explanation was always appended last) was fixed, and the sim was extended
      to cover both orders.

**Blocked by:** Phase 4.

## Phase Dependencies

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. The UI depends on the pure
helper and the device check; no phase can be reordered safely.

## Test Strategy

Pure tests in `v1/tests/answer-speech.test.ts` (node environment, matching
`v1/vitest.config.ts`). The browser-only path is proven by the post-impl sim and
the built chunk, because the suite has no DOM environment.

## Dependency Analysis (opensrc)

None. No new package.

## Rollout

No migration and no stored data. The control appears on the next build; removing
it is a one-file revert.

## Risk Notes

- A browser with no voice hides the control; that is intended, and the teaching
  layer already uses the same check.
- `speechSynthesis` can be present but have no voice for the pack language. The
  device then uses its default voice; the app does not pretend otherwise.
- The answer may be empty (media-only); the control must not render.
