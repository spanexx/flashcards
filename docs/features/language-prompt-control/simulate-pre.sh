#!/usr/bin/env bash
# Design-time simulation for language-prompt-control. It mirrors the intended
# learner flow with fixed facts, before the implementation exists.

set -euo pipefail

line() { printf '\n== %s ==\n' "$1"; }
say() { printf '%s\n' "$1"; }

line "1. Create an English Adjectives pack"
say "Target language: English (en)"
say "Question language: English (en)"
say "Study instruction: Read the line, then type the missing word."
say "Prompt preview contains: 'The learner is learning English.'"
say "Prompt preview contains: 'Write full lines in English.'"
say "Prompt preview does NOT contain: 'Polish' or 'Piję kawę'."
say "Saved pack: language=en sourceLanguage=en studyInstruction='Read the line, then type the missing word.'"

line "2. Add cards inside the Polish starter pack"
say "Parent pair: target=Polish (pl), source=English (en)."
say "Type card instruction: 'Read the English line, then type the full Polish line.'"
say "Cloze card instruction: 'Fill the blank in the Polish line.'"
say "Listening card instruction: 'Listen, then type the full Polish line.'"
say "The pair and instruction are read-only in Create; the pack editor owns them."

line "3. Study a listening card without sound"
say "The card shows: Play the line / Show the text."
say "Before the click, the full line is hidden."
say "After 'Show the text', the full line is visible and the card says it is now a reading check."
say "The answer is not capped at Nearly for using the accessibility fallback."

line "4. Ask for a hint, then move on"
say "Card A starts a hint request."
say "The learner presses Next card before the provider answers."
say "Card B appears with no hint text, no hint message and no busy label from Card A."
say "The late Card A answer is discarded."

line "5. Edit the pack"
say "Packs -> Edit pack -> English Adjectives."
say "Change target to English, source to Polish, instruction to 'Translate into English.'"
say "Customize prompts: edit generation and tutor text."
say "Save: the pack row shows 'Polish -> English' and the instruction."
say "Reset to app defaults: the custom prompts are cleared, the pair and instruction stay."

line "6. Export and import"
say "Export carries language, sourceLanguage, studyInstruction and prompts."
say "Import accepts old files without the new fields."
say "An old pack shows neutral instructions until its pair is set."

line "7. What must not happen"
say "No card shows its summary before the answer."
say "No card assumes Polish when the pack says English."
say "No listening card prints its line without the learner asking."
say "No stale hint appears on a later card."
say "No prompt override changes another pack."

say "\nDesign direction confirmed: one pack-level language pair, one pack-level instruction, one pack-level prompt editor, and two study safety fixes."
