# IMPL: Learner delight

**Slug:** learner-delight
**Status:** Implemented, not committed
**Date:** 2026-10-25
**Contract:** `PRD-TRD-learner-delight.md`
**Base:** `feature/teaching-layers` (the merged teaching-layer line)

## Order and gates

Each phase ends with its named test or a typecheck. The full gate is
`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` from
`v1/`, then a browser pass at 1440x900 and 390x844 in both palettes.

This pack follows the lean precedent of `study-tab-redesign`: the design was
approved through the GRILL choices, and the proof is a real-browser pass over
the Simulation Contract. No separate HTML pre-sim ships for a visual-only pack.

## Phase 1: Theme helpers (TDD)

**Files:** `v1/src/lib/client/theme.ts` (new), `v1/tests/theme.test.ts` (new)

- `ThemeChoice`, `THEME_KEY`, `readTheme(storage?)`, `resolveTheme(choice,
  systemDark)`, `themeLabel(choice)`.
- Unknown or missing storage reads as `system`. A blocked storage call reads as
  `system` and never throws.
- `resolveTheme("system", true)` is `dark`; the explicit choices ignore the
  system flag.
- `applyTheme(choice, root, systemDark)` writes `data-theme` and `color-scheme`.

Verification: `npx vitest run tests/theme.test.ts`.

## Phase 2: The switch before paint

**Files:** `v1/src/app/ThemeBoot.tsx` (new), `v1/src/app/ThemeButton.tsx` (new),
`v1/src/app/settings/ThemeSwitch.tsx` (new), `v1/src/app/layout.tsx`,
`v1/src/app/Nav.tsx`, `v1/src/app/settings/SettingsClient.tsx`,
`v1/src/app/globals.css`

- Render `THEME_BOOT` in `<head>` so `<html data-theme>` is resolved before the
  first paint.
- Replace the media-only dark token block with `:root[data-theme="dark"]`; set
  `color-scheme` per palette.
- `ThemeBoot` re-applies after mount, follows the OS while the choice is
  `system`, and follows `storage` events.
- `ThemeButton` renders both icons; CSS shows the one that matches
  `:root[data-theme]`. Pressing it flips to the explicit opposite palette.
- `ThemeSwitch` is the three-way Appearance control in Settings > Profile.
- Sidebar gains a `sidebar-top` row so the brand and the button share a line on
  desktop and the phone bar.

Verification: typecheck plus a browser pass of Scenarios 1-4.

## Phase 3: Sound helpers (TDD)

**Files:** `v1/src/lib/client/sound.ts` (new), `v1/tests/sound.test.ts` (new)

- `SoundCue`, `SOUND_KEY`, `isSoundOn(storage?)`, `setSoundOn(on, storage?)`,
  `cueForOutcome(outcome)`, `cueNotes(cue)`, `playCue(cue, { enabled? })`.
- `cueForOutcome` maps `got_it`, `nearly`, `again` and `no`; `unjudged` returns
  null.
- `cueNotes` is pure: every cue has notes, all times are finite and ordered,
  and `finish` rises through three notes.
- `playCue` with `enabled: false` never touches `AudioContext`. A missing Web
  Audio implementation is silent.

Verification: `npx vitest run tests/sound.test.ts`.

## Phase 4: Wire the sound and the toggle

**Files:** `v1/src/app/settings/SoundSwitch.tsx` (new),
`v1/src/app/settings/SettingsClient.tsx`, `v1/src/app/StudyClient.tsx`

- `SoundSwitch` is the Settings toggle; it reads storage after mount and writes
  on change.
- `StudyClient` plays the outcome cue after a judged answer and the finish cue
  when a session completes; a stopped session plays nothing.

Verification: typecheck plus the stubbed-audio browser check (Contract 5-6).

## Phase 5: Motion and colour

**Files:** `v1/src/app/StudyClient.tsx`, `v1/src/app/study/StudyCard.tsx`,
`v1/src/app/globals.css`

- Key the running card by entry id so the entrance runs once per card.
- Expose `data-outcome` on the card from the judged outcome.
- Add the aura, the card edge, the entrance, the reveal wash, the pip pop, the
  button/option polish and the finish sparkle.
- Add one reduced-motion block at the end that removes every new animation and
  transition.

Verification: typecheck plus the browser pass of Scenarios 7-10 at 1440x900 and
390x844.

## Phase 6: Gate and record

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` from `v1/`.
- Browser pass over the full Simulation Contract in both palettes.
- `npm run check:drift` and `npm run check:drift:staged` before any commit.
- Record the results below.

## Results

All four gates passed from `v1/` on 2026-10-25:

- `npm run typecheck` — clean.
- `npm run lint` — clean after the two Settings controls moved to
  `useSyncExternalStore` (the `react-hooks/set-state-in-effect` rule rejected
  the first read-after-mount version).
- `npm test` — 56 files, 603 tests, all passing. `theme.test.ts` (9) and
  `sound.test.ts` (8) are new.
- `npm run build` — the static export and both PWA checks pass, built with
  webpack (`npx next build --webpack`) because the shared `node_modules` is a
  symlink and Turbopack refuses to resolve outside the worktree root. The
  shipped `npm run build` script is unchanged.

### Browser pass (Contract 1-10)

The real static export ran on `http://localhost:4174`, reached from Windows on
both `localhost` and the WSL address.

1. **First visit, dark OS.** No saved choice, OS dark: `<html data-theme="dark">`,
   body `rgb(25, 24, 22)`, sun icon `display: block`, moon `none`. The boot
   script was present in `<head>`, and the document already carried the dark
   palette when the page was queryable.
2. **Choose Light, then Dark.** Light: `data-theme="light"`, body
   `rgb(247, 246, 243)`, moon shown, `flashcards.theme="light"`; reload kept
   it over a dark OS. Dark: clicked in Settings, `data-theme="dark"`,
   `flashcards.theme="dark"`, sun shown; reload kept it.
3. **System follows the OS live.** With `flashcards.theme="system"` and an
   injected `matchMedia` stub, the page painted light, then
   `window.__setScheme(true)` flipped `data-theme` to dark and the icon to sun
   with no reload and no storage write. (The stub was a test harness in the
   page, not app code.)
4. **Sidebar button.** One click on the sun flipped the dark page to explicit
   light (`flashcards.theme="light"`); Settings then showed Light pressed.
   Keyboard focus on the button showed the 3px accent focus ring.
5. **Sound on.** The toggle wrote `flashcards.sound="on"` and survived a
   reload. With a recording `AudioContext` stub, an answer with a cue produced
   the expected notes: got_it `659.25, 783.99`; missed `329.63, 261.63`;
   finishing the session `523.25, 659.25, 783.99` at 0.02/0.14/0.26s. One
   context was created and reused.
6. **Sound off.** With no `flashcards.sound` key, a judged answer left the
   `AudioContext` count at 0. Nothing was constructed on load.
7. **Card motion.** The running card carried `data-outcome`, computed
   `animation-name: card-enter`; the reveal animated `study-reveal` with the
   outcome wash at opacity 1 and a tinted border; the current pip animated
   `pip-pop`. At a 390px viewport the pip row is `flex-wrap: wrap` with 0
   horizontal overflow; a 45-pip probe wrapped to multiple rows (17px tall)
   inside the 358px column. The card and controls fit the 390px column.
8. **Finish.** The done screen showed `This session is finished.`, the calm
   lede, `Study again`, `Look at progress`, and five sparkle dots animating
   `sparkle-fade` with staggered delays. No percentage, streak or rank text.
9. **Reduced motion.** Not emulated end to end: the in-app browser cannot
   change CSS media features, and a `matchMedia` stub only affects JavaScript.
   The compiled stylesheet carries one
   `@media (prefers-reduced-motion: reduce)` block that sets `transition: none`
   for the buttons, options, pips, card wash, theme and sound controls, and
   `animation: none` for `card-enter`, `study-reveal`, `pip-pop` and
   `sparkle-fade`, plus `transform: none` on the hover lifts. The block was
   confirmed in the built CSS. A real OS-level pass is still owed.
10. **Nothing behavioural moved.** The judged outcomes were `no`, `got_it` and
    `again`; a wrong beginner card returned once (queue 5 to 6) and the return
    did not append a second time; the folded teaching layer bar still appeared
    after the answer. The 603-test suite covers the judge, evidence, queue,
    layer and session rules.

### Limits of the browser tool

The in-app browser stayed at one window size (733x740). The 1440x900 and
390x844 passes were run by loading the same export in same-origin iframes of
that size; the desktop capture was scaled to 50% to fit the screenshot. The
media queries, sidebar row, Appearance card and pip wrapping were measured
inside those frames. The nearly cue was verified through `cueForOutcome` and
`cueNotes` tests rather than by driving a hint-capped answer.

### Doc correction

The PRD first said "five short synthesized cues" while listing four. The code,
the GRILL and reality agree on four, so the PRD now says four.
