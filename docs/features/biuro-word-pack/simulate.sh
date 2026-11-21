#!/usr/bin/env bash
# Post-implementation rehearsal for the biuro exemplar pack. Unlike the design
# sim, this reads the bundle the seed actually wrote and checks the locked word
# rules against it.
set -euo pipefail
cd "$(dirname "$0")/../../../v1"

printf '\n== biuro word pack: seeded reality ==\n'
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const bundle = JSON.parse(readFileSync('public/packs/biuro.json', 'utf8'));
const index = JSON.parse(readFileSync('public/packs/index.json', 'utf8'));
const word = bundle.words[0];
const modes = { story: 'cloze', spelling: 'type', forms: 'type', dialogue: 'picks', matching: 'match' };

console.log(`pack=${bundle.pack.name} version=${bundle.pack.version} language=${bundle.pack.language} source=${bundle.pack.sourceLanguage}`);
console.log(`decks=${bundle.decks.length} words=${bundle.words.length} cards=${bundle.cards.length} pages=${bundle.pages.length}`);
console.log(`index lists biuro: ${index.packs.some(p => p.name === 'biuro' && p.version === '1.0.0')}`);
console.log(`word=${word.lemma} meaning=${word.meaning} forms=${word.forms.map(f => f.to).join(',')} pairs=${word.pairs.length}`);
for (const card of bundle.cards) {
  const expected = modes[card.stage];
  console.log(`card ${card.key}: stage=${card.stage} mode=${card.answerDef.mode} ${expected === card.answerDef.mode && card.wordId === word.id ? 'OK' : 'BROKEN'}`);
}
const pages = ['pack', 'deck', 'card'];
for (const level of pages) {
  console.log(`${level} pages=${bundle.pages.filter(p => p.level === level).length}`);
}
const cardPages = bundle.pages.filter(p => p.level === 'card');
console.log(`card pages name a card id: ${cardPages.length === bundle.cards.length && cardPages.every(p => typeof p.cardId === 'string' && p.cardId.length > 0)}`);
const allMeanings = [word.meaning, ...word.forms.map(f => f.meaning), ...word.pairs.map(p => p.meaning)];
console.log(`all meanings non-empty: ${allMeanings.every(m => typeof m === 'string' && m.trim().length > 0)}`);
console.log(`word-check runs on the seeded lesson: see the test below`);
NODE

printf '\n== the real import and lesson check ==\n'
npx vitest run tests/seed-packs.test.ts 2>&1 | tail -8

printf '\n== one folder to copy ==\n'
printf '%s\n' 'v1/packs/biuro/pack.json, words.json, cards.json, pages.json'
printf '%s\n' 'Change the word, its forms, the five cards and the five card pages; keep the stage-to-mode rule.'
