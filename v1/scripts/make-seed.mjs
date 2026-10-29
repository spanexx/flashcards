// WHY: The browser build reads built-in packs from one manifest and one bundle
// per pack. This script turns each pack folder into those files so nobody
// hand-copies cards, levels or teaching layers and drifts the two apart.
// PACK: teaching-layers
// 2026-10-20 opencode: created for the browser-owned build.
// 2026-10-25 opencode: manifest, deck levels and both built-in packs [pack: teaching-layers]
// 2026-10-25 opencode: a deck's cards may live in cards/<deck>.json, and a pack's
// built-in images are copied beside it, so large packs stay readable.

import { readFile, writeFile, mkdir, readdir, copyFile, rm, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packsRoot = path.join(root, "packs");
const targetRoot = path.join(root, "public", "packs");

/** Only these folders are seeded. A stray folder never reaches a learner. */
const seedPacks = ["browser-dev", "polish-from-scratch", "system-design"];

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

// WHY: A shipped Dictionary page names its card by the id the app derives from
// the card's words, so the seed must derive the same id or the page would point
// at nothing. These three helpers mirror `canonicalContent` and `deckCardId` in
// `src/lib/core/card.ts`; the seed test recomputes every page's id with the app
// code, so the two copies cannot drift apart silently.
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function hashText(text) {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function deckCardId(packName, deckId, deckName, card) {
  const content = stableStringify({
    summary: card.summary.trim(),
    topics: [deckName],
    tags: [...new Set((card.tags ?? []).map((tag) => tag.trim()))].sort(),
    prompt: card.prompt,
    answer: card.answer,
    answerDef: card.answerDef,
    hints: card.hints ?? [],
    fullLine: card.fullLine ?? null,
  });
  return `deck-${packName}-${deckId}:${hashText(content)}`;
}

const index = { schema: "flashcards.pack-index/v1", packs: [] };

for (const slug of seedPacks) {
  const source = path.join(packsRoot, slug);
  const manifest = await readJson(path.join(source, "pack.json"));
  const prompts = await readJson(path.join(source, "prompts.json"), true);
  const authoredPages = await readJson(path.join(source, "pages.json"), true);

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

  const deckNames = new Map(decks.map((deck) => [deck.id, deck.name]));
  const cardIds = new Map(
    cards.map((card) => [card.key, deckCardId(manifest.name, card.deckId, deckNames.get(card.deckId), card)]),
  );
  const pages = (authoredPages?.pages ?? []).map(({ cardKey, ...page }) => {
    if (page.level !== "card") return page;
    const cardId = cardIds.get(cardKey);
    if (!cardId) throw new Error(`${slug} pages.json names unknown card "${cardKey}"`);
    return { ...page, cardId };
  });
  for (const page of pages) {
    for (const part of [page.cover, ...(page.parts ?? [])]) {
      if (part?.type === "image" && part.source === "builtin") {
        const file = path.join(source, "images", path.basename(part.src));
        await stat(file).catch(() => {
          throw new Error(`${slug} page ${page.level} names a missing image ${part.src}`);
        });
      }
    }
  }

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
    ...(pages.length > 0 ? { pages } : {}),
  };

  await writeFile(path.join(targetRoot, `${slug}.json`), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  index.packs.push({ name: manifest.name, version: manifest.version, file: `/packs/${slug}.json` });
  console.log(
    `Wrote ${cards.length} cards in ${decks.length} decks to public/packs/${slug}.json` +
      (pages.length > 0 ? ` with ${pages.length} page(s)` : "") +
      (images > 0 ? ` and ${images} image(s)` : ""),
  );
}

await writeFile(path.join(targetRoot, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`Wrote ${index.packs.length} packs to public/packs/index.json`);
