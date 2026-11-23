#!/usr/bin/env bash
# WHY: Design rehearsal for Track 3 before any mode file or generator exists.
# Prints the shape the five built-in modes will have, so the post-impl sim can
# be compared against it line by line.
# PACK: built-in-modes
# 2026-11-23 opencode: created from the locked GRILL and track plan. [pack: built-in-modes]
# Run: bash docs/features/built-in-modes/simulate-pre.sh
set -euo pipefail

line() { printf '\n== %s ==\n' "$1"; }
say() { printf '%s\n' "$1"; }

line "1. Five authored files, nothing else"
say "v1/modes/grammar-roles.json — cloze, picks, type; usesWordStages=false."
say "v1/modes/language-general.json — cloze, type, hear_type, picks; usesWordStages=false."
say "v1/modes/word-deep-dive.json — cloze, type, picks, match; usesWordStages=true."
say "v1/modes/system-architecture.json — cloze, picks, type; usesWordStages=false."
say "v1/modes/programming-language.json — type, cloze, picks; usesWordStages=false."
say "Every file carries version 1.0.0 and Markdown skillInstructions."

line "2. Authored mode shape"
say "id, name, description, version, defaultCardMix, usesWordStages, skillInstructions, canonicalExample."
say "No isBuiltIn and no createdAt in the authored file; the generator stamps both."
say "canonicalExample is an object, not a JSON string."
say "The embedded example is a flashcards.pack/v1 bundle: 1-2 decks, 2-4 cards."

line "3. Canonical examples pass real validators"
say "All five examples use English lines, as the GRILL locked."
say "parseBundle + hardRuleIssues + spoilerIssues + lessonIssues accept each one."
say "Cloze cards either avoid count and possessive answers or name Base word / Owner."
say "Teaching lines name the rule, never an answer token."
say "word-deep-dive has one word, 1-2 forms, 2-3 pairs, 2-3 stage cards."
say "Stage map: story=cloze, spelling=type, forms=type, dialogue=picks, matching=match."
say "No example deck invents a deckId; no example pack ships an image or video."

line "4. Generated files and manifest"
say "Generator writes v1/public/modes/<id>.json and v1/public/modes/index.json."
say "Each generated mode adds isBuiltIn=true and a fixed ISO createdAt."
say "Manifest schema is flashcards.mode-index/v1."
say "An entry is {id, version, file}; file points at /modes/<id>.json."
say "The plan's extra name field would be stripped by the reader, so it is not emitted."
say "The four shipped packs and public/packs/index.json stay byte-for-byte unchanged."

line "5. Fresh browser install"
say "Track 1's seed hook reads the manifest once on app start."
say "A fresh browser receives five built-in rows with isBuiltIn=true."
say "Each manifest file is fetched once and read through the strict mode reader."
say "No mode is selected by default; generation keeps today's wording until picked."

line "6. Re-seed and version change"
say "Second start with the same 1.0.0 manifest fetches no mode files: idempotent."
say "A later 1.1.0 manifest replaces that built-in row only."
say "A learner-owned copy with the same id is never replaced."

line "7. Broken input stays isolated"
say "Wrong manifest schema: nothing installed, no crash."
say "One broken mode file: that mode stays as it was, the other four still install."
say "A file whose id disagrees with the manifest entry is skipped."
say "Next start retries the skipped file."

line "8. What must not happen"
say "No mode-demo-* pack appears in the pack list or /api/packs."
say "No built-in can be edited in place; a learner must duplicate it first."
say "No teaching part points at a pack-local image or video."
say "No Track 1 file changes: router, seed, repository, store, schema, validators."
say "No learner's own mode is overwritten or deleted by a seed."

line "9. Design direction"
say "Direction: five small, strict, English examples; additive generator; no UI; no default mode."
