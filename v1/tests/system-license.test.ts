// WHY: The subscription pass is a browser secret like the provider key: it is
// kept in IndexedDB, never shown back, and never written into a backup. These
// tests pin that storage contract.
// PACK: system-provider-subscription
// 2026-10-28 qoder: created for the paid system provider. [pack: system-provider-subscription]

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setBrowserStore } from "@/lib/browser/store";
import {
  clearSystemLicense,
  readProviderKey,
  readSettings,
  readSystemLicense,
  writeProviderKey,
  writeSystemLicense,
} from "@/lib/browser/repository";
import { applyBackup, buildBackup, parseBackup } from "@/lib/browser/bundle";

const FUTURE = 1_800_000_000_000;

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
});

afterEach(() => {
  setBrowserStore(null);
});

describe("the subscription pass", () => {
  it("round-trips a pass and its expiry", async () => {
    expect(await readSystemLicense()).toBeNull();
    await writeSystemLicense("payload.signature", 1_800_000_000_000);
    expect(await readSystemLicense()).toEqual({
      license: "payload.signature",
      expiresAt: 1_800_000_000_000,
    });
    await writeSystemLicense("next.signature", 1_800_100_000_000);
    expect((await readSystemLicense())?.license).toBe("next.signature");
  });

  it("ignores a damaged row instead of guessing", async () => {
    await store.put("settings", { id: "system-license", license: "", expiresAt: 1 });
    expect(await readSystemLicense()).toBeNull();
    await store.put("settings", { id: "system-license", license: "a.b", expiresAt: "soon" });
    expect(await readSystemLicense()).toBeNull();
  });

  it("clears the pass on request", async () => {
    await writeSystemLicense("payload.signature", 1_800_000_000_000);
    await clearSystemLicense();
    expect(await readSystemLicense()).toBeNull();
  });
});

describe("backups", () => {
  it("never carry the pass or the provider key", async () => {
    await writeProviderKey("provider-secret", store);
    await writeSystemLicense("subscription-pass-value", FUTURE);
    const content = await buildBackup();
    expect(content.json).not.toContain("provider-secret");
    expect(content.json).not.toContain("subscription-pass-value");
    expect((await readSettings()).provider.mode).toBe("custom");
  });

  it("leave the pass and the provider key in this browser after a restore", async () => {
    await writeProviderKey("provider-secret", store);
    await writeSystemLicense("subscription-pass-value", FUTURE);
    const parsed = parseBackup((await buildBackup()).json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await applyBackup(parsed.backup);
    expect(result.ok).toBe(true);
    expect(await readProviderKey(store)).toBe("provider-secret");
    expect(await readSystemLicense()).toEqual({
      license: "subscription-pass-value",
      expiresAt: FUTURE,
    });
  });
});
