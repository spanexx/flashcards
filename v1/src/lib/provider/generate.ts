// WHY: The model writes truth and the app makes the exercise. The model never
// places a blank; this module takes a full correct line and hides the target
// the model named, then checks the whole batch before any card is saved.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: pure generation logic, safe in the browser; the batch
// duplicate check uses card ids, and a deck id can decide identity.
// [pack: browser-app]
// 2026-10-22 opencode: a line may ask for cloze, type or hear_type, and a batch
// that ignores the learner's requested style is refused whole.
// [pack: creation-control]

import { z } from "zod";
import type { Card, CardPart, CardSource } from "@/lib/shared/types";
import { buildCard, deckCardId, generatedCardId } from "@/lib/core/card";
import type { PackRecord } from "@/lib/packs/types";
import { extractJson } from "@/lib/provider/client";
import {
  GENERATED_CARD_STYLES,
  type CardStyle,
  type GeneratedCardStyle,
} from "@/lib/shared/creation";

/** What one generated line says, before the app turns it into a card. */
export const generatedLineSchema = z.object({
  fullLine: z.string().min(1, "a generated line needs the full correct text"),
  target: z.string().min(1, "a generated line needs a target to hide"),
  style: z.enum(GENERATED_CARD_STYLES).optional(),
  translation: z.string().optional(),
  topics: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const generatedLinesSchema = z.object({
  lines: z.array(generatedLineSchema).min(1, "the provider wrote no lines"),
});

export const generatedPackSchema = z
  .object({
    pack: z.object({
      name: z.string().min(1, "a generated pack needs a name"),
      version: z.string().default("1.0.0"),
      description: z.string().optional(),
      language: z.string().optional(),
      sourceLanguage: z.string().optional(),
      studyInstruction: z.string().optional(),
    }),
    decks: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })).min(1),
    lines: z.array(generatedLineSchema.extend({ deckId: z.string().min(1) })).min(1),
  })
  .strict();

export const generatedDeckSchema = z
  .object({
    deck: z.object({ id: z.string().min(1), name: z.string().min(1) }),
    lines: z.array(generatedLineSchema).min(1),
  })
  .strict();

export type GeneratedLine = z.infer<typeof generatedLineSchema>;

/** The context a line needs beyond its own words: requested style and pack language. */
export interface GeneratedCardOptions {
  cardStyle?: CardStyle;
  /** The language being learned. */
  language?: string;
  /** The language of questions and translations. */
  sourceLanguage?: string;
  studyInstruction?: string;
}

/** Read the line style the app must build, refusing anything the learner did not ask for. */
function chosenStyle(line: GeneratedLine, options: GeneratedCardOptions): GeneratedCardStyle {
  const requested = options.cardStyle;
  // A specific request is enforced line by line, because a batch is all or nothing.
  if (requested && requested !== "mixed") {
    if (line.style !== requested) {
      throw new Error(
        `the learner asked for ${requested} cards, but a line used ${line.style ?? "no style"}`,
      );
    }
    return requested;
  }
  // Mixed lets the provider choose; an omitted style keeps the existing cloze default.
  return line.style ?? "cloze";
}

/** Find where the target sits. Exact first, then a forgiving second look. */
function findTarget(fullLine: string, target: string): { index: number; length: number } | null {
  const exact = fullLine.indexOf(target);
  if (exact >= 0) return { index: exact, length: target.length };
  const lowerLine = fullLine.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const relaxed = lowerLine.indexOf(lowerTarget);
  if (relaxed >= 0) return { index: relaxed, length: target.length };
  return null;
}

/** Split the full line around the target into prompt parts with one blank. */
function partsAroundTarget(fullLine: string, found: { index: number; length: number }): CardPart[] {
  const before = fullLine.slice(0, found.index);
  const after = fullLine.slice(found.index + found.length);
  const parts: CardPart[] = [];
  if (before.length > 0) parts.push({ type: "text", text: before });
  parts.push({ type: "blank", id: "b1" });
  if (after.length > 0) parts.push({ type: "text", text: after });
  return parts;
}

/** The cloze card keeps the existing hide-the-target behaviour. */
function clozeCardParts(
  line: GeneratedLine,
  found: { index: number; length: number },
): { prompt: CardPart[]; answerDef: CardSource["answerDef"] } {
  return {
    prompt: partsAroundTarget(line.fullLine, found),
    answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: [line.target] }] },
  };
}

/** A type card shows the translation and asks for the whole line. */
function typeCardParts(line: GeneratedLine, translation: string): {
  prompt: CardPart[];
  answerDef: CardSource["answerDef"];
} {
  return {
    prompt: [{ type: "text", text: translation }],
    answerDef: { mode: "type", expected: [line.fullLine] },
  };
}

/** A hear_type card speaks the line and asks the learner to type it back. */
function hearTypeCardParts(
  line: GeneratedLine,
  options: GeneratedCardOptions,
): { prompt: CardPart[]; answerDef: CardSource["answerDef"] } {
  const speak: CardPart = {
    type: "speak",
    text: line.fullLine,
    ...(options.language && options.language.length > 0 ? { lang: options.language } : {}),
    label: "Listen",
  };
  return {
    prompt: [speak],
    answerDef: { mode: "hear_type", expected: [line.fullLine] },
  };
}

/** Turn one checked line into the card source the bundle validator checks. */
function sourceFromLine(
  line: GeneratedLine,
  defaultTopic: string,
  allowedTopics?: string[],
  options: GeneratedCardOptions = {},
): CardSource {
  const style = chosenStyle(line, options);
  const translation = line.translation?.trim() ?? "";
  // A type card is unanswerable without the translation it shows first.
  if (style === "type" && translation.length === 0) {
    throw new Error("a type card needs a translation");
  }

  // A cloze card is the only style that needs the target found inside the line.
  let cardParts: { prompt: CardPart[]; answerDef: CardSource["answerDef"] };
  if (style === "cloze") {
    const found = findTarget(line.fullLine, line.target);
    if (!found) {
      throw new Error(`the target "${line.target}" is not inside the line "${line.fullLine}"`);
    }
    cardParts = clozeCardParts(line, found);
  } else if (style === "type") {
    cardParts = typeCardParts(line, translation);
  } else {
    cardParts = hearTypeCardParts(line, options);
  }

  const topics = (line.topics ?? []).filter((topic) => !allowedTopics || allowedTopics.includes(topic));
  const chosenTopics = topics.length > 0 ? topics : [defaultTopic];
  const answerParts: CardPart[] = [{ type: "text", text: line.fullLine }];
  // A cloze or heard card may still show the translation on the answer side.
  if (style !== "type" && translation.length > 0) {
    answerParts.push({ type: "text", text: translation, role: "translation" });
  }

  return {
    summary: line.summary?.trim() || line.fullLine,
    topics: chosenTopics,
    tags: line.tags ?? [],
    prompt: cardParts.prompt,
    answer: answerParts,
    answerDef: cardParts.answerDef,
    fullLine: line.fullLine,
  };
}

/** Turn one checked line into a card with an origin note naming the request. */
export function deriveCard(
  pack: PackRecord,
  requestId: string,
  line: GeneratedLine,
  defaultTopic: string,
  now: string,
  deckId?: string,
  options: GeneratedCardOptions = {},
): Card {
  const source = sourceFromLine(line, defaultTopic, pack.topics, options);
  const id = deckId
    ? deckCardId(pack.name, deckId, source)
    : generatedCardId(pack.name, line.fullLine, line.target);
  const card = buildCard(
    source,
    {
      kind: "generated",
      note: `Generated from a request about ${defaultTopic} on ${now.slice(0, 10)}.`,
      packName: pack.name,
      requestId,
    },
    id,
    now,
  );
  card.packName = pack.name;
  if (deckId) card.deckId = deckId;
  return card;
}

/** One plain sentence for a line the app refused, never a stack trace. */
function refusalMessage(error: unknown): string {
  return error instanceof Error ? error.message : "the provider's answer was not usable";
}

/** One card in the same shape the bundle validator reads. */
function bundleCardFromLine(
  line: GeneratedLine,
  deck: { id: string; name: string },
  options: GeneratedCardOptions,
) {
  const source = sourceFromLine(line, deck.name, undefined, options);
  return {
    deckId: deck.id,
    summary: source.summary,
    tags: source.tags,
    prompt: source.prompt,
    answer: source.answer,
    answerDef: source.answerDef,
    hints: source.hints,
    fullLine: source.fullLine,
  };
}

function providerRefusal(error: z.ZodError): { ok: false; message: string } {
  return { ok: false, message: `the provider's answer was not usable: ${error.issues[0].message}` };
}

/** Read the reply once, so a missing or broken JSON object is a refusal, not a throw. */
function readStructured(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: extractJson(text) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "the provider's answer was not usable",
    };
  }
}

/** Read a generated pack reply into a whole-pack bundle. */
export function generatedPackBundle(
  text: string,
  options: GeneratedCardOptions = {},
): { ok: true; bundle: Record<string, unknown> } | { ok: false; message: string } {
  const json = readStructured(text);
  if (!json.ok) return json;
  const parsed = generatedPackSchema.safeParse(json.value);
  if (!parsed.success) return providerRefusal(parsed.error);
  const decks = new Map(parsed.data.decks.map((deck) => [deck.id, deck]));
  // The brief owns the pair and instruction. A provider may echo them, but it
  // cannot replace what the learner chose.
  const language = options.language?.trim() || parsed.data.pack.language?.trim();
  const sourceLanguage =
    options.sourceLanguage?.trim() || parsed.data.pack.sourceLanguage?.trim();
  const studyInstruction =
    options.studyInstruction?.trim() || parsed.data.pack.studyInstruction?.trim();
  const cards = [];
  for (const line of parsed.data.lines) {
    const deck = decks.get(line.deckId);
    if (!deck) {
      return { ok: false, message: `the provider named a deck "${line.deckId}" that it did not define` };
    }
    try {
      cards.push(bundleCardFromLine(line, deck, { ...options, language }));
    } catch (error) {
      return { ok: false, message: refusalMessage(error) };
    }
  }
  return {
    ok: true,
    bundle: {
      schema: "flashcards.pack/v1",
      pack: {
        ...parsed.data.pack,
        // The brief owns the pair and instruction. A provider may echo them,
        // but it cannot silently erase what the learner chose.
        ...(language ? { language } : {}),
        ...(sourceLanguage ? { sourceLanguage } : {}),
        ...(studyInstruction ? { studyInstruction } : {}),
      },
      decks: parsed.data.decks,
      cards,
    },
  };
}

/** Read a generated deck reply into a deck fragment. */
export function generatedDeckBundle(
  text: string,
  options: GeneratedCardOptions = {},
): { ok: true; bundle: Record<string, unknown> } | { ok: false; message: string } {
  const json = readStructured(text);
  if (!json.ok) return json;
  const parsed = generatedDeckSchema.safeParse(json.value);
  if (!parsed.success) return providerRefusal(parsed.error);
  const cards = [];
  for (const line of parsed.data.lines) {
    try {
      cards.push(bundleCardFromLine(line, parsed.data.deck, options));
    } catch (error) {
      return { ok: false, message: refusalMessage(error) };
    }
  }
  return { ok: true, bundle: { decks: [parsed.data.deck], cards } };
}

/** Read a generated cards reply into a cards fragment for the chosen deck. */
export function generatedCardsBundle(
  text: string,
  deck: { id: string; name: string },
  options: GeneratedCardOptions = {},
): { ok: true; bundle: Record<string, unknown> } | { ok: false; message: string } {
  const json = readStructured(text);
  if (!json.ok) return json;
  const parsed = generatedLinesSchema.safeParse(json.value);
  if (!parsed.success) return providerRefusal(parsed.error);
  const cards = [];
  for (const line of parsed.data.lines) {
    try {
      cards.push(bundleCardFromLine(line, deck, options));
    } catch (error) {
      return { ok: false, message: refusalMessage(error) };
    }
  }
  return { ok: true, bundle: { cards } };
}

/**
 * Read a whole provider reply. Every line must be well formed and the target
 * must sit inside its full line, or the whole batch is refused.
 */
export function generateCardsFromText(
  pack: PackRecord,
  requestId: string,
  text: string,
  defaultTopic: string,
  now: string,
  deckId?: string,
  options: GeneratedCardOptions = {},
): Card[] {
  const parsed = generatedLinesSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`the provider's answer was not usable: ${issue.message}`);
  }

  const cards: Card[] = [];
  const seen = new Set<string>();
  for (const line of parsed.data.lines) {
    const card = deriveCard(pack, requestId, line, defaultTopic, now, deckId, options);
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    cards.push(card);
  }
  return cards;
}
