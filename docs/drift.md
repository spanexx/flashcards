# Drift Log
**Last updated:** 2026-10-29  **Open:** 0  **Awaiting:** 0  **Resolved:** 32  **Critical/High:** 0

## Open

_None. The 2026-10-29 gap D-41 was fixed and verified the same day; see Resolved._

## Awaiting decision

_None. On 2026-10-25 the learner chose "land as built, update the docs"; each decision is recorded in its Resolved entry._

_Historical: the v1-prototype drift review of 2026-10-19 found nine gaps; two
more surfaced during the live provider test. All eleven were fixed in code or
docs the same day (D-1…D-11, below). The manual browser walkthrough, noted in
the IMPL reconcile section, is in progress._

---

## Resolved

- **D-41** (High, 2026-10-29, reporter: the learner, who asked why the course videos did not appear) — Every YouTube teaching part rendered a player that YouTube refused, so a curated video showed "Video player configuration error" instead of the lesson.
  - Doc claim: "plays through a privacy-friendly embed" (`docs/features/teaching-layers/PRD-TRD-teaching-layers.md:115`); "The player sends only the page origin as its referrer" (`docs/features/teaching-layers/PRD-TRD-teaching-layers.md:117-119`).
  - Code reality: the player iframe set `referrerPolicy="no-referrer"` (`v1/src/app/TeachingMedia.tsx:215` before fix), so the embed request arrived with no Referer and YouTube answered with player error 153.
  - Why matters: no YouTube part could play in the app, on any pack; the system-design course ships 24 curated videos and its teaching contract depends on them.
  - Owner: teaching-layers
  - To fix: fix code — the embed sends only the page origin, which YouTube accepts and which still hides the page path (`v1/src/app/TeachingMedia.tsx:208-219`).
  - Verified by: "sends the page origin and never a missing referrer" (`v1/tests/teaching-layer.test.ts:253-267`); the built export (localhost:4173/flashcards, service worker removed) played the Foundations card's video instead of error 153; `npm run build` passed `check-pwa: passed (base path: /flashcards, files: 107)`; typecheck and `npx eslint src/app/TeachingMedia.tsx tests/teaching-layer.test.ts` clean; full suite 84 files / 970 tests; `npm run check:drift` green.
  - Related: system-design-course.

- **D-28** (High, 2026-10-27, reporter: the learner, who noticed Generate still used the old prompting) — Adding cards into an existing deck through Generate never asked for teaching layers whenever the pack shipped its own prompt template, so the learner's main writing path made layerless cards while pack and deck generation taught.
  - Doc claim: "each card may carry a short teaching layer with optional media" (`docs/features/teaching-layers/PRD-TRD-teaching-layers.md:155-158`); "The prompt asks for a short explanation and an optional image or video only when it helps" (`docs/features/teaching-layers/GRILL-teaching-layers.txt:311-316`).
  - Code reality: `buildGenerationPrompt` appended only the brief and pair lines and never called `teachingPromptLines()`, which only the pack and deck builders reached (`v1/src/lib/provider/prompt.ts:106-119` before fix); the Polish starter pack's own template names no teaching (`v1/public/packs/polish-starter.json:13`).
  - Why matters: the Generate form always sends a brief, so the cards path always uses the pack's stored template; with the seed pack that meant every generated card arrived without the layer the teaching-layers pack promised.
  - Owner: teaching-layers
  - To fix: fix code — the cards builder appends the same teaching rule when the pack ships its own template, and the app's default template keeps its single copy (`v1/src/lib/provider/prompt.ts:100-127`; the shared rule at `v1/src/lib/provider/prompt.ts:214`).
  - Verified by: "puts the same teaching rule in all three shapes" (`v1/tests/provider-prompt.test.ts:234-250`); "asks for the teaching layer when a pack's own template leaves it out" (`v1/tests/provider-prompt.test.ts:252-260`); the once-only guard "says the teaching rule once when the app's own template carries it" (`v1/tests/provider-prompt.test.ts:262-270`); Scenario 20 now names every target (`docs/features/teaching-layers/PRD-TRD-teaching-layers.md:159-161`); full suite 60 files / 678 tests, typecheck clean, `npx eslint src tests` clean, both drift gates green.
  - Related: D-29.

- **D-29** (High, 2026-10-27, reporter: the learner, who asked for generated packs and decks to take their level) — A generated pack's decks and a generated deck were always stored at `intermediate`, and cards added inside a deck were prompted at the global level instead of that deck's level.
  - Doc claim: "A new deck starts at the learner's current global level." (`docs/features/teaching-layers/GRILL-teaching-layers.txt:503`); "A deck's level wins for generation inside that deck. The global learner level is the fallback when no deck is chosen." (`docs/features/teaching-layers/GRILL-teaching-layers.txt:329-330`).
  - Code reality: both bundle readers stamped `level: "intermediate" as const` (`v1/src/lib/provider/generate.ts:314`, `v1/src/lib/provider/generate.ts:339` before fix), and the cards target built its prompt from the global learner level while the deck it wrote into had its own (`v1/src/lib/browser/provider.ts:100-108`, `v1/src/lib/browser/provider.ts:210-216` before fix).
  - Why matters: a beginner who generated a new deck got intermediate presentation, and a deck set to advanced still received beginner-level prompt wording from the global setting; the locked rule names the deck as winner.
  - Owner: teaching-layers
  - To fix: fix code — the prepared request carries the level; generated pack and deck bundles store it, and a cards prompt uses the deck's level (`v1/src/lib/provider/generate.ts:261-264`, `v1/src/lib/browser/provider.ts:216-238`, `v1/src/lib/provider/prepare.ts:36-45`).
  - Verified by: "stores a generated deck at the level the caller passed" (`v1/tests/provider-flow.test.ts:378-397`); "prompts cards at the deck's level while a new container takes the global one" (`v1/tests/browser-router.test.ts:736-762`); the simulated deck level (`v1/tests/simulate-create-flow.test.ts:183`); Scenario 21 names the rule (`docs/features/teaching-layers/PRD-TRD-teaching-layers.md:170-172`).
  - Related: D-28.

- **D-30** (Medium, 2026-10-27, reporter: the learner, who asked for every Generate prompt to be editable) — The prepared Generate prompt was read-only and was sent from the text held by the app, so a learner could see the exact words but not correct them, while Chat's prompt was already editable.
  - Doc claim: the non-goal "No separate prompt editor for decks or cards." (`docs/features/language-prompt-control/PRD-TRD-language-prompt-control.md:217`), now marked superseded; Chat's promise "The prompt is editable." (`docs/features/creation-control/PRD-TRD-creation-control.md:56`).
  - Code reality: Create rendered the prepared text in a read-only block and sent only the held request id (`v1/src/app/library/CreatePanel.tsx:901-935`, `v1/src/app/library/CreatePanel.tsx:487-505` before fix); the job route took the stored prompt as-is (`v1/src/lib/browser/router.ts:743-754` before fix), while the Chat editor wrote its edits through (`v1/src/app/library/ChatPromptEditor.tsx:53-63`).
  - Why matters: the learner asked on 2026-10-27 for every prompt the Generate section sends to be editable and for the edited text to be the text that is sent; that request supersedes the older non-goal, which could only be honoured by leaving a real correction impossible.
  - Owner: creation-control
  - To fix: decision and code — the learner's 2026-10-27 instruction supersedes the non-goal; the prepared prompt is editable, an edit replaces the held prompt before the job runs, and both docs say so (`v1/src/app/library/GenerationPromptEditor.tsx`, `v1/src/app/library/CreatePanel.tsx:488-491`, `v1/src/lib/browser/router.ts:753-756`, `v1/src/lib/provider/prepare.ts:36-49`, `docs/features/creation-control/PRD-TRD-creation-control.md:45-48`, `docs/features/language-prompt-control/PRD-TRD-language-prompt-control.md:217`).
  - Verified by: "takes the learner's edit as the whole request" (`v1/tests/provider-flow.test.ts:95-118`) and "keeps the held prompt when the edit is blank or unchanged" (`v1/tests/provider-flow.test.ts:119-135`); "sends the learner's edited prompt instead of the held one" (`v1/tests/browser-router.test.ts:1145-1202`); a live pass on the built export where the prepared prompt was replaced by a distinctive edit, the provider body carried that edit as the only user message and not the prepared text, and the job saved a card.
  - Related: none.

- **D-31** (Medium, 2026-10-27, reporter: the learner) — "Full screen" left the browser and took the whole monitor, so it could not shrink with the browser window.
  - Doc claim: the new decision "Full screen stays inside the browser" (`wayfinder/anything-learning-spec/tickets/full-screen-in-browser.md`): the stage fills the browser viewport only and shrinks with the window.
  - Code reality: `enterFullScreen` called `stage.requestFullscreen()`, asking the browser for system fullscreen on top of the CSS stage (`v1/src/app/StudyClient.tsx:145-154` before fix), and the exit path called `document.exitFullscreen()` (`:133-143`, `:365-374`, `:393-400` before fix).
  - Why matters: the learner keeps the browser visible and resizes it; system fullscreen escapes the browser frame and ignores the window size.
  - Owner: study-experience
  - To fix: decision and code — the fixed CSS stage is the whole mechanism; the Fullscreen API calls, the `fullscreenchange` listener and the now-unused stage ref are gone (`v1/src/app/StudyClient.tsx`, `v1/src/app/study/StudySession.tsx`).
  - Verified by: `grep -rn 'requestFullscreen|exitFullscreen|fullscreenElement|fullscreenchange' v1/src` finds nothing; the built chunks carry `stage-full` and no `requestFullscreen`; typecheck and changed-file lint clean; `npm run build` passed (`check-pwa: passed`); full suite 62 files / 703 tests; the served page returned 200 on localhost and `172.25.126.9`. The stage is a fixed viewport layer, so it shrinks with the browser by construction.
  - Related: none.

- **D-27** (Medium, 2026-10-26, reporter: the learner, after a live provider call was refused) — A browser CORS refusal was flattened into "could not be reached", so the message named neither the likely cause nor a way forward.
  - Doc claim: "The app says so plainly; it does not hide behind a proxy." (`docs/ethics/dev-lane/data.md:19-20`, before fix)
  - Code reality: the catch wrote `The provider could not be reached at ${url}.` for every non-abort rejection and never mentioned CORS (`v1/src/lib/provider/client.ts:121-123` before fix)
  - Why matters: the learner's own provider, `larprouter.com`, answered the preflight without `Access-Control-Allow-Origin`, so the browser stopped the POST; the app's sentence read like a dead network and gave nothing to act on.
  - Owner: browser-app
  - To fix: fix code — the unreachable sentence names CORS as the likely cause and what to do, and Scenario 7 promises it. The timeout and HTTP sentences stay as they are.
  - Verified by: the new "names CORS as the likely cause when the browser refuses the call" case (`v1/tests/provider-client.test.ts:143-158`); targeted run 14 passing; full suite 60 files / 671 tests against a fresh `npm run build`; typecheck and lint clean; both drift gates green.
  - Related: none.

- **D-26** (Medium, 2026-10-26, reporter: the learner, after a live import failed) — A syntax refusal named no field and quoted no words, so the owner of a pasted pack could not find the break.
  - Doc claim: "the refusal names the item and field as today" (`docs/features/study-resilience/PRD-TRD-study-resilience.md:109`, before fix)
  - Code reality: `parseJsonLoose` passed the engine's sentence through unchanged, so the learner saw only "at position 2555 (line 1 column 2556)", and the pack path added just the collection label `(bundle)` (`v1/src/lib/core/json-repair.ts:292` before fix; `v1/src/lib/browser/bundle.ts:185`)
  - Why matters: the pack that failed on 2026-10-26 is 15 KB on one line, where an offset names a character nobody can count to; finding the break took a hand scan and an outside parser.
  - Owner: study-resilience
  - To fix: fix code — the refusal quotes the words either side of the failure, and Scenario 12 now promises it.
  - Verified by: the learner's own pack, unfixed, now reports "The broken part is: …{"type":"text bomb":""…" through `parseBundle` (`v1/src/lib/core/json-repair.ts:289-317`), pinned by "quotes the broken words, so a long single line can be found by eye" and three more (`v1/tests/json-repair.test.ts:195-214`); full suite and both drift gates pass.
  - Related: D-25.

- **D-20** (High, 2026-10-26, reporter: fresh-eyes drift review of study-resilience) — An edited card did not drop out of a running session, because the prune treated a retired card row as still live.
  - Doc claim: "a stored session whose current card was edited (new identity) or deleted … the vanished entry is skipped" (`docs/features/study-resilience/PRD-TRD-study-resilience.md:82-88`); "a card edit mints a new identity by design, so the old entry cannot be submitted against the new card" (`docs/features/study-resilience/GRILL-study-resilience.txt:120-122`)
  - Code reality: an edit retires the old row and writes the new one (`v1/src/lib/browser/router.ts:571`), and `readCards()` returns retired rows by design (`v1/src/lib/browser/repository.ts:96`); `loadResumableSession` built its live set from every row, retired ones included (`v1/src/lib/browser/session-save.ts:92-96` before fix).
  - Why matters: the learner kept studying the pre-edit card, which the library already treats as gone; the locked decision and Scenario 9 promised a clean skip, and only the deleted-card branch was tested.
  - Owner: study-resilience
  - To fix: fix code — the live set holds active cards only (`!card.retired`).
  - Verified by: two new tests, "drops an edited card, because an edit retires the old identity" (`v1/tests/session-resume.test.ts:250`) and "clears the row when every card in it was retired" (`v1/tests/session-resume.test.ts:260`); full suite green.
  - Related: D-21.

- **D-21** (Medium, 2026-10-26, reporter: fresh-eyes drift review) — The Phase 3 verify command named a test file that does not exist, and no test names the v5 upgrade.
  - Doc claim: "`npx vitest run tests/session-resume.test.ts tests/browser-store.test.ts`" (`docs/features/study-resilience/IMPL-study-resilience.md:66`, before fix)
  - Code reality: `v1/tests/browser-store.test.ts` is absent; the store assertions live in `session-resume.test.ts`, which checks the `resume` store name (`v1/tests/session-resume.test.ts:207-213`). The version literal stays inline at `v1/src/lib/browser/store.ts:109`; the memory adapter cannot exercise `indexedDB.open`.
  - Why matters: the documented verify command fails on a fresh clone, so the phase's own gate was unusable.
  - Owner: study-resilience
  - To fix: fix docs — the command is repointed at the real file and names the retired-card and store-name cases.
  - Verified by: `ls v1/tests`; targeted run of `tests/session-resume.test.ts` (22 passing).
  - Related: D-20.

- **D-22** (Medium, 2026-10-26, reporter: fresh-eyes drift review) — The Q11 answer contradicted the shipped restore path: one clause says a restore leaves a running session alone, the other says replacing the library clears the snapshot.
  - Doc claim: "Restoring a backup leaves any running session alone; replacing the library clears the snapshot because its cards are gone." (`docs/features/study-resilience/GRILL-study-resilience.txt:136-138`)
  - Code reality: `applyBackup` calls `clearLibrary` on every restore (`v1/src/lib/browser/bundle.ts:873`), which deletes the `resume` row (`v1/src/lib/browser/repository.ts:418-434`); the PRD did not state it anywhere.
  - Why matters: a locked decision described the opposite of the behaviour for the common case, so nobody could tell which clause the code honoured.
  - Owner: study-resilience
  - To fix: fix docs — the PRD now states that anything replacing the library clears the row, including a restore, and Q11 carries a dated implementation note naming the second clause as governing.
  - Verified by: read of `v1/src/lib/browser/bundle.ts:873` and `v1/src/lib/browser/repository.ts:418-434`; the repository test "is cleared when the library is replaced" (`v1/tests/session-resume.test.ts:220-226`).
  - Related: D-20.

- **D-23** (Low, 2026-10-26, reporter: fresh-eyes drift review) — Several study-resilience citations were stale or named a symbol that does not exist.
  - Doc claim: `readJson` "failed `JSON.parse`" at `v1/src/lib/browser/bundle.ts:165-180` and `parseJsonLoose` throws `ImportTextError` (`docs/features/study-resilience/PRD-TRD-study-resilience.md:215-217` and `:198-201`, before fix); "written from one place in `StudyClient`" (`:211-214`); Q1/Q2/Q3/Q7/Q10/Q12 sources (`docs/features/study-resilience/GRILL-study-resilience.txt:39,47,57,101-102,133,157`, before fix)
  - Code reality: `readJson` is `v1/src/lib/browser/bundle.ts:173-190` and calls `parseJsonLoose` directly; no `ImportTextError` exists anywhere — `parseJsonLoose` throws a plain `Error` (`v1/src/lib/core/json-repair.ts:317`, moved by D-26); `startSession` also writes and flushes eagerly (`v1/src/app/StudyClient.tsx:438-459`) beside the debounced effect; the real source lines are `v1/src/app/study/TeachingLayer.tsx:136-140`, `v1/src/app/StudyClient.tsx:118-124,783-797,474-512`, `v1/src/app/settings/SettingsClient.tsx:354-362`, `v1/src/lib/browser/store.ts:12-26,109`, `v1/src/lib/browser/repository.ts:226-249`.
  - Why matters: a reader following these pointers lands on the wrong code, and one promised type cannot be imported.
  - Owner: study-resilience
  - To fix: fix docs — PRD and GRILL now cite the real lines, say plain `Error` with the exact wording, and describe one save path plus the eager start flush.
  - Verified by: read of each cited line after the edit.
  - Related: D-21.

- **D-24** (Low, 2026-10-26, reporter: fresh-eyes drift review) — The teaching-layers note pointed at the wrong scenario when it said the folded bar survives.
  - Doc claim: "Turning it off never removes the folded bar or its manual open, so scenario 3 still holds." (`docs/features/teaching-layers/PRD-TRD-teaching-layers.md:35-36`, before fix)
  - Code reality: scenario 3 there is "Advanced tries first", where no bar shows before an answer; the folded-bar promise is Scenario 1 (`:25-28`). The behaviour itself matches code.
  - Why matters: a cross-pack reader checking the wrong scenario would conclude the note contradicts the pack.
  - Owner: study-resilience with teaching-layers
  - To fix: fix docs — the note names scenario 1.
  - Verified by: read of the scenario list and `v1/src/app/StudyClient.tsx:123-124,783-797`.
  - Related: none.

- **D-25** (Low, 2026-10-26, reporter: fresh-eyes drift review) — Scenario 12 promised the old refusal wording, but a failed import now appends a repair note.
  - Doc claim: "nothing is written and the refusal names the item and field as today." (`docs/features/study-resilience/PRD-TRD-study-resilience.md:107-109`, before fix)
  - Code reality: `parseJsonLoose` appends " (syntax repair was tried first)" whenever a repair kind applied (`v1/src/lib/core/json-repair.ts:311`, moved by D-26), pinned by `v1/tests/json-repair.test.ts:173-182`.
  - Why matters: the sentence the learner sees was slightly longer than the spec, which is harmless only if the spec says so.
  - Owner: study-resilience
  - To fix: fix docs — Scenario 12 names the added clause.
  - Verified by: `tests/json-repair.test.ts` and the live truncated-import refusal recorded in `simulate-post.md`.
  - Related: D-23.

- **D-12** (Medium, 2026-10-25, reporter: interface polish visual review) — No `favicon.ico` existed in the repository, so a fresh checkout had no tab icon until the icon script ran.
  - Doc claim: "The icons are committed and regenerated before every build." (`docs/features/pwa-deploy/PRD-TRD-pwa-deploy.md:86`)
  - Code reality: `v1/public/favicon.ico` is tracked with three entries, 16, 32 and 48 at 32 bpp, written by `v1/scripts/make-pwa-icons.mjs:183-184`.
  - Why matters: the browser asks for the icon on every visit; without the file in the repo the tab falls back to a default mark, so the header, tab and install icon disagree.
  - Owner: pwa-deploy
  - To fix: fix code — committed `v1/public/favicon.ico` with this branch.
  - Verified by: `v1/tests/pwa-deploy.test.ts` reads the ICO directory (three entries, 16/32/48 at 32 bpp) and the PNG IHDR sizes; the `/flashcards` build and the full suite pass.
  - Related: D-17.

- **D-15** (Medium, 2026-10-25, reporter: interface polish visual review) — Select values rendered at 13.6px because the select inherited the scope label's 0.85rem.
  - Doc claim: "it is 44px high with an 11px radius" and "selects show a visible chevron and 16px text" (`docs/features/learner-interface/PRD-TRD-learner-interface.md:87-90`)
  - Code reality: `.study-select` sets `font-size: 1rem` at `v1/src/app/globals.css:1309-1323`; the surrounding scope label stays `0.85rem` at `v1/src/app/globals.css:1301`, so the picker text is 16px.
  - Why matters: on a phone the picker text is smaller than every other control, and a shrunken select also invites the browser's zoom-on-focus.
  - Owner: learner-interface
  - To fix: fix code — the 16px rule landed with this branch.
  - Verified by: full suite and `/flashcards` build pass; the rule is in the committed stylesheet.
  - Related: D-16.

- **D-13** (Medium, 2026-10-25, reporter: interface polish visual review) — The branch added a second side rail to the Study plan screen while the locked Study promise described only the running session rail.
  - Doc claim: "a plan rail shows the card count, the tutor state, the score setting ... a Start session control and a What to expect summary" (`docs/features/learner-interface/PRD-TRD-learner-interface.md:76-79`); "the same rail shows the scope, the offer, answered count, cards left, hints used, tutor state and an end control" (`docs/features/learner-interface/PRD-TRD-learner-interface.md:81-83`)
  - Code reality: at resolution the plan rail sat in the then-current `StudyClient`, showing a count, Tutor, Score / None kept, "Start session" and "What to expect", with the running rail beside it. The `study-tab-redesign` pack later removed both rails, so the plan now renders at `v1/src/app/study/StudyPlan.tsx:50` and the session head at `v1/src/app/study/StudySession.tsx:40`.
  - Why matters: without a decision the plan screen reads as the promised Study shape, yet its facts are different.
  - Owner: learner-interface
  - To fix: decision — the learner kept the plan rail and Scenario 3 now describes both rails.
  - Verified by: learner-interface Scenario 3 updated 2026-10-25; full suite and build pass.
  - Superseded 2026-10-25: the `study-tab-redesign` pack removed both Study rails and the learner approved the one-column design.
  - Related: D-14.

- **D-14** (Medium, 2026-10-25, reporter: interface polish visual review) — The phone top bar was pinned and blurred, which the responsive-shell promise never described.
  - Doc claim: "On a phone the top bar is pinned while the page scrolls, and its background is translucent with a blur" (`docs/features/pwa-deploy/PRD-TRD-pwa-deploy.md:46-48`)
  - Code reality: inside the 860px block, `.sidebar` gets `position: sticky`, `top: 0`, `z-index: 30` and a blur at `v1/src/app/globals.css:161-176`, with sticky at `v1/src/app/globals.css:162`.
  - Why matters: lasting behaviour on the smallest screen must be intended and written down, or the next reader cannot tell.
  - Owner: learner-interface with pwa-deploy
  - To fix: decision — the learner kept it and pwa-deploy section 3.1 now names it.
  - Verified by: pwa-deploy section 3.1 updated 2026-10-25; full suite and build pass.
  - Related: D-13.

- **D-16** (Medium, 2026-10-25, reporter: interface polish visual review) — Buttons and fields did not share one height or radius, and the branch widened the height gap.
  - Doc claim: "it is 44px high with an 11px radius" and "at 40px high with a 10px radius, and a small button is 32px high" (`docs/features/learner-interface/PRD-TRD-learner-interface.md:87-95`)
  - Code reality: fields are `min-height: 44px; border-radius: 11px` at `v1/src/app/globals.css:482-496`; buttons are `min-height: 40px; border-radius: 10px` at `v1/src/app/globals.css:240-249`; `.btn.small` is 32px at `v1/src/app/globals.css:267-271`.
  - Why matters: Scenario 4 promised one family; two heights and two radii made that promise untrue on every form that puts a button beside a field.
  - Owner: learner-interface
  - To fix: decision — the learner kept the current sizes and Scenario 4 records them as deliberate.
  - Verified by: learner-interface Scenario 4 updated 2026-10-25 to name 44/11 fields, 40/10 buttons and 32 small buttons; full suite and build pass.
  - Related: D-15.

- **D-17** (Medium, 2026-10-25, reporter: interface polish visual review) — The icon artwork drew the Lucide Layers mark, contradicting the shipped icon promise.
  - Doc claim: "a deep green field with the Lucide Layers mark, three stacked chevrons" (`docs/features/pwa-deploy/PRD-TRD-pwa-deploy.md:83-84`); "draws the same three chevrons, so the tab and install icons agree" (`docs/features/pwa-deploy/PRD-TRD-pwa-deploy.md:85`)
  - Code reality: the generator header names "the Lucide Layers mark" at `v1/scripts/make-pwa-icons.mjs:3`, and its drawing code strokes the three chevrons at `v1/scripts/make-pwa-icons.mjs:82-95`; `v1/src/app/icon.svg:3-7` draws the same paths.
  - Why matters: the shipped PRD described artwork that no longer existed, so anyone regenerating or reviewing the install icon was misled.
  - Owner: pwa-deploy
  - To fix: decision — the learner kept the Layers mark and pwa-deploy section 3.3 now describes it.
  - Verified by: pwa-deploy section 3.3 updated 2026-10-25; the three PNGs were regenerated and committed; ICO and PNG tests pass.
  - Related: D-12.

- **D-18** (Low, 2026-10-25, reporter: interface polish visual review) — The Settings profile labels moved into the form family without a promise naming that screen.
  - Doc claim: "classes as every other form, not inline text" (`docs/features/learner-interface/PRD-TRD-learner-interface.md:97-99`)
  - Code reality: the profile block uses `form-grid` and `field-label` at `v1/src/app/settings/SettingsClient.tsx:298-313`; both classes already existed from the learner-interface pack.
  - Why matters: extra scope on a screen no locked line named; without a record the next reader cannot tell whether it belongs to the pack.
  - Owner: learner-interface
  - To fix: decision — the learner kept the markup and Scenario 4 now names the Settings labels.
  - Verified by: learner-interface Scenario 4 updated 2026-10-25; full suite and build pass.
  - Related: D-16.

- **D-19** (Medium, 2026-10-26, reporter: Pages workflow on push, run 40247929759) — The seed test stubbed and asserted root URLs, so under the deploy job's base path the pack download missed and eight of its ten checks failed, turning the Pages build red.
  - Doc claim: "The build job sets `NEXT_PUBLIC_BASE_PATH=/flashcards`" (`docs/features/pwa-deploy/PRD-TRD-pwa-deploy.md:132`)
  - Code reality: the workflow sets the variable for the whole build job, so the test step inherits it too (`.github/workflows/pages.yml:26-27`); `ensureSeeded` correctly fetches behind that prefix (`v1/src/lib/browser/seed.ts:64`), while the test answered only `/packs/index.json` and `/packs/starter.json` (`v1/tests/browser-seed.test.ts:28` before fix).
  - Why matters: the release gate failed on every push while the app itself was correct, so a real regression would have been buried in a known red build.
  - Owner: teaching-layers with pwa-deploy
  - To fix: fix code — the test derives its stub keys and call expectations from `withBasePath`, and the doc now names the build job rather than the build step.
  - Verified by: reproduced 8 failed / 2 passed with `NEXT_PUBLIC_BASE_PATH=/flashcards`; after the fix 10/10 at root and 10/10 under the subpath; full suite 604 passing against a `/flashcards` build; Pages run 40248801523 succeeded in build and deploy.
  - Related: none.

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
  - Code reality: import accepted pasted text only, no `<input type="file">`; reveal offered Again/Nearly/Got it but no No (the file chooser now lives at `v1/src/app/library/CreatePanel.tsx:1001`; `v1/src/app/StudyClient.tsx:13` — `CORRECTIONS` now carries all four)
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
  - Doc claim: four answering surfaces including hear-then-type (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:122`); "A cloze answer is judged per blank" (`docs/features/v1-prototype/PRD-TRD-v1-prototype.md:76`)
  - Code reality: all pack cards were single-blank; listen cards used `mode: "type"` (`v1/packs/polish-starter/cards.json` before fix; hear_type now at :439 and :453, two-blank card at :511, working card at :537)
  - Why matters: the simulation's strongest point was untestable and a promised surface had no example.
  - Owner: v1-prototype
  - To fix: fix code and pack — added a two-blank cloze card, a working-region card, and switched the listen cards to `hear_type`; the v1-prototype `simulate.mjs` that asserted point 3 is no longer in the tree, replaced by the browser simulations.
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
