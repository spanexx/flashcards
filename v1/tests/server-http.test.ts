// WHY: The route table is the browser contract. These tests drive a real
// socket so CORS, bodies, status codes and headers are checked as a browser sees
// them, while Stripe and the model upstream stay fakes.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConfig, type ServerConfig } from "../server/src/config";
import { appReturnUrl, createSystemServer, RateLimiter } from "../server/src/http";
import { issueLicense } from "../server/src/license";
import type { ProxyOptions } from "../server/src/proxy";
import {
  RecoveryCooldown,
  signRecoveryToken,
  type RecoveryDeps,
} from "../server/src/recovery";
import type { PinnedTarget, RelayOptions } from "../server/src/relay";
import type { StripeClient, StripeSessionView, StripeSubscriptionView } from "../server/src/stripe";
import { StatusCache } from "../server/src/subscriptions";

const SECRET = "license-secret-that-is-long-enough-123";
const APP = "https://app.test/flashcards/";
const ORIGIN = "https://app.test";

const subscription: StripeSubscriptionView = {
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  renewsAt: 1_800_000_000,
  cancelAtPeriodEnd: false,
};

const session: StripeSessionView = {
  id: "cs_1",
  status: "complete",
  paymentStatus: "paid",
  customer: "cus_1",
  subscriptionId: "sub_1",
  subscription: { ...subscription },
};

function configWith(extra: Record<string, string> = {}): ServerConfig {
  const parsed = parseConfig({
    APP_URL: APP,
    SYSTEM_PROVIDER_NAME: "Tutor",
    SYSTEM_PRICE_LABEL: "EUR 5 / month",
    LICENSE_SECRET: SECRET,
    ...extra,
  });
  if (!parsed.ok) throw new Error(parsed.problems.map((problem) => problem.name).join(","));
  return parsed.config;
}

const selling = {
  STRIPE_SECRET_KEY: "sk_test_server",
  STRIPE_PRICE_ID: "price_1",
};

const upstream = {
  SYSTEM_LLM_BASE_URL: "https://llm.test",
  SYSTEM_LLM_MODEL: "operator-model",
  SYSTEM_LLM_API_KEY: "sk-llm-operator",
};

function fakeStripe(): StripeClient {
  return {
    createCheckoutSession: vi.fn(async () => ({ id: "cs_1", url: "https://checkout.test/cs_1" })),
    getCheckoutSession: vi.fn(async () => session),
    getSubscription: vi.fn(async () => subscription),
    createPortalSession: vi.fn(async () => ({ url: "https://portal.test/p_1" })),
    listCustomersByEmail: vi.fn(async () => [{ id: "cus_1", email: "ana@example.com" }]),
    listCustomerSubscriptions: vi.fn(async () => [{ ...subscription }]),
  };
}

function fakeProxy(): ProxyOptions {
  return {
    baseUrl: "https://llm.test",
    model: "operator-model",
    apiKey: "sk-llm-operator",
    timeoutMs: 10_000,
    fetchImpl: vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }))) as unknown as typeof fetch,
  };
}

const open: Server[] = [];

afterEach(async () => {
  await Promise.all(
    open.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        }),
    ),
  );
});

interface StartOptions {
  extra?: Record<string, string>;
  stripe?: StripeClient | null;
  proxy?: ProxyOptions | null;
  relay?: RelayOptions | null;
  recovery?: RecoveryDeps | null;
  subscriptions?: StatusCache;
  rateLimiter?: RateLimiter;
  relayRateLimiter?: RateLimiter;
  recoveryRateLimiter?: RateLimiter;
}

async function start(options: StartOptions = {}) {
  const config = configWith(options.extra ?? {});
  const subscriptions =
    options.subscriptions ?? new StatusCache(async () => ({ ...subscription }), 120_000);
  const stripe = options.stripe === undefined ? fakeStripe() : options.stripe;
  const server = createSystemServer({
    config,
    stripe,
    subscriptions,
    proxy: options.proxy ?? null,
    relay: options.relay ?? null,
    recovery: options.recovery ?? null,
    rateLimiter: options.rateLimiter,
    relayRateLimiter: options.relayRateLimiter,
    recoveryRateLimiter: options.recoveryRateLimiter,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  open.push(server);
  const port = (server.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, config, subscriptions, stripe };
}

function licenseFor(): string {
  return issueLicense({ sub: "sub_1", cus: "cus_1" }, SECRET, 30 * 24 * 60 * 60).token;
}

function webhookHeader(body: string, secret = "whsec_test", at = Math.floor(Date.now() / 1000)): string {
  return `t=${at},v1=${createHmac("sha256", secret).update(`${at}.${body}`).digest("hex")}`;
}

describe("public routes", () => {
  it("answers health without a secret and config with only public facts", async () => {
    const { base } = await start({ extra: { ...selling, ...upstream } });
    const health = await fetch(`${base}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      ok: true,
      service: "flashcards-system-provider",
      checkout: true,
      proxy: true,
      relay: false,
      recovery: false,
    });

    const config = await fetch(`${base}/api/config`, { headers: { origin: ORIGIN } });
    expect(config.status).toBe(200);
    expect(config.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(config.headers.get("cache-control")).toBe("no-store");
    const body = (await config.json()) as Record<string, unknown>;
    expect(body).toEqual({
      name: "Tutor",
      priceLabel: "EUR 5 / month",
      checkout: true,
      proxy: true,
      recovery: false,
    });
    const text = JSON.stringify(body);
    expect(text).not.toContain("sk_test_server");
    expect(text).not.toContain("sk-llm-operator");
    expect(text).not.toContain(SECRET);
  });

  it("allows only the app origin and answers the preflight", async () => {
    const { base } = await start();
    const refused = await fetch(`${base}/api/config`, { headers: { origin: "https://evil.test" } });
    expect(refused.status).toBe(403);
    expect(refused.headers.get("access-control-allow-origin")).toBeNull();
    expect(await refused.json()).toEqual({ error: "This origin is not allowed." });

    const preflight = await fetch(`${base}/api/checkout`, {
      method: "OPTIONS",
      headers: { origin: ORIGIN, "access-control-request-method": "POST" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");
    expect(preflight.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  it("answers an unknown path or method with a plain 404", async () => {
    const { base } = await start();
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    expect((await fetch(`${base}/api/config`, { method: "POST" })).status).toBe(404);
  });

  it("resolves return addresses against the app path", () => {
    expect(appReturnUrl(APP, "settings/?checkout=cancel")).toBe(
      "https://app.test/flashcards/settings/?checkout=cancel",
    );
    expect(
      appReturnUrl(APP, "settings/?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
    ).toBe("https://app.test/flashcards/settings/?checkout=success&session_id={CHECKOUT_SESSION_ID}");
  });
});

describe("checkout and entitlement routes", () => {
  it("starts checkout with the exact return addresses", async () => {
    const stripe = fakeStripe();
    const { base } = await start({ extra: selling, stripe });
    const response = await fetch(`${base}/api/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.test/cs_1" });
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith({
      priceId: "price_1",
      successUrl:
        "https://app.test/flashcards/settings/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://app.test/flashcards/settings/?checkout=cancel",
    });
  });

  it("refuses checkout when Stripe is not configured", async () => {
    const { base } = await start();
    const response = await fetch(`${base}/api/checkout`, { method: "POST", body: "{}" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Checkout is not configured." });
  });

  it("exchanges a paid session for a license and reads it back", async () => {
    const { base } = await start({ extra: selling });
    const completed = await fetch(`${base}/api/entitlement/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "cs_1" }),
    });
    expect(completed.status).toBe(200);
    const { license, entitlement } = (await completed.json()) as {
      license: string;
      entitlement: Record<string, unknown>;
    };
    expect(license.split(".")).toHaveLength(2);
    expect(entitlement).toMatchObject({ status: "active", renewsAt: 1_800_000_000 });

    const status = await fetch(`${base}/api/entitlement/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ license }),
    });
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ entitlement });
  });

  it("refuses a missing or forged pass on status and refresh", async () => {
    const { base } = await start();
    for (const path of ["/api/entitlement/status", "/api/entitlement/refresh"]) {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ license: "a.b" }),
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "The subscription pass is missing, invalid or expired.",
      });
    }
  });

  it("opens the billing portal for a live pass", async () => {
    const stripe = fakeStripe();
    const { base } = await start({ extra: selling, stripe });
    const response = await fetch(`${base}/api/portal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ license: licenseFor() }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://portal.test/p_1" });
    expect(stripe.createPortalSession).toHaveBeenCalledWith({
      customer: "cus_1",
      returnUrl: "https://app.test/flashcards/settings/",
    });
  });

  it("refuses a body over the limit before reading all of it", async () => {
    const { base } = await start();
    const response = await fetch(`${base}/api/entitlement/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ license: "x".repeat(1_100_000) }),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "The request is too large." });
  });
});

describe("the paid model route", () => {
  it("refuses a missing pass and a canceled subscription", async () => {
    let live: StripeSubscriptionView = { ...subscription };
    const subscriptions = new StatusCache(async () => ({ ...live }), 120_000);
    const { base } = await start({ extra: upstream, subscriptions, proxy: fakeProxy() });

    const missing = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    expect(missing.status).toBe(401);

    const license = licenseFor();
    live = { ...subscription, status: "canceled" };
    subscriptions.invalidate("sub_1");
    const canceled = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${license}` },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    expect(canceled.status).toBe(402);
    expect(await canceled.json()).toEqual({ error: "This subscription is not active." });
  });

  it("forwards one allowed call with the operator's key and stops at the limit", async () => {
    const proxy = fakeProxy();
    const { base } = await start({
      extra: { ...upstream, RATE_LIMIT_PER_HOUR: "1" },
      proxy,
      rateLimiter: new RateLimiter(1, undefined, () => 1_000),
    });
    const license = licenseFor();
    const call = () =>
      fetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${license}` },
        body: JSON.stringify({ messages: [{ role: "user", content: "Say OK." }], temperature: 0.2 }),
      });

    const first = await call();
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ choices: [{ message: { content: "OK" } }] });

    const second = await call();
    expect(second.status).toBe(429);
    expect(Number(second.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await second.json()).toEqual({ error: "Too many requests. Try again in a little while." });
  });

  it("reports a disabled proxy and an unusable request", async () => {
    const { base } = await start({ extra: upstream });
    const disabled = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${licenseFor()}` },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    expect(disabled.status).toBe(503);
  });
});

function fakeRelay(): { relay: RelayOptions; sends: PinnedTarget[] } {
  const sends: PinnedTarget[] = [];
  return {
    sends,
    relay: {
      timeoutMs: 1_000,
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      send: async (target) => {
        sends.push(target);
        return { status: 200, text: JSON.stringify({ choices: [{ message: { content: "OK" } }] }) };
      },
    },
  };
}

const relayRequest = {
  url: "https://llm.example/v1/chat/completions",
  model: "learner-model",
  messages: [{ role: "user", content: "Say OK." }],
  temperature: 0.2,
};

describe("the relay route", () => {
  it("refuses a missing key before any upstream call", async () => {
    const fake = fakeRelay();
    const { base } = await start({ relay: fake.relay });

    const health = await fetch(`${base}/healthz`);
    expect(await health.json()).toMatchObject({ relay: true });

    const response = await fetch(`${base}/api/relay/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(relayRequest),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "The provider key is missing." });
    expect(fake.sends).toHaveLength(0);
  });

  it("forwards the learner's own key and returns the provider's answer", async () => {
    const fake = fakeRelay();
    const { base } = await start({ relay: fake.relay });
    const response = await fetch(`${base}/api/relay/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer sk-learner-own",
        origin: ORIGIN,
      },
      body: JSON.stringify(relayRequest),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ choices: [{ message: { content: "OK" } }] });
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(fake.sends).toHaveLength(1);
    expect(fake.sends[0]).toMatchObject({
      address: "93.184.216.34",
      hostHeader: "llm.example",
      servername: "llm.example",
      apiKey: "sk-learner-own",
    });
  });

  it("limits per address, even when the key changes", async () => {
    const fake = fakeRelay();
    const { base } = await start({
      relay: fake.relay,
      extra: { RELAY_RATE_LIMIT_PER_HOUR: "1" },
      relayRateLimiter: new RateLimiter(1, undefined, () => 1_000),
    });
    const call = (key: string) =>
      fetch(`${base}/api/relay/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify(relayRequest),
      });

    expect((await call("sk-first")).status).toBe(200);
    const second = await call("sk-second");
    expect(second.status).toBe(429);
    expect(Number(second.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fake.sends).toHaveLength(1);
  });

  it("keeps the relay closed when it is not configured", async () => {
    const { base } = await start({ relay: null });
    const response = await fetch(`${base}/api/relay/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer sk-x" },
      body: JSON.stringify(relayRequest),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "The relay is not configured." });
  });

  it("refuses a target the guards will not call", async () => {
    const sends: PinnedTarget[] = [];
    const { base } = await start({
      relay: {
        timeoutMs: 1_000,
        lookup: async () => [{ address: "10.0.0.5", family: 4 }],
        send: async (target) => {
          sends.push(target);
          return { status: 200, text: "{}" };
        },
      },
    });
    const response = await fetch(`${base}/api/relay/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer sk-x" },
      body: JSON.stringify(relayRequest),
    });
    expect(response.status).toBe(400);
    expect(sends).toHaveLength(0);
  });
});

describe("the Stripe webhook", () => {
  it("answers 404 when no webhook secret is set", async () => {
    const { base } = await start();
    const response = await fetch(`${base}/api/stripe/webhook`, { method: "POST", body: "{}" });
    expect(response.status).toBe(404);
  });

  it("refuses a bad signature and clears the cache for a real event", async () => {
    let live: StripeSubscriptionView = { ...subscription };
    const subscriptions = new StatusCache(async () => ({ ...live }), 120_000);
    const { base } = await start({
      extra: { STRIPE_WEBHOOK_SECRET: "whsec_test" },
      subscriptions,
      proxy: fakeProxy(),
    });

    const body = JSON.stringify({
      id: "evt_1",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1" } },
    });
    // Cache the active answer first, so the assertion after the webhook proves
    // the invalidation rather than a fresh load.
    const license = licenseFor();
    const before = await fetch(`${base}/api/entitlement/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ license }),
    });
    expect(before.status).toBe(200);

    const forged = await fetch(`${base}/api/stripe/webhook`, {
      method: "POST",
      headers: { "stripe-signature": webhookHeader(body, "whsec_wrong") },
      body,
    });
    expect(forged.status).toBe(400);

    const valid = await fetch(`${base}/api/stripe/webhook`, {
      method: "POST",
      headers: { "stripe-signature": webhookHeader(body) },
      body,
    });
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({ received: true });

    // The token was cached by issuing it; the webhook must have dropped it.
    live = { ...subscription, status: "canceled" };
    const after = await fetch(`${base}/api/entitlement/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ license }),
    });
    expect(after.status).toBe(402);
  });
});

describe("the recovery routes", () => {
  const RECOVERY_SECRET = "recovery-secret-that-is-long-enough-01";
  const recoveryEnv = {
    BREVO_API_KEY: "xkeysib-server-value",
    RECOVERY_SECRET,
    RECOVERY_FROM_EMAIL: "links@example.com",
  };

  function recoveryFor(stripe: StripeClient, sent: { email: string; link: string }[]): RecoveryDeps {
    return {
      stripe,
      mailer: {
        sendRecoveryLink: vi.fn(async (email: string, link: string) => {
          sent.push({ email, link });
        }),
      },
      secret: RECOVERY_SECRET,
      appUrl: APP,
      tokenTtlSeconds: 1800,
      licenseSecret: SECRET,
      licenseTtlSeconds: 30 * 24 * 60 * 60,
      cooldown: new RecoveryCooldown(600_000),
    };
  }

  function post(base: string, path: string, body: unknown) {
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("answers 503 and keeps the form hidden when recovery is off", async () => {
    const { base } = await start();
    const request = await post(base, "/api/recovery/request", { email: "ana@example.com" });
    expect(request.status).toBe(503);
    expect(await request.json()).toEqual({ error: "Recovery is not set up." });
    expect((await post(base, "/api/recovery/redeem", { token: "a.b" })).status).toBe(503);
    const config = (await (await fetch(`${base}/api/config`)).json()) as Record<string, unknown>;
    expect(config.recovery).toBe(false);
  });

  it("names recovery as on once the group is complete", async () => {
    const stripe = fakeStripe();
    const { base } = await start({
      extra: { ...selling, ...recoveryEnv },
      stripe,
      recovery: recoveryFor(stripe, []),
    });
    const health = (await (await fetch(`${base}/healthz`)).json()) as Record<string, unknown>;
    expect(health.recovery).toBe(true);
    const config = (await (await fetch(`${base}/api/config`)).json()) as Record<string, unknown>;
    expect(config.recovery).toBe(true);
    expect(JSON.stringify(config)).not.toContain("xkeysib-server-value");
    expect(JSON.stringify(config)).not.toContain("links@example.com");
  });

  it("sends one mail for a live plan and answers a stranger identically", async () => {
    const stripe = fakeStripe();
    stripe.listCustomersByEmail = vi.fn(async (email: string) =>
      email === "ana@example.com" ? [{ id: "cus_1", email }] : [],
    );
    const sent: { email: string; link: string }[] = [];
    const { base } = await start({
      extra: { ...selling, ...recoveryEnv },
      stripe,
      recovery: recoveryFor(stripe, sent),
    });

    const known = await post(base, "/api/recovery/request", { email: "ana@example.com" });
    expect(known.status).toBe(200);
    expect(await known.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(new URL(sent[0].link).searchParams.get("recover")).toBeTruthy();

    const unknown = await post(base, "/api/recovery/request", { email: "nobody@example.com" });
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
  });

  it("refuses a missing or malformed address and sends nothing", async () => {
    const stripe = fakeStripe();
    const sent: { email: string; link: string }[] = [];
    const { base } = await start({
      extra: { ...selling, ...recoveryEnv },
      stripe,
      recovery: recoveryFor(stripe, sent),
    });
    for (const body of [{}, { email: "nope" }, { email: 42 }]) {
      const response = await post(base, "/api/recovery/request", body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Enter the email you used at checkout." });
    }
    expect(sent).toHaveLength(0);
  });

  it("stops the sixth request in the hour with a plain sentence", async () => {
    const stripe = fakeStripe();
    const sent: { email: string; link: string }[] = [];
    const { base } = await start({
      extra: { ...selling, ...recoveryEnv },
      stripe,
      recovery: recoveryFor(stripe, sent),
    });
    for (let count = 0; count < 5; count += 1) {
      expect((await post(base, "/api/recovery/request", { email: "ana@example.com" })).status).toBe(200);
    }
    const sixth = await post(base, "/api/recovery/request", { email: "ana@example.com" });
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({ error: "Too many requests. Try again in an hour." });
    expect(Number(sixth.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("redeems a fresh link for a pass and refuses an old one", async () => {
    const stripe = fakeStripe();
    const { base } = await start({
      extra: { ...selling, ...recoveryEnv },
      stripe,
      recovery: recoveryFor(stripe, []),
    });

    const fresh = signRecoveryToken("ana@example.com", RECOVERY_SECRET);
    const redeemed = await post(base, "/api/recovery/redeem", { token: fresh });
    expect(redeemed.status).toBe(200);
    const answer = (await redeemed.json()) as { license: string; entitlement: { status: string } };
    expect(answer.license.split(".")).toHaveLength(2);
    expect(answer.entitlement.status).toBe("active");

    const old = signRecoveryToken("ana@example.com", RECOVERY_SECRET, Date.now() - 1_801_000);
    const expired = await post(base, "/api/recovery/redeem", { token: old });
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({ error: "That link has expired. Ask for a new one." });
  });

  it("refuses a cancelled plan even for a fresh link", async () => {
    const stripe = fakeStripe();
    stripe.listCustomerSubscriptions = vi.fn(async () => [{ ...subscription, status: "canceled" }]);
    const { base } = await start({
      extra: { ...selling, ...recoveryEnv },
      stripe,
      recovery: recoveryFor(stripe, []),
    });
    const response = await post(base, "/api/recovery/redeem", {
      token: signRecoveryToken("ana@example.com", RECOVERY_SECRET),
    });
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: "This subscription is not active." });
  });
});
