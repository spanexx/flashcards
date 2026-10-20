// WHY: The key is the one secret in the app, and it must never leak into a
// status. These tests pin the precedence, the stores and the file fallback.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it, vi } from "vitest";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createKeyStore, KEY_STORE_NAMES, type CommandRunner, type KeyStoreDeps } from "@/lib/provider/keystore";
import { withTempDir } from "./helpers";

function makeDeps(dir: string, overrides: Partial<KeyStoreDeps> = {}): KeyStoreDeps {
  return {
    platform: () => "win32" as NodeJS.Platform,
    runner: async () => ({ stdout: "", stderr: "", code: 1 }),
    env: () => ({}) as unknown as NodeJS.ProcessEnv,
    file: () => path.join(dir, "secrets", "provider.key"),
    ...overrides,
  };
}

describe("key precedence", () => {
  it("prefers the environment over everything", async () => {
    await withTempDir(async (dir) => {
      const store = createKeyStore(
        makeDeps(dir, {
          env: () => ({ FLASHCARDS_PROVIDER_KEY: "env-key" }) as unknown as NodeJS.ProcessEnv,
        }),
      );
      expect(await store.getKey()).toBe("env-key");
      expect(await store.status()).toEqual({ kind: "environment", hasKey: true });
    });
  });

  it("reports nowhere yet when nothing holds a key", async () => {
    await withTempDir(async (dir) => {
      const store = createKeyStore(makeDeps(dir));
      expect(await store.getKey()).toBeNull();
      expect(await store.status()).toEqual({ kind: "none", hasKey: false });
    });
  });
});

describe("the operating system store", () => {
  it("uses the macOS keychain when it works", async () => {
    let stored: string | null = null;
    const runner: CommandRunner = vi.fn(async (_command, args) => {
      if (args.includes("add-generic-password")) {
        const value = args[args.indexOf("-w") + 1];
        stored = value;
        return { stdout: "", stderr: "", code: 0 };
      }
      if (args.includes("find-generic-password")) {
        return stored ? { stdout: `${stored}\n`, stderr: "", code: 0 } : { stdout: "", stderr: "", code: 44 };
      }
      if (args.includes("delete-generic-password")) {
        stored = null;
        return { stdout: "", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 1 };
    });
    await withTempDir(async (dir) => {
      const store = createKeyStore(makeDeps(dir, { platform: () => "darwin", runner }));
      expect(await store.setKey("mac-key")).toBe("os");
      expect(await store.getKey()).toBe("mac-key");
      expect(await store.status()).toEqual({ kind: "os", hasKey: true });
      await store.clearKey();
      expect(await store.getKey()).toBeNull();
    });
  });

  it("uses secret-tool on Linux", async () => {
    let stored: string | null = null;
    const runner: CommandRunner = vi.fn(async (_command, args, input) => {
      if (args[0] === "store") {
        stored = (input ?? "").trim();
        return { stdout: "", stderr: "", code: 0 };
      }
      if (args[0] === "lookup") {
        return stored ? { stdout: `${stored}\n`, stderr: "", code: 0 } : { stdout: "", stderr: "", code: 1 };
      }
      if (args[0] === "clear") {
        stored = null;
        return { stdout: "", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 1 };
    });
    await withTempDir(async (dir) => {
      const store = createKeyStore(makeDeps(dir, { platform: () => "linux", runner }));
      expect(await store.setKey("linux-key")).toBe("os");
      expect(await store.getKey()).toBe("linux-key");
      await store.clearKey();
      expect(await store.getKey()).toBeNull();
    });
  });
});

describe("the private file fallback", () => {
  it("writes and reads the file when no OS store exists", async () => {
    await withTempDir(async (dir) => {
      const store = createKeyStore(makeDeps(dir));
      expect(await store.setKey("file-key")).toBe("file");
      expect(await store.getKey()).toBe("file-key");
      expect(await store.status()).toEqual({ kind: "file", hasKey: true });

      const file = path.join(dir, "secrets", "provider.key");
      expect((await readFile(file, "utf8")).trim()).toBe("file-key");
      const mode = (await stat(file)).mode & 0o777;
      if (process.platform !== "win32") expect(mode).toBe(0o600);
    });
  });

  it("treats an empty value as a clear", async () => {
    await withTempDir(async (dir) => {
      const store = createKeyStore(makeDeps(dir));
      await store.setKey("file-key");
      expect(await store.setKey("   ")).toBe("none");
      expect(await store.getKey()).toBeNull();
    });
  });

  it("clears the file on request", async () => {
    await withTempDir(async (dir) => {
      const store = createKeyStore(makeDeps(dir));
      await store.setKey("file-key");
      await store.clearKey();
      expect(await store.status()).toEqual({ kind: "none", hasKey: false });
    });
  });
});

describe("store names", () => {
  it("says where a key lives in plain words", () => {
    expect(KEY_STORE_NAMES.environment).toContain("environment");
    expect(KEY_STORE_NAMES.os).toContain("key store");
    expect(KEY_STORE_NAMES.file).toContain("private file");
    expect(KEY_STORE_NAMES.none).toContain("nowhere");
  });
});
