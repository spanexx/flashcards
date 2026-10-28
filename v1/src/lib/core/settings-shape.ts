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
    provider: { url: "", model: "", mode: "custom", relayHosts: [] },
    algorithm: { lastAlgorithm: "default", fallbackCount: 0, lastFallbackAt: null },
  };
}

const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const STYLES = new Set(["examples-first", "rules-first", "conversation", "gentle"]);
const MAX_RELAY_HOSTS = 10;

/**
 * Keep the remembered hosts readable: lowercase, no trailing dot, no repeats,
 * ten at most with the newest first. Junk entries are dropped, never repaired
 * into something that might point somewhere else.
 */
export function normalizeRelayHosts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const name = entry.trim().toLowerCase().replace(/\.$/, "");
    if (name.length === 0 || name.length > 253) continue;
    if (!/^[a-z0-9.-]+$/.test(name) || name.includes("..")) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    kept.push(name);
    if (kept.length >= MAX_RELAY_HOSTS) break;
  }
  return kept;
}

/** The hostname a relay memory is keyed by, or null when the address is unusable. */
export function providerHost(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    return normalizeRelayHosts([parsed.hostname])[0] ?? null;
  } catch {
    return null;
  }
}

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
      // WHY: An older settings row has no mode. Custom is what it was using.
      mode: provider.mode === "system" ? "system" : "custom",
      relayHosts: normalizeRelayHosts(provider.relayHosts),
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
