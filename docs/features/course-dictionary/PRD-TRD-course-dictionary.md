# PRD-TRD: Course Dictionary

**Slug:** course-dictionary
**Status:** Approved under delegated authority (2026-10-29)
**Date:** 2026-10-29
**GRILL:** `GRILL-course-dictionary.txt` — Locked, 32 entries, no open questions.

## Why This Exists

The teaching layer helps one card for a moment; it does not give the
origin and background that makes an idea stick. The learner asked for a
Dictionary: a detail page for every card, deck and pack, holding the short
story, the picture and the video behind the thing being learned.

A course is richer than its cards. Cards are generated; course material is
written later, by the same person who checks the facts. So the Dictionary
has two faces: a reader (lessons in card order, reference on demand, never
gated) and an authoring workspace (Course Builder plus an Edit button on
every page). Reading earns coverage, never score.

## Behavioral Spec

### Scenario 1 — a card page steps one part at a time

**Given** a card page with three parts (text, picture, video)
**When** the learner opens it from the library card row, the study card's
Dictionary button, or the teaching layer's link
**Then** one part shows at a time; the panel keeps the height of its
tallest part; the step dots mark the current part and every traced part;
the previous and next arrows sit side by side at the bottom right at every
width; the page is never locked or gated.

### Scenario 2 — reading is earned by traces

**Given** an unread page
**When** the learner stays with a text part for at least
`max(5s, words/10)`, or hears that text read to the end; looks at a
picture for three seconds or taps it to enlarge; plays a video to eighty
percent (a kept or web video reports its own time; a linked YouTube video
reports its position through its player, which may only be listened to
once the player is ready)
**Then** that part is traced; traces survive leaving and returning; the
page becomes "read" only when every part is traced.

### Scenario 3 — reading shows coverage, never score

**Given** a library with pages
**When** the learner opens Progress
**Then** a separate line reads "Pages read N of M", where M counts the
card pages that carry at least one part (pack and deck covers are never
readable); it never mixes with the answer count or "known"; no trace
raises a score, unlocks anything or blocks an answer.

### Scenario 4 — where pages open from

**Given** a learner in the library or in a session
**When** they use an entry point
**Then** the card page opens from the library card row's book button, the
study card's Dictionary button, and the teaching layer's link; the deck
page and pack page open from the up-right arrow on their row in the Study
"Study from" dropdown (arrow on hover/focus, always faint on touch; it
opens the page and never changes the selection); the deck page's card list
opens card pages; the pack page's path opens deck pages; the Course
Builder tree opens any page.

### Scenario 5 — a course rule warns, never blocks

**Given** a pack whose author turned on "read the card page first"
**When** the learner answers a card whose page is unread
**Then** every answer button stays live; after the answer a warning leads
the result panel: "This course asks you to read the card page first. Your
answer still counts." with a link to the page; the answer is recorded
normally; the card carries a reading chip ("Page not read" / "Page read")
that opens the page and never marks it read. The chip and the two tools
take a book or check icon, keep the words as the accessible name and the
tooltip, and shrink to icon-only 34×34 buttons with an 8px corner on a
narrow screen. A pack without the rule never shows the warning. A card
with no page never shows the chip or the warning. The warning follows the
answer, not the page rule; a study button waiting for the card's first
attempt is the existing study guidance, not this rule.

### Scenario 6 — pack and deck pages are covers, not dashboards

**Given** a pack with 14 decks and one deck with 10 cards
**When** the learner opens the pack page or the deck page
**Then** the cover picture leads in a band; the eyebrow, title, facts and
Edit button sit under it; the lead carries the promise; the contents run
down one column (deck rows with level, card rows with a written/empty
dot); the contents sit in a window with a fixed maximum height, a hidden
scroll bar that still scrolls, and a search icon that opens a slim 180px
input on the same line; Escape or a press outside closes the field and
clears the filter; a row cut at the bottom is the cue that more sits
below.

### Scenario 7 — authoring: kept or linked

**Given** an author in the Course Builder or a page's Edit button
**When** they add a picture or a video
**Then** the part is either kept in the browser (a file, works offline,
travels in a shared pack zip and the full backup) or linked (YouTube, a
Drive preview, any address; the address travels, the file does not, and a
dead file leaves a "gone" note).
Kept limits: picture up to 1 MB shrunk to 1600 px; video up to 20 MB;
**300 MB total across every pack**, with a meter in the editor. A save
that would pass 300 MB is refused with a plain reason: link it instead, or
remove a kept file. Replacing or removing a kept file frees its room at
once, so the cap is judged by the net total. On any touch-first mobile
browser (Android, iOS, iPadOS, including an iPad that reports a Macintosh
user agent), a video must be linked — choosing a video file is refused —
while pictures may still be kept; a touch-screen laptop on Windows, macOS
or ChromeOS is a computer and may keep video. A kept video inside an
imported pack still plays.

### Scenario 8 — a draft is reviewed, never auto-saved

**Given** an author with a page open
**When** they press "Draft with AI", type an instruction, and approve the
exact prompt
**Then** one provider call is made on the existing lane (own key or the
paid system provider), the answer lands in the editor as unsaved text, and
nothing is saved until "Save page" is pressed. The prompt sees the page
level, the pack/deck/card names and card text, the language pair and the
instruction; it never sees evidence, settings, a key or a backup.

### Scenario 9 — a built-in course stays one course

**Given** a built-in pack that ships pages
**When** the learner edits one of its pages
**Then** the edit is a private overlay in that browser, keyed by the page;
the shipped page is kept beside it as a snapshot; the shipped course is
untouched; a later seed or course update leaves the edited page alone and
refreshes the snapshot; "Revert to shipped page" removes the overlay and
the shipped page returns at once, offline, with no reseed, and the trace
of the learner's body goes with it. A shared pack carries the shipped
copy, never the learner's overlay.

### Scenario 10 — pages travel; traces stay the learner's

**Given** a pack with pages that point at kept media
**When** the author exports the pack, or the learner exports the full
backup
**Then** the pack (JSON or zip) carries the pack, deck and card pages and
the kept media files they point at; the full backup carries pages, the
shipped copies kept beside an overlay, and reading traces; a shared pack
never carries reading traces. Before a full backup starts, the Settings
screen states the size of the kept media it will build and waits for a
confirmation; on a touch-first device it also suggests one pack at a time
when kept media is large. The background autosave never asks.

### Scenario 11 — a page edit is not a card edit

**Given** a card with evidence
**When** its page is saved
**Then** only the page record changes; no card is created, retired or
edited; every evidence row stays with its card.

## Simulation Contract

`docs/features/course-dictionary/simulate.sh` runs
`tests/simulate-course-dictionary.test.ts` against the real router and an
in-memory store, and prints one line per scenario:

```
SCENARIO 1 card page steps 1 of 3, previous and next at bottom right -> PASS
SCENARIO 2 text dwell 5s floor, picture 3s, video 80%, traces survive leaving -> PASS
SCENARIO 3 pages read 1 of 2, answers untouched -> PASS
...
```

Every scenario above must print PASS. The script refuses to run when
`v1/out` has no build, like `simulate-browser.mjs`.

## Technical Design

### Data Models

`v1/src/lib/shared/types.ts`

```ts
export type PageLevel = "pack" | "deck" | "card";

/** The content of one page, apart from where it is stored and who wrote it. */
export interface PageContent {
  title?: string;
  lead?: string;
  cover?: TeachingImagePart;
  parts: TeachingPart[];
}

/** One Dictionary page. Its id names the entity it belongs to. */
export interface DictionaryPage extends PageContent {
  id: string;               // page:pack:<name> | page:deck:<name>:<deck> | page:card:<id>
  level: PageLevel;
  packName: string;
  deckId?: string;
  cardId?: string;
  createdAt: string;
  updatedAt: string;
  /** This row was saved by the learner, not written by a pack file. */
  learnerEdited?: boolean;
  /** This edit replaced a page that arrived in a pack file, so it can revert. */
  editedFromShipped?: boolean;
  /** The shipped page this overlay replaced, kept beside the learner's words so
   * a revert restores it at once, offline, without waiting for a seed. */
  shippedCopy?: PageContent;
}

/** One part's earned trace; separate from the page so a seed never erases it. */
export interface PageTrace {
  id: string;               // the page id
  traced: number[];         // part indices
  readAt?: string;          // set when every part was traced
  updatedAt: string;
}
```

`learnerEdited` means "this row was saved by the learner" and is set on
every save through the editor, including a brand-new page.
`editedFromShipped` is the narrower overlay marker: the first save over a
shipped page sets it and every later save carries it, so only an overlay
of a shipped page offers a revert.

`TeachingPart` is reused unchanged (text, image, video with
`builtin | web | local | youtube` sources) so one renderer, one schema and
one media-reference walker serve pages and teaching layers.

Pack gains `requirePageRead?: boolean` (the per-course rule, entries
11/13). Stored on `BrowserPack`, exposed on `PackStatus`, carried in the
pack bundle header and the backup.

### API Contracts

New stores, database version 6: `pages`, `pageTraces`.

| Call | Meaning |
|---|---|
| `GET /api/pages?pack=<name>` | `{ pages, traces }` for one pack (all three levels) |
| `GET /api/pages` | every page and trace, for Progress |
| `PATCH /api/pages/<id>` | save one page (`{ level, packName, deckId?, cardId?, title?, lead?, cover?, parts }`); validates the parent exists and every part; sets `learnerEdited`, and `editedFromShipped` plus `shippedCopy` when it replaced a shipped page |
| `DELETE /api/pages/<id>` | remove the learner's copy -> `{ deleted: true, page }`; when a `shippedCopy` is kept, that shipped page is written back at once and the trace is dropped, otherwise `page` is null |
| `POST /api/pages/<id>/traced` | `{ index }` -> `{ trace }`; records one traced part, sets `readAt` when complete |
| `POST /api/pages/draft` | `{ level, packName, deckId?, cardId?, instruction }` -> `{ requestId, prompt }` (held, exactly like generation) |
| `POST /api/pages/draft/send` | `{ requestId, prompt? }` -> `{ draft }`; one provider call, nothing saved |
| `GET /api/progress` | gains `pages: { read, total }` |

Pure core (`v1/src/lib/core/pages.ts`): page ids, title resolution,
`pageIsRead`, `tracedTextMs`, `readCount`, `savedPageSchema`,
`pageRuleProblems` (a card page needs at least one part; a pack or deck
page may be a cover and a lead with no parts).

Media rules gains `TOTAL_MEDIA_MAX_BYTES = 300_000_000`,
`BACKUP_WARN_BYTES = 150_000_000`, `backupSizeWarning(totalBytes)`,
`mediaCapProblem(total, adding, replacingBytes = 0)` and a pure
touch-first-mobile test `isTouchFirstMobile(userAgent, maxTouchPoints)`.
The page editor passes a replaced file's bytes to the cap check and runs
`deleteMediaIfUnreferenced` for every file its editing session replaced or
removed, so replacing or removing a kept file frees its room at once.

`referencedMediaIds(cards, pages)` now includes page parts and the
`shippedCopy` kept beside an overlay, so export, backup, archive and the
editor's cleanup keep page media.

### Dependencies

None added. `zod` validates pages, `fflate` already packs the zips,
Next/React render the screens, the existing provider client makes the one
draft call.

### Architecture Notes

- The browser store is the only source. A page row is the learner's copy;
  a shipped page arrives through the same pack bundle import and is written
  by `writeShippedPage` (`v1/src/lib/browser/pages.ts`, called from
  `bundle.ts`), which skips a learner-edited row but refreshes that row's
  `shippedCopy`, so a later revert restores the current course page.
- Screens: `/dictionary?pack=&deck=&card=` (query params, because the
  static export has no dynamic route support) and `/builder?pack=`.
  `/dictionary` renders the card reader when `card` is present, the deck
  page when `deck` is, the pack page otherwise.
- One `PageEditor` component serves the Course Builder and every page's
  Edit button. `CardPage` owns the reader rendering (parts, dots, arrows,
  speaker, picture zoom); `PageEditor` owns the preview and the media
  meter. `PageParts` and `TraceMeter` were folded into those two files
  (accepted drift A1); there is no separate renderer module.
- Study fetches every page and trace on mount and again on window focus
  and visibility change, and keeps sets of page ids; returning from a page
  refreshes them, so the reading chip is never stale after a read in
  another tab.
- Pack/deck pages render the cover and lead only: the approved layout
  (entry 18) keeps one scrolling list, so their detailed material is the
  lead plus the cover, and the list carries the contents. Card pages carry
  the ordered parts.
- A shared pack never carries a learner's overlay: `shareablePage` swaps
  an `editedFromShipped` row for its `shippedCopy` before the bundle and
  the archive read media ids, so the packed pages and the packed files
  agree and stay the author's course.
- A full backup states its size in a fixed panel in Settings
  (`backupMediaBytes` + `backupSizeWarning`) and waits for "Build the
  backup"; the background autosave calls the zip builder directly and
  never asks. The zip stays one blocking build because restore promises
  all-or-nothing.

## Non-Goals

- No accounts, no server storage, no Google login.
- No gating of any page or any answer.
- No streaming zip this pack (decision 29 records why).
- No pack-level video body outside the cover (the approved layout has no
  place for it; a card page or a linked cover carries it).
- No reading score, streak or unlock.
- No change to card identity, evidence or the teaching layer's rules.

## References

- `GRILL-course-dictionary.txt` — entries 1-32, all locked.
- `archive/simulate-pre.html` — the approved design (the pre-implementation
  simulation, kept for comparison).
- `docs/features/teaching-layers/` — the sibling pack that owns media,
  the teaching layer and the overlay precedent.
