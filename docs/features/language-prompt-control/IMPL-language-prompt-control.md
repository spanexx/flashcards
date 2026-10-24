# IMPL: Language and prompt control

## Phase 1 — Pack metadata and language helper

Files:
- `v1/src/lib/shared/language.ts` (new)
- `v1/src/lib/shared/types.ts`
- `v1/src/lib/packs/types.ts`
- `v1/src/lib/packs/loader.ts`
- `v1/src/lib/packs/adopt.ts`
- `v1/src/lib/core/schema.ts`
- `v1/src/lib/browser/repository.ts`
- `v1/src/lib/browser/bundle.ts`
- `v1/public/packs/polish-starter.json`

Work:
- Add `sourceLanguage` and `studyInstruction` to pack types and status.
- Add language normalisation, readable names and pair labels.
- Carry fields through load, adopt, import, export, backup and restore.
- Mark the Polish starter pack source as English and add a short instruction.

Proof:
- `npm run typecheck`
- Unit test for normalisation and old-file compatibility.

## Phase 2 — Pair-aware prompts and generation

Files:
- `v1/src/lib/provider/prompt.ts`
- `v1/src/lib/provider/generate.ts`
- `v1/src/lib/browser/provider.ts`
- `v1/src/lib/browser/authoring.ts`
- `v1/src/lib/shared/creation.ts`

Work:
- Export prompt defaults for the editor.
- Add pair and instruction lines to generic prompts.
- Replace the hardcoded Polish example with a target-language example.
- Apply the brief's pair and instruction over a generated pack, so a provider
  may echo them but cannot replace them.
- Keep Polish-only wording in the Polish starter pack.

Proof:
- `npm test -- provider-prompt`
- `npm test -- browser-authoring`
- A generated English/English prompt contains no Polish.

## Phase 3 — Creation fields and pack editor

Files:
- `v1/src/lib/shared/creation.ts`
- `v1/src/app/library/CreationBriefFields.tsx`
- `v1/src/app/library/CreatePanel.tsx`
- `v1/src/app/library/PacksPanel.tsx`
- `v1/src/app/library/PackEditor.tsx` (new)
- `v1/src/lib/browser/router.ts`
- `v1/src/lib/browser/bundle.ts`

Work:
- Add target, source and instruction to the creation brief.
- Inherit the parent pair for deck/cards; require a target for a new pack.
- Show the inherited pair and instruction on Write deck/cards and on Generate
  and Chat.
- Apply the brief to a Chat pack before its answer is imported.
- Add Write pack fields.
- Add `PATCH /api/packs/:name`.
- Add the pack editor with language pair, instruction and four prompt fields.
- Add "Edit pack" to the Packs row.

Proof:
- Router test for PATCH, prompt reset and missing pack.
- `npm run typecheck`.

## Phase 4 — Study instructions, listening fallback and hint isolation

Files:
- `v1/src/lib/client/study-view.ts`
- `v1/src/app/StudyClient.tsx`
- `v1/src/app/globals.css`

Work:
- Add `studyCardInstruction`.
- Render the pack or automatic instruction on every card.
- Add the listening text reveal and reset it per card.
- Add the hint request token; discard late responses; reset busy state.

Proof:
- Unit tests for each mode and the neutral fallback.
- Browser simulation for the reveal and the hint race.
- `npm run lint`.

## Phase 5 — Full verification and docs

Work:
- Run typecheck, lint, build and the full suite.
- Build the post-implementation simulation.
- Run the drift check.
- Reconcile pre/post simulations into one canonical script.
- Update the goal ledger.

Proof:
- `npm run typecheck && npm run lint && npm run build && npm test`
- `bash docs/features/language-prompt-control/simulate.sh`
- Browser lane through the built output.

## Delivery notes

- No merge, release or stable action in this pack.
- Stop at the commit/PR approval gate.
