**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** T12

# What owns the data: browser-owned packs, decks and cards

## Question

Victor wants the app hosted so learners open it in a browser, with no access
from the host to learner data, and packs living in the learner's IndexedDB.
The platform becomes pack -> deck -> card: a pack is a subject
("polish-starter", "music notes", "spanish-english"), a pack holds decks, a
deck holds cards, and a card is the smallest unit. A learner must be able to
create or import a pack with at least one deck and a few cards.

Decide: that packs, decks, cards, evidence, sessions, settings and the prompt
log live only in IndexedDB; that the app is a browser build with no server-side
storage; where the provider key lives and whether calls go from the browser
straight to the provider or through the host's server; whether a deck replaces
the old topic word or decks and tags coexist; the pack/deck/card file shape used
for import and creation; and how a learner exports and restores the library when
browser storage is the only copy.

Constraints inherited, not re-litigated here: no learner data on the host's
server; packs are plain files and never running code; import is all-or-nothing;
broken packs are named and never block the app; card identity is provenance plus
content; the app is fully usable with no provider.

## Answers given so far

1. What is the platform shape? -> pack -> deck -> card. A pack is a subject, a
   pack holds decks, a deck holds cards, a card is the smallest unit. A card
   belongs to exactly one deck.
2. Does a deck replace the old topic? -> Yes. The pack declares its decks the
   way it declared topics (Polish starter: cases, aspect, agreement,
   past-tense, basics, questions). Tags stay as free cross-cutting labels.
3. Is the algorithm fixed to one deck? -> No. A deck is a container, not a
   session boundary. A lesson may draw cards from different decks, and exams or
   tests will too; exam/test design is a later conversation, noted now.
4. What does a pack look like when created or imported? -> One bundle holding
   the pack, its decks and its cards (plus optional prompts). The same bundle is
   used for import and export; the in-app create form builds it. A pack with no
   local media is one JSON file. A pack with local media is a zip holding
   `pack.json` plus a `media/` folder. At least one deck is required; cards may
   start empty.
5. How do provider-less learners create content? -> A copyable "authoring
   skill": a prompt a learner pastes into a browser chat (for example
   ChatGPT), which returns the same JSON to paste or load into the app. It must
   cover a whole pack, or just decks, or just cards, so the platform needs an
   import target for partial files. The prompt itself is a deliverable, built
   once the JSON shape is locked.
6. Where do partial files land? -> A whole pack file creates a new pack. A
   deck-only or card-only file goes into a pack the learner picks, and a
   card-only file also picks a deck. The app generates the copyable prompt for
   that exact target so names and ids match the real containers.
7. Where does the provider key live, and who calls the model? -> In the browser,
   in IndexedDB; the browser calls the provider directly, with no relay through
   the host's server. The host never sees the key or a prompt. Costs accepted:
   any script on the page could read the key (so no third-party scripts), and
   some providers or local models block browser calls (CORS); with no key the
   app still works and generation/tutoring stay off.
8. What happens when a pack name already exists on import? -> Additive update:
   same name and a newer version adds decks and cards and updates existing ones
   by identity, so evidence survives. No import deletes a card; removal is a
   separate learner action, and an older version is refused with a plain reason.
9. How does a learner back up and restore? -> Three paths. "Back up everything"
   is one zip file holding `backup.json` (all packs, decks, cards, evidence,
   sessions and settings, never the key) plus a `media/` folder with every local
   image and video. "Restore" replaces the whole library after a confirmation;
   per-pack import stays the merge path. "Export this pack" is content only, no
   evidence, for sharing; it is a zip when the pack has local media and plain
   JSON when it does not.
10. Can the library autosave? -> Partly. On desktop Chrome or Edge, the learner
    picks a backup file once and the app rewrites it after changes (File System
    Access API; installing the site as an app helps the permission stick). Phone
    browsers have no silent file autosave, so phones get "Save a backup now"
    plus a reminder. Cross-device autosave needs a cloud drive or WebDAV and is
    a later ticket.
11. What happens to the current prototype data? -> Convert the Polish starter
    pack: its six topics become six decks. Cards carry over. The prototype
    evidence and logs are test data and are left behind.

## Conflicts with locked decisions

- **How the learner opens the app** (`how-you-open-it.md`) locked a local
  process on loopback holding the key; a hosted browser app replaces that reach
  and the OS key store role.
- **Privacy boundary** (`privacy-boundary.md`) locked the OS key store and "the
  front end provably never holds the key"; browser storage reverses that for the
  hosted build.
- **A pack's shape** (`pack-shape.md`) locked one local folder scanned at
  startup; browser-owned packs need a different discovery and install path.
- **What goes on a card** and **Evidence** treat topics as read-time grouping; a
  deck is a stored container and changes identity and grouping.
- **A deck you brought yourself** (ticket 12) was unblocked by this ticket and
  resolved on 2026-10-20; it inherits the bundle and import-target answers.

## Notes

- The pure core (judge, plan, progress, evidence math) is portable to the
  browser; the storage and API layers are the rewrite.
- Clearing site data wipes the library; export/restore is part of the answer.
- A hosted HTTPS page may not reach a learner's local model on
  `http://localhost:3001` without CORS and private-network consent.

## Resolution

1. **IndexedDB is the only store.** Packs, decks, cards, evidence, sessions,
   settings and the prompt log live in the learner's browser. The build has no
   server-side storage: the host serves files, nothing else. No learner data
   reaches the host.
2. **Hierarchy.** pack -> deck -> card. A card belongs to exactly one deck; the
   pack declares its decks. Decks replace topics; tags stay free cross-cutting
   labels. A deck is a container, not a session boundary: lessons and later
   exams may draw across decks.
3. **One bundle.** A pack is one bundle: pack, decks, cards, optional prompts.
   It is a plain JSON file when the pack has no local media, and a zip holding
   `pack.json` plus `media/` when it does. The in-app create form builds it;
   import and export use it. At least one deck; cards may start empty. A whole
   pack creates a new pack; decks-only or cards-only go into a chosen existing
   pack (cards also choose a deck). Same name plus a newer version updates
   additively by identity and evidence survives; no import deletes a card; an
   older version is refused with a plain reason.
4. **Provider direct.** The key lives in IndexedDB and the browser calls the
   provider directly, with no relay. The host never sees the key or a prompt.
   No third-party scripts. CORS may block some providers or local models; with
   no key the app still works and generation/tutoring stay off.
5. **Backup.** A full backup is a zip holding `backup.json` (packs, decks,
   cards, evidence, sessions and settings, never the key) plus a `media/` folder
   with local images and videos. Restore replaces the library after
   confirmation; per-pack export is content only and uses the zip rule when the
   pack has local media. Desktop Chrome or Edge can autosave to a learner-picked
   file; phones save manually; cloud/WebDAV sync is later.

   Revised 2026-10-25 by `docs/features/teaching-layers/GRILL-teaching-layers.txt`
   (entries 16 and 17), because local videos cannot ride in a JSON file without
   growing by about a third and being rewritten on every autosave.
6. **Authoring skill.** A copyable, target-tailored prompt lets provider-less
   learners make a pack, decks, or cards in a browser chat and bring the JSON
   back. Ticket 17.
7. **Migration.** Convert the Polish starter pack's topics to decks, carry the
   cards, leave the prototype evidence and logs behind.

## What this supersedes

- **How the learner opens the app:** the local process and OS key store are
  history for this build; the hosted browser holds the key.
- **Privacy boundary:** the key-store wording is replaced by the browser-held
  key; the rest (visible categories, no-provider usability) stands.
- **A pack's shape:** local-folder discovery is replaced by the bundle plus
  IndexedDB; plain-files-never-code, name-plus-version identity, and named
  broken packs stand.
- **Card shape and evidence:** topics as read-time grouping are replaced by one
  stored deck plus free tags; strength and weakness are still computed at read
  time.
- **A deck you brought yourself (ticket 12)** is unblocked and inherits the
  bundle and import-target answers.

## Why

The learner asked for a hosted app with no host access to their data;
IndexedDB plus direct provider calls is the only shape that keeps that promise.
The deck gives stored containers while tags keep cross-cutting grouping. One
bundle means create, import and export cannot drift. Browser storage is the
only copy, so backup and autosave are part of the answer, not polish.

**Source:** learner conversation, 2026-10-20.
