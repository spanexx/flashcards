// WHY: Prompts are built here, on the local process, and the browser only ever
// sees the finished text. The three learner categories are the only learner
// facts allowed in, and the learner's typed answer is never one of them.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: pure prompt text, safe in the browser; no server-only
// import. [pack: browser-app]
// 2026-10-22 opencode: every structured prompt now carries the learner's brief,
// the requested style and the allowed library facts. [pack: creation-control]
// 2026-10-25 opencode: generation may add a short teaching layer that never
// gives the answer away. [pack: teaching-layers]
// 2026-10-27 qoder: cards added inside a deck ask for the teaching layer too,
// because a pack's own template can leave the rule out. [D-28]

import type { Card, StudyLevel } from "@/lib/shared/types";
import type { PackPrompts, PackRecord } from "@/lib/packs/types";
import {
  describeCreationBrief,
  STUDY_NOTE_RULE,
  type CardStyle,
  type CreationBrief,
  type LibraryInventory,
} from "@/lib/shared/creation";
import { packLanguagePair, type PackLanguagePair } from "@/lib/shared/language";
import {
  assemblePrompt,
  cardStyleRuleLines,
  DEFAULT_GENERATION_SYSTEM,
  exampleLine,
  FRAGMENT_WORD_RULE,
  modeSection,
  OUTPUT_CONTRACT_LINE,
  SELF_CONTAINED_RULE,
  STRUCTURED_SYSTEM,
  STUDY_NOTE_PLACEHOLDER,
  TEACHING_RULE_LINES,
  WORD_LESSON_RULE_LINES,
  type ModePromptContribution,
  type PromptInputs,
} from "@/lib/shared/prompt-layers";

// WHY: keep the public names this module already exported, so callers and tests
// do not change while the words themselves move to the shared layer.
// PACK: prompt-assembler
// 2026-11-23 opencode: re-exported the shared prompt values. [pack: prompt-assembler]
export {
  DEFAULT_GENERATION_SYSTEM,
  STRUCTURED_SYSTEM,
  STUDY_NOTE_PLACEHOLDER,
  type BuiltPrompt,
} from "@/lib/shared/prompt-layers";
import type { BuiltPrompt } from "@/lib/shared/prompt-layers";

/** The learner categories the app owns. Packs may not add slots. */
export interface ProfileSlots {
  weakTopics: string[];
  level: StudyLevel;
  learningStyle: string;
}

/** Fill {{slots}} in a pack's own text. Unknown slots become nothing. */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => values[key] ?? "");
}

export const DEFAULT_GENERATION_TEMPLATE = [
  "Write {{count}} complete, correct lines in {{targetLanguage}} about {{topic}}.",
  "Questions, translations and explanations are in {{sourceLanguage}}.",
  "Learner level: {{level}}. Preferred learning style: {{learningStyle}}.",
  "Weak topic categories (labels only): {{weakTopics}}.",
  "Do not mention the learner or repeat their words.",
  "Vary the nouns, verbs and sentence shapes; do not reuse a line.",
  // WHY: the shared rule strings replace the private copies so the two lanes
  // can never teach different wording. [pack: prompt-assembler]
  SELF_CONTAINED_RULE,
  STUDY_NOTE_RULE,
  ...TEACHING_RULE_LINES,
  OUTPUT_CONTRACT_LINE,
  '{"lines":[{"style":"cloze","fullLine":"the complete correct line","target":"the exact word or phrase the app should hide","translation":"a plain translation","topics":["{{topic}}"],"tags":[],"summary":"one short plain sentence","teaching":[{"type":"text","text":"a short help line that never gives the answer","lang":"{{targetLanguage}}"}]}]}',
].join("\n");

export const DEFAULT_TUTOR_SYSTEM =
  "You are a patient tutor inside a flashcard session. You give one short hint. You never give the full answer, and you never scold.";

export const DEFAULT_HINT_TEMPLATE = [
  "The learner is looking at this card:",
  "{{cardText}}",
  "Topic: {{topic}}. Level: {{level}}. Learning style: {{learningStyle}}.",
  "How the last answer went: {{outcomeCategory}}.",
  "Give one short hint, one or two sentences, that nudges without revealing the answer.",
].join("\n");

/** The four defaults a pack editor shows before the learner customises them. */
export function defaultPackPrompts(): PackPrompts {
  return {
    generation: { system: DEFAULT_GENERATION_SYSTEM, template: DEFAULT_GENERATION_TEMPLATE },
    tutor: { system: DEFAULT_TUTOR_SYSTEM, hintTemplate: DEFAULT_HINT_TEMPLATE },
  };
}

/** What a structured generation prompt may know about the learner's request. */
export interface GenerationPromptContext {
  brief?: CreationBrief | null;
  inventory?: LibraryInventory;
  /** The selected mode's two prompt strings, when the learner chose one. */
  mode?: ModePromptContribution | null;
  /** The brief mapped to prompt inputs. Absent keeps the lane's old words. */
  inputs?: PromptInputs;
}

/**
 * Build the generation prompt. The pack owns the words; the app fills only
 * weak topics, level and learning style, plus the topic, count and brief the
 * learner chose on screen.
 */
export function buildGenerationPrompt(
  pack: PackRecord,
  slots: ProfileSlots,
  input: { topic: string; count: number } & GenerationPromptContext,
): BuiltPrompt {
  const system = pack.prompts?.generation.system ?? DEFAULT_GENERATION_SYSTEM;
  const ownTemplate = pack.prompts?.generation.template;
  const template = ownTemplate ?? DEFAULT_GENERATION_TEMPLATE;
  const pair = pairForPack(pack, input.brief);
  // WHY: A pack that ships its own template can leave the teaching rule out, and
  // cards added through Generate must ask for the same layer the pack and deck
  // paths ask for. The app's default template already carries these words, so
  // they are added only when a pack's own template is in use. [D-28]
  const teaching =
    ownTemplate === undefined ? [] : [SELF_CONTAINED_RULE, ...TEACHING_RULE_LINES];
  const values = {
    topic: input.topic,
    count: String(input.count),
    level: slots.level,
    learningStyle: slots.learningStyle,
    weakTopics: slots.weakTopics.length > 0 ? slots.weakTopics.join(", ") : "none known",
    targetLanguage: pair.targetName || "the target language",
    sourceLanguage: pair.sourceName || "the question language",
  };
  let user = renderTemplate(template, values);
  // A brief is appended to the pack's own words, so a pack template cannot
  // silently erase the learner's subject or the requested exercise style.
  if (input.brief) {
    const extra = [
      ...describeCreationBrief(input.brief, input.inventory ?? []),
      ...cardStyleRuleLines(input.brief.cardStyle, pair),
      ...teaching,
      FRAGMENT_WORD_RULE,
    ];
    user = `${user}\n\n${extra.join("\n")}`;
  } else {
    const pairLines = [
      ...pairPromptLines(pair, pack.studyInstruction ?? ""),
      ...teaching,
      FRAGMENT_WORD_RULE,
    ];
    if (pairLines.length > 0) user = `${user}\n\n${pairLines.join("\n")}`;
  }

  // WHY: the template carries its own rules and shape, so a contract line is
  // the one seam for mode between them. A template with no contract line gets
  // mode after the universal rules above, not between the template and them.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: moved the contract-less mode seam after the rules. [pack: prompt-assembler]
  const modeLines = modeSection(input.mode);
  if (modeLines.length > 0) {
    const contractAt = user.indexOf(OUTPUT_CONTRACT_LINE);
    if (contractAt >= 0) {
      user = `${user.slice(0, contractAt)}${modeLines.join("\n")}\n${user.slice(contractAt)}`;
    } else {
      user = `${user}\n\n${modeLines.join("\n")}`;
    }
  }

  return {
    display: `${system}\n\n${user}`,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}

/** The example style always names a concrete style; mixed is not a line style. */
function exampleStyle(cardStyle: CardStyle): string {
  return cardStyle === "mixed" ? "cloze" : cardStyle;
}

/** The pair a brief asks for, with no guess when the learner left it blank. */
function pairForBrief(brief: CreationBrief | null | undefined): PackLanguagePair {
  return packLanguagePair({
    language: brief?.targetLanguage,
    sourceLanguage: brief?.sourceLanguage,
  });
}

/** A pack's own pair wins; a brief only fills a pair the pack never declared. */
function pairForPack(
  pack: PackRecord,
  brief: CreationBrief | null | undefined,
): PackLanguagePair {
  const declared = packLanguagePair(pack);
  if (declared.target.length > 0 || declared.source.length > 0) return declared;
  return pairForBrief(brief);
}

/** Plain words that keep the pair and the pack instruction in every prompt. */
function pairPromptLines(pair: PackLanguagePair, studyInstruction = ""): string[] {
  const lines: string[] = [];
  if (pair.target.length > 0) {
    lines.push(`The learner is learning ${pair.targetName} (${pair.target}).`);
  }
  if (pair.source.length > 0) {
    lines.push(
      `Questions, translations and explanations are in ${pair.sourceName} (${pair.source}).`,
    );
  }
  if (pair.known && !pair.same) {
    lines.push(
      `Write full lines in ${pair.targetName}; write translations in ${pair.sourceName}.`,
    );
  } else if (pair.known) {
    lines.push(`Write full lines and translations in ${pair.targetName}.`);
  }
  if (studyInstruction.trim().length > 0) {
    // WHY: The stored note is a learner-facing sentence, not the raw request.
    // Naming it as the current note keeps a pack's voice without inviting a copy
    // of the learner's words. [pack: study-card-clarity]
    lines.push(`The pack's current study note is: "${studyInstruction.trim()}"`);
    // WHY: The old line told the provider to store the raw text. The note is
    // now prose the provider writes, so the current note is context only.
    // [pack: study-card-clarity]
    lines.push(
      "Write one short learner-facing study note when the app asks for one; keep the pack's current note in mind, but do not copy it.",
      STUDY_NOTE_RULE,
    );
  }
  return lines;
}

/** The example layer for one line, with the pair's language when one is known. */
function exampleTeaching(
  line: { teaching: string },
  pair: PackLanguagePair,
): Record<string, unknown> {
  return pair.target.length > 0
    ? { type: "text", text: line.teaching, lang: pair.target }
    : { type: "text", text: line.teaching };
}

/** A word and one linked card the new-pack example can copy. */
function wordLessonExample(
  pair: PackLanguagePair,
  cardStyle: CardStyle,
): { word: Record<string, unknown>; line: Record<string, unknown> } {
  const line = exampleLine(pair);
  const style = cardStyle === "hear_type" ? "cloze" : exampleStyle(cardStyle);
  const stage = style === "cloze" ? "story" : "spelling";
  const word: Record<string, unknown> = {
    id: "base-apple",
    lemma: line.base,
    meaning: line.translation,
    forms: [],
    pairs: [{ target: line.base, meaning: line.translation }],
  };
  if (pair.target.length > 0) word.lang = pair.target;
  return {
    word,
    line: {
      deckId: "basics",
      style,
      fullLine: line.fullLine,
      target: line.target,
      translation: line.translation,
      topics: ["Basics"],
      tags: [],
      summary: `Word lesson: ${line.target}`,
      teaching: [exampleTeaching(line, pair)],
      wordId: word.id,
      stage,
    },
  };
}

/** The whole-pack example, with a style the provider can copy. */
function packShape(
  cardStyle: CardStyle,
  pair: PackLanguagePair,
  includeStudyNote = false,
): string {
  const line = exampleLine(pair);
  const pack: Record<string, unknown> = {
    name: "study-pack",
    version: "1.0.0",
    description: "A short useful pack",
  };
  if (pair.target.length > 0) pack.language = pair.target;
  if (pair.source.length > 0) pack.sourceLanguage = pair.source;
  if (includeStudyNote) pack.studyInstruction = STUDY_NOTE_PLACEHOLDER;
  const lesson = wordLessonExample(pair, cardStyle);
  return JSON.stringify({
    pack,
    decks: [{ id: "basics", name: "Basics" }],
    words: [lesson.word],
    lines: [
      {
        deckId: "basics",
        style: exampleStyle(cardStyle),
        fullLine: line.fullLine,
        target: line.target,
        translation: line.translation,
        topics: ["Basics"],
        tags: [],
        summary: "Two apples",
        teaching: [exampleTeaching(line, pair)],
      },
      lesson.line,
    ],
  });
}

/** The one-new-deck example, with a style the provider can copy. */
function deckShape(cardStyle: CardStyle, pair: PackLanguagePair): string {
  const line = exampleLine(pair);
  return JSON.stringify({
    deck: { id: "extra", name: "Extra" },
    lines: [
      {
        style: exampleStyle(cardStyle),
        fullLine: line.fullLine,
        target: line.target,
        translation: line.translation,
        topics: ["Extra"],
        tags: [],
        summary: "Two apples",
        teaching: [exampleTeaching(line, pair)],
      },
    ],
  });
}

/** A generated pack chooses its own name, version, decks and lines. */
export function buildPackGenerationPrompt(
  slots: ProfileSlots,
  count: number,
  context: GenerationPromptContext = {},
): BuiltPrompt {
  const brief = context.brief ?? null;
  const inventory = context.inventory ?? [];
  const pair = pairForBrief(brief);
  const rawPreference = brief?.studyInstruction.trim() ?? "";
  const userLines = [
    `Write ${count} complete, correct study lines for a new pack.`,
    brief?.packName
      ? "Use the learner's requested pack name. The app may append a number if that name is taken."
      : "Choose a short lowercase pack name from the content, version 1.0.0, and one to three decks. Deck ids use lowercase letters, numbers and dashes.",
  ];

  if (brief) {
    userLines.push(...describeCreationBrief(brief, inventory));
    userLines.push(...cardStyleRuleLines(brief.cardStyle, pair));
  } else {
    // Legacy requests keep the old hint that keeps a pack near the learner's topics.
    const knownTopics = [...new Set(inventory.flatMap((pack) => pack.decks))];
    userLines.push(
      knownTopics.length > 0
        ? `The learner already studies these topics; stay in the same subject when it makes sense: ${knownTopics.join(", ")}.`
        : "Choose a coherent subject for the pack.",
    );
  }

  userLines.push(
    `Learner level: ${slots.level}. Preferred learning style: ${slots.learningStyle}.`,
    "Every line must name one of your decks with deckId. The app turns each line into its exercise.",
    SELF_CONTAINED_RULE,
    ...TEACHING_RULE_LINES,
    ...WORD_LESSON_RULE_LINES,
  );
  // WHY: the shared composer appends the mode section once, then the contract
  // and the shape, so a mode can never appear after the output contract.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: moved this tail onto the shared assembler. [pack: prompt-assembler]
  return assemblePrompt({
    system: STRUCTURED_SYSTEM,
    lines: userLines,
    mode: context.mode,
    inputs: context.inputs,
    shape: packShape(brief?.cardStyle ?? "mixed", pair, rawPreference.length > 0),
  });
}

/** A generated deck chooses its own name and lines inside a known pack. */
export function buildDeckGenerationPrompt(
  pack: PackRecord,
  slots: ProfileSlots,
  count: number,
  context: GenerationPromptContext = {},
): BuiltPrompt {
  const brief = context.brief ?? null;
  const inventory = context.inventory ?? [];
  const pair = pairForPack(pack, brief);
  const deckList = pack.topics.length > 0 ? pack.topics.join(", ") : "none yet";
  const userLines = [
    `Write ${count} complete, correct study lines for one new deck inside the existing pack "${pack.name}".`,
    brief?.deckName
      ? "Use the learner's requested deck name, with a lowercase id made from it. The app may append a number if that name is taken."
      : "Choose a short lowercase deck id and a plain deck label from the content. The id uses lowercase letters, numbers and dashes.",
    `The pack's existing decks are: ${deckList}. Do not reuse one of those ids.`,
  ];

  if (brief) {
    userLines.push(...describeCreationBrief(brief, inventory));
    userLines.push(...cardStyleRuleLines(brief.cardStyle, pair));
  } else {
    const pairLines = pairPromptLines(pair, pack.studyInstruction ?? "");
    if (pairLines.length > 0) userLines.push(...pairLines);
  }

  userLines.push(
    `Learner level: ${slots.level}. Preferred learning style: ${slots.learningStyle}.`,
    "The app turns each line into its exercise.",
    SELF_CONTAINED_RULE,
    ...TEACHING_RULE_LINES,
    FRAGMENT_WORD_RULE,
  );
  // WHY: the same composer keeps deck prompts in the same layer order as pack
  // prompts, so a mode changes only layer 3 in both. [pack: prompt-assembler]
  return assemblePrompt({
    system: STRUCTURED_SYSTEM,
    lines: userLines,
    mode: context.mode,
    inputs: context.inputs,
    shape: deckShape(brief?.cardStyle ?? "mixed", pair),
  });
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
