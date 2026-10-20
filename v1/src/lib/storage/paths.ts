// WHY: Nothing may be hardcoded to one machine, so every folder is read fresh
// from the environment at call time and resolved against the running project.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { mkdir } from "node:fs/promises";
import path from "node:path";

/** The application's working folder: the v1 project itself. */
export function projectRoot(): string {
  return process.cwd();
}

/**
 * A folder setting: absolute paths are kept, relative paths sit by the project.
 * The turbopackIgnore comments keep the build from tracing the whole project
 * just because these paths are only known at run time.
 */
export function resolveDir(value: string | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return path.resolve(/* turbopackIgnore: true */ projectRoot(), fallback);
  }
  return path.isAbsolute(value) ? value : path.resolve(/* turbopackIgnore: true */ projectRoot(), value);
}

/** Where learner data lives. Set by FLASHCARDS_DATA_DIR, default v1/data. */
export function getDataDir(): string {
  return resolveDir(process.env.FLASHCARDS_DATA_DIR, "data");
}

/** The one folder the core treats as the pack library. */
export function getPacksDir(): string {
  return resolveDir(process.env.FLASHCARDS_PACKS_DIR, "packs");
}

/** A named file inside the data folder. */
export function dataFile(name: string): string {
  return path.join(/* turbopackIgnore: true */ getDataDir(), name);
}

/** The fallback secret file, used only when no OS key store adapter exists. */
export function keyFallbackFile(): string {
  return path.join(/* turbopackIgnore: true */ getDataDir(), "secrets", "provider.key");
}

/** Make a folder, including parents, only if it is missing. */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}
