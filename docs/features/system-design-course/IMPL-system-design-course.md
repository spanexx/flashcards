# IMPL: System Design Course

**Slug:** system-design-course
**Status:** All phases built; review and commit gate pending
**Date:** 2026-10-29
**Contract:** `PRD-TRD-system-design-course.md`

## Phase 1 — Pack skeleton and course map

**Deliverable:** `v1/packs/system-design/pack.json`.

- Name `system-design`, version `1.0.0`, language `en`.
- Ten topics in course order with labels and levels.
- `coreRange: "*"`.

**Proved by:** `make-seed.mjs` reads `pack.json` directly (no schema parse; a
missing level falls back to `intermediate`), and the seed test compares the
built deck ids and levels to the manifest
(`v1/tests/seed-packs.test.ts:70-73`), so a wrong level or order fails CI.

## Phase 2 — Research and source ledger

**Deliverable:** `v1/packs/system-design/SOURCES.md`.

- One reference block per deck: books, papers, standards or vendor docs.
- A video table with id, title and channel for every clip.
- A photo table with original file, creator and licence.
- A note that diagrams are original work.

**Proved by:** every deck id in `pack.json` has a section in `SOURCES.md`; every
photo file has a row; every video id used in a card appears in the table.

## Phase 3 — Photographs

**Deliverable:** ten WebP files in `images/`.

- Wikimedia Commons, 1600 px wide, quality 82, each under 600 KB.
- One photo per deck so every deck opens on a real image.
- `server-rack.webp` is cropped above a creator watermark; the original is
  credited in `SOURCES.md`.

**Proved by:** the seed test stats every referenced image in the built bundle;
`SOURCES.md` names the creator and licence for each.

## Phase 4 — Diagrams and animations

**Deliverable:** eighteen SVGs in `images/`.

- Eight static diagrams: latency budget, style comparison, data ownership, SLO
  budget, trust boundaries, eval loop, DORA metrics, pipeline stages.
- Ten animations: boundaries, trade-offs, services, cache path, retry backoff,
  supply chain, RAG loop, review gate, feature flag, canary.
- All animations use CSS or SMIL and include a `prefers-reduced-motion` guard.

**Proved by:** SVGs render through the app's `<img>` path; the seed test checks
their files; a visual pass rendered four samples to temporary PNGs and
inspected them. The PNGs were deleted after the check (cleanup ethics), so the
visual quality rests on that pass and on review, not on stored artifacts.

## Phase 5 — Videos

**Deliverable:** twenty-four verified YouTube ids placed across the decks.

- Every id checked through YouTube oEmbed on 2026-10-29: title and channel
  recorded in `SOURCES.md`.
- No start or end trimming; no downloaded video files.
- Each deck has at least one video; the CI/CD deck has four.

**Proved by:** the seed test asserts the eleven-character id shape; authoring
recorded the oEmbed title and channel for each in `SOURCES.md`; a temporary
recheck script returned all ids alive and was deleted after use. A fresh-eyes
drift review re-ran oEmbed on 2026-10-29: all 24 ids answered HTTP 200 and every
channel matched `SOURCES.md` (`v1/packs/system-design/SOURCES.md:74-75`).

## Phase 6 — Card authoring

**Deliverable:** ten files in `cards/`, ten cards each.

- Deck topics match the manifest exactly.
- Answer modes mixed across cloze, picks and type.
- Every card has hints, a full line where it is a sentence card, and a teaching
  layer of one to three parts.
- Plain English first; technical terms are explained by the card or its
  teaching text.

**Proved by:** `npm run typecheck`; the seed tests for deck count, card count,
teaching length and video id; the loader's hard rules for cloze blanks and picks
options.

## Phase 7 — Seed integration

**Deliverable:** `system-design` in `scripts/make-seed.mjs` and a regenerated
seed.

- `public/packs/system-design.json` with 10 decks and 100 cards.
- `public/packs/system-design/images/` with 28 files.
- `public/packs/index.json` with three packs.

**Proved by:** `node scripts/make-seed.mjs` output; the index test expects all
three packs; the built bundle is what the tests read.

## Phase 8 — Tests

**Deliverable:** updated `tests/seed-packs.test.ts`.

- `PACK_NAMES` gains the new pack, so every shared test applies.
- A new suite asserts every card is taught, every built-in image exists, and
  every deck has at least two images and one video.

**Proved by:** `vitest run tests/seed-packs.test.ts` — 14 tests pass.

## Phase 9 — Build and browser evidence

**Deliverable:** a static export at `/flashcards` and a post-impl simulation.

- Build: `NEXT_PUBLIC_BASE_PATH=/flashcards next build --webpack`, then
  `build-pwa.mjs` and `check-pwa.mjs`.
- Simulation: `docs/features/system-design-course/simulate.sh` reads the built
  seed and prints the course, media counts, missing-file checks and sample cards.
- Browser: the seed banner, pack card, deck list and a taught card are checked
  in the built app.
- Browser evidence, 2026-10-29, built export served from Windows at
  `http://localhost:4173/flashcards/`: the Library listed three packs with
  `system-design 1.0.0`, 10 decks, 100 cards and English; the expanded pack
  listed all ten deck labels at the authored levels and 10 cards each; the
  Study scope dialog listed the pack and all ten deck checkboxes; a Foundations
  session rendered `boundaries-anim.svg` in the teaching layer, and the card
  with `K7RkjKTIQbo` played its video after D-41 instead of error 153.

**Proved by:** build exit status, PWA check, simulation pass line, and a browser
pass over the built export.

## Phase 10 — Drift, reconcile, review gate

**Deliverable:** drift report against this IMPL and the PRD-TRD; one canonical
simulation; a review event for the learner.

- The drift review is run by a separate agent.
- Any gap is fixed in code/docs or logged.
- No commit, push, pull request or merge until the learner says go.

**Proved by:** the drift report; the learner's reply on the review event.

## Delivery notes

- 2026-10-29, follow-up: the learner found the system-design Dictionary pages
  empty. The pack shipped cards but no pages, so the app had nothing to show
  in the Dictionary even though Study had all the media. `packs/system-design/pages.json`
  now carries 111 pages (1 pack, 10 deck, 100 card). The course page and every
  deck page take the locked cover shape: a photo, a promise and the path
  onward. Every card page carries the card's teaching layer, so the pictures,
  animations and videos are readable in the Dictionary. `make-seed.mjs`
  derives each card page's id with the app's content hash, checks every
  built-in page image exists, and emits `pages` in the bundle. The pack
  version rises to 1.1.0 so an installed browser takes the update. The seed
  test recomputes every page id with the app's own `deckCardId`, asserts every
  card page has a part, every cover page has a picture and a promise, and
  every page image exists. `simulate.sh` now prints
  `Dictionary pages: 1 pack, 10 deck, 100 card` and checks the same shape.
  D-42 records the gap.
- 2026-10-29: fresh-eyes drift review (`.reports/2026-10-29-drift-system-design-course.md`)
  returned Minor Drift with nine gaps; all nine are closed in this branch. The
  simulation now prints each sample card's prompt, answer and teaching parts,
  and asserts three packs, ten decks, and deck order, name and level against
  `pack.json`. The PRD names D-41 as the one app-code change and describes the
  real video fallback; the failure table names the seed test and simulation as
  the 1–3 part guard. Phases 1, 4, 5 and 9 now state the evidence that exists.
  The seed test requires each deck to include a photograph or static diagram.
  Re-run: simulation PASS, seed tests 14 passed, full suite 84 files / 970
  tests, `npm run check:drift` 0 open.
- 2026-10-29, process note: this pack has no pre-implementation simulation. The
  GRILL and the PRD-TRD review were the design gate, and `simulate.sh` is the
  single canonical simulation.
