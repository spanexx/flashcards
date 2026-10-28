// WHY: The cache is the difference between a Stripe call per hint and none,
// but a stale "active" would keep a cancelled plan working. The clock and the
// invalidation are the whole contract.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { describe, expect, it, vi } from "vitest";
import {
  grantsAccess,
  StatusCache,
  stripeSubscriptionLoader,
  type SubscriptionStatus,
} from "../server/src/subscriptions";
import { StripeError, type StripeSubscriptionView } from "../server/src/stripe";

const active: SubscriptionStatus = {
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  renewsAt: 1_800_000_000,
  cancelAtPeriodEnd: false,
};

describe("grantsAccess", () => {
  it("accepts only a paying or trialing subscription", () => {
    expect(grantsAccess("active")).toBe(true);
    expect(grantsAccess("trialing")).toBe(true);
    for (const status of ["past_due", "unpaid", "canceled", "incomplete", "paused", null, ""]) {
      expect(grantsAccess(status)).toBe(false);
    }
  });
});

describe("StatusCache", () => {
  it("asks the loader once inside the window and again after it", async () => {
    let now = 1_000;
    const load = vi.fn(async () => active);
    const cache = new StatusCache(load, 120_000, () => now);

    expect(await cache.get("sub_1")).toEqual(active);
    now += 119_000;
    expect(await cache.get("sub_1")).toEqual(active);
    expect(load).toHaveBeenCalledTimes(1);
    now += 1_000;
    expect(await cache.get("sub_1")).toEqual(active);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not cache a missing subscription", async () => {
    const load = vi.fn(async () => null);
    const cache = new StatusCache(load, 120_000, () => 1_000);
    expect(await cache.get("sub_missing")).toBeNull();
    expect(await cache.get("sub_missing")).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("never keeps a status when the window is zero", async () => {
    const load = vi.fn(async () => active);
    const cache = new StatusCache(load, 0, () => 1_000);
    await cache.get("sub_1");
    await cache.get("sub_1");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("seeds from a completed checkout and forgets on invalidation", async () => {
    const load = vi.fn(async () => active);
    const cache = new StatusCache(load, 120_000, () => 1_000);
    cache.seed(active);
    expect(await cache.get("sub_1")).toEqual(active);
    expect(load).not.toHaveBeenCalled();
    cache.invalidate("sub_1");
    await cache.get("sub_1");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a loader failure", async () => {
    const load = vi.fn(async () => {
      throw new StripeError(500, "down");
    });
    const cache = new StatusCache(load, 120_000, () => 1_000);
    await expect(cache.get("sub_1")).rejects.toBeInstanceOf(StripeError);
    await expect(cache.get("sub_1")).rejects.toBeInstanceOf(StripeError);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("stripeSubscriptionLoader", () => {
  it("turns a missing subscription into none, and keeps other failures loud", async () => {
    const view: StripeSubscriptionView = {
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      renewsAt: null,
      cancelAtPeriodEnd: false,
    };
    const present = stripeSubscriptionLoader({ getSubscription: async () => view });
    expect(await present("sub_1")).toEqual(view);

    const missing = stripeSubscriptionLoader({
      getSubscription: async () => {
        throw new StripeError(404, "No such subscription");
      },
    });
    expect(await missing("sub_1")).toBeNull();

    const down = stripeSubscriptionLoader({
      getSubscription: async () => {
        throw new StripeError(500, "down");
      },
    });
    await expect(down("sub_1")).rejects.toBeInstanceOf(StripeError);
  });
});
