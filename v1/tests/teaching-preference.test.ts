// WHY: The beginner layer opens by itself only while the learner wants it. That
// promise rests on one storage key, one default and one pure decision, so all
// three are pinned here without a browser.
// PACK: study-resilience
// 2026-10-26 qoder: created for the study-resilience pack [pack: study-resilience]

import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEACHING_PREFS,
  TEACHING_KEY,
  readTeachingPrefs,
  writeTeachingAutoOpen,
} from "@/lib/client/teaching";
import { autoOpenPolicy, layerPolicy } from "@/lib/client/layer";

function memoryStorage(seed?: string) {
  const values = new Map<string, string>();
  if (seed !== undefined) values.set(TEACHING_KEY, seed);
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("the teaching preference", () => {
  it("opens by default on a fresh device", () => {
    expect(DEFAULT_TEACHING_PREFS).toEqual({ autoOpen: true });
    expect(readTeachingPrefs(memoryStorage())).toEqual({ autoOpen: true });
    expect(readTeachingPrefs(null)).toEqual({ autoOpen: true });
  });

  it("writes and reads the learner's choice under its own key", () => {
    const storage = memoryStorage();
    writeTeachingAutoOpen(false, storage);
    expect(storage.values.get(TEACHING_KEY)).toBe('{"autoOpen":false}');
    expect(readTeachingPrefs(storage)).toEqual({ autoOpen: false });

    writeTeachingAutoOpen(true, storage);
    expect(readTeachingPrefs(storage)).toEqual({ autoOpen: true });
  });

  it("treats invalid JSON and the wrong shape as the default", () => {
    for (const raw of [
      "not json",
      "null",
      "[]",
      '"on"',
      "{}",
      '{"autoOpen":"no"}',
      '{"autoOpen":0}',
      '{"other":true}',
    ]) {
      expect(readTeachingPrefs(memoryStorage(raw))).toEqual({ autoOpen: true });
    }
  });

  it("survives a blocked store in both directions", () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: (): void => {
        throw new Error("blocked");
      },
    };
    expect(readTeachingPrefs(blocked)).toEqual({ autoOpen: true });
    expect(() => writeTeachingAutoOpen(false, blocked)).not.toThrow();
  });
});

describe("the automatic opening decision", () => {
  const beginner = layerPolicy("beginner", true);
  const intermediate = layerPolicy("intermediate", true);
  const advanced = layerPolicy("advanced", true);
  const bare = layerPolicy("beginner", false);

  it("opens a beginner layer only while automatic opening is on", () => {
    expect(autoOpenPolicy(beginner, true)).toBe("open");
    expect(autoOpenPolicy(beginner, false)).toBe("folded");
  });

  it("leaves intermediate, advanced and layerless cards unchanged either way", () => {
    for (const policy of [intermediate, advanced, bare]) {
      expect(autoOpenPolicy(policy, true)).toBe(policy.before);
      expect(autoOpenPolicy(policy, false)).toBe(policy.before);
    }
    expect(autoOpenPolicy(intermediate, false)).toBe("folded");
    expect(autoOpenPolicy(advanced, false)).toBe("hidden");
    expect(autoOpenPolicy(bare, false)).toBe("hidden");
  });
});
