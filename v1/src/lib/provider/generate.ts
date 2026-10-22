// WHY: The model writes truth and the app makes the exercise. The model never
// places a blank; this module takes a full correct line and hides the target
// the model named, then checks the whole batch before any card is saved.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: pure generation logic, safe in the browser; the batch
// duplicate check uses card ids, and a deck id can decide identity.
// [pack: browser-app]

import { z } from "zod";
import type { Card, CardPart, CardSource } from "@/lib/shared/types";
import { buildCard, deckCardId, generatedCardId } from "@/lib/core/card";
import type { PackRecord } from "@/lib/packs/types";
import { extractJson } from "@/lib/provider/client";

/** One full line the model wrote, with the target the app should hide. */
export const generatedLineSchema = z.object({
  fullLine: z.string().min(1, "a generated line needs the full correct text"),
  target: z.string().min(1, "a generated line needs a target to hide"),
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

/** Turn one checked line into the card source the bundle validator checks. */
function sourceFromLine(line: GeneratedLine, defaultTopic: string, allowedTopics?: string[]): CardSource {
  const found = findTarget(line.fullLine, line.target);
  if (!found) {
    throw new Error(`the target "${line.target}" is not inside the line "${line.fullLine}"`);
  }

  const topics = (line.topics ?? []).filter((topic) => !allowedTopics || allowedTopics.includes(topic));
  const chosenTopics = topics.length > 0 ? topics : [defaultTopic];
  const answerParts: CardPart[] = [{ type: "text", text: line.fullLine }];
  if (line.translation && line.translation.trim().length > 0) {
    answerParts.push({ type: "text", text: line.translation.trim(), role: "translation" });
  }

  return {
    summary: line.summary?.trim() || line.fullLine,
    topics: chosenTopics,
    tags: line.tags ?? [],
    prompt: partsAroundTarget(line.fullLine, found),
    answer: answerParts,
    answerDef: { mode: "cloze" as const, blanks: [{ id: "b1", expected: [line.target] }] },
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
): Card {
  const source = sourceFromLine(line, defaultTopic, pack.topics);
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

/** One card in the same shape the bundle validator reads. */
function bundleCardFromLine(line: GeneratedLine, deck: { id: string; name: string }) {
  const source = sourceFromLine(line, deck.name);
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
): { ok: true; bundle: Record<string, unknown> } | { ok: false; message: string } {
  const json = readStructured(text);
  if (!json.ok) return json;
  const parsed = generatedPackSchema.safeParse(json.value);
  if (!parsed.success) return providerRefusal(parsed.error);
  const decks = new Map(parsed.data.decks.map((deck) => [deck.id, deck]));
  const cards = [];
  for (const line of parsed.data.lines) {
    const deck = decks.get(line.deckId);
    if (!deck) {
      return { ok: false, message: `the provider named a deck "${line.deckId}" that it did not define` };
    }
    cards.push(bundleCardFromLine(line, deck));
  }
  return {
    ok: true,
    bundle: {
      schema: "flashcards.pack/v1",
      pack: parsed.data.pack,
      decks: parsed.data.decks,
      cards,
    },
  };
}

/** Read a generated deck reply into a deck fragment. */
export function generatedDeckBundle(
  text: string,
): { ok: true; bundle: Record<string, unknown> } | { ok: false; message: string } {
  const json = readStructured(text);
  if (!json.ok) return json;
  const parsed = generatedDeckSchema.safeParse(json.value);
  if (!parsed.success) return providerRefusal(parsed.error);
  const cards = parsed.data.lines.map((line) => bundleCardFromLine(line, parsed.data.deck));
  return { ok: true, bundle: { decks: [parsed.data.deck], cards } };
}

/** Read a generated cards reply into a cards fragment for the chosen deck. */
export function generatedCardsBundle(
  text: string,
  deck: { id: string; name: string },
): { ok: true; bundle: Record<string, unknown> } | { ok: false; message: string } {
  const json = readStructured(text);
  if (!json.ok) return json;
  const parsed = generatedLinesSchema.safeParse(json.value);
  if (!parsed.success) return providerRefusal(parsed.error);
  const cards = parsed.data.lines.map((line) => bundleCardFromLine(line, deck));
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
): Card[] {
  const parsed = generatedLinesSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`the provider's answer was not usable: ${issue.message}`);
  }

  const cards: Card[] = [];
  const seen = new Set<string>();
  for (const line of parsed.data.lines) {
    const card = deriveCard(pack, requestId, line, defaultTopic, now, deckId);
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    cards.push(card);
  }
  return cards;
}
