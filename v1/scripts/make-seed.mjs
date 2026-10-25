// WHY: The browser build reads built-in packs from one manifest and one bundle
// per pack. This script turns each pack folder into those files so nobody
// hand-copies cards, levels or teaching layers and drifts the two apart.
// PACK: teaching-layers
// 2026-10-20 opencode: created for the browser-owned build.
// 2026-10-25 opencode: manifest, deck levels and both built-in packs [pack: teaching-layers]
// 2026-10-25 opencode: a deck's cards may live in cards/<deck>.json, and a pack's
// built-in images are copied beside it, so large packs stay readable.

import { readFile, writeFile, mkdir, readdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packsRoot = path.join(root, "packs");
const targetRoot = path.join(root, "public", "packs");

/** Only these folders are seeded. A stray folder never reaches a learner. */
const seedPacks = ["browser-dev", "polish-from-scratch"];

/** Read one JSON file, or null when an optional file is absent. */
async function readJson(file, optional = false) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (problem) {
    if (optional && problem?.code === "ENOENT") return null;
    throw problem;
  }
}

/** Every `.json` file in a directory, sorted so the order never drifts. */
async function jsonFiles(directory) {
  let names;
  try {
    names = await readdir(directory);
  } catch (problem) {
    if (problem?.code === "ENOENT") return [];
    throw problem;
  }
  return names
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(directory, name));
}

/** A pack's cards: the one old file, then one file per deck, in name order. */
async function readCards(source) {
  const files = [path.join(source, "cards.json"), ...(await jsonFiles(path.join(source, "cards")))];
  const cards = [];
  for (const file of files) {
    const parsed = await readJson(file, true);
    if (!parsed) continue;
    if (!Array.isArray(parsed.cards)) throw new Error(`${file} has no cards array`);
    cards.push(...parsed.cards);
  }
  return cards;
}

/** Copy a pack's built-in images beside its bundle, so no stale file lingers. */
async function copyImages(source, slug) {
  const from = path.join(source, "images");
  const to = path.join(targetRoot, slug, "images");
  await rm(path.join(targetRoot, slug), { recursive: true, force: true });
  let names;
  try {
    names = await readdir(from);
  } catch (problem) {
    if (problem?.code === "ENOENT") return 0;
    throw problem;
  }
  await mkdir(to, { recursive: true });
  for (const name of names) {
    await copyFile(path.join(from, name), path.join(to, name));
  }
  return names.length;
}

await mkdir(targetRoot, { recursive: true });

const index = { schema: "flashcards.pack-index/v1", packs: [] };

for (const slug of seedPacks) {
  const source = path.join(packsRoot, slug);
  const manifest = await readJson(path.join(source, "pack.json"));
  const prompts = await readJson(path.join(source, "prompts.json"), true);

  const decks = manifest.topics.map((topic) => ({
    id: topic,
    name: manifest.topicLabels?.[topic] ?? topic,
    level: manifest.topicLevels?.[topic] ?? "intermediate",
  }));

  const cards = (await readCards(source)).map((card) => {
    const { topics, ...sourceCard } = card;
    return { ...sourceCard, deckId: topics[0] };
  });
  const images = await copyImages(source, slug);

  const bundle = {
    schema: "flashcards.pack/v1",
    pack: {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      language: manifest.language,
      sourceLanguage: manifest.sourceLanguage,
      studyInstruction: manifest.studyInstruction,
      ...(prompts ? { prompts } : {}),
    },
    decks,
    cards,
  };

  await writeFile(path.join(targetRoot, `${slug}.json`), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  index.packs.push({ name: manifest.name, version: manifest.version, file: `/packs/${slug}.json` });
  console.log(
    `Wrote ${cards.length} cards in ${decks.length} decks to public/packs/${slug}.json` +
      (images > 0 ? ` with ${images} image(s)` : ""),
  );
}

await writeFile(path.join(targetRoot, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`Wrote ${index.packs.length} packs to public/packs/index.json`);
