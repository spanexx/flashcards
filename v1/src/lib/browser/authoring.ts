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
import { packLanguagePair, type PackLanguagePair } from "@/lib/shared/language";

/** Bump when the prompt or the JSON shape it teaches changes. */
export const AUTHORING_SKILL_VERSION = "4.0.0";

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

/** A short concrete line in the target language, translated into the source. */
function exampleLine(pair: PackLanguagePair): {
  fullLine: string;
  target: string;
  translation: string;
} {
  const examples: Record<string, { fullLine: string; target: string }> = {
    de: { fullLine: "Der Apfel ist süß.", target: "süß" },
    en: { fullLine: "The red apple is sweet.", target: "sweet" },
    es: { fullLine: "La manzana es dulce.", target: "dulce" },
    fr: { fullLine: "La pomme est sucrée.", target: "sucrée" },
    pl: { fullLine: "Czerwone jabłko jest słodkie.", target: "słodkie" },
  };
  const target = examples[pair.target.split("-")[0]] ?? examples.en;
  const source = examples[pair.source.split("-")[0]] ?? target;
  return { fullLine: target.fullLine, target: target.target, translation: source.fullLine };
}

function commonRules(pair: PackLanguagePair): string {
  const speakLang = pair.target || "the target language code";
  return `Rules for every card:
- summary: under six words.
- prompt: an array of parts. Use {"type":"text","text":"..."} and, for a blank, {"type":"blank","id":"b1"}. For a listening card use {"type":"speak","text":"...","lang":"${speakLang}","label":"Listen"}.
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
}

function exampleCard(deckId: string, pair: PackLanguagePair): string {
  const line = exampleLine(pair);
  const before = line.fullLine.slice(0, line.fullLine.indexOf(line.target));
  const after = line.fullLine.slice(
    line.fullLine.indexOf(line.target) + line.target.length,
  );
  return `{
      "deckId": ${JSON.stringify(deckId)},
      "summary": "A sweet fruit",
      "prompt": [{"type":"text","text":${JSON.stringify(before)}},{"type":"blank","id":"b1"},{"type":"text","text":${JSON.stringify(after)}}],
      "answer": [{"type":"text","text":${JSON.stringify(line.fullLine)}},{"type":"text","text":${JSON.stringify(line.translation)},"role":"translation"}],
      "answerDef": {"mode":"cloze","blanks":[{"id":"b1","expected":[${JSON.stringify(line.target)}]}]},
      "hints": ["Name the grammar rule, not the missing word."],
      "fullLine": ${JSON.stringify(line.fullLine)}
    }`;
}

function packHeader(pair: PackLanguagePair, studyInstruction = ""): Record<string, string> {
  const pack: Record<string, string> = { name: "study-pack", version: "1.0.0" };
  if (pair.target.length > 0) pack.language = pair.target;
  if (pair.source.length > 0) pack.sourceLanguage = pair.source;
  if (studyInstruction.trim().length > 0) pack.studyInstruction = studyInstruction.trim();
  return pack;
}

function shapeForPack(
  deckId: string,
  deckName: string,
  pair: PackLanguagePair,
  studyInstruction = "",
): string {
  return `{
  "schema": "flashcards.pack/v1",
  "pack": ${JSON.stringify(packHeader(pair, studyInstruction))},
  "decks": [
    { "id": ${JSON.stringify(deckId)}, "name": ${JSON.stringify(deckName)} }
  ],
  "cards": [
    ${exampleCard(deckId, pair)}
  ]
}`;
}

function shapeForDeck(
  deckId: string,
  deckName: string,
  pair: PackLanguagePair,
): string {
  return `{
  "decks": [
    { "id": ${JSON.stringify(deckId)}, "name": ${JSON.stringify(deckName)} }
  ],
  "cards": [
    ${exampleCard(deckId, pair)}
  ]
}`;
}

function shapeForCards(deckId: string, pair: PackLanguagePair): string {
  return `{
  "cards": [
    ${exampleCard(deckId, pair)}
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
function authoringStyleLines(cardStyle: CardStyle, pair: PackLanguagePair): string[] {
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
      pair.known && !pair.same
        ? `Every type card needs a translation part in ${pair.sourceName}, because the learner reads it and types the full ${pair.targetName} line.`
        : "Every type card needs a translation part, because the learner sees the translation and types the full line.",
    );
  }
  // A spoken card uses the pack language when one is known.
  if (cardStyle === "hear_type") {
    lines.push(
      pair.target.length > 0
        ? `Every hear_type card speaks the full line in ${pair.targetName}, and the learner types the full ${pair.targetName} line.`
        : "Every hear_type card speaks the full line in the pack language when it is known, and the learner types the full line.",
    );
  }
  return lines;
}

/** The pair a brief asks for, or the pair the existing pack already declares. */
function promptPair(
  pack: BrowserPack | null | undefined,
  brief: CreationBrief | null | undefined,
): PackLanguagePair {
  const declared = packLanguagePair(pack);
  if (declared.target.length > 0 || declared.source.length > 0) return declared;
  return packLanguagePair({
    language: brief?.targetLanguage,
    sourceLanguage: brief?.sourceLanguage,
  });
}

/**
 * Turn the brief and inventory into a prompt section. It is empty when no brief
 * arrived, so an older caller keeps the prompt it already knew.
 */
function briefSection(context: AuthoringContext, pair: PackLanguagePair): string {
  if (!context.brief) return "";
  const lines = [
    ...describeCreationBrief(context.brief, context.inventory ?? [], {
      includeInventory: true,
    }),
    ...authoringStyleLines(context.brief.cardStyle, pair),
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
  const pair = promptPair(pack, context.brief);
  const studyInstruction = context.brief?.studyInstruction ?? pack?.studyInstruction ?? "";
  const pairSection = context.brief
    ? ""
    : [
        pair.target.length > 0 ? `The learner is learning ${pair.targetName}.` : "",
        pair.source.length > 0
          ? `Questions, translations and explanations are in ${pair.sourceName}.`
          : "",
        studyInstruction.trim().length > 0
          ? `Store this study instruction on the pack: "${studyInstruction.trim()}"`
          : "",
      ]
        .filter((line) => line.length > 0)
        .join("\n");
  const header = `# Flashcards authoring skill ${AUTHORING_SKILL_VERSION}

You are writing content for a flashcards app. Answer with one JSON object and nothing else: no markdown fence, no explanation, no comments.

The app will check every card before it saves anything. If one card is wrong, the whole import is refused, so follow the shape exactly.${briefSection(context, pair)}${pairSection ? `\n\n${pairSection}` : ""}`;
  const rules = commonRules(pair);

  if (target.kind === "pack") {
    const nameRule = context.brief?.packName
      ? "Use the learner's requested pack name. The app may append -2 if that name is already here."
      : "Choose a short lowercase pack name from the content. The app may append -2 if that name is already here.";
    return `${header}

Target: a new pack.
${nameRule}
Make at least one deck. Deck ids use lowercase letters, numbers and dashes only. Every card names its deck with "deckId".

${rules}

Return JSON shaped like this:
${shapeForPack("basics", "Everyday basics", pair, studyInstruction)}

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

${rules}

Return JSON shaped like this:
${shapeForDeck(id, "Extra deck", pair)}`;
  }

  const deck = pack.decks.find((entry) => entry.id === target.deckId);
  if (!deck) throw new Error(`There is no deck "${target.deckId}" in ${pack.name}.`);

  return `${header}

Target: add cards to the existing deck "${deck.name}" (id "${deck.id}") in the pack "${pack.name}", version ${pack.version}.
The pack's decks are:
${deckList}

Return only cards for the target deck. Do not include a "pack" header or a "decks" key. Every card must have "deckId": "${deck.id}".

${rules}

Return JSON shaped like this:
${shapeForCards(deck.id, pair)}`;
}
