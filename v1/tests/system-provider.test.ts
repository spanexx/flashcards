// WHY: The learner's provider lane is a choice between their own key and a
// paid pass. These tests pin which lane answers, what the refusal says, and
// that switching lanes never moves a key into the page.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const FUTURE = 1_900_000_000_000;

let storeModule: typeof import("@/lib/browser/store");
let repository: typeof import("@/lib/browser/repository");
let provider: typeof import("@/lib/browser/provider");

/** One module graph with the paid lane enabled, shared by the tests below. */
beforeAll(async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SYSTEM_API_BASE", "https://sub.example.com");
  storeModule = await import("@/lib/browser/store");
  repository = await import("@/lib/browser/repository");
  provider = await import("@/lib/browser/provider");
}, 20000);

beforeEach(() => {
  storeModule.setBrowserStore(new storeModule.MemoryStore());
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("which lane answers", () => {
  it("keeps the learner's own provider when the mode is custom", async () => {
    await repository.patchSettings({
      provider: { url: "https://provider.test/v1", model: "test-model", mode: "custom" },
    });
    await repository.writeProviderKey("own-key");

    expect(await provider.providerConfig()).toEqual({
      ok: true,
      config: {
        url: "https://provider.test/v1",
        model: "test-model",
        key: "own-key",
        swappedForWsl: false,
        relayBase: "https://sub.example.com",
      },
    });
    expect(await provider.browserProviderStatus()).toMatchObject({
      mode: "custom",
      configured: true,
      hasKey: true,
      model: "test-model",
    });
  });

  it("uses the pass and the service address in system mode", async () => {
    await repository.patchSettings({
      provider: { url: "", model: "", mode: "system" },
    });
    await repository.writeSystemLicense("pass.signature", FUTURE);

    expect(await provider.providerConfig()).toEqual({
      ok: true,
      config: {
        url: "https://sub.example.com/v1",
        model: "system",
        key: "pass.signature",
        swappedForWsl: false,
      },
    });
    expect(await provider.browserProviderStatus()).toMatchObject({
      mode: "system",
      configured: true,
      hasKey: true,
      endpoint: "https://sub.example.com/v1",
      model: "system",
      keyStore: "browser",
    });
  });

  it("refuses to call the system provider without a pass", async () => {
    await repository.patchSettings({
      provider: { url: "", model: "", mode: "system" },
    });

    expect(await provider.providerConfig()).toEqual({
      ok: false,
      message: "The system provider needs a subscription. Open settings and subscribe.",
    });
    expect(await provider.browserProviderStatus()).toMatchObject({
      mode: "system",
      configured: true,
      hasKey: false,
    });
  });

  it(
    "refuses a system mode the build cannot serve",
    async () => {
      // A build made without the address has its own module graph.
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_SYSTEM_API_BASE", "");
      const freshStore = await import("@/lib/browser/store");
      freshStore.setBrowserStore(new freshStore.MemoryStore());
      const freshRepository = await import("@/lib/browser/repository");
      const freshProvider = await import("@/lib/browser/provider");
      await freshRepository.patchSettings({
        provider: { url: "", model: "", mode: "system" },
      });
      await freshRepository.writeSystemLicense("pass.signature", FUTURE);

      expect(await freshProvider.providerConfig()).toEqual({
        ok: false,
        message: "This build has no system provider address. Use your own provider.",
      });
      expect(await freshProvider.browserProviderStatus()).toMatchObject({
        mode: "system",
        configured: false,
        endpoint: null,
        model: null,
      });
    },
    20000,
  );

  it("ignores a stored pass while the custom lane is chosen", async () => {
    await repository.patchSettings({
      provider: { url: "https://provider.test/v1", model: "test-model", mode: "custom" },
    });
    await repository.writeProviderKey("own-key");
    await repository.writeSystemLicense("pass.signature", FUTURE);

    const result = await provider.providerConfig();
    expect(result.ok && result.config.key).toBe("own-key");
  });

  it("prefers the relay for a host it remembers", async () => {
    await repository.patchSettings({
      provider: { url: "https://provider.test/v1", model: "test-model", mode: "custom" },
    });
    await repository.writeProviderKey("own-key");
    await repository.rememberRelayHost("PROVIDER.test.");

    expect(await provider.providerConfig()).toMatchObject({
      ok: true,
      config: { relayBase: "https://sub.example.com", preferRelay: true },
    });
    const status = await provider.browserProviderStatus();
    expect(status).toMatchObject({ relay: true });
    expect(status.message).toContain("relay");
    expect(status.message).toContain("not stored");
  });

  it("never gives the system lane a relay base", async () => {
    await repository.patchSettings({ provider: { url: "", model: "", mode: "system" } });
    await repository.writeSystemLicense("pass.signature", FUTURE);
    const result = await provider.providerConfig();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.relayBase).toBeUndefined();
    expect(result.config.preferRelay).toBeUndefined();
  });
});
