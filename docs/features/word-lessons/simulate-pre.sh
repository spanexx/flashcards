#!/usr/bin/env bash
# Design-time simulation for word-lessons. It mirrors the intended learner flow
# with fixed facts, before the implementation exists. It prints the expected
# sentences and states, so a later post-impl simulation can be compared against
# it line by line.

set -euo pipefail

line() { printf '\n== %s ==\n' "$1"; }
say() { printf '%s\n' "$1"; }

line "1. A language pack declares one word and five leaves"
say "Word: id=biuro lemma=biuro meaning=office lang=pl"
say "Form: label=locative to=biurze meaning=in the office why=[text: 'After w, neuter -o becomes -e.']"
say "Pairs: biuro=office, biurze=in the office, biura=of the office"
say "Cards: story(cloze), spelling(type), forms(type), dialogue(picks), matching(match)"
say "Every card names wordId=biuro and its stage."
say "The five cards import as one bundle."

line "2. The plan keeps the lesson together"
say "Scope: pack=polish-starter, deck=cases."
say "The algorithm selects the forms and story cards."
say "Order presented: story, then forms."
say "The two cards are adjacent; no unrelated card sits between them."
say "A stage the pack did not write never appears as an empty card."

line "3. Story stage"
say "Prompt: 'Pracuję w ___.'  (biuro)  [cloze]"
say "Word line above the card: 'biuro — office'. 'biuro -> biurze' appears only after the answer."
say "The learner types 'biurze'."
say "Answer: correct. Evidence row written once, cardId is the story card."

line "4. Forms stage"
say "The card shows: 'biuro -> ___'"
say "Then the why: 'After w, neuter -o becomes -e.'"
say "Then the fresh sentence: 'Jestem w ___.'"
say "The learner types 'biurze'."
say "The existing type judge runs. Mode is still 'type', not a new surface."

line "5. Forms is skipped when a word has no forms"
say "Word: id=kawa lemma=kawa meaning=coffee forms=[]"
say "Cards: story, spelling, dialogue, matching. No forms card."
say "The lesson runs story -> spelling -> dialogue -> matching."
say "Nothing renders an empty forms screen. Nothing says 'forms unavailable'."

line "6. Matching stage"
say "Left column, shuffled: biurze | biuro | biura"
say "Right column, shuffled independently: of the office | office | in the office"
say "Tap 'biurze', then 'in the office': pair locks, both fade."
say "Tap 'biuro', then 'of the office': wrong. One shake, both clear."
say "Finish all three: outcome got_it."
say "Finish two of three then press Check: outcome nearly."
say "Press Check with none matched: outcome no."
say "One evidence row for the card. No row per pair."

line "7. Help comes from one place, in one order"
say "Card has its own teaching: the card's teaching is shown. Word note is not repeated."
say "Card has no teaching, word has a note: the note is shown."
say "Neither, but a card page exists: the page's parts are shown."
say "None of the three: no help block, no empty box, no placeholder."

line "8. A non-language pack is untouched"
say "Pack: system-design. It has no words array."
say "Every card has no wordId and no stage."
say "Cards import, study and export exactly as before."
say "No word line appears above any card."

line "9. Import refuses a broken lesson, all at once"
say "Card 3 (\"Piję kawę\"): stage \"forms\" needs at least one form on word \"kawa\"."
say "Card 2 (\"Biuro\"): stage \"dialogue\" needs a picks card, not type."
say "Card 4 (\"Match\"): stage \"matching\" needs at least two pairs on word \"biuro\"."
say "Card 5 (\"Link\"): names word \"kawaa\", which this pack does not define."
say "Word 2 (\"kawa\"): two pairs share the target \"kawa\"."
say "Nothing from that bundle is written. The library is unchanged."

line "10. Creation brief names the focus word"
say "Brief: subject='Locative case practice', targetLanguage=pl, focusWord='biuro'."
say "Installed pack polish-starter already has lemma 'biuro': the screen suggests it and shows (Polish)."
say "Focus word 'ksiazka' not in any installed pack: accepted, no error."
say "Both prompt lanes carry: 'Build the whole lesson around the word \"biuro\".'"
say "The generated bundle returns words[] and stage cards, not five unrelated lines."

line "11. What must not happen"
say "No card is judged twice because it carries a word link."
say "No evidence is lost when a shipped card gains a wordId."
say "No word line appears on a card with no word."
say "No matching card is answerable by typing."
say "No stage card is accepted with the wrong answer mode."
say "No half-written lesson reaches storage."

say "\nDesign direction confirmed: one optional Word trunk, one new Matching surface, four existing answer surfaces reused, and strict all-or-nothing validation."
