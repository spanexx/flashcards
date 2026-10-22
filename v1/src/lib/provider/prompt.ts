// WHY: Prompts are built here, on the local process, and the browser only ever
// sees the finished text. The three learner categories are the only learner
// facts allowed in, and the learner's typed answer is never one of them.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: pure prompt text, safe in the browser; no server-only
// import. [pack: browser-app]

import type { Card } from "@/lib/shared/types";
import type { PackRecord } from "@/lib/packs/types";
import type { ChatMessage } from "@/lib/provider/client";

/** The learner categories the app owns. Packs may not add slots. */
export interface ProfileSlots {
  weakTopics: string[];
  level: string;
  learningStyle: string;
}

/** A built prompt: the exact display text and the messages sent to the provider. */
export interface BuiltPrompt {
  display: string;
  messages: ChatMessage[];
}

/** Fill {{slots}} in a pack's own text. Unknown slots become nothing. */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => values[key] ?? "");
}

const DEFAULT_GENERATION_SYSTEM =
  "You write complete, correct study lines for one learner. You never write exercises: you write truth, and the app hides part of it.";

const DEFAULT_GENERATION_TEMPLATE = [
  "Write {{count}} complete, correct lines about {{topic}}.",
  "Learner level: {{level}}. Preferred learning style: {{learningStyle}}.",
  "Weak topic categories (labels only): {{weakTopics}}.",
  "Do not mention the learner or repeat their words.",
  "Vary the nouns, verbs and sentence shapes; do not reuse a line.",
  "Return JSON only, shaped like:",
  '{"lines":[{"fullLine":"the complete correct line","target":"the exact word or phrase the app should hide","translation":"a plain translation","topics":["{{topic}}"],"tags":[],"summary":"one short plain sentence"}]}',
].join("\n");

const DEFAULT_TUTOR_SYSTEM =
  "You are a patient tutor inside a flashcard session. You give one short hint. You never give the full answer, and you never scold.";

const DEFAULT_HINT_TEMPLATE = [
  "The learner is looking at this card:",
  "{{cardText}}",
  "Topic: {{topic}}. Level: {{level}}. Learning style: {{learningStyle}}.",
  "How the last answer went: {{outcomeCategory}}.",
  "Give one short hint, one or two sentences, that nudges without revealing the answer.",
].join("\n");

/**
 * Build the generation prompt. The pack owns the words; the app fills only
 * weak topics, level and learning style, plus the topic and count the learner
 * chose on screen.
 */
export function buildGenerationPrompt(
  pack: PackRecord,
  slots: ProfileSlots,
  input: { topic: string; count: number },
): BuiltPrompt {
  const system = pack.prompts?.generation.system ?? DEFAULT_GENERATION_SYSTEM;
  const template = pack.prompts?.generation.template ?? DEFAULT_GENERATION_TEMPLATE;
  const values = {
    topic: input.topic,
    count: String(input.count),
    level: slots.level,
    learningStyle: slots.learningStyle,
    weakTopics: slots.weakTopics.length > 0 ? slots.weakTopics.join(", ") : "none known",
  };
  const user = renderTemplate(template, values);
  return {
    display: `${system}\n\n${user}`,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}

const STRUCTURED_SYSTEM =
  "You write complete, correct study lines for one learner and choose the containers they belong to. You never write exercises: you write truth, and the app hides part of it.";

const PACK_SHAPE =
  '{"pack":{"name":"slow-polish","version":"1.0.0","description":"Everyday Polish","language":"pl"},"decks":[{"id":"basics","name":"Basics"}],"lines":[{"deckId":"basics","fullLine":"Piję kawę.","target":"kawę","translation":"I am drinking coffee.","topics":["Basics"],"tags":[],"summary":"Drinking coffee"}]}';

const DECK_SHAPE =
  '{"deck":{"id":"extra","name":"Extra"},"lines":[{"fullLine":"Piję kawę.","target":"kawę","translation":"I am drinking coffee.","topics":["Extra"],"tags":[],"summary":"Drinking coffee"}]}';

/** A generated pack chooses its own name, version, decks and lines. */
export function buildPackGenerationPrompt(
  slots: ProfileSlots,
  count: number,
  knownTopics: string[],
): BuiltPrompt {
  const user = [
    `Write ${count} complete, correct study lines for a new pack.`,
    "Choose a short lowercase pack name from the content, version 1.0.0, and one to three decks. Deck ids use lowercase letters, numbers and dashes.",
    knownTopics.length > 0
      ? `The learner already studies these topics; stay in the same subject when it makes sense: ${knownTopics.join(", ")}.`
      : "Choose a coherent subject for the pack.",
    `Learner level: ${slots.level}. Preferred learning style: ${slots.learningStyle}.`,
    "Every line must name one of your decks with deckId. The app hides the target inside each full line.",
    "Return JSON only, shaped like:",
    PACK_SHAPE,
  ].join("\n");
  return {
    display: `${STRUCTURED_SYSTEM}\n\n${user}`,
    messages: [
      { role: "system", content: STRUCTURED_SYSTEM },
      { role: "user", content: user },
    ],
  };
}

/** A generated deck chooses its own name and lines inside a known pack. */
export function buildDeckGenerationPrompt(
  pack: PackRecord,
  slots: ProfileSlots,
  count: number,
): BuiltPrompt {
  const deckList = pack.topics.length > 0 ? pack.topics.join(", ") : "none yet";
  const user = [
    `Write ${count} complete, correct study lines for one new deck inside the existing pack "${pack.name}".`,
    "Choose a short lowercase deck id and a plain deck label from the content. The id uses lowercase letters, numbers and dashes.",
    `The pack's existing decks are: ${deckList}. Do not reuse one of those ids.`,
    `Learner level: ${slots.level}. Preferred learning style: ${slots.learningStyle}.`,
    "The app hides the target inside each full line.",
    "Return JSON only, shaped like:",
    DECK_SHAPE,
  ].join("\n");
  return {
    display: `${STRUCTURED_SYSTEM}\n\n${user}`,
    messages: [
      { role: "system", content: STRUCTURED_SYSTEM },
      { role: "user", content: user },
    ],
  };
}

/** Pull the question text out of a card without touching the answer side. */
export function promptSideText(card: Card): string {
  return card.prompt
    .map((part) => {
      if (part.type === "text" || part.type === "code" || part.type === "speak") return part.text;
      if (part.type === "blank") return part.hint ? `___ (${part.hint})` : "___";
      return part.alt ?? "(attachment)";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a tutor hint prompt. It may see the card's question and an outcome
 * category. It never sees what the learner typed.
 */
export function buildHintPrompt(
  pack: PackRecord,
  card: Card,
  slots: ProfileSlots,
  outcomeCategory: string,
): BuiltPrompt {
  const system = pack.prompts?.tutor?.system ?? DEFAULT_TUTOR_SYSTEM;
  const template = pack.prompts?.tutor?.hintTemplate ?? DEFAULT_HINT_TEMPLATE;
  const values = {
    cardText: promptSideText(card),
    topic: card.topics.join(", "),
    level: slots.level,
    learningStyle: slots.learningStyle,
    outcomeCategory,
    weakTopics: slots.weakTopics.length > 0 ? slots.weakTopics.join(", ") : "none known",
  };
  const user = renderTemplate(template, values);
  return { display: `${system}\n\n${user}`, messages: [
    { role: "system", content: system },
    { role: "user", content: user },
  ] };
}

/** Plain words for each slot name the banner may mention. */
const SLOT_WORDS: Record<string, string> = {
  cardText: "the card's question text",
  topic: "the card's topics",
  level: "your level",
  learningStyle: "your learning style",
  outcomeCategory: "how the last answer went",
  weakTopics: "your weak topic categories",
};

/**
 * The slot names a pack's tutor template actually uses. The banner must list
 * what this pack really fills, never a hopeful fixed list.
 */
export function tutorSlotNames(pack: PackRecord): string[] {
  const template = pack.prompts?.tutor?.hintTemplate ?? DEFAULT_HINT_TEMPLATE;
  const names = new Set<string>();
  for (const match of template.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)) {
    names.add(match[1]);
  }
  return [...names];
}

/** The same list in plain words for the banner. */
export function describeTutorSlots(pack: PackRecord): string[] {
  return tutorSlotNames(pack).map((name) => SLOT_WORDS[name] ?? `the ${name} value`);
}

/** The shape shown in the per-session banner, before the learner approves it. */
export function describeTutorShape(pack: PackRecord): string {
  const system = pack.prompts?.tutor?.system ?? DEFAULT_TUTOR_SYSTEM;
  const template = pack.prompts?.tutor?.hintTemplate ?? DEFAULT_HINT_TEMPLATE;
  return `${system}\n\n${renderTemplate(template, {
    cardText: "(the card's question text)",
    topic: "(the card's topics)",
    level: "(your level)",
    learningStyle: "(your learning style)",
    outcomeCategory: "(how the last answer went: Again, Nearly or No)",
    weakTopics: "(your weak topic categories)",
  })}`;
}
