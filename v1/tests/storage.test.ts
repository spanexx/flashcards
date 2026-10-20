// WHY: Learner data must survive restarts, crashes and half-writes. These
// tests pin the small storage promises behind that.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readJson, writeJson } from "@/lib/storage/json";
import { appendJsonl, appendJsonlMany, readJsonl, writeJsonl } from "@/lib/storage/jsonl";
import { withLock } from "@/lib/storage/mutex";
import { dataFile, ensureDir, getDataDir, getPacksDir, resolveDir } from "@/lib/storage/paths";
import { withDataDir, withTempDir } from "./helpers";

describe("paths", () => {
  it("keeps absolute paths and resolves relative ones against the project", () => {
    const absolute = path.resolve(process.cwd(), "somewhere-absolute");
    expect(resolveDir(absolute, "data")).toBe(absolute);
    expect(resolveDir("custom", "data")).toBe(path.resolve(process.cwd(), "custom"));
    expect(resolveDir(undefined, "data")).toBe(path.resolve(process.cwd(), "data"));
    expect(resolveDir("   ", "data")).toBe(path.resolve(process.cwd(), "data"));
  });

  it("reads folders from the environment at call time", async () => {
    await withDataDir(async (dir) => {
      expect(getDataDir()).toBe(path.join(dir, "data"));
      expect(getPacksDir()).toBe(path.join(dir, "packs"));
      expect(dataFile("cards.json")).toBe(path.join(dir, "data", "cards.json"));
    });
  });

  it("creates a folder including parents", async () => {
    await withTempDir(async (dir) => {
      const target = path.join(dir, "a", "b", "c");
      await ensureDir(target);
      await expect(readdir(target)).resolves.toEqual([]);
    });
  });
});

describe("mutex", () => {
  it("runs jobs for one key one at a time, in order", async () => {
    const order: string[] = [];
    const first = withLock("same", async () => {
      order.push("first-start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push("first-end");
    });
    const second = withLock("same", async () => {
      order.push("second-start");
      order.push("second-end");
    });
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second-start", "second-end"]);
  });

  it("keeps a failed job from blocking the next one", async () => {
    await expect(
      withLock("failure", async () => {
        throw new Error("job failed");
      }),
    ).rejects.toThrow("job failed");
    await expect(withLock("failure", async () => "next")).resolves.toBe("next");
  });
});

describe("json files", () => {
  it("returns the fallback when the file is missing", async () => {
    await withTempDir(async (dir) => {
      expect(await readJson(path.join(dir, "none.json"), { ok: true })).toEqual({ ok: true });
    });
  });

  it("writes whole and reads back", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "nested", "value.json");
      await writeJson(file, { count: 2 });
      expect(await readJson(file, null)).toEqual({ count: 2 });
    });
  });

  it("replaces an existing file on a second write", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "value.json");
      await writeJson(file, { version: 1 });
      await writeJson(file, { version: 2 });
      expect(await readJson(file, null)).toEqual({ version: 2 });
    });
  });

  it("keeps a damaged file for inspection and starts from the fallback", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "broken.json");
      await writeFile(file, "{not json", "utf8");
      expect(await readJson(file, "fallback")).toBe("fallback");
      const entries = await readdir(dir);
      expect(entries.some((entry) => entry.startsWith("broken.json.broken-"))).toBe(true);
    });
  });
});

describe("jsonl files", () => {
  it("reads an empty list from a missing file", async () => {
    await withTempDir(async (dir) => {
      expect(await readJsonl(path.join(dir, "none.jsonl"))).toEqual([]);
    });
  });

  it("appends without rewriting earlier lines", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "rows.jsonl");
      await appendJsonl(file, { n: 1 });
      await appendJsonl(file, { n: 2 });
      await appendJsonlMany(file, [{ n: 3 }, { n: 4 }]);
      const rows = await readJsonl<{ n: number }>(file);
      expect(rows.map((row) => row.n)).toEqual([1, 2, 3, 4]);
    });
  });

  it("skips a damaged line instead of failing the read", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "rows.jsonl");
      await writeFile(file, '{"n":1}\nnot json\n{"n":2}\n', "utf8");
      const rows = await readJsonl<{ n: number }>(file);
      expect(rows.map((row) => row.n)).toEqual([1, 2]);
    });
  });

  it("rewrites a whole file when deliberately asked", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "rows.jsonl");
      await appendJsonlMany(file, [{ n: 1 }, { n: 2 }]);
      await writeJsonl(file, [{ n: 9 }]);
      expect(await readJsonl<{ n: number }>(file)).toEqual([{ n: 9 }]);
    });
  });

  it("writes readable JSON per line", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "rows.jsonl");
      await appendJsonl(file, { n: 1 });
      const text = await readFile(file, "utf8");
      expect(text).toBe('{"n":1}\n');
    });
  });
});
