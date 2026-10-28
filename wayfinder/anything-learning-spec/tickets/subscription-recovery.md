**Type:** feature
**Status:** open
**Delivery:** feature-pipeline
**Blocks:** -

# Recover a subscription on a new browser

## Question

The sold subscription lives only as a signed pass in one browser
(`system-license`). A learner who moves to another browser, or clears site
data, loses something they paid for, with no way back except paying again.
Stripe already knows who subscribed and which email paid. Can the service hand
a working pass to a new browser without adding an account, a password, or a
database?

## Resolution

Locked in `docs/features/subscription-recovery/GRILL-subscription-recovery.txt`
(2026-10-28). Implementation pending.

- **Email is the proof.** On the Provider tab, under the system card, a learner
  types the email used at Stripe Checkout. The service looks up the Stripe
  customer for that email and its live subscription.
- **One short link.** The service emails a 30-minute link; opening it posts the
  token back, mints a fresh signed pass and stores it in that browser, then
  switches the provider to the system lane — the same end state as a finished
  checkout.
- **Nothing stored.** Customers and subscriptions come from Stripe per request;
  the service keeps no email, token or pass. Only a hash sits in memory for ten
  minutes to stop repeat sends, and it clears on restart.
- **Limits.** Five link requests per address per hour; one link per email every
  ten minutes.
- **Same answer always.** "If that email has a subscription, a link is on its
  way." — whether or not the email is subscribed, and whether or not the mail
  was sent. A failure is logged without the address.
- **Optional.** Recovery exists only when Brevo and the recovery secret are
  configured; otherwise `/api/config` reports `recovery: false`, the form is
  hidden and the endpoint answers 503.
- **Separate secret.** Links are signed with `RECOVERY_SECRET`, not
  `LICENSE_SECRET`, so rotating one does not break the other.

## Supersedes

The system-provider ticket said "no recovery in v1". That stays true of that
pack; this ticket is the later pack that adds recovery, and the map line is
amended to say so.

## Non-goals

No account, password or session; no sync of settings, cards, progress or the
provider key; no recovery of a cancelled plan; no SMS; no recovery for the
bring-your-own provider; no change to backup rules; recovery mail only, never
marketing.
