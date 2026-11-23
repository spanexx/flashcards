#!/usr/bin/env bash
# WHY: Post-implementation rehearsal. Reads the real generated mode files and
# proves the Track 3 contract without a network call or a build.
# PACK: built-in-modes
# 2026-11-23 opencode: created after the generator landed. [pack: built-in-modes]
# Run: bash docs/features/built-in-modes/simulate.sh
set -euo pipefail

cd "$(dirname "$0")/../../../v1"

# WHY: the generator is additive; a changed shipped pack bundle is a release
# blocker even when the mode files themselves are correct.
if ! git diff --exit-code -- public/packs > /dev/null; then
  echo "FAIL: a shipped pack bundle changed. The mode emit must be additive." >&2
  exit 1
fi

node - <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const dir = path.join(root, 'public', 'modes');
const fail = [];
const check = (ok, message) => { if (!ok) fail.push(message); };
const read = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  } catch {
    console.log(`\nFAIL: 1 problem(s)\n  - ${file} is missing or is not strict JSON`);
    process.exit(1);
  }
};

const IDS = [
  'grammar-roles',
  'language-general',
  'programming-language',
  'system-architecture',
  'word-deep-dive',
];
const STAMP = '2026-11-23T00:00:00.000Z';
const MIXES = {
  'grammar-roles': ['cloze', 'picks', 'type'],
  'language-general': ['cloze', 'type', 'hear_type', 'picks'],
  'programming-language': ['type', 'cloze', 'picks'],
  'system-architecture': ['cloze', 'picks', 'type'],
  'word-deep-dive': ['cloze', 'type', 'picks', 'match'],
};

const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
const index = read('index.json');

console.log('== 1. Five generated modes, five manifest entries ==');
console.log(`Generated files: ${files.join(', ')}`);
check(JSON.stringify(files) === JSON.stringify([...IDS.map((id) => `${id}.json`), 'index.json'].sort()), 'generated folder has exactly five modes and one index');
console.log(`Manifest entries: ${index.modes.length}`);
check(index.modes.length === 5, 'manifest holds exactly five entries');

console.log('\n== 2. Manifest shape ==');
console.log(`Schema: ${index.schema}`);
check(index.schema === 'flashcards.mode-index/v1', 'manifest schema is flashcards.mode-index/v1');
for (const entry of index.modes) {
  const keys = Object.keys(entry).sort().join(',');
  console.log(`${entry.id}: ${keys} -> ${entry.file} @ ${entry.version}`);
  check(keys === 'file,id,version', `${entry.id} manifest entry has only id, version, file`);
  check(entry.file === `/modes/${entry.id}.json`, `${entry.id} manifest file path is wrong`);
  check(entry.version === '1.0.0', `${entry.id} manifest version is not 1.0.0`);
}

console.log('\n== 3. Per-mode shape ==');
for (const id of IDS) {
  const mode = read(`${id}.json`);
  const example = mode.canonicalExample;
  const decks = example?.decks ?? [];
  const cards = example?.cards ?? [];
  const known = new Set(decks.map((deck) => deck.id));
  console.log(`${id}: version=${mode.version} builtIn=${mode.isBuiltIn} stages=${mode.usesWordStages} decks=${decks.length} cards=${cards.length}`);
  check(mode.id === id, `${id} file wears the wrong id`);
  check(mode.version === '1.0.0', `${id} version is not 1.0.0`);
  check(mode.isBuiltIn === true, `${id} is not stamped built-in`);
  check(mode.createdAt === STAMP, `${id} creation stamp is not fixed`);
  check(JSON.stringify(mode.defaultCardMix) === JSON.stringify(MIXES[id]), `${id} card mix differs from the locked set`);
  check(example?.schema === 'flashcards.pack/v1', `${id} example is not a pack bundle`);
  check(example?.pack?.name === `mode-demo-${id}`, `${id} example pack is not namespaced`);
  check(decks.length >= 1 && decks.length <= 2, `${id} example must have 1-2 decks`);
  check(cards.length >= 2 && cards.length <= 4, `${id} example must have 2-4 cards`);
  for (const card of cards) check(known.has(card.deckId), `${id} card ${card.summary} names an unknown deck`);
  for (const card of cards) {
    for (const part of card.teaching ?? []) {
      check(part.type !== 'image' && part.type !== 'video', `${id} teaching part uses a media asset`);
    }
  }
}

console.log('\n== 4. Only word-deep-dive uses word stages ==');
for (const id of IDS) {
  const mode = read(`${id}.json`);
  const staged = (mode.canonicalExample.cards ?? []).filter((card) => card.stage || card.wordId).length;
  console.log(`${id}: staged cards=${staged}`);
  check(staged > 0 === (id === 'word-deep-dive'), `${id} stage usage does not match usesWordStages`);
}

console.log('\n== 5. No demo pack is shipped ==');
const packIndex = JSON.parse(fs.readFileSync(path.join(root, 'public', 'packs', 'index.json'), 'utf8'));
const demoPacks = packIndex.packs.filter((pack) => String(pack.name).startsWith('mode-demo-'));
console.log(`Pack names: ${packIndex.packs.map((pack) => pack.name).join(', ')}`);
check(demoPacks.length === 0, 'a mode-demo pack appears in the pack manifest');

console.log('\n== 6. Shipped packs unchanged ==');
console.log('git diff --exit-code -- public/packs: clean');

console.log(`\n${fail.length === 0 ? 'PASS' : 'FAIL'}: ${fail.length} problem(s)`);
for (const message of fail) console.log(`  - ${message}`);
process.exitCode = fail.length === 0 ? 0 : 1;
NODE
