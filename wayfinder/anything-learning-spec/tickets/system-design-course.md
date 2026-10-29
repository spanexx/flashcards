**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# A built-in System Design course

## Question

The app ships a browser developer course and a beginner Polish course. It does
not teach how to design a software system, and it does not cover the questions
the learner named: system architecture and system design for the AI era,
carried through to CI and CD. The learner asked for a full library with real
images, real short videos, and subtle animations where no video exists, verified
as an inbuilt course with proper evidence and documentation.

## Resolution

- **Built in, not imported.** `v1/packs/system-design/` is read by the seed
  builder, written to `public/packs/system-design.json`, and listed in
  `public/packs/index.json`. A fresh install receives it with no import step.
- **A course, not a card pile.** Ten decks in learning order: foundations,
  requirements, styles, data, reliability, security, designing AI systems,
  AI-assisted engineering, delivery, CI/CD. Ten cards per deck, one hundred
  cards. Levels move from beginner to advanced.
- **The AI era is two decks, not the whole course.** Designing AI systems covers
  LLM dependencies, RAG, embeddings, context limits, evals, grounding, token
  budgets and prompt injection. AI-assisted engineering covers review gates,
  generated-code security, tests, specs, provenance and accountability. The
  durable architecture ideas stay because AI does not remove them.
- **Media is researched and credited.** Ten Wikimedia Commons photographs at
  1600 px, converted to WebP, each with creator and licence. Eighteen original
  SVG diagrams, ten of them animated with a reduced-motion guard. Twenty-four
  YouTube ids, every one checked through oEmbed. `SOURCES.md` names a book,
  paper, standard or vendor documentation for every deck.
- **Animation is the fallback, not the default.** A verified short clip is used
  where one fits. Built-in video files are not supported by the app, so an
  animation ships as a built-in SVG image and plays inside the teaching layer.
- **No schema change.** The pack uses the existing card, teaching and seed
  contracts. Only the seed list and the seed tests change. The browser and
  Polish packs keep their cards, decks, images and versions.
- **The learner's gate stands.** Built, tested and simulated in the worktree;
  no commit, push, pull request or merge without the learner's explicit go. The
  Course Dictionary branch is untouched.

## Evidence

- `v1/packs/system-design/` — manifest, ten deck files, 28 media assets,
  `SOURCES.md`, `README.md`.
- `docs/features/system-design-course/` — GRILL, PRD-TRD, IMPL, `simulate.sh`.
- `v1/tests/seed-packs.test.ts` — the pack joins every shared seed test, plus a
  suite for teaching, image existence and per-deck media.
