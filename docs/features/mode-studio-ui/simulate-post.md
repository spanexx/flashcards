# Drift review — mode-studio-ui (2026-11-23)

**Reviewer:** fresh-eyes sub-agent, read-only
**Verdict:** Major Drift found; all items closed before ship

The route, screen helpers, PWA wiring and ownership boundaries were sound. The
review found three things worth fixing:

1. **AI-created modes could not be saved.** The draft route returns an unsaved
   mode, but `ModeEditor` always PATCHed a row that did not exist. Fixed with a
   pure `modeSaveRequest` helper: an unsaved draft goes to `POST /api/modes`, a
   stored row goes to `PATCH`. A route test proves PATCH refuses and POST saves.
2. **Phase 6 evidence was not committed.** `simulate.sh` existed but was
   untracked; this file, the archived design sim and the delivery notes close it.
3. **The rehearsal overstated its coverage.** `simulate-mode-studio.test.ts` now
   also exercises card-mix prefill, hidden-field clearing, zero-write preview,
   the AI Save handoff, helper-based export/import and backup restore.

Minor items closed: export is described as a minimal custom-mode JSON (not a
whole backup), two versions are distinguished, every dialog closes on Escape,
delete errors stay in the dialog, import validates its shape, busy guards stop
double clicks, and `modeDeleteName` is used by the delete dialog.

**Evidence after fixes:** 18 targeted tests green; `npm run build` with
`check-pwa: passed` and `out/modes/index.html`; `simulate.sh` PASS; typecheck and
changed-file eslint clean; full suite and drift gates recorded in the delivery
note below.

**Reconciliation:** `simulate-pre.html` moved to `archive/` as the design record;
`simulate.sh` is the single canonical rehearsal.
