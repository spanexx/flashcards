# PRD-TRD — subscription-recovery

Status: draft
Date: 2026-10-28
Pack: subscription-recovery
Ticket: `wayfinder/anything-learning-spec/tickets/subscription-recovery.md`
GRILL: `docs/features/subscription-recovery/GRILL-subscription-recovery.txt`
Pre-impl sim: `docs/features/subscription-recovery/simulate-pre.sh`

## 1. Why this exists

A paid pass lives in one browser's IndexedDB and nowhere else. Clearing site
data, switching machines or using the same account on a phone loses a
subscription the learner paid for, and the app has no road back: the Service
worker and the backup deliberately exclude the pass, and there is no login.

The learner asked how the service could recognise a subscriber without keeping
their data. The answer locked in the GRILL: Stripe already holds the email and
the subscription, so Stripe stays the record; the email is the proof; the
service stores nothing new. This pack adds the short-lived link that moves a live
subscription to a new browser, and the small form that asks for it.

## 2. What exists today

- `POST /api/checkout` runs Stripe Checkout in `subscription` mode
  (`v1/server/src/stripe.ts`), so every purchase creates a Customer with the
  email Stripe collected.
- The pass is an HMAC licence `{v,sub,cus,iat,exp}` (`v1/server/src/license.ts`),
  minted by `/api/entitlement/checkout` and `/api/entitlement/refresh`
  (`v1/server/src/entitlement.ts`), stored as the `system-license` row in
  IndexedDB (`v1/src/lib/browser/repository.ts`), never in a backup.
- The live subscription is re-checked per request through `StatusCache`
  (`v1/server/src/subscriptions.ts`), ≤ 2 minutes, cleared by the webhook.
- The service is zero-dependency Node 20 with `RateLimiter`, bounded bodies and
  one CORS origin (`v1/server/src/http.ts`).
- The Provider tab renders `SystemProviderCard` (`v1/src/app/settings/`) and the
  client transport is `v1/src/lib/client/system.ts`.
- The wayfinder map previously deferred recovery ("recovery from another
  browser is a later pack"); this pack is that later pack.

## 3. What it does — behavioral spec

**BS-1 Ask for a link.** Under the System card, in both states (pass or no
pass), a quiet section reads "Moved to a new browser, or cleared your data?" and
offers one field, "Email used at checkout", and one button, "Email me a link".
A note says "We send one email and keep nothing."

**BS-2 One answer, always.** After the button, the page says "If that email has
a subscription, a link is on its way. It expires in 30 minutes." — the same
sentence, same status, for a subscriber, a stranger, a mistyped address, a
failed Stripe read and a failed send. The only visible exception is the address
limit (BS-7), which depends on the requester, never on the address.

**BS-3 What the service does behind that answer.** It asks Stripe for customers
with that email, then for their subscriptions; if one is live it signs a
30-minute token naming the email and the request time and sends one Brevo
message with the link. No live subscription means no mail. Nothing is written to
disk or logged with the address.

**BS-4 The email.** From the configured sender, subject "Study tutor — your
subscription link", one sentence, the link
`<origin>/settings/?recover=<token>`, and the expiry line. No learner text, no
card data, no price, no key.

**BS-5 The link.** Opening it in the new browser shows "Checking the link…",
then the service re-checks the live subscription with Stripe, issues a fresh
30-day pass for that subscription and customer, and answers
`{license, entitlement}`. The page stores the pass, switches the provider to the
system lane (the same end state as a finished checkout), strips `?recover=` from
the address bar, and says "Your subscription is active on this browser now."

**BS-6 Refusals on the link.** Expired or forged link: "That link has expired.
Ask for a new one." Cancelled or unpaid plan: "This subscription is not active."
The form stays on screen so a new link can be asked for at once. A link may be
opened more than once inside its window; each opening mints a pass, because the
live Stripe check is the real guard.

**BS-7 Limits.** Five requests an hour per requester address: the sixth answers
"Too many requests. Try again in an hour." (429). One request per email address
every 10 minutes, tracked as a hash in memory; the second request inside that
window gets the same BS-2 sentence and sends no mail. The record survives no
restart.

**BS-8 Optional and off by default.** Recovery exists only when
`BREVO_API_KEY`, `RECOVERY_SECRET` and `RECOVERY_FROM_EMAIL` are all set.
Otherwise `/api/config` reports `recovery: false`, the section is not rendered,
and the endpoint answers 503 "Recovery is not set up." Every other behaviour,
including the whole paid lane, is unchanged without it.

**BS-9 Nothing else moves.** The old browser keeps its pass until it expires.
The learner's own provider, its key, the relay, the operator's model key and the
backup rules are untouched. A recovered pass is indistinguishable from one
issued at checkout, and still never enters a backup.

**BS-10 Unreachable service.** The form says "The subscription service could not
be reached. Try again in a moment." No mail is claimed, nothing is stored.

## 4. Simulation contract

The post-impl simulation must demonstrate, with real commands and real output:

1. Request for an email with a live subscription → 200 with the fixed sentence;
   the fake mailer receives exactly one message whose link carries a real
   `?recover=<token>`.
2. Redeem that token → 200 `{license, entitlement}`; the licence verifies with
   `verifyLicense` and names the same `sub`/`cus`; a second redeem works too.
3. Request for an unknown email, a mistyped address and a cancelled plan → the
   same 200 and the same sentence; no mail is sent.
4. Expired token (iat older than TTL) → 401; forged signature → 401; both with
   the "expired" sentence.
5. Cancelled plan after the link was sent → redeem 402 "This subscription is not
   active."
6. Two live subscriptions on one email → the pass names the later-renewing one.
7. Limits → sixth request in the hour is 429; the second request inside the
   per-email window returns the fixed sentence and adds no mail.
8. Not configured → `/api/config` `recovery:false`, endpoint 503, no form.
9. One server restart between request and redeem → the same link still redeems.
10. Browser side, with a stubbed `fetch`: the client shows the fixed sentence on
    success, an unknown email and a 500; shows the service sentence on 429; the
    redeem path stores the pass, PATCHes `provider.mode = "system"`, and reports
    the success sentence; a `?recover=` in the address is read once.
11. No secrets in the bundle: the build output contains no Brevo key, recovery
    secret, licence secret, Stripe secret or operator key.
12. Full suite, lint, typecheck, CI-shaped build and both drift gates pass.

## 5. Technical design

### 5.1 Server — new module `v1/server/src/recovery.ts`

```text
signRecoveryToken(email, secret, now) -> token       // payload {v:1,email,iat}
verifyRecoveryToken(token, secret, now, ttl) -> {ok,email} | {ok:false, reason:"expired"|"invalid"}
pickLiveSubscription(subscriptions[]) -> live one with the latest currentPeriodEnd
requestLink(deps, raw) -> {status, body}             // always 200 unless 400/429/503
redeemLink(deps, raw) -> EntitlementResult           // reuses entitlement shapes
RecoveryCooldown                                    // Map<hash, lastMs>, pruned, memory only
```

Token: `base64url(JSON) + "." + base64url(HMAC-SHA256(RECOVERY_SECRET))`,
verified signature-first, then version, then `now - iat > ttl`; comparison is
`timingSafeEqual`. The email is trimmed and kept as typed, because Stripe's
filter is exact; the cooldown hash is `sha256(secret + lowercased email)`, never
the address itself. Lookups ask Stripe for the typed form and the lowercase form
and merge the answers.

### 5.2 Server — Stripe and mail

`StripeClient` gains two reads:

```text
listCustomersByEmail(email) -> Customer[]   GET /v1/customers?email=..&limit=10
listCustomerSubscriptions(cus) -> Sub[]     GET /v1/subscriptions?customer=..&status=all&limit=100
```

Both reuse the existing bounded fetch, form/query encoding and `StripeError`
mapping; `readSubscription` already maps the fields the picker needs.

`v1/server/src/mailer.ts` — one function, no SDK:

```text
createBrevoMailer({ apiKey, fromEmail, fromName, send }) -> { sendRecoveryLink(email, url, ttl) }
  POST https://api.brevo.com/v3/smtp/email
  { sender:{email,name}, to:[{email}], subject, textContent }
```

A non-2xx answer throws a `MailError`; the route logs `recovery send failed`
with the status only, never the address.

### 5.3 Server — routes and config

- `POST /api/recovery/request` `{email}`:
  400 `Enter the email you used at checkout.` when absent or not a plain
  address; 429 from the per-address limiter; 503 when recovery is off; otherwise
  200 `{ok:true}` regardless of Stripe or mail outcome.
- `POST /api/recovery/redeem` `{token}`: 401 expired/invalid, 402 inactive,
  502 Stripe failure, 200 `{license, entitlement}`. `StatusCache` is used for the
  live read.
- `AppDeps` gains `recovery: RecoveryOptions | null` and `recoveryCooldown`.
- `ServerConfig` gains `brevoApiKey`, `recoverySecret` (≥ 32 chars),
  `recoveryFromEmail`, `recoveryFromName` (default "Study tutor"),
  `recoveryTokenTtlSeconds` (1800), `recoveryRateLimitPerHour` (5),
  `recoveryEmailCooldownSeconds` (600). The three secrets/address form one
  complete-or-absent group, exactly like the existing ones.
- `/api/config` gains `recovery: boolean`; `/healthz` gains
  `recovery: "off" | "on"` (a word, not a secret).
- `main.ts` builds the mailer and recovery options only when configured.

### 5.4 Browser — client (`v1/src/lib/client/system.ts`)

- `SystemPublicConfig` gains `recovery: boolean`; `readSystemConfig` reads it.
- `requestRecovery(email)` → `POST /api/recovery/request`; returns nothing on
  200, throws `SystemError` with the service sentence otherwise.
- `redeemRecovery(token)` → `POST /api/recovery/redeem`, read with
  `readLicenseAnswer`.
- `RECOVERY_ANSWER` and `RECOVERY_REDEEMED` sentences live here so the UI has one
  source.

### 5.5 Browser — UI

- New `RecoverySection` (`v1/src/app/settings/RecoverySection.tsx`) rendered under
  `SystemProviderCard` by the settings page whenever `systemEnabled()` is true;
  it hides itself when `config.recovery` is false.
- States: idle → sending → sent (fixed sentence) → error (service sentence);
  the address is cleared on success.
- The settings page reads `?recover=` once, strips only that key with
  `history.replaceState`, and handles it as BS-5: busy note, redeem, store the
  pass with `writeSystemLicense`, PATCH `{provider:{mode:"system"}}`, call
  `onChanged`, show the success sentence; on 401/402 call `onError` and leave
  the form usable.

### 5.6 Dependencies

None added. Brevo is plain HTTPS with the global `fetch`; Stripe calls already
use it; crypto is `node:crypto`.

### 5.7 Non-goals

Accounts, passwords, sessions, profiles, a database, card/settings sync,
single-use links, recovery of a cancelled or unpaid plan, SMS, recovery for the
bring-your-own lane, marketing mail, a change to the pass format, and any change
to the relay.

### 5.8 Risks

- **Enumeration** — closed by one status and one sentence; the per-email
  cooldown is silent so it adds no signal.
- **Mailbox takeover** — the link is a bearer secret for 30 minutes; it names no
  learner data and a redeemed pass still dies with the subscription.
- **Brevo free tier** — 300 messages a day; the per-address limit keeps abuse
  below it, and a failed send costs the learner nothing but another attempt.
- **Cold start** — the browser call keeps the existing 20-second timeout and
  reports the plain "could not be reached" sentence.

## 6. References

- `docs/features/subscription-recovery/GRILL-subscription-recovery.txt`
- `docs/features/subscription-recovery/simulate-pre.sh`
- `docs/features/subscription-recovery/IMPL-subscription-recovery.md`
- `docs/features/system-provider-subscription/` — the paid lane this extends
- `docs/features/provider-relay/` — the sibling that shares the service
- `wayfinder/anything-learning-spec/tickets/subscription-recovery.md`
