# Subscription recovery — built-page and service checklist

Run on the built export, not the dev server, and against the real service code in
`v1/server/dist`. Two builds matter:

1. **CI shape** — `NEXT_PUBLIC_BASE_PATH=/flashcards` and no service address. The
   Provider tab must look exactly as it did before this pack: no System card, no
   recovery form, no system request.
2. **Pointed at a local service** — the same base path plus
   `NEXT_PUBLIC_SYSTEM_API_BASE=http://localhost:8789`. The recovery form appears
   only when the service says `recovery: true`.

A local walkthrough needs three throwaway pieces outside the repo: a static host
for the export under `/flashcards`, a fake Stripe (customers, subscriptions), and
a fake Brevo that records the mail body and writes each link to a file. The
2026-10-28 run used `python3 -m http.server 8791` over a copy of `out/` and two
Node fakes on an ephemeral port; every scratch file was deleted afterwards. The
operator's runbook for the real thing is `DEPLOY-system-provider.md` §5c.

## Checklist

### The built page, no service address

- Settings → Provider has no **System** card and no **Restore a subscription**
  card. The screen is the custom-only page.
- Network: no request leaves for a system API base on any tab.

### The built page, pointed at a service with recovery on

- **The form.** With no pass, the System card reads **Not subscribed** and under
  it **Restore a subscription** offers one field (the checkout email) and
  **Email me a link**, with the footnote "The service keeps nothing from this
  request. The link lasts 30 minutes, and it only brings back a subscription that
  is still live."
- **Offered in both states.** The same card appears when this browser already
  holds a live pass, so a learner is never told recovery exists only after it is
  needed.
- **Empty address.** Pressing the button with nothing typed shows "Enter the
  email you used at checkout." and sends nothing.
- **A stranger's address.** The page answers "If that address belongs to a
  subscription, a link is on its way. The link lasts 30 minutes." — identical to
  a subscriber's answer — and no mail is written.
- **A subscriber's address.** The same sentence, the field clears, and exactly
  one mail exists for that address.
- **The link.** Opening it shows **Bringing your subscription back to this
  browser…**, then "Your subscription is active on this browser now."; the
  System card turns **Active** with **Active until {≈30 days out}**; the provider
  profile reads **{name} · subscription / Subscribed** with **Pass: stored in
  this browser**; `?recover=` is gone from the address bar; a reload keeps all of
  it.
- **A cancelled plan.** The link page says "This subscription is not active." and
  no pass is stored.
- **An expired link.** "That link has expired. Ask for a new one." and the form
  is still there to ask again.
- **A forged link.** "That link is not valid. Ask for a new one." — a different
  sentence from expiry, so a stale mail reads differently from a tampered one.
- **A pass already in this browser.** A refused link never disturbs the working
  pass: the card still reads **Active** afterwards.

### The service, over plain HTTP

- `GET /healthz` → `{"ok":true,…,"recovery":true}` and `GET /api/config` →
  name, price label, checkout/proxy/relay flags and `recovery`, no secret.
- `POST /api/recovery/request` with no address → 400 "Enter the email you used at
  checkout." before any lookup.
- Same route, subscriber or stranger → 200 `{"ok":true}` both times; only the
  subscriber's run writes a mail.
- Same address again inside ten minutes → 200 and no second mail.
- Mixed case (`CASE@example.com`) still finds its customer; the signed token
  keeps the address as typed.
- `POST /api/recovery/redeem` with a live, correctly signed token → a signed
  pass whose payload names that subscription and customer, 30 days out; the same
  pass then reads back as active and its entitlement matches.
- The same token a second time inside its window → the same answer, a fresh pass.
- A token past its 30 minutes → 401 "That link has expired. Ask for a new one.";
  a token with a broken signature → 401 "That link is not valid. Ask for a new
  one."
- A link for a cancelled subscription → 402 "This subscription is not active."
- Two live plans on one email → the latest renewing one is the one signed.
- A mailer failure or a Stripe failure → the same 200 sentence, a log line with
  no address, no customer id and no token.
- The N+1th request in the hour from one address → 429 with `retry-after`.
- With the recovery group unset → `recovery:false`, `/api/config` unchanged, and
  the route answers 503 "Recovery is not set up."

## What the 2026-10-28 run actually showed

**Service (fake Stripe + fake Brevo, real `dist` modules).** 20 of 20 scenarios
printed PASS, including the exact bodies quoted in the checklist:
`{"ok":true,"service":"flashcards-system-provider","checkout":true,"proxy":false,"relay":true,"recovery":true}`
for `/healthz`; `200 {"ok":true} mails=0` for a stranger and `200 mails=1` for a
subscriber; `mails=2` after a mixed-case request; a pass payload
`{"v":1,"sub":"sub_ana","cus":"cus_ana","iat":1793178723,"exp":1795770723}`; a
re-redeem of the same link returning the same active entitlement; `401 {"error":"That link has expired. Ask for a new one."}`
against `401 {"error":"That link is not valid. Ask for a new one."}`; two live
plans resolving to `sub_new` at `renewsAt=1800300000`; the mailer-failure and
Stripe-failure log lines carrying no address; `400` for an empty address; `429`
with `retry-after: 3600` at the configured limit; and the off state reporting
`recovery:false` with `503 {"error":"Recovery is not set up."}`.

**Browser (the built page on `:8791`, service on `:8789`).** The Provider tab
showed **Study tutor / EUR 5 / month / Not subscribed** and the **Restore a
subscription** card with its field and footnote. A stranger's address produced
the same sentence with the mail file still holding its 3 earlier rows; a
subscriber's address produced the same sentence with a fourth row whose link was
`http://localhost:8791/flashcards/settings/?recover=…`. Opening that link showed
the banner and "Your subscription is active on this browser now.", the address
bar lost `?recover=`, the pass was in IndexedDB as
`{"sub":"sub_phone","cus":"cus_phone","exp":1795771294}` and the card read
**Active · until 20/01/2027** with the profile **Subscribed**. Clearing the pass
by hand and asking again with a second subscriber gave a card **Active · until
18/01/2027** — the later renewing plan — and this time the card updated in place.
The expired link then answered "That link has expired. Ask for a new one." with
the form still usable and the working pass untouched.

**Defect found by the browser pass and fixed.** On the first run the redeem wrote
the pass and switched the lane, but the System card kept saying **Not subscribed**
until a reload — the card loads its status once and the parent's `refresh()` did
not reach it. `SystemProviderCard` now takes a `reloadSignal` that the redeem
path bumps after the pass is stored, so the card re-reads the pass and the lane
in place. The second run above is the proof.

**Not covered here.** A real Brevo send and a real inbox, a real Stripe customer,
and the Render deployment — those are the operator's steps in
`DEPLOY-system-provider.md` §5c. The per-email cooldown and the hourly limit are
memory-only, so a restart clears them by design and nothing here tests a restart.
