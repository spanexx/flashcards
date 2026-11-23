// WHY: The generation lane and the chat lane must teach the same card rules in
// the same words. This pure module owns those words once: layer 1 is the system
// text and the output contract, layer 2 is the universal card rules, and layer 3
// is the selected learning mode. Neither lane keeps a private copy, and a mode
// may change only layer 3. It has no browser or Node dependency, so both lanes
// and the tests can import it.
// PACK: prompt-assembler
// 2026-11-23 opencode: created with the three-layer seam. [pack: prompt-assembler]

import type { ChatMessage } from "@/lib/provider/client";
import {
  describeLibraryInventory,
  type CardStyle,
  type CreationBrief,
  type LibraryInventory,
} from "@/lib/shared/creation";
import { packLanguagePair, type PackLanguagePair } from "@/lib/shared/language";
import type { AnswerMode, StudyLevel } from "@/lib/shared/types";

/** Bump when a shared prompt string or the shape it teaches changes. */
export const PROMPT_SKILL_VERSION = "9.0.0";

/** The one line that tells a provider to answer with JSON alone. */
export const OUTPUT_CONTRACT_LINE = "Return JSON only, shaped like:";

/** The system text for a lane that writes lines inside a known container. */
export const DEFAULT_GENERATION_SYSTEM =
  "You write complete, correct study lines for one learner. You never write exercises: you write truth, and the app hides part of it.";

/** The system text for a lane that also chooses the containers themselves. */
export const STRUCTURED_SYSTEM =
  "You write complete, correct study lines for one learner and choose the containers they belong to. You never write exercises: you write truth, and the app hides part of it.";

/** The three targets a prompt can write for. Kept local so no lane owns it. */
export type PromptTarget = "lines" | "pack" | "deck";

/** The narrow facts a prompt may be given. No entity, UI text or raw answer. */
export interface PromptInputs {
  /** The subject the learner named, when one was named. */
  subject?: string;
  /** The language the cards teach. */
  targetLanguage?: string;
  /** The language questions and translations are written in. */
  questionLanguage?: string;
  /** The library reduced to names, descriptions and deck labels. */
  existingLibrarySummary?: string;
  /** The learner's own words about how to study. */
  customFocus?: string;
  /** The answer surfaces this request asks for. */
  cardMix?: readonly AnswerMode[];
  /** The level the cards are written for. */
  level?: StudyLevel;
  /** The learner's preferred way of learning. */
  learningStyle?: string;
  /** How many lines were asked for. */
  count?: number;
}

/**
 * The structural mode seam: two strings, never the whole entity. The shared
 * layer cannot depend on the Track 1 type, and a mode with no skill text is the
 * same as no mode at all.
 */
export interface ModePromptContribution {
  /** The author-written rule text the generator should follow. */
  skillInstructions: string;
  /** A compact serialised worked example, already checked by Track 1. */
  canonicalExample: string;
}

/** The exact display text and the messages sent to the provider. */
export interface BuiltPrompt {
  /** The text the learner approves before sending. */
  display: string;
  /** The system and user messages in the order the provider expects. */
  messages: ChatMessage[];
}

/** Slot values the adapter receives. Structural so no lane type is imported. */
export interface PromptProfileSlots {
  /** Weak topic category labels only. */
  weakTopics: string[];
  /** The learner's level. */
  level: StudyLevel;
  /** The learner's preferred learning style. */
  learningStyle: string;
}

/**
 * Layer 1: the system voice and the single output-contract line. The target
 * chooses the voice; the contract is deliberately the same for every target so
 * one assertion covers all three.
 */
export function layerOneSystemAndContract(target: PromptTarget): string {
  // A pack or deck chooses its containers, so it needs the longer system line.
  const system = target === "lines" ? DEFAULT_GENERATION_SYSTEM : STRUCTURED_SYSTEM;
  // WHY: the contract lives here, not in either lane, so it cannot drift.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: added the single output-contract line. [pack: prompt-assembler]
  return `${system}\n\n${OUTPUT_CONTRACT_LINE}`;
}

/**
 * The one self-contained rule both lanes teach. It names the base word and
 * owner in both the card-prompt and the full-line forms, because the generation
 * lane writes the line and the chat lane writes the card that hides it.
 */
export const SELF_CONTAINED_RULE =
  'A cloze or transformation prompt must be self-contained. When the sentence alone cannot tell the learner what to supply, name the base word, owner or context in the prompt itself: "Base word: cup. There are two ___ on the table." or "Owner: Anna. That is ___ winter coat." The fullLine behind a hidden word must name the base word or owner first: "Base word: cup. There are two cups on the table." or "Owner: Anna. That is Anna\'s winter coat." Never leave the missing word to be guessed from the deck name, the previous card or a picture.';

/** The three teaching rules shared by both lanes, in a fixed order. */
export const TEACHING_RULE_LINES = [
  // WHY: one statement of the JSON parts means a provider cannot be taught two
  // shapes. PACK: prompt-assembler
  // 2026-11-23 opencode: moved the teaching rules here. [pack: prompt-assembler]
  'A line may add "teaching": up to three parts that help before the answer. A part is {"type":"text","text":"...","lang":"..."} or {"type":"image","source":"web","src":"https://...","alt":"..."} or {"type":"video","source":"youtube","src":"<11-character video id>","search":"..."}.',
  // WHY: a teaching layer that names the answer defeats the exercise it helps.
  "A teaching part never contains the answer, the hidden word or a translation of either. Leave it out when it would only repeat the line.",
  // WHY: both old phrasings are kept so neither lane's assertion is weakened.
  "Never claim a video is verified or reliable: the app can check that a YouTube id exists, not that it still plays; nobody has checked that it still plays.",
];

/** A deck or cards bundle cannot carry words, so its lines cannot link to one. */
export const FRAGMENT_WORD_RULE =
  'This target cannot define a word. Leave "wordId" and "stage" out of every line.';

/** The word rules the generation lane can honour: it writes cloze and type. */
export const WORD_LESSON_RULE_LINES = [
  "A word lesson is one word and the cards that teach it. Write at most one word beside the lines, and make every word card belong to it.",
  'A word has "id" (lowercase slug), "lemma", "meaning", "lang" (the target language code), "forms" and "pairs".',
  'A form is {"label":"...","to":"...","meaning":"...","why":[{"type":"text","text":"..."}]}. "meaning" and "why" are in the question language; "why" explains the change and never gives a card answer.',
  'A pair is {"target":"...","meaning":"..."}; both are in the question language and must be distinct inside one word.',
  'Every word card sets "wordId" to that word\'s id and "stage" to "story", "spelling" or "forms". Stage fixes style: story is cloze, spelling and forms are type. This lane must not write "dialogue" or "matching".',
  "Never print a changed form in a card prompt or teaching part: the learner has to produce it.",
  'A forms line is a type line: it asks for the changed form, and the app turns the line into a translation prompt with one answer field — never a ___ blank.',
];

/**
 * Layer 2: the rules every card prompt repeats. The inputs are accepted for
 * the seam, but their values are never embedded here; they stay in the lane
 * that owns the slot lines.
 */
export function universalCardRules(inputs: PromptInputs = {}): string[] {
  // WHY: learner facts must not become universal rules, so this list is
  // constant. Keeping the parameter makes the seam stable for both lanes.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: created the universal rule list. [pack: prompt-assembler]
  void inputs;
  return [SELF_CONTAINED_RULE, ...TEACHING_RULE_LINES];
}

/** The fixed example note. The raw learner request never enters the shape. */
export const STUDY_NOTE_PLACEHOLDER = "<one short learner-facing sentence on how to study>";

/** One concrete line in the target language, translated into the question. */
export function exampleLine(pair: PackLanguagePair): {
  fullLine: string;
  base: string;
  target: string;
  translation: string;
  teaching: string;
} {
  // WHY: one example for both lanes means a cloze or a card cannot disagree
  // about which word is hidden. PACK: prompt-assembler
  // 2026-11-23 opencode: moved the shared example here. [pack: prompt-assembler]
  const examples: Record<string, { fullLine: string; base: string; target: string; teaching: string }> = {
    de: { fullLine: "Grundwort: Apfel. Es liegen zwei Äpfel auf dem Tisch.", base: "Apfel", target: "Äpfel", teaching: "Es wächst auf einem Baum." },
    en: { fullLine: "Base word: apple. There are two apples on the table.", base: "apple", target: "apples", teaching: "It grows on a tree." },
    es: { fullLine: "Palabra base: manzana. Hay dos manzanas sobre la mesa.", base: "manzana", target: "manzanas", teaching: "Crece en un árbol." },
    fr: { fullLine: "Mot de base: pomme. Il y a deux pommes sur la table.", base: "pomme", target: "pommes", teaching: "Il pousse sur un arbre." },
    pl: { fullLine: "Słowo podstawowe: jabłko. Na stole leżą dwa jabłka.", base: "jabłko", target: "jabłka", teaching: "Rośnie na drzewie." },
  };
  // An unknown pair falls back to English rather than guessing a language.
  const target = examples[pair.target.split("-")[0]] ?? examples.en;
  const source = examples[pair.source.split("-")[0]] ?? target;
  return {
    fullLine: target.fullLine,
    base: target.base,
    target: target.target,
    translation: source.fullLine,
    teaching: target.teaching,
  };
}

/**
 * The JSON vocabulary a rule speaks. A generation line carries a "style"
 * field; a chat card carries answerDef.mode. The rule shape is shared, but
 * the words must name the field the receiving shape actually has.
 */
export type StyleRuleVoice = "line" | "card";

/** The strings that change with the voice. Kept beside the rule, once. */
interface StyleVoicePhrases {
  mixed: string;
  fixed: (style: string) => string;
  typeKnown: (source: string, target: string) => string;
  typeUnknown: string;
  heardKnown: (target: string) => string;
  heardUnknown: string;
}

/**
 * Both voices in one table, so neither lane can edit half a rule. The card
 * strings are the old chat words, kept byte for byte so the chat keeps its own
 * wording.
 */
const STYLE_VOICE_PHRASES: Record<StyleRuleVoice, StyleVoicePhrases> = {
  line: {
    // WHY: mixed asks for varied line styles, not a style called "mixed".
    mixed:
      'Card style: mixed. Set "style" on each line to "cloze", "type" or "hear_type". A line with no style becomes a cloze card.',
    // WHY: the generation validator refuses the whole batch on a wrong style.
    fixed: (style) =>
      `Card style: ${style}. Every line must set "style": "${style}". A line with another style, or with no style, makes the app refuse the whole batch.`,
    // WHY: the learner reads a translation and types the full target line.
    typeKnown: (source, target) =>
      `Every type line must include a translation in ${source}, because the learner reads it and types the full ${target} line.`,
    typeUnknown:
      "Every type line must include a translation, because the learner sees the translation and types the full line.",
    // WHY: a heard line is spoken in the target language when one is known.
    heardKnown: (target) =>
      `Every hear_type line is spoken in ${target}, and the learner types the full ${target} line.`,
    heardUnknown:
      "Every hear_type line is spoken in the pack language when it is known, and the learner types the full line.",
  },
  card: {
    // WHY: mixed asks for varied answer modes, not a mode called "mixed".
    mixed:
      "Card style: mixed. Use a mix of cloze, type and hear_type answer modes across the cards.",
    // WHY: a card's mode lives in answerDef.mode, never in a style field.
    fixed: (style) =>
      `Card style: ${style}. Every card must build a ${style} answer. A card with another answer mode does not match the learner's request.`,
    // WHY: a type card needs a translation part to type the full target line.
    typeKnown: (source, target) =>
      `Every type card needs a translation part in ${source}, because the learner reads it and types the full ${target} line.`,
    typeUnknown:
      "Every type card needs a translation part, because the learner sees the translation and types the full line.",
    // WHY: a spoken card speaks the full line in the target language.
    heardKnown: (target) =>
      `Every hear_type card speaks the full line in ${target}, and the learner types the full ${target} line.`,
    heardUnknown:
      "Every hear_type card speaks the full line in the pack language when it is known, and the learner types the full line.",
  },
};

/**
 * Plain style rules the validator enforces, written once for both lanes.
 * The voice chooses the words; the rule structure is identical.
 */
export function cardStyleRuleLines(
  cardStyle: CardStyle,
  pair: PackLanguagePair = packLanguagePair(null),
  voice: StyleRuleVoice = "line",
): string[] {
  // WHY: both lanes import this one rule; only the vocabulary differs.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: added the card voice so chat keeps answer-mode words. [pack: prompt-assembler]
  const phrases = STYLE_VOICE_PHRASES[voice];
  if (cardStyle === "mixed") return [phrases.mixed];
  const lines = [phrases.fixed(cardStyle)];
  // WHY: a type card or line the learner reads needs a translation to type from.
  if (cardStyle === "type") {
    lines.push(
      pair.known && !pair.same
        ? phrases.typeKnown(pair.sourceName, pair.targetName)
        : phrases.typeUnknown,
    );
  }
  // WHY: a heard card or line is spoken in the target language when one is known.
  if (cardStyle === "hear_type") {
    lines.push(
      pair.target.length > 0 ? phrases.heardKnown(pair.targetName) : phrases.heardUnknown,
    );
  }
  return lines;
}

/**
 * Layer 3: the selected mode. Everything here comes from an authored mode,
 * never from learner text, a provider key or an AI-directed instruction.
 */
export function modeSection(mode?: ModePromptContribution | null): string[] {
  // WHY: an empty skill is the same as no mode, so an old caller gains no
  // mode text; the shared rule wording is the one merged wording.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: added the once-only mode section. [pack: prompt-assembler]
  if (!mode) return [];
  const skill = mode.skillInstructions.trim();
  if (skill.length === 0) return [];
  return [
    "Learning mode: follow the mode's own rules when you write this content.",
    `Mode skill instructions: ${skill}`,
    "One worked example for this mode. Copy its approach, not its words or answers:",
    `Mode canonical example: ${mode.canonicalExample}`,
  ];
}

/** What assemblePrompt needs: the lane owns the system, lines and shape text. */
export interface AssemblePromptInput {
  /** The lane's system text, from layer 1. */
  system: string;
  /** The lane's own lines, including the universal rules from layer 2. */
  lines: string[];
  /** The optional mode section, from layer 3. */
  mode?: ModePromptContribution | null;
  /** The request facts; accepted for the seam, never injected by the layer. */
  inputs?: PromptInputs;
  /** The JSON example the lane already built. */
  shape: string;
  /** The output-contract line; the shared one unless a lane overrides it. */
  contract?: string;
}

/**
 * Join the three layers in one order: lane lines, mode, contract, shape. The
 * shape stays last so the chat example-extraction helpers still find it.
 */
export function assemblePrompt(layers: AssemblePromptInput): BuiltPrompt {
  // WHY: one composer makes the ordering testable and stops a lane from
  // inserting mode text after the contract, where it would compete with the
  // real output shape. PACK: prompt-assembler
  // 2026-11-23 opencode: added the composer. [pack: prompt-assembler]
  const contract = layers.contract ?? OUTPUT_CONTRACT_LINE;
  const user = [...layers.lines, ...modeSection(layers.mode), contract, layers.shape].join("\n");
  return {
    display: `${layers.system}\n\n${user}`,
    messages: [
      { role: "system", content: layers.system },
      { role: "user", content: user },
    ],
  };
}

/**
 * Bridge an already-checked brief and a profile into the narrow prompt inputs.
 * The brief itself is never changed, so old callers keep byte-identical objects.
 */
export function promptInputsFromBrief(
  brief: CreationBrief,
  inventory: LibraryInventory,
  slots: PromptProfileSlots,
  count: number,
): PromptInputs {
  // WHY: a separate adapter keeps prompt wording out of the shared brief
  // module while avoiding a sixth copy of the brief's field names.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: added the brief adapter. [pack: prompt-assembler]
  return {
    subject: brief.subject,
    targetLanguage: brief.targetLanguage,
    questionLanguage: brief.sourceLanguage,
    existingLibrarySummary: describeLibraryInventory(inventory),
    customFocus: brief.studyInstruction,
    cardMix: brief.cardMix,
    level: slots.level,
    learningStyle: slots.learningStyle,
    count,
  };
}
