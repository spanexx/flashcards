# Goal: provider relay on main, pushed

Contract: outcome — the provider relay is merged into local main and pushed, with all nine simulation-contract scenarios demonstrated and recorded. Evidence — `docs/features/provider-relay/simulate-post.md` with recorded outputs; full v1 suite 908 green; CI-shaped build (`check-pwa: passed`) and acceptance build clean of secrets; `npm run check:drift` and `check:drift:staged` exit 0; `git log origin/main` shows the merge; `git status` clean. Scope — `v1/server`, the app provider path, tests, the relay pack docs, the DEPLOY note, plus the recovery mailer decision record only. No recovery code. Authority — delegated, except the merge/push which the user explicitly ordered on 2026-10-28. Budget — 10 iterations per failure class; stop at any hard gate. Pipeline — feature-pipeline, Phase 6 (verification, simulation, review); merge ordered directly by the user, replacing the PR step.

Worktree: `/home/spanexx/.config/superpowers/worktrees/flashcards/feature-provider-relay`

## Delegated decision — free mailer (2026-10-28)

Question: which free email service carries the subscription-recovery one-time link?
Answer: Brevo free tier; revisit if its limits fail the grill.
Why: Resend's free tier needs a verified domain before it can mail arbitrary learners; Brevo verifies a single sender address by email, which fits "for now" with no domain. Cost: 300/day cap and shared-IP reputation.
Source: user asked for "a free mailer for now" (2026-10-28); service terms inferred, to be verified at grill time. No code depends on this yet.

## Iterations

### 1 — 2026-10-28T08:13Z
Action: finished the browser-side tests for the relay (router memory, normalization, provider roads), fixed types, ran lint and typecheck.
Verification: `vitest run provider-client system-provider settings browser-router` -> 96 passed; `tsc --noEmit` -> 0; `eslint` on changed files -> 0 errors.
Verdict: pass
Next: full suite, builds, server checks.

### 2 — 2026-10-28T08:24Z
Action: CI-shaped build (base path `/flashcards`, no system vars); full suite; bundle scan.
Verification: `next build --webpack` + `build-pwa` + `check-pwa` -> `check-pwa: passed (base path: /flashcards, files: 78, precache entries: 76)`; `vitest run` -> 82 files, 908 tests, exit 0; bundle scan -> clean, no secrets or service host.
Verdict: pass
Next: server acceptance checks.

### 3 — 2026-10-28T08:27Z
Action: started acceptance services (real route/guards/limiter via `dist`, fake DNS + fake send, no operator key in the relay), ran guard, limit and lane checks.
Verification: no key -> 401; http -> 400; port 8443 -> 400; non-chat path -> 400; credentials -> 400; private literal -> 400; name resolving private -> 400; unknown name -> 502; good call -> 200; limit 2 -> third call 429 `retry-after: 3600`; system lane no/forged pass -> 401. Upstream records show only `learner-key`, body keys `messages, model, temperature`, pinned address `93.184.216.34`, `servername: llm-b.test`.
Verdict: pass
Next: browser flows on the acceptance build.

### 4 — 2026-10-28T08:44Z
Action: ran the browser flows on Build B (root, relay base `http://localhost:8788`, served at 8791) against the service on 8788 with the limit set to 30; wrote `docs/features/provider-relay/simulate-post.md`.
Verification: direct test -> "The provider answered directly. It is ready to use.", relay log unchanged; `llm-b.test` -> direct `ERR_NAME_NOT_RESOLVED` then `POST relay` -> "…through the relay…", record with `connectionTest:true` and `key:"learner-key"`; next call (tutor hint) had `POST relay` as its first provider line; 401 provider -> plain sentence, no relay line, log stayed at three records; remembered-host copy exact; system lane still 401 without/with a forged pass. Bundle scan of `out/`: relay base in one chunk, no secrets.
Verdict: pass
Next: cleanup, drift gates, commit, merge to local main, push.

### 5 — 2026-10-28T08:45Z
Action: stopped the four acceptance servers (8788–8791 closed), deleted `/tmp/relay-accept` and the acceptance logs, removed the `v1/node_modules` symlink, `out/`, `.next`, `tsconfig.tsbuildinfo` and `server/dist`; ran both drift gates; committed path by path; fast-forwarded local main; pushed.
Verification: `check:drift` and `check:drift:staged` -> `0 open, 0 awaiting, 31 resolved`, `drift staged ok: 32 staged files`; commit `9d32ebc` (32 files); main fast-forward `82818fb..9d32ebc`; `git push origin main` -> `82818fb..9d32ebc main -> main`; `origin/main` at `9d32ebc`; the only untracked item left is the learner's own `sessions/features-plan-multi-select`.
Verdict: pass — goal complete
Next: none; a later pack can pick up the recovery flow (Brevo decision recorded above).
