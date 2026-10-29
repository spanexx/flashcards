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
| `RECOVERY_SECRET` | service environment | the repo, the browser |
| `BREVO_API_KEY` | service environment | the repo, the Pages build, the browser |
| `RECOVERY_FROM_EMAIL` | service environment | the repo (it is not a credential, but it is still server-side config) |
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

## 5c. Subscription recovery (free mailer, no domain)

A learner who clears browser data or moves to another device can bring a live
subscription back without an account: Stripe is the record, the inbox is the
proof, and the service stores nothing. The form appears on **Settings → Provider**
only when this group is fully configured.

1. Create a free [Brevo](https://www.brevo.com) account and verify **one sender
   address** under **Senders & IPs → Senders**. A plain mailbox works; no domain
   and no DNS records are needed. Use that exact address for
   `RECOVERY_FROM_EMAIL` — Brevo refuses to send from an unverified sender.
2. In **SMTP & API → API Keys**, create a key and copy it once. It starts `xkeysib-`.
3. On Render, set all three together and restart:

```
RECOVERY_SECRET=<32+ random characters, different from LICENSE_SECRET>
RECOVERY_FROM_EMAIL=<the verified sender address>
BREVO_API_KEY=xkeysib-...
```

Behaviour:

- **All three or none.** A partial group is reported by name only at startup and
  the process exits non-zero, exactly like the other groups. Recovery also
  requires `STRIPE_SECRET_KEY`, since Stripe is the record it reads.
- **Off is a working state.** With the group unset, `/api/config` reports
  `recovery:false`, the form is hidden, and both endpoints answer 503. The paid
  lane and the relay are unaffected.
- **The link.** One short-lived link (30 minutes) to
  `APP_URL + "settings/?recover=<token>"`. `APP_URL` must keep its trailing
  slash so the path joins correctly. Opening the link asks Stripe again for a
  live plan before minting a fresh 30-day pass, so a link mailed yesterday to a
  subscription cancelled today brings back nothing. The link works once: the
  redemption writes its issue moment to the customer's metadata
  (`recovery_used_iat`), and any link issued at or before that moment is refused
  with "That link has already been used. Ask for a new one." A link asked for
  afterwards still works. If the write fails, no pass is handed out and the link
  stays usable.
- **The answer never varies.** The same sentence is shown whether or not the
  address belongs to a subscription. The mail is only sent when one exists.
- **The limits.** 5 requests per client address per hour (the 6th is a visible
  429 with `retry-after`) and one mail per address per 10 minutes (silent).
  Both counters live in memory and reset on restart;
  `RECOVERY_RATE_LIMIT_PER_HOUR` changes the first,
  `RECOVERY_EMAIL_COOLDOWN_SECONDS` the second and `RECOVERY_TOKEN_TTL_SECONDS`
  the link lifetime. `RECOVERY_FROM_NAME` is the sender's display name
  (defaults to "Study tutor").
- **What is not stored.** No database, no log line with an address. The
  per-address cooldown is a hash held in memory for ten minutes. The only
  durable fact is the one-use mark on the Stripe customer — a timestamp, no
  address and no token — which keeps a spent link spent across restarts and
  redeploys.

Prove it in test mode:

1. `GET /healthz` shows `recovery:true`, and `/api/config` no longer needs a
   rebuild — the form appears on the next Settings visit.
2. Subscribe with `4242 4242 4242 4242` in one browser profile, then open a
   private window on the same site. Settings → Provider shows **Restore a
   subscription**.
3. Type the checkout address. The page says the link is on its way, and Brevo's
   **Statistics → Email** shows one sent message.
4. Open the link; the pass is stored, the provider switches to the system lane,
   and **Active until …** appears. The `?recover=` part is removed from the
   address bar.
5. Type an address with no subscription: the identical sentence, no mail.
6. Re-open the same link inside the 30 minutes: "That link has already been used.
   Ask for a new one." Ask for a fresh link and it works; after 30 minutes an
   unused one says "This link has expired. Ask for a new one." with the form
   usable.

## 6. Go live

- Swap `sk_test_…` for `sk_live_…`, the test price for the live price, and redo
  the webhook in live mode.
- Restart the service once, then repeat step 5 with a real purchase you refund
  through Stripe.

## Limits you are accepting

- **The pass is local, with one way back.** Clearing browser data or moving to
  another device loses the pass; recovery (section 5c) is that way back, and it
  needs the inbox that paid. With recovery off, help by hand through Stripe.
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
| `RECOVERY_SECRET` | every mailed link stops working; issued passes are untouched | set, restart; a learner asks for a new link |
| `BREVO_API_KEY` | recovery asks succeed but send nothing; learners see the same sentence and get no mail | set, restart |
| `SYSTEM_API_BASE` | the old build calls the old host | update the variable, re-run Pages |
