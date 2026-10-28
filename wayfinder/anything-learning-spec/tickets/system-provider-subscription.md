**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# A paid system provider

## Question

The learner can only study with an LLM provider they configure and pay for
themselves. The operator wants to offer one provider they run: the learner pays
a recurring subscription through Stripe, and the operator's model answers. The
app is a public GitHub repository and a static GitHub Pages site, so any key
shipped with it is public. How can a subscription work without putting the
operator's model key, the Stripe secret, or the license signing secret in the
browser bundle?

## Resolution

- **A small server holds every secret.** The static app keeps working exactly as
  it does today; a separate Node 20 service in `v1/server/` owns the Stripe call,
  the webhook, the license signature and the one upstream model key. The Pages
  bundle only learns the API address and the provider's display name.
- **One system provider, configured by the operator.** Name, price label,
  upstream address, model and key live in server environment variables. There
  are no tiers, credits or usage meter; Stripe holds the price and the billing
  portal.
- **Stripe Checkout, no account.** The learner presses Subscribe in Settings and
  lands on Stripe Checkout. A successful session is exchanged once for a signed
  license stored in this browser. The license is excluded from backups and from
  every screen that shows storage.
- **The license is the pass.** The app sends it as the bearer token to the
  system proxy. The server verifies the HMAC, checks the subscription with
  Stripe (a short cache, invalidated by webhook), and forwards the prompt to the
  operator's model. Cancelled, unpaid and incomplete subscriptions stop working.
- **The same call path.** The existing OpenAI-compatible caller gains a system
  configuration that points at `${API}/v1`, so hints, generation and the
  connection test work unchanged. No feature gets a second provider stack.
- **No prompt storage.** The server forwards the messages and returns the reply;
  it keeps no prompt, answer or learner content. It rate-limits by license and
  address and never logs a key, a token, or a prompt.
- **No recovery flow in v1.** There is no email login, no account screen and no
  magic link. A learner who clears browser data or uses another device
  subscribes again or asks the operator; this is written down, not hidden.
- **The app degrades honestly.** Without a configured API address, the system
  section is absent; without a license it offers Subscribe; without a reachable
  server it says so and leaves the learner's own provider untouched.
- **Operator deployment is documented, not automated.** The service is plain
  Node with zero runtime dependencies and no database, so it runs on any host.
  A Stripe test-mode walkthrough and a local end-to-end harness prove the flow
  without a live account.

## Why

A static bundle cannot keep a secret. Copying the model key into a
`NEXT_PUBLIC_` variable, a PWA cache or a GitHub variable that the build reads
would publish it. The only honest shape is a server the operator controls; the
browser must hold a revocable, signed pass instead of the key.

Removing accounts keeps the purchase as short as Stripe allows: one redirect, no
password, no email code. The cost is recovery, and that cost is stated rather
than paid for with a new identity system.

## Source

Learner message, 2026-10-28, verbatim:

> "implement a subscription for internal provider, this allow learner to pay
> for system provider. use stripe and make the process as easy as possible,
> allow me to configure one system provider. bcs this is public github, create
> a better way to keep my api keys private as you know this is currently served
> at git pages. make all decisions"

The learner delegated product and technical decisions. The implementation
choices are recorded in
`docs/features/system-provider-subscription/GRILL-system-provider-subscription.txt`;
the operator-only setup lives in
`docs/features/system-provider-subscription/DEPLOY-system-provider.md`.

Implementation: `docs/features/system-provider-subscription/IMPL-system-provider-subscription.md`.
