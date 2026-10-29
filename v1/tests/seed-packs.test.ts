// WHY: A built-in pack is shipped data, not code. These tests read the seed the
// app actually fetches and the folder it was authored in, so a broken card, a
// stale bundle, a missing image or a dead video id fails here instead of in a
// learner's session.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]

import { describe, expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseBundle } from "@/lib/browser/bundle";
import { deckCardId } from "@/lib/core/card";
import { SEED_INDEX_SCHEMA } from "@/lib/browser/seed";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const PACK_NAMES = ["browser-dev", "polish-from-scratch", "system-design"] as const;
const CARDS_PER_DECK = 10;

/** A YouTube video is named by its 11-character id, never by a page address. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

async function readJson(relative: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(projectRoot, relative), "utf8"));
}

async function readAuthored(name: string): Promise<{
  version: string;
  description?: string;
  language?: string;
  topics: string[];
  topicLevels: Record<string, string>;
}> {
  return (await readJson(`packs/${name}/pack.json`)) as Awaited<ReturnType<typeof readAuthored>>;
}

async function readSeed(name: string) {
  const parsed = parseBundle(JSON.stringify(await readJson(`public/packs/${name}.json`)));
  if (!parsed.ok) {
    throw new Error(
      `${name}.json does not parse: ${parsed.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  return parsed.bundle;
}

describe("seed manifest", () => {
  it("lists exactly the built-in packs at their authored versions", async () => {
    const index = (await readJson("public/packs/index.json")) as {
      schema: string;
      packs: { name: string; version: string; file: string }[];
    };
    expect(index.schema).toBe(SEED_INDEX_SCHEMA);
    expect(index.packs.map((pack) => pack.name).sort()).toEqual([...PACK_NAMES].sort());
    for (const entry of index.packs) {
      const authored = await readAuthored(entry.name);
      expect(entry.version).toBe(authored.version);
      expect(entry.file).toBe(`/packs/${entry.name}.json`);
    }
  });
});

describe.each(PACK_NAMES)("%s seed bundle", (name) => {
  it("matches the authored pack and its decks", async () => {
    const [bundle, authored] = await Promise.all([readSeed(name), readAuthored(name)]);
    expect(bundle.pack.name).toBe(name);
    expect(bundle.pack.version).toBe(authored.version);
    expect(bundle.pack.language).toBe(authored.language);
    expect(bundle.pack.description).toBe(authored.description);
    expect(bundle.decks.map((deck) => deck.id)).toEqual(authored.topics);
    expect(
      Object.fromEntries(bundle.decks.map((deck) => [deck.id, deck.level])),
    ).toEqual(authored.topicLevels);
  });

  it("holds ten cards in every deck and no card outside a deck", async () => {
    const bundle = await readSeed(name);
    const known = new Set(bundle.decks.map((deck) => deck.id));
    for (const card of bundle.cards) {
      expect(card.deckId, `card ${card.key} has no deck`).toBeTruthy();
      expect(known.has(card.deckId ?? "")).toBe(true);
    }
    for (const deck of bundle.decks) {
      const count = bundle.cards.filter((card) => card.deckId === deck.id).length;
      expect(count, `deck ${deck.id}`).toBe(CARDS_PER_DECK);
    }
  });

  it("keeps every teaching layer short and every video named by an id", async () => {
    const bundle = await readSeed(name);
    for (const card of bundle.cards) {
      const layer = card.teaching;
      if (!layer) continue;
      expect(layer.length, `layer on ${card.key}`).toBeGreaterThanOrEqual(1);
      expect(layer.length, `layer on ${card.key}`).toBeLessThanOrEqual(3);
      for (const part of layer) {
        if (part.type !== "video") continue;
        if (part.source === "youtube") {
          expect(part.src, `video on ${card.key}`).toMatch(YOUTUBE_ID);
        }
      }
    }
  });
});

describe("browser-dev pack", () => {
  it("teaches every deck and ships its images", async () => {
    const bundle = await readSeed("browser-dev");
    const taughtDecks = new Set(
      bundle.cards.filter((card) => card.teaching).map((card) => card.deckId),
    );
    for (const deck of bundle.decks) {
      expect(taughtDecks.has(deck.id), `deck ${deck.id} has no teaching layer`).toBe(true);
    }

    const images = bundle.cards.flatMap((card) =>
      (card.teaching ?? []).filter((part) => part.type === "image"),
    );
    expect(images.length).toBeGreaterThanOrEqual(bundle.decks.length);
    for (const image of images) {
      expect(image.source).toBe("builtin");
      expect(image.src.startsWith("/packs/browser-dev/images/")).toBe(true);
      const file = path.join(projectRoot, "public", image.src);
      await expect(stat(file)).resolves.toBeTruthy();
    }
  });
});

describe("polish-from-scratch pack", () => {
  it("is a typing pack and every card carries a teaching layer", async () => {
    const bundle = await readSeed("polish-from-scratch");
    for (const card of bundle.cards) {
      expect(card.answerDef.mode, `card ${card.key}`).toBe("type");
      expect(card.teaching, `card ${card.key}`).toBeTruthy();
    }
  });
});

describe("system-design pack", () => {
  it("teaches every card and ships every built-in image", async () => {
    const bundle = await readSeed("system-design");
    for (const card of bundle.cards) {
      expect(card.teaching, `card ${card.key}`).toBeTruthy();
    }

    const images = bundle.cards.flatMap((card) =>
      (card.teaching ?? []).filter((part) => part.type === "image"),
    );
    for (const image of images) {
      expect(image.source).toBe("builtin");
      expect(image.src.startsWith("/packs/system-design/images/")).toBe(true);
      const file = path.join(projectRoot, "public", image.src);
      await expect(stat(file), image.src).resolves.toBeTruthy();
    }
  });

  it("gives every deck two images including a still, and a video", async () => {
    const bundle = await readSeed("system-design");
    for (const deck of bundle.decks) {
      const parts = bundle.cards
        .filter((card) => card.deckId === deck.id)
        .flatMap((card) => card.teaching ?? []);
      const images = parts.filter((part) => part.type === "image");
      const videos = parts.filter((part) => part.type === "video");
      expect(images.length, `deck ${deck.id} images`).toBeGreaterThanOrEqual(2);
      expect(videos.length, `deck ${deck.id} videos`).toBeGreaterThanOrEqual(1);
      // WHY: Scenario 4 asks for a photograph or a static diagram, so two
      // animations must not pass as visual teaching.
      const still = images.some(
        (image) => image.src.endsWith(".webp") || !image.src.endsWith("-anim.svg"),
      );
      expect(still, `deck ${deck.id} has a photograph or a static diagram`).toBe(true);
    }
  });

  it("ships a Dictionary page for the course, every deck and every card", async () => {
    const bundle = await readSeed("system-design");
    const pages = bundle.pages;
    expect(pages.filter((page) => page.level === "pack")).toHaveLength(1);
    expect(
      pages.filter((page) => page.level === "deck").map((page) => page.deckId).sort(),
    ).toEqual(bundle.decks.map((deck) => deck.id).sort());

    // WHY: a shipped card page names the id the app derives from the card's
    // words; the seed builder computes it in plain JS, so this recomputes every
    // one with the app's own function and refuses a near-miss.
    const deckNames = new Map(bundle.decks.map((deck) => [deck.id, deck.name]));
    const cardPages = new Map(
      pages
        .filter((page) => page.level === "card")
        .map((page) => [page.cardId ?? "", page]),
    );
    expect(cardPages.size).toBe(bundle.cards.length);
    for (const card of bundle.cards) {
      const deckName = deckNames.get(card.deckId ?? "") ?? "";
      const id = deckCardId("system-design", card.deckId ?? "", { ...card, topics: [deckName] });
      const page = cardPages.get(id);
      expect(page, `card ${card.key} has no page at ${id}`).toBeTruthy();
      expect(page?.parts.length, `page ${id} is empty`).toBeGreaterThan(0);
    }

    // WHY: the Dictionary draws a pack page or a deck page as a cover — a
    // picture, a promise and the path onward — and it never renders a body on
    // them, so shipping parts there would be data no learner can reach.
    for (const page of pages) {
      const label = `${page.level} page ${page.deckId ?? page.cardId ?? ""}`;
      if (page.level === "card") {
        expect(page.parts.length, label).toBeGreaterThan(0);
      } else {
        expect(page.parts.length, `${label} carries an unrendered body`).toBe(0);
        expect(page.cover?.type, `${label} cover`).toBe("image");
        expect(page.cover?.type === "image" && page.cover.source, label).toBe("builtin");
        expect((page.lead ?? "").trim().length, `${label} promise`).toBeGreaterThan(0);
      }
      for (const part of [page.cover, ...page.parts]) {
        if (part?.type === "image") {
          expect(part.source).toBe("builtin");
          expect(part.src.startsWith("/packs/system-design/images/")).toBe(true);
          await expect(stat(path.join(projectRoot, "public", part.src)), part.src).resolves.toBeTruthy();
        }
        if (part?.type === "video" && part.source === "youtube") {
          expect(part.src, `video on a ${page.level} page`).toMatch(YOUTUBE_ID);
        }
      }
    }
  });
});
