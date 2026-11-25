**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline (v1-prototype delta)
**Blocks:** -

# How the screens are arranged

## Question

Surfaced while the learner used the built prototype: the look was accepted, the
arrangement was not. In the learner's words:

> "We must have to rearrange the layout of the UI... we should be able to not
> scroll too much down... compact, compact, compact... if you need more
> information you should be able to go to the other way... it would make a home
> a lot easier if it is some kind of sidebar... the settings has a lot of things
> that we can just make it a tab. It shouldn't be laid out all the time on the
> screen... and the library also if it could be a tab it would be much much
> better... all the cards are just laid out there on the screen and you have to
> scroll down... the importing is also just there... there is no pattern in
> this. It's just too much information on the screen."

Decide how the four places (Study, Library, Progress, Settings) are reached,
how much of each screen is visible at once, and where the secondary material
goes.

## Resolution

**A fixed left sidebar is the only navigation.** Study, Library, Progress,
Settings; slim, always visible, text labels. The top bar and its inline links
are gone. Chosen over a collapsible icon rail: the learner asked for a sidebar
and confirmed the plain version; an icon rail adds a state and a memory burden
this prototype does not need. *(Superseded by the 2026-11-24 header-nav
experiment below; kept here as the original decision.)*

**One pattern everywhere: a screen is a header plus tabbed or collapsible
panels.** Primary content is visible; secondary material is one click away.
Nothing that is only sometimes needed stays expanded by default. This is the
"if you need more information you should be able to go to the other way" rule.

**Compact rhythm across the app.** Smaller type scale, tighter section spacing,
less padding. The learner asked for compact three times; the previous layout was
a vertical wall of full-width cards.

**The page itself does not grow without limit.** Lists and tables live in
fixed-height scroll areas. Long card lists must not push the page down.

**Screen by screen:**

- **Study** keeps the centered card. The plan screen becomes a compact header
  row (offer, Rebuild, Start) with the reasons folded into one expandable
  summary and the tutor banner folded away. During review the plan material is
  hidden; only the card and its actions are visible.
- **Library** has three tabs: `Packs`, `Add cards`, `Generate`. Packs is a
  compact list in a scroll area. Add cards holds manual entry and import, each
  behind a button so the textarea and file chooser appear only when opened.
  Generate is its own tab with prepare, exact preview, copy and send.
- **Progress** has two tabs: `Overview` and `Every card`. The evidence drawer
  is a panel sliding in from the right, not content that pushes the page down.
  Corrections stay inside that panel.
- **Settings** has four tabs: `Profile`, `Provider`, `Prompts`, `Data`.
  Only the active tab is rendered; the rest wait.

## Override - 2026-11-24 (header navigation experiment)

Victor asked to try a compact top header instead of the sidebar. This
supersedes the sidebar-only resolution above **for this experiment only**. The
work lives on isolated branch `feature/header-nav` so it can be rolled back
without touching `main`.

- One sticky header: brand on the left, text links inline, theme toggle right.
- Same five routes, same labels, same active-path rule. No icon-only rail.
- Narrow screens keep one header row, not a second bar. Amended 2026-11-25:
  five scrolling tabs were replaced by one menu button in that row; opening it
  shows the same five routes in a panel.
- No route, data, prompt or behavior changes.
- Added 2026-11-25: all page bodies line up to one shell width. The Study plan
  centred cap and the modes list 980px cap are removed on this branch only. A
  focused study card keeps its narrow reading column.
- Rollback: discard the branch and rebuild `main`; there is no migration.

## Deliberately not done

- No icon-only sidebar and no collapsible rail.
- No mobile or bottom navigation rework; the prototype stays desktop-first.
- No route, URL or data changes: the same screens, the same API.
- No behavior changes to answering, judging, evidence, plans or prompts.
- No theme change; the accepted look stays.

## Why

A patterned shell lowers the cost of every later screen: new material lands in
a tab or a disclosure instead of lengthening a page. The learner rejected the
previous arrangement on exactly that ground — too much at once, no pattern —
while accepting the visual language. The resolution keeps the look and changes
only the arrangement.

## Source

Learner review of the running v1 prototype, 2026-10-19; the follow-up question
("sidebar always visible or collapsible? evidence panel or inline?") was
answered "go" to the proposal, which fixed both defaults above.
