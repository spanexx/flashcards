// WHY: Five built-in modes are shipped data. These tests strict-parse the
// authored files and run every worked example through the app's real readers
// and validators, so a broken mode fails here instead of in a learner's prompt.
// PACK: built-in-modes
// 2026-11-23 opencode: created red before any mode file existed. [pack: built-in-modes]

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseBundle, validateCanonicalExample } from "@/lib/browser/bundle";
import { readLearningMode } from "@/lib/browser/modes";
import { ANSWER_MODES } from "@/lib/shared/types";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const IDS = [
  "grammar-roles",
  "language-general",
  "word-deep-dive",
  "system-architecture",
  "programming-language",
] as const;
const AUTHOR_FIELDS = [
  "id",
  "name",
  "description",
  "version",
  "defaultCardMix",
  "usesWordStages",
  "skillInstructions",
  "canonicalExample",
];
const STAMP = "2026-11-23T00:00:00.000Z";
const MIXES: Record<string, readonly string[]> = {
  "grammar-roles": ["cloze", "picks", "type"],
  "language-general": ["cloze", "type", "hear_type", "picks"],
  "word-deep-dive": ["cloze", "type", "picks", "match"],
  "system-architecture": ["cloze", "picks", "type"],
  "programming-language": ["type", "cloze", "picks"],
};

/** Strict parse: loose JSON repair would let a file pass here and fail the seed. */
async function readJson(relative: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(projectRoot, relative), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("authored built-in modes", () => {
  it("holds exactly the five locked ids", async () => {
    const files = (await readdir(path.join(projectRoot, "modes")))
      .filter((name) => name.endsWith(".json"))
      .sort();
    expect(files).toEqual(IDS.map((id) => `${id}.json`).sort());
  });

  it.each(IDS)("%s carries only the author-written fields", async (id) => {
    const authored = await readJson(`modes/${id}.json`);
    expect(Object.keys(authored).sort()).toEqual([...AUTHOR_FIELDS].sort());
    expect(authored.id).toBe(id);
    expect(authored.version).toBe("1.0.0");
    expect(authored.name).toBeTruthy();
    expect(authored.description).toBeTruthy();
    expect(authored.skillInstructions).toBeTruthy();
    expect(authored.usesWordStages).toBe(id === "word-deep-dive");
    expect(authored.defaultCardMix).toEqual(MIXES[id]);
    for (const mode of authored.defaultCardMix as string[]) expect(ANSWER_MODES).toContain(mode);
  });

  it.each(IDS)("%s example passes every validator and stays small", async (id) => {
    const authored = await readJson(`modes/${id}.json`);
    // WHY: the browser stores isBuiltIn and createdAt, so validate the shape a
    // fresh install will actually receive, not just the authored subset.
    const read = readLearningMode({ ...authored, isBuiltIn: true, createdAt: STAMP });
    expect(read.ok, read.ok ? "" : read.issues.map((issue) => issue.message).join("; ")).toBe(true);
    if (!read.ok) return;

    expect(validateCanonicalExample(read.mode.canonicalExample)).toEqual([]);
    const parsed = parseBundle(JSON.stringify(read.mode.canonicalExample));
    expect(parsed.ok, parsed.ok ? "" : parsed.issues.map((issue) => issue.message).join("; ")).toBe(
      true,
    );
    if (!parsed.ok) return;

    expect(parsed.bundle.pack.name).toBe(`mode-demo-${id}`);
    expect(parsed.bundle.decks.length).toBeGreaterThanOrEqual(1);
    expect(parsed.bundle.decks.length).toBeLessThanOrEqual(2);
    expect(parsed.bundle.cards.length).toBeGreaterThanOrEqual(2);
    expect(parsed.bundle.cards.length).toBeLessThanOrEqual(4);

    const deckIds = new Set(parsed.bundle.decks.map((deck) => deck.id));
    for (const card of parsed.bundle.cards) {
      expect(deckIds.has(card.deckId ?? ""), `card ${card.key} names a real deck`).toBe(true);
      for (const part of card.teaching ?? []) {
        expect(["image", "video"]).not.toContain(part.type);
      }
    }
  });
});
