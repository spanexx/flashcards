// WHY: The privacy promise includes a local log of what was sent. These tests
// pin that it is local, append-only and readable newest first.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { appendPromptLog, readPromptLog } from "@/lib/provider/log";
import { withDataDir } from "./helpers";

describe("prompt log", () => {
  it("keeps entries newest first", async () => {
    await withDataDir(async () => {
      await appendPromptLog({
        at: "2026-10-01T10:00:00.000Z",
        kind: "hint",
        requestId: "card:a",
        endpoint: "http://provider.test/v1",
        model: "m",
        prompt: "first",
      });
      await appendPromptLog({
        at: "2026-10-02T10:00:00.000Z",
        kind: "generation",
        requestId: "request-1",
        endpoint: "http://provider.test/v1",
        model: "m",
        prompt: "second",
      });
      const entries = await readPromptLog();
      expect(entries.map((entry) => entry.prompt)).toEqual(["second", "first"]);
    });
  });

  it("respects a limit", async () => {
    await withDataDir(async () => {
      for (let index = 0; index < 5; index += 1) {
        await appendPromptLog({
          at: `2026-10-0${index + 1}T10:00:00.000Z`,
          kind: "hint",
          requestId: `r${index}`,
          endpoint: null,
          model: null,
          prompt: `prompt ${index}`,
        });
      }
      expect(await readPromptLog(2)).toHaveLength(2);
    });
  });

  it("reads an empty log before anything is sent", async () => {
    await withDataDir(async () => {
      expect(await readPromptLog()).toEqual([]);
    });
  });
});
