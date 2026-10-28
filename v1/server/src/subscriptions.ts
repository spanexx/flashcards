// WHY: Every hint and generation asks whether the subscription is still live.
// Without a cache that would be a Stripe call per sentence; with no invalidation
// a cancelled learner could keep talking for the whole cache window. A short
// cache plus the webhook gives both cheap checks and a prompt stop.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { StripeError, type StripeSubscriptionView } from "./stripe";

/** The live facts about one subscription, including who it belongs to. */
export type SubscriptionStatus = StripeSubscriptionView;

/** Only a paying or trialing subscription may use the operator's model key. */
export function grantsAccess(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/** Turn a Stripe client into a loader that treats "no such subscription" as none. */
export function stripeSubscriptionLoader(
  stripe: { getSubscription(id: string): Promise<StripeSubscriptionView> },
): (id: string) => Promise<SubscriptionStatus | null> {
  return async (id) => {
    try {
      return await stripe.getSubscription(id);
    } catch (error) {
      if (error instanceof StripeError && error.status === 404) return null;
      throw error;
    }
  };
}

/** A small in-memory status cache with explicit invalidation. */
export class StatusCache {
  private readonly entries = new Map<string, { value: SubscriptionStatus; at: number }>();

  constructor(
    private readonly load: (id: string) => Promise<SubscriptionStatus | null>,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** A cached status inside the window, otherwise the loader's answer. */
  async get(id: string): Promise<SubscriptionStatus | null> {
    const hit = this.entries.get(id);
    if (hit) {
      if (this.ttlMs <= 0) {
        this.entries.delete(id);
      } else if (this.now() - hit.at < this.ttlMs) {
        return hit.value;
      } else {
        this.entries.delete(id);
      }
    }
    const value = await this.load(id);
    if (value) this.entries.set(id, { value, at: this.now() });
    else this.entries.delete(id);
    return value;
  }

  /** Remember a status learned from a checkout completion. */
  seed(status: SubscriptionStatus): void {
    this.entries.set(status.id, { value: status, at: this.now() });
  }

  /** Forget one subscription, usually because a webhook said it changed. */
  invalidate(id: string): void {
    this.entries.delete(id);
  }

  /** Forget everything, on a configuration reload. */
  clear(): void {
    this.entries.clear();
  }
}
