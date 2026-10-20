// WHY: A pack is plain data from a folder, and a broken pack must be named,
// skipped and never crash the app. These tests pin every refusal.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readPackFolder, scanPacks } from "@/lib/packs/loader";
import { adoptPacks, collectTopicLabels, orphanedPackNames } from "@/lib/packs/adopt";
import type { PackRecord } from "@/lib/packs/types";
import type { Card } from "@/lib/shared/types";
import { withTempDir } from "./helpers";
import { makeSource } from "./helpers";

const NOW = "2026-10-10T12:00:00.000Z";

async function writePack(dir: string, files: Record<string, unknown>): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [name, value] of Object.entries(files)) {
    await writeFile(
      path.join(dir, name),
      typeof value === "string" ? value : JSON.stringify(value),
      "utf8",
    );
  }
}

const GOOD_MANIFEST = {
  name: "test-pack",
  version: "1.0.0",
  description: "A test pack.",
  language: "pl",
  topics: ["cases"],
  topicLabels: { cases: "Cases" },
};

const GOOD_PROMPTS = {
  generation: { system: "Write lines.", template: "Write {{count}} lines about {{topic}}." },
  tutor: { system: "Be patient.", hintTemplate: "Card: {{cardText}}" },
};

describe("readPackFolder", () => {
  it("loads a good pack with cards and prompts", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "test-pack");
      await writePack(folder, {
        "pack.json": GOOD_MANIFEST,
        "cards.json": { cards: [makeSource()] },
        "prompts.json": GOOD_PROMPTS,
      });
      const pack = await readPackFolder(folder);
      expect(pack.error).toBeUndefined();
      expect(pack.name).toBe("test-pack");
      expect(pack.cards).toHaveLength(1);
      expect(pack.prompts?.tutor?.system).toBe("Be patient.");
      expect(pack.topicLabels.cases).toBe("Cases");
    });
  });

  it("loads a pack with no cards file as an empty pack", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "empty-pack");
      await writePack(folder, { "pack.json": { ...GOOD_MANIFEST, name: "empty-pack" } });
      const pack = await readPackFolder(folder);
      expect(pack.error).toBeUndefined();
      expect(pack.cards).toHaveLength(0);
      expect(pack.prompts).toBeNull();
    });
  });

  it("names a folder with no pack.json", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "not-a-pack");
      await mkdir(folder, { recursive: true });
      const pack = await readPackFolder(folder);
      expect(pack.error).toContain("no pack.json");
      expect(pack.name).toBe("not-a-pack");
    });
  });

  it("names unreadable pack.json", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "bad-json");
      await writePack(folder, { "pack.json": "{oops" });
      const pack = await readPackFolder(folder);
      expect(pack.error).toContain("not valid JSON");
    });
  });

  it("names a manifest that breaks the schema", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "bad-manifest");
      await writePack(folder, { "pack.json": { ...GOOD_MANIFEST, name: "Bad Name!" } });
      const pack = await readPackFolder(folder);
      expect(pack.error).toContain("pack.json is wrong at name");
    });
  });

  it("refuses a pack that needs a newer app", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "too-new");
      await writePack(folder, {
        "pack.json": { ...GOOD_MANIFEST, name: "too-new", coreRange: ">=99.0.0" },
      });
      const pack = await readPackFolder(folder);
      expect(pack.error).toContain("needs app");
    });
  });

  it("names an invalid version range", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "bad-range");
      await writePack(folder, {
        "pack.json": { ...GOOD_MANIFEST, name: "bad-range", coreRange: "not a range" },
      });
      const pack = await readPackFolder(folder);
      expect(pack.error).toContain("not a valid range");
    });
  });

  it("names a broken cards file", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "bad-cards");
      await writePack(folder, {
        "pack.json": { ...GOOD_MANIFEST, name: "bad-cards" },
        "cards.json": { cards: [{ summary: "missing everything" }] },
      });
      const pack = await readPackFolder(folder);
      expect(pack.error).toContain("cards.json is wrong");
    });
  });

  it("names a card that breaks a hard rule and points at its number", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "bad-card-rule");
      await writePack(folder, {
        "pack.json": { ...GOOD_MANIFEST, name: "bad-card-rule" },
        "cards.json": { cards: [makeSource(), { ...makeSource(), answerDef: { mode: "cloze", blanks: [] } }] },
      });
      const pack = await readPackFolder(folder);
      expect(pack.error).toContain("card 2 is broken");
    });
  });

  it("names a card whose topic the manifest does not list", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "stray-topic");
      await writePack(folder, {
        "pack.json": { ...GOOD_MANIFEST, name: "stray-topic" },
        "cards.json": { cards: [makeSource({ topics: ["typo"] })] },
      });
      const pack = await readPackFolder(folder);
      expect(pack.error).toContain('card 1 uses the topic "typo"');
      expect(pack.error).toContain("pack.json does not list");
    });
  });

  it("names a broken prompts file", async () => {
    await withTempDir(async (dir) => {
      const folder = path.join(dir, "bad-prompts");
      await writePack(folder, {
        "pack.json": { ...GOOD_MANIFEST, name: "bad-prompts" },
        "prompts.json": { generation: { system: "" } },
      });
      const pack = await readPackFolder(folder);
      expect(pack.error).toContain("prompts.json is wrong");
    });
  });
});

describe("scanPacks", () => {
  it("reads every folder that has a pack.json and skips the rest", async () => {
    await withTempDir(async (dir) => {
      await writePack(path.join(dir, "one"), { "pack.json": { ...GOOD_MANIFEST, name: "one" } });
      await mkdir(path.join(dir, "notes"), { recursive: true });
      const packs = await scanPacks(dir);
      expect(packs.map((pack) => pack.name)).toEqual(["one"]);
    });
  });

  it("treats a missing folder as an empty library", async () => {
    await withTempDir(async (dir) => {
      expect(await scanPacks(path.join(dir, "nowhere"))).toEqual([]);
    });
  });
});

function makePackRecord(overrides: Partial<PackRecord> = {}): PackRecord {
  return {
    name: "test-pack",
    version: "1.0.0",
    folder: "/packs/test-pack",
    topics: ["cases"],
    topicLabels: { cases: "Cases" },
    cards: [makeSource()],
    prompts: null,
    ...overrides,
  };
}

describe("adoptPacks", () => {
  it("adopts a new pack's cards with a pack origin", () => {
    const result = adoptPacks([makePackRecord()], [], NOW);
    expect(result.added).toBe(1);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].origin.kind).toBe("pack");
    expect(result.cards[0].origin.packName).toBe("test-pack");
    expect(result.statuses[0].cardCount).toBe(1);
  });

  it("does not duplicate or update an unchanged pack", () => {
    const first = adoptPacks([makePackRecord()], [], NOW);
    const second = adoptPacks([makePackRecord()], first.cards, NOW);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.cards).toHaveLength(1);
  });

  it("keeps identity and evidence across a version bump, refreshing only the note", () => {
    const first = adoptPacks([makePackRecord()], [], NOW);
    const evidenceHolder: Card = { ...first.cards[0], tags: ["mine"] };
    const second = adoptPacks([makePackRecord({ version: "2.0.0" })], [evidenceHolder], NOW);
    expect(second.updated).toBe(1);
    expect(second.cards[0].id).toBe(first.cards[0].id);
    expect(second.cards[0].tags).toEqual(["mine"]);
    expect(second.cards[0].origin.packVersion).toBe("2.0.0");
  });

  it("reports an errored pack as a named status without cards", () => {
    const result = adoptPacks([makePackRecord({ error: "this folder has no pack.json" })], [], NOW);
    expect(result.cards).toHaveLength(0);
    expect(result.statuses[0].error).toContain("no pack.json");
  });
});

describe("orphans and labels", () => {
  it("lists packs whose folder is gone and keeps their cards", () => {
    const adopted = adoptPacks([makePackRecord()], [], NOW);
    const orphans = orphanedPackNames(adopted.cards, []);
    expect(orphans).toEqual(["test-pack"]);

    const stillThere = orphanedPackNames(adopted.cards, adopted.statuses);
    expect(stillThere).toEqual([]);
  });

  it("merges topic labels from healthy packs only", () => {
    const labels = collectTopicLabels([
      { name: "one", version: "1", folder: "f", topics: ["a"], topicLabels: { a: "A" }, cardCount: 1 },
      {
        name: "two",
        version: "1",
        folder: "f2",
        topics: ["b"],
        topicLabels: { b: "B" },
        cardCount: 0,
        error: "broken",
      },
    ]);
    expect(labels).toEqual({ a: "A" });
  });
});
