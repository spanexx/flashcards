// WHY: The page talks to the subscription service through one module. These
// tests pin the address rules, the answer shapes, and the promise that no key
// or pass is ever put in a header or shown in a sentence.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  licenseNeedsRefresh,
  normaliseApiBase,
  readEntitlement,
  readLicenseAnswer,
  readSystemConfig,
  readUrl,
  systemChatBase,
} from "@/lib/client/system";

function answer(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

/** Load a fresh client with one build address, so module-level env is honest. */
async function clientWith(base: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SYSTEM_API_BASE", base);
  return import("@/lib/client/system");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("the build address", () => {
  it("keeps only plain web addresses", () => {
    expect(normaliseApiBase("https://sub.example.com/")).toBe("https://sub.example.com");
    expect(normaliseApiBase("  http://127.0.0.1:8787  ")).toBe("http://127.0.0.1:8787");
    expect(normaliseApiBase("ftp://example.com")).toBe("");
    expect(normaliseApiBase("not a url")).toBe("");
    expect(normaliseApiBase(undefined)).toBe("");
  });

  it("turns the base into the chat base the provider client expects", () => {
    expect(systemChatBase("https://sub.example.com")).toBe("https://sub.example.com/v1");
    expect(systemChatBase("")).toBe("");
  });
});

describe("answer shapes", () => {
  it("reads the public facts", () => {
    expect(
      readSystemConfig({ name: "Tutor", priceLabel: "5 € a month", checkout: true, proxy: false }),
    ).toEqual({ name: "Tutor", priceLabel: "5 € a month", checkout: true, proxy: false });
    expect(readSystemConfig({ name: "  " })).toBeNull();
    expect(readSystemConfig(null)).toBeNull();
  });

  it("reads one entitlement", () => {
    expect(
      readEntitlement({
        entitlement: { status: "active", renewsAt: 100, cancelAtPeriodEnd: true, expiresAt: 200 },
      }),
    ).toEqual({ status: "active", renewsAt: 100, cancelAtPeriodEnd: true, expiresAt: 200 });
    expect(readEntitlement({ entitlement: { status: "active" } })).toBeNull();
    expect(readEntitlement({})).toBeNull();
  });

  it("reads a licence answer only when both halves are there", () => {
    const entitlement = { status: "active", renewsAt: null, cancelAtPeriodEnd: false, expiresAt: 200 };
    expect(readLicenseAnswer({ license: "a.b", entitlement })).toEqual({
      license: "a.b",
      entitlement,
    });
    expect(readLicenseAnswer({ license: "", entitlement })).toBeNull();
    expect(readLicenseAnswer({ license: "a.b" })).toBeNull();
  });

  it("keeps a redirect only when it is a web address", () => {
    expect(readUrl({ url: "https://checkout.stripe.com/c/pay/1" })).toBe(
      "https://checkout.stripe.com/c/pay/1",
    );
    expect(readUrl({ url: "javascript:alert(1)" })).toBeNull();
    expect(readUrl({ url: "not a url" })).toBeNull();
    expect(readUrl({})).toBeNull();
  });

  it("asks for a refresh inside the last week, or after the end", () => {
    const now = 1_800_000_000_000;
    expect(licenseNeedsRefresh(now + 8 * 24 * 60 * 60 * 1000, now)).toBe(false);
    expect(licenseNeedsRefresh(now + 3 * 24 * 60 * 60 * 1000, now)).toBe(true);
    expect(licenseNeedsRefresh(now - 1, now)).toBe(true);
    expect(licenseNeedsRefresh(Number.NaN, now)).toBe(true);
  });
});

describe("talking to the service", () => {
  it("turns the lane off when the build has no address", async () => {
    const client = await clientWith("");
    expect(client.systemEnabled()).toBe(false);
    expect(client.systemProviderEndpoint()).toBeNull();
    await expect(client.startSystemCheckout()).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("no system provider address"),
    });
  });

  it("reads the public config without sending a pass or a key", async () => {
    const client = await clientWith("https://sub.example.com/");
    const fetchMock = vi.fn(async () =>
      answer(200, { name: "Tutor", priceLabel: "5 €", checkout: true, proxy: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const facts = await client.fetchSystemConfig();
    expect(facts.name).toBe("Tutor");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sub.example.com/api/config");
    expect(init.method).toBe("GET");
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
    expect(headers["content-type"]).toBeUndefined();
    expect(client.systemProviderEndpoint()).toBe("https://sub.example.com/v1");
  });

  it("starts a checkout and returns its address", async () => {
    const client = await clientWith("https://sub.example.com");
    const fetchMock = vi.fn(async () => answer(200, { url: "https://checkout.stripe.com/c/pay/1" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(client.startSystemCheckout()).resolves.toBe("https://checkout.stripe.com/c/pay/1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sub.example.com/api/checkout");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("refuses a redirect that is not a web address", async () => {
    const client = await clientWith("https://sub.example.com");
    vi.stubGlobal("fetch", vi.fn(async () => answer(200, { url: "javascript:alert(1)" })));
    await expect(client.startSystemCheckout()).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("checkout address was missing"),
    });
  });

  it("exchanges a session for a pass, sending the pass only in the body", async () => {
    const client = await clientWith("https://sub.example.com");
    const payload = {
      license: "payload.signature",
      entitlement: { status: "active", renewsAt: 100, cancelAtPeriodEnd: false, expiresAt: 200 },
    };
    const fetchMock = vi.fn(async () => answer(200, payload));
    vi.stubGlobal("fetch", fetchMock);
    await expect(client.completeSystemCheckout("cs_test_1")).resolves.toEqual(payload);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ sessionId: "cs_test_1" });
  });

  it("shows the service's own refusal sentence and status", async () => {
    const client = await clientWith("https://sub.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => answer(402, { error: "This subscription is not active." })),
    );
    await expect(client.readSystemStatus("pass.token")).rejects.toMatchObject({
      status: 402,
      message: "This subscription is not active.",
    });
  });

  it("says the service could not be reached when the network throws", async () => {
    const client = await clientWith("https://sub.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    await expect(client.openSystemPortal("pass.token")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("could not be reached"),
    });
  });

  it("reads a refreshed pass and a portal address", async () => {
    const client = await clientWith("https://sub.example.com");
    const renamed = {
      license: "new.signature",
      entitlement: { status: "trialing", renewsAt: 300, cancelAtPeriodEnd: false, expiresAt: 400 },
    };
    vi.stubGlobal("fetch", vi.fn(async () => answer(200, renamed)));
    await expect(client.refreshSystemLicense("old.signature")).resolves.toEqual(renamed);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => answer(200, { url: "https://billing.stripe.com/p/session/1" })),
    );
    await expect(client.openSystemPortal("new.signature")).resolves.toBe(
      "https://billing.stripe.com/p/session/1",
    );
    const [, init] = (vi.mocked(fetch).mock.calls[0] ?? []) as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ license: "new.signature" });
  });
});
