// WHY: The browser store and the old local process must agree on the default
// settings shape. The pure helpers moved to settings-shape.ts; this module
// keeps the file-backed reads and writes for the archived local lane.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: pure shape extracted to settings-shape.ts and
// re-exported so existing imports and tests keep working. [pack: browser-app]

import type { Settings } from "@/lib/shared/types";
import { readJson, writeJson } from "@/lib/storage/json";
import { dataFile } from "@/lib/storage/paths";
import {
  defaultSettings,
  mergeSettings,
  normalizeSettings,
} from "@/lib/core/settings-shape";

export { defaultSettings, normalizeSettings };

/** Read the learner's settings, with defaults filled in. */
export async function readSettings(): Promise<Settings> {
  const raw = await readJson<unknown>(dataFile("settings.json"), null);
  return normalizeSettings(raw);
}

/** Change only the fields given. Everything else stays as it was. */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await readSettings();
  const merged = mergeSettings(current, patch);
  await writeJson(dataFile("settings.json"), merged);
  return merged;
}

/** Count a silent fallback and remember which algorithm ran last. */
export async function recordAlgorithmRun(
  algorithm: "default" | "fallback",
  at: string,
): Promise<Settings> {
  const current = await readSettings();
  const next: Settings = {
    ...current,
    algorithm: {
      lastAlgorithm: algorithm,
      fallbackCount: current.algorithm.fallbackCount + (algorithm === "fallback" ? 1 : 0),
      lastFallbackAt:
        algorithm === "fallback" ? at : current.algorithm.lastFallbackAt,
    },
  };
  await writeJson(dataFile("settings.json"), next);
  return next;
}
