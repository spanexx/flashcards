# PRD-TRD: Teaching Layers

**Slug:** teaching-layers
**Status:** Draft
**Date:** 2026-10-25

## Why This Exists

A flashcard asks a question and checks the answer. It never teaches. A learner
who has never seen the idea behind a card can only guess, fail, and guess again.
Adding a paragraph to the question side would corrupt the question; adding it to
the answer side would hide it until too late.

A teaching layer is one optional, ordered set of text, images and videos that
sits beside the card without changing its two sides. The deck's level decides
when it appears: open before the question, folded with a cost for peeking, or
held back until after the answer. The layer never changes how an answer is
judged, never changes the card's identity, and never makes the app need a
provider, a login or a network.

Without it, the two shipped packs are only tests. With it, a beginner can learn
from the first card, and an advanced learner can still try first and read after.

## Behavioral Spec
### Scenario 1: Beginner sees the layer first
**Given** a card whose deck level is beginner and which has a teaching layer
**When** the card appears
**Then** the layer modal opens over the study card before the answer controls,
the question and answer sides are unchanged, and collapsing the modal leaves a
bar that reopens it. The learner can answer while the layer is open or folded.

> **Note (2026-10-26, study-resilience):** automatic opening is a learner choice
> now. The layer header offers "Don't show again" and Settings → Appearance has
> "Open the teaching layer automatically"; either writes the device-local
> `flashcards.teaching` preference. Turning it off never removes the folded bar
> or its manual open, so scenario 1 still holds. See
> `docs/features/study-resilience/PRD-TRD-study-resilience.md` scenarios 1–4.

### Scenario 2: Intermediate starts folded
**Given** a deck at intermediate
**When** a card appears
**Then** the layer is a closed "Show the teaching layer" bar. Pressing it opens
the modal; collapsing it returns the bar. Nothing is added to the session until
the learner opens it before answering. Opening it after the answer adds nothing.
### Scenario 3: Advanced tries first
**Given** a deck at advanced
**When** a card appears
**Then** no layer is visible. After the answer is revealed, a folded "Teaching
layer" bar appears; opening it adds no return and changes no outcome.
### Scenario 4: A card with no layer looks exactly as it does today
**Given** a card with no teaching layer
**When** it is studied at any level
**Then** there is no bar, modal, Listen button or reserved space. A media part on the question side stays content and is never gated by the level.
### Scenario 5: The layer stays above full screen
**Given** the fixed full-stage view or browser fullscreen
**When** the layer opens
**Then** it renders above the stage, can collapse and reopen, and keeps its
state when full screen ends.
### Scenario 6: Peeking adds one cold repeat
**Given** intermediate level and the learner opened the layer before answering
**When** the learner submits any outcome
**Then** the outcome is recorded uncapped and the same card is appended once to
the end of this session with its teaching layer suppressed. That repeat's rows
carry `coldCheck: true`; the first attempt's rows carry `helpSeen: true`.
### Scenario 7: Peek and wrong still returns once
**Given** the learner peeked and then answered Again or No
**When** the answer is submitted
**Then** the card returns exactly once, without the layer, with
`coldCheck: true`. It is not also returned by the normal wrong-card rule.
### Scenario 8: A wrong card that was not helped returns as today
**Given** no help was visible before the answer (beginner layer folded,
intermediate never opened, advanced before reveal)
**When** the answer is Again or No
**Then** the card returns once, keeps its normal layer presentation, and its
rows carry `coldCheck: false`.
### Scenario 9: Help is never a hint
**Given** any level
**When** the learner answers correctly with the layer visible
**Then** the outcome is Got it, not Nearly. The Hint button still caps at
Nearly. There is no fifth outcome and no help-based cap.
### Scenario 10: A cold check is not progress
**Given** a cold-check attempt with a good outcome
**When** progress and the next plan are computed
**Then** the cold-check rows are excluded from "improved", "faster", the last
outcome shown on the progress screen, and scheduling summaries. The card is
scheduled from its real attempts and still returns next session normally.
### Scenario 11: The record says what happened
**Given** any answer
**When** the evidence drawer is opened
**Then** rows show "help seen" and "cold check" when true. A learner correction
copies both flags from the row it corrects.
### Scenario 12: Built-in image
**Given** an image part with `source: "builtin"`
**When** the layer is opened
**Then** the image is served from the app's own `/packs/...` folder through the
app base path, costs no IndexedDB space, and works offline from the app cache.
### Scenario 13: Web image and its failure
**Given** an image part with `source: "web"`
**When** the image loads
**Then** only the URL is stored. If it fails, the layer shows the alt text, an
"Open the image" link and one plain message. The layer still opens, collapses
and leaves the card answerable.
### Scenario 14: Local image
**Given** an image part with `source: "local"`
**When** the learner picks a file in the editor
**Then** the app resizes it to at most 1600 px wide and 1 MB, stores it as a
Blob in the separate media store, and saves the media id in `src`. If it cannot
get under 1 MB, or the file is not JPEG/PNG/WebP, it refuses with a plain
message and saves nothing. The image is included in the full backup and in a
pack export that has local media.
### Scenario 15: Video sources
**Given** a video part
**When** it is rendered
**Then** YouTube uses an 11-character id with optional whole-second `start` and
`end` (`end > start`) and plays through a privacy-friendly embed; a web video
uses a URL; a local video is a file of at most 20 MB stored as a Blob. No
playlists, channels or downloads. The player sends only the page origin as its
referrer, because YouTube rejects an embed whose request carries none (player
error 153); the origin alone still hides the page path from the video host.
### Scenario 16: Video failures
**Given** a dead, private or blocked YouTube id
**When** the layer is opened
**Then** before play the app checks the thumbnail. On failure it shows the
search text and an "Open on YouTube" link instead of a player. A failed web
video shows an "Open the video" link. A missing local file shows "This file is
not on this device" and "Choose the file again", which replaces only that
media id. Every failure is one plain message; there is no spinner loop and no
silent retry.
### Scenario 17: Listen reads the layer
**Given** a layer with at least one text part
**When** the learner presses Listen
**Then** every text part is read once, in order, skipping images and videos; each part uses its own `lang`, or the pack language.
The button toggles to Stop. Collapsing or leaving the layer stops it. Every
press starts from the top; nothing autoplays. It uses the device voice only:
no provider, no network, no stored audio. A missing voice for a part skips that
part and names its language; an unsupported browser disables the button with a
plain message. It never reads the question, the answer, alt text or captions.
### Scenario 18: The teaching editor is a short wizard
**Given** a learner creating or editing a card
**When** they open the teaching section
**Then** they get three steps: the card, the teaching parts, a preview. The same editor opens for any card, whatever its origin. They can
add text, image or video rows, move them up or down, and remove them. Text is
plain multiline. Image alt text is required; the image is a web address or a
local file (no builtin option). Video is YouTube, web or local with optional
start/end and search text. The preview shows the parts in display order.
### Scenario 19: Layer-only edits keep the card
**Given** an existing card
**When** the learner changes only its teaching layer
**Then** the card is updated in place: same id, same evidence, no retired copy.
This is a separate action from editing the question or answer. When a side is
edited, a new card is created, the old one is retired with its evidence, and
the teaching layer is copied to the new card.
### Scenario 20: Authors write layers too
**Given** the generation prompt, the copyable authoring skill, or an imported
batch
**When** cards are produced
**Then** each card may carry a short teaching layer with optional media and no
answer inside explanations (except the built-in word packs, where the layer is
the teaching). A missing layer is valid. A malformed layer refuses the whole
batch through the existing all-or-nothing rule. A model may suggest a YouTube id, time range and search text, but it is never treated as verified. A pack author's curated video is never replaced by the model; a learner replacement is stored on the card and wins.
Every Generate target asks for the layer — a whole pack, a new deck, or cards
added inside an existing deck — including when the pack file ships its own
generation template, and the rule appears once in the prompt.
### Scenario 21: Levels belong to decks
**Given** any pack file or bundle
**When** decks are read
**Then** each deck has `beginner`, `intermediate` or `advanced`; a missing level
means intermediate. Old bundles without levels import unchanged. A new deck
defaults to the learner's global level, and its creator may pick another level
in the same form. Changing a level changes presentation only. The global setting
remains the generation fallback when no deck is chosen. No stored setting is renamed or migrated.
A pack or deck produced by Generate is a new container, so it is stored at the
learner's global level. Cards generated inside an existing deck are prompted at
that deck's level, and a deck without one behaves as intermediate.
### Scenario 22: Built-in packs install and update themselves
**Given** the seed manifest at `/packs/index.json`
**When** the app starts
**Then** a listed pack that is not installed and not dismissed is installed; a
newer version is applied additively; an equal or older version is ignored. A
removed built-in pack stays dismissed; a deleted built-in card stays deleted
while its content is unchanged. A failure is silent, retried next start, and
never blocks the app.
### Scenario 23: Pack updates respect the learner
**Given** an installed pack and a newer whole-pack bundle
**When** it is imported
**Then** a card whose sides are unchanged but whose layer changed is updated in
place; a card whose sides changed is added as a new card and the old one is
retired with its evidence; a deck keeps its name but takes the bundle's level.
A deck or card fragment never retires anything.
### Scenario 24: Backup is a zip with the media
**Given** local images or videos
**When** the learner exports a full backup
**Then** the file is a zip holding `backup.json` (packs, decks, cards, evidence, sessions, settings, prompt log) and a `media/` folder with the Blobs as-is. Restore accepts that zip, or an older JSON backup whose local media is simply missing. The provider key is never in either. Autosave rewrites the
same zip on desktop; an old `.json` handle is disconnected and the learner is
asked to choose a `.zip` file once.
### Scenario 25: A shared pack carries its media
**Given** a pack with local media
**When** it is exported
**Then** it is a zip of `pack.json` plus `media/`; a pack with no local media is
still one JSON file. Import accepts both by file picker, plus the existing paste
path. An export holds no evidence, sessions, settings or key. Import never
overwrites media already on the device, built-in and web media are not copied, and a pack file never acts as a backup.
### Scenario 26: The two built-in packs
**Given** a fresh library
**When** seeding finishes
**Then** two packs exist, ten cards per deck, with these decks:

- **Browser Dev** (English, text + simple SVG). Beginner: How the Browser Works, DevTools Basics, Elements and the DOM, Styles and the Box Model, Console, Responsive and Device Mode. Intermediate: Network, Sources and Debugging, Application and Storage, Accessibility. Advanced: Performance, Memory and Leaks, Security Essentials, Debugging Recipes.
- **Polish from Scratch** (Polish, all beginner, single words, meaning plus pronunciation): Greetings, Written, Numbers, People and Family, Food and Drink, Home and Rooms, Common Verbs, Time and Days, Places and Travel, Shopping and Money, Body and Health, Weather and Seasons.

No videos ship unless a working YouTube id is supplied. A person checks every fact and every Polish word before release; the app cannot verify either.

## Simulation Contract

The post-impl browser simulation must drive the real app and show each item:

1. Beginner auto-open, collapse, reopen, answer with help (`helpSeen: true`), no cold repeat — peeking costs a return only at intermediate — and the `helpSeen`/`coldCheck` rows in the drawer.
2. Intermediate: peek, got-it stays got-it, one repeat; peek plus wrong returns once; no-peek wrong returns normally.
3. Advanced: no layer before, folded after reveal, opening adds no repeat.
4. Card with no layer adds no furniture.
5. Fullscreen: layer above the stage, collapse intact.
6. Progress excludes a cold check from improved/faster and from last outcome.
7. Media failures: broken web image, dead YouTube id, missing local file; the card and layer stay usable and each shows one plain message.
8. Listen order, Stop, stop-on-collapse, media skipped, missing-voice message.
9. Editor wizard: add/move/remove all three kinds, local image resize and video cap refusal, required alt, YouTube id extraction, preview, save in place.
10. Identity: layer-only save keeps id and evidence; side edit retires the old card and copies the layer.
11. Backup zip round trip with a local image and video; JSON backup restore without media; pack zip only when local media.
12. Seeding: two packs, dismissed pack stays dismissed, deleted card stays deleted, layer-only update in place, changed side retires the old card.
13. Offline reload with network disabled: app, built-in packs and built-in SVG still work.

## Technical Design

### Data Models

```ts
type TeachingPart =
  | { type: "text"; text: string; lang?: string }
  | { type: "image"; source: "builtin" | "web" | "local"; src: string; alt: string }
  | { type: "video"; source: "youtube" | "web" | "local"; src: string;
      start?: number; end?: number; search?: string; alt?: string };

interface Deck { id: string; name: string; level: "beginner" | "intermediate" | "advanced" }
// Card and CardSource gain teaching?: TeachingPart[]
// EvidenceRow gains helpSeen?: boolean and coldCheck?: boolean (optional for old rows)

interface MediaRecord { id: string; blob: Blob; mime: string; kind: "image" | "video";
  width?: number; height?: number; bytes: number; createdAt: string }
interface Tombstone { id: string; kind: "pack" | "card"; at: string }
```

- `src` is an app path for builtin, an http(s) URL for web, an 11-character id
  for YouTube, and `media-<uuid>` for local (a colon is not safe in a zip file
  name on Windows, so the separator is a dash).
- The bundle `deckSchema` gains `level` with a default of intermediate. The
  bundle/backup card schemas gain `teaching`; the backup evidence schema gains
  both flags and an optional `tombstones` list.
- `STORE_NAMES` gains `media` and `tombstones`; IndexedDB version 3 → 4, only
  adding stores.
- Seed manifest: `{ schema: "flashcards.pack-index/v1", packs: [{ name,
  version, file, media? }] }`.

### API Contracts

- `PATCH /api/cards/:id/teaching` with `{ teaching: TeachingPart[] | null }`
  updates in place and returns `{ card }`. The existing `PATCH /api/cards/:id`
  still mints a new card for side edits.
- `POST /api/answer` accepts `helpSeen` and `coldCheck` and writes them on every
  region row; `makeCorrectionRow` copies them.
- `GET /api/packs` returns decks including `level`.
- `src/lib/browser/media.ts`: `storeImageFile`, `storeVideoFile`, `getMedia`,
  `mediaUrl`, `deleteUnreferenced`, `readAllMedia`.
- `src/lib/browser/archive.ts`: `exportBackupZip`, `restoreBackupFile`,
  `exportPackArchive`, `importPackFile`; zip work is delegated to fflate.
- `src/lib/browser/seed.ts`: `ensureSeeded`, `dismissPack`, `deleteBuiltInCard`,
  `seedState`; called by the router before reads.
- `src/lib/client/layer.ts`: `deckLevelFor`, `layerPolicy`, `layerSpeech`,
  `youtubeEmbed`, `validateTeachingPart`; pure and testable.

### Dependencies

- **fflate 0.8.3** (MIT, zero dependencies, actively used, ~797 KB unpacked):
  zip read/write in both browser and Node tests. Alternatives: JSZip (larger,
  heavier API), a hand-written store-only zip (still needs inflate to accept
  other zips).
- Browser APIs already required by the app: IndexedDB, Blob, Canvas,
  Fullscreen, File System Access for autosave, and SpeechSynthesis for Listen.
  None is a network service.
- No new server, database, account or provider requirement.

### Architecture Notes

- **Identity.** `canonicalContent` in `core/card.ts` keeps its explicit field
  list and deliberately omits `teaching`. Layer-only edits use the new route;
  side edits keep the existing retire-and-copy flow. A test locks both.
- **Study queue.** `StudyClient` currently keys results by card id, so a returned
  card would reuse an old result. Queue entries become
  `{ entryId, card, coldCheck, suppressTeaching }`; results, answers and hints
  are keyed by `entryId`. One pure helper decides the returns, so the rule is
  testable without React.
- **Levels.** The card carries `packName` and `deckId`; the study screen resolves
  the deck from the loaded pack list. Missing deck or level means intermediate.
  The global `Settings.level` is never used for presentation.
- **Pack reconciliation.** Whole-pack import computes incoming card ids per
  deck, updates matching cards' teaching and version in place, retires
  pack-origin cards in those decks whose ids disappeared, and applies deck
  levels. Fragments only add.
- **Media lifecycle.** Object URLs are created when a layer opens and revoked on
  close. Saving a layer or deleting a card removes local media no card
  references, including retired cards. Media is never deleted during restore.
- **Offline.** `scripts/build-pwa.mjs` already precaches every file in `out/`, so
  `public/packs/index.json`, pack JSON and built-in SVG are covered. A check is
  added to `scripts/check-pwa.mjs` so a missing pack file fails the build.
- **Safety.** Text parts render as text, never HTML. Web media must be http(s);
  `javascript:`, `data:` and other schemes are refused. Images/videos use
  `referrerpolicy="no-referrer"`; YouTube uses `youtube-nocookie.com`. The
  provider key, evidence and learner text never enter a pack export.
- **Content.** `scripts/make-seed.mjs` builds both bundles and the manifest from
  `packs/browser-dev/` and `packs/polish-from-scratch/`, including levels and
  teaching. The old `polish-starter` stops being seeded; existing copies stay
  until their owner removes them. Facts and Polish wording need a human check
  before release; this is recorded as a release gate, not automated.

### Decisions Resolved Here

These are not in the GRILL and need approval: zip via fflate; media ids as
`media-<uuid>`; local media garbage-collected when unreferenced; cold-check
rows excluded from progress **and** scheduling; whole-pack updates reconcile
(update layer-only, retire changed); tombstones for dismissed packs and deleted
built-in cards; autosave `.json` handles disconnected once; a deck level picker
on the pack/deck creation form defaulting to the global level.

## Non-Goals

- No code, speak or blank part in a teaching layer; only text, image and video, and the card sides stay untouched.
- No per-card level override and no bulk level editor.
- No fifth outcome, no change to the Hint cap, no help-based scoring.
- No stored or generated audio for Listen; device voice only.
- No playlists, channel sections, video downloads or transcripts.
- No automatic fact checking of built-in content.
- No video re-encoding; local video is stored as-is under 20 MB.
- No server-side storage and no new account.
- No migration that invents media for old JSON backups.
- No layer support for retired cards in the study queue.

## Out of Scope (Future)

- Exam and test sessions (locked elsewhere as a later conversation).
- Caption or transcript search inside a video.
- Sharing one media file between many cards with reference counting.
- A learner-facing tool to manage media storage size.
- Provider-authored media generation (images or video).
- Screen-reader-only summaries for diagrams beyond alt text.

## References

- `docs/features/teaching-layers/GRILL-teaching-layers.txt` — locked decisions
- `docs/features/teaching-layers/simulate-pre.html` — approved pre-impl sim
- `v1/src/lib/shared/types.ts` — Card, Deck, EvidenceRow, CardPart
- `v1/src/lib/core/card.ts` — canonicalContent, buildCard, hardRuleIssues
- `v1/src/lib/browser/{store,repository,bundle,router}.ts` — storage, import/export, routes
- `v1/src/app/StudyClient.tsx` — study queue, answers, evidence and full screen
- `v1/src/lib/provider/prompt.ts`, `v1/src/lib/browser/authoring.ts` — generation and skill
- `scripts/make-seed.mjs`, `scripts/build-pwa.mjs`, `scripts/check-pwa.mjs` — seed and offline
- `wayfinder/anything-learning-spec/tickets/{card-shape,browser-owned-packs,evidence-model,session-loop,ui-shell,pack-shape,answering-surface}.md`
- `docs/ethics/drift.md` — drift gates
