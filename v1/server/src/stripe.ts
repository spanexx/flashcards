// WHY: Stripe is two REST resources and one form body away from working. A full
// SDK would add dependencies and its own types to a service that must stay
// small; fetch plus URLSearchParams is the whole need, and it can be tested
// with a fake without a network.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

/** A Stripe request that failed. The body is never handed to a browser. */
export class StripeError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "StripeError";
    this.status = status;
    this.code = code;
  }
}

/** The subscription facts the service acts on. */
export interface StripeSubscriptionView {
  id: string;
  status: string;
  customer: string | null;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
}

/** One Checkout session, reduced to what entitlement needs. */
export interface StripeSessionView {
  id: string;
  status: string;
  paymentStatus: string;
  customer: string | null;
  subscriptionId: string | null;
  subscription: StripeSubscriptionView | null;
}

/** Encode the flat form body Stripe expects. */
export function formEncode(fields: Record<string, string | number | boolean>): string {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) body.append(name, String(value));
  return body.toString();
}

/** Read a string field from an unknown object, or null. */
function stringField(record: Record<string, unknown>, name: string): string | null {
  const value = record[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Read a customer or subscription reference that may be an id or an object. */
function referenceId(value: unknown): string | null {
  if (typeof value === "string") return value.length > 0 ? value : null;
  if (value && typeof value === "object") return stringField(value as Record<string, unknown>, "id");
  return null;
}

/** Stripe put the period end on the subscription, and in newer API versions on its item. */
function periodEnd(record: Record<string, unknown>): number | null {
  const direct = record.current_period_end;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const items = record.items as { data?: unknown } | undefined;
  if (items && Array.isArray(items.data)) {
    for (const item of items.data) {
      if (!item || typeof item !== "object") continue;
      const value = (item as Record<string, unknown>).current_period_end;
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
  }
  return null;
}

/** Normalise one subscription payload; null when it has no identity. */
export function readSubscription(raw: unknown): StripeSubscriptionView | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = stringField(record, "id");
  const status = stringField(record, "status");
  if (!id || !status) return null;
  return {
    id,
    status,
    customer: referenceId(record.customer),
    renewsAt: periodEnd(record),
    cancelAtPeriodEnd: record.cancel_at_period_end === true,
  };
}

/** Normalise one Checkout session payload; null when it has no identity. */
export function readSession(raw: unknown): StripeSessionView | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = stringField(record, "id");
  if (!id) return null;
  const subscription = readSubscription(record.subscription);
  return {
    id,
    status: stringField(record, "status") ?? "unknown",
    paymentStatus: stringField(record, "payment_status") ?? "unknown",
    customer: referenceId(record.customer),
    subscriptionId: referenceId(record.subscription),
    subscription,
  };
}

export interface StripeClient {
  createCheckoutSession(args: {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string }>;
  getCheckoutSession(id: string): Promise<StripeSessionView>;
  getSubscription(id: string): Promise<StripeSubscriptionView>;
  createPortalSession(args: { customer: string; returnUrl: string }): Promise<{ url: string }>;
}

export interface StripeClientOptions {
  secretKey: string;
  apiBase?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Build a client over one secret key. Every request has a timeout. */
export function createStripeClient(options: StripeClientOptions): StripeClient {
  const apiBase = (options.apiBase ?? "https://api.stripe.com").replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;

  async function request(
    method: "GET" | "POST",
    path: string,
    params: Record<string, string | number | boolean> = {},
  ): Promise<Record<string, unknown>> {
    const query = formEncode(params);
    const url = method === "GET" && query.length > 0 ? `${apiBase}${path}?${query}` : `${apiBase}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${options.secretKey}`,
          ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        },
        ...(method === "POST" ? { body: query } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new StripeError(0, aborted ? "Stripe timed out." : "Stripe could not be reached.");
    } finally {
      clearTimeout(timer);
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
      const error = record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : {};
      throw new StripeError(
        response.status,
        stringField(error, "message") ?? `Stripe answered ${response.status}.`,
        stringField(error, "code"),
      );
    }
    if (!payload || typeof payload !== "object") {
      throw new StripeError(response.status, "Stripe answered without a body.");
    }
    return payload as Record<string, unknown>;
  }

  return {
    async createCheckoutSession(args) {
      const payload = await request("POST", "/v1/checkout/sessions", {
        mode: "subscription",
        "line_items[0][price]": args.priceId,
        "line_items[0][quantity]": 1,
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
      });
      const id = stringField(payload, "id");
      const url = stringField(payload, "url");
      if (!id || !url) throw new StripeError(502, "Stripe did not return a checkout address.");
      return { id, url };
    },

    async getCheckoutSession(id) {
      const payload = await request("GET", `/v1/checkout/sessions/${encodeURIComponent(id)}`, {
        "expand[]": "subscription",
      });
      const session = readSession(payload);
      if (!session) throw new StripeError(502, "Stripe did not return a usable session.");
      return session;
    },

    async getSubscription(id) {
      const payload = await request("GET", `/v1/subscriptions/${encodeURIComponent(id)}`);
      const subscription = readSubscription(payload);
      if (!subscription) throw new StripeError(502, "Stripe did not return a usable subscription.");
      return subscription;
    },

    async createPortalSession(args) {
      const payload = await request("POST", "/v1/billing_portal/sessions", {
        customer: args.customer,
        return_url: args.returnUrl,
      });
      const url = stringField(payload, "url");
      if (!url) throw new StripeError(502, "Stripe did not return a portal address.");
      return { url };
    },
  };
}
