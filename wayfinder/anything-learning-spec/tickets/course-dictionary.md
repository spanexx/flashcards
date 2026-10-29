**Type:** feature
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# A Dictionary of course knowledge

## Question

The teaching layer is short, card-scoped help. The learner reports it is
not enough for some users: what is missing is the origin and background
that makes an idea memorable. Each card, deck and pack could carry its own
detail page ("Dictionary") holding stories, images and video, used both as
ordered lessons and as reference opened on demand. Writing that material is
a separate job from generating cards, and it needs real editing tools.
What is the shape, and how is it authored?

## Resolution

Locked 2026-10-29 at 32 entries and implemented the same day through the
feature pipeline. The decisions live in
`docs/features/course-dictionary/GRILL-course-dictionary.txt`; the
contract is `PRD-TRD-course-dictionary.md`; the plan is
`IMPL-course-dictionary.md`; the canonical rehearsal is `simulate.sh`;
the design notes are kept in `archive/simulate-pre.html`.

- **Three levels.** Every pack, deck and card gains its own detail page;
  the pages connect upward: card, then deck, then pack.
- **Content.** A page carries text, images and/or video: a short story, an
  origin, a short description of what is learned.
- **Authored later.** Pages are written after the cards exist. Adding
  pages never waits for card generation.
- **Two routes, one set of pages.** Follow them as lessons in course
  order, or open one on demand from its card, deck or pack.
- **Authoring is its own feature.** Shared tools, not shared rules: pages
  offer text, image and video, prompts stay plain text, and the existing
  save rules stay per object (a card side edit makes a new card; a
  teaching edit updates in place).
- **Both ways in.** A central Course Builder workspace for a whole course,
  plus Edit buttons beside each page.
- **Private personal changes.** A learner may personalise a built-in
  course; the change stays on their device and never alters the shipped
  course. Only the course author changes what ships.
- **One long reference, not two.** The teaching layer stays short and
  links to the card page; the card itself also reaches its page, so a
  card with no layer still has a way in.
- **Per-card order, never gated.** A session can cover two decks, so the
  ordered route is anchored on the card; deck and pack pages are reached
  upward from the card. The Dictionary is never gated: no level gate and
  no progress gate. A course may require reading before an attempt; that
  is a rule on the attempt, not a lock on the page.
- **A card page is stepped.** One part at a time (story, picture, what it
  means, watch, try it), never one long scroll. The page keeps the height of
  its tallest part so it does not jump. Both arrows sit at the bottom right of
  the card, at every width. Every text part carries a speaker icon that reads
  that part aloud; pictures and videos have none.
- **Pack and deck pages are new pages.** Neither exists in the app today. A
  pack page is one page about the whole course (what it teaches, the deck
  path, a way into each deck); a deck page is one page about one deck (what
  it teaches, its cards in order, a way into each card page). Card pages sit
  under them. The simulation labels them "New page · not in the app today".
- **The reading rule warns, it never blocks.** No separate rule section on
  the study screen. One status chip on the learning card shows the state and
  provides the way in: icon alone when narrow, icon with words when wide.
  It reads "Page not read" or "Page read" and opens the card page when
  pressed. Answering before reading keeps working and shows a warning under
  the buttons ("Your answer still counts"), with a link to the page. No
  control is ever disabled. The rule stays a per-course option.
- **Hint and Dictionary are plain buttons.** Same icon rule: icon alone when
  narrow, icon with the word when wide, the word kept as the accessible name.
  The sticker drawings and their comparison screen were dropped. All three
  card controls (the reading chip, Hint, Dictionary) take an 8px corner, in
  line with the answer buttons' 9px.
- **The card page opens from both places.** A small book button on each
  library card row and the Dictionary button on the study card each open the
  same card page. Study-card-only and library-only were rejected.
- **Pack and deck pages open from the Study dropdown.** Every pack and deck
  row in the "Study from" dropdown carries an up-right arrow. It appears on
  hover or keyboard focus and stays faint on touch screens. The arrow is its
  own control: it opens the page and never changes the selection. The library
  gains no pack or deck buttons.
- **Pack and deck pages lead with the picture.** Both pages take the cover
  shape: a picture band, then the eyebrow, title, facts and one Edit button,
  then the contents as one column of rows. No side panel and no Authoring
  sidebar; writing lives in the Course Builder.
- **Reading counts as coverage, never as score.** Progress gains one separate
  "Pages read" line that never mixes with the answer count or with "known".
  A page earns its read mark only when every part has a trace of time spent
  with it; partial pages count for nothing. A text part counts after one
  second per ten words on screen (floor five seconds) or a full speaker read;
  a picture after three seconds (its weakest trace) or at once when tapped
  to enlarge; a video at eighty percent played; the speaker only at the end.
  Traces are hints, not proof, and never gate.
- **The path and the card list are windows with a search.** A pack page's
  deck list and a deck page's card list each have a maximum height and scroll
  without a visible bar. A search icon opens a slim name filter on the same
  line, to the icon's left; it never moves the list.
- **A page's picture or video is kept in the browser or linked.** The kind is
  chosen when the part is added and the page shows it. Kept files obey a size
  cap, work offline, and travel as files in a shared pack and the backup;
  linked parts hold only an address (YouTube, a Drive preview, any URL), need
  a connection, and leave a "gone" note when the file disappears. No Google
  login: the app never stores a learner's files in a Google account. The
  20 MB per-video limit stays, and a linked video has no cap. Every kept
  file across every pack counts towards one 300 MB total; a save that would
  pass it is refused with a plain reason (link the video, or remove a kept
  file), and the editor shows kept MB against the cap. At a full 300 MB a
  full backup needs about 600 MB of working memory, so the export question
  now includes a size warning or a streaming zip. On a touch-first mobile
  browser (phone or tablet) a video must be linked, never kept: choosing a
  video file is refused, the address field is the only route, and pictures
  may still be kept. A kept video that arrives inside a pack still plays.
  A touch-screen laptop on a desktop system is a computer and may keep
  video.

## Implementation (2026-10-29)

Delivered in v1 on branch `feature/course-dictionary`. The Dictionary
reader, the Course Builder, the shared page editor, the reading traces
and the pack/backup travel are in place; Draft with AI uses the existing
provider lane.

A fresh-eyes drift review found seven gaps; all were closed before the
human review:

1. A full backup states its kept size in Settings and waits for a
   confirmation; the background autosave stays silent.
2. Revert restores the shipped page at once from the `shippedCopy` kept
   beside the overlay, offline, and drops the trace. Entry 30 carries the
   dated amendment.
3. A linked YouTube video attaches its progress listener once the player
   is ready, so its 80% trace is earnable.
4. Escape or a press outside closes and clears the pack/deck search.
5. The reading chip is the locked book/check icon chip with a name and a
   tooltip.
6. Hint and Dictionary keep their accessible names at 700px, take an 8px
   corner and 34×34 icon-only buttons.
7. Replacing or removing a kept file frees the 300 MB cap at once
   (`replacingBytes`, `deleteMediaIfUnreferenced`).

One privacy gap the review did not name was also closed: a shared pack
now carries the shipped copy, never a learner's private overlay
(`shareablePage`).

Verification: `tsc --noEmit`, `npm run lint` (exit 0), the `/flashcards`
webpack build plus `build-pwa` and `check-pwa`, the full test suite
(87 files / 1019 tests) and `simulate.sh` (12 scenarios plus the
built-screen check) pass; the built export carries `/dictionary` and
`/builder`; both drift gates are green. Each closed gap is logged as
D-32…D-40 in `docs/drift.md`. D-40 is a doc-only audit finding: two
source lines in the locked GRILL pointed at the wrong code, and one
appended block corrects them without moving a locked answer.

The remaining gate is the learner's go to commit and open the pull
request; no commit, PR, push or merge has been made under the delegated
authority.

## Open questions

None. Entries 29-32 answered the travel, backup-size, storage, cost and
card-identity questions; the drift review closed the rest.

## Non-goals

No word-definition dictionary; no learner edit to the shipped built-in
text; no new content server (browser-owned packs rule); no change to the
card's question and answer.
