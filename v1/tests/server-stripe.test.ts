// WHY: Checkout and portal are one form body each, but a wrong name or a
// missing price is a learner staring at a dead button. These tests pin the
// exact Stripe calls without touching the network.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { describe, expect, it, vi } from "vitest";
import {
  createStripeClient,
  formEncode,
  readSession,
  readSubscription,
  StripeError,
} from "../server/src/stripe";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface Recorded {
  url: string;
  init: RequestInit;
}

function clientWith(reply: () => Response) {
  const calls: Recorded[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return reply();
  }) as unknown as typeof fetch;
  const client = createStripeClient({
    secretKey: "sk_test_secret",
    apiBase: "https://stripe.test",
    fetchImpl,
  });
  return { client, calls };
}

describe("stripe client", () => {
  it("encodes form fields the way Stripe names them", () => {
    const body = formEncode({ mode: "subscription", "line_items[0][quantity]": 1, allow: true });
    expect(body).toBe("mode=subscription&line_items%5B0%5D%5Bquantity%5D=1&allow=true");
  });

  it("creates a subscription Checkout session with the exact return addresses", async () => {
    const { client, calls } = clientWith(() => json({ id: "cs_1", url: "https://checkout.test/cs_1" }));
    const created = await client.createCheckoutSession({
      priceId: "price_1",
      successUrl: "https://app.test/flashcards/settings/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://app.test/flashcards/settings/?checkout=cancel",
    });
    expect(created).toEqual({ id: "cs_1", url: "https://checkout.test/cs_1" });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.url).toBe("https://stripe.test/v1/checkout/sessions");
    expect(call.init.method).toBe("POST");
    expect((call.init.headers as Record<string, string>).authorization).toBe("Bearer sk_test_secret");
    expect((call.init.headers as Record<string, string>)["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const body = new URLSearchParams(String(call.init.body));
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("line_items[0][price]")).toBe("price_1");
    expect(body.get("line_items[0][quantity]")).toBe("1");
    expect(body.get("success_url")).toBe(
      "https://app.test/flashcards/settings/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
    );
    expect(body.get("cancel_url")).toBe("https://app.test/flashcards/settings/?checkout=cancel");
    expect(body.get("allow_promotion_codes")).toBe("true");
    expect(body.get("billing_address_collection")).toBe("auto");
  });

  it("reads a Checkout session and asks Stripe to expand the subscription", async () => {
    const { client, calls } = clientWith(() =>
      json({
        id: "cs_1",
        status: "complete",
        payment_status: "paid",
        customer: "cus_1",
        subscription: {
          id: "sub_1",
          status: "active",
          customer: "cus_1",
          cancel_at_period_end: false,
          items: { data: [{ current_period_end: 1_800_000_000 }] },
        },
      }),
    );
    const session = await client.getCheckoutSession("cs_1");
    expect(calls[0].url).toBe(
      "https://stripe.test/v1/checkout/sessions/cs_1?expand%5B%5D=subscription",
    );
    expect(calls[0].init.method).toBe("GET");
    expect(session).toEqual({
      id: "cs_1",
      status: "complete",
      paymentStatus: "paid",
      customer: "cus_1",
      subscriptionId: "sub_1",
      subscription: {
        id: "sub_1",
        status: "active",
        customer: "cus_1",
        renewsAt: 1_800_000_000,
        cancelAtPeriodEnd: false,
      },
    });
  });

  it("reads a subscription whose period end is at the top level", async () => {
    const { client } = clientWith(() =>
      json({
        id: "sub_1",
        status: "trialing",
        customer: "cus_1",
        current_period_end: 1_700_000_000,
        cancel_at_period_end: true,
      }),
    );
    expect(await client.getSubscription("sub_1")).toEqual({
      id: "sub_1",
      status: "trialing",
      customer: "cus_1",
      renewsAt: 1_700_000_000,
      cancelAtPeriodEnd: true,
    });
  });

  it("creates a billing portal session for the customer", async () => {
    const { client, calls } = clientWith(() => json({ url: "https://portal.test/p_1" }));
    expect(
      await client.createPortalSession({
        customer: "cus_1",
        returnUrl: "https://app.test/flashcards/settings/",
      }),
    ).toEqual({ url: "https://portal.test/p_1" });
    const body = new URLSearchParams(String(calls[0].init.body));
    expect(calls[0].url).toBe("https://stripe.test/v1/billing_portal/sessions");
    expect(body.get("customer")).toBe("cus_1");
    expect(body.get("return_url")).toBe("https://app.test/flashcards/settings/");
  });

  it("reports an API failure as a typed error without inventing success", async () => {
    const { client } = clientWith(() =>
      json({ error: { message: "No such session", code: "resource_missing" } }, 404),
    );
    await expect(client.getCheckoutSession("cs_missing")).rejects.toMatchObject({
      name: "StripeError",
      status: 404,
      code: "resource_missing",
    });
  });

  it("reports an unreachable or timed-out Stripe as a retryable failure", async () => {
    const aborting = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }) as unknown as typeof fetch;
    const client = createStripeClient({
      secretKey: "sk_test",
      apiBase: "https://stripe.test",
      fetchImpl: aborting,
    });
    const failure = await client.createPortalSession({
      customer: "cus_1",
      returnUrl: "https://app.test/",
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(StripeError);
    expect((failure as StripeError).status).toBe(0);
    expect((failure as StripeError).message).toBe("Stripe timed out.");
  });

  it("refuses a checkout answer without a URL", async () => {
    const { client } = clientWith(() => json({ id: "cs_1" }));
    await expect(
      client.createCheckoutSession({
        priceId: "price_1",
        successUrl: "https://app.test/a",
        cancelUrl: "https://app.test/b",
      }),
    ).rejects.toMatchObject({ status: 502 });
  });
});

describe("Stripe payload readers", () => {
  it("keeps only facts with an identity", () => {
    expect(readSubscription({ status: "active" })).toBeNull();
    expect(readSession({ status: "complete" })).toBeNull();
    expect(readSession({ id: "cs_1", subscription: "sub_1" })).toMatchObject({
      id: "cs_1",
      subscriptionId: "sub_1",
      subscription: null,
      paymentStatus: "unknown",
    });
  });
});

describe("the reads recovery needs", () => {
  it("asks Stripe for customers of one exact email and keeps usable rows", async () => {
    const { client, calls } = clientWith(() =>
      json({
        data: [
          { id: "cus_1", email: "ana@example.com" },
          { email: "no-id@example.com" },
          "junk",
        ],
      }),
    );
    expect(await client.listCustomersByEmail("ana@example.com")).toEqual([
      { id: "cus_1", email: "ana@example.com", metadata: {} },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://stripe.test/v1/customers?email=ana%40example.com&limit=10",
    );
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.body).toBeUndefined();
  });

  it("asks for every subscription of a customer and skips unusable rows", async () => {
    const { client, calls } = clientWith(() =>
      json({
        data: [
          {
            id: "sub_1",
            status: "active",
            customer: "cus_1",
            current_period_end: 1_700_000_000,
            cancel_at_period_end: true,
          },
          { status: "active" },
        ],
      }),
    );
    expect(await client.listCustomerSubscriptions("cus_1")).toEqual([
      {
        id: "sub_1",
        status: "active",
        customer: "cus_1",
        renewsAt: 1_700_000_000,
        cancelAtPeriodEnd: true,
      },
    ]);
    expect(calls[0].url).toBe(
      "https://stripe.test/v1/subscriptions?customer=cus_1&status=all&limit=100",
    );
    expect(calls[0].init.method).toBe("GET");
  });

  it("treats an answer without a list as empty", async () => {
    const { client } = clientWith(() => json({}));
    expect(await client.listCustomersByEmail("ana@example.com")).toEqual([]);
    expect(await client.listCustomerSubscriptions("cus_1")).toEqual([]);
  });

  it("keeps a customer's string metadata and drops anything else", async () => {
    const { client } = clientWith(() =>
      json({
        data: [{ id: "cus_1", email: "ana@example.com", metadata: { recovery_used_iat: "1800000000", odd: 7 } }],
      }),
    );
    expect(await client.listCustomersByEmail("ana@example.com")).toEqual([
      { id: "cus_1", email: "ana@example.com", metadata: { recovery_used_iat: "1800000000" } },
    ]);
  });

  it("writes the one-use mark under the key recovery reads", async () => {
    const { client, calls } = clientWith(() => json({ id: "cus_1", metadata: {} }));
    await client.updateCustomerMetadata("cus_1", { recovery_used_iat: "1800000000" });
    expect(calls[0].url).toBe("https://stripe.test/v1/customers/cus_1");
    expect(calls[0].init.method).toBe("POST");
    const body = new URLSearchParams(String(calls[0].init.body));
    expect(body.get("metadata[recovery_used_iat]")).toBe("1800000000");
  });
});
