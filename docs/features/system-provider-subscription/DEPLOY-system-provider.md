# Deploy the system provider

**Slug:** system-provider-subscription
**Date:** 2026-10-28
**Contract:** `PRD-TRD-system-provider-subscription.md`

This is the operator's runbook. It assumes one Stripe recurring price and one
OpenAI-compatible model endpoint. The static app stays on GitHub Pages; only the
small service runs elsewhere. Nothing here is done by the app itself.

## What stays private, and where

| Value | Lives in | Never in |
|---|---|---|
| `STRIPE_SECRET_KEY` | service environment | the repo, the Pages build, the browser |
| `STRIPE_PRICE_ID` | service environment | the Pages build |
| `STRIPE_WEBHOOK_SECRET` | service environment | the repo, the browser |
| `LICENSE_SECRET` | service environment | the repo, the browser |
| `SYSTEM_LLM_API_KEY` | service environment | the repo, the Pages build, the browser |

The Pages build gets exactly two public facts: the service address and a
fallback display name. They enter through repository **variables** (visible in
logs), not secrets, because a `NEXT_PUBLIC_*` value is compiled into public
files by design.

## 1. Stripe (test mode first)

1. Create a product named after your provider (e.g. "Study tutor").
2. Add one **recurring** price with the interval you sell (monthly is the
   common case). Note the price id (`price_…`).
3. In **Developers → API keys**, copy the secret key (`sk_test_…` for the first
   run).
4. Do not enable customer emails you do not want. The service never reads them.

The app never shows card fields: Checkout and the billing portal are Stripe's
pages, opened by URL.

## 2. Build and start the service

Node 20, no runtime dependencies.

```bash
cd v1/server
npm install          # dev dependencies only: typescript, @types/node
npm run build        # tsc → dist/
node dist/main.js
```

Set the environment first; `.env.example` lists every name. A minimal sale
setup:

```
PORT=8787
APP_URL=https://<owner>.github.io/flashcards/
SYSTEM_PROVIDER_NAME=Study tutor
SYSTEM_PRICE_LABEL=EUR 5 / month
LICENSE_SECRET=<32+ random characters>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
SYSTEM_LLM_BASE_URL=https://api.example.com/v1
SYSTEM_LLM_MODEL=some-model
SYSTEM_LLM_API_KEY=...
```

Behaviour:

- A missing or malformed name is printed **by name only** and the process exits
  non-zero. No value is ever printed.
- Bind the port on all interfaces (`0.0.0.0`) behind HTTPS; the browser calls it
  from your Pages origin, so plain HTTP only works for `localhost`.
- The process holds no data. A restart re-reads Stripe and re-signs nothing;
  existing passes keep their own expiry.
- Keep one instance unless you accept per-instance caches and rate-limit
  counters. Stripe remains the record either way.

## 3. Webhook (recommended)

1. In Stripe → **Developers → Webhooks**, add an endpoint at
   `https://<service-host>/api/stripe/webhook`.
2. Subscribe to `customer.subscription.created`, `customer.subscription.updated`
   and `customer.subscription.deleted`.
3. Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` and restart.

Without the webhook everything still works; a cancellation is noticed when the
two-minute cache expires instead of immediately.

## 4. Point the Pages build at the service

In the GitHub repository → **Settings → Secrets and variables → Actions →
Variables**, add:

| Variable | Example | Meaning |
|---|---|---|
| `SYSTEM_API_BASE` | `https://study.example.com` | service origin, public |
| `SYSTEM_PROVIDER_NAME` | `Study tutor` | fallback card title, public |

Then re-run the Pages workflow. `.github/workflows/pages.yml` already maps both
into `NEXT_PUBLIC_SYSTEM_API_BASE` and `NEXT_PUBLIC_SYSTEM_PROVIDER_NAME`.

- With `SYSTEM_API_BASE` unset, the build contains no service address and the
  Provider tab is exactly the old page — no System section, no fetch.
- Changing the provider name on the server does not need a new build; the card
  prefers the live name and falls back to the build's copy.

## 5. Prove it end to end (test mode)

1. Open the deployed Settings → Provider tab. The System card shows the name and
   price label with **Subscribe**.
2. Subscribe with Stripe's test card `4242 4242 4242 4242`; any future date and
   any CVC.
3. On return: **Active until …**, the provider switch shows the system lane
   selected, status reads ready.
4. **Test connection** succeeds. Study one card with a hint and one generation;
   both reach your upstream.
5. **Manage subscription** opens the portal; cancel there and confirm the next
   study request is refused with a plain sentence.
6. Scan the deployed bundle for the words `sk_test`, `sk_live`, `whsec_`,
   `upstream` and your model key — none may appear:

```bash
grep -rIl "sk_live\|sk_test\|whsec_\|SYSTEM_LLM_API_KEY" v1/out || echo "clean"
```

## 5b. The learner-provider relay (no new secret)

The same service carries the relay for learners who use their own provider. A
provider that refuses browser calls (CORS) is retried through
`POST /api/relay/chat`; everything else stays direct. Nothing extra is deployed
and no secret is added.

- **What the relay uses.** Only the learner's own key, which arrives as the
  bearer of that one relayed call and is injected into the provider request.
  The service never stores or logs it, and never substitutes the operator's
  `SYSTEM_LLM_API_KEY`. The relay is available even when the Stripe and model
  groups are unset.
- **What the relay refuses.** Anything but `https` on port 443 whose path ends
  `/chat/completions`, credentials in the URL, private or local addresses
  (checked after DNS and pinned to the checked address), redirects, bodies over
  1 MB and replies over 2 MB.
- **The knob.** `RELAY_RATE_LIMIT_PER_HOUR` (default 60) caps each client
  address; the paid lane keeps its own `RATE_LIMIT_PER_HOUR`. Restarting resets
  both counters.
- **Prove it.** `GET /healthz` shows `relay` next to `checkout` and `proxy`. A
  relayed call with no bearer is 401; a private target is 400 with a plain
  sentence; the N+1th call in the hour is 429 with `retry-after`.

## 6. Go live

- Swap `sk_test_…` for `sk_live_…`, the test price for the live price, and redo
  the webhook in live mode.
- Restart the service once, then repeat step 5 with a real purchase you refund
  through Stripe.

## Limits you are accepting

- **The pass is local.** Clearing browser data or moving to another device loses
  access. There is no login, email recovery or device sync; help by hand through
  Stripe.
- **One pass, one subscription.** The token names the subscription it came from;
  the service checks that subscription each time (cache ≤ 2 minutes).
- **The rate limit is memory-only.** Restarting resets it, and two instances
  count separately.
- **The service logs no learner text**, so debugging a bad model reply means
  reproducing it, not reading a log.

## Rotating a secret

| Secret | Effect | Steps |
|---|---|---|
| `LICENSE_SECRET` | every issued pass stops verifying | set the new value, restart; learners see "the pass is not valid any more" and can refresh once on an active subscription, or resubscribe |
| `STRIPE_SECRET_KEY` | checkout/portal stop until replaced | set, restart |
| `STRIPE_WEBHOOK_SECRET` | webhook 400s; cache falls back to its window | set, restart |
| `SYSTEM_LLM_API_KEY` | proxy 502s until replaced | set, restart |
| `SYSTEM_API_BASE` | the old build calls the old host | update the variable, re-run Pages |
