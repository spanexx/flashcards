# IMPL — subscription-recovery

Status: draft
Date: 2026-10-28
Contract: `docs/features/subscription-recovery/PRD-TRD-subscription-recovery.md`

Order matters: the token and the Stripe lookup must be provably safe before any
mail can be sent; the client must be able to redeem before the form can offer a
link.

## Phase 1 — Recovery core

Files:

- `v1/server/src/recovery.ts` (new): `signRecoveryToken`,
  `verifyRecoveryToken`, `pickLiveSubscription`, `requestLink`, `redeemLink`,
  `RecoveryCooldown`, `normaliseEmail`.
- `v1/server/src/stripe.ts`: `listCustomersByEmail`, `listCustomerSubscriptions`.
- `v1/server/src/mailer.ts` (new): `createBrevoMailer`, `MailError`,
  `readRecoveryMail` copy.
- `v1/tests/server-recovery.test.ts`, `v1/tests/server-mailer.test.ts` (new).

Checks:

- Token: round-trip; expired by `iat`; wrong secret; edited payload; wrong
  version; garbage; the email is kept as typed, because Stripe matches the
  address exactly and the lowercase form is a second lookup.
- Picker: one live plan; ignored trialing/past-due/cancelled; latest
  `currentPeriodEnd` wins; none → null.
- Request: live plan sends one mail with a `?recover=` link; unknown email,
  cancelled plan and a mail failure all answer 200 with no difference.
- Cooldown: second request inside the window sends no mail; expiry lets one
  through; the map stores only a hash.
- Redeem: 200 with a verifiable licence naming the right `sub`/`cus`; 401
  expired/forged; 402 inactive; Stripe error → 502.
- Mailer: POST shape (`sender`, `to`, `subject`, `textContent`), api key in
  `api-key` header, non-2xx → `MailError`, no address in any thrown message.

## Phase 2 — Routes, config, health

Files:

- `v1/server/src/http.ts`: `POST /api/recovery/request`, `POST
  /api/recovery/redeem`, `recovery` + cooldown in `AppDeps`, `config.recovery`,
  `/healthz.recovery`.
- `v1/server/src/config.ts`: the Brevo and recovery fields.
- `v1/server/src/main.ts`: build the mailer and recovery options only when the
  three facts are present.
- `v1/server/.env.example`: the new names.
- `v1/tests/server-http.test.ts`, `v1/tests/server-config.test.ts`,
  `v1/tests/server-config-extra.test.ts` if present.

Checks:

- Not configured: `recovery:false`, 503 `Recovery is not set up.`, no Stripe
  call.
- Body guard: missing or non-plain email → 400, no mail.
- Address limit: sixth → 429 `Too many requests. Try again in an hour.`
- Redeem: the three outcomes map to 200/401/402 and Stripe failure to 502.
- Config group is complete-or-absent; short secret refused; defaults 1800/5/600.
- Staff logs never carry the address or token.

## Phase 3 — Client transport

Files:

- `v1/src/lib/client/system.ts`: `recovery` in `SystemPublicConfig`,
  `requestRecovery`, `redeemRecovery`, `RECOVERY_ANSWER`, `RECOVERY_REDEEMED`,
  `RECOVERY_EXPIRED`.
- `v1/tests/system-client.test.ts`.

Checks:

- Config without `recovery` reads as false; `true` reads as true.
- 200 request resolves; 429/500/network reject with `SystemError` and the plain
  sentence.
- Redeem parses `{license, entitlement}`; a malformed body is refused.
- No secret literal appears in the module.

## Phase 4 — The form and the link

Files:

- `v1/src/app/settings/RecoverySection.tsx` (new).
- `v1/src/app/settings/SettingsClient.tsx`: render the section under the System
  card; read `?recover=` and strip only that key; redeem, store, PATCH the
  system lane, notice.
- `v1/src/app/settings/SystemProviderCard.tsx`: a `reloadSignal` prop, bumped
  after the redeem. The card owns its pass and entitlement state and loads them
  once, so the parent's settings `refresh()` cannot update it; without the signal
  the card keeps saying **Not subscribed** under a banner that says the
  subscription is back (found by the browser pass, see `simulate-post.md`).
- `v1/tests/system-provider.test.ts`, `v1/tests/settings.test.ts`.

Checks:

- Section appears with a live pass and without one; absent when
  `recovery:false`; absent when the build has no service.
- Sending shows the fixed sentence; the field clears; a 429 shows the service
  sentence; an unreachable service shows the plain one.
- `?recover=` is handled once, the query is removed, a working pass is stored
  and the provider switches to system; the System card reads the new pass and
  lane in place, with no reload; expired link shows the expired sentence, a used
  link shows the used sentence, and the form stays usable.
- No copy claims a login or an account.

## Phase 6 — Follow-up 2026-10-29: one use, and a cold start

Files:

- `v1/server/src/stripe.ts`: `StripeCustomerView.metadata`, `readMetadata`,
  `updateCustomerMetadata`.
- `v1/server/src/recovery.ts`: `verifyRecoveryToken` returns `iat`; the live
  lookup returns the owning customer; `lastUsedIat`; `USED_LINK` and
  `LINK_UNCHECKED`; the used check and the mark write in `redeemRecoveryLink`.
- `v1/src/lib/client/system.ts`: the request wait is 60 seconds, and
  `RECOVERY_ANSWER` says the link works once.
- `v1/src/app/settings/RecoverySection.tsx`, `SettingsClient.tsx`: copy and the
  stale comment.
- `v1/tests/server-recovery.test.ts`, `v1/tests/server-http.test.ts`,
  `v1/tests/server-stripe.test.ts`.
- Pack docs: GRILL amendment, ticket amendment, PRD-TRD BS-5/BS-6/BS-11 and the
  simulation contract, this file, the DEPLOY runbook.

Checks:

- The same link twice → second is 401 "That link has already been used. Ask for
  a new one."; a link issued later still works.
- The mark lands on the owning customer as `recovery_used_iat`, before the pass
  is minted; a failed write gives 502 "The link could not be checked. Try again
  in a moment." and hands out no pass.
- A cancelled plan spends no link.
- A restart between the two redeems still refuses the second: the mark is read
  from Stripe, not memory.
- Stripe client: metadata strings are read, other types dropped; the write is a
  POST to `/v1/customers/<id>` with `metadata[recovery_used_iat]`.
- A restore still works after a 40-second wait: the client timeout is 60
  seconds.

## Phase 5 — Verification, simulation, docs

Files:

- `docs/features/subscription-recovery/simulate-post.md`.
- `docs/features/system-provider-subscription/DEPLOY-system-provider.md`
  (three new Render facts and the sender verification step).
- `CONTEXT.md` only if a new term is needed.

Checks:

- `v1/server` build; `v1` lint, typecheck, full `npm test`, CI-shaped build
  (`/flashcards` base path) and `check-pwa`.
- Bundle scan for every secret name and value.
- Post-impl simulation covers all thirteen contract items with real output.
- Drift gates: `npm run check:drift`, `npm run check:drift:staged`.
- Stop at the commit gate; no commit, merge or push without the learner's go.
