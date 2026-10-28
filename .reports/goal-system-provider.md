# Goal: a learner can pay for one system provider without the operator's keys reaching the public page

**Contract**
- Outcome: the public static app sells and uses one operator-run system LLM
  provider through Stripe. A learner can subscribe with no account, the browser
  carries only a signed pass, and every secret — Stripe, the model key, the
  license secret, the webhook secret — stays on a small service the operator
  runs. A learner who pays nothing, or whose service is missing, keeps studying
  exactly as before with their own key or none.
- Acceptance evidence:
  - The learner's 2026-10-28 request is recorded in a resolved wayfinder
    ticket; the pack has a locked GRILL, a PRD-TRD, an IMPL, a deployment
    runbook and a post-impl checklist.
  - Server and frontend tests pass; `npx tsc --noEmit` clean in `v1/` and
    `v1/server/`; changed-file eslint clean.
  - The webpack export builds, `check-pwa: passed`, and a scan of `v1/out`
    finds no Stripe secret, price id, upstream key, license secret or webhook
    secret.
  - Full suite passes.
  - The real service, run against a fake Stripe and a fake upstream, refuses
    missing/forged/expired passes, a wrong origin, a canceled subscription and
    an over-limit caller with plain JSON errors, and never echoes a secret.
  - The built page shows the System card, completes a fake checkout, stores the
    pass, gets a hint and a generation through the service, reflects
    cancellation, returns to Subscribe when the pass is cleared, and still
    tests the learner's own provider; a build without the two public variables
    has no System section and makes no system request.
  - `npm run check:drift` and `npm run check:drift:staged` -> 0 open,
    0 awaiting.
  - The branch is pushed and a PR is open with the evidence; nothing is merged
    before the human review gate.
- Scope: a new zero-dependency Node service in `v1/server/`, the System card in
  Settings → Provider, provider mode in the existing resolver, license storage
  in IndexedDB, the Pages build variables, docs, tests. Must not change the
  judge, the evidence shape, the core privacy boundary, the plan or the session
  loop; no accounts, no database, no learner data on the service.
- Authority: `delegated` by the learner on 2026-10-28 ("allow me to configure
  one system provider … make all decisions"). Product and technical decisions,
  commit and push are delegated. **Merge is not**: the repo's human review gate
  holds, and the goal closes with a reviewed PR open, not a merged branch.
- Budget: one worktree; two attempts per failure class; bounded commands; stop
  with a written handoff if the clock or context runs out.
- Stop conditions: the human review gate; a visual or HTTP check that fails
  twice; an ethics conflict; a decision that changes scope or a non-goal.

**Routing note:** this is new learner-visible behavior, so `docs/ethics/origin.md`
routes it through `feature-pipeline`. The learner named the goal skill; the pack
follows the repo's lean shape (resolved wayfinder ticket + locked GRILL +
PRD-TRD + IMPL + acceptance run). No pre-impl simulation was made; the locked
contract and the deployed-service acceptance run stood in, and
`simulate-post.md` is the canonical checklist.

**Worktree:** `/home/spanexx/.config/superpowers/worktrees/flashcards/feature-system-provider`
**Branch:** `feature/system-provider`

## Iterations

### 1 — 2026-10-28
Action: isolated the work in a worktree. Read the provider client, browser
provider resolver, repository, settings shape, router and the pages workflow.
Locked the GRILL (13 decisions: no secret in the bundle, plain Node service,
Stripe Checkout + portal, HMAC pass with 30-day life, status cache, proxy shape,
operator config, failure behaviour, one price, privacy, testability, non-goals).
Wrote the PRD-TRD and IMPL. Built the service phase by phase, test first:
config, license, Stripe + webhook, subscription truth, entitlement routes,
proxy + HTTP shell. Server tests run on real local sockets with injected
fakes.

### 2 — 2026-10-28
Action: wired the app. Provider mode `custom | system` in the settings shape
and resolver, the license row in the settings store (excluded from backup,
preserved by restore), the System card with its checkout/portal return
handling, the client that reads the service's own error sentence, and the
Pages build variables. Frontend tests for the resolver, the client, the
license row and the settings merge.

### 3 — 2026-10-28
Action: built the webpack export (Turbopack cannot resolve the worktree's
symlinked `node_modules`), ran `check-pwa`, and scanned `v1/out`: all five
secrets absent, only the API base and display name present. Stood up the real
service against a fake Stripe and a fake model. HTTP checks passed: health,
config, checkout, completed session, status, portal; 401 missing/forged/
expired; 403 wrong origin; 402 canceled (status and chat); 429 on the ninth
call with `retry-after: 3600`; the empty-env start named variables and exited
non-zero; no secret echoed; the upstream saw the operator key, the configured
model and temperature 0.2. Then in the built page: the System card appeared
with name and price; **Subscribe** left for the fake checkout; a cancelled
return said nothing was charged, stripped the query and stored nothing.

### 4 — 2026-10-28
Action: finished the built-page acceptance. A completed fake checkout wrote the
30-day pass in its own row, selected `system`, showed **Active until
27/11/2026** and **Subscribed / Tested**; **Test connection** answered through
the service; a **TUTOR HINT** arrived from the fake upstream (`kind: hint`); a
generation saved a card (`kind: generation`). Cancelling in the fake portal
turned the card **Not active** and **Test connection** answered "This
subscription is not active." Deleting the pass returned the card to
**Subscribe** and the profile to **Needs a pass / Pass: not stored**. The
learner's own provider, pointed at a second CORS-correct fake on 8790, tested
**Tested** with the key in its `authorization` header. Screenshots were
unavailable (the in-app browser kept the page hidden), so the evidence is DOM
snapshots plus the fakes' recorded state; that limit is written into
`simulate-post.md`. A no-base rebuild was started to prove the pre-pack
Provider tab.
Next: finish the no-base check, run the gates and full suite, fill the IMPL
and this ledger, push the branch and open the PR.

### 5 — 2026-10-28
Action: the no-base rebuild finished (`BUILD_EXIT=0`, `PWA_EXIT=0`,
`CHECK_EXIT=0`, `check-pwa: passed`, 78 files) and its scan found no service
address, no provider name and no secret-shaped token. Served it on 8090 from
Windows and verified from both `localhost` and the WSL address: Settings →
Provider shows only "Provider profile" and "Set up your own provider", no
System section, no Subscribe, no mode switch; its 11 network requests are all
static assets from its own origin, none to the service. Validation so far: app
`tsc --noEmit` clean, server `tsc --noEmit` clean, changed-file eslint 0 on 24
files, server build clean, drift gate 0 open / 0 awaiting. A first full-suite
attempt was killed: run beside the build it starved the machine (load 38) and
one file's 20-second import hook timed out; that file passes alone in 16 s
(5/5), and the suite is being re-run alone for a clean record.
Next: collect the full suite, fill the IMPL verification and delivery note,
commit, push, open the PR and post the review event.

### 6 — 2026-10-28 (close)
Action: ran the full suite alone — 81 files / 856 tests passed, exit 0. Filled
the IMPL verification and delivery note, including three deliberate deviations:
no pre-impl simulation (lean shape; the locked contract and the build-level
acceptance stood in), screenshots unavailable (DOM plus the fakes' state), and
the suite re-run alone after the starved first attempt. Committed `8c302d9`
(47 files), pushed `feature/system-provider`, and opened PR #4 with the evidence
body: <https://github.com/spanexx/flashcards/pull/4>. Both drift gates pass
(0 open, 0 awaiting; 47 staged files touch no open entry). Cleanup: stopped the
stub, the service and both fakes; closed 8088, 8787, 8789, 8790 and 8090;
deleted `/tmp/system-provider-accept`; removed the worktree's `node_modules`
symlink, `out` and `.next`; `git status` is clean. The commit body was cut short
by a heredoc quoting fault — the title and first three paragraphs are intact,
and the complete rationale is in the PR body and the pack docs.

The merge is the learner's decision: the branch, worktree and PR stay for
review. Committing and pushing were delegated; merging was not.

