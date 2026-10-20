// WHY: The provider key is the one secret in the app. It lives on the local
// machine, in the OS key store where a safe adapter exists, otherwise in a
// private file, and it is never returned to the browser. The app names which
// store it is using so the learner is never guessing.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import "server-only";
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { keyFallbackFile } from "@/lib/storage/paths";

/** The three places a key can live. "none" means the learner has not set one. */
export type KeyStoreKind = "environment" | "os" | "file" | "none";

/** Plain names for the settings screen. */
export const KEY_STORE_NAMES: Record<KeyStoreKind, string> = {
  environment: "the FLASHCARDS_PROVIDER_KEY environment setting",
  os: "the operating system key store",
  file: "a private file in the data folder",
  none: "nowhere yet",
};

/** What a command run returns; a missing command is a result, not a crash. */
export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export type CommandRunner = (
  command: string,
  args: string[],
  input?: string,
) => Promise<CommandResult>;

/** Run one command without a shell, so arguments cannot be reinterpreted. */
const defaultRunner: CommandRunner = (command, args, input) =>
  new Promise((resolve) => {
    const child = execFile(command, args, { timeout: 8000 }, (error, stdout, stderr) => {
      const code = error && "code" in error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "", code });
    });
    if (input !== undefined && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });

/** Everything the key store needs. Tests replace each piece. */
export interface KeyStoreDeps {
  platform: () => NodeJS.Platform;
  runner: CommandRunner;
  env: () => NodeJS.ProcessEnv;
  file: () => string;
}

const defaultDeps: KeyStoreDeps = {
  platform: () => process.platform,
  runner: defaultRunner,
  env: () => process.env,
  file: () => keyFallbackFile(),
};

/** The service name every adapter uses, so the key is findable by a person. */
const SERVICE = "flashcards-provider";
const ACCOUNT = "flashcards";

/** Read the private fallback file, or null when it is missing or empty. */
async function readFileKey(file: string): Promise<string | null> {
  try {
    const value = (await readFile(file, "utf8")).trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Write the private fallback file and make it owner-only where the OS allows. */
async function writeFileKey(file: string, key: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${key.trim()}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(file, 0o600).catch(() => undefined);
}

/** The OS key store, where a command-line adapter exists. */
function osStore(deps: KeyStoreDeps) {
  const platform = deps.platform();

  return {
    name: platform as string,
    async read(): Promise<string | null> {
      if (platform === "darwin") {
        const result = await deps.runner(
          "security",
          ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"],
        );
        return result.code === 0 ? result.stdout.trim() || null : null;
      }
      if (platform === "linux") {
        const result = await deps.runner("secret-tool", [
          "lookup",
          "service",
          SERVICE,
          "account",
          ACCOUNT,
        ]);
        return result.code === 0 ? result.stdout.trim() || null : null;
      }
      // Windows has no built-in command that reads a stored secret back, so the
      // file fallback is the honest choice there.
      return null;
    },
    async write(key: string): Promise<boolean> {
      if (platform === "darwin") {
        const result = await deps.runner("security", [
          "add-generic-password",
          "-U",
          "-s",
          SERVICE,
          "-a",
          ACCOUNT,
          "-w",
          key,
        ]);
        return result.code === 0;
      }
      if (platform === "linux") {
        const result = await deps.runner(
          "secret-tool",
          ["store", "--label=Flashcards provider", "service", SERVICE, "account", ACCOUNT],
          `${key}\n`,
        );
        return result.code === 0;
      }
      return false;
    },
    async clear(): Promise<boolean> {
      if (platform === "darwin") {
        const result = await deps.runner("security", [
          "delete-generic-password",
          "-s",
          SERVICE,
          "-a",
          ACCOUNT,
        ]);
        return result.code === 0;
      }
      if (platform === "linux") {
        const result = await deps.runner("secret-tool", [
          "clear",
          "service",
          SERVICE,
          "account",
          ACCOUNT,
        ]);
        return result.code === 0;
      }
      return false;
    },
  };
}

/** Build a key store. The default reads the environment at call time. */
export function createKeyStore(deps: KeyStoreDeps = defaultDeps) {
  return {
    /** The key, or null. Environment wins, then the OS store, then the file. */
    async getKey(): Promise<string | null> {
      const fromEnv = deps.env().FLASHCARDS_PROVIDER_KEY?.trim();
      if (fromEnv) return fromEnv;
      const fromOs = await osStore(deps).read();
      if (fromOs) return fromOs;
      return readFileKey(deps.file());
    },

    /** Store a key. Returns the store that actually holds it. */
    async setKey(key: string): Promise<KeyStoreKind> {
      const trimmed = key.trim();
      if (trimmed.length === 0) {
        await this.clearKey();
        return "none";
      }
      const storedInOs = await osStore(deps).write(trimmed);
      if (storedInOs && (await osStore(deps).read()) === trimmed) return "os";
      await writeFileKey(deps.file(), trimmed);
      return "file";
    },

    /** Remove the key from every store this process can reach. */
    async clearKey(): Promise<void> {
      await osStore(deps).clear();
      await rm(deps.file(), { force: true }).catch(() => undefined);
    },

    /** Which store is in use right now, and whether a key exists at all. */
    async status(): Promise<{ kind: KeyStoreKind; hasKey: boolean }> {
      if (deps.env().FLASHCARDS_PROVIDER_KEY?.trim()) {
        return { kind: "environment", hasKey: true };
      }
      if (await osStore(deps).read()) return { kind: "os", hasKey: true };
      if (await readFileKey(deps.file())) return { kind: "file", hasKey: true };
      return { kind: "none", hasKey: false };
    },
  };
}

/** The application's key store. */
export const keyStore = createKeyStore();
