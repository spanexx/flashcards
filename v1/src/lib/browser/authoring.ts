// WHY: A chat can write a pack, a new deck, or cards for one deck, but only the
// app decides what is valid. This module builds the copyable prompt for one real
// target, names the exact parent ids the chat must use, and shows the one JSON
// shape the matching importer checks.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build (ticket 17).
// 2026-10-21 opencode: target-first Pack/Deck/Cards prompts, skill 2.0.0.
// 2026-10-22 opencode: the learner's brief and the allowed library facts are now
// part of every target's prompt, skill 3.0.0. [pack: creation-control]
// 2026-10-25 opencode: the prompt teaches an optional layer that helps without
// giving the answer away, skill 5.0.0. [pack: teaching-layers]

import type { BrowserPack } from "@/lib/browser/repository";
import {
  describeCreationBrief,
  STUDY_NOTE_RULE,
  type CardStyle,
  type CreationBrief,
  type LibraryInventory,
} from "@/lib/shared/creation";
import { packLanguagePair, type PackLanguagePair } from "@/lib/shared/language";

/** Bump when the prompt or the JSON shape it teaches changes. */
export const AUTHORING_SKILL_VERSION = "8.0.0";

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
  teaching: string;
} {
  const examples: Record<string, { fullLine: string; target: string; teaching: string }> = {
    de: { fullLine: "Grundwort: Apfel. Es liegen zwei Äpfel auf dem Tisch.", target: "Äpfel", teaching: "Es wächst auf einem Baum." },
    en: { fullLine: "Base word: apple. There are two apples on the table.", target: "apples", teaching: "It grows on a tree." },
    es: { fullLine: "Palabra base: manzana. Hay dos manzanas sobre la mesa.", target: "manzanas", teaching: "Crece en un árbol." },
    fr: { fullLine: "Mot de base: pomme. Il y a deux pommes sur la table.", target: "pommes", teaching: "Il pousse sur un arbre." },
    pl: { fullLine: "Słowo podstawowe: jabłko. Na stole leżą dwa jabłka.", target: "jabłka", teaching: "Rośnie na drzewie." },
  };
  const target = examples[pair.target.split("-")[0]] ?? examples.en;
  const source = examples[pair.source.split("-")[0]] ?? target;
  return {
    fullLine: target.fullLine,
    target: target.target,
    translation: source.fullLine,
    teaching: target.teaching,
  };
}

function commonRules(pair: PackLanguagePair): string {
  const speakLang = pair.target || "the target language code";
  return `Rules for every card:
- summary: under six words.
- prompt: an array of parts. Use {"type":"text","text":"...","lang":"<language code>"} and, for a blank, {"type":"blank","id":"b1"}. For a listening card use {"type":"speak","text":"...","lang":"${speakLang}","label":"Listen"}.
- answer: an array of parts. Start with the full answer as {"type":"text","text":"...","lang":"${speakLang}"}; add a translation as {"type":"text","text":"...","role":"translation","lang":"<question language code>"}.
- Every text part carries the language code its words are in. When a line switches language, use separate text parts, so each can be read with the right voice.
- answerDef: one of:
  {"mode":"cloze","blanks":[{"id":"b1","expected":["..."]}]}
  {"mode":"type","expected":["..."]}
  {"mode":"picks","options":["...","..."],"correct":["..."]}
  {"mode":"hear_type","expected":["..."]}
- hints: one or two short sentences that name the rule, never the answer.
- A cloze or transformation prompt must be self-contained. When the sentence alone cannot tell the learner what to supply, name the base word, owner or context in the prompt itself:
  "Base word: cup. There are two ___ on the table."
  "Owner: Anna. That is ___ winter coat."
  Never leave the missing word to be guessed from the deck name, the previous card or a picture.
- A forms card is a type card, not a cloze: its prompt names the change and asks for the changed form in words, for example "Type the genitive form of \"the base word\":". Do not write a ___ blank in a forms prompt; the learner types the answer in the answer field.
- fullLine: the complete sentence or phrase the card is built from.
- teaching: optional, at most three parts. Each part is one of:
  {"type":"text","text":"...","lang":"${speakLang}"}
  {"type":"image","source":"web","src":"https://...","alt":"..."}
  {"type":"video","source":"youtube","src":"<11-character video id>","search":"..."}
- A teaching part helps before the answer. It never contains the answer, the missing word, or a translation of either.
- A picture or video earns its place only when it teaches the same point. A web address starts with https://; alt text describes the picture; a YouTube source is the video id alone, and nobody has checked that it still plays.
- Leave "teaching" out when a short layer would only repeat the prompt.
- Never include a "topics" field. The deck decides the topic.
- Never include learner evidence, settings, a provider key, or a backup.`;
}

function exampleCard(deckId: string, pair: PackLanguagePair): string {
  const line = exampleLine(pair);
  const before = line.fullLine.slice(0, line.fullLine.indexOf(line.target));
  const after = line.fullLine.slice(
    line.fullLine.indexOf(line.target) + line.target.length,
  );
  const teaching = pair.target
    ? `{"type":"text","text":${JSON.stringify(line.teaching)},"lang":${JSON.stringify(pair.target)}}`
    : `{"type":"text","text":${JSON.stringify(line.teaching)}}`;
  const targetLang = pair.target ? `,"lang":${JSON.stringify(pair.target)}` : "";
  const sourceLang = pair.source ? `,"lang":${JSON.stringify(pair.source)}` : "";
  return `{
      "deckId": ${JSON.stringify(deckId)},
      "summary": "Two apples",
      "prompt": [{"type":"text","text":${JSON.stringify(before)}${targetLang}},{"type":"blank","id":"b1"},{"type":"text","text":${JSON.stringify(after)}${targetLang}}],
      "answer": [{"type":"text","text":${JSON.stringify(line.fullLine)}${targetLang}},{"type":"text","text":${JSON.stringify(line.translation)},"role":"translation"${sourceLang}}],
      "answerDef": {"mode":"cloze","blanks":[{"id":"b1","expected":[${JSON.stringify(line.target)}]}]},
      "hints": ["Name the grammar rule, not the missing word."],
      "fullLine": ${JSON.stringify(line.fullLine)},
      "teaching": [${teaching}]
    }`;
}

/**
 * One whole lesson for the pack example: a word, its changes, and exactly the
 * five stage cards. The values name their job rather than a real language, so
 * the example teaches the shape without claiming a false grammar rule.
 */
function wordLessonExample(deckId: string, pair: PackLanguagePair) {
  const id = "the-word-id";
  const lang = pair.target ? { lang: pair.target } : {};
  const text = (value: string) => ({ type: "text", text: value, ...lang });
  const word = {
    id,
    lemma: "the base word",
    meaning: "its meaning in the question language",
    ...lang,
    forms: [
      {
        label: "the change, e.g. locative",
        to: "the changed form",
        meaning: "what the changed form means",
        why: [{ type: "text", text: "why it changes, in the question language" }],
        use: "A fresh sentence that uses the changed form.",
      },
    ],
    pairs: [
      { target: "the base word", meaning: "its meaning" },
      { target: "the changed form", meaning: "the changed meaning" },
    ],
  };
  const cards = [
    {
      deckId,
      wordId: id,
      stage: "story",
      summary: "Story: the word in a line",
      prompt: [text("Base word: the base word. A line with "), { type: "blank", id: "b1" }, text(".")],
      answer: [text("A line with the changed form.")],
      answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["the changed form"] }] },
      hints: ["Name the rule, not the form."],
      fullLine: "A line with the changed form.",
    },
    {
      deckId,
      wordId: id,
      stage: "spelling",
      summary: "Spelling: the base word",
      prompt: [text("Type the base word.")],
      answer: [text("the base word")],
      answerDef: { mode: "type", expected: ["the base word"] },
      hints: ["Think of the dictionary form."],
      fullLine: "the base word",
    },
    {
      deckId,
      wordId: id,
      stage: "forms",
      summary: "Forms: change the word",
      prompt: [text('Type the changed form of "the base word":')],
      answer: [text("the changed form")],
      answerDef: { mode: "type", expected: ["the changed form"] },
      hints: ["The word's reason explains this change."],
      fullLine: "the base word -> the changed form",
    },
    {
      deckId,
      wordId: id,
      stage: "dialogue",
      summary: "Dialogue: pick the right line",
      prompt: [text("Which line is correct?")],
      answer: [text("The right line.")],
      answerDef: {
        mode: "picks",
        options: ["The right line.", "The wrong line."],
        correct: ["The right line."],
      },
      hints: ["Listen for the changed form."],
      fullLine: "The right line.",
    },
    {
      deckId,
      wordId: id,
      stage: "matching",
      summary: "Match the word",
      prompt: [text("Match each form with its meaning.")],
      answer: [text("Every pair matches.")],
      answerDef: { mode: "match" },
      hints: ["Meanings are in the question language."],
      fullLine: "Match each form with its meaning.",
    },
  ];
  return { word, cards };
}

/** The fixed example note. The raw learner request never enters the shape. */
const STUDY_NOTE_PLACEHOLDER = "<one short learner-facing sentence on how to study>";

function packHeader(
  pair: PackLanguagePair,
  includeStudyNote = false,
): Record<string, string> {
  const pack: Record<string, string> = { name: "study-pack", version: "1.0.0" };
  if (pair.target.length > 0) pack.language = pair.target;
  if (pair.source.length > 0) pack.sourceLanguage = pair.source;
  if (includeStudyNote) pack.studyInstruction = STUDY_NOTE_PLACEHOLDER;
  return pack;
}

function shapeForPack(
  deckId: string,
  deckName: string,
  pair: PackLanguagePair,
  includeStudyNote = false,
): string {
  const lesson = wordLessonExample(deckId, pair);
  return `{
  "schema": "flashcards.pack/v1",
  "pack": ${JSON.stringify(packHeader(pair, includeStudyNote))},
  "decks": [
    { "id": ${JSON.stringify(deckId)}, "name": ${JSON.stringify(deckName)} }
  ],
  "words": [
    ${JSON.stringify(lesson.word, null, 2).replace(/\n/g, "\n    ")}
  ],
  "cards": [
    ${exampleCard(deckId, pair)},
    ${lesson.cards.map((card) => JSON.stringify(card, null, 2).replace(/\n/g, "\n    ")).join(",\n    ")}
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
  const rawPreference = context.brief?.studyInstruction.trim() ?? "";
  const existingNote = pack?.studyInstruction?.trim() ?? "";
  const pairSection = context.brief
    ? ""
    : [
        pair.target.length > 0 ? `The learner is learning ${pair.targetName}.` : "",
        pair.source.length > 0
          ? `Questions, translations and explanations are in ${pair.sourceName}.`
          : "",
        existingNote.length > 0
          ? `The pack's current study note is: "${existingNote}"`
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

A pack may carry one "words" array beside "cards". Write at most one word: "id" (lowercase slug), "lemma", "meaning", "lang" (the target code), "forms" and "pairs". A form has "label", "to", "meaning" and at least one "why"; a pair has "target" and "meaning". Every meaning is in the question language, never a hard-coded English word.
Every word card sets "wordId" to that word's id and "stage" to one of story, spelling, forms, dialogue, matching. Stage fixes the answer mode: story is cloze, spelling and forms are type, dialogue is picks, matching is match. Skip forms when the word has no forms and matching when it has fewer than two pairs. Never print a changed form in a card prompt or teaching part: the learner must produce it.
${STUDY_NOTE_RULE}

${rules}

Return JSON shaped like this:
${shapeForPack("basics", "Everyday basics", pair, rawPreference.length > 0)}

Before you answer, check: every deck id is lowercase; every card has a deckId that exists in "decks"; every blank has one expected answer; every picks card has "correct" inside "options"; every cloze prompt names its base word, owner or context; a forms prompt asks for the changed form in words and has no ___ blank; the study note is one short learner-facing sentence; there is no "topics" field; and no teaching part gives the answer away.`;
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
Return only the new decks and their cards. Do not include a "pack" header, a "words" key, or an existing deck id. A fragment cannot define a word, so leave "wordId" and "stage" out.

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

Return only cards for the target deck. Do not include a "pack" header, a "decks" key or a "words" key. Every card must have "deckId": "${deck.id}". A fragment cannot define a word, so leave "wordId" and "stage" out.

${rules}

Return JSON shaped like this:
${shapeForCards(deck.id, pair)}`;
}
