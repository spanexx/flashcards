# IMPL — provider-relay

Status: draft
Date: 2026-10-28
Contract: `docs/features/provider-relay/PRD-TRD-provider-relay.md`

Order matters: the server must refuse bad targets before the browser can send
one; the memory must exist before the fallback writes it.

## Phase 1 — Server relay module

Files:

- `v1/server/src/relay.ts` (new): `readRelayRequest`, `isPrivateAddress`,
  `resolveTarget`, `relayChat`, pinned HTTPS sender.
- `v1/server/src/proxy.ts`: export `readChatRequest` pieces already exported;
  no change to paid behaviour.
- `v1/tests/server-relay.test.ts` (new).

Checks:

- Guards: http, port 8443, credentials in URL, path not ending in
  `/chat/completions`, `localhost`, private IPv4 ranges, private IPv6 ranges,
  a hostname resolving only to private addresses.
- No operator key: relay options carry no default key; a request without a key
  is refused before DNS.
- Send: pinned host + `servername`/`Host` preserved; no redirect; reply cap;
  timeout; 429 mapping; 401/404 surfaced; non-JSON 2xx refused.
- `npm test -- server-relay` green.

## Phase 2 — Server route, config, health

Files:

- `v1/server/src/http.ts`: `POST /api/relay/chat`, `relay` + relay limiter in
  `AppDeps`, `clientAddress`, `/healthz.relay`.
- `v1/server/src/config.ts`: `relayRateLimitPerHour`.
- `v1/server/src/main.ts`: build relay options always.
- `v1/server/.env.example`: `RELAY_RATE_LIMIT_PER_HOUR`.
- `v1/tests/server-http.test.ts`, `v1/tests/server-config.test.ts`.

Checks:

- Missing bearer → 401 and no upstream call.
- Valid call forwards and returns the payload.
- Per-address limiter: N+1 → 429 with `retry-after`.
- Paid lane still requires a licence and its own limiter.
- Config default 60, rejects 0 and non-numbers.
- Full server suite green.

## Phase 3 — Settings memory

Files:

- `v1/src/lib/shared/types.ts`: `provider.relayHosts`, `ProviderStatus.relay`.
- `v1/src/lib/core/settings-shape.ts`: default, normalize, cap ten.
- `v1/src/lib/browser/repository.ts`: `rememberRelayHost`,
  `forgetRelayHost`, clear on URL change.
- `v1/src/lib/browser/router.ts`: URL change clears the list.
- `v1/tests/settings.test.ts`, `v1/tests/browser-router.test.ts`.

Checks:

- Old settings rows gain `[]`; bad shapes are repaired; cap ten holds.
- Saving a profile with a new URL clears the list; saving the same URL keeps it.
- Remember/forget are idempotent.

## Phase 4 — Browser fallback

Files:

- `v1/src/lib/provider/types.ts`: `relayBase`, `preferRelay`.
- `v1/src/lib/provider/client.ts`: relay attempt, order, `via`, messages.
- `v1/src/lib/browser/provider-call.ts` (new): read config memory, call, persist
  the road.
- `v1/src/lib/browser/provider.ts`: use the wrapper in `testProvider`,
  `generateFromPrepared`, `askHint`; build the config with relay facts.
- `v1/src/lib/browser/summary.ts`, `v1/src/lib/browser/import-repair.ts`: use
  the wrapper.
- `v1/src/lib/provider/hint.ts`: accept an injected sender, default unchanged.
- `v1/tests/provider-client.test.ts`, `v1/tests/system-provider.test.ts`.

Checks:

- Direct success never calls the relay.
- 401/404/429/timeout never call the relay.
- Unreachable then relay success returns text and `via: "relay"`.
- Preferred relay failure retries direct and succeeds.
- HTTP answer from the relay is not retried direct.
- System lane never gets a relay base.

## Phase 5 — Settings screen copy

Files:

- `v1/src/app/settings/SettingsClient.tsx`.
- `v1/tests/settings.test.ts` (copy assertions where they already exist).

Checks:

- Card names the relay and the key transit when `provider.relay` is true.
- Test result says which road answered and refreshes the status.
- Setup card mentions the relay only when the build has a relay.
- No copy still claims the key never leaves the browser when the relay is used.

## Phase 6 — Verification, simulation, review

Files:

- `docs/features/provider-relay/simulate-post.md`.
- `docs/features/system-provider-subscription/DEPLOY-system-provider.md`
  (relay note, no new secret).
- `CONTEXT.md` only if a new term is needed (relay is named here).

Checks:

- `npm run lint`, `npm run build` (under the `/flashcards` base path as CI does),
  full `npm test` in `v1/`; server `npm run build` in `v1/server`.
- Manual: server run + public 401 check; Pages build with the relay base.
- Drift gates: `npm run check:drift`, `npm run check:drift:staged`.
- Post-impl simulation covers all nine contract scenarios.
- PR opened; human review event sent; no merge before approval.
