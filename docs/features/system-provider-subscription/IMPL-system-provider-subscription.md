# IMPL — System provider subscription

**Slug:** system-provider-subscription
**Status:** In progress
**Date:** 2026-10-28
**Origin:** `wayfinder/anything-learning-spec/tickets/system-provider-subscription.md`
**Contract:** `docs/features/system-provider-subscription/PRD-TRD-system-provider-subscription.md`

## What this pack builds

A small Node service in `v1/server/` that holds the operator's Stripe and model
keys, sells one recurring subscription through Stripe Checkout, signs a license
the browser can carry, and proxies OpenAI-compatible chat calls for a valid
license. The static app gains a System provider card, a system mode in the
existing provider resolver, and checkout/portal return handling. No database,
no accounts, no server-side learner data.

## Phases

Each phase is test first, then the smallest implementation, then the phase's
own check before the next phase starts.

1. **Server shape and config.** Tests for `parseConfig`: defaults, missing
   required names collected together, short `LICENSE_SECRET` rejected, enabled
   groups reported without values. Then `server/src/config.ts` and
   `server/tsconfig.json` with a CommonJS build to `server/dist`.
2. **License.** Tests for sign/verify: round trip, tampered payload, tampered
   signature, wrong secret, bad version, expired token, refresh allowing expiry,
   timing-safe comparison path. Then `server/src/license.ts`.
3. **Stripe and webhook.** Tests with a fake `fetch` for form encoding, checkout
   params, portal params and error mapping; webhook tests for a valid signature,
   stale timestamp, wrong secret and missing header. Then `server/src/stripe.ts`
   and `server/src/webhook.ts`.
4. **Subscription truth.** Tests for the status cache: hit inside the window,
   refetch after it, invalidation, only `active`/`trialing` accepted, Stripe
   errors denied without caching. Then `server/src/subscriptions.ts`.
5. **Entitlement routes.** Tests for completed checkout (paid and
   no-payment-required, expanded subscription), unpaid session refused, status,
   refresh while active, refresh after expiry, portal. Then
   `server/src/entitlement.ts`.
6. **Proxy and HTTP shell.** Tests for the upstream URL rule, model replacement,
   message shape and length cap, timeout, error mapping, CORS allow/deny,
   OPTIONS, body limit, rate limit and health. Then `server/src/proxy.ts`,
   `server/src/http.ts`, `server/src/main.ts` and `.env.example`.
7. **Frontend contract.** Tests for `provider.mode` normalization and merge,
   system resolution from base + license, license row storage and backup
   exclusion, and the client response mapping. Then `system.ts`, the repository
   row functions, settings shape/types and `browser/provider.ts` system mode.
8. **Learner screen.** The System card, SettingsClient mount and
   `?checkout=` handling, the provider tab status line, and the small styles.
   Prove with the served page in the local acceptance run.
9. **Public build wiring.** Map optional repository variables in
   `.github/workflows/pages.yml`; document them. Prove the bundle contains only
   the two public names.
10. **Docs, acceptance and gates.** `DEPLOY-system-provider.md`, `simulate-post.md`,
    this IMPL's verification, the map entry, drift gates, full suite, build and
    PWA check.

## Files

Server (new, outside the static source tree):

- `v1/server/src/config.ts`, `stripe.ts`, `webhook.ts`, `license.ts`,
  `subscriptions.ts`, `entitlement.ts`, `proxy.ts`, `http.ts`, `main.ts`
- `v1/server/package.json`, `v1/server/tsconfig.json`, `v1/server/.env.example`
- Server tests live with the app suite: `v1/tests/server-*.test.ts` (Vitest,
  injected fakes, real local sockets on port 0, no network)

Frontend:

- `v1/src/lib/client/system.ts`
- `v1/src/lib/browser/repository.ts` — system license row
- `v1/src/app/settings/SystemProviderCard.tsx`
- `v1/src/app/settings/SettingsClient.tsx`
- `v1/src/lib/browser/provider.ts`
- `v1/src/lib/core/settings-shape.ts`, `v1/src/lib/shared/types.ts`
- `v1/src/app/globals.css`
- `v1/src/lib/browser/bundle.ts` — restore keeps the pass, as it keeps the key
- `v1/src/lib/provider/client.ts` — show the service's own error sentence
- `v1/tests/system-client.test.ts`, `v1/tests/system-provider.test.ts`,
  `v1/tests/system-license.test.ts`, plus updated
  `v1/tests/browser-router.test.ts` and `v1/tests/provider-client.test.ts`

Build and docs:

- `.github/workflows/pages.yml`
- `docs/features/system-provider-subscription/*`
- `wayfinder/anything-learning-spec/tickets/system-provider-subscription.md`,
  `wayfinder/anything-learning-spec/map.md`

## Edge cases

- No `NEXT_PUBLIC_SYSTEM_API_BASE`: no card, no fetch, provider tab byte-for-byte
  the old behaviour.
- Server unreachable or returning garbage: the card says it could not be
  reached; the custom provider and studying are unaffected.
- `?checkout=success` without a session id, with an expired session or after the
  learner closed the tab: a plain sentence, no license, no selection change.
- `?checkout=cancel`: a plain "nothing was charged" sentence and the query is
  removed so a reload does not repeat it.
- Stored license from an older secret: status call says invalid; the card offers
  Subscribe again; the bad row is cleared.
- License expiry inside the refresh window: refresh keeps the same subscription
  and re-signs; a failed refresh keeps the token until `exp`.
- System mode selected but no license (cleared browser data): status is not
  ready, the card explains, the custom form still works.
- Switching from system back to custom restores the learner's saved URL/model
  unchanged; the license stays for a later switch.
- Rate limit is per license hash and address; the 429 carries `Retry-After`.
- Webhook secret unset: endpoint 404, checkout and status still work.
- `.env.example` holds names only; no value that is a secret. Server files never
  enter the export.

## Out of scope

Everything listed in the PRD-TRD's non-goals. Plus: no Stripe SDK dependency, no
server build step in Pages, no client-side secret, no prompt logging, no
streaming, no retries, no database.

## Verification

- [x] Server unit and route tests with fakes. Eight files, 83 tests
      (`server-config` 10, `server-license` 7, `server-stripe` 9,
      `server-webhook` 8, `server-subscriptions` 7, `server-entitlement` 17,
      `server-proxy` 10, `server-http` 15); real local sockets on port 0, no
      network.
- [x] Frontend pure tests. `system-client` 15, `system-provider` 5,
      `system-license` 5, plus updated `browser-router`, `provider-client` and
      `settings` tests.
- [x] `npx tsc --noEmit` in `v1/` and in `v1/server/`. Both exit 0.
- [x] Changed-file eslint. 24 source and test files, exit 0.
- [x] `npm run build` and `check-pwa`. Webpack export built twice — with the
      two system variables and without them; `check-pwa: passed` both times;
      the no-base build wrote 78 files and 76 precache entries.
- [x] Full suite. `node node_modules/vitest/vitest.mjs run --maxWorkers=2`:
      81 files / 856 tests passed, exit 0.
- [x] Local acceptance: real service against stub Stripe and stub upstream,
      built page with the API base, every simulation-contract item observed —
      card and Subscribe; cancel return; completed checkout (pass, lane,
      **Active until 27/11/2026**, **Subscribed**, **Tested**); a hint and a
      generation through the proxy; pass cleared; portal cancellation; the
      learner's own provider; and the no-base build with the old Provider tab
      and no system request. Evidence in `simulate-post.md`.
- [x] Bundle scan: no upstream key, Stripe secret, webhook secret, licence
      secret or price id in `out/`; only the API base and display name appear
      (with-base build), and neither in the no-base build.
- [x] `npm run check:drift` and `npm run check:drift:staged`. 0 open, 0
      awaiting; 47 staged files touch no open entry.

## Delivery note

**2026-10-28.** Built and verified on `feature/system-provider` under the goal
contract; not merged — the PR carries it for human review. Six phases of the
IMPLE as written, then the accepted deviations:

- **No pre-impl simulation.** The learner opened this as a goal with product and
  technical decisions delegated; the pack follows the repo's lean shape
  (resolved wayfinder ticket + locked GRILL + PRD-TRD + IMPL). The locked
  contract and the build-level acceptance run stood in; `simulate-post.md` is
  the canonical checklist.
- **Screenshots were unavailable.** The in-app browser reported the page as
  hidden and refused captures. The acceptance evidence is DOM snapshots plus
  the fake servers' recorded state; every visual fact claimed is in the DOM or
  the fakes' logs, and `simulate-post.md` says so.
- **The full suite ran alone.** A first attempt beside the build starved the
  machine (load 38 on 8 cores) and one test file's 20-second import hook timed
  out. That file passes alone in 16 s, and the clean isolated run is the result
  recorded above.
- **Server dependencies are development-only.** `typescript` and `@types/node`
  build `dist/`; the running service has zero runtime dependencies.
- Operator-only work remains and is written down in
  `DEPLOY-system-provider.md`: the Stripe product and recurring price, the
  service environment (Stripe secret, price id, webhook secret, licence secret,
  upstream address/model/key), the webhook endpoint, and the two Pages
  variables. Nothing in this pack expects a secret in the repository.
