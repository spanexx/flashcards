# PRD-TRD: Browser-owned flashcards

**Slug:** browser-app
**Status:** Approved (blanket learner approval, 2026-10-20)
**Date:** 2026-10-20

## Why This Exists

The v1 prototype runs a local server and keeps learner data on disk. The learner
wants a hosted page they can open anywhere, with no access from the host to
their data. The only honest shape for that promise is a static browser build
whose library lives in IndexedDB and whose provider calls go straight from the
browser to the learner's own provider.

The prototype's flat "topic" grouping also does not match how the learner
thinks about content. A subject is a pack; inside it are decks; inside a deck
are cards. Decks are stored containers, while tags stay free labels. The same
one-file pack bundle serves create, import and export, so those three paths
cannot drift.

## Behavioral Spec

### Scenario 1: First open

**Given** a browser with no stored library
**When** the learner opens the app
**Then** the Polish starter pack is seeded: one pack, six decks (cases, aspect,
agreement, past-tense, basics, questions), its cards, and no evidence.

### Scenario 2: Create a pack and a card

**Given** the Library screen
**When** the learner creates a pack with one deck and writes one card into it
**Then** the pack and card appear immediately, survive a reload, and the card
is schedulable.

### Scenario 3: Import a whole pack

**Given** a valid pack bundle file or pasted JSON
**When** the learner imports it as a new pack
**Then** a new pack with its decks and cards appears; a broken bundle is refused
as a whole with the offending item and field named.

### Scenario 4: Add cards or a deck to an existing pack

**Given** an existing pack
**When** the learner imports cards into a chosen deck, or a deck into the pack
**Then** only new content is added; a repeated card is reported as a duplicate;
nothing is deleted or moved.

### Scenario 5: Re-import a newer pack version

**Given** an installed pack
**When** the learner imports the same name with a newer version
**Then** new decks and cards are added, existing cards keep their evidence, and
an older version is refused with a plain reason.

### Scenario 6: Study across decks

**Given** cards in several decks
**When** the learner starts a session
**Then** the plan may draw from any deck, groups name the decks, and every card
can be answered; imported cards behave like every other card.

### Scenario 7: Provider off and on

**Given** no key
**When** the learner studies and asks for a hint
**Then** pack hints and the learner's own judging still work; generation says a
provider is needed.
**Given** a key in IndexedDB
**When** the learner tests the provider or generates cards
**Then** the browser calls the provider directly, the prompt is shown first, the
prompt log records it locally, and the host is not involved.

### Scenario 8: Backup and restore

**Given** a library with packs and evidence
**When** the learner backs up everything
**Then** one JSON file contains packs, decks, cards, evidence, sessions and
settings, and never the key.
**When** the learner restores it
**Then** after confirmation the library is replaced exactly; a malformed backup
is refused as a whole.

### Scenario 9: Autosave

**Given** desktop Chrome or Edge
**When** the learner connects a backup file and changes the library
**Then** the same file is rewritten after the change; a phone offers "Save a
backup now" instead.

### Scenario 10: The authoring skill

**Given** no provider
**When** the learner picks a target and copies the authoring prompt into a
browser chat, then pastes the answer back
**Then** the JSON is validated and imported by the normal path; a bad answer is
refused with the item and field named.

## Simulation Contract

The post-implementation simulation walks the scenarios against the real store
logic using the memory adapter, then checks the static build:

```bash
npm run simulate:browser
# -> seeds the Polish pack: 1 pack, 6 decks, 32 cards
# -> creates a pack + deck + card; reload keeps it
# -> imports a pack; bad bundle refuses with field names
# -> imports cards into a deck; duplicate reported
# -> newer version adds; older version refused
# -> plan draws across decks
# -> no-key hint falls back; key-present path is named
# -> backup excludes the key; restore replaces
# -> authoring prompt names the target's real ids
```

## Technical Design

### Data Models

- `PackRecord` (browser): `{ name, version, description?, language?, decks:
  Deck[], prompts: PackPrompts | null, createdAt, updatedAt }`.
- `Deck`: `{ id, name }`, id lowercase-hyphen, stable across versions.
- `Card`: the v1 flat card plus `packName` and `deckId`; `topics` is derived
  from the deck name so the existing plan, progress and prompt code keeps
  working without a second grouping idea.
- `PackBundle` (zod): `{ schema: "flashcards.pack/v1", pack: { name, version,
  description?, language?, prompts? }, decks: Deck[], cards: Array<CardSource &
  { deckId }> }`. Bundle cards do not carry `topics`; the deck supplies it.
- `BackupBundle`: `{ schema: "flashcards.backup/v1", exportedAt, packs, cards,
  evidence, sessions, settings, prompts }`.

### API Contracts

The screens keep their URL-shaped calls. `apiGet`/`apiSend` route to
`lib/browser/router.ts`, which implements the same answers locally:

- `/api/packs` (GET), `/api/packs/import` (POST), `/api/packs/export`
- `/api/packs/rescan` becomes a no-op that reports the browser library
- `/api/cards` (GET/POST), `/api/cards/:id` (PATCH/DELETE)
- `/api/cards/import` (POST, cards into a deck)
- `/api/plan?offer=`, `/api/answer`, `/api/session/end`
- `/api/evidence`, `/api/evidence/correction`
- `/api/progress`, `/api/prompts`
- `/api/settings`, `/api/provider/key`, `/api/provider/test`,
  `/api/provider/prepare`, `/api/provider/generate`, `/api/provider/hint`
- `/api/backup/export`, `/api/backup/restore`; autosave is a direct browser
  module call, not a URL route.

### Dependencies

No new runtime dependency. The static export uses the existing Next.js, React,
Zod and semver packages. IndexedDB is a browser API; tests use a memory adapter
with the same interface, so no test-only package is required.

### Architecture Notes

- `lib/browser/store.ts` — the key-value seam (IndexedDB adapter, memory
  adapter).
- `lib/browser/repository.ts` — domain reads and writes over the store.
- `lib/browser/bundle.ts` — schema, validation, import/export, seed.
- `lib/browser/provider.ts` — status, test, prepare/generate/hint, direct fetch.
- `lib/browser/router.ts` — the URL-shaped local API used by the screens.
- `lib/client/api.ts` — same signatures, now calling the router.
- Pure core (`judge`, `plan`, `progress`, `evidence`, `prompt`, `generate`)
  moves to browser-safe imports: a synchronous hash, global `randomUUID`, no
  `server-only`.

### Non-Goals

- No accounts, no server storage, no telemetry, no third-party scripts.
- No cloud/WebDAV sync; desktop file autosave only.
- No deck rename/merge/delete, no exam mode, no pack marketplace.
- No media upload; attachments remain references.
- No multi-tab conflict resolution; last write wins, the browser is one user.

## References

- `wayfinder/anything-learning-spec/tickets/browser-owned-packs.md`
- `wayfinder/anything-learning-spec/tickets/deck-import.md`
- `wayfinder/anything-learning-spec/tickets/authoring-skill.md`
- `docs/features/v1-prototype/` — the learning-loop record
- `docs/features/browser-app/GRILL-browser-app.txt`
- `docs/features/browser-app/IMPL-browser-app.md`
