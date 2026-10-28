# System provider — built-page and service checklist

Run on the built export, not the dev server. Two builds matter:

1. **With the system variables** — a build made with
   `NEXT_PUBLIC_SYSTEM_API_BASE` and `NEXT_PUBLIC_SYSTEM_PROVIDER_NAME` set.
   The System section appears in Settings → Provider.
2. **Without them** — a plain clone build. The Provider tab must look exactly
   as it did before this pack, with no System section and no system request.

The operator's runbook for the real thing is `DEPLOY-system-provider.md`. A
local walkthrough without a live Stripe account needs three local fakes: a
static host for the export, a fake Stripe (checkout, portal, subscription), and
a fake model behind the service. The 2026-10-28 run used throwaway Node fakes
in `/tmp` (a file named `stub.mjs` for Stripe + model + static host, and a tiny
own-provider on port 8790) and deleted them afterwards; the exact steps are
kept here so a later operator or agent can rebuild them.

## Checklist

### The built page, with a system API base

- **The card.** Settings → Provider shows a **System** section named after
  `NEXT_PUBLIC_SYSTEM_PROVIDER_NAME` and priced by the service's config. With
  no pass, it says **Not subscribed** and offers **Subscribe**;
  **Use the system provider** is disabled and explains "Subscribe first, then
  switch."
- **Checkout.** Press **Subscribe**: the browser leaves for the Stripe checkout
  URL the service returns. Cancel there: you land back with "Checkout was
  cancelled. Nothing was charged.", the `checkout` query gone, still
  **Not subscribed**, and no pass stored.
- **Completed checkout.** Pay on the fake: you land back with "Your
  subscription is active. This browser now uses the system provider.", the card
  shows **Active** and **Active until {a date about 30 days out}**, the provider
  profile reads **{name} · subscription / Subscribed**, **Test connection** is
  enabled, and Settings → Data still never mentions the pass (it is excluded
  from backups).
- **A real call.** **Test connection** answers "The provider answered. It is
  ready to use." Start a session with the tutor on and ask for a hint until the
  hint is labelled **TUTOR HINT**: it arrives from the service. In Library →
  Create → Cards → Generate, send a prompt: the result arrives and saves
  normally.
- **Clearing the pass.** Delete the `system-license` row in IndexedDB and
  reload. The card returns to **Not subscribed** with **Subscribe**; the
  profile reads **Needs a pass / Pass: not stored**, and **Use the system
  provider** is disabled again.
- **Cancellation.** **Manage subscription** opens the Stripe billing portal.
  Cancel the plan there, come back, and reopen Provider: the card says **Not
  active** with **Manage subscription**, **Refresh the pass** and **Subscribe
  again**, and **Test connection** now answers "This subscription is not
  active."
- **The learner's own provider.** Fill the custom form with an
  OpenAI-compatible address and model, press **Save and use my provider**, store
  a key, and **Test connection** answers "The provider answered. It is ready to
  use." — direct from the browser, with no pass needed. A provider that refuses
  browser calls (no CORS) still gets the plain "probably refusing calls from
  this site (CORS)" message instead of a silent failure.

### The built page, without a system API base

- Open Settings → Provider: no **System** section, no system name, no price,
  no **Subscribe**. The provider area is exactly the custom-only screen.
- Network: no request to a system API base is made on any screen.

### The service, over plain HTTP

- `GET /healthz` → `{"ok":true}`; `GET /api/config` → the display name, price
  label and whether checkout is ready, and no secret.
- `POST /api/checkout` → a Stripe checkout URL; `POST /api/portal` → a portal
  URL; both need a live pass.
- `POST /api/entitlement/checkout` with a completed fake session → a signed
  pass; use it as `authorization: Bearer …` for the rest.
- `POST /api/entitlement/status` with that pass → active, with the subscription
  id and the expiry in **seconds**.
- `/v1/chat/completions` with the pass → the model's answer; the upstream sees
  the operator's key, the configured model and a fixed temperature, and nothing
  else the learner sent is kept.
- Missing, forged or expired pass → 401 "The subscription pass is missing,
  invalid or expired."; a disallowed `Origin` → 403 "This origin is not
  allowed."; a canceled subscription → 402 "This subscription is not active.";
  over the rate limit → 429 with `retry-after`.
- No response ever contains the Stripe secret, the webhook secret, the license
  secret, the upstream key or the price id.
- Starting with empty environment names every missing variable by name and
  exits non-zero, without printing a value.

## Evidence from the 2026-10-28 run

Built export (webpack, root paths) with `NEXT_PUBLIC_SYSTEM_API_BASE=http://localhost:8787`
and `NEXT_PUBLIC_SYSTEM_PROVIDER_NAME="Study tutor"`; the service ran with the
acceptance environment from `DEPLOY-system-provider.md` (fake Stripe base, fake
upstream, 30-day pass, 120-second status cache off, rate limit 8/hour).

- Bundle scan of `v1/out`: `sk_test_…`, the webhook secret, the upstream key,
  the license secret and the price id are all absent; the API base and the
  display name each appear in exactly one file (the public facts only).
- The fake upstream recorded `connection-test`, `hint` and `generation` calls,
  each with the operator's key, model `acceptance-model` and temperature 0.2.
- HTTP checks: health, config, checkout, complete, status, portal; 401 for
  missing/forged/expired; 403 for a wrong origin; 402 after cancellation (both
  status and chat); 429 on the 9th call with `retry-after: 3600`; the empty-env
  start printed only variable names.
- In the app, with a fake Stripe: cancel return (notice, query gone, no pass),
  completed checkout (pass stored 30 days out, provider mode `system`, card
  **Active until 27/11/2026**, profile **Subscribed**, **Tested**), a
  **TUTOR HINT** from the service, a generated card saved, cancellation shown
  as **Not active / This subscription is not active.** on the card and on
  **Test connection**, the pass cleared to **Needs a pass**, and the learner's
  own provider on port 8790 tested as **Tested** with the key arriving in its
  `authorization` header.
- The no-base build (unset variables, 78 files, `check-pwa: passed`) shows the
  pre-pack Provider tab: headings "Provider profile" and "Set up your own
  provider", no System section, no Subscribe, no mode switch. Its settings page
  made 11 network requests, all static assets from its own origin; nothing
  called the service. The bundle scan on that build found no service address,
  no provider name and no secret-shaped token.

**Copy note:** the active card says "Your subscription is active until
{renewal date}." and, when the plan is ending, "It will end then." The date is
the pass expiry (30 days), not the Stripe period end; the service refreshes the
pass within 7 days of expiry, so the date is honest about what the browser
holds.

**Capture note:** the in-app browser reported the page as hidden and refused
screenshots during this run, so the evidence above is DOM snapshots plus the
fake servers' recorded state. A later pass on a visible window should take the
five screenshots this checklist describes; nothing in the DOM contradicted
them.
