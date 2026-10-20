// WHY: The prototype stored one folder per pack; the browser build reads one
// bundle file at first open. This script converts the Polish starter folder into
// that seed file so nobody hand-copies cards and drifts the two apart.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "packs", "polish-starter");
const target = path.join(root, "public", "packs", "polish-starter.json");

const manifest = JSON.parse(await readFile(path.join(source, "pack.json"), "utf8"));
const cardsFile = JSON.parse(await readFile(path.join(source, "cards.json"), "utf8"));
const prompts = JSON.parse(await readFile(path.join(source, "prompts.json"), "utf8"));

const decks = manifest.topics.map((topic) => ({
  id: topic,
  name: manifest.topicLabels?.[topic] ?? topic,
}));

const cards = cardsFile.cards.map((card) => {
  const { topics, ...sourceCard } = card;
  return { ...sourceCard, deckId: topics[0] };
});

const bundle = {
  schema: "flashcards.pack/v1",
  pack: {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    language: manifest.language,
    prompts,
  },
  decks,
  cards,
};

await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
console.log(`Wrote ${cards.length} cards in ${decks.length} decks to ${path.relative(root, target)}`);
