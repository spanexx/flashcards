// WHY: A missing secret should stop the service with names, not a vague crash
// halfway through a learner's checkout. These tests pin that contract.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { describe, expect, it } from "vitest";
import { enabledGroups, parseConfig, publicConfig } from "../server/src/config";

const SECRET = "s".repeat(40);

function minimal(extra: Record<string, string> = {}) {
  return {
    APP_URL: "https://owner.github.io/flashcards",
    SYSTEM_PROVIDER_NAME: "Flashcards Tutor",
    SYSTEM_PRICE_LABEL: "EUR 5 / month",
    LICENSE_SECRET: SECRET,
    ...extra,
  };
}

function problems(env: Record<string, string | undefined>): string[] {
  const result = parseConfig(env);
  if (result.ok) return [];
  return result.problems.map((problem) => problem.name);
}

describe("parseConfig", () => {
  it("fills every optional default and normalises the app address", () => {
    const result = parseConfig(minimal());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      port: 8787,
      appUrl: "https://owner.github.io/flashcards/",
      appOrigin: "https://owner.github.io",
      providerName: "Flashcards Tutor",
      priceLabel: "EUR 5 / month",
      stripeSecretKey: null,
      stripePriceId: null,
      stripeWebhookSecret: null,
      stripeApiBase: "https://api.stripe.com",
      licenseTtlSeconds: 2_592_000,
      upstreamTimeoutMs: 60_000,
      rateLimitPerHour: 120,
      relayRateLimitPerHour: 60,
      subscriptionCacheMs: 120_000,
      llmBaseUrl: null,
      llmModel: null,
      llmApiKey: null,
    });
  });

  it("names every required variable that is missing", () => {
    expect(problems({})).toEqual([
      "APP_URL",
      "SYSTEM_PROVIDER_NAME",
      "SYSTEM_PRICE_LABEL",
      "LICENSE_SECRET",
    ]);
  });

  it("refuses an address that is not a full http(s) URL", () => {
    expect(problems(minimal({ APP_URL: "owner.github.io/flashcards" }))).toEqual(["APP_URL"]);
    expect(problems(minimal({ APP_URL: "ftp://owner.example/app" }))).toEqual(["APP_URL"]);
  });

  it("refuses a signing secret shorter than 32 characters", () => {
    expect(problems(minimal({ LICENSE_SECRET: "short" }))).toEqual(["LICENSE_SECRET"]);
  });

  it("refuses numbers outside their range and does not silently default", () => {
    expect(problems(minimal({ PORT: "0" }))).toEqual(["PORT"]);
    expect(problems(minimal({ PORT: "eighty" }))).toEqual(["PORT"]);
    expect(problems(minimal({ RATE_LIMIT_PER_HOUR: "-3" }))).toEqual(["RATE_LIMIT_PER_HOUR"]);
    expect(problems(minimal({ RELAY_RATE_LIMIT_PER_HOUR: "0" }))).toEqual([
      "RELAY_RATE_LIMIT_PER_HOUR",
    ]);
    expect(problems(minimal({ RELAY_RATE_LIMIT_PER_HOUR: "sixty" }))).toEqual([
      "RELAY_RATE_LIMIT_PER_HOUR",
    ]);
  });

  it("accepts a complete Stripe group and reports checkout and portal", () => {
    const result = parseConfig(
      minimal({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_ID: "price_x" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(publicConfig(result.config)).toEqual({
      name: "Flashcards Tutor",
      priceLabel: "EUR 5 / month",
      checkout: true,
      proxy: false,
      recovery: false,
    });
    expect(enabledGroups(result.config)).toContain("checkout");
    expect(enabledGroups(result.config)).toContain("portal");
  });

  it("refuses a half-set Stripe group", () => {
    expect(problems(minimal({ STRIPE_SECRET_KEY: "sk_test_x" }))).toEqual(["STRIPE_PRICE_ID"]);
    expect(problems(minimal({ STRIPE_PRICE_ID: "price_x" }))).toEqual(["STRIPE_SECRET_KEY"]);
  });

  it("refuses a half-set model proxy group", () => {
    expect(problems(minimal({ SYSTEM_LLM_MODEL: "gpt" }))).toEqual([
      "SYSTEM_LLM_BASE_URL",
      "SYSTEM_LLM_API_KEY",
    ]);
  });

  it("accepts a complete model proxy and strips the trailing slash", () => {
    const result = parseConfig(
      minimal({
        SYSTEM_LLM_BASE_URL: "https://llm.example/v1/",
        SYSTEM_LLM_MODEL: "gpt",
        SYSTEM_LLM_API_KEY: "sk-llm",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        SUBSCRIPTION_CACHE_MS: "0",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.llmBaseUrl).toBe("https://llm.example/v1");
    expect(publicConfig(result.config)).toMatchObject({ proxy: true, checkout: false });
    expect(enabledGroups(result.config)).toEqual(["entitlement", "webhook", "proxy"]);
    expect(result.config.subscriptionCacheMs).toBe(0);
  });

  it("never puts a secret in the public config", () => {
    const result = parseConfig(
      minimal({
        STRIPE_SECRET_KEY: "sk_test_secret_value",
        STRIPE_PRICE_ID: "price_x",
        STRIPE_WEBHOOK_SECRET: "whsec_value",
        SYSTEM_LLM_BASE_URL: "https://llm.example/v1",
        SYSTEM_LLM_MODEL: "gpt",
        SYSTEM_LLM_API_KEY: "sk-llm-value",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = JSON.stringify(publicConfig(result.config));
    expect(text).not.toContain("sk_test_secret_value");
    expect(text).not.toContain("whsec_value");
    expect(text).not.toContain("sk-llm-value");
    expect(text).not.toContain(SECRET);
  });

  it("turns recovery off unless the whole group is present", () => {
    const bare = parseConfig(minimal());
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;
    expect(publicConfig(bare.config).recovery).toBe(false);
    expect(bare.config.recovery).toBeNull();

    expect(problems(minimal({ BREVO_API_KEY: "xkeysib-1" }))).toEqual([
      "RECOVERY_SECRET",
      "RECOVERY_FROM_EMAIL",
      "STRIPE_SECRET_KEY",
    ]);
    expect(problems(minimal({ RECOVERY_SECRET: "r".repeat(40) }))).toEqual([
      "BREVO_API_KEY",
      "RECOVERY_FROM_EMAIL",
      "STRIPE_SECRET_KEY",
    ]);
    expect(problems(minimal({ RECOVERY_FROM_EMAIL: "links@example.com" }))).toEqual([
      "BREVO_API_KEY",
      "RECOVERY_SECRET",
      "STRIPE_SECRET_KEY",
    ]);
  });

  it("requires Stripe, a long secret and a real sender for recovery", () => {
    const complete = {
      BREVO_API_KEY: "xkeysib-1",
      RECOVERY_SECRET: "r".repeat(40),
      RECOVERY_FROM_EMAIL: "links@example.com",
    };
    expect(problems(minimal(complete))).toEqual(["STRIPE_SECRET_KEY"]);
    expect(
      problems(minimal({ ...complete, STRIPE_SECRET_KEY: "sk", RECOVERY_SECRET: "short" })),
    ).toEqual(["STRIPE_PRICE_ID", "RECOVERY_SECRET"]);
    expect(
      problems(minimal({ ...complete, STRIPE_SECRET_KEY: "sk", RECOVERY_FROM_EMAIL: "not-an-address" })),
    ).toEqual(["STRIPE_PRICE_ID", "RECOVERY_FROM_EMAIL"]);
  });

  it("reads recovery defaults and reports the group by name only", () => {
    const result = parseConfig(
      minimal({
        STRIPE_SECRET_KEY: "sk_test_x",
        STRIPE_PRICE_ID: "price_x",
        BREVO_API_KEY: "xkeysib-secret-value",
        RECOVERY_SECRET: "r".repeat(40),
        RECOVERY_FROM_EMAIL: "links@example.com",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.recovery).toMatchObject({
      fromName: "Study tutor",
      tokenTtlSeconds: 1800,
      rateLimitPerHour: 5,
      cooldownSeconds: 600,
    });
    expect(publicConfig(result.config).recovery).toBe(true);
    expect(enabledGroups(result.config)).toContain("recovery");
    const text = JSON.stringify(publicConfig(result.config));
    expect(text).not.toContain("xkeysib-secret-value");
    expect(text).not.toContain("links@example.com");
  });
});
