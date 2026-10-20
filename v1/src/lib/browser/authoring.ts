// WHY: A chat can write a pack, but only the app decides what is valid. This
// module builds the copyable prompt for one real target, names the exact ids the
// chat must use, and shows the one JSON shape the importer already checks.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build (ticket 17).
// 2026-10-20 opencode: real target examples and versioned prompt 1.1.0.

import type { BrowserPack } from "@/lib/browser/repository";

/** Bump when the prompt or the JSON shape it teaches changes. */
export const AUTHORING_SKILL_VERSION = "1.1.0";

export type AuthoringTarget =
  | { kind: "new"; name: string }
  | { kind: "pack"; packName: string }
  | { kind: "deck"; packName: string; deckId: string };

const COMMON_RULES = `Rules for every card:
- summary: under six words.
- prompt: an array of parts. Use {"type":"text","text":"..."} and, for a blank, {"type":"blank","id":"b1"}. For a listening card use {"type":"speak","text":"...","lang":"pl","label":"Listen"}.
- answer: an array of parts. Start with the full answer as {"type":"text","text":"..."}; add a translation as {"type":"text","text":"...","role":"translation"}.
- answerDef: one of:
  {"mode":"cloze","blanks":[{"id":"b1","expected":["..."]}]}
  {"mode":"type","expected":["..."]}
  {"mode":"picks","options":["...","..."],"correct":["..."]}
  {"mode":"hear_type","expected":["..."]}
- hints: one or two short sentences that name the rule, never the answer.
- fullLine: the complete sentence or phrase the card is built from.
- Never include a "topics" field. The deck decides the topic.
- Never include learner evidence, settings, a provider key, or a backup.`;

function shapeForDeck(deckId: string, version: string, packName: string): string {
  return `{
  "schema": "flashcards.pack/v1",
  "pack": { "name": "${packName}", "version": "${version}" },
  "decks": [],
  "cards": [
    {
      "deckId": "${deckId}",
      "summary": "Piję kawę",
      "prompt": [{"type":"text","text":"Piję "},{"type":"blank","id":"b1"},{"type":"text","text":" (kawa)."}],
      "answer": [{"type":"text","text":"Piję kawę."},{"type":"text","text":"I am drinking coffee.","role":"translation"}],
      "answerDef": {"mode":"cloze","blanks":[{"id":"b1","expected":["kawę"]}]},
      "hints": ["Drinking takes the accusative. Feminine -a turns into -ę."],
      "fullLine": "Piję kawę."
    }
  ]
}`;
}

function shapeForPack(deckId: string, deckName: string, version: string, packName: string): string {
  return `{
  "schema": "flashcards.pack/v1",
  "pack": { "name": "${packName}", "version": "${version}" },
  "decks": [
    { "id": "${deckId}", "name": "${deckName}" }
  ],
  "cards": [
    {
      "deckId": "${deckId}",
      "summary": "Dziękuję",
      "prompt": [{"type":"text","text":"How do you say “thank you”?"}],
      "answer": [{"type":"text","text":"Dziękuję."},{"type":"text","text":"Thank you.","role":"translation"}],
      "answerDef": {"mode":"type","expected":["Dziękuję","dziękuję"]},
      "hints": ["It ends in -ę, like many first-person forms."],
      "fullLine": "Dziękuję."
    }
  ]
}`;
}

/**
 * Build the whole prompt for one target. The target's real name, version and
 * deck ids are written in, so the chat never has to invent an identity.
 */
export function buildAuthoringPrompt(target: AuthoringTarget, pack?: BrowserPack | null): string {
  const header = `# Flashcards authoring skill ${AUTHORING_SKILL_VERSION}

You are writing content for a flashcards app. Answer with one JSON object and nothing else: no markdown fence, no explanation, no comments.

The app will check every card before it saves anything. If one card is wrong, the whole import is refused, so follow the shape exactly.`;

  if (target.kind === "new") {
    return `${header}

Target: a new pack named "${target.name}".

Make at least one deck. Deck ids use lowercase letters, numbers and dashes only. Every card names its deck with "deckId".

${COMMON_RULES}

Return JSON shaped like this:
${shapeForPack("basics", "Everyday basics", "1.0.0", target.name)}

Before you answer, check: every deck id is lowercase; every card has a deckId that exists in "decks"; every blank has one expected answer; every picks card has "correct" inside "options"; there is no "topics" field.`;
  }

  if (!pack) {
    throw new Error(`There is no pack "${target.packName}" here.`);
  }

  if (target.kind === "pack") {
    const deckList = pack.decks.map((deck) => `- ${deck.id} = ${deck.name}`).join("\n");
    let exampleId = "extra";
    let suffix = 2;
    while (pack.decks.some((deck) => deck.id === exampleId)) {
      exampleId = `extra-${suffix}`;
      suffix += 1;
    }
    return `${header}

Target: the existing pack "${pack.name}", version ${pack.version}.
Its decks are:
${deckList || "- (none yet)"}

You may add cards to those decks and you may add new decks. Use the existing deck ids exactly as written. A new deck id must be lowercase letters, numbers and dashes.

${COMMON_RULES}

Return JSON shaped like this (the example adds a new deck):
${shapeForPack(exampleId, "Extra deck", pack.version, pack.name)}`;
  }

  const deck = pack.decks.find((entry) => entry.id === target.deckId);
  if (!deck) throw new Error(`There is no deck "${target.deckId}" in ${pack.name}.`);
  const deckList = pack.decks.map((entry) => `- ${entry.id} = ${entry.name}`).join("\n");

  return `${header}

Target: add cards to the existing deck "${deck.name}" (id "${deck.id}") in the pack "${pack.name}", version ${pack.version}.
The pack's other decks are:
${deckList}

Return only cards for the target deck. Use "decks": [] because the deck already exists. Every card must have "deckId": "${deck.id}".

${COMMON_RULES}

Return JSON shaped like this:
${shapeForDeck(deck.id, pack.version, pack.name)}`;
}
