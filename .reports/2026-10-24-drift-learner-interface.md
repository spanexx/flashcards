# Drift Review: learner-interface

**Date:** 2026-10-24
**Reviewer:** sub-agent audit, reconciled by the parent
**Feature pack:** `docs/features/learner-interface`
**Verdict:** **SHIP-READY WITH FOLLOW-UPS** (reconciled after fixes)
**Original verdict:** NOT SHIP-READY

## Reconciliation After Fixes

The findings below are the original review. The three hard gaps (D1-D3) were
fixed in the working tree and re-checked in the built app. The doc drifts
(D4-D11) were corrected in the feature docs. The original review is kept as
history, not as current status.

| Finding | Current result | Evidence |
|---|---|---|
| D1 Bare selects had no chevron | Fixed | Every affected select is wrapped in `.select-wrap`; the browser lane reports `bareSelects: 0`. |
| D2 Disabled fields looked active | Fixed | Disabled language fields report opacity `0.55` and `cursor: not-allowed`. |
| D3 Unknown language disappeared after a pack switch | Fixed | `sim-klingon` -> Polish -> `sim-klingon` keeps `__other` plus `klingon`. |
| D4 Impossible width verifier | Fixed | IMPL now checks the remaining width inside the 1420px cap. |
| D5 Old pre-answer listening contract still asserted | Fixed | Old GRILL, PRD and simulation text is marked superseded. |
| D6 Missing `simulate-post.md` | Fixed | The post-simulation now exists and records the real evidence. |
| D7 Missing `hintsUsed` in the PRD model | Fixed | PRD lists `answered`, `hintsUsed` and `fullStage`. |
| D8 Pack/card layout overclaimed | Fixed | GRILL says wide main column; IMPL says CSS-only pack/card treatment. |
| D9 Unknown value round-trip overclaimed | Fixed | IMPL says the stable lowercased value survives. |
| D10 Media verifier overclaimed playback | Fixed | IMPL checks the CSS containment rule, not a played media card. |
| D11 GRILL A7 overclaimed a router UI test | Fixed | A7 now names unit labels, built-output checks and the browser lane. |

Current verification (2026-10-24): **45 files / 467 tests pass**; typecheck,
lint and build pass. The build has `sw.js` version `9f4a1e76691fff7d`,
`check-pwa: passed (files: 53, precache entries: 51)`. The external Edge lanes
pass listening, reveal, full screen (API and forced CSS rejection), session end,
known/unknown pack switching, Library/Create rails, and 390px overflow checks.

## Summary

The audit found three learner-facing gaps and a set of docs that described
behavior the code did not have. The gaps were real:

- D1 left six native selects without the chevron the locked control contract
  requires.
- D2 left disabled fields visually indistinguishable from active fields.
- D3 lost an unlisted language if the learner switched from an unknown-language
  pack to a known-language pack and back.

All three are fixed. No hard gap remains. The post-simulation now describes the
shipped behavior and the old listening contract is marked historical, so the
next agent will not restore the pre-answer reveal.

## Findings

### Hard gaps

**D1. Bare selects had no chevron.**
`select.field` removes the native arrow, but only `.select-wrap::after` draws a
replacement. Bare selects in `CreationBriefFields.tsx`, `PlacementPicker.tsx`,
`CreatePanel.tsx` and `SettingsClient.tsx` had no wrapper. This contradicted
GRILL A5 and PRD Scenario 4.
**Fix:** wrapped every select in `.select-wrap`. `LanguageField` and the Study
selects already used it. The built browser lane now finds no bare selects.

**D2. Disabled form fields looked active.**
Only `.btn:disabled` had a style. Disabled language fields in the pack editor
kept the normal border, text and cursor.
**Fix:** added disabled styles for `input`, `select` and `textarea` at `.field`:
reduced opacity, quiet text, mixed background and `cursor: not-allowed`. The
browser lane reads `opacity: 0.55` and `cursor: not-allowed`.

**D3. Unknown language could disappear after switching parent packs.**
`LanguageField` computed `otherMode` only at mount and took its value from the
new active pack. An unknown value had no matching option, so switching from
`sim-klingon` to `polish-starter` and back could show an empty or wrong field.
This contradicted PRD Scenario 2.
**Fix:** derive `unknown`, `otherRequested` and `showOther` from the current
value and an explicit choice flag. The browser lane proves `sim-klingon` ->
`polish-starter` -> `sim-klingon` keeps `__other` plus `klingon`.

### Doc drift

**D4. Impossible width verifier.**
IMPL said a 1440px window would show “more than 1200px” of content. A 240px
sidebar plus 40px total padding leaves at most 1200px. The verifier now checks
the remaining width inside the 1420px content cap.

**D5. Old listening contract still asserted.**
`language-prompt-control` GRILL, PRD and `simulate-post.md` still stated that a
transcript was available before answering. That was the behavior this pack
deliberately reverses.
**Fix:** added a note to GRILL A11 and marked its locked bullet superseded; added
a note to PRD §3, marked item 4 and the StudyClient bullets superseded; marked
the old post-simulation historical.

**D6. Missing post-simulation.**
PRD §Simulation Contract and IMPL Phase 6 named `simulate-post.md`, but the file
did not exist.
**Fix:** created it with the real commands, server reachability checks, browser
steps, metric evidence, screenshot names, differences and limits.

**D7. `hintsUsed` missing from the data model.**
PRD said Study adds only `answered` and `fullStage`; the code also adds
`hintsUsed`.
**Fix:** added `hintsUsed` to the UI-only state line.

**D8. Pack/card layout overclaimed.**
IMPL claimed `PacksPanel` and `CardsPanel` received wider treatments; both files
are untouched. GRILL A3 said “multi-column pack/card layout”; the library has a
wide single-column pack list beside a rail.
**Fix:** IMPL says the treatment is CSS-only; GRILL says wide main column.

**D9. Unknown value round-trip overclaimed.**
IMPL said an unknown value round-trips “unchanged”. The route stores its stable
lowercased form.
**Fix:** wording now matches the lowercased stable value.

**D10. Media verifier overclaimed playback.**
The IMPL verifier implied a media card was played. No media fixture exists.
**Fix:** it now checks that the CSS contains image and video elements at up to
`62vh`, and the post-simulation names the missing fixture.

**D11. GRILL A7 overclaimed a router UI test.**
The listening proof is a unit label test plus the built-output test and the
browser lane; there is no router-rendered Study card test.
**Fix:** A7 now names unit labels, built-output checks and the browser lane.

### Thin coverage and limits

- No dedicated rendered test for `LanguageField` transitions; the browser lane
  covers known/unknown/known.
- No dedicated test for fullscreen or layout; both are browser-lane evidence.
- Hint-race behavior and Write deck/card rendering stay thin.
- No image or video fixture, so containment is proven by CSS and stage geometry.
- A real provider key is unverified.
- The CDP screenshots have a green cast from Edge capture; computed colors match
  the light theme.
- Learner visual sign-off was received on 2026-10-24; a local commit and merge
  are authorized. No pull request was requested.

## Residual Follow-Ups

None of the original hard gaps remain. The learner approved the screenshots on
2026-10-24 and asked for a local commit and merge, not a pull request. The named
coverage limits above remain. The expanded browser lane is temporary and is not
needed for `npm test`.
