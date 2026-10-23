# Post-implementation simulation: Study experience

Status: Passed, 2026-10-23
Pack: `study-experience`
Canonical script: `v1/tests/simulate-study-experience.test.ts`
External lane: `study-experience-lane.mjs` (temporary, not committed)

## What this rehearsal proves

The pre-implementation simulation was a design walk-through of five scenarios.
This post-implementation rehearsal uses the real browser router and memory
store, then reads the built client after `npm run build`. A separate Edge lane
walks the same promises through the static export.

1. **Scope.** Two imported packs and the seeded Polish pack appear in Study.
   Choosing one pack rebuilds the plan for that pack only. The canonical test
   checks the same filter through `/api/plan?pack=...`.
2. **No answer leak.** Before Answer, the listening card shows only the neutral
   mode label, one "Play the line" control and "Listen, then type what you
   hear." The spoken line, summary and translation are absent from the page.
3. **Tutor.** With the tutor on, the first wrong answer asks for one hint
   automatically. The lane uses a fake provider and sees "Tutor hint"; the
   canonical test uses the pack fallback and sees "Pack hint".
4. **Reveal.** The answer and translation appear only after submission. The
   translation sits on its own line. The outcome is a chip and the correction
   buttons are behind "Was this fair?".
5. **Phone.** At 390px the study card fits the viewport with no horizontal
   scroll, and the play control fills the card width.

The built client is checked for "Play the line", "Was this fair?", "Study
from", "Tutor hint" and "Pack hint".

## What differs from the pre-implementation simulation

- The pre-simulation assumed the default plan would contain only the two seeded
  packs. The app also seeds the Polish starter pack, so the external lane
  asserts "from the whole library" and then narrows to the travel pack.
- The plan line now uses the actual number of planned cards, not the requested
  offer. A one-card scope reads "1 card from ...", even though the offer field
  still holds 20.
- The pre-simulation did not decide how the tutor source is shown. The
  implementation labels every hint block "Tutor hint" or "Pack hint" and keeps
  the provider failure message in plain words.
- The pre-simulation described a reveal fade. The implementation adds a short
  fade and disables it under `prefers-reduced-motion`.
- The answer/translation run-together in the screenshots was a rendering bug:
  separate text parts had no joining space. `Side` now adds the gap and gives
  translation parts their own block.

## Results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm test`: 41 files / 432 tests passed.
- External Edge lane: passed pack scope, no pre-answer leak, one listen control,
  automatic tutor hint, separate answer/translation lines and phone width.

## Named limits

The lane uses a fake provider, so a real provider key is still unverified. The
lane does not test every pack shape; it uses a cloze card and a listening card.
The canonical test covers the pack-hint fallback; the external lane covers the
tutor path.
