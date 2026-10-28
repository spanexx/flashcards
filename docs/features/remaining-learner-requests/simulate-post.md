# Post-implementation rehearsal: the three remaining learner requests

**Status:** Automated checks passed 2026-10-27; learner visual sign-off pending
**Packs:** `import-repair`, `progress-summary`, `plan-multi-select`
**Canonical checks:** the named tests in each pack IMPL plus the full suite
**Served build:** `v1/out` on a WSL host, checked from Windows

## What this rehearsal proves

1. **The import repair waits for consent.** A failed import's preview holds the
   exact refused file and validator lines and sends nothing. A valid provider
   answer is saved and marked repaired; an invalid answer writes nothing and
   leaves the row failed. The same held request cannot be sent twice. A failed
   generation has no repair action.
2. **The summary is derived and optional.** The Summary tab opens without a
   provider call. The compact payload has counts, topic labels, one recent
   outcome per topic, level and style, capped at eight topic rows and eight
   outcome rows. The payload does not contain the test card's Polish text or
   card id. A provider answer is returned once, is not stored, and the exact
   prompt is logged. No provider means no request.
3. **The plan draws from a union.** A plan asked for two packs and three decks
   returned cards from both packs, and its finished session fact recorded the
   whole scope. The dropdown trigger handles the whole library, one
   pack, one deck, many decks in one pack, all decks in many packs and many
   packs.
4. **Older data still works.** A version-1 resume snapshot is migrated to
   version 2 and has no old one-pack fields. An old one-pack history row replays
   through today's deck list. A history row whose pack or deck is gone offers no
   replay.
5. **The built app is reachable.** On port 4173, Windows `curl.exe` got a 200
   from both `http://localhost:4173/` and `http://172.25.126.9:4173/`, and both
   documents had `<title>Flashcards</title>`.
6. **The built chunks carry the new surfaces.** `Ask the tutor for a summary`
   and `Fix with AI` are present in the static chunks, along with the scope
   summary strings.

## What differs from the locked tickets

- The tickets called the scope lede "All decks in 2 packs" with a capital A.
  The shipped shared helper returns lowercase `all decks in 2 packs` because it
  sits after "Study from". The wording and meaning are unchanged.
- The import repair preview shows the data text (refused file plus validator
  words), not the hidden system instruction. That is the same boundary the
  ticket described: the learner sees the text that carries their content.
- A partly chosen pack carries a half-green dot. Pressing it returns the pack to
  every deck; the decks remain the precise way to narrow.
- The summary uses a compact inline preview, not a modal. It follows the same
  confirm/cancel pattern without taking over the page.
- No pre-implementation HTML mock was built for this batch. The wayfinder
  tickets already lock the control shapes, and each IMPL records the built
  behavior. This file is the post-implementation rehearsal, not a substitute
  for the learner's own visual check.

## What was not proven here

- A live provider call from the deployed browser origin. This environment's
  GitHub Pages origin returned 401/no CORS header. The browser route, validator
  and prompt logging are proven with the fake provider. The learner's own
  provider/key is the live leg.
- A human's eyes on the three surfaces. The automated checks and the served
  build are ready; the checkboxes in the pack IMPLs stay open until the learner
  looks.

## Reproduce

```bash
cd v1
npm run typecheck
npm run lint
npm run build
node node_modules/vitest/vitest.mjs run
```

Serve the built app from WSL, then check it from Windows:

```bash
cd v1/out
python3 -m http.server 4173 --bind 0.0.0.0
```

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:4173/
curl.exe -sS http://localhost:4173/ | Select-String "<title>"
```

## Learner visual checklist

- **Study:** open the scope dropdown. All cards has a green dot. Choose two
  packs; open their decks; unchosen rows have no dot; untick one deck and see the
  pack carry a half-green dot. Open a pack with many decks and scroll its list.
  Read the lede. Try it at phone width, then open Plan details: it shows one tab
  at a time and a long reason list scrolls inside the fold.
- **Jobs:** with a provider configured, make an import fail, open Jobs, press the
  sparkle icon, read the preview, cancel once, then send once. Check the round
  icons and the provider-needed note with a provider removed.
- **Progress:** open Summary. Confirm the payload preview has counts and topic
  labels but no card words. Send once and read the answer. Reload and confirm
  the answer is gone.
