// WHY: Settings survive hand edits and old versions. These tests pin the
// normalizing and the algorithm receipt.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  normalizeSettings,
  readSettings,
  recordAlgorithmRun,
  updateSettings,
} from "@/lib/core/settings";
import { writeJson } from "@/lib/storage/json";
import { dataFile } from "@/lib/storage/paths";
import { withDataDir } from "./helpers";

describe("normalizeSettings", () => {
  it("returns defaults for junk", () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings());
    expect(normalizeSettings("nonsense")).toEqual(defaultSettings());
  });

  it("keeps good values and repairs bad ones", () => {
    const settings = normalizeSettings({
      version: 2,
      level: "advanced",
      learningStyle: "not-a-style",
      provider: { url: "http://localhost:11434/v1", model: 7 },
      algorithm: { lastAlgorithm: "fallback", fallbackCount: -3, lastFallbackAt: 5 },
    });
    expect(settings.version).toBe(2);
    expect(settings.level).toBe("advanced");
    expect(settings.learningStyle).toBe("examples-first");
    expect(settings.provider.url).toBe("http://localhost:11434/v1");
    expect(settings.provider.model).toBe("");
    expect(settings.algorithm.lastAlgorithm).toBe("fallback");
    expect(settings.algorithm.fallbackCount).toBe(0);
    expect(settings.algorithm.lastFallbackAt).toBeNull();
  });
});

describe("settings on disk", () => {
  it("reads defaults when no file exists", async () => {
    await withDataDir(async () => {
      expect(await readSettings()).toEqual(defaultSettings());
    });
  });

  it("merges a patch without dropping other fields", async () => {
    await withDataDir(async () => {
      await updateSettings({ level: "intermediate" });
      const merged = await updateSettings({ provider: { url: "u", model: "m" } });
      expect(merged.level).toBe("intermediate");
      expect(merged.provider).toEqual({ url: "u", model: "m", mode: "custom" });
    });
  });

  it("counts fallbacks and remembers which algorithm ran last", async () => {
    await withDataDir(async () => {
      await recordAlgorithmRun("fallback", "2026-10-01T10:00:00.000Z");
      const second = await recordAlgorithmRun("fallback", "2026-10-02T10:00:00.000Z");
      expect(second.algorithm.fallbackCount).toBe(2);
      expect(second.algorithm.lastFallbackAt).toBe("2026-10-02T10:00:00.000Z");

      const back = await recordAlgorithmRun("default", "2026-10-03T10:00:00.000Z");
      expect(back.algorithm.lastAlgorithm).toBe("default");
      expect(back.algorithm.fallbackCount).toBe(2);
    });
  });

  it("survives a damaged settings file", async () => {
    await withDataDir(async () => {
      await writeJson(dataFile("settings.json"), null);
      const settings = await readSettings();
      expect(settings.level).toBe("beginner");
    });
  });
});
