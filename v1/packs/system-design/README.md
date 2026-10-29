# System Design (built-in course)

A full beginner-to-advanced library on designing software systems in the AI
era, and carrying them from a commit to production. It ships with the app as a
built-in pack.

## What is inside

Ten decks, ten cards each, one hundred cards total. Each deck has its own photo
or diagram, at least one animation or static diagram, and one to four verified
video clips.

| Deck | Level | What it covers |
| --- | --- | --- |
| Foundations | beginner | Costly decisions, boundaries, coupling and cohesion, scaling, evolvability |
| Requirements and constraints | beginner | Functional vs non-functional, latency budgets, nines, ADRs, trade-off analysis |
| Architecture styles | intermediate | Monolith, modular monolith, microservices, layers, events, serverless, CQRS, event sourcing |
| Data and state | intermediate | Ownership, cache-aside, invalidation, idempotency, indexes, CAP, replication, schema evolution |
| Reliability and operations | advanced | SLI/SLO, error budgets, timeouts, retries, circuit breakers, observability, chaos, degradation |
| Security and trust | advanced | STRIDE, trust boundaries, least privilege, authn/authz, secrets, OWASP, SLSA, SBOM, encryption |
| Designing AI systems | intermediate | LLMs as dependencies, RAG, embeddings, context limits, evals, grounding, tokens, prompt injection |
| AI-assisted engineering | intermediate | AI drafting, review gates, generated-code security, tests, specs, small diffs, privacy, licences |
| Delivery and DevOps | intermediate | Trunk-based development, DORA, infrastructure as code, flags, batching, environments, rollback |
| CI/CD in practice | advanced | Pipeline stages, GitHub Actions, build once, test pyramid, artifacts, secrets, canary, progressive delivery |

## How the media works

- Photographs are WebP, no wider than 1600 px, each credited in `SOURCES.md`.
- Diagrams are original SVGs. The animated ones use subtle CSS or SMIL motion
  and stop when the device asks for reduced motion.
- Videos are YouTube ids verified with oEmbed. The teaching layer also offers a
  search fallback if a clip is removed.

## Editing the course

Cards live in `cards/<deck>.json`. Edit those files, then rebuild the seed:

```bash
cd v1
node scripts/make-seed.mjs
```

The script copies `images/` beside the bundle and rewrites
`public/packs/index.json`. Run `npm test` afterwards: the seed tests check the
deck count, ten cards per deck, teaching-layer limits, video id shape and that
every built-in image exists.

## Sources

`SOURCES.md` lists the book, paper, standard or documentation behind every
deck, plus the creator and licence for every photo and the channel for every
video.
