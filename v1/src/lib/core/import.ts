// WHY: Import is all-or-nothing, because a silently dropped card is a hole in
// the learner's progress record. This module parses a whole batch, names every
// problem, and refuses the lot before anything is written.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: the batch reader is exported so the browser bundle
// import uses the same validation as the old flat import. [pack: browser-app]

import type { Card, CardSource } from "@/lib/shared/types";
import {
  buildCard,
  hardRuleIssues,
  importCardId,
  looksLikeSimpleCard,
  simpleCardSchema,
  simpleCardToSource,
} from "@/lib/core/card";
import { cardSourceSchema, issuesFromZod, type ValidationIssue } from "@/lib/core/schema";
import { parseJsonLoose } from "@/lib/core/json-repair";

/** The import result: either the cards to add or every problem found. */
export type ImportResult =
  | { ok: true; cards: Card[]; duplicates: number }
  | { ok: false; issues: ValidationIssue[] };

/** The origin note every imported card carries. */
const IMPORT_NOTE = "Imported by the learner.";

/** Read the pasted text into a list, accepting two friendly outer shapes. */
function readItems(text: string): { items: unknown[] } | { issues: ValidationIssue[] } {
  let parsed: unknown;
  try {
    // WHY: A hand-typed batch gets the same syntax repair as a bundle; the old
    // flat lane must not refuse text the browser import now understands.
    parsed = parseJsonLoose(text).value;
  } catch (error) {
    return {
      issues: [
        {
          index: 0,
          field: "(batch)",
          message: error instanceof Error ? error.message : "the pasted text is not valid JSON",
        },
      ],
    };
  }

  if (Array.isArray(parsed)) return { items: parsed };
  if (parsed !== null && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.cards)) return { items: record.cards };
  }
  return {
    issues: [
      {
        index: 0,
        field: "(batch)",
        message: "expected a list of cards, or an object with a cards list",
      },
    ],
  };
}

/** Turn one raw item into a checked card source, or problems with it. */
function readSource(
  item: unknown,
  index: number,
  fallbackTopic: string | null = null,
): { source: CardSource } | { issues: ValidationIssue[] } {
  if (looksLikeSimpleCard(item)) {
    // A flat import now names its deck in the screen; an older pasted card may
    // still carry topics, and a missing list is filled only for that lane.
    const record = item as Record<string, unknown>;
    const topics = Array.isArray(record.topics) && record.topics.length > 0
      ? record.topics
      : fallbackTopic
        ? [fallbackTopic]
        : record.topics;
    const simple = simpleCardSchema.safeParse({ ...record, topics });
    if (!simple.success) return { issues: issuesFromZod(simple.error, index) };
    const source = simpleCardToSource(simple.data);
    const issues = hardRuleIssues(source, index);
    return issues.length > 0 ? { issues } : { source };
  }

  const parsed = cardSourceSchema.safeParse(item);
  if (!parsed.success) return { issues: issuesFromZod(parsed.error, index) };
  const issues = hardRuleIssues(parsed.data, index);
  return issues.length > 0 ? { issues } : { source: parsed.data };
}

/**
 * Read a whole batch into checked card sources, naming every problem. The
 * browser import wraps these sources in a bundle; the old flat import uses the
 * same reader, so both lanes reject exactly the same files.
 */
export function parseCardSources(
  text: string,
  fallbackTopic: string | null = null,
): { ok: true; sources: CardSource[] } | { ok: false; issues: ValidationIssue[] } {
  const read = readItems(text);
  if ("issues" in read) return { ok: false, issues: read.issues };
  if (read.items.length === 0) {
    return {
      ok: false,
      issues: [{ index: 0, field: "(batch)", message: "the batch has no cards" }],
    };
  }

  const sources: CardSource[] = [];
  const issues: ValidationIssue[] = [];
  read.items.forEach((item, index) => {
    const result = readSource(item, index, fallbackTopic);
    if ("issues" in result) issues.push(...result.issues);
    else sources.push(result.source);
  });

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, sources };
}

/**
 * Validate a whole batch and return the cards that are new. Content that is
 * already in the deck is reported as a duplicate, not imported twice.
 */
export function importCards(
  text: string,
  existingIds: string[],
  now: string,
): ImportResult {
  const read = parseCardSources(text);
  if (!read.ok) return { ok: false, issues: read.issues };
  const sources = read.sources;

  const known = new Set(existingIds);
  const cards: Card[] = [];
  let duplicates = 0;
  for (const source of sources) {
    const id = importCardId(source);
    if (known.has(id)) {
      duplicates += 1;
      continue;
    }
    known.add(id);
    cards.push(buildCard(source, { kind: "imported", note: IMPORT_NOTE }, id, now));
  }

  return { ok: true, cards, duplicates };
}
