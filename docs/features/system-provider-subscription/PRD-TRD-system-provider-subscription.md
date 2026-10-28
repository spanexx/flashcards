# PRD-TRD — System provider subscription

**Slug:** system-provider-subscription
**Status:** Locked
**Date:** 2026-10-28
**Origin:** `wayfinder/anything-learning-spec/tickets/system-provider-subscription.md`
**GRILL:** `docs/features/system-provider-subscription/GRILL-system-provider-subscription.txt`

## Why this exists

The learner can study only with a provider they configure and pay for. The
operator wants to sell access to one provider they run. The app is a public
GitHub repository and a static GitHub Pages site, so a key shipped with the
browser is a published key. A paid provider therefore needs two things a static
site cannot provide: a server that holds the secrets, and a way to prove a
learner paid that the browser cannot forge.

## What it does

### The learner's side

- **Settings gains a System provider section** above the learner's own provider,
  shown only when the build names an API base. It shows the provider's name and
  configured price label, plus one of: **Subscribe**, **Active until …**, or a
  plain **could not be reached** sentence.
- **Subscribe** sends the learner to Stripe Checkout. On return the app
  exchanges the Checkout session for a license, stores it, selects the system
  provider and says the subscription is active. Cancelling returns to Settings
  with nothing charged and no state change.
- **Manage subscription** opens the Stripe billing portal: payment method,
  invoices, cancellation. The app never shows card fields.
- **The learner can always choose their own provider.** The system section never
  replaces the custom form; a failed server only affects the system option.
- **Selected system provider.** Hints, generation and the connection test use
  the same OpenAI-compatible caller. The browser holds a license, not a model
  key; the upstream address and key never reach it.

### The operator's side

- **One provider, configured in server environment:** name, price label, Stripe
  price and secret, webhook secret, license signing secret, upstream base URL,
  model and key, app URL, port, timeout and rate limit. See
  `DEPLOY-system-provider.md`.
- **The public build knows two things:** the API base and a fallback display
  name. Neither is a secret. The Pages workflow maps them from repository
  variables.
- **No database.** Stripe is the record of the subscription; an in-memory cache
  makes checks cheap and a webhook clears it early. Restarting the service
  re-reads Stripe.

### Privacy and failure

- Packs, cards, answers and the prompt log stay in the browser. The system
  proxy forwards a prompt, returns the reply and stores neither. Server logs
  never carry a prompt, token, key or learner text.
- A missing API base hides the section. A missing or malformed server shows a
  plain sentence and leaves the learner's own provider untouched. The app never
  waits on a health check to start studying.
- A cancelled, unpaid or incomplete subscription stops working on the next
  request (two-minute cache, webhook-cleared).
- The license is a local bearer pass. Clearing browser data or switching devices
  loses it; v1 has no account, email recovery or device sync. The operator can
  resolve it through Stripe by hand. This limitation is documented, not hidden.

## Simulation contract

The built page and the local acceptance server must show all of these before
merge:

1. Without an API base, Provider tab looks exactly as today and no System
   section appears.
2. With an API base, the System card shows the name and price label and a
   **Subscribe** button.
3. Pressing **Subscribe** with a fake Stripe returns a checkout URL and the
   browser leaves the page; a cancelled return says nothing was charged.
4. A completed fake checkout stores a license, shows **Active until …**, selects
   the system provider, and the provider status reads ready.
5. **Test connection** succeeds through the system proxy with the stored
   license.
6. A hint and a generation call reach the fake upstream and return its answer;
   the browser bundle contains neither upstream key nor Stripe secret.
7. Clearing the license returns the System card to **Subscribe**; a request
   with the old license fails after the subscription is marked canceled.
8. **Manage subscription** opens the fake billing portal URL.
9. The server refuses a missing, expired or forged license, a canceled
   subscription, a disallowed origin and a request over the rate limit with
   plain JSON errors, and never echoes a secret.
10. The learner's own provider still works after every one of the above.

## Technical design

### Components

```
v1/server/                     Node 20 service, no runtime dependencies
  src/config.ts                env → validated config; missing names only
  src/stripe.ts                REST calls via fetch; form encoding
  src/webhook.ts               Stripe-Signature HMAC verification, tolerance
  src/license.ts               HMAC-SHA256 signed compact token
  src/subscriptions.ts         status cache + webhook invalidation
  src/entitlement.ts           checkout completion, refresh, status, portal
  src/proxy.ts                 OpenAI-compatible upstream call
  src/http.ts                  router, CORS, JSON, limits, rate limit
  src/main.ts                  start; log enabled features, never values
  tsconfig.json                tsc → server/dist (CommonJS)
  .env.example                 every name, no value that is a secret
```

Frontend additions:

- `v1/src/lib/client/system.ts` — API base, config fetch, checkout, completion,
  status, portal, license ensure/refresh. Pure URL and response mapping are
  separated for tests.
- `v1/src/lib/browser/repository.ts` — `readSystemLicense` /
  `writeSystemLicense` / `clearSystemLicense`, a row of its own.
- `v1/src/app/settings/SystemProviderCard.tsx` — the card and its states.
- `v1/src/app/settings/SettingsClient.tsx` — mounts the card, handles the
  `?checkout=` return, selects the mode.
- `v1/src/lib/browser/provider.ts` — resolves `mode: "system"` to
  `{url: API_BASE + "/v1", model: "system", key: license}` and reports status.
- `v1/src/lib/core/settings-shape.ts` + `types.ts` — `provider.mode` with a
  `custom` default for old settings; `ProviderStatus.mode` is optional so the
  legacy local path is untouched.
- `v1/src/app/globals.css` — only the small System card and pill styles.

### Server endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/config` | CORS origin | public name, price label, enabled flags |
| POST | `/api/checkout` | CORS origin | create a subscription Checkout session, return URL |
| POST | `/api/entitlement/checkout` | CORS origin + session id | verify paid session, sign license |
| POST | `/api/entitlement/status` | license | status, renewal date, cancel flag |
| POST | `/api/entitlement/refresh` | license (expiry ignored) | re-sign while subscription is active |
| POST | `/api/portal` | license | create billing portal session, return URL |
| POST | `/v1/chat/completions` | license | proxy one OpenAI-compatible chat call |
| POST | `/api/stripe/webhook` | Stripe-Signature | invalidate cache; 200 on valid event |
| GET | `/healthz` | none | process mode, no secrets |

All JSON. Errors are `{ error: string }` with 400/401/402/403/404/429/502/503
and never contain upstream bodies, keys or tokens. `GET /api/config` returns
only `{ name, priceLabel, checkout: boolean, proxy: boolean }`.

### Configuration (server env)

| Name | Required for | Notes |
|---|---|---|
| `PORT` | start | default 8787 |
| `APP_URL` | start | full app URL, e.g. `https://owner.github.io/flashcards/`; its origin is the only CORS origin and the base of return URLs |
| `SYSTEM_PROVIDER_NAME` | config | display name |
| `SYSTEM_PRICE_LABEL` | config | e.g. `€5 / month`; display only |
| `STRIPE_SECRET_KEY` | checkout/portal | server only |
| `STRIPE_PRICE_ID` | checkout | one recurring price |
| `STRIPE_WEBHOOK_SECRET` | webhook | optional; without it the endpoint answers 404 |
| `STRIPE_API_BASE` | tests/local | default `https://api.stripe.com`; never used to weaken verification |
| `LICENSE_SECRET` | all entitlement | at least 32 characters; HMAC key |
| `LICENSE_TTL_SECONDS` | optional | default 30 days |
| `SYSTEM_LLM_BASE_URL` | proxy | OpenAI-compatible base |
| `SYSTEM_LLM_MODEL` | proxy | upstream model name |
| `SYSTEM_LLM_API_KEY` | proxy | server only |
| `UPSTREAM_TIMEOUT_MS` | optional | default 60s |
| `RATE_LIMIT_PER_HOUR` | optional | default 120 per license + address |
| `SUBSCRIPTION_CACHE_MS` | optional | default 120s |

`parseConfig` collects missing or invalid names; `main.ts` prints the names,
never values, and exits 1. Public config exposes `name`, `priceLabel` and which
groups are enabled, nothing else.

### License

Payload `{ v: 1, sub, cus, iat, exp }` as base64url JSON, then
`base64url(HMAC-SHA256(secret, payload))`, joined by `.`. Verify checks format,
signature with `timingSafeEqual`, `v`, `exp`; refresh may ignore only `exp`.
The token is stored in IndexedDB `settings` store under `system-license` with
its expiry for display, excluded from backups. The app refreshes when fewer than
seven days remain; failure keeps the current token until it expires.

### Subscription authority

`StatusCache` maps subscription id → `{status, renewsAt, checkedAt}` for
`SUBSCRIPTION_CACHE_MS`. `authorize` verifies the token, resolves the status
(cache or Stripe), accepts only `active` and `trialing`. Webhook events
`customer.subscription.created|updated|deleted` delete the cache row; the event
payload is not trusted for entitlement, only for invalidation. Checkout
completion accepts a session whose `payment_status` is `paid` or
`no_payment_required` and whose expanded subscription is active or trialing.

### Proxy

Forwards `{model, messages, temperature}` after checking message shape and a
200,000-character total cap. The server replaces the model with
`SYSTEM_LLM_MODEL`, calls `${SYSTEM_LLM_BASE_URL}/chat/completions` (adding
`/v1` when absent, as the client does), authenticates with the operator key, and
returns the upstream JSON body. A timeout → 504; unreachable → 502; upstream
401/403/429 → 502/502/429 generic sentences. No retries. No streaming in v1.

Rate limit: a sliding one-hour list per `${license hash}:${remote address}`;
over the limit → 429 `Retry-After`. Memory-only and documented.

### Stripe calls

Form-encoded POST/GET via `fetch`; no SDK. Checkout parameters: mode
`subscription`, one line item at `STRIPE_PRICE_ID`, quantity 1,
`success_url = new URL("settings/?checkout=success&session_id={CHECKOUT_SESSION_ID}", APP_URL)`,
`cancel_url = new URL("settings/?checkout=cancel", APP_URL)`,
`allow_promotion_codes=true`, `billing_address_collection=auto`. Portal:
`return_url = new URL("settings/", APP_URL)`. API errors map to 502 and are not
echoed to the browser.

### Security

- No secret in the Pages bundle: server files are outside `v1/src`; only
  `NEXT_PUBLIC_SYSTEM_API_BASE` and `NEXT_PUBLIC_SYSTEM_PROVIDER_NAME` are
  public. `.env*` is ignored; `.env.example` holds names only.
- CORS: only the `APP_URL` origin; no wildcard; OPTIONS handled; credentials not
  used (the license travels in the Authorization header, not a cookie).
- Header limits: request body 1 MB, messages 200k characters, upstream reply
  2 MB, timeouts on every outbound call.
- No logs of prompts, tokens, keys or emails. Errors name the failure class.
- Rate limit protects the operator from a shared pass.

### Operator deployment

Documented in `DEPLOY-system-provider.md`: create the Stripe product and
recurring price, deploy the service with env, add the webhook, set GitHub
Actions variables `SYSTEM_API_BASE` and `SYSTEM_PROVIDER_NAME`, redeploy Pages,
then run a test-mode purchase. The service is forward-only; there is no
migration.

## Non-goals

- Learner accounts, email login, magic links, password reset or device sync.
- License recovery or transfer between browsers; the operator can help by hand.
- Multiple plans, trials invented by the app, credits, coupons, metering or
  invoices inside the app.
- Multiple system providers, an operator dashboard, or editing the provider from
  the app.
- Streaming, tool calls, images or any model feature beyond chat completions.
- Server-side prompt history, analytics or logging of learner text.
- Any change to the judge, evidence, planner, session loop, packs, offline use
  or the existing custom-provider lane.
