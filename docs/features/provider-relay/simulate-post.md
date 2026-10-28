# Provider relay — simulation after the build

Run against the built export and the real service code, not the dev server.
Two pieces are needed:

1. **A built page with a relay address.** The relay exists in the browser only
   when `NEXT_PUBLIC_SYSTEM_API_BASE` is set at build time. Without it the
   Provider tab is the custom-only screen and no relay is ever tried.
2. **The service.** The acceptance run used the real route, guards and limiter
   from `v1/server/dist` with two test-only swaps: a fake DNS resolver and a
   fake `send` that records instead of opening a socket. That is the harness in
   `v1/tests/server-relay.test.ts`; the browser run loaded the same modules
   through a small `/tmp` script.

Two local fakes stand in for the outside world: a provider on port 8790
(permissive CORS, `/v1-reject/*` answers 401, the connection-test prompt answers
`OK`, a generation prompt answers one line, anything else answers a tutor
sentence) and a static host on 8791 serving `v1/out`. Both are throwaway Node
scripts in `/tmp`; nothing in the repo depends on them.

The 2026-10-28 run used **Build B**: a root-path export with
`NEXT_PUBLIC_SYSTEM_API_BASE=http://localhost:8788`, served at 8791, against the
service on 8788 with `RELAY_RATE_LIMIT_PER_HOUR=30`. The fake provider address
`https://llm-b.test/v1` resolves to the fake provider; its name never resolves in
the browser, which is exactly the browser-level failure the relay exists for.

## Checklist — the nine contract scenarios

1. **Direct success.** With a reachable provider, **Test connection** answers
   "The provider answered directly. It is ready to use.", the card shows
   **Tested**, the console shows one direct POST and a success line, and the
   relay log does not grow.
2. **Unreachable, then relay, then remembered.** Save a provider whose name the
   browser cannot resolve. **Test connection** shows one direct POST, the CORS
   warning, then `POST relay` and "The provider answered through the relay. It
   is ready to use." The relay log gains a record. Then make any other provider
   call (a tutor hint is enough): its **first** provider console line is
   `POST relay`, with no direct attempt before it.
3. **HTTP 401 stays direct.** Point the profile at a provider that answers 401.
   **Test connection** reports "The provider rejected the key. Check the key in
   settings."; the console shows one direct POST and no `POST relay`; the relay
   log does not grow.
4. **Guards refuse before any connection.** Against `/api/relay/chat`: `http:`
   → 400, port 8443 → 400, a path that is not `/chat/completions` → 400,
   credentials in the address → 400, `127.0.0.1` → 400, a name resolving to
   `10.0.0.7` → 400, an unknown name → 502. No fake `send` ran for any of the
   400s.
5. **No operator-key fallback.** With the paid proxy configured, a relay request
   with no bearer → 401. With `learner-key`, the recorded upstream call carries
   that key — never the operator's — and a body of exactly
   `messages, model, temperature`.
6. **Address limit.** With the limit set to 2, the third call in the window is
   429 with `retry-after: 3600`.
7. **Test connection reports the road and updates memory.** Scenarios 1 and 2
   show both sentences; scenario 2's next call proves the memory took.
8. **Settings copy names the transit.** Once the host is remembered, the card
   reads "This provider refused calls from the browser, so calls go through the
   relay. The key is sent with each call and is not stored there." Before any
   memory, it reads "The browser calls the provider directly. If your provider
   refuses browser calls, the relay is tried automatically."
9. **System lane unchanged.** With no pass or a forged pass, `/v1/chat/completions`
   is 401; the paid lane never consults the relay and the relay never consults
   the operator's key.

## Evidence from the 2026-10-28 run

### Builds and suite

- **Build A** (CI shape: base `/flashcards`, no system variables): `next build
  --webpack`, `build-pwa`, `check-pwa` → `check-pwa: passed (base path:
  /flashcards, files: 78, precache entries: 76)`.
- **Build B** (root paths, `NEXT_PUBLIC_SYSTEM_API_BASE=http://localhost:8788`):
  the relay address appears in exactly one chunk
  (`_next/static/chunks/417-6513df30ffa24543.js`), and a scan of `out/` for
  `sk_live`, `sk_test`, `whsec_` and `SYSTEM_LLM_API_KEY` is clean.
- Full suite: `vitest run` → 82 files, 908 tests, exit 0.

### Server checks

Route, guards and limiter were the real ones from `dist`, with a fake resolver
(`llm-b.test` → `93.184.216.34`, `private.test` → `10.0.0.7`) and a recording
`send`:

| Call | Answer |
|---|---|
| no bearer | 401 |
| `http://…/chat/completions` | 400 |
| `https://…:8443/…` | 400 |
| `https://…/v1/messages` | 400 |
| credentials in the address | 400 |
| `https://127.0.0.1/chat/completions` | 400 |
| `https://private.test/chat/completions` | 400 |
| `https://unknown.test/chat/completions` | 502 |
| good request | 200 |

- Limit 2 → third call 429 with `retry-after: 3600`.
- System lane with no pass and with a forged pass → 401.
- The recording upstream saw only `learner-key`; every body had exactly
  `messages, model, temperature`; the connection was pinned to
  `93.184.216.34` with `servername: llm-b.test` and `Host: llm-b.test`. Zero
  occurrences of the operator's key.

### Browser flows (Build B at `http://localhost:8791`, service 8788)

1. **Direct.** Provider `http://localhost:8790/v1`, model `direct-model`:
   **Test connection** → "The provider answered directly. It is ready to use.",
   card **Tested**, console one direct POST and a success line, relay log
   unchanged at one earlier record.
2. **Relay fallback.** Provider `https://llm-b.test/v1`, model `test-model`,
   **Save profile**, **Test connection**. Console, in order:
   `[provider] POST https://llm-b.test/v1/chat/completions model=test-model`;
   `ERR_NAME_NOT_RESOLVED`; the CORS warning after 6300 ms;
   `[provider] POST relay model=test-model`; `ok via relay in 380ms, 2
   characters`. Card: "The provider answered through the relay. It is ready to
   use." The relay recorded
   `{"hostHeader":"llm-b.test","address":"93.184.216.34","servername":"llm-b.test","key":"learner-key","model":"test-model","connectionTest":true,"bodyKeys":["messages","model","temperature"]}`.
   **Relay-first, next call.** Study → tutor on → start session → **Ask for a
   hint**: the hint arrived (`TUTOR HINT / OK`) and the console's only provider
   lines were `POST relay` then `ok via relay in 21ms` — no direct attempt. The
   relay recorded the hint call with the same pinned target and key.
3. **401.** Provider `http://localhost:8790/v1-reject`, model `direct-model`,
   **Save profile** (a new address clears the memory), **Test connection** →
   "The provider rejected the key. Check the key in settings."; console one
   direct POST and the 401 warning, no `POST relay`; the relay log stayed at
   three records.
7. **Road reporting.** Sentence 1 above for direct, sentence 2 for relay.
8. **Copy.** After the relay success the card read "This provider refused calls
   from the browser, so calls go through the relay. The key is sent with each
   call and is not stored there."
9. **System lane.** 401 without a pass, 401 with a forged pass; the relay's
   recorded calls carry the learner key only.

**Capture note:** the run used DOM snapshots, browser console output and the
fake servers' recorded hits; no screenshots were taken. The one `404` console
line in the run is Build B's missing `sw.js` (that build skipped `build-pwa`),
not a relay failure.
