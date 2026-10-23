// WHY: A chat can write a pack, a new deck, or cards for one deck, but only the
// app decides what is valid. This module builds the copyable prompt for one real
// target, names the exact parent ids the chat must use, and shows the one JSON
// shape the matching importer checks.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build (ticket 17).
// 2026-10-21 opencode: target-first Pack/Deck/Cards prompts, skill 2.0.0.
// 2026-10-22 opencode: the learner's brief and the allowed library facts are now
// part of every target's prompt, skill 3.0.0. [pack: creation-control]

import type { BrowserPack } from "@/lib/browser/repository";
import {
  describeCreationBrief,
  type CardStyle,
  type CreationBrief,
  type LibraryInventory,
} from "@/lib/shared/creation";

/** Bump when the prompt or the JSON shape it teaches changes. */
export const AUTHORING_SKILL_VERSION = "3.0.0";

/** Where the chat is allowed to write. No learner-written name field exists. */
export type AuthoringTarget =
  | { kind: "pack" }
  | { kind: "deck"; packName: string }
  | { kind: "cards"; packName: string; deckId: string };

/** What the chat may know about the learner's goal and the existing library. */
export interface AuthoringContext {
  brief?: CreationBrief | null;
  inventory?: LibraryInventory;
}

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

function exampleCard(deckId: string): string {
  return `{
      "deckId": "${deckId}",
      "summary": "Piję kawę",
      "prompt": [{"type":"text","text":"Piję "},{"type":"blank","id":"b1"},{"type":"text","text":" (kawa)."}],
      "answer": [{"type":"text","text":"Piję kawę."},{"type":"text","text":"I am drinking coffee.","role":"translation"}],
      "answerDef": {"mode":"cloze","blanks":[{"id":"b1","expected":["kawę"]}]},
      "hints": ["Drinking takes the accusative. Feminine -a turns into -ę."],
      "fullLine": "Piję kawę."
    }`;
}

function shapeForPack(deckId: string, deckName: string): string {
  return `{
  "schema": "flashcards.pack/v1",
  "pack": { "name": "slow-polish", "version": "1.0.0" },
  "decks": [
    { "id": "${deckId}", "name": "${deckName}" }
  ],
  "cards": [
    ${exampleCard(deckId)}
  ]
}`;
}

function shapeForDeck(deckId: string, deckName: string): string {
  return `{
  "decks": [
    { "id": "${deckId}", "name": "${deckName}" }
  ],
  "cards": [
    ${exampleCard(deckId)}
  ]
}`;
}

function shapeForCards(deckId: string): string {
  return `{
  "cards": [
    ${exampleCard(deckId)}
  ]
}`;
}

/** The first new example deck id that cannot collide with an existing one. */
function exampleDeckId(pack: BrowserPack): string {
  let id = "extra";
  let suffix = 2;
  while (pack.decks.some((deck) => deck.id === id)) {
    id = `extra-${suffix}`;
    suffix += 1;
  }
  return id;
}

/** Turn the learner's style choice into card-shape words the chat can follow. */
function authoringStyleLines(cardStyle: CardStyle): string[] {
  // Mixed is a request to vary the answer mode, not a mode of its own.
  if (cardStyle === "mixed") {
    return [
      "Card style: mixed. Use a mix of cloze, type and hear_type answer modes across the cards.",
    ];
  }
  const lines = [
    `Card style: ${cardStyle}. Every card must build a ${cardStyle} answer. A card with another answer mode does not match the learner's request.`,
  ];
  // A type card cannot work without the translation it asks the learner to read.
  if (cardStyle === "type") {
    lines.push(
      "Every type card needs a translation part, because the learner sees the translation and types the full line.",
    );
  }
  // A spoken card uses the pack language when one is known.
  if (cardStyle === "hear_type") {
    lines.push(
      "Every hear_type card speaks the full line in the pack language when it is known, and the learner types the full line.",
    );
  }
  return lines;
}

/**
 * Turn the brief and inventory into a prompt section. It is empty when no brief
 * arrived, so an older caller keeps the prompt it already knew.
 */
function briefSection(context: AuthoringContext): string {
  if (!context.brief) return "";
  const lines = [
    ...describeCreationBrief(context.brief, context.inventory ?? [], {
      includeInventory: true,
    }),
    ...authoringStyleLines(context.brief.cardStyle),
  ];
  return `\n\n${lines.join("\n")}`;
}

/**
 * Build the whole prompt for one target. Parent ids are written in, so the chat
 * never has to invent an existing identity; names for a new pack or deck are
 * the chat's choice and may be suffixed by the app on a collision.
 */
export function buildAuthoringPrompt(
  target: AuthoringTarget,
  pack?: BrowserPack | null,
  context: AuthoringContext = {},
): string {
  const header = `# Flashcards authoring skill ${AUTHORING_SKILL_VERSION}

You are writing content for a flashcards app. Answer with one JSON object and nothing else: no markdown fence, no explanation, no comments.

The app will check every card before it saves anything. If one card is wrong, the whole import is refused, so follow the shape exactly.${briefSection(context)}`;

  if (target.kind === "pack") {
    const nameRule = context.brief?.packName
      ? "Use the learner's requested pack name. The app may append -2 if that name is already here."
      : "Choose a short lowercase pack name from the content. The app may append -2 if that name is already here.";
    return `${header}

Target: a new pack.
${nameRule}
Make at least one deck. Deck ids use lowercase letters, numbers and dashes only. Every card names its deck with "deckId".

${COMMON_RULES}

Return JSON shaped like this:
${shapeForPack("basics", "Everyday basics")}

Before you answer, check: every deck id is lowercase; every card has a deckId that exists in "decks"; every blank has one expected answer; every picks card has "correct" inside "options"; there is no "topics" field.`;
  }

  if (!pack) {
    throw new Error(`There is no pack "${target.packName}" here.`);
  }
  const deckList = pack.decks.map((deck) => `- ${deck.id} = ${deck.name}`).join("\n");

  if (target.kind === "deck") {
    const id = exampleDeckId(pack);
    const nameRule = context.brief?.deckName
      ? "Use the learner's requested deck name, with a lowercase id made from it. The app may append -2 to a colliding id and label."
      : "Choose short lowercase deck ids and labels for the new decks. The app may append -2 to a colliding id and label.";
    return `${header}

Target: add one or more new decks to the existing pack "${pack.name}", version ${pack.version}.
Its decks are:
${deckList || "- (none yet)"}

${nameRule}
Return only the new decks and their cards. Do not include a "pack" header, and do not reuse an existing deck id.

${COMMON_RULES}

Return JSON shaped like this:
${shapeForDeck(id, "Extra deck")}`;
  }

  const deck = pack.decks.find((entry) => entry.id === target.deckId);
  if (!deck) throw new Error(`There is no deck "${target.deckId}" in ${pack.name}.`);

  return `${header}

Target: add cards to the existing deck "${deck.name}" (id "${deck.id}") in the pack "${pack.name}", version ${pack.version}.
The pack's decks are:
${deckList}

Return only cards for the target deck. Do not include a "pack" header or a "decks" key. Every card must have "deckId": "${deck.id}".

${COMMON_RULES}

Return JSON shaped like this:
${shapeForCards(deck.id)}`;
}
