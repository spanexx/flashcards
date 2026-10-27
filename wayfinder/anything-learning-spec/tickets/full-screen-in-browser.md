**Type:** grilling
**Status:** resolved
**Delivery:** surgical-change
**Blocks:** -

# Full screen stays inside the browser

## Question

The card's "Full screen" control asked the browser for system fullscreen, which
takes the whole monitor and leaves the browser's own frame. The learner wants
the stage to fill the browser window instead: if the window is small or the
learner resizes it, the stage shrinks with it and never covers anything outside
the browser.

## Resolution

- "Full screen" fills the browser's viewport only. It does not ask the browser
  for system fullscreen and does not hide the browser frame or the desktop.
- The stage is fixed to the browser window and shrinks when the window shrinks.
- Escape, the on-screen control and finishing or leaving the session still
  return to the normal plan column.
- The page behind the stage still stops scrolling while it is open.

## Why

The learner keeps the browser visible and resizes it; a stage that escapes to
the monitor breaks that habit and cannot be shrunk. The CSS stage already had
the right shape; the system-fullscreen request was the part that went outside
the browser.

## Source

Learner voice note, 2026-10-27: "open the browser-wide full screen... if I shrink
the browser the full screen should shrink with it. Should not go outside the
browser." Current code: `v1/src/app/StudyClient.tsx:145-154`
(`requestFullscreen`), `:365-374` (the exit cleanup), `:393-400` (the
`fullscreenchange` listener); the viewport stage is
`v1/src/app/globals.css:2457-2469`.
