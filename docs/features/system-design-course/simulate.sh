#!/usr/bin/env bash
# WHY: The course is shipped data. This simulation reads what the app will
# actually fetch and proves the course exists, every deck is taught, every
# built-in image is on disk and every video is named by an id.
# PACK: system-design-course
# 2026-10-29 opencode: created for the system design course [pack: system-design-course]
# 2026-10-29 qoder: the drift review found the sample printed no prompt or
#   answer and the course shape was never asserted; both now hold. [pack: system-design-course]

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
public="$root/v1/public"
bundle="$public/packs/system-design.json"
manifest="$root/v1/packs/system-design/pack.json"

if [ ! -f "$bundle" ]; then
  echo "FAIL: $bundle is missing. Run: cd v1 && node scripts/make-seed.mjs" >&2
  exit 1
fi

node - "$public" "$bundle" "$manifest" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const publicDir = process.argv[2];
const bundlePath = process.argv[3];
const manifestPath = process.argv[4];
const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const index = JSON.parse(fs.readFileSync(path.join(publicDir, "packs", "index.json"), "utf8"));

const failures = [];
const fail = (message) => failures.push(message);
const images = [];
const expectedPacks = ["browser-dev", "polish-from-scratch", "system-design"];
const shorten = (text, limit = 160) =>
  text.length > limit ? `${text.slice(0, limit - 1)}...` : text;

console.log("System Design course simulation");
console.log("===============================\n");

console.log("Built-in packs:");
for (const entry of index.packs) {
  console.log(`  ${entry.name} ${entry.version}  ${entry.file}`);
}
const packNames = index.packs.map((pack) => pack.name);
if (packNames.length !== expectedPacks.length) {
  fail(`index.json lists ${packNames.length} packs, expected ${expectedPacks.length}`);
}
for (const name of expectedPacks) {
  if (!packNames.includes(name)) fail(`index.json is missing ${name}`);
}
const entry = index.packs.find((pack) => pack.name === "system-design");
if (!entry) fail("index.json does not list system-design");
else if (entry.version !== bundle.pack.version) fail("index version does not match the bundle");

console.log(`\nBundle: ${bundle.pack.name} ${bundle.pack.version}`);
console.log(`Decks: ${bundle.decks.length}  Cards: ${bundle.cards.length}\n`);

if (bundle.decks.length !== manifest.topics.length) {
  fail(`bundle has ${bundle.decks.length} decks, manifest lists ${manifest.topics.length}`);
}
if (bundle.decks.length !== 10) fail(`bundle has ${bundle.decks.length} decks, expected 10`);
for (let position = 0; position < manifest.topics.length; position += 1) {
  const expectedId = manifest.topics[position];
  const deck = bundle.decks[position];
  if (!deck || deck.id !== expectedId) {
    fail(`deck ${position + 1} is ${deck ? deck.id : "missing"}, expected ${expectedId}`);
    continue;
  }
  if (deck.name !== manifest.topicLabels[expectedId]) {
    fail(`deck ${deck.id} is named "${deck.name}", manifest says "${manifest.topicLabels[expectedId]}"`);
  }
  if (deck.level !== manifest.topicLevels[expectedId]) {
    fail(`deck ${deck.id} is ${deck.level}, manifest says ${manifest.topicLevels[expectedId]}`);
  }
}

const deckRows = [];
for (const deck of bundle.decks) {
  const cards = bundle.cards.filter((card) => card.deckId === deck.id);
  if (cards.length !== 10) fail(`deck ${deck.id} has ${cards.length} cards, expected 10`);

  let deckImages = 0;
  let deckVideos = 0;
  for (const card of cards) {
    const layer = card.teaching ?? [];
    if (layer.length === 0) fail(`card ${card.key} has no teaching layer`);
    if (layer.length > 3) fail(`card ${card.key} has ${layer.length} teaching parts, max 3`);

    for (const part of layer) {
      if (part.type === "image") {
        deckImages += 1;
        if (part.source !== "builtin") {
          fail(`card ${card.key} uses a ${part.source} image, expected builtin`);
          continue;
        }
        if (!part.src.startsWith("/packs/system-design/images/")) {
          fail(`card ${card.key} image ${part.src} is outside the pack`);
          continue;
        }
        const file = path.join(publicDir, part.src);
        images.push(part.src);
        if (!fs.existsSync(file)) fail(`missing image ${part.src}`);
        else if (fs.statSync(file).size > 1024 * 1024) fail(`image ${part.src} is over 1 MB`);
      }
      if (part.type === "video") {
        deckVideos += 1;
        if (part.source !== "youtube") fail(`card ${card.key} video is not a YouTube id`);
        else if (!/^[A-Za-z0-9_-]{11}$/.test(part.src)) fail(`card ${card.key} video id "${part.src}" is not 11 characters`);
      }
    }
  }
  if (deckImages < 2) fail(`deck ${deck.id} has ${deckImages} images, expected at least 2`);
  if (deckVideos < 1) fail(`deck ${deck.id} has ${deckVideos} videos, expected at least 1`);
  const still = cards
    .flatMap((card) => card.teaching ?? [])
    .some(
      (part) =>
        part.type === "image" &&
        (part.src.endsWith(".webp") || !part.src.endsWith("-anim.svg")),
    );
  if (!still) fail(`deck ${deck.id} has no photograph or static diagram`);
  deckRows.push({ deck, cards, deckImages, deckVideos });
}

console.log("Decks and media:");
for (const { deck, cards, deckImages, deckVideos } of deckRows) {
  console.log(
    `  ${deck.id.padEnd(18)} ${deck.level.padEnd(13)} ${String(cards.length).padStart(2)} cards  ` +
      `${String(deckImages).padStart(2)} images  ${String(deckVideos).padStart(2)} videos`,
  );
}

console.log(`\nUnique built-in images: ${new Set(images).size}`);
console.log("Image files:");
for (const src of [...new Set(images)].sort()) {
  const file = path.join(publicDir, src);
  const size = fs.existsSync(file) ? `${Math.round(fs.statSync(file).size / 1024)}K` : "MISSING";
  console.log(`  ${fs.existsSync(file) ? "ok  " : "FAIL"} ${src} (${size})`);
}

console.log("\nOne taught card per deck:");
const renderSide = (parts) =>
  (parts ?? [])
    .map((part) =>
      part.type === "text"
        ? part.text
        : part.type === "blank"
          ? `[blank ${part.id}]`
          : `[${part.type}]`,
    )
    .join(" ");
const renderPart = (part) =>
  part.type === "text"
    ? part.text
    : part.type === "image"
      ? `image ${part.src}${part.alt ? ` — ${part.alt}` : ""}`
      : `video ${part.source}:${part.src}${part.search ? ` — search: ${part.search}` : ""}`;
for (const { deck, cards } of deckRows) {
  const card = cards.find((item) => item.teaching && item.teaching.length > 0) ?? cards[0];
  if (!card.prompt || card.prompt.length === 0) fail(`deck ${deck.id} sample card has no prompt`);
  if (!card.answer || card.answer.length === 0) fail(`deck ${deck.id} sample card has no answer`);
  console.log(`  ${deck.id.padEnd(18)} ${card.summary}`);
  console.log(`    prompt:   ${shorten(renderSide(card.prompt))}`);
  console.log(`    answer:   ${shorten(renderSide(card.answer))}`);
  for (const part of card.teaching ?? []) {
    if (part.type === "text" && !part.text.trim()) fail(`card ${card.key} has an empty teaching text`);
    console.log(`    teaching: ${shorten(renderPart(part))}`);
  }
}

const pages = bundle.pages ?? [];
const packPages = pages.filter((page) => page.level === "pack");
const deckPages = pages.filter((page) => page.level === "deck");
const cardPages = pages.filter((page) => page.level === "card");
const checkPageImage = (page, part, label) => {
  if (part.type !== "image") return;
  if (part.source !== "builtin") {
    fail(`${label} uses a ${part.source} image, expected builtin`);
    return;
  }
  if (!part.src.startsWith("/packs/system-design/images/")) {
    fail(`${label} image ${part.src} is outside the pack`);
    return;
  }
  const file = path.join(publicDir, part.src);
  if (!fs.existsSync(file)) fail(`${label} names a missing image ${part.src}`);
};

if (packPages.length !== 1) fail(`bundle has ${packPages.length} pack pages, expected 1`);
for (const page of packPages) {
  if (!page.cover) fail("the pack page has no cover");
  else checkPageImage(page, page.cover, "the pack page");
  if (!(page.lead ?? "").trim()) fail("the pack page has no promise");
}
if (deckPages.length !== bundle.decks.length) {
  fail(`bundle has ${deckPages.length} deck pages, expected ${bundle.decks.length}`);
}
for (const deck of bundle.decks) {
  const page = deckPages.find((item) => item.deckId === deck.id);
  if (!page) {
    fail(`deck ${deck.id} has no page`);
    continue;
  }
  // WHY: the Dictionary draws a deck page as a cover, never a body, so parts
  // here would be data no learner can reach.
  if ((page.parts ?? []).length > 0) fail(`deck ${deck.id} page carries an unrendered body`);
  if (!page.cover) fail(`deck ${deck.id} page has no cover`);
  else checkPageImage(page, page.cover, `deck ${deck.id} page`);
  if (!(page.lead ?? "").trim()) fail(`deck ${deck.id} page has no promise`);
}
if (cardPages.length !== bundle.cards.length) {
  fail(`bundle has ${cardPages.length} card pages, expected ${bundle.cards.length}`);
}
for (const page of cardPages) {
  const label = `card page ${page.cardId}`;
  if (!page.cardId) fail(`${label} has no card id`);
  if ((page.parts ?? []).length === 0) fail(`${label} is empty`);
  for (const part of page.parts ?? []) {
    checkPageImage(page, part, label);
    if (part.type === "video" && (part.source !== "youtube" || !/^[A-Za-z0-9_-]{11}$/.test(part.src))) {
      fail(`${label} has a video that is not a YouTube id`);
    }
  }
}
console.log(
  `\nDictionary pages: ${packPages.length} pack, ${deckPages.length} deck, ${cardPages.length} card`,
);

console.log(`\n${failures.length === 0 ? "PASS" : "FAIL"}: ${failures.length} problem(s)`);
for (const message of failures) console.log(`  - ${message}`);
process.exitCode = failures.length === 0 ? 0 : 1;
NODE
