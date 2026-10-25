# PRD-TRD: Learner delight

**Slug:** learner-delight
**Status:** Approved by the learner, 2026-10-25
**Date:** 2026-10-25
**Contract:** `GRILL-learner-delight.txt`

## Why

The card is the centre of the app, and the learner said it does not catch the
eye: it is not animated, not colourful, not delightful. The app also has no
in-app theme control and no sound at all. Both palettes already exist, but the
screen always follows the operating system, so a dark desktop can never see the
light one.

This pack makes the card feel alive without turning study into a game. It adds
a real theme switch, optional sound, and restrained motion and colour. It moves
no rule: no score, streak, timer, rank or comparison; the calm column stays.

## What this pack promises

1. **A real theme switch.** Light, Dark and System. System is the default and
   follows the operating system live. The choice is remembered on this device.
2. **Two controls, one truth.** A three-way Appearance control in Settings >
   Profile, and a sun/moon button in the sidebar for a one-click flip. Both
   write the same preference, and a change is visible before the next paint.
3. **Optional sound, off by default.** One toggle in Settings > Profile. When
   on, four short synthesized cues play: correct, nearly, missed, and a
   completed session. Nothing plays on load, and no audio files ship.
4. **A card that moves.** Each card enters with a short rise, the answer badge
   and block arrive with the reveal, and the current pip pops. Motion is short
   and never blocks a click.
5. **Colour with meaning.** The card carries a soft accent aura, the reveal
   washes toward the outcome colour (green, amber, red), and done pips fill
   with the accent. Colour never carries meaning alone; the outcome word stays.
6. **A gentle finish.** The finished session shows a small, staggered sparkle
   and a warm headline. No confetti storm and no score.
7. **Reduced motion respected.** Under `prefers-reduced-motion: reduce` every
   new animation and transition is removed; the app still works unchanged.
8. **Nothing behavioural moves.** The judge, outcomes, evidence rows, queue,
   one-return rule, teaching layer rules, hints, tutor, offer, session ending,
   backup and offline cache are untouched.

## Scenarios

### Scenario 1: First visit follows the system

**Given** no saved theme preference
**When** the app opens on a light operating system
**Then** the page paints the light palette before the first frame, Settings >
Profile shows `System` selected, and the sidebar offers a moon button.

**Given** the same first visit on a dark operating system
**Then** the page paints the dark palette before the first frame and the
sidebar offers a sun button.

### Scenario 2: Choosing Light or Dark

**Given** the Appearance control in Settings
**When** the learner chooses `Light`
**Then** the page turns light at once, the choice survives a reload, and the
OS preference no longer overrides it. Choosing `Dark` behaves the same way.

### Scenario 3: The system changes while System is chosen

**Given** `System` is selected
**When** the operating system switches between light and dark
**Then** the page follows without a reload, and the sidebar button shows the
other icon.

### Scenario 4: The sidebar button

**Given** any palette
**When** the learner presses the sun/moon button
**Then** the palette flips to the other explicit choice in one click, the
Settings control updates to match, and the focus ring stays visible.

### Scenario 5: Sound on

**Given** sound is off
**When** the learner turns on `Sound effects` in Settings
**Then** the choice survives a reload, and the next answer plays one short cue:
a rising pair for a correct answer, one mid note for a nearly answer, and one
soft low note for a miss. Completing the session plays a three-note finish.

### Scenario 6: Sound off and on load

**Given** sound is off, or has never been on
**When** any screen opens, a card is answered, or a session is completed
**Then** no audio is created or played, and no browser prompt appears.

### Scenario 7: The card entrance and reveal

**Given** a running session
**When** a card appears
**Then** the card rises a few pixels into place in under 300ms. When the answer
is revealed, the badge and answer block arrive together and the card picks up a
soft wash in the outcome colour.

### Scenario 8: Pips

**Given** a card at position `n`
**When** the learner moves to the next card
**Then** the current pip pops once, the previous pip stays filled in the accent
colour, and the row still wraps rather than scrolling sideways on a phone.

### Scenario 9: The finish

**Given** the last card
**When** the learner presses `Finish`
**Then** the finished screen shows `This session is finished.`, the calm line,
`Study again`, `Look at progress`, and a small sparkle that fades. It shows no
score, percentage, streak or rank.

### Scenario 10: Reduced motion

**Given** `prefers-reduced-motion: reduce`
**When** any screen opens or an answer is revealed
**Then** no entrance, pop, wash transition or sparkle animates; content appears
immediately and all controls work.

## Technical Design

### Theme

- `v1/src/lib/client/theme.ts` (new): `ThemeChoice` (`system` | `light` |
  `dark`), `THEME_KEY` (`flashcards.theme`), `readTheme(storage?)`,
  `resolveTheme(choice, systemDark)`, `applyTheme(choice, root?, systemDark?)`,
  `themeLabel(choice)`, and `THEME_BOOT` (the pre-paint script string).
- `v1/src/app/layout.tsx` renders `THEME_BOOT` in `<head>` so the resolved
  palette is on `<html>` before paint. `data-theme` is always the resolved
  `light` or `dark`, never `system`; the preference stays in storage.
- `v1/src/app/ThemeBoot.tsx` (new, client) re-applies on mount, listens for the
  OS media change while the choice is `system`, and listens for `storage` so a
  second tab follows.
- `v1/src/app/ThemeButton.tsx` (new, client) is the sidebar sun/moon button. It
  renders both icons and lets CSS show one from `:root[data-theme]`, so the
  server HTML and the client agree. Pressing it flips to the explicit opposite
  palette.
- `v1/src/app/settings/ThemeSwitch.tsx` and `SoundSwitch.tsx` (new, client) are
  the Settings controls, grouped in an `Appearance` card at the top of Profile.
  They start neutral and read storage after mount, so hydration stays clean.
- `globals.css`: `:root` keeps the light tokens; `:root[data-theme="dark"]`
  carries the dark tokens. The old `@media (prefers-color-scheme: dark)` block
  is replaced because the boot script resolves the choice. `color-scheme` is
  set per palette so native controls match.

### Sound

- `v1/src/lib/client/sound.ts` (new): `SoundCue` (`got_it` | `nearly` |
  `missed` | `finish`), `SOUND_KEY` (`flashcards.sound`, `on`/`off`),
  `isSoundOn(storage?)`, `setSoundOn(on, storage?)`, `cueForOutcome(outcome)`,
  `cueNotes(cue)` and `playCue(cue, { enabled? })`.
- `cueNotes` is a pure table of frequency, start offset, length and gain. The
  player builds a lazy `AudioContext` on first use, resumes it if suspended,
  and uses short oscillator notes with a soft attack and release. Failure or a
  missing Web Audio implementation is silent, never an error dialog.
- `StudyClient` calls `playCue(cueForOutcome(response.cardOutcome))` after a
  judged answer, and `playCue("finish")` when a session completes normally.
  A stopped session plays nothing.

### Motion and colour

- New tokens: `--aura` and outcome glows derived from `--accent`, `--good`,
  `--near` and `--miss`.
- `body` gains a very soft two-colour radial wash that works in both palettes.
- `.study-card` gains a thin accent edge, an entrance animation and a
  `data-outcome` attribute set from the judged outcome; the matching selector
  tints the border and shadow after the answer.
- `.study-result` arrives with the existing reveal and a wash that fades out
  below the answer.
- `.study-pip.now` pops once per card; `.study-pip.done` fills with the accent.
- `.btn` and `.option` gain short hover, press and transition polish; the
  primary button carries a soft accent shadow.
- The finished screen renders a small, aria-hidden sparkle group; CSS staggers
  and fades it.
- One `@media (prefers-reduced-motion: reduce)` block at the end removes all
  new animations and transitions.

### Files

- New: `v1/src/lib/client/theme.ts`, `v1/src/lib/client/sound.ts`,
  `v1/src/app/ThemeBoot.tsx`, `v1/src/app/ThemeButton.tsx`,
  `v1/src/app/settings/ThemeSwitch.tsx`, `v1/src/app/settings/SoundSwitch.tsx`,
  `v1/tests/theme.test.ts`, `v1/tests/sound.test.ts`.
- Changed: `v1/src/app/layout.tsx`, `v1/src/app/Nav.tsx`,
  `v1/src/app/settings/SettingsClient.tsx`, `v1/src/app/StudyClient.tsx`,
  `v1/src/app/study/StudyCard.tsx`, `v1/src/app/globals.css`.

### Simulation Contract

The browser pass must drive the real app and show each item:

1. First visit on a dark OS paints dark before paint; the sidebar shows the sun.
2. Choose Light; the page turns light; reload keeps it; choose Dark; reload
   keeps it; the sidebar icon matches.
3. Choose System; flip the OS preference (or emulate it) and watch the page
   follow without a reload.
4. The sidebar button flips palette in one click and Settings follows.
5. Turn sound on; answer correct, nearly and missed; complete a session. Cues
   are created (verified through a stubbed `AudioContext`), and the preference
   survives a reload.
6. With sound off, no `AudioContext` is constructed on load or on answers.
7. A card enters, the reveal washes in the outcome colour, and the current pip
   pops; the pips wrap on a 390px viewport.
8. The finished screen shows the calm headline, both actions and the sparkle,
   with no score, percentage or streak.
9. With `prefers-reduced-motion: reduce`, no new animation runs.
10. No behavioural change: answer judging, evidence flags, one-return rule and
    teaching layer behaviour are identical to the base branch.
