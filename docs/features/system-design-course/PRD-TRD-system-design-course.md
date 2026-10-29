# PRD-TRD: System Design Course

**Slug:** system-design-course
**Status:** Built, awaiting review
**Date:** 2026-10-29
**Source:** `GRILL-system-design-course.txt`
**Ticket:** `wayfinder/anything-learning-spec/tickets/system-design-course.md`

## Why This Exists

The app ships two built-in packs: a browser developer course and an absolute
beginner Polish course. Neither teaches how to design a software system, and
neither covers the questions a modern team actually faces: where the boundary
goes, who owns the data, what happens when a dependency fails, how an AI system
is evaluated, and how a change reaches production safely.

The learner asked for a full library that combines system architecture and
system design for the AI era and carries the subject through CI/CD. This pack
is that library. It is built in, so a fresh install receives it with no import;
it is researched, so every deck has a source; and it is visual, so every deck
has a photograph or diagram, an animation where a clip cannot carry the idea,
and a verified short video.

## What It Does

A learner who installs the app sees a third built-in pack, **System Design**,
with ten decks:

| # | Deck id | Label | Level | Subject |
| --- | --- | --- | --- | --- |
| 1 | `foundations` | Foundations | beginner | Decisions that are costly to change, boundaries, trade-offs, coupling, scaling |
| 2 | `requirements` | Requirements and constraints | beginner | Quality attributes, latency budgets, availability, estimates, ADRs |
| 3 | `styles` | Architecture styles | intermediate | Monolith, modular monolith, microservices, layers, events, serverless, CQRS |
| 4 | `data` | Data and state | intermediate | Ownership, caches, idempotency, indexes, CAP, replication, schema change |
| 5 | `reliability` | Reliability and operations | advanced | SLOs, error budgets, timeouts, retries, circuit breakers, observability, chaos |
| 6 | `security` | Security and trust | advanced | STRIDE, trust boundaries, least privilege, OWASP, supply chain, SBOM |
| 7 | `ai-architecture` | Designing AI systems | intermediate | LLM dependencies, RAG, embeddings, context, evals, grounding, injection |
| 8 | `ai-engineering` | AI-assisted engineering | intermediate | AI drafting, review gates, generated-code security, tests, provenance |
| 9 | `delivery` | Delivery and DevOps | intermediate | Trunk-based work, DORA, IaC, flags, batching, environments, rollback |
| 10 | `ci-cd` | CI/CD in practice | advanced | Pipelines, Actions, build once, artifacts, secrets, canary, progressive delivery |

Each deck holds exactly ten cards. A card asks one question, accepts a typed,
cloze or pick answer, and carries a teaching layer of one to three parts. The
teaching layer may hold text, a built-in image, and a YouTube video.

### Media inventory

| Kind | Count | Form | Notes |
| --- | --- | --- | --- |
| Photographs | 10 | WebP, max 1600 px, under 600 KB | Wikimedia Commons, credited in `SOURCES.md` |
| Animated diagrams | 10 | SVG with CSS/SMIL and a reduced-motion guard | Original work |
| Static diagrams | 8 | SVG | Original work |
| Videos | 24 | YouTube id + search fallback | Every id verified by oEmbed on 2026-10-29 |

Every deck has at least two images and one video. The media is spread across
decks, not concentrated: a learner meets a new visual in every deck.

### Behavioural spec

**Scenario 1 — the pack arrives with the app.**
Given a fresh app with no packs installed, when the seed runs, then
`/packs/index.json` lists `system-design` at its authored version and the app
installs its ten decks and one hundred cards. Dismissing the pack keeps it
dismissed on later launches.

**Scenario 2 — a deck is a session.**
Given the learner opens the System Design pack, when they choose any deck,
then the study planner treats that deck exactly like an existing deck: same
answering surfaces, same judgement, same evidence rows. No screen is special to
this pack.

**Scenario 3 — teaching is available on every card.**
Given any card in the pack, when the learner opens its teaching layer, then at
least one teaching part appears. At the deck's level the layer opens, folds, or
waits for the answer according to the existing teaching-layer rules.

**Scenario 4 — every deck teaches visually.**
Given any deck, when the learner studies its cards, then the deck contains at
least two built-in images and one video across its teaching layers. Its images
include either a photograph or a static diagram, and its media files exist in
the built bundle.

**Scenario 5 — a video can disappear safely.**
Given a video id that is later removed, when the teaching layer cannot embed
it, then the existing fallback shows the video's stored search phrase and an
"Open on YouTube" link, exactly as the teaching-layers contract says; the card
itself still opens and is still answerable.

**Scenario 6 — the sources are inspectable.**
Given a curious learner or reviewer, when they open
`packs/system-design/SOURCES.md`, then every deck names its references and every
photo and video names its creator, licence or channel.

**Scenario 7 — the old packs are unchanged.**
Given the browser and Polish packs, when the third pack is added, then their
deck counts, cards, images and versions are unchanged, and the seed index
contains all three packs.

### Simulation contract

`docs/features/system-design-course/simulate.sh` reads the built seed and must
print, without a network call:

1. the three packs in `index.json` and the system-design version;
2. the ten decks in order with level and card count;
3. every deck's image and video counts;
4. every referenced built-in image, with a pass or a missing file;
5. a sample card from each deck with its prompt, answer and teaching parts;
6. a final pass line only when all checks hold.

The simulation fails with a non-zero exit when a deck has fewer or more than
ten cards, a teaching layer is empty or longer than three parts, a built-in
image is missing, or a YouTube id is not eleven characters.

## Technical Design

### Pack shape

`v1/packs/system-design/` is a plain pack folder:

```
pack.json                 name, version 1.0.0, language en, 10 topics + levels
cards/<deck>.json         one file per deck, ten cards, sorted read order
images/                   28 assets: 10 WebP photos, 18 SVG diagrams
SOURCES.md                references, video table, photo credits
README.md                 course map and editing instructions
```

`pack.json` lists the topics in course order. `make-seed.mjs` maps a card's
first topic to its `deckId`, so a card's first topic must be its deck id. The
seed builder reads `cards/*.json` in filename order, which is why the ten files
are named after their decks.

### Seed integration

The pack itself adds no app code. The seed builder gains one entry in
`v1/scripts/make-seed.mjs`:

```js
const seedPacks = ["browser-dev", "polish-from-scratch", "system-design"];
```

The seed tests change in the same branch. One app-code change rides with the
pack: D-41 (`v1/src/app/TeachingMedia.tsx`) makes the YouTube player send the
page origin, because YouTube refuses an embed whose request carries no referrer
(player error 153). The course's 24 videos cannot play without it; `docs/drift.md`
owns that change and the seed list above stays the pack's only integration
point.

Running `node scripts/make-seed.mjs` writes:

- `v1/public/packs/system-design.json` — 10 decks, 100 cards;
- `v1/public/packs/system-design/images/` — 28 copied assets;
- `v1/public/packs/index.json` — three entries.

The build does not run make-seed, so authoring a pack always means running it
before a build or a test.

### Schema use

The pack uses `cardSourceSchema` and `teachingPartSchema` without changes.
Answer modes are mixed: `cloze` for sentence completion, `picks` for a single
choice, `type` for short recall. Teaching parts are `text`, `image` with
`source: "builtin"`, and `video` with `source: "youtube"`. No `start`/`end`
values are used because no clip was trimmed.

Built-in images resolve through `withBasePath`, so the same path works at the
site root and under the Pages base path. Animated SVGs render in an `<img>`,
which is why the motion is inside the SVG rather than in app JavaScript.

### Test changes

`v1/tests/seed-packs.test.ts`:

- `PACK_NAMES` gains `"system-design"`;
- the index test now expects all three packs;
- a new `system-design pack` suite asserts every card has a teaching layer,
  every built-in image exists in `public/packs/system-design/images/`, and every
  deck has at least two images including a photograph or static diagram, plus
  one video.

The existing deck, card-count, teaching-length and YouTube-id tests apply to
the new pack automatically because it is in `PACK_NAMES`.

### Failure modes

| Failure | Effect | Guard |
| --- | --- | --- |
| A built-in image is not copied | Broken box in the teaching layer | Seed test stats every referenced file |
| A video id is dead | The embed fails; search fallback remains | oEmbed check during authoring; no runtime guarantee |
| A deck has 9 or 11 cards | Deck tests fail | Exact ten-card assertion |
| A teaching layer has four parts | Seed test fails | 1–3 part assertion in the seed test and the simulation; the app schema does not cap parts |
| Forget to run make-seed | App serves the previous bundle | Test reads the built bundle, not the folder |
| A photo lacks a licence | Legal and trust problem | Every photo is credited in SOURCES.md |

## Non-goals

- No new app screen, route, storage table or runtime server.
- No built-in video files; the app still supports only YouTube/web/local video
  sources for teaching parts.
- No spaced-repetition algorithm change; the pack uses the existing session
  engine.
- No translation; the course is English only.
- No claim that a video will stay online forever; the stored search phrase and
  the teaching-layers "Open on YouTube" fallback are what the app offers, and
  that fallback is the contract.
- No commit, push, pull request or merge as part of this document.
