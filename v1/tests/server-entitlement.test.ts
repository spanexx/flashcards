// WHY: A paid Checkout session, a live subscription and a license are three
// separate claims. This suite pins each refusal, so nobody talks to the paid
// model on the strength of the wrong one.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { describe, expect, it, vi } from "vitest";
import {
  completeCheckout,
  openPortal,
  readEntitlement,
  refreshEntitlement,
  type EntitlementDeps,
} from "../server/src/entitlement";
import { issueLicense, signLicense, verifyLicense } from "../server/src/license";
import { StripeError, type StripeSessionView, type StripeSubscriptionView } from "../server/src/stripe";
import type { SubscriptionStatus } from "../server/src/subscriptions";

const SECRET = "license-secret-that-is-long-enough-123";
const TTL = 30 * 24 * 60 * 60;
const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);
const DAY = 24 * 60 * 60;

const subscription: StripeSubscriptionView = {
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  renewsAt: 1_800_000_000,
  cancelAtPeriodEnd: false,
};

function deps(overrides: Partial<EntitlementDeps> & {
  session?: StripeSessionView | null;
  live?: SubscriptionStatus | null;
  portalUrl?: string;
} = {}): EntitlementDeps {
  const session =
    overrides.session === undefined
      ? {
          id: "cs_1",
          status: "complete",
          paymentStatus: "paid",
          customer: "cus_1",
          subscriptionId: "sub_1",
          subscription: { ...subscription },
        }
      : overrides.session;
  const live =
    overrides.live === undefined
      ? {
          id: "sub_1",
          status: "active",
          customer: "cus_1",
          renewsAt: 1_800_000_000,
          cancelAtPeriodEnd: false,
        }
      : overrides.live;
  return {
    stripe: {
      getCheckoutSession: vi.fn(async () => {
        if (!session) throw new StripeError(404, "missing");
        return session;
      }),
      getSubscription: vi.fn(async () => ({ ...subscription })),
      createPortalSession: vi.fn(async () => ({ url: overrides.portalUrl ?? "https://portal.test/p" })),
    },
    subscriptions: {
      get: vi.fn(async () => live),
      seed: vi.fn(),
    },
    licenseSecret: SECRET,
    licenseTtlSeconds: TTL,
    now: () => NOW,
    ...overrides,
  };
}

function validLicense(now = NOW) {
  return issueLicense({ sub: "sub_1", cus: "cus_1" }, SECRET, TTL, now);
}

describe("completeCheckout", () => {
  it("turns a paid session into a signed license and seeds the cache", async () => {
    const d = deps();
    const result = await completeCheckout(d, "cs_1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.license).toBeTruthy();
    const read = verifyLicense(result.license ?? "", SECRET, { now: NOW });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.payload).toMatchObject({ sub: "sub_1", cus: "cus_1" });
    expect(result.entitlement).toMatchObject({ status: "active", expiresAt: read.payload.exp });
    expect(d.subscriptions.seed).toHaveBeenCalledOnce();
  });

  it("fetches the subscription when the session carries only its id", async () => {
    const d = deps({
      session: {
        id: "cs_1",
        status: "complete",
        paymentStatus: "no_payment_required",
        customer: "cus_1",
        subscriptionId: "sub_1",
        subscription: null,
      },
    });
    const result = await completeCheckout(d, "cs_1");
    expect(result.ok).toBe(true);
    expect(d.stripe.getSubscription).toHaveBeenCalledWith("sub_1");
  });

  it("refuses an unfinished or unpaid session", async () => {
    const open = deps({
      session: {
        id: "cs_1",
        status: "open",
        paymentStatus: "unpaid",
        customer: null,
        subscriptionId: null,
        subscription: null,
      },
    });
    expect(await completeCheckout(open, "cs_1")).toMatchObject({ ok: false, code: "not_paid" });

    const unpaid = deps({
      session: {
        id: "cs_1",
        status: "complete",
        paymentStatus: "unpaid",
        customer: null,
        subscriptionId: null,
        subscription: null,
      },
    });
    expect(await completeCheckout(unpaid, "cs_1")).toMatchObject({ ok: false, code: "not_paid" });
  });

  it("refuses a session whose subscription is not active", async () => {
    const d = deps({
      session: {
        id: "cs_1",
        status: "complete",
        paymentStatus: "paid",
        customer: "cus_1",
        subscriptionId: "sub_1",
        subscription: { ...subscription, status: "past_due" },
      },
    });
    expect(await completeCheckout(d, "cs_1")).toMatchObject({ ok: false, code: "inactive" });
  });

  it("refuses an empty or strange session id without asking Stripe", async () => {
    const d = deps();
    expect(await completeCheckout(d, "")).toMatchObject({ ok: false, code: "not_found" });
    expect(await completeCheckout(d, "a".repeat(201))).toMatchObject({ ok: false, code: "not_found" });
    expect(await completeCheckout(d, "line\nbreak")).toMatchObject({ ok: false, code: "not_found" });
    expect(d.stripe.getCheckoutSession).not.toHaveBeenCalled();
  });

  it("reports a missing session as not found and a broken Stripe as a service failure", async () => {
    const missing = deps({
      stripe: {
        getCheckoutSession: async () => {
          throw new StripeError(404, "missing");
        },
        getSubscription: async () => subscription,
        createPortalSession: async () => ({ url: "https://portal.test" }),
      },
    });
    expect(await completeCheckout(missing, "cs_1")).toMatchObject({ ok: false, code: "not_found" });

    const down = deps({
      stripe: {
        getCheckoutSession: async () => {
          throw new StripeError(500, "down");
        },
        getSubscription: async () => subscription,
        createPortalSession: async () => ({ url: "https://portal.test" }),
      },
    });
    expect(await completeCheckout(down, "cs_1")).toMatchObject({ ok: false, code: "stripe" });
  });
});

describe("readEntitlement", () => {
  it("reads an active subscription behind a valid license", async () => {
    const d = deps();
    const license = validLicense();
    const result = await readEntitlement(d, license.token);
    expect(result).toMatchObject({
      ok: true,
      entitlement: { status: "active", renewsAt: 1_800_000_000 },
      license: null,
    });
  });

  it("refuses a missing, forged or expired pass", async () => {
    const d = deps();
    expect(await readEntitlement(d, "")).toMatchObject({ ok: false, code: "invalid_license" });
    expect(await readEntitlement(d, "a.b")).toMatchObject({ ok: false, code: "invalid_license" });
    const expired = issueLicense({ sub: "sub_1", cus: "cus_1" }, SECRET, DAY, NOW - 2 * DAY * 1000);
    expect(await readEntitlement(d, expired.token)).toMatchObject({ ok: false, code: "invalid_license" });
  });

  it("refuses a canceled subscription even with a signed pass", async () => {
    const d = deps({
      live: { id: "sub_1", status: "canceled", customer: "cus_1", renewsAt: null, cancelAtPeriodEnd: false },
    });
    expect(await readEntitlement(d, validLicense().token)).toMatchObject({ ok: false, code: "inactive" });
  });

  it("refuses a pass whose customer no longer matches the subscription", async () => {
    const d = deps({
      live: { id: "sub_1", status: "active", customer: "cus_1", renewsAt: null, cancelAtPeriodEnd: false },
    });
    const foreign = issueLicense({ sub: "sub_1", cus: "cus_other" }, SECRET, TTL, NOW);
    expect(await readEntitlement(d, foreign.token)).toMatchObject({ ok: false, code: "invalid_license" });
  });

  it("turns a Stripe failure into a service failure, not an active subscription", async () => {
    const d = deps();
    d.subscriptions.get = vi.fn(async () => {
      throw new StripeError(500, "down");
    });
    expect(await readEntitlement(d, validLicense().token)).toMatchObject({ ok: false, code: "stripe" });
  });
});

describe("refreshEntitlement", () => {
  it("re-signs an expired pass while the subscription is live", async () => {
    const d = deps();
    const old = issueLicense({ sub: "sub_1", cus: "cus_1" }, SECRET, DAY, NOW - 2 * DAY * 1000);
    const result = await refreshEntitlement(d, old.token);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.license) return;
    const read = verifyLicense(result.license, SECRET, { now: NOW });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.payload.sub).toBe("sub_1");
    expect(read.payload.exp).toBe(Math.floor(NOW / 1000) + TTL);
    expect(result.entitlement.expiresAt).toBe(read.payload.exp);
  });

  it("does not re-sign for an inactive subscription", async () => {
    const d = deps({
      live: { id: "sub_1", status: "past_due", customer: "cus_1", renewsAt: null, cancelAtPeriodEnd: false },
    });
    const old = issueLicense({ sub: "sub_1", cus: "cus_1" }, SECRET, DAY, NOW - 2 * DAY * 1000);
    expect(await refreshEntitlement(d, old.token)).toMatchObject({ ok: false, code: "inactive" });
  });

  it("refuses a forged pass even though expiry is ignored", async () => {
    const d = deps();
    const forged = signLicense(
      { v: 1, sub: "sub_1", cus: "cus_1", iat: 1, exp: Math.floor(NOW / 1000) + DAY },
      "another-secret-that-is-long-enough",
    );
    expect(await refreshEntitlement(d, forged)).toMatchObject({ ok: false, code: "invalid_license" });
  });
});

describe("openPortal", () => {
  it("opens the billing portal for the customer on the pass", async () => {
    const d = deps();
    expect(await openPortal(d, validLicense().token, "https://app.test/settings/")).toEqual({
      ok: true,
      url: "https://portal.test/p",
    });
    expect(d.stripe.createPortalSession).toHaveBeenCalledWith({
      customer: "cus_1",
      returnUrl: "https://app.test/settings/",
    });
  });

  it("still opens the portal for an expired pass, so billing can be fixed", async () => {
    const d = deps();
    const expired = issueLicense({ sub: "sub_1", cus: "cus_1" }, SECRET, DAY, NOW - 2 * DAY * 1000);
    expect(await openPortal(d, expired.token, "https://app.test/settings/")).toMatchObject({ ok: true });
  });

  it("refuses a forged pass and reports a Stripe failure plainly", async () => {
    const d = deps();
    expect(await openPortal(d, "a.b", "https://app.test/")).toMatchObject({
      ok: false,
      code: "invalid_license",
    });
    const broken = deps({
      stripe: {
        getCheckoutSession: async () => {
          throw new StripeError(500, "down");
        },
        getSubscription: async () => subscription,
        createPortalSession: async () => {
          throw new StripeError(500, "down");
        },
      },
    });
    expect(await openPortal(broken, validLicense().token, "https://app.test/")).toMatchObject({
      ok: false,
      code: "stripe",
    });
  });
});
