// WHY: Card identity is provenance plus content, and a broken card must be
// refused by a hard rule with a plain reason. This module gives every card its
// name and checks its shape before it can touch the learner's deck.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: hashing is browser-safe now (FNV-1a 64) so the same
// identity rule works in IndexedDB; ids are stable for the same content.
// [pack: browser-app]
// 2026-10-22 opencode: a spoken prompt may repeat as the answer, so a
// listen-and-type card is not refused as a duplicated side. [pack: creation-control]

import { z } from "zod";
import type {
  Card,
  CardOrigin,
  CardPart,
  CardSource,
} from "@/lib/shared/types";
import { cardSourceSchema, issuesFromZod, type ValidationIssue } from "@/lib/core/schema";

/**
 * A short, stable id. FNV-1a in 64 bits is synchronous, needs no library and
 * runs in both a browser and a test process. It is an identity tag, not a
 * security hash: collisions are possible but vanishingly rare for card text.
 */
function hashText(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

/** A prefixed identity string, e.g. pack-polish:0123456789abcdef. */
function hashId(prefix: string, text: string): string {
  return `${prefix}:${hashText(text)}`;
}

/** Sort object keys so two equal cards always hash the same way. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

/**
 * The content that decides whether two cards are the same card. Timestamps,
 * pack version and the display id never count, so a reinstall and an unchanged
 * update keep the learner's history attached. The teaching layer is help, not
 * content: editing it must never make the learner look like a new learner.
 */
export function canonicalContent(source: CardSource): string {
  return stableStringify({
    summary: source.summary.trim(),
    topics: [...new Set(source.topics.map((topic) => topic.trim()))].sort(),
    tags: [...new Set((source.tags ?? []).map((tag) => tag.trim()))].sort(),
    prompt: source.prompt,
    answer: source.answer,
    answerDef: source.answerDef,
    hints: source.hints ?? [],
    fullLine: source.fullLine ?? null,
  });
}

/** A pack card's identity: the pack it came from plus its content. */
export function packCardId(packName: string, source: CardSource): string {
  return hashId(`pack-${packName}`, canonicalContent(source));
}

/** An imported card's identity: its content alone, so importing twice is safe. */
export function importCardId(source: CardSource): string {
  return hashId("import", canonicalContent(source));
}

/**
 * A browser card's identity: pack name, deck id and content. The same words in
 * another deck are another card; the same words in the same deck are the same
 * card, so a re-import and a pack update keep the learner's evidence.
 */
export function deckCardId(packName: string, deckId: string, source: CardSource): string {
  return hashId(`deck-${packName}-${deckId}`, canonicalContent(source));
}

/** A generated card's identity: the pack, the full line and the hidden target. */
export function generatedCardId(packName: string, fullLine: string, target: string): string {
  return hashId("gen", `${packName}\u0000${fullLine}\u0000${target}`);
}

/** A manual card's identity is deliberate and new every time. */
export function manualCardId(randomId: string): string {
  return `card:${randomId}`;
}

/** Join the words of a side for comparisons and plain-text reading. */
export function renderPlainText(parts: CardPart[]): string {
  return parts
    .filter((part): part is Extract<CardPart, { type: "text" | "code" | "speak" }> =>
      part.type === "text" || part.type === "code" || part.type === "speak",
    )
    .map((part) => part.text)
    .join(" ")
    .trim();
}

/**
 * Hard rules, checked instantly and for free: a missing field or a card whose
 * front equals its back is broken. Everything else is a judgement, not a rule.
 */
export function hardRuleIssues(source: CardSource, index = 0): ValidationIssue[] {
  const parsed = cardSourceSchema.safeParse(source);
  if (!parsed.success) return issuesFromZod(parsed.error, index);

  const issues: ValidationIssue[] = [];
  const def = source.answerDef;

  if (def.mode === "cloze") {
    const blankIds = source.prompt
      .filter((part) => part.type === "blank")
      .map((part) => part.id);
    const defIds = (def.blanks ?? []).map((blank) => blank.id);
    if (blankIds.length === 0)
      issues.push({ index, field: "prompt", message: "a cloze card needs a dotted blank in the prompt" });
    if (defIds.length !== blankIds.length)
      issues.push({
        index,
        field: "answerDef.blanks",
        message: "every dotted blank needs exactly one matching entry in answerDef.blanks",
      });
    const missing = blankIds.filter((id) => !defIds.includes(id));
    if (missing.length > 0)
      issues.push({
        index,
        field: "answerDef.blanks",
        message: `no expected answer is declared for blank ${missing.join(", ")}`,
      });
  }

  if (def.mode === "picks") {
    if (!def.options || def.options.length < 2)
      issues.push({ index, field: "answerDef.options", message: "a picks card needs at least two options" });
    if (!def.correct || def.correct.length === 0)
      issues.push({ index, field: "answerDef.correct", message: "a picks card needs a correct answer" });
    for (const answer of def.correct ?? []) {
      if (!(def.options ?? []).includes(answer))
        issues.push({
          index,
          field: "answerDef.correct",
          message: `"${answer}" is marked correct but is not one of the options`,
        });
    }
  }

  // A listen-and-type card is meant to repeat the spoken line as its answer,
  // so the repeat check only applies when the prompt is read rather than heard.
  const front = renderPlainText(source.prompt);
  const back = renderPlainText(source.answer);
  const heard = source.prompt.some((part) => part.type === "speak");
  if (!heard && front.length > 0 && front === back)
    issues.push({ index, field: "answer", message: "the answer side repeats the prompt side word for word" });

  return issues;
}

/** Give a checked source its identity and its origin note. */
export function buildCard(
  source: CardSource,
  origin: CardOrigin,
  id: string,
  now: string,
): Card {
  return {
    id,
    topics: [...new Set(source.topics.map((topic) => topic.trim()))],
    tags: [...new Set((source.tags ?? []).map((tag) => tag.trim()))],
    summary: source.summary.trim(),
    prompt: source.prompt,
    answer: source.answer,
    answerDef: source.answerDef,
    hints: source.hints && source.hints.length > 0 ? source.hints : undefined,
    fullLine: source.fullLine,
    teaching: source.teaching && source.teaching.length > 0 ? source.teaching : undefined,
    origin,
    createdAt: now,
  };
}

/** The human shorthand accepted by the manual form and the importer. */
export const simpleCardSchema = z.object({
  front: z.string().min(1, "a card needs a front"),
  back: z.string().min(1, "a card needs a back"),
  summary: z.string().optional(),
  topics: z.array(z.string().min(1)).min(1, "a card belongs to at least one topic"),
  tags: z.array(z.string()).optional(),
  mode: z.enum(["auto", "cloze", "picks", "type"]).optional(),
  options: z.array(z.string()).optional(),
});

export type SimpleCard = z.infer<typeof simpleCardSchema>;

/** Turn the human shorthand into the flat card source the core understands. */
export function simpleCardToSource(input: SimpleCard): CardSource {
  const marker = /_{2,}/;
  const useCloze = input.mode === "cloze" || (input.mode !== "picks" && marker.test(input.front));

  if (input.mode === "picks" && input.options && input.options.length > 0) {
    return {
      summary: input.summary?.trim() || `${input.front} → ${input.back}`,
      topics: input.topics,
      tags: input.tags ?? [],
      prompt: [{ type: "text", text: input.front }],
      answer: [{ type: "text", text: input.back }],
      answerDef: { mode: "picks", options: input.options, correct: [input.back] },
    };
  }

  if (useCloze) {
    const [before, ...afterParts] = input.front.split(marker);
    const after = afterParts.join("___");
    const parts: CardPart[] = [];
    if (before.trim().length > 0) parts.push({ type: "text", text: before });
    parts.push({ type: "blank", id: "b1" });
    if (after.trim().length > 0) parts.push({ type: "text", text: after });
    return {
      summary: input.summary?.trim() || `${input.front} → ${input.back}`,
      topics: input.topics,
      tags: input.tags ?? [],
      prompt: parts,
      answer: [{ type: "text", text: input.front.replace(marker, input.back) }],
      answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: [input.back] }] },
    };
  }

  return {
    summary: input.summary?.trim() || `${input.front} → ${input.back}`,
    topics: input.topics,
    tags: input.tags ?? [],
    prompt: [{ type: "text", text: input.front }],
    answer: [{ type: "text", text: input.back }],
    answerDef: { mode: "type", expected: [input.back] },
  };
}

/** True when an unknown value looks like the human shorthand rather than a full card. */
export function looksLikeSimpleCard(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.front === "string" && typeof record.back === "string";
}
