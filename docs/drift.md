# Drift Log
**Last updated:** 2026-10-19  **Open:** 0  **Resolved:** 11  **Critical/High:** 0

## Open

_None. The v1-prototype drift review of 2026-10-19 found nine gaps; two more
surfaced during the live provider test. All eleven were fixed in code or docs
the same day (D-1…D-11, below). The manual browser walkthrough, noted in the
IMPL reconcile section, is in progress.

---

## Resolved

- **D-1** (High, 2026-10-19, reporter: drift review `.reports/2026-10-19-drift-v1-prototype.md`) — R16: the learner's working was collected in a textarea but never shown beside the pack's working after the answer; the region was invisible.
  - Doc claim: `working?: { label: string; expected: string }` and "Working shown, then discarded" (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:129`; `docs/features/v1-prototype/GRILL-v1-prototype.txt:198`)
  - Code reality: working was written via `setWorking`, but the reveal rendered only the pack's answer (`v1/src/app/StudyClient.tsx` before fix; textarea now at :559, comparison block at :579)
  - Why matters: a locked decision (R16) with no visible effect; the pack's expected working was unreachable.
  - Owner: v1-prototype
  - To fix: fix code — reveal now shows "Your working" beside the pack's `working.label`/`expected`, with "Nothing here was saved or sent".
  - Verified by: typecheck, lint, build, 232 unit tests; browser walkthrough still to come.
  - Related: D-6 (no pack card exercised `working` until the fix).

- **D-2** (High, 2026-10-19, reporter: drift review) — R7: the import box had no file chooser, and the correction buttons in the study reveal omitted the locked "No" outcome.
  - Doc claim: import is all-or-nothing JSON with item numbers (`docs/features/v1-prototype/GRILL-v1-prototype.txt:129`); correction appends a new row (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:222`)
  - Code reality: import accepted pasted text only, no `<input type="file">`; reveal offered Again/Nearly/Got it but no No (`v1/src/app/library/LibraryClient.tsx:498`; `v1/src/app/StudyClient.tsx:13` — `CORRECTIONS` now carries all four)
  - Why matters: two locked decisions (R7; the four locked outcome words) were partially unreachable from the screen.
  - Owner: v1-prototype
  - To fix: fix code — file chooser reads the file into the same import box; No joins the correction row.
  - Verified by: 232 unit tests, lint, build.
  - Related: none.

- **D-3** (High, 2026-10-19, reporter: drift review) — R11: the offer dropped five for every recent short stop instead of once when two or more exist.
  - Doc claim: "Two or more recent sessions stopped below half of the offer lower it by five to a floor of five; completing a session raises it back toward 20." (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:209`; `docs/features/v1-prototype/GRILL-v1-prototype.txt:160`)
  - Code reality: old loop subtracted five per qualifying stop (`v1/src/lib/core/session.ts` before fix; rewritten `computeOffer` now at :18)
  - Why matters: the offer could crash to the floor after three stops, contradicting the locked adjustment rule.
  - Owner: v1-prototype
  - To fix: fix code — one lowering per window, floor five; finished sessions raise toward the base.
  - Verified by: rewritten `tests/session.test.ts` cases plus 232-test run.
  - Related: none.

- **D-4** (High, 2026-10-19, reporter: drift review) — Stopping showed the same sign-off as finishing, wrong cards returned without a marker, and Nearly/unjudged cards returned as if wrong.
  - Doc claim: "Stopping is not an ending. No summary, no report, no sign-off." (`docs/features/v1-prototype/GRILL-v1-prototype.txt:40`)
  - Code reality: stop called the same done screen; the return queue keyed off anything but Got it and showed no marker (`v1/src/app/StudyClient.tsx` before fix; stop now returns to the plan at :487, marker at :502, queue gated by `isWrong` at :239)
  - Why matters: a locked rule about endings and the wrong/not-wrong vocabulary were both misrepresented on screen.
  - Owner: v1-prototype
  - To fix: fix code — stop ends the session and loads a fresh plan; only Again/No return, plainly marked; the done screen says only "This session is finished."
  - Verified by: simulate point 4 (wrong, then right on return), 232 unit tests.
  - Related: none.

- **D-5** (Medium, 2026-10-19, reporter: drift review) — Generation was unreachable without a provider, and the prepared prompt had no copy action.
  - Doc claim: "A prompt can be prepared and displayed before any provider exists" (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:82`; prepare endpoint at :236)
  - Code reality: the generate block was hidden unless `provider.hasKey`; no copy button (`v1/src/app/library/LibraryClient.tsx:350` now shows the block with a plain note, copy at :269)
  - Why matters: the locked "prepare, look at it, then decide" flow (R13) depended on a provider being configured first.
  - Owner: v1-prototype
  - To fix: fix code — the block always renders; sending without a provider fails in plain words; "Copy the prompt" added.
  - Verified by: simulate point 9 (prompt prepared with no provider; sending changes nothing).
  - Related: none.

- **D-6** (Medium, 2026-10-19, reporter: drift review) — The sample pack contained no multi-blank card and no working-region card, and its two listen cards claimed `type`; simulation point 3 could not prove per-blank evidence.
  - Doc claim: four answering surfaces including hear-then-type (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:122`); "A cloze answer is judged per blank" (`PRD-TRD-v1-prototype.md:76`)
  - Code reality: all pack cards were single-blank; listen cards used `mode: "type"` (`v1/packs/polish-starter/cards.json` before fix; hear_type now at :439 and :453, two-blank card at :511, working card at :537)
  - Why matters: the simulation's strongest point was untestable and a promised surface had no example.
  - Owner: v1-prototype
  - To fix: fix code and pack — added a two-blank cloze card, a working-region card, and switched the listen cards to `hear_type`; simulation point 3 now asserts two rows share one attempt id (`v1/scripts/simulate.mjs:222`).
  - Verified by: simulate 10/10 with the strengthened point 3.
  - Related: D-1.

- **D-7** (Low, 2026-10-19, reporter: drift review) — IMPL file lists pointed at paths that never existed (`src/lib/config.ts`, `src/components/`, a `/generate` page).
  - Doc claim: Phase 4 and Phase 7 file lists (`docs/features/v1-prototype/IMPL-v1-prototype.md:52` and :90, before fix)
  - Code reality: storage files under `v1/src/lib/storage/` with settings at `v1/src/lib/core/settings.ts`; screens are folders under `v1/src/app/` with client components beside them; generate is a block inside the Library (`v1/src/app/library/LibraryClient.tsx:350`)
  - Why matters: an agent following IMPL would look in the wrong places.
  - Owner: v1-prototype
  - To fix: fix docs — phases 4, 7, 8, 9 updated; reconcile section added to IMPL.
  - Verified by: re-read against the tree.
  - Related: none.

- **D-8** (Medium, 2026-10-19, reporter: drift review) — Progress had no raw evidence and no correction entry point, though both are promised.
  - Doc claim: "every card's raw evidence. Any evidence row can be corrected with a new row." (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:47`; correction endpoint at :222)
  - Code reality: the screen listed conclusions only (`v1/src/app/progress/ProgressClient.tsx` before fix; drawer now at :28, corrections at :63)
  - Why matters: the locked correction promise was only reachable by hand-written requests.
  - Owner: v1-prototype
  - To fix: fix code — a per-card drawer reads `/api/evidence`, shows rows newest-first, and appends corrections with the four locked words.
  - Verified by: 232 unit tests (repository/correction units), build; browser check to come.
  - Related: D-2.

- **D-9** (Low, 2026-10-19, reporter: drift review) — The pack README promised that card topics must come from `pack.json`'s list, but the loader never checked.
  - Doc claim: "`topics` — the allowed topic words for the pack's cards." (`v1/packs/README.md:33`; hard rules at :78)
  - Code reality: the loader validated topic presence, not membership (`v1/src/lib/packs/loader.ts` before fix; check now at :102)
  - Why matters: a typo topic would silently invent a topic group instead of failing the pack.
  - Owner: v1-prototype
  - To fix: fix code — the loader now refuses a card whose topic the manifest does not list; covered by `tests/packs.test.ts`.
  - Verified by: 232 unit tests, simulate point 1.
  - Related: none.

- **D-10** (High, 2026-10-19, reporter: live provider test) — On WSL the loopback provider address was swapped for the resolv-file nameserver (`10.255.255.254`), which is a NAT proxy here, not the Windows host; every provider call failed as unreachable while the app reported the provider ready.
  - Doc claim: "a loopback provider URL is swapped for the host nameserver IP at call time" (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:251`, before fix)
  - Code reality: `wslHostAddress()` read only `/etc/resolv.conf` (`v1/src/lib/provider/config.ts` before fix; default gateway now at :33, resolv fallback at :44)
  - Why matters: the learner's own provider on Windows port 3001 could not be reached from the server inside WSL; the provider test, generation and hints all failed.
  - Owner: v1-prototype
  - To fix: fix code — the host address now comes from the kernel default route (`/proc/net/route`, little-endian gateway reversed), with the nameserver only as fallback; the PRD wording changed to "default gateway".
  - Verified by: live `POST /api/provider/test` returned ok against `http://172.25.112.1:3001`; generation produced two cards; a hint returned from the tutor (log lines in `/tmp/v1-server.log`).
  - Related: none.

- **D-11** (Medium, 2026-10-19, reporter: live provider test) — Cards written after boot did not appear on the deck or the study plan until the server restarted, because reads used the cached boot state and writes did not drop it.
  - Doc claim: generated cards are saved as a validated batch and the Library refreshes afterwards (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:32`; `GRILL-v1-prototype.txt` generation flow)
  - Code reality: `saveCards` wrote the file but left `cached` untouched (`v1/src/lib/bootstrap.ts` before fix; invalidation now at :46), so GET `/api/cards` returned 32 cards while `data/cards.json` held 34
  - Why matters: generated, hand-written and imported cards were invisible until a restart; the learner could not study what they had just added.
  - Owner: v1-prototype
  - To fix: fix code — boot writes the card file directly; `saveCards` writes and drops the boot cache, so the next read rescans; covered by a bootstrap test.
  - Verified by: 240 unit tests; live GET `/api/cards` immediately after generation returned 34 cards including both generated ones.
  - Related: D-6.
