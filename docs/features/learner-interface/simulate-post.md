# Post-implementation simulation: Learner interface

Status: Passed, 2026-10-24; learner visual sign-off approved 2026-10-24
Pack: `learner-interface`
Canonical checks: `v1/tests/language.test.ts`,
`v1/tests/study-experience.test.ts` and
`v1/tests/simulate-language-prompt-control.test.ts`
External lanes: `cdp-post.mjs`, `cdp-learner.mjs`, `cdp-mobile.mjs`
(temporary, not committed)

## What this rehearsal proves

The pre-implementation simulation was a design walk-through. This rehearsal runs
the real suite, reads the static export, and walks the built app in Edge through
the Chrome DevTools Protocol. It covers the seven PRD scenarios.

1. **Listening is dictation.** Before answering, a listening card shows the mode,
   the prompt, one "Play the line" control and "Play it as often as you need. The
   line appears after you answer." There is no transcript, summary, translation,
   "Show the text" control or reading-check warning. After answering, the Answer
   block shows the full line and its translation.
2. **The language picker is broad.** Write, Generate, Chat and the pack editor
   use the same control. Each picker has 75 options: the 73-name catalog, the
   appropriate empty choice and "Other language". A listed language closes as a
   name and saves its code. An outside language shows a text field and saves the
   typed value through the existing route.
3. **Unknown values survive a pack switch.** `sim-klingon` reopens as
   "Other language" with `klingon` in the text field; switching to the Polish
   pack shows `Polish`; switching back restores `klingon`. No value is silently
   replaced.
4. **The desktop uses its width.** At 1440x900 the 240px sidebar leaves a
   1096px study layout with a 766px card and a session rail. The library main
   column is 762.6px and its rail is 300.4px. Create uses a two-column form grid
   with a 286px side rail. Document scroll width stays inside the viewport.
5. **Full screen is one click.** A trusted click enters browser fullscreen,
   hides the sidebar and rail, and changes the control to "Exit full screen".
   Escape returns to the normal layout. The card state survives Next card while
   full screen remains on. Ending the session leaves full screen and clears
   `body.full-stage`.
6. **The CSS fallback works.** With `requestFullscreen` forced to reject, the
   same click produces `stage-full` and `body.full-stage` at 1416x808 with the
   Exit control, while `document.fullscreenElement` stays null. Escape returns
   to the normal stage.
7. **Phone stays usable.** At 390x844 Study, Library and Create have
   `scrollWidth=390`. Study stage and rail are 358px. The Create grid is 316px,
   both language selects are 316px, and "Other language" reveals its text input.

The built client checks "Full screen", "Exit full screen", "This session",
"End this session", "Play the line", the answer reveal and the language words,
and contains no "Show the text".

## What differs from the pre-implementation simulation

- The pre-simulation implied a multi-column pack/card grid. The shipped library
  uses a wide single-column pack list beside a real rail. The GRILL wording was
  corrected; the implementation matches the corrected target.
- The pre-simulation did not exercise the session hint count. The rail now reads
  `hintsUsed` for the whole session, not the current card.
- The pre-simulation did not cover every native select. Bare selects in the
  creation brief, placement picker, answer style and settings had no chevron;
  all are now inside `.select-wrap`.
- The pre-simulation did not show disabled fields. The final CSS gives disabled
  inputs and selects reduced opacity, quiet text and `cursor: not-allowed`.
- The pre-simulation did not switch between a known and unknown parent pack.
  `LanguageField` now derives its "Other language" state from the current value
  and an explicit choice flag, so an unlisted value stays visible.
- The pre-simulation assumed the listening note could stay inline. The final app
  shares `LISTEN_INSTRUCTION` from `v1/src/lib/client/study-view.ts` with the
  Study screen and its tests.
- Headless browser fullscreen renders at 800x600. The focused CSS fallback is
  measured separately at 1416x808, so the 1440 layout is not judged from the
  fullscreen screenshot alone.
- The first narrow capture collapsed the stage because media queries came before
  the base rules. The final CSS puts the phone rules after the base rules.
- The pre-simulation did not catch the invalid `/study` link in the library.
  "Study a pack" now points at `/`.

## Reproduce

Run the gates from the worktree:

```bash
cd v1
npm run typecheck
npm run lint
npm run build
npm test
```

Serve the static export from Windows so the WSL server is reachable. Do not put
the server start and a test in one command:

```powershell
Start-Process wsl.exe -ArgumentList '-d','Debian','--cd','/home/spanexx/.config/superpowers/worktrees/flashcards/feature-learner-interface/v1','--','python3','-m','http.server','4190','--bind','0.0.0.0','--directory','out' -PassThru
curl.exe -sS -o NUL -w "localhost=%{http_code}`n" --max-time 5 http://127.0.0.1:4190/
wsl -d Debian -- hostname -I
curl.exe -sS -o NUL -w "guest=%{http_code}`n" --max-time 5 http://<wsl-ip>:4190/
```

Run the browser lanes with Windows Node. Each lane uses a fresh Edge profile and
its own debugging port:

```powershell
node C:\Users\shuga\AppData\Local\Temp\opencode\cdp-post.mjs
node C:\Users\shuga\AppData\Local\Temp\opencode\cdp-learner.mjs
node C:\Users\shuga\AppData\Local\Temp\opencode\cdp-mobile.mjs
```

`cdp-post.mjs` covers listening, answer reveal, fullscreen persistence, session
end, unknown pack creation/reopen and known/unknown pack switching.
`cdp-learner.mjs` measures desktop and phone Study, API fullscreen, forced CSS
fallback, Library and Create. `cdp-mobile.mjs` checks Library, Create and the
"Other language" field at 390px. These scripts are rehearsal tools, not part of
the repository or `npm test`.

Screenshots are written to
`C:\Users\shuga\AppData\Local\Temp\opencode`:

- `learner-post-listening-before.png`
- `learner-post-listening-after.png`
- `learner-built-study-1440.png`
- `learner-built-study-full-api.png`
- `learner-built-study-full-css-1440.png`
- `learner-built-study-390.png`
- `learner-built-library-1440.png`
- `learner-built-create-1440.png`
- `learner-built-create-form-1440.png`
- `learner-built-library-390.png`
- `learner-built-create-390.png`
- `learner-built-create-form-390.png`

## Results

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; `check-pwa: passed (files: 53, precache entries: 51)`;
  `sw.js` version `9f4a1e76691fff7d`.
- `npm test`: 45 files / 467 tests passed.
- External Edge lanes: passed the listening, language, width, fullscreen,
  fallback, session-end and phone checks above.
- Server reachability: `localhost=200` and guest `172.25.126.9:4190=200`.
- Drift audit: three hard gaps and the doc drifts found alongside them were
  fixed before this run; see
  `.reports/2026-10-24-drift-learner-interface.md`.

## Named limits

The browser lanes are temporary and run against a static export, not a deployed
site. Edge headless does not draw browser chrome, and its Fullscreen API viewport
is 800x600; the forced-rejection lane is the fallback proof. There is no real
image or video card fixture, so containment is proven by the CSS rule and stage
geometry, not by a media screenshot. A real provider key is still unverified.
The hint-race path, Write deck/card rendering and `LanguageField` transitions are
covered by the browser lane or nearby tests, not by dedicated component tests.
The green cast on CDP screenshots is a capture artifact; computed colors match
the intended light theme. The learner approved the screenshots on 2026-10-24 and
asked for a local commit and merge, not a pull request.
