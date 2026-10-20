#!/usr/bin/env bash
# WHY: Show the browser-owned design before code exists, so the learner can see
# the shape of the flows. PACK: browser-app. 2026-10-20 opencode: design walk.
set -euo pipefail

step() { printf '\n== %s ==\n' "$1"; }
say() { printf '%s\n' "$1"; }

step "First open"
say "Library: Polish starter | version 1 | 6 decks | 32 cards"
say "Decks: cases, aspect, agreement, past-tense, basics, questions"
say "Evidence: empty"
say "Store: IndexedDB only; the host serves files."

step "Create a pack"
say "Name: music-notes  Version: 1  First deck: intervals"
say "Library: music-notes | 1 deck | 0 cards"
say "Reload the page -> music-notes is still there."

step "Write a card"
say "Deck: intervals  Front: A perfect fifth spans ___ semitones.  Back: seven"
say "The card is schedulable at once; origin says Written by the learner."

step "Import a whole pack"
say "Choose a .json file -> validator reads pack, decks, cards."
say "One broken card -> Nothing imported. cards.7.summary: every card needs a summary."
say "All good -> new pack, decks and cards appear."

step "Add to an existing pack"
say "Target: Polish starter -> deck basics -> cards.json"
say "Imported 3; 1 already in the deck; nothing deleted or moved."

step "Re-import a newer version"
say "Same name, version 2 -> new decks/cards added, evidence kept."
say "Same name, version 1.5 after 2 -> refused: the installed pack is newer."

step "Study across decks"
say "Plan draws from cases and basics; groups name the decks and the reason."
say "No key: pack hints and learner judging work."
say "With key: Test -> browser calls provider directly; prompt is shown first."

step "Backup"
say "Back up everything -> one JSON file; evidence included; key absent."
say "Restore -> confirmation -> library replaced."
say "Desktop: connect a backup file -> rewritten after each change."
say "Phone: Save a backup now."

step "Authoring skill"
say "Target: cards into polish-starter/basics."
say "Copy prompt -> chat returns JSON -> paste back -> same validator."
say "Bad answer -> refused whole, with item and field named."

step "What is deliberately absent"
say "No server API, no accounts, no cloud sync, no deck rename/delete yet."
