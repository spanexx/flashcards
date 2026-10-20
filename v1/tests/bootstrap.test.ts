// WHY: Boot is the one place folders, packs and the learner's cards meet. The
// order matters: a broken pack must never cost the learner a card or a row.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { afterEach, describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureBootstrapped, loadCards, resetBootstrapCache, saveCards } from "@/lib/bootstrap";
import { withDataDir, makeCard, makeSource } from "./helpers";

async function writePack(packsDir: string, folder: string, manifest: Record<string, unknown>): Promise<void> {
  const home = path.join(packsDir, folder);
  await mkdir(home, { recursive: true });
  await writeFile(path.join(home, "pack.json"), JSON.stringify(manifest), "utf8");
  await writeFile(
    path.join(home, "cards.json"),
    JSON.stringify({ cards: [makeSource()] }),
    "utf8",
  );
}

const MANIFEST = {
  name: "boot-pack",
  version: "1.0.0",
  topics: ["cases"],
  topicLabels: { cases: "Cases" },
};

afterEach(() => {
  resetBootstrapCache();
});

describe("ensureBootstrapped", () => {
  it("creates the folders, adopts the pack and writes the learner's card file", async () => {
    await withDataDir(async (dir) => {
      await writePack(path.join(dir, "packs"), "boot-pack", MANIFEST);
      const state = await ensureBootstrapped();
      expect(state.cards).toHaveLength(1);
      expect(state.statuses[0].name).toBe("boot-pack");
      expect(state.topicLabels.cases).toBe("Cases");
      expect(state.orphanedPacks).toEqual([]);
      expect(state.packsDir).toBe(path.join(dir, "packs"));

      const saved = JSON.parse(await readFile(path.join(dir, "data", "cards.json"), "utf8"));
      expect(saved.cards).toHaveLength(1);

      const statusFile = JSON.parse(await readFile(path.join(dir, "data", "pack-status.json"), "utf8"));
      expect(statusFile.statuses[0].name).toBe("boot-pack");
    });
  });

  it("caches a boot until it is forced or reset", async () => {
    await withDataDir(async (dir) => {
      await writePack(path.join(dir, "packs"), "boot-pack", MANIFEST);
      await ensureBootstrapped();
      await writePack(path.join(dir, "packs"), "second-pack", { ...MANIFEST, name: "second-pack" });

      const cached = await ensureBootstrapped();
      expect(cached.statuses).toHaveLength(1);

      const forced = await ensureBootstrapped(true);
      expect(forced.statuses).toHaveLength(2);

      resetBootstrapCache();
      const again = await ensureBootstrapped();
      expect(again.statuses).toHaveLength(2);
    });
  });

  it("names a broken pack and still keeps working", async () => {
    await withDataDir(async (dir) => {
      await writePack(path.join(dir, "packs"), "boot-pack", MANIFEST);
      const broken = path.join(dir, "packs", "broken-pack");
      await mkdir(broken, { recursive: true });
      await writeFile(path.join(broken, "pack.json"), "{oops", "utf8");

      const state = await ensureBootstrapped();
      const status = state.statuses.find((entry) => entry.name === "broken-pack");
      expect(status?.error).toContain("not valid JSON");
      expect(state.cards).toHaveLength(1);
    });
  });

  it("reports an orphan when a previously adopted pack folder is gone", async () => {
    await withDataDir(async (dir) => {
      await writePack(path.join(dir, "packs"), "boot-pack", MANIFEST);
      await ensureBootstrapped();
      const cards = await loadCards();
      expect(cards).toHaveLength(1);

      const { rm } = await import("node:fs/promises");
      await rm(path.join(dir, "packs", "boot-pack"), { recursive: true, force: true });
      resetBootstrapCache();
      const state = await ensureBootstrapped();
      expect(state.orphanedPacks).toContain("boot-pack");
      expect(state.cards).toHaveLength(1);
    });
  });

  it("keeps an empty start calm: no packs, no cards, no errors", async () => {
    await withDataDir(async () => {
      const state = await ensureBootstrapped();
      expect(state.cards).toEqual([]);
      expect(state.statuses).toEqual([]);
      expect(state.orphanedPacks).toEqual([]);
    });
  });
});

describe("loadCards and saveCards", () => {
  it("reads an empty deck from a missing file and round-trips a card", async () => {
    await withDataDir(async () => {
      expect(await loadCards()).toEqual([]);
      const card = makeCard("card:a");
      await saveCards([card]);
      expect(await loadCards()).toEqual([card]);
    });
  });

  it("drops the cached boot state so a read after a write sees the new card", async () => {
    await withDataDir(async (dir) => {
      await writePack(path.join(dir, "packs"), "boot-pack", MANIFEST);
      const first = await ensureBootstrapped();
      expect(first.cards).toHaveLength(1);

      const extra = makeCard("card:extra");
      await saveCards([...first.cards, extra]);

      const second = await ensureBootstrapped();
      expect(second.cards.map((card) => card.id)).toContain("card:extra");
    });
  });
});
