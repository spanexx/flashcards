#!/usr/bin/env bash
# Design-time simulation for the biuro exemplar pack. It shows the operator flow
# before the pack files exist, with fixed facts, so the post-impl sim can be
# compared against it.
set -euo pipefail
line() { printf '\n== %s ==\n' "$1"; }
say() { printf '%s\n' "$1"; }

line "1. The author writes one pack folder"
say "packs/biuro/pack.json: name=biuro version=1.0.0 language=pl sourceLanguage=en"
say "topics: [at-the-office] -> one deck labelled At the office"
say "packs/biuro/words.json: one word biuro, meaning 'office', four forms, five pairs"
say "packs/biuro/cards.json: five cards, each with wordId=biuro and its stage"

line "2. The seed builds the static bundle"
say "make-seed.mjs lists biuro in seedPacks and copies words into the bundle"
say "public/packs/biuro.json carries pack, decks, words, cards and pages"

line "3. The learner sees a short lesson"
say "story: Pracuję w ___ -> biurze"
say "spelling: the English line is shown, the learner types biuro"
say "forms: biuro -> ___, why: the locative after w takes -e and r softens to rz"
say "dialogue: Gdzie pracujesz? -> W biurze."
say "matching: base and four forms paired with exact English meanings"

line "4. The Dictionary reads the same lesson"
say "pack page: what this word pack teaches"
say "deck page: the five stages in order"
say "five card pages: form, meaning and use, in text teaching parts"

line "5. What must not happen"
say "No card is added through the browser UI."
say "No new word field, answer surface or page level is invented."
say "No wrong stage-to-mode pair reaches the importer."
say "Another author can copy the folder and change the word."
