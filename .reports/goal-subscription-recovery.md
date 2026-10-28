# Goal: subscription recovery delivered and ready to commit

Contract: outcome — the recovery pack (docs, server endpoints, Brevo mailer, app form and link path) is built in `feature/subscription-recovery` and proven; evidence — PRD-TRD and IMPL exist with every decision recorded, `vitest run` green, CI-shaped build + `check-pwa: passed`, post-impl simulation recorded with real outputs, `check:drift` and `check:drift:staged` exit 0; scope — `v1/server`, the system-provider UI and client, tests, pack docs, ticket and map line; authority — delegated for every design and implementation decision (user, 2026-10-28, "make all other decisions please"), user-only for the commit go, merge and push; budget — 10 attempts per failure class; stop at the commit gate.
Pipeline: feature-pipeline, Phase 0.5 done (sim written), next Phase 1 (PRD-TRD).
Worktree: `/home/spanexx/.config/superpowers/worktrees/flashcards/feature-subscription-recovery` (branch `feature/subscription-recovery`, based on main `1cd9d23`).

## Decisions taken under delegation

### Simulation sign-off (2026-10-28)

Question: does the pre-impl simulation stand as the design?
Answer: yes; the learner answered its one fork ("Always visible") and then delegated the rest.
Why: "make all other decisions please" (2026-10-28) hands design choices to the agent; the skill's sim gate is a design gate, not one of the three human gates.
Source: user message, 2026-10-28. The learner did not personally run the script; its content was summarised to them and the fork answered.

### Worktree provenance (2026-10-28)

Question: the pipeline gate wants `agent-worktree feature <slug>`; this worktree was made with `git worktree add` before that rule was read.
Answer: keep it; the isolation outcome the gate protects is met (dedicated worktree, branch is not main, nothing edited on main). The CLI has no adopt flag and would collide with the existing branch.
Why: recreating would mean destructive removal of a worktree holding the GRILL, ticket and sim, and the CLI refuses main's untracked `sessions/` file anyway.
Source: feature-pipeline SKILL.md isolation gate; `agent-worktree feature --help`.

## Iterations

### 1 — 2026-10-28T08:24Z
Action: activated the goal; recorded the sim sign-off and the worktree deviation; started Phase 1 (PRD-TRD).
Verification: `GetGoal` -> no active goal before creation; `CreateGoal` -> id 1793175818594-c197da; `bash docs/features/subscription-recovery/simulate-pre.sh` ran end to end (15 scenes).
Verdict: pass
Next: read the app and server integration points, then write PRD-TRD.

### 2 — 2026-10-28T09:00Z
Action: wrote `PRD-TRD-subscription-recovery.md` (BS-1..BS-10, 12-scene simulation contract, 5.1–5.8) and `IMPL-subscription-recovery.md` (5 phases, stops at the commit gate).
Verification: PRD/IMPL exist and cite the GRILL and ticket; no code yet.
Verdict: pass
Next: build the server layer.

### 3 — 2026-10-28T09:01Z
Action: built the server layer — `recovery.ts`, `mailer.ts`, two Stripe reads, the recovery config group, the two routes and health, `main.ts` wiring, `.env.example`; wrote `server-recovery`, `server-mailer` tests and extended `server-http`, `server-config`, `server-stripe`.
Verification: `vitest run` on the five server files -> 84 tests green; `tsc --noEmit` for app and server -> exit 0; `npx eslint src tests` -> exit 0.
Verdict: pass
Next: wire the app.

### 4 — 2026-10-28T09:03Z
Action: added `recovery` to `SystemPublicConfig`, `requestRecovery`, `redeemRecovery`, the two sentences; new `RecoverySection.tsx` under the System card; `?recover=` read once, stripped, redeemed into a pass with the provider switched.
Verification: `tests/system-client.test.ts` -> 19 tests green; app `tsc --noEmit` -> exit 0 (after fixing a fake's customer type); `npx eslint src tests` -> exit 0.
Deviation found and fixed: my first copy said the link "works once", but GRILL entry 5 and the code allow more than one opening inside the window. Copy corrected in both places.
Verdict: pass
Next: CI-shaped build, full suite, post-impl simulation.

### 5 — 2026-10-28T09:12Z
Action: ran the post-impl harness over real `dist` modules with local Stripe and Brevo fakes (20 scenarios); recorded GRILL entries 8 and 9 (one email/one account; the no-link option priced and refused) and the exact-email lookup decision; reconciled the PRD's "one-time" and "lowercased before signing" wording with the code.
Verification: harness -> 20/20 scenarios passed; Windows `curl.exe http://localhost:8789/healthz` reaches the service from the host.
Verdict: pass
Next: CI-shaped build + `check-pwa`, full suite, browser run, drift gates, stage and stop.

### 6 — 2026-10-28T09:28Z
Action: CI-shaped build (`/flashcards`, `check-pwa`), full suite against the fresh `out/`, then a browser pass on a second build pointed at the local service (`NEXT_PUBLIC_SYSTEM_API_BASE=http://localhost:8789`) served under `/flashcards`.
Verification: `check-pwa: passed (base path: /flashcards, files: 78, precache entries: 76)`, `EXIT:0`; `Test Files 84 passed (84) / Tests 957 passed (957)`; bundle scan for every secret name and value -> CLEAN; browser: form shown, stranger and subscriber both got the same sentence (mail rows 3 -> 4), the link stored `sub_phone/cus_phone`, banner shown, `?recover=` stripped, card Active until 20/01/2027; expired link sentence with the form usable.
Deviation found and fixed: the System card stayed "Not subscribed" after a redeem until a reload, because the card loads its pass once and the parent's `refresh()` cannot reach it. Added a `reloadSignal` prop (bumped after the redeem) and re-ran: card Active until 18/01/2027 in place, no reload.
Verdict: pass
Next: post-impl sim record (written), CI-shaped rebuild after the fix, suite again, drift gates, stage, stop at the commit gate.

### 7 — 2026-10-28T09:34Z
Action: CI-shaped build after the fix, browser check of the no-service build, full suite again, cleanup, staging, both drift gates.
Verification: `check-pwa: passed (base path: /flashcards, files: 78, precache entries: 76)` `EXIT:0`; no-service build shows only "Provider profile" and "Set up your own provider", zero requests to :8789; `Test Files 84 passed (84) / Tests 957 passed (957)` `EXIT:0`; scratch processes stopped (ports 8789 and 8791 clear), `/tmp` scratch and the worktree's `out/`, `.next`, `dist/`, `tsconfig.tsbuildinfo` and `node_modules` symlink removed; 27 files staged path by path, `v1/node_modules` deliberately not among them; `npm run check:drift` and `check:drift:staged` -> `drift ok: 0 open, 0 awaiting, 31 resolved` / `27 staged files touch no Open or Awaiting entry`.
Verdict: pass, stopped at the commit gate as the goal requires.
Next: the learner's go to commit; then push and open the PR.
