// WHY: Endpoint, model and key are resolved at call time, and a loopback
// address inside WSL is swapped for the Windows host. These tests pin it all.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import {
  getProviderConfig,
  keyStoreName,
  parseDefaultGateway,
  pointsAtLoopback,
  providerStatus,
  swapLoopbackForHost,
} from "@/lib/provider/config";
import { withDataDir } from "./helpers";

describe("parseDefaultGateway", () => {
  const ROUTE_HEADER = "Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT";

  it("reads the gateway and reverses the little-endian bytes", () => {
    // 0170A8AC reversed is AC A8 70 01, i.e. 172.168.112.1.
    const text = `${ROUTE_HEADER}\neth0\t00000000\t0170A8AC\t0003\t0\t0\t0\t00000000\t0\t0\t0\n`;
    expect(parseDefaultGateway(text)).toBe("172.168.112.1");
  });

  it("ignores non-default routes and malformed lines", () => {
    const text = `${ROUTE_HEADER}\neth0\t0000A8C0\t00000000\t0001\t0\t0\t0\t00FFFFFF\t0\t0\t0\nbogus line\neth0\t00000000\tNOTHEX00\t0003\t0\t0\t0\t00000000\t0\t0\t0\n`;
    expect(parseDefaultGateway(text)).toBeNull();
  });
});

describe("pointsAtLoopback", () => {
  it("recognises every loopback spelling", () => {
    expect(pointsAtLoopback("http://localhost:11434/v1")).toBe(true);
    expect(pointsAtLoopback("http://127.0.0.1:8080")).toBe(true);
    expect(pointsAtLoopback("http://[::1]:8080/v1")).toBe(true);
    expect(pointsAtLoopback("http://example.test/v1")).toBe(false);
    expect(pointsAtLoopback("not a url")).toBe(false);
  });
});

describe("swapLoopbackForHost", () => {
  it("swaps a loopback host, keeping the port and path", () => {
    const swapped = swapLoopbackForHost("http://localhost:11434/v1", "10.4.3.2");
    expect(swapped.swapped).toBe(true);
    expect(swapped.url).toBe("http://10.4.3.2:11434/v1");
  });

  it("leaves a real address alone", () => {
    const same = swapLoopbackForHost("http://example.test/v1", "10.4.3.2");
    expect(same.swapped).toBe(false);
    expect(same.url).toBe("http://example.test/v1");
  });

  it("does nothing without a host address", () => {
    const same = swapLoopbackForHost("http://localhost:11434/v1", null);
    expect(same.swapped).toBe(false);
  });
});

describe("getProviderConfig", () => {
  it("refuses politely when nothing is set up", async () => {
    await withDataDir(async () => {
      const result = await getProviderConfig();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("No provider is set up");
    });
  });

  it("refuses when a provider is set but no key is stored", async () => {
    await withDataDir(async () => {
      process.env.FLASHCARDS_PROVIDER_URL = "http://example.test/v1";
      process.env.FLASHCARDS_PROVIDER_MODEL = "some-model";
      const result = await getProviderConfig();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("no key is stored");
    });
  });

  it("returns the resolved configuration when everything is present", async () => {
    await withDataDir(async () => {
      process.env.FLASHCARDS_PROVIDER_URL = "http://example.test/v1";
      process.env.FLASHCARDS_PROVIDER_MODEL = "some-model";
      process.env.FLASHCARDS_PROVIDER_KEY = "test-key";
      const result = await getProviderConfig();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.config.url).toBe("http://example.test/v1");
        expect(result.config.model).toBe("some-model");
        expect(result.config.key).toBe("test-key");
      }
    });
  });
});

describe("providerStatus", () => {
  it("says no provider is set up", async () => {
    await withDataDir(async () => {
      const status = await providerStatus();
      expect(status.configured).toBe(false);
      expect(status.hasKey).toBe(false);
      expect(status.message).toContain("No provider is set up");
    });
  });

  it("says a key is missing when the address is set alone", async () => {
    await withDataDir(async () => {
      process.env.FLASHCARDS_PROVIDER_URL = "http://example.test/v1";
      process.env.FLASHCARDS_PROVIDER_MODEL = "m";
      const status = await providerStatus();
      expect(status.configured).toBe(true);
      expect(status.hasKey).toBe(false);
      expect(status.message).toContain("no key is stored");
    });
  });

  it("says ready without ever naming the key", async () => {
    await withDataDir(async () => {
      process.env.FLASHCARDS_PROVIDER_URL = "http://example.test/v1";
      process.env.FLASHCARDS_PROVIDER_MODEL = "m";
      process.env.FLASHCARDS_PROVIDER_KEY = "super-secret-value";
      const status = await providerStatus();
      expect(status.configured).toBe(true);
      expect(status.hasKey).toBe(true);
      expect(status.keyStore).toBe("environment");
      expect(status.message).toContain("ready");
      expect(JSON.stringify(status)).not.toContain("super-secret-value");
      expect(await keyStoreName()).toContain("environment");
    });
  });
});
