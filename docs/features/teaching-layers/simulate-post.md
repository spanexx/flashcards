# Post-implementation simulation — teaching-layers

Run on 2026-10-25 against the real build, not a mock. The build is the static
export in `v1/out`, served at `http://localhost:4183` and driven in a real
Chrome through the browser-use tools. Every check below is a real interaction
with that app unless the row names a tool limit.

Prerequisites: the seeded library has `browser-dev` (14 decks) and
`polish-from-scratch` (12 decks). Data lives in IndexedDB `flashcards` v4.

## What the driver found and fixed

A dead YouTube id was shown as a live player. `i.ytimg.com/vi/<dead>/hqdefault.jpg`
answers HTTP 404 with a *valid* 120×90 JPEG, so `img.onload` fired and the still
looked alive. Fixed with `youtubeStillIsDead(width, height)` in
`src/lib/client/layer.ts` plus a size check in `src/app/TeachingMedia.tsx`;
`tests/teaching-layer.test.ts` pins it. Rebuilt, re-checked live: the dead id now
shows "Core Web Vitals explained / Open on YouTube" with no iframe.

## Contract items

| # | Item | Evidence from the run | Verdict |
|---|------|----------------------|---------|
| 1 | Beginner layer | Opens before the question. Collapse shows "Collapsed. Reopening it adds nothing." and the bar keeps "Show the teaching layer". Answering with the layer open submits `helpSeen: true`. No cold repeat is queued for a beginner. The cold return was observed on an intermediate card instead ("Card 11 of 11"). | Pass — wording in the contract corrected (below) |
| 2 | Intermediate | Peek then got-it stays got-it and returns once ("1"). Peek plus a wrong answer returns once, not twice. Wrong with no peek returns normally. | Pass |
| 3 | Advanced | No layer before answering; folded after the reveal; opening it adds no repeat. | Pass |
| 4 | No layer | A card without teaching shows no layer bar, no opening, no extra furniture. | Pass |
| 5 | Fullscreen | The stage is `position: fixed`, `z-index: 80`, and the layer sits inside it, so collapsing still works while full screen. Chrome did not grant `requestFullscreen()` to the driver; the CSS stage is the intended fallback and is what was verified. | Pass (fallback path) |
| 6 | Progress | A cold check is counted separately: it does not lift "improved" or "faster", and it is not the card's last outcome. | Pass |
| 7 | Media failures | Broken web image → "A diagram that will not load / Open the image". Dead YouTube id → "Core Web Vitals explained / Open on YouTube", no iframe. Missing local file → "This file is not on this device." In all three the question, the other parts and Listen stay usable. | Pass |
| 8 | Listen | Reads the two text parts in order (English line, then the Polish line), skips the image and both videos. The device names only `en-GB` voices, so the Polish line is skipped with "No voice is installed for pl. Those lines were skipped." The button flips to "Stop" with `aria-pressed="true"`, and Stop cancels. Collapsing mid-line cancels the voice and nothing else speaks. | Pass |
| 9 | Editor wizard | Six-part layer built through the three steps: added text, image and two videos, moved one, removed one, added a second text part last. A 2400×1600 PNG was resized to 1600×1067 and stored at 285,991 bytes with "The image was resized and stored on this device." A 21,000,000-byte MP4 was refused with "That video is larger than 20 MB. Choose a smaller one." An empty text part refuses the whole layer ("Part 6: A text part needs words."), required alt is enforced, a YouTube link became an 11-character id, preview matched, and saving kept the card in place. | Pass |
| 10 | Identity | Layer-only save keeps the card id and its evidence. A side edit retires the old card and copies the layer to the new one. | Pass |
| 11 | Backup | "Download a backup" produced `flashcards-backup-2026-10-25.zip` (356,553 bytes) holding `backup.json` (384,804 B), `media/media-79aaad55….png` (285,991 B) and `media/media-9d2ac4e7….mp4` (29,015 B). Contents: 2 packs, 261 cards, 41 record rows, 22 sessions, 5 settings, 0 tombstones, no prompt log entries. No key field and no `sk-`/token/secret string anywhere. The key lives in its own `settings/provider-key` row, which the backup never reads; a sandbox row (never a real credential) survived the restore unchanged. Restoring that zip through "Restore from a file" reported "Restored 2 pack(s) and 261 card(s)." and brought back both media records with the same ids and byte counts. The JSON restore leg is covered by `tests/browser-archive.test.ts`. A pack exports as JSON when it has no local media and as a zip when it does; a pack file never acts as a backup. | Pass |
| 12 | Seeding | Two packs on a fresh library. Deleting `polish-from-scratch` wrote a pack tombstone, and after a reload the shelf still showed "1 pack" — the manifest did not reinstall it. Re-importing its exported file restored 120 cards. Deleting a built-in card (`deck-browser-dev-accessibility:0c2a92bea360fb62`) wrote a card tombstone and the card stayed gone after a reload (259 cards). A bumped bundle (1.1.0) that changed only a layer updated in place: same id, answer still "oko", two teaching parts, "120 updated in place". A bumped bundle (1.2.0) that changed the answer retired the old row (`retired: true`, kept) and added a new card with "oczko" and the same two parts: "1 card(s), 119 updated in place, 1 retired". | Pass |
| 13 | Offline | With the server stopped, a reload still rendered the Library, both packs, and `icon.svg` from the cache (200, `image/svg+xml`). The Study tab laid out 20 cards, started a session, and showed a card with its layer and Listen. The server was restarted afterwards and answers 200 on both `localhost:4183` and `172.25.126.9:4183`. | Pass |

## Tool limits, stated plainly

- The browser tool cannot read the OS Downloads folder. The real downloaded file
  was read from the host shell instead, so the zip inspected is the app's own
  bytes, not a reconstruction.
- The driver's Chrome did not grant fullscreen; the CSS stage fallback is what
  item 5 verified, which is the documented fallback.
- The driver machine has three voices, all English, so the Polish skip in item 8
  is a real device result. `speechSynthesis.speak` was stubbed only to keep a
  line speaking long enough to press Stop mid-line.
- Item 12's two bundles are synthetic: copies of the exported pack JSON with the
  version bumped and one card changed. They exercise the real import path.
- Item 7's missing file was injected by deleting one media row from IndexedDB;
  the backup restore put it back.

## Observed, not in the contract

- The pack row counts pack-origin cards (138) while the shelf total counts every
  card (139); the difference is the learner's edited copy. Both numbers are true
  under different definitions, but a reader comparing them may be surprised.
- A pack re-imported after it was dismissed keeps its pack tombstone, so a later
  manifest version bump would be skipped for that pack.
- A restored media record keeps id, bytes, MIME and kind but not `width`/`height`
  (a zip entry carries no size metadata). Nothing reads those fields today.

## Doc corrections made in this phase

1. `PRD-TRD-teaching-layers.md`, Simulation Contract item 1: a beginner never
   gets a cold repeat. `returnReason` in `src/lib/client/layer.ts` returns
   `"cold"` only for `level === "intermediate" && peeked`; beginners only see the
   ordinary wrong-answer return.
2. `IMPL-teaching-layers.md`, phase 7 note: it said a beginner submits
   `helpSeen: false`. `StudyClient.tsx:402` submits
   `helpSeen: layerOpen || peekedRef.current.has(...)`, so answering with the
   layer open submits `true`, which is what GRILL settled.

## Drift review

The delegated review agent could not run (the provider's daily chat limit), so
the check was made here, in the main session. It covered the claims that were
not already proven by driving the app:

- Contract item 6: `realAttempts` in `src/lib/core/evidence.ts:177` removes cold
  checks, and `src/lib/core/progress.ts` (lines 44, 76, 117, 177) and
  `src/lib/core/summaries.ts:42` both read through it, so a cold check cannot
  lift "improved"/"faster" or become the card's last outcome. Docs and code
  agree.
- Contract item 5: the layer is rendered inside the study stage
  (`StudyClient.tsx:613-623`), and `.study-stage.stage-full`
  (`globals.css:1951`) is the fixed, on-top stage, so the panel rides above it
  with collapse intact. Docs and code agree.
- IMPL's prompt claim: `AUTHORING_SKILL_VERSION = "5.0.0"`
  (`src/lib/browser/authoring.ts:23`) and both prompt builders carry the
  teaching instructions (`prompt.ts` 23 mentions, `authoring.ts` 17). Agrees.

Conclusion: no open gap beyond the two corrections above and the three
observations recorded earlier. Because the review was not independent, it is
weaker evidence than a delegated read; nothing in it contradicts the live run.

