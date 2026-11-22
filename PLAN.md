# TRACK 4 — Mode Studio UI (build FOURTH, last)

Status: PLAN ONLY. Base: `feature/built-in-modes`. Branch: `feature/mode-studio-ui`.

## 1. Scope and non-goals

New Pack structured fields plus a first-class Modes wing: list, duplicate, edit, AI-create, test preview, export/import, delete. Consume Tracks 1-3; write no core/schema/prompt/mode-content code.

Non-goals: changing endpoint contracts, provider schemas, mode definitions, router code, prompt rules.

## 2. Current state (evidence from research)

- `CreatePanel` `v1/src/app/library/CreatePanel.tsx:81` mounted by `LibraryClient.tsx:261-271`; three steps target `:527-584`, method `:534-611`, content `:614-1075`; Write/Generate/Chat/Import branches `:625-1050`.
- `briefForTarget` `library-utils.ts:205-227` strips fields for deck/cards; `optionalBrief` `router.ts:169-177` runs `validateCreationBrief` and drops unknown fields — hence Track 1's additive brief fields are required.
- Library tabs are component state: `LibraryTab` `library-utils.ts:14`, `LibraryClient.tsx:43`, buttons `:249-259`. Routes are App Router folders (`library/page.tsx:6-10`, `dictionary/page.tsx:7-15`). Sidebar `LINKS` `Nav.tsx:18-23`, `prefetch={false}` `:57`, pathname startsWith `:52`.
- New route must update `check-pwa.mjs:84` (requiredRoutes) and `:246` (precache list) or build fails. `build-pwa.mjs:41-50` walks out automatically; sw is network-first for navigation `:88-105`.
- API helper `client/api.ts:15-25`; CRUD precedent list `LibraryClient.tsx:52-58`, create `CreatePanel.tsx:259-266`, update `PackEditor.tsx:74-97`, delete `LibraryClient.tsx:194-226`, `DeleteDialog.tsx:20-90`, `deleteName` `library-utils.ts:149-152`.
- Draft precedent `PageEditor.tsx:155-159,356-409` (read-only prompt, copy, send, "draft in editor, nothing saved").
- Preview via `CardSide.tsx:18-35`; existing form classes `globals.css:1151-1165,1188-1198,804-819`; `.create-grid` collapses at 760px `:1129-1149`, `.library-layout` at 1100px `:3285-3294`, `.brief-grid/.form-grid` at 620px `:1280-1289`.

## 3. Locked decisions

1. Modes is a first-class route `/modes` with sidebar entry and `ModesClient.tsx`, not a fourth Library tab.
2. New Pack fields render once for `target === "pack"` before the method branch: Learning Mode, Subject, Target Language, Question Language, Card Mix (from `defaultCardMix`), Extra Study Preferences. Reuse `LanguageField` and existing form classes.
3. Deck/cards targets show inherited mode read-only; no editable dropdown.
4. Label "Learning mode" everywhere — bare "Mode" collides with AnswerMode and provider mode.
5. `cardMix` is `AnswerMode[]` from Track 1's additive brief fields; do not silently replace `cardStyle`.
6. No `/validate` endpoint. Save goes through Track 1 write routes; inline feedback uses Track 1's pure validator only.
7. Test Preview is a pure local render via `CardSide`; no backend, no persistence.
8. AI Mode Creator uses Track 2's draft prompt and Track 1's draft endpoints; prompt preview is read-only with copy; send opens editor, nothing saved until Save.
9. Built-ins show Duplicate & Customize; user modes show Edit / Test preview / Delete with typed-name confirmation. Built-in delete is refused by router.

## 4. Proposed components and contracts

- `LearningModeFields.tsx` — props `{ brief, modes, onChange }`; maps `modeId`, `subject`, `targetLanguage`, `sourceLanguage`, `cardMix`, `modePreferences`.
- `ModesPanel.tsx` / `ModesClient.tsx` — `GET /api/modes`, duplicate `POST /api/modes {sourceModeId,name}`, delete `DELETE /api/modes/:id`.
- `ModeEditor.tsx` — fields from the entity; Save `POST`/`PATCH`; inline `validateCanonicalExample`; error detail via `errorLines` `library-utils.ts:154-168`.
- `AiModeCreator.tsx` — `POST /api/modes/draft`, `POST /api/modes/draft/send`; provider gate pattern `CreatePanel.tsx:157-160,464-474`; version badge from Track 2.
- `ModePreview.tsx` — renders canonicalExample cards via `CardSide` with no writes.
- Export/import: reuse bundle export/import UI patterns for a mode JSON file if Track 1 exposes helpers; otherwise defer with an explicit note, not a fake button.

## 5. File ownership

**Own:** `CreatePanel.tsx`, new `LearningModeFields.tsx`, `CreationBriefFields.tsx` (only if fields live there), `library-utils.ts`, `LibraryClient.tsx`, new `ModesPanel.tsx`, `ModeEditor.tsx`, `AiModeCreator.tsx`, `ModePreview.tsx`, new `app/modes/page.tsx` + `ModesClient.tsx`, `Nav.tsx`, `globals.css`, `check-pwa.mjs`, tests: new `mode-studio-utils.test.ts`, `browser-modes-ui.test.ts`, `simulate-mode-studio.test.ts`, new `docs/features/mode-studio-ui/` origin pack with pre/post sims.

**Must not touch:** Track 1 type/schema/repository/router; Track 2 prompt modules/version; Track 3 mode content; `client/api.ts`; `layout.tsx`; `package.json`; Drift live entries.

## 6. Ordered steps with proof

1. Write `docs/features/mode-studio-ui/{GRILL,PRD-TRD,IMPL}.md` and pre-simulation from this plan.
2. Red tests: prefill helper, endpoint CRUD through `localGet`/`localSend`, invalid canonicalExample blocks Save, AI draft unsaved, built strings.
3. Add `LearningModeFields` and wire `CreatePanel`; verify mode/cardMix/preferences reach Write/Generate/Chat briefs.
4. Add `/modes` route, Nav, ModesPanel, ModeEditor, AiModeCreator, ModePreview; update check-pwa route/precache lists.
5. Proof: `npm run build` first (sim reads `out/`), targeted vitest, full suite, typecheck, changed-file lint, both drift gates.

## 7. Acceptance

- Selecting any built-in in New Pack loads its skill/example into the prompt.
- Duplicate → edit → valid canonicalExample → Save → visible and selectable immediately; invalid example is refused with field-named message and draft stays open.
- Test Preview does not write; AI draft opens unsaved; built-in delete refused; custom modes survive backup/restore.
- Build passes check-pwa with `/modes`; existing Create strings remain in built output; 390px controls usable.

## 8. Risks

Mobile height from editor + AI box — reuse stack/modal classes and 16px controls. Stale service worker — rebuild and check sw.js version. Contract drift — build only after Tracks 1-3 interfaces are signed off; never edit router or prompt builders here.
