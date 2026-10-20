// WHY: The browser and the old local process must normalize the learner's
// settings the same way. This module is the pure shape: defaults and safe
// repairs, with no file or database access, so IndexedDB and a test can use it.
// PACK: browser-app
// 2026-10-20 opencode: split out of core/settings.ts for the browser build.

import type { Settings } from "@/lib/shared/types";

/** The starting settings for a learner who has never opened settings. */
export function defaultSettings(): Settings {
  return {
    version: 1,
    level: "beginner",
    learningStyle: "examples-first",
    provider: { url: "", model: "" },
    algorithm: { lastAlgorithm: "default", fallbackCount: 0, lastFallbackAt: null },
  };
}

const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const STYLES = new Set(["examples-first", "rules-first", "conversation", "gentle"]);

/** Keep stored settings readable even after a hand edit or an old version. */
export function normalizeSettings(raw: unknown): Settings {
  const fallback = defaultSettings();
  if (raw === null || typeof raw !== "object") return fallback;
  const record = raw as Record<string, unknown>;
  const provider = (record.provider ?? {}) as Record<string, unknown>;
  const algorithm = (record.algorithm ?? {}) as Record<string, unknown>;
  return {
    version: typeof record.version === "number" ? record.version : fallback.version,
    level: LEVELS.has(String(record.level)) ? (record.level as Settings["level"]) : fallback.level,
    learningStyle: STYLES.has(String(record.learningStyle))
      ? (record.learningStyle as Settings["learningStyle"])
      : fallback.learningStyle,
    provider: {
      url: typeof provider.url === "string" ? provider.url : "",
      model: typeof provider.model === "string" ? provider.model : "",
    },
    algorithm: {
      lastAlgorithm: algorithm.lastAlgorithm === "fallback" ? "fallback" : "default",
      fallbackCount:
        typeof algorithm.fallbackCount === "number" && algorithm.fallbackCount >= 0
          ? Math.floor(algorithm.fallbackCount)
          : 0,
      lastFallbackAt:
        typeof algorithm.lastFallbackAt === "string" ? algorithm.lastFallbackAt : null,
    },
  };
}

/** Merge a patch over the current settings without losing untouched fields. */
export function mergeSettings(current: Settings, patch: Partial<Settings>): Settings {
  return normalizeSettings({
    ...current,
    ...patch,
    provider: { ...current.provider, ...(patch.provider ?? {}) },
    algorithm: { ...current.algorithm, ...(patch.algorithm ?? {}) },
  });
}
