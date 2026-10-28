// WHY: A paid session and a live subscription are two different facts. This
// module turns the first into a license once, then always asks the second
// before granting access, so a cancelled plan stops on the next request.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { issueLicense, verifyLicense } from "./license";
import { grantsAccess, type StatusCache, type SubscriptionStatus } from "./subscriptions";
import type { StripeClient } from "./stripe";

export type EntitlementCode =
  | "invalid_license"
  | "inactive"
  | "not_paid"
  | "not_found"
  | "stripe";

export type EntitlementFailure = {
  ok: false;
  code: EntitlementCode;
  message: string;
};

export interface EntitlementView {
  status: string;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
  expiresAt: number;
}

export type EntitlementResult =
  | { ok: true; entitlement: EntitlementView; license: string | null }
  | EntitlementFailure;

export interface EntitlementDeps {
  stripe: Pick<StripeClient, "getCheckoutSession" | "getSubscription" | "createPortalSession">;
  subscriptions: Pick<StatusCache, "get" | "seed">;
  licenseSecret: string;
  licenseTtlSeconds: number;
  now?: () => number;
}

const INVALID: EntitlementFailure = {
  ok: false,
  code: "invalid_license",
  message: "The subscription pass is missing, invalid or expired.",
};

const INACTIVE: EntitlementFailure = {
  ok: false,
  code: "inactive",
  message: "This subscription is not active.",
};

const STRIPE_FAILED: EntitlementFailure = {
  ok: false,
  code: "stripe",
  message: "The subscription service could not check the payment. Try again in a moment.",
};

/** A live subscription for a signed payload, or the reason it is refused. */
async function liveSubscription(
  deps: EntitlementDeps,
  payload: { sub: string; cus: string },
): Promise<{ ok: true; subscription: SubscriptionStatus } | EntitlementFailure> {
  let subscription: SubscriptionStatus | null;
  try {
    subscription = await deps.subscriptions.get(payload.sub);
  } catch {
    return STRIPE_FAILED;
  }
  if (!subscription) return INACTIVE;
  if (subscription.customer && payload.cus && subscription.customer !== payload.cus) {
    return INVALID;
  }
  if (!grantsAccess(subscription.status)) return INACTIVE;
  return { ok: true, subscription };
}

/** The browser-facing facts of one live subscription. */
export function entitlementView(subscription: SubscriptionStatus, expiresAt: number): EntitlementView {
  return {
    status: subscription.status,
    renewsAt: subscription.renewsAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    expiresAt,
  };
}

/**
 * Exchange a completed Checkout session for a license. The session must be
 * complete and paid, and its subscription live. A session id is not a secret,
 * but it is only accepted once Stripe confirms what it paid for.
 */
export async function completeCheckout(
  deps: EntitlementDeps,
  sessionId: string,
): Promise<EntitlementResult> {
  const id = typeof sessionId === "string" ? sessionId.trim() : "";
  if (id.length === 0 || id.length > 200 || !/^[\x21-\x7e]+$/.test(id)) {
    return { ok: false, code: "not_found", message: "That checkout session was not found." };
  }

  let session;
  try {
    session = await deps.stripe.getCheckoutSession(id);
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
    if (status === 404) {
      return { ok: false, code: "not_found", message: "That checkout session was not found." };
    }
    return STRIPE_FAILED;
  }

  if (session.status !== "complete") {
    return { ok: false, code: "not_paid", message: "The checkout is not finished yet." };
  }
  if (session.paymentStatus !== "paid" && session.paymentStatus !== "no_payment_required") {
    return { ok: false, code: "not_paid", message: "The checkout has not been paid." };
  }

  let subscription = session.subscription;
  if (!subscription && session.subscriptionId) {
    try {
      subscription = await deps.stripe.getSubscription(session.subscriptionId);
    } catch {
      return STRIPE_FAILED;
    }
  }
  if (!subscription || !grantsAccess(subscription.status)) return INACTIVE;

  const customer = subscription.customer ?? session.customer;
  if (!customer) return INACTIVE;

  const now = deps.now ?? Date.now;
  const issued = issueLicense(
    { sub: subscription.id, cus: customer },
    deps.licenseSecret,
    deps.licenseTtlSeconds,
    now(),
  );
  deps.subscriptions.seed(subscription);
  return {
    ok: true,
    entitlement: entitlementView(subscription, issued.payload.exp),
    license: issued.token,
  };
}

/** Read the entitlement behind a license. A missing or expired pass is refused. */
export async function readEntitlement(
  deps: EntitlementDeps,
  token: string,
): Promise<EntitlementResult> {
  const now = deps.now ?? Date.now;
  const read = verifyLicense(token, deps.licenseSecret, { now: now() });
  if (!read.ok) return INVALID;
  const live = await liveSubscription(deps, read.payload);
  if (!live.ok) return live;
  return {
    ok: true,
    entitlement: entitlementView(live.subscription, read.payload.exp),
    license: null,
  };
}

/**
 * Re-sign a license for a still-live subscription. Expiry is ignored here: a
 * learner whose month ran out but whose plan is active keeps working, and the
 * live check makes sure a cancelled plan does not get a fresh pass.
 */
export async function refreshEntitlement(
  deps: EntitlementDeps,
  token: string,
): Promise<EntitlementResult> {
  const now = deps.now ?? Date.now;
  const read = verifyLicense(token, deps.licenseSecret, { now: now(), allowExpired: true });
  if (!read.ok) return INVALID;
  const live = await liveSubscription(deps, read.payload);
  if (!live.ok) return live;
  const customer = live.subscription.customer ?? read.payload.cus;
  const issued = issueLicense(
    { sub: live.subscription.id, cus: customer },
    deps.licenseSecret,
    deps.licenseTtlSeconds,
    now(),
  );
  return {
    ok: true,
    entitlement: entitlementView(live.subscription, issued.payload.exp),
    license: issued.token,
  };
}

/**
 * Open the billing portal, where a learner sees invoices, changes a card or
 * cancels. A genuinely expired pass is still accepted: billing self-service
 * should not be locked behind the token it exists to renew.
 */
export async function openPortal(
  deps: EntitlementDeps,
  token: string,
  returnUrl: string,
): Promise<{ ok: true; url: string } | EntitlementFailure> {
  const now = deps.now ?? Date.now;
  const read = verifyLicense(token, deps.licenseSecret, { now: now(), allowExpired: true });
  if (!read.ok) return INVALID;

  let subscription: SubscriptionStatus | null;
  try {
    subscription = await deps.subscriptions.get(read.payload.sub);
  } catch {
    return STRIPE_FAILED;
  }
  if (!subscription) return INACTIVE;
  const customer = subscription.customer ?? read.payload.cus;

  try {
    return { ok: true, url: (await deps.stripe.createPortalSession({ customer, returnUrl })).url };
  } catch {
    return STRIPE_FAILED;
  }
}
