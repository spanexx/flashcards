# Drift review — System Design course pack

**Date:** 2026-10-29  
**Reviewer:** sub-agent (fresh-eyes, read-only)  
**Verdict:** **Minor Drift**

> Author's note, added after the review: the player entry this report calls
> D-32 is now **D-41**, because the course-dictionary branch had already used
> D-32–D-40. The suggested D-33–D-36 ids below were never assigned; those gaps
> were closed as documentation, test and simulation edits.

## Summary

| Area | Gaps |
| --- | --- |
| Contract vs code/content | 3 |
| Execution vs IMPL | 4 |
| Simulation | 2 |

The pack itself is built and healthy. It has 10 decks and 100 cards, 28 media assets (10 WebP photographs, 10 animated SVGs, 8 static SVGs), and 24 YouTube ids. Every referenced image exists in both the source folder and the built bundle; every image is under 1 MB (the largest is 520 KB); every photo is 1600 px wide; every video id is 11 characters; all 24 ids answered oEmbed on 2026-10-29 and every channel matches `SOURCES.md`; every image and video part has non-empty alt text; and every video part has search text. The seed lists three packs, `make-seed.mjs` includes the new pack, the built bundle has 10 decks and 100 cards, and `v1/tests/seed-packs.test.ts` passes all 14 tests. The build export exists under `/flashcards`, and `check-pwa.mjs` passes with that base path.

The gaps below are documentation accuracy, one inherited video-failure behaviour, one weak test name, and the simulation's sample output. None prevents a learner from using the pack.

## Simulation result

Command run from Windows:

```text
wsl.exe -d Debian -- bash -lc 'cd /home/spanexx/.config/superpowers/worktrees/flashcards/feature-system-design-library && bash docs/features/system-design-course/simulate.sh'
```

The script exited 0 and ended with `PASS: 0 problem(s)`. It printed:

- all three built-in packs at 1.0.0, including `system-design 1.0.0 /packs/system-design.json`;
- `Bundle: system-design 1.0.0`, `Decks: 10  Cards: 100`;
- a deck table with 10 rows in course order, each 10 cards, 2–3 images and 2–4 videos;
- `Unique built-in images: 28`, followed by 28 `ok` lines with file sizes;
- one “taught card per deck” line and its part types;
- `PASS: 0 problem(s)`.

It did not print a prompt or an answer for any sample card, and it did not print the teaching text or media source of any part. It printed only the card summary and part type names.

Only `simulate.sh` exists in the feature folder; there is no pre-implementation simulation to compare against. The design baseline for this review is therefore the PRD-TRD wording, not a pre/post simulation pair.

### Contract items

| # | PRD contract item | Demonstrated? | Note |
| --- | --- | --- | --- |
| 1 | Three packs in `index.json` and the system-design version | Yes | Printed all three; checks the system-design version against the bundle. Does not require exactly three entries (see S2). |
| 2 | Ten decks in order with level and card count | Yes for this bundle | Printed 10 rows in bundle order. Does not assert the count or compare it to `pack.json` (see S2). |
| 3 | Every deck’s image and video counts | Yes | Printed per-deck counts. |
| 4 | Every referenced built-in image with pass or missing | Yes | 28 `ok` lines; missing files would fail and print `FAIL`. |
| 5 | A sample card from each deck with prompt, answer and teaching parts | **No** | Prints summary and part types only (see S1). |
| 6 | Final pass line only when all checks hold | Yes for implemented checks | `process.exitCode` is set to 1 on any failure; prints `PASS` only when `failures.length === 0`. |

## Contract gaps

### C1. “Only the seed list and the seed tests change” is false for the delivered branch

**Expected**

> “The only code change is one entry in `v1/scripts/make-seed.mjs`:” — `docs/features/system-design-course/PRD-TRD-system-design-course.md:135`

> “Only the seed list and the seed tests change.” — `docs/features/system-design-course/GRILL-system-design-course.txt:95-96`

**Found**

The delivered branch also changes the YouTube player and its test:

- `v1/src/app/TeachingMedia.tsx:220` changes `referrerPolicy="no-referrer"` to `referrerPolicy="strict-origin-when-cross-origin"`.
- `v1/tests/teaching-layer.test.ts:260-265` adds the “sends the page origin and never a missing referrer” test.
- `docs/drift.md:21-28` records this as D-41 and names `system-design-course` as related.

The actual seed-list change is at `v1/scripts/make-seed.mjs:18`; the index entry is in `v1/public/packs/index.json`.

**Plain-English impact**

A reviewer reading the PRD would think this feature is data-only. In reality the course’s 24 videos only play because of a separate player fix. The claim understates the change surface and invites someone to revert the player fix while “restoring” the documented scope.

**Recommendation: update docs.** Scope the “only” sentence to the pack itself and add a cross-reference to D-41. No code fix is needed; D-41 already owns the player change.

### C2. A removed video’s “search fallback” is a dead watch link, not a search

**Expected**

> “Given a video id that is later removed, when the teaching layer cannot embed it, then the existing search fallback still offers the learner a way to find the topic.” — `docs/features/system-design-course/PRD-TRD-system-design-course.md:83-86`

> “the search fallback is the contract.” — `docs/features/system-design-course/PRD-TRD-system-design-course.md:194-195`

**Found**

When the thumbnail probe says the video is dead, `v1/src/app/TeachingMedia.tsx:199-205` renders:

- message `youtubeFallbackLabel(part)`, which returns `part.search` text (`v1/src/lib/client/layer.ts:174-176`);
- link `youtubeWatchUrl(part.src, part.start)`, which builds `https://www.youtube.com/watch?v=<id>` (`v1/src/lib/client/layer.ts:168-170`).

All 24 video parts have non-empty `search` text (for example, `v1/packs/system-design/cards/foundations.json:42`), but the link is the same dead watch page, not a search-results page. There is no `youtube.com/results?search_query=` link anywhere in the rendering path.

**Plain-English impact**

The card still opens and is still answerable, but if a video is removed the “Open on YouTube” button leads to a video that no longer exists. The search phrase is only a label; it does not help the learner find a replacement. The promise “a way to find the topic” is stronger than the code.

**Recommendation: update docs, or log drift against teaching-layers.** The smallest fix is to make the PRD match the existing teaching-layers contract (“search text and an Open on YouTube link”). If the product promise must hold, change `youtubeWatchUrl` or the failure link to a YouTube search URL; that is a teaching-layers code change, outside the pack data.

### C3. The 1–3 part guard is a seed test, not a schema test

**Expected**

> “A teaching layer has four parts | Schema test fails | 1–3 part assertion” — `docs/features/system-design-course/PRD-TRD-system-design-course.md:182`

**Found**

- `v1/src/lib/core/schema.ts:165-168` declares `teaching: z.array(teachingPartSchema).min(1).optional()`; there is no `.max(3)`.
- The limit is enforced by `v1/tests/seed-packs.test.ts:94-95` (`toBeLessThanOrEqual(3)`) and `docs/features/system-design-course/simulate.sh:57`.

The pack itself complies: the 100 cards have 48 one-part layers and 52 two-part layers, so no layer exceeds three.

**Plain-English impact**

For the built-in pack, CI catches a four-part layer. The schema does not. The doc names the wrong guard, and a learner-generated or imported four-part layer outside the seed test could still pass schema validation. This does not affect the current pack.

**Recommendation: update docs** to say “seed test and simulation assertion”. Adding `.max(3)` to the app schema would be a schema change, which the PRD explicitly rules out; if it is wanted, log it as a separate app change.

## Execution gaps

### E1. Phase 1’s manifest-schema proof does not exist

**Expected**

> “**Proved by:** the manifest parses through `packManifestSchema` when the seed builder reads it; the seed test compares the built deck order and levels to the manifest.” — `docs/features/system-design-course/IMPL-system-design-course.md:16-18`

**Found**

- `v1/scripts/make-seed.mjs:83` reads `pack.json` with `readJson` only; it never imports or calls `packManifestSchema`.
- `v1/scripts/make-seed.mjs:86-90` reads `topics`, `topicLabels` and `topicLevels` directly, with `?? "intermediate"` fallbacks.
- `packManifestSchema` is used at `v1/src/lib/packs/loader.ts:54` for the pack-folder loader, not the seed builder.
- The schema at `v1/src/lib/core/schema.ts:172-186` has no `topicLevels` field, so a parsed manifest would drop the levels and every deck would fall back to `intermediate` in `make-seed.mjs:89`.
- `v1/tests/seed-packs.test.ts:27-35` (`readAuthored`) also only JSON-parses. The useful half of the claim is true: the test compares built deck order and levels at lines 70-73.

**Plain-English impact**

The claimed schema guard is not on the path that builds the built-in course. A malformed manifest could crash `make-seed` or silently make every deck “intermediate”. The current manifest is valid and the test’s order/level comparison would catch a level mismatch, so the learner is not affected today.

**Recommendation: update docs** to state what is actually true, or add a `packManifestSchema` parse plus `topicLevels` support to a test or `make-seed`. Adding support touches schema/code beyond the pack; if chosen, log it separately.

### E2. Phase 4 and Phase 5 evidence is not retained

**Expected**

> “a visual pass rendered four samples to PNG and inspected them.” — `docs/features/system-design-course/IMPL-system-design-course.md:54-55`

> “a recheck script returned all ids alive.” — `docs/features/system-design-course/IMPL-system-design-course.md:66-68`

**Found**

- `v1/packs/system-design/images` contains 28 files: 18 SVG and 10 WebP. There is no PNG sample and no rendered-sample artifact in the worktree.
- There is no recheck script or log in `v1/scripts` or the feature folder. `SOURCES.md:70-74` repeats the oEmbed claim but records no run.
- I rechecked all 24 ids through YouTube oEmbed on 2026-10-29: every request returned HTTP 200, and every channel matched `SOURCES.md`. The Phase 5 claim is true; its named artifact is absent.

**Plain-English impact**

This is evidence hygiene, not a content defect. The video claim is independently confirmed, but the four-sample visual check cannot be reproduced from the repository. A future reviewer has to take the visual quality on trust.

**Recommendation: update docs and keep evidence.** Cite the review’s oEmbed recheck and store a small log; keep the four PNG samples or soften the visual-pass claim. No code fix.

### E3. Phase 9’s browser pass is asserted but only partly evidenced

**Expected**

> “Browser: the seed banner, pack card, deck list and a taught card are checked in the built app.” — `docs/features/system-design-course/IMPL-system-design-course.md:115-119`

**Found**

- `v1/out` exists, contains the system-design bundle and 28 images, and `NEXT_PUBLIC_BASE_PATH=/flashcards node scripts/check-pwa.mjs` passes: `check-pwa: passed (base path: /flashcards, files: 107, precache entries: 105)`.
- No browser log or screenshot is stored in the worktree.
- `docs/drift.md:27` records one built-export browser observation: the Foundations card’s video played instead of error 153. That is one taught-card observation, not the seed banner, pack card and deck list.

**Plain-English impact**

The build and PWA packaging are proven. The four UI checks are only partly recorded; a reviewer cannot reproduce them from files. The pack may well render correctly, but the IMPL does not prove it.

**Recommendation: update docs.** Add a short browser evidence note (URL, date, what was seen; screenshots optional) or soften the claim to what D-41 recorded. No code fix.

### E4. The Scenario 4 test name overclaims what it asserts

**Expected**

> “Its images include either a photograph or a static diagram” — `docs/features/system-design-course/PRD-TRD-system-design-course.md:77-81`

**Found**

`v1/tests/seed-packs.test.ts:157` names the test “gives every deck a photo or diagram and a video”, but lines 165-166 only assert:

```ts
expect(images.length, `deck ${deck.id} images`).toBeGreaterThanOrEqual(2);
expect(videos.length, `deck ${deck.id} videos`).toBeGreaterThanOrEqual(1);
```

There is no check for a `.webp` photo or a non-`-anim.svg` static diagram. `simulate.sh:60-74` also counts images without looking at their type.

The current content does satisfy the rule: every deck has one WebP photo and at least one animation, and eight decks also have a static SVG. Foundations and AI-assisted engineering have exactly two images (photo plus animation), which is enough for the “at least two” rule and still includes a photograph.

**Plain-English impact**

A future edit could replace a deck’s photograph with a second animation and the test would still pass, violating Scenario 4. The current pack is correct; the guard is weaker than its name.

**Recommendation: fix code (the test).** Assert at least one image per deck is a photograph (`.webp`) or a static SVG (not `-anim.svg`), or rename the test to “at least two images and one video” and rely on review.

## Simulation gaps

### S1. The sample card omits prompt and answer

**Expected**

> “5. a sample card from each deck with its prompt, answer and teaching parts;” — `docs/features/system-design-course/PRD-TRD-system-design-course.md:107`

**Found**

`docs/features/system-design-course/simulate.sh:103-109` prints:

- `card.summary` at line 107;
- only the part type names at line 108.

It never reads `card.prompt`, `card.answer`, `part.text`, `part.src` or `part.alt`. For example, the requirements sample prints “Non-functional requirements describe how well” and “parts: text”. That is a summary, not the prompt and answer the contract asks for.

**Plain-English impact**

The simulation proves counts and file existence, not that a learner sees a usable question, answer and teaching layer. A typo or a poor answer would pass this simulation. The schema test catches empty arrays, but not content quality.

**Recommendation: fix code (the simulation).** Print a bounded sample of the prompt and answer text and each part’s text/src/alt; or narrow the PRD contract to summary and part types. Because the contract explicitly asks for prompt and answer, fix the simulation.

### S2. The simulation prints the pack and deck shape but does not assert it

**Expected**

> “1. the three packs in `index.json` and the system-design version; 2. the ten decks in order with level and card count;” — `docs/features/system-design-course/PRD-TRD-system-design-course.md:103-104`

**Found**

- `simulate.sh:36-42` iterates every `index.packs` entry and fails only if `system-design` is missing or its version differs. It does not assert exactly three entries or the expected names.
- `simulate.sh:45` prints `bundle.decks.length`; `simulate.sh:48-85` iterates the decks and checks 10 cards each, but never asserts `bundle.decks.length === 10`, and never compares deck ids or levels to `packs/system-design/pack.json`.
- A 9-deck bundle with 10 cards per deck and one video, or a four-pack index, would print and still `PASS`. The seed test at `v1/tests/seed-packs.test.ts:70-73` does compare deck ids and order, but the simulation alone does not.

**Plain-English impact**

The simulation’s PASS line is weaker than it looks. It proves per-deck content, not the full course shape. The test suite covers the shape, so the current pack is fine, but the post-implementation proof can pass an incomplete course.

**Recommendation: fix code (the simulation).** Assert exactly the three expected pack names, exactly ten decks, and deck ids/levels equal `packs/system-design/pack.json`; or state in the PRD that the seed test owns those assertions. The contract says “ten decks in order”, so add the assertion.

## Media truthfulness and honesty notes

These are verified facts, not gaps:

- **Counts:** 28 assets = 10 WebP photographs + 18 SVGs (10 animated, 8 static). 28 unique images are used; the source folder and the built folder each contain 28 files. 24 unique video ids are used; the SOURCES table has 24 rows.
- **Sizes:** every image is under 1 MB; the largest is `padlock.webp` at 520 KB. Every photograph is exactly 1600 px wide, so “max 1600 px” and “under 600 KB” hold.
- **Image references:** every `src` in the seed starts with `/packs/system-design/images/` and resolves to a real file in both `v1/public/packs/system-design/images/` and `v1/out/packs/system-design/images/`. No missing file, no file over 1 MB.
- **YouTube ids:** 24/24 are exactly 11 characters with the allowed `A-Za-z0-9_-` alphabet. A fresh oEmbed check on 2026-10-29 returned HTTP 200 for all 24; all 24 channel names match `SOURCES.md`; 12 table titles are shortened versions of the live title (for example, `K7RkjKTIQbo` omits “| archill podcast #9”). Shortened titles are not false, but they are not verbatim.
- **Alt and search:** every one of the 28 image parts and 24 video parts has non-empty alt text. Every video part has non-empty `search` text. No video part uses `start` or `end`.
- **Credits:** `SOURCES.md` has a section for all 10 deck ids, a row for all 10 photos actually used, and a row for all 24 videos actually used. All 10 photo creator/licence pairs matched the Wikimedia Commons API on 2026-10-29, including the two pages that needed a redirect (`server-rack.webp`, `code-on-screen.webp`).
- **Build:** `v1/public/packs/system-design.json` and `v1/out/packs/system-design.json` are byte-identical. `v1/out/index.html` references `/flashcards/_next/...`, and `check-pwa` passes with the `/flashcards` base path.
- **Base path:** `v1/src/app/TeachingMedia.tsx:149` applies `withBasePath` to every built-in image; `v1/src/lib/shared/paths.ts:8-18` builds `/flashcards` from `NEXT_PUBLIC_BASE_PATH`; `v1/next.config.ts:19` sets `basePath`. A built-in image therefore becomes `/flashcards/packs/system-design/images/...` at runtime.

Claims I could not verify from the files, marked unverified rather than false:

- **WebP quality 82** (`SOURCES.md:104`) is not stored in the WebP bytes; it is an authoring parameter.
- **“`server-rack.webp` is cropped above a creator watermark”** (`PRD:105-106`, `IMPL:38-39`) cannot be confirmed from the current file; the file shows drive bays and no watermark, and the creator is credited.
- **“The 18 SVGs are original work”** (`SOURCES.md:121-125`) is a self-declaration; the files carry no external attribution that would let me confirm originality.
- **“A visual pass rendered four samples to PNG”** (`IMPL:54-55`) has no PNG artifact in the worktree.
- **“A recheck script returned all ids alive”** (`IMPL:66-68`) has no script or log; I independently confirmed the result but not the script.
- **The four browser checks** (`IMPL:115-119`) are only partly recorded in `docs/drift.md:27`.
- **The word “short” for videos** is not verified; oEmbed does not report duration, and some entries are podcast or conference talks.
- **Non-media reference URLs** in `SOURCES.md` were not all checked. The media URLs (24 videos and 10 photos) were checked on 2026-10-29.
- **`README.md:50-51`** says “credit and licence for every photo and video”; videos have a channel, not a licence. `SOURCES.md` itself says “creator, licence or channel”, which is accurate.

## What is aligned

- **Seed:** `v1/public/packs/index.json` has three entries, with `system-design` at authored version 1.0.0. `v1/scripts/make-seed.mjs:18` includes the pack. The bundle has 10 decks and 100 cards. `v1/packs/system-design/pack.json:8-19` lists the ten deck ids in course order; the built deck ids match; each card’s first topic is its deck id, so `make-seed.mjs:92-95` maps every card to the right deck. The browser and Polish bundles are not modified in git.
- **Decks and cards:** ten files, ten cards each. Answer modes are 55 cloze, 44 picks and 1 type. All 100 cards have a teaching layer (48 one-part, 52 two-part; maximum two, within the 1–3 rule). All 100 have hints; every sentence card has a full line. A small validator found no blank-id mismatches, no picks answer outside its options, no empty answer side and no empty hint or teaching text.
- **Per deck:** every deck has 2–3 images and 2–4 videos. Every deck has one WebP photograph and one animated SVG; eight decks also have a static SVG. The two decks with only two images (foundations, AI-assisted engineering) still have a photograph and are above the two-image floor.
- **Tests:** `npx vitest run tests/seed-packs.test.ts` reports 14 passed. The suite covers the pack manifest, deck order/levels, ten cards per deck, teaching length, YouTube id shape, image existence and per-deck image/video minimums. `npx tsc --noEmit` produced no errors.
- **Schema:** `v1/src/lib/shared/types.ts` and `v1/src/lib/core/schema.ts` are unchanged. The pack uses `cardSourceSchema` and `teachingPartSchema`; the built bundle parses through `parseBundle` in the tests. There are no built-in video files and no `start`/`end` values.

## Drift items to log

Suggested next free ids; these are candidates, not assigned entries.

1. **D-33 — system-design docs scope (C1).** The PRD and GRILL say only the seed list and seed tests change; the branch also contains D-41’s `TeachingMedia.tsx` and `teaching-layer.test.ts` change. Owner: system-design-course. Fix: update docs to scope the claim and cross-reference D-41.
2. **D-34 — video fallback (C2).** Scenario 5 promises a way to find the topic after a video is removed, but the failure link is the dead watch page. Owner: teaching-layers (or system-design-course docs if the promise is narrowed). Fix: update docs, or change the failure link to a YouTube search URL.
3. **D-35 — simulation sample and shape (S1, S2).** `simulate.sh` does not print prompt/answer and does not assert exactly three packs, ten decks or deck order/levels. Owner: system-design-course. Fix: code.
4. **D-36 — IMPL evidence and test precision (E1–E4).** Phase 1’s manifest-schema proof is false; Phase 4/5/9 evidence is not stored; the Scenario 4 test name does not match its assertion. Owner: system-design-course. Fix: docs plus a small test change.

## Recommendation

The course content is ready to show: the counts, media, credits, seed integration, base path, tests and build all check out. Before calling the feature done, fix the simulation so it prints the promised prompt/answer sample and asserts the three-pack/ten-deck shape; update the PRD and GRILL to acknowledge D-41 and to describe the fallback as it actually behaves (or add a real search link); and either store the Phase 1/4/5/9 evidence or soften those claims. The one test change I would prioritise is the photo-or-static-diagram guard, because it is cheap and protects Scenario 4. No commit, push or merge until the learner says go.
