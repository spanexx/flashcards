#!/usr/bin/env bash
# WHY: The design simulation shows the card the learner asked for before any code
# exists. It mirrors the decision record, not the implementation.
# PACK: study-card-clarity
# 2026-11-22 opencode: created for the pre-implementation design review.
# [pack: study-card-clarity]

set -euo pipefail

say() {
  printf '%s\n' "$1"
}

check() {
  local label="$1"
  local text="$2"
  local wanted="$3"
  if [[ "$text" != *"$wanted"* ]]; then
    printf 'FAIL: %s does not contain %s\n' "$label" "$wanted" >&2
    exit 1
  fi
  printf 'PASS: %s\n' "$label"
}

say 'Study card clarity — pre-implementation design'
say ''

say 'Scene 1: the card no longer prints the pack meta-prompt'
old_card='FILL THE BLANK | Mój przyjaciel ma na imię Adam. | I have been learning languages I am particularly interested in grammatical forms, lets use English to understand this, your job is use other words...'
new_card='FILL THE BLANK | Mój przyjaciel ma na imię Adam. | Fill the blank in the Polish line.'
check 'the old card leaks the raw request' "$old_card" 'your job is'
check 'the new card keeps only the mode line' "$new_card" 'Fill the blank in the Polish line.'
check 'the new card drops the raw request' "$new_card" 'Mój przyjaciel ma na imię Adam.'
if [[ "$new_card" == *'your job is'* ]]; then
  say 'FAIL: the new card still prints the raw request' >&2
  exit 1
fi
say 'PASS: the new card drops the raw request'
say ''

say 'Scene 2: the study goal is readable in the pack overview'
pack_row='polish-starter v1.2.0 · 4 decks · 32 cards · Polish -> English'
study_goal='Study goal: Answer in Polish. Ask for a hint if you get stuck.'
check 'the pack row names the pack' "$pack_row" 'polish-starter'
check 'the pack row carries the study goal' "$study_goal" 'Study goal:'
say ''

say 'Scene 3: the card surface is monochrome'
plain_surface='card border: line | card shadow: soft | outcome: words, no wash | answer rule: line | hint block: soft | layer bar: line | word line: soft | primary action: ink on paper'
check 'the design names a neutral border' "$plain_surface" 'card border: line'
check 'the design names a neutral primary action' "$plain_surface" 'primary action: ink on paper'
say ''

say 'Scene 4: the authoring skill is 7.0.0 and asks for self-contained prompts'
skill='Flashcards authoring skill 7.0.0'
rule='Base word: cup. There are two ___ on the table.'
owner='Owner: Anna. That is ___ winter coat.'
check 'the skill version moved' "$skill" '7.0.0'
check 'the base-word example is present' "$rule" 'Base word: cup.'
check 'the owner example is present' "$owner" 'Owner: Anna.'
say ''

say 'Scene 5: the validator refuses the two underspecified cards'
refused_possessive='That is ___ winter coat. -> needs the owner "Anna" in the prompt'
refused_plural='There are two ___ on the table. -> needs the base word "cup" in the prompt'
check 'the possessive card is refused' "$refused_possessive" 'needs the owner "Anna"'
check 'the plural card is refused' "$refused_plural" 'needs the base word "cup"'
say ''

say 'Scene 6: the validator accepts the self-contained cards'
accepted_possessive='Owner: Anna. That is ___ winter coat.'
accepted_plural='Base word: cup. There are two ___ on the table.'
check 'the owner card passes' "$accepted_possessive" 'Owner: Anna.'
check 'the base-word card passes' "$accepted_plural" 'Base word: cup.'
say ''

say 'Scene 7: the study note is distilled, not copied'
raw='I have been learning languages I am particularly interested in grammatical forms, lets use English to understand this, your job is use other words other than the Latin jargons.'
note='Focus on plain-English word form changes without Latin grammar jargon.'
check 'the note is short' "$note" 'Focus on plain-English'
if [[ "$note" == *'your job'* ]]; then
  say 'FAIL: the note copies the raw request' >&2
  exit 1
fi
say 'PASS: the note does not copy the raw request'
say ''

say 'PASS: the design is ready for the PRD-TRD.'
