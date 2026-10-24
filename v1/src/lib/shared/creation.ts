// WHY: The creation brief is the learner's intent and it must mean the same
// thing in Generate, Chat and the router. Keeping its shape, defaults and
// refusals in one pure module stops three callers from inventing three rules.
// PACK: creation-control
// 2026-10-22 opencode: created for the creation-control pack [pack: creation-control]
// 2026-10-23 opencode: the brief now names the pack's target and question
// languages and its study instruction. [pack: language-prompt-control]

import { languageName, normalizeLanguage } from "@/lib/shared/language";

/** The four choices the Create screen offers for card style. */
export const CARD_STYLES = ["mixed", "cloze", "type", "hear_type"] as const;

/** The styles the learner may request for one batch. */
export type CardStyle = (typeof CARD_STYLES)[number];

/** The three concrete styles a generated line may name. */
export const GENERATED_CARD_STYLES = ["cloze", "type", "hear_type"] as const;

/** A generated line may only use a concrete style; mixed is a request, not an output. */
export type GeneratedCardStyle = (typeof GENERATED_CARD_STYLES)[number];

/** Who chooses what the cards teach. */
export type SubjectMode = "learner" | "provider";

/** Everything the learner controls when they ask for new cards. */
export interface CreationBrief {
  subjectMode: SubjectMode;
  subject: string;
  deckFocus: string;
  cardStyle: CardStyle;
  packName: string;
  deckName: string;
  targetLanguage: string;
  sourceLanguage: string;
  studyInstruction: string;
}

/** A blank brief is a learner brief with no subject, ready for the screen to fill. */
export const DEFAULT_CREATION_BRIEF: CreationBrief = {
  subjectMode: "learner",
  subject: "",
  deckFocus: "",
  cardStyle: "mixed",
  packName: "",
  deckName: "",
  targetLanguage: "",
  sourceLanguage: "en",
  studyInstruction: "",
};

/** True when a value is one of the four styles the screen may send. */
export function isCardStyle(value: unknown): value is CardStyle {
  return typeof value === "string" && (CARD_STYLES as readonly string[]).includes(value);
}

/** True when a value is one of the three styles a generated line may carry. */
export function isGeneratedCardStyle(value: unknown): value is GeneratedCardStyle {
  return typeof value === "string" && (GENERATED_CARD_STYLES as readonly string[]).includes(value);
}

/** Make a brief from the defaults, changing only the fields a caller names. */
export function defaultCreationBrief(overrides: Partial<CreationBrief> = {}): CreationBrief {
  return {
    subjectMode: overrides.subjectMode ?? DEFAULT_CREATION_BRIEF.subjectMode,
    subject: overrides.subject ?? DEFAULT_CREATION_BRIEF.subject,
    deckFocus: overrides.deckFocus ?? DEFAULT_CREATION_BRIEF.deckFocus,
    cardStyle: overrides.cardStyle ?? DEFAULT_CREATION_BRIEF.cardStyle,
    packName: overrides.packName ?? DEFAULT_CREATION_BRIEF.packName,
    deckName: overrides.deckName ?? DEFAULT_CREATION_BRIEF.deckName,
    targetLanguage: overrides.targetLanguage ?? DEFAULT_CREATION_BRIEF.targetLanguage,
    sourceLanguage: overrides.sourceLanguage ?? DEFAULT_CREATION_BRIEF.sourceLanguage,
    studyInstruction: overrides.studyInstruction ?? DEFAULT_CREATION_BRIEF.studyInstruction,
  };
}

/** A checked brief, or a plain reason the router can show without guessing. */
export type BriefValidation = { ok: true; brief: CreationBrief } | { ok: false; message: string };

/** Read one optional text field and trim it; a non-string is a refusal, not a guess. */
function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  return value.trim();
}

/**
 * Check a brief that arrived from the screen. A learner must say what to learn;
 * a provider chooses for the learner, so the subject text is deliberately
 * dropped instead of being sent to a prompt.
 */
export function validateCreationBrief(value: unknown): BriefValidation {
  // Only an object can carry the named fields, so anything else is refused once.
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "The creation brief must be an object." };
  }
  const record = value as Record<string, unknown>;

  // The mode decides whether the subject is required, so it is checked first.
  const subjectMode = record.subjectMode;
  if (subjectMode !== "learner" && subjectMode !== "provider") {
    return {
      ok: false,
      message: "A creation brief must say whether the learner or the provider chooses the subject.",
    };
  }

  // Every text field shares one rule: a string or empty, never an invented value.
  const subject = optionalText(record.subject);
  const deckFocus = optionalText(record.deckFocus);
  const packName = optionalText(record.packName);
  const deckName = optionalText(record.deckName);
  const targetLanguage = optionalText(record.targetLanguage);
  const sourceLanguage = optionalText(record.sourceLanguage);
  const studyInstruction = optionalText(record.studyInstruction);
  if (
    subject === null ||
    deckFocus === null ||
    packName === null ||
    deckName === null ||
    targetLanguage === null ||
    sourceLanguage === null ||
    studyInstruction === null
  ) {
    return { ok: false, message: "Every text field in a creation brief must be a string." };
  }

  // A learner who writes nothing has not given the provider a goal, so refuse it.
  if (subjectMode === "learner" && subject.length === 0) {
    return { ok: false, message: "A learner brief needs a subject." };
  }

  // An omitted style is the safe default; an unknown one is a bad request.
  const cardStyle = record.cardStyle ?? "mixed";
  if (!isCardStyle(cardStyle)) {
    return {
      ok: false,
      message: "A brief card style must be mixed, cloze, type or hear_type.",
    };
  }

  // A brief is only sent by the new screens, so it always names the target.
  // An empty question language stays empty; the screen gives a new pack English.
  const normalizedTarget = normalizeLanguage(targetLanguage);
  if (normalizedTarget.length === 0) {
    return { ok: false, message: "Choose the language the cards should teach." };
  }

  return {
    ok: true,
    brief: {
      subjectMode,
      // Provider mode never keeps learner text: the library is its subject.
      subject: subjectMode === "provider" ? "" : subject,
      deckFocus,
      cardStyle,
      packName,
      deckName,
      targetLanguage: normalizedTarget,
      // An empty source stays unknown, so an old pack keeps neutral words.
      sourceLanguage: normalizeLanguage(sourceLanguage),
      studyInstruction,
    },
  };
}

/**
 * Put the learner's chosen pair and instruction onto a Chat pack before it is
 * imported. A provider may echo them or leave them out, but it may not replace
 * what the brief says. Invalid text is left alone so the normal import error
 * still explains the real problem.
 */
export function withBriefOnPackText(
  text: string,
  brief: CreationBrief | null | undefined,
): string {
  if (!brief) return text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return text;
  const record = parsed as Record<string, unknown>;
  const pack = record.pack;
  if (pack === null || typeof pack !== "object" || Array.isArray(pack)) return text;

  const nextPack = { ...(pack as Record<string, unknown>) };
  const target = normalizeLanguage(brief.targetLanguage);
  const source = normalizeLanguage(brief.sourceLanguage);
  const instruction = brief.studyInstruction.trim();
  if (target.length > 0) nextPack.language = target;
  if (source.length > 0) nextPack.sourceLanguage = source;
  if (instruction.length > 0) nextPack.studyInstruction = instruction;

  return JSON.stringify({ ...record, pack: nextPack });
}

/** The facts about one pack that may enter a prompt. No cards, settings or key. */
export interface LibraryPackFact {
  name: string;
  description?: string;
  language?: string;
  sourceLanguage?: string;
  decks: ReadonlyArray<{ name: string }>;
}

/** One pack as a prompt may name it: identity and deck labels only. */
export interface LibraryPackEntry {
  name: string;
  description: string;
  language: string;
  sourceLanguage: string;
  decks: string[];
}

/** The whole readable library in the only shape a prompt is allowed to see. */
export type LibraryInventory = LibraryPackEntry[];

/**
 * Reduce real packs to the allowed prompt facts. The input type has no card
 * field, so card text, evidence, settings and the provider key cannot ride in.
 */
export function libraryInventoryFromPacks(
  packs: readonly LibraryPackFact[],
): LibraryInventory {
  return packs
    .map((pack) => ({
      name: pack.name.trim(),
      description: (pack.description ?? "").trim(),
      language: normalizeLanguage(pack.language),
      sourceLanguage: normalizeLanguage(pack.sourceLanguage),
      decks: pack.decks
        .map((deck) => deck.name.trim())
        .filter((name) => name.length > 0),
    }))
    .filter((pack) => pack.name.length > 0);
}

/** Put the library in plain words a prompt can carry without exposing content. */
export function describeLibraryInventory(inventory: LibraryInventory): string {
  // An empty library is a real answer, not a missing line in the prompt.
  if (inventory.length === 0) {
    return "The learner's library is empty. Choose a useful subject and pack.";
  }
  const header =
    "The learner's existing library (pack names, descriptions, languages and deck labels only):";
  const rows = inventory.map((pack) => {
    const target = languageName(pack.language);
    const source = languageName(pack.sourceLanguage);
    const language =
      target.length === 0
        ? ""
        : source.length > 0 && source !== target
          ? ` (${target}, questions in ${source})`
          : ` (${target})`;
    const description = pack.description.length > 0 ? pack.description : "(no description)";
    const decks = pack.decks.length > 0 ? pack.decks.join(", ") : "none yet";
    return `- ${pack.name}${language}: ${description}. Decks: ${decks}.`;
  });
  return [header, ...rows].join("\n");
}

/** Options for turning a brief into prompt lines. */
export interface BriefContextOptions {
  includeInventory?: boolean;
}

/**
 * Turn a checked brief into prompt lines. Provider mode asks for a gap and
 * always names the library; learner mode names the subject and only names the
 * library when the caller asks for it.
 */
export function describeCreationBrief(
  brief: CreationBrief,
  inventory: LibraryInventory = [],
  options: BriefContextOptions = {},
): string[] {
  const lines: string[] = [];

  if (brief.subjectMode === "provider") {
    // The provider's subject is a gap in the library, so the library is the goal.
    lines.push(
      "The learner asked you to choose the subject from their library and fill a useful gap.",
    );
    lines.push(describeLibraryInventory(inventory));
  } else {
    // A learner subject is stated verbatim so the provider cannot rename the goal.
    lines.push(`The learner's subject: ${brief.subject}`);
    if (brief.deckFocus.length > 0) lines.push(`Deck focus: ${brief.deckFocus}`);
    if (options.includeInventory === true) lines.push(describeLibraryInventory(inventory));
  }

  // A provider-chosen subject may still have a deck focus the learner wrote.
  if (brief.subjectMode === "provider" && brief.deckFocus.length > 0) {
    lines.push(`Deck focus: ${brief.deckFocus}`);
  }

  // The pair is a hard fact for every target, not a subject choice. The code is
  // included so a provider cannot turn "Polish" into a different language.
  if (brief.targetLanguage.length > 0) {
    const name = languageName(brief.targetLanguage);
    lines.push(`The learner is learning ${name} (${brief.targetLanguage}).`);
    lines.push(`Write the full lines in ${name}.`);
  }
  if (brief.sourceLanguage.length > 0) {
    const name = languageName(brief.sourceLanguage);
    lines.push(`Questions, translations and explanations are in ${name} (${brief.sourceLanguage}).`);
    if (brief.targetLanguage.length > 0 && brief.sourceLanguage !== brief.targetLanguage) {
      lines.push(`Write translations in ${name}.`);
    }
  }
  if (brief.studyInstruction.length > 0) {
    lines.push(`Store this study instruction on the pack: "${brief.studyInstruction}"`);
  }

  // A supplied name is a request; the app's collision suffix still has the last word.
  if (brief.packName.length > 0) {
    lines.push(
      `The learner asked for the pack name "${brief.packName}". The app may add a number if that name is taken.`,
    );
  }
  if (brief.deckName.length > 0) {
    lines.push(
      `The learner asked for the deck name "${brief.deckName}". The app may add a number if that name is taken.`,
    );
  }

  return lines;
}
