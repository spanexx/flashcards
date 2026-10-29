// WHY: A recovery link is a key to a paid door. These tests pin the three
// promises that make it safe: the link proves the inbox, the subscription is
// re-read live, and a miss answers exactly like a hit.
// PACK: subscription-recovery
// 2026-10-28 qoder: created to move a paid pass to a new browser. [pack: subscription-recovery]

import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyLicense } from "../server/src/license";
import { MailError, type RecoveryMailer } from "../server/src/mailer";
import {
  deliverRecoveryLink,
  lastUsedIat,
  normaliseEmail,
  pickLiveSubscription,
  RecoveryCooldown,
  redeemRecoveryLink,
  recoveryHash,
  recoveryLink,
  signRecoveryToken,
  verifyRecoveryToken,
  type RecoveryDeps,
} from "../server/src/recovery";
import {
  StripeError,
  type StripeCustomerView,
  type StripeSubscriptionView,
} from "../server/src/stripe";

const SECRET = "recovery-secret-that-is-long-enough-01";
const LICENSE_SECRET = "license-secret-that-is-long-enough-012";
const APP = "https://app.test/flashcards/";
const TTL = 1800;
const NOW = 1_800_000_000_000;

const active: StripeSubscriptionView = {
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  renewsAt: 1_800_100_000,
  cancelAtPeriodEnd: false,
};

interface StripeFakeOptions {
  customers?: Record<string, StripeCustomerView[]>;
  subscriptions?: Record<string, StripeSubscriptionView[]>;
  fail?: boolean;
  failMark?: boolean;
}

function fakeStripe(options: StripeFakeOptions = {}) {
  const customers = options.customers ?? {
    "ana@example.com": [{ id: "cus_1", email: "ana@example.com", metadata: {} }],
  };
  const subscriptions = options.subscriptions ?? { cus_1: [active] };
  const marks = new Map<string, Record<string, string>>();
  const lookedUp: string[] = [];
  const marked: { customer: string; metadata: Record<string, string> }[] = [];
  const stripe = {
    listCustomersByEmail: vi.fn(async (email: string) => {
      lookedUp.push(email);
      if (options.fail) throw new StripeError(500, "Stripe answered 500.");
      return (customers[email] ?? []).map((customer) => ({
        ...customer,
        metadata: { ...customer.metadata, ...(marks.get(customer.id) ?? {}) },
      }));
    }),
    listCustomerSubscriptions: vi.fn(async (customer: string) => {
      if (options.fail) throw new StripeError(500, "Stripe answered 500.");
      return subscriptions[customer] ?? [];
    }),
    updateCustomerMetadata: vi.fn(async (customer: string, metadata: Record<string, string>) => {
      if (options.fail || options.failMark) throw new StripeError(500, "Stripe answered 500.");
      marked.push({ customer, metadata });
      marks.set(customer, { ...(marks.get(customer) ?? {}), ...metadata });
    }),
  };
  return { stripe, lookedUp, marked };
}

function fakeMailer() {
  const sent: { email: string; link: string; ttl: number }[] = [];
  const mailer: RecoveryMailer = {
    sendRecoveryLink: vi.fn(async (email: string, link: string, ttl: number) => {
      sent.push({ email, link, ttl });
    }),
  };
  return { mailer, sent };
}

function makeDeps(overrides: {
  stripe?: ReturnType<typeof fakeStripe>["stripe"];
  mailer?: RecoveryMailer;
  now?: () => number;
  cooldown?: RecoveryCooldown;
  log?: (line: string) => void;
} = {}): RecoveryDeps {
  const stripe = overrides.stripe ?? fakeStripe().stripe;
  return {
    stripe,
    mailer: overrides.mailer ?? fakeMailer().mailer,
    secret: SECRET,
    appUrl: APP,
    tokenTtlSeconds: TTL,
    licenseSecret: LICENSE_SECRET,
    licenseTtlSeconds: 30 * 24 * 60 * 60,
    cooldown: overrides.cooldown ?? new RecoveryCooldown(600_000, () => NOW),
    now: overrides.now ?? (() => NOW),
    log: overrides.log,
  };
}

/** Build a token with any payload, signed the way the module signs. */
function craft(payload: unknown, secret = SECRET): string {
  const text = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(text).digest("base64url");
  return `${text}.${signature}`;
}

describe("normaliseEmail", () => {
  it("keeps a plain address and trims it", () => {
    expect(normaliseEmail("  ana@example.com ")).toBe("ana@example.com");
    expect(normaliseEmail("Ana@Example.COM")).toBe("Ana@Example.COM");
  });

  it("refuses anything that is not one", () => {
    for (const value of ["", "ana", "ana@", "@example.com", "ana@example", "a b@example.com", "ana@exa mple.com", 42, null]) {
      expect(normaliseEmail(value)).toBeNull();
    }
  });
});

describe("recovery token", () => {
  it("round-trips the address", () => {
    const token = signRecoveryToken("ana@example.com", SECRET, NOW);
    expect(verifyRecoveryToken(token, SECRET, TTL, NOW)).toEqual({
      ok: true,
      email: "ana@example.com",
      iat: Math.floor(NOW / 1000),
    });
  });

  it("refuses a token older than its window", () => {
    const token = signRecoveryToken("ana@example.com", SECRET, NOW);
    expect(verifyRecoveryToken(token, SECRET, TTL, NOW + 1801_000)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("refuses a token from another secret", () => {
    const token = signRecoveryToken("ana@example.com", `${SECRET}-other`, NOW);
    expect(verifyRecoveryToken(token, SECRET, TTL, NOW)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an edited payload", () => {
    const token = signRecoveryToken("ana@example.com", SECRET, NOW);
    const [, signature] = token.split(".");
    const edited = craft(
      { v: 1, email: "mallory@example.com", iat: Math.floor(NOW / 1000) },
      SECRET,
    ).split(".")[0];
    expect(verifyRecoveryToken(`${edited}.${signature}`, SECRET, TTL, NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("refuses another version, a future issue time and a wrong shape", () => {
    expect(
      verifyRecoveryToken(craft({ v: 2, email: "ana@example.com", iat: NOW / 1000 }), SECRET, TTL, NOW),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      verifyRecoveryToken(
        craft({ v: 1, email: "ana@example.com", iat: Math.floor(NOW / 1000) + 3600 }),
        SECRET,
        TTL,
        NOW,
      ),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(verifyRecoveryToken(craft({ v: 1, email: "nope", iat: NOW / 1000 }), SECRET, TTL, NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(verifyRecoveryToken("", SECRET, TTL, NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(verifyRecoveryToken("one.two.three", SECRET, TTL, NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("pickLiveSubscription", () => {
  it("takes the latest-renewing live plan", () => {
    const older = { ...active, id: "sub_old", renewsAt: 1_800_050_000 };
    const newer = { ...active, id: "sub_new", renewsAt: 1_800_200_000 };
    expect(pickLiveSubscription([older, newer])?.id).toBe("sub_new");
    expect(pickLiveSubscription([newer, older])?.id).toBe("sub_new");
  });

  it("keeps trialing and ignores unpaid or ended plans", () => {
    const trialing = { ...active, id: "sub_trial", status: "trialing", renewsAt: 1_800_300_000 };
    expect(pickLiveSubscription([active, trialing])?.id).toBe("sub_trial");
    for (const status of ["past_due", "canceled", "unpaid", "incomplete", "paused"]) {
      expect(pickLiveSubscription([{ ...active, status }])).toBeNull();
    }
    expect(pickLiveSubscription([])).toBeNull();
  });
});

describe("lastUsedIat", () => {
  it("reads the mark and treats anything else as never used", () => {
    expect(lastUsedIat({ recovery_used_iat: "1800000000" })).toBe(1_800_000_000);
    expect(lastUsedIat({})).toBe(0);
    expect(lastUsedIat({ recovery_used_iat: "later" })).toBe(0);
    expect(lastUsedIat({ recovery_used_iat: "-5" })).toBe(0);
  });
});

describe("RecoveryCooldown", () => {
  it("allows one request per window", () => {
    let at = NOW;
    const cooldown = new RecoveryCooldown(600_000, () => at);
    const hash = recoveryHash("ana@example.com", SECRET);
    expect(cooldown.take(hash)).toBe(true);
    expect(cooldown.take(hash)).toBe(false);
    at += 599_000;
    expect(cooldown.take(hash)).toBe(false);
    at += 1_000;
    expect(cooldown.take(hash)).toBe(true);
    expect(cooldown.size()).toBe(1);
  });

  it("keeps addresses apart", () => {
    const cooldown = new RecoveryCooldown(600_000, () => NOW);
    expect(cooldown.take(recoveryHash("ana@example.com", SECRET))).toBe(true);
    expect(cooldown.take(recoveryHash("bo@example.com", SECRET))).toBe(true);
  });

  it("never stores the address, only a hash", () => {
    const hash = recoveryHash("ana@example.com", SECRET);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("ana");
    expect(recoveryHash("Ana@Example.com", SECRET)).toBe(hash);
    expect(recoveryHash("ana@example.com", `${SECRET}-other`)).not.toBe(hash);
  });
});

describe("deliverRecoveryLink", () => {
  it("sends one message with a link that verifies for the address", async () => {
    const { stripe } = fakeStripe();
    const { mailer, sent } = fakeMailer();
    await deliverRecoveryLink(makeDeps({ stripe, mailer }), "ana@example.com");
    expect(sent).toHaveLength(1);
    expect(sent[0].email).toBe("ana@example.com");
    expect(sent[0].ttl).toBe(TTL);
    const link = new URL(sent[0].link);
    expect(link.pathname).toBe("/flashcards/settings/");
    const token = link.searchParams.get("recover") ?? "";
    expect(verifyRecoveryToken(token, SECRET, TTL, NOW)).toEqual({
      ok: true,
      email: "ana@example.com",
      iat: Math.floor(NOW / 1000),
    });
  });

  it("finds a customer whatever the case the learner typed", async () => {
    const { stripe, lookedUp } = fakeStripe();
    const { mailer, sent } = fakeMailer();
    await deliverRecoveryLink(makeDeps({ stripe, mailer }), "Ana@Example.com");
    expect(lookedUp).toEqual(["Ana@Example.com", "ana@example.com"]);
    expect(sent).toHaveLength(1);
  });

  it("sends nothing for an unknown address", async () => {
    const { stripe } = fakeStripe();
    const { mailer, sent } = fakeMailer();
    await deliverRecoveryLink(makeDeps({ stripe, mailer }), "nobody@example.com");
    expect(sent).toHaveLength(0);
  });

  it("sends nothing for a cancelled plan", async () => {
    const { stripe } = fakeStripe({ subscriptions: { cus_1: [{ ...active, status: "canceled" }] } });
    const { mailer, sent } = fakeMailer();
    await deliverRecoveryLink(makeDeps({ stripe, mailer }), "ana@example.com");
    expect(sent).toHaveLength(0);
  });

  it("swallows a Stripe failure and logs no address", async () => {
    const lines: string[] = [];
    const { stripe } = fakeStripe({ fail: true });
    const { mailer, sent } = fakeMailer();
    await deliverRecoveryLink(
      makeDeps({ stripe, mailer, log: (line) => lines.push(line) }),
      "ana@example.com",
    );
    expect(sent).toHaveLength(0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("ana@example.com");
  });

  it("swallows a mail failure and logs no address", async () => {
    const lines: string[] = [];
    const mailer: RecoveryMailer = {
      sendRecoveryLink: vi.fn(async () => {
        throw new MailError(500, "The mailer answered 500.");
      }),
    };
    await deliverRecoveryLink(makeDeps({ mailer, log: (line) => lines.push(line) }), "ana@example.com");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("500");
    expect(lines[0]).not.toContain("ana@example.com");
  });

  it("sends one message inside the per-address window", async () => {
    const { mailer, sent } = fakeMailer();
    const deps = makeDeps({ mailer });
    await deliverRecoveryLink(deps, "ana@example.com");
    await deliverRecoveryLink(deps, "ana@example.com");
    expect(sent).toHaveLength(1);
  });
});

describe("redeemRecoveryLink", () => {
  function token(email = "ana@example.com", at = NOW): string {
    return signRecoveryToken(email, SECRET, at);
  }

  it("mints a pass that names the live subscription", async () => {
    const result = await redeemRecoveryLink(makeDeps(), token());
    expect(result.ok).toBe(true);
    if (!result.ok || !result.license) throw new Error("expected a pass");
    const read = verifyLicense(result.license, LICENSE_SECRET, { now: NOW });
    expect(read).toMatchObject({ ok: true, payload: { sub: "sub_1", cus: "cus_1" } });
    expect(result.entitlement).toMatchObject({
      status: "active",
      renewsAt: active.renewsAt,
      expiresAt: Math.floor(NOW / 1000) + 30 * 24 * 60 * 60,
    });
  });

  it("refuses the second use of the same link", async () => {
    const deps = makeDeps();
    const first = await redeemRecoveryLink(deps, token());
    expect(first.ok).toBe(true);
    expect(await redeemRecoveryLink(deps, token())).toEqual({
      ok: false,
      code: "invalid_license",
      message: "That link has already been used. Ask for a new one.",
    });
  });

  it("writes the used moment on the customer that owns the plan", async () => {
    const { stripe, marked } = fakeStripe();
    await redeemRecoveryLink(makeDeps({ stripe }), token());
    expect(marked).toEqual([
      { customer: "cus_1", metadata: { recovery_used_iat: String(Math.floor(NOW / 1000)) } },
    ]);
  });

  it("lets a link asked for after the used one through", async () => {
    const deps = makeDeps();
    expect((await redeemRecoveryLink(deps, token())).ok).toBe(true);
    const later = signRecoveryToken("ana@example.com", SECRET, NOW + 60_000);
    expect((await redeemRecoveryLink(deps, later)).ok).toBe(true);
  });

  it("hands out no pass when the used mark cannot be written", async () => {
    const { stripe, marked } = fakeStripe({ failMark: true });
    const result = await redeemRecoveryLink(makeDeps({ stripe }), token());
    expect(result).toMatchObject({
      ok: false,
      code: "stripe",
      message: "The link could not be checked. Try again in a moment.",
    });
    expect(marked).toHaveLength(0);
  });

  it("does not spend a link on a cancelled plan", async () => {
    const { stripe, marked } = fakeStripe({
      subscriptions: { cus_1: [{ ...active, status: "canceled" }] },
    });
    const result = await redeemRecoveryLink(makeDeps({ stripe }), token());
    expect(result).toMatchObject({ ok: false, code: "inactive" });
    expect(marked).toHaveLength(0);
  });

  it("refuses an old link and a forged one with different sentences", async () => {
    const old = await redeemRecoveryLink(makeDeps(), token("ana@example.com", NOW - 1_801_000));
    expect(old).toMatchObject({
      ok: false,
      code: "invalid_license",
      message: "That link has expired. Ask for a new one.",
    });
    const forged = await redeemRecoveryLink(makeDeps(), `${token()}.extra`);
    expect(forged).toMatchObject({
      ok: false,
      code: "invalid_license",
      message: "That link is not valid. Ask for a new one.",
    });
  });

  it("refuses a cancelled plan even for a fresh link", async () => {
    const { stripe } = fakeStripe({ subscriptions: { cus_1: [{ ...active, status: "canceled" }] } });
    const result = await redeemRecoveryLink(makeDeps({ stripe }), token());
    expect(result).toMatchObject({ ok: false, code: "inactive" });
  });

  it("reports a Stripe failure as a service problem", async () => {
    const { stripe } = fakeStripe({ fail: true });
    const result = await redeemRecoveryLink(makeDeps({ stripe }), token());
    expect(result).toMatchObject({ ok: false, code: "stripe" });
  });

  it("uses the later-renewing plan when an address has two", async () => {
    const { stripe } = fakeStripe({
      subscriptions: {
        cus_1: [
          { ...active, id: "sub_old", renewsAt: 1_800_050_000 },
          { ...active, id: "sub_new", renewsAt: 1_800_200_000 },
        ],
      },
    });
    const result = await redeemRecoveryLink(makeDeps({ stripe }), token());
    if (!result.ok || !result.license) throw new Error("expected a pass");
    const read = verifyLicense(result.license, LICENSE_SECRET, { now: NOW });
    expect(read).toMatchObject({ ok: true, payload: { sub: "sub_new" } });
  });

  it("refuses a subscription with no customer", async () => {
    const { stripe } = fakeStripe({ subscriptions: { cus_1: [{ ...active, customer: null }] } });
    const result = await redeemRecoveryLink(makeDeps({ stripe }), token());
    expect(result).toMatchObject({ ok: false, code: "inactive" });
  });
});

describe("recoveryLink", () => {
  it("builds a settings address with the token in the query", () => {
    const link = new URL(recoveryLink(APP, "abc.def"));
    expect(link.origin).toBe("https://app.test");
    expect(link.pathname).toBe("/flashcards/settings/");
    expect(link.searchParams.get("recover")).toBe("abc.def");
  });
});
