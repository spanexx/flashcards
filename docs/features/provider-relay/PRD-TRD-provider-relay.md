# PRD-TRD — provider-relay

Status: draft
Date: 2026-10-28
Pack: provider-relay
Ticket: `wayfinder/anything-learning-spec/tickets/provider-relay.md`
GRILL: `docs/features/provider-relay/GRILL-provider-relay.txt`

## 1. Why this exists

The hosted app calls the learner's provider from the browser. Some providers
refuse browser calls: they send no CORS headers, or their preflight never
succeeds, so the request never reaches them. The learner saw Mercury work and a
second provider fail this way. The app already runs one small Node service for
the paid provider; this pack lets that service carry the learner's own call when
the browser cannot, without storing the learner's key and without moving every
call off the direct road.

## 2. Context — what exists today

- The browser reads `provider.url`, `provider.model` and `provider.mode` from
  IndexedDB settings, and the key from IndexedDB (`readProviderKey`).
- `callProvider` posts the OpenAI chat shape straight to the provider and tries
  two endpoint shapes (`/chat/completions`, then `/v1/chat/completions`). It
  reports `unreachable` for a browser-level network failure and already has a
  sentence that names CORS as the likely cause.
- `systemApiBase()` is a build fact (`NEXT_PUBLIC_SYSTEM_API_BASE`), empty when
  the build has no server. System mode points `provider.url` at
  `${base}/v1` and uses the subscription pass as the bearer token.
- The server (`v1/server/`) is a zero-dependency Node 20 service. It has CORS
  for one origin, bounded bodies, a sliding-window `RateLimiter`, a paid proxy
  that replaces the model with the operator's, and an HMAC licence check.
- The wayfinder map previously said "no relay"; this pack amends that decision
  explicitly in the ticket and the map.

## 3. What it does — behavioral spec

**BS-1 Direct stays first.** For a learner's own provider, every call is tried
from the browser first. A provider that answers the browser is unchanged.

**BS-2 Relay only after a browser-level unreachable failure.** If, and only if,
the direct attempt fails before the provider answers (the CORS class), and the
build knows a relay address, the same call is retried through the relay. An HTTP
answer (401, 403, 404, 429, 5xx) never triggers a relay attempt. A timeout never
triggers one either.

**BS-3 Per-call data, nothing kept.** The relay receives the provider address,
model, messages, temperature and the learner's key. It forwards one call. It
stores no key, prompt, answer or address, and it never uses the operator's
configured key.

**BS-4 Open to anyone with a key.** No subscription pass is required. The relay
has its own per-address hourly limit, separate from the paid lane's per-licence
limit.

**BS-5 Narrow, guarded target.** The relay accepts only `https:` on port 443,
with no credentials in the address and a path ending in `/chat/completions`.
Hostnames are resolved; private, loopback, link-local and unique-local addresses
are refused; the connection is pinned to the checked address; redirects are not
followed. Request, reply and timeout ceilings match the paid proxy.

**BS-6 Remembered per host.** After a relay call succeeds, that hostname is
remembered in settings (cap ten). Later calls skip the doomed direct attempt.
Saving a provider profile clears the list. Test connection always tries direct
first, and a direct success clears the remembered host.

**BS-7 The learner sees the road.** The provider card says when calls go through
the relay and that the key is sent with each call and not stored there. Test
connection reports "Answered directly" or "Answered through the relay".

**BS-8 Honest failure.** Relay refusals have plain sentences: not a secure
address, not the standard port, not a chat endpoint, private address, address not
found, provider unreachable, provider too slow, provider answered with an error.

**BS-9 System lane unchanged.** A learner in system mode never uses the BYO
relay; the paid lane keeps its own proxy, licence check and rate limit.

## 4. Simulation contract

The post-impl simulation must demonstrate:

1. Direct success — no relay call, result returned, card reports direct.
2. Direct unreachable then relay success — result returned, host remembered, the
   next call goes relay-first.
3. HTTP 401 from the provider — no relay attempt; the key stays in the browser.
4. Relay guard refusals — `http://`, port 8443, a path that is not
   `/chat/completions`, a private address literal, a hostname resolving to a
   private address; each answered before any outbound connection.
5. No operator-key fallback — with the operator's proxy configured, a relay
   request with no learner key is refused 401; with a learner key, the upstream
   receives that key.
6. Address limit — the N+1th relay call in the window is 429 with `retry-after`.
7. Test connection — reports the road and updates the memory.
8. Settings copy — names the relay transit when the host is remembered.
9. System provider lane — its endpoint still requires a licence and behaves as
   before.

## 5. Technical design

### 5.1 Server — new module `v1/server/src/relay.ts`

```text
readRelayRequest(raw) -> { ok, request } | { ok:false, message }
  url: string, https only, port 443, no user/password, path ends /chat/completions
  model: non-empty, <= 200 chars
  apiKey: non-empty, <= 4096 chars, no CR/LF
  messages/temperature: reused from proxy.ts readChatRequest

isPrivateAddress(address) -> boolean          // IPv4 + IPv6 literals
resolveTarget(hostname, lookup) -> { ok, addresses[] } | { ok:false }
relayChat(deps, raw) -> ProxyResult
  deps = { lookup, send, timeoutMs }
  send = pinned HTTPS POST (host = checked IP, servername + Host = original,
         redirects never followed, reply capped at MAX_REPLY_CHARS)
```

Status mapping:

| Case | Status | Sentence shape |
|---|---|---|
| malformed request | 400 | names the missing field |
| insecure/private/port/path refusal | 400 | names the rule |
| DNS or connect failure | 502 | "The provider could not be reached." |
| upstream 429 | 429 | "The provider is asking us to slow down." |
| upstream other non-2xx | that status | plain provider-answer sentence |
| upstream 3xx | 502 | "The provider tried to redirect the call, which this relay does not follow." |
| non-JSON 2xx body | 502 | "The provider answered in a way this relay cannot read." |
| timeout | 504 | "The provider took too long to answer." |

### 5.2 Server — route and config

- `POST /api/relay/chat`: bearer token is the learner's key, required; no
  licence; per-address limiter; body ≤ 1 MB; calls `relayChat`.
- Client address: the last `x-forwarded-for` entry when present, otherwise
  `req.socket.remoteAddress`.
- `AppDeps` gains `relay: RelayOptions | null` and `relayRateLimiter`.
- `ServerConfig` gains `relayRateLimitPerHour` (`RELAY_RATE_LIMIT_PER_HOUR`,
  default 60, range 1–10 000). Relay timeout reuses `UPSTREAM_TIMEOUT_MS`.
- `/healthz` gains `relay: <boolean>`.
- `main.ts` always builds relay options when the service runs (no secret
  needed); the paid proxy stays optional.

### 5.3 Browser — config and transport

- `ProviderConfig` gains `relayBase?: string` and `preferRelay?: boolean`.
- `callProvider` gains a relay attempt with the same candidate endpoints:
  - order per candidate: `preferRelay ? [relay, direct] : [direct, relay]`;
  - direct → relay only for `reason === "unreachable"`;
  - relay → direct only for a relay network failure (502/504);
  - HTTP answers stop the chain and are reported.
  - result gains `via?: "direct" | "relay"`.
- Relay call: `POST ${relayBase}/api/relay/chat`, bearer = learner key, body
  `{ url, model, messages, temperature }`; the upstream payload is parsed with
  the existing `readReplyText`.

### 5.4 Browser — memory and UI

- `Settings.provider.relayHosts: string[]` (default `[]`, max 10, lowercased
  hostnames). `normalizeSettings` repairs it; a URL change clears it.
- `browser/provider.ts` builds the config with `relayBase = systemApiBase()`,
  `preferRelay = relayHosts.includes(host)`, and persists the route on success.
- All own-provider calls go through one wrapper in
  `v1/src/lib/browser/provider-call.ts`; `summary.ts` and `import-repair.ts`
  use it, and `requestTutorHint` accepts it as an injected sender.
- `ProviderStatus` gains `relay: boolean`; the card message and privacy line
  name the transit when true.
- Test connection passes `preferRelay: false`, reports the road, and the screen
  refreshes the status.

### 5.5 Non-goals

Server-side key storage; accounts; streaming; provider-specific auth schemes
(Anthropic `x-api-key`, Azure `api-key`); http targets; non-443 ports; a choice
of relays; any change to the judge, plan, cards, system provider or its proxy.

## 6. Risks

- **SSRF via DNS rebinding** — closed by connecting to the resolved address and
  setting SNI/Host separately; a second lookup never happens.
- **Shared addresses** — a school or carrier NAT shares a limit; the cap is set
  high enough for a person and low enough to protect the box (60/hour default).
- **A dead relay blocks a remembered host** — a relay network failure retries
  direct once, and a direct success clears the memory.
- **Free Render plan** — the relay makes the service load-bearing; a cold start
  can exceed the browser timeout, so the direct retry path stays available.
