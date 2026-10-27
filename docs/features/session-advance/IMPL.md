**Status:** Implemented — awaiting review
**Origin:** `wayfinder/anything-learning-spec/tickets/session-advance.md`
**Simulation:** `docs/features/session-advance/simulate-pre.html`

# IMPL — advancing without reaching for Next

The learner compared four simulated answers and chose **all three** behaviours:
the pinned row, Enter to continue, and the minimum card height. This pack adds
them together. The card's words, colours and teaching content do not change.

## Behaviour

1. **Pinned action row.** `.study-card-actions` is sticky to the bottom of the
   visible area. It only pins when its natural place would fall below the fold.
   It keeps a solid card background, a top border and a soft shadow so content
   passing behind it is readable. It works in the normal page and in the
   viewport-bound full screen (the stage is the scroll container there).
2. **Enter continues.** After an answer is shown, Enter calls the same
   `nextCard` as the button. On the last card it finishes. The hint "Enter to
   continue" sits beside Next card. Enter is left alone when focus is in a
   field, or on a link, button, summary or select, and while the teaching layer
   is open. Holding Enter does not skip several cards.
3. **Minimum card height.** The session card reserves 420px, so the question
   state does not collapse to a much shorter card than the answer. Content
   taller than 420px still grows the card; nothing is clipped.

## Files

- `v1/src/app/globals.css` — card becomes a flex column with `overflow: clip`,
  a 420px minimum and padded-edge variables; the action row becomes the sticky
  footer; the question footer settles at the bottom of the reserved height,
  while the answer footer follows the reveal; the new `.study-next-group` holds
  the hint and the button.
- `v1/src/app/study/StudyCard.tsx` — "Enter to continue" hint, Next group, and
  `aria-keyshortcuts="Enter"` on Next/Finish.
- `v1/src/app/StudyClient.tsx` — one window `keydown` listener while an answer
  is shown; it ignores fields and controls, the open layer, and key repeats.

## Edge cases

- The last card's Enter goes through `finish`, exactly like Finish.
- An open teaching layer keeps Enter inside the layer; Escape still closes it.
- The pinned row is inside the answer's `.study-result` too, so it pins in both
  states; the row's parent is the thing that bounds it.
- Phone layout keeps its column-reverse stacking; the Next group wraps instead
  of overflowing.
- A cold check and a returned card get the same minimum height and footer.
- `overflow: clip` replaces `hidden` so the card keeps its rounded clipping but
  no longer becomes a scroll container that would trap the sticky row.

## Checks

- `npx tsc --noEmit`
- `node node_modules/vitest/vitest.mjs run`
- `npm run build` (in `v1/`)
- Visual: serve the export, short browser window, answer, Enter; shrink to a
  phone width; full screen and shrink the browser window.
- `npm run check:drift` and `npm run check:drift:staged`
