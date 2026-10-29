// WHY: A Dictionary page belongs to exactly one pack, deck or card, and a page
// is "read" only when every part carries a trace. Those two facts decide what a
// screen may say and what a save may accept, so they live in one pure module
// instead of being re-guessed by the reader, the builder and the router.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import { z } from "zod";
import type { DictionaryPage, PageContent, PageLevel, PageTrace, TeachingPart } from "@/lib/shared/types";
import { teachingPartSchema } from "@/lib/core/schema";

/** The levels in course order, from the whole course down to one card. */
export const PAGE_LEVELS: readonly PageLevel[] = ["pack", "deck", "card"];

/** How long one text part must stay on screen: one second per ten words, floor five. */
export const TEXT_SECONDS_PER_WORD = 0.1;
export const TEXT_MIN_SECONDS = 5;

/** A picture counts after this long on screen. */
export const PICTURE_SECONDS = 3;

/** A video counts after this share of its length has played. */
export const VIDEO_TRACED_SHARE = 0.8;

/** One page's id from the entity it belongs to. */
export function packPageId(packName: string): string {
  return `page:pack:${packName}`;
}

export function deckPageId(packName: string, deckId: string): string {
  return `page:deck:${packName}:${deckId}`;
}

export function cardPageId(cardId: string): string {
  return `page:card:${cardId}`;
}

/** Every level's id from its parts, so create and read cannot disagree. */
export function pageIdFor(level: PageLevel, packName: string, deckId?: string, cardId?: string): string {
  if (level === "pack") return packPageId(packName);
  if (level === "deck") return deckPageId(packName, deckId ?? "");
  return cardPageId(cardId ?? "");
}

/** The words in one text part, counted the way a reader counts them. */
export function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
  return words.length;
}

/** The dwell a text part needs before it counts, in milliseconds. */
export function tracedTextMs(text: string): number {
  const needed = Math.max(TEXT_MIN_SECONDS, wordCount(text) * TEXT_SECONDS_PER_WORD);
  return Math.ceil(needed * 1000);
}

/** A page is written when it has something to show at its level. */
export function pageIsWritten(page: DictionaryPage | null | undefined): boolean {
  if (!page) return false;
  if (page.level === "card") return page.parts.length > 0;
  return page.parts.length > 0 || Boolean(page.cover) || Boolean(page.lead?.trim()) || Boolean(page.title?.trim());
}

/** What one page says, without its id, level or learner marks. */
export function pageContent(page: PageContent): PageContent {
  return {
    ...(page.title !== undefined ? { title: page.title } : {}),
    ...(page.lead !== undefined ? { lead: page.lead } : {}),
    ...(page.cover ? { cover: page.cover } : {}),
    parts: page.parts,
  };
}

/** The words a page uses as its title, falling back to what the caller knows. */
export function pageTitle(page: DictionaryPage | null | undefined, fallback: string): string {
  const written = page?.title?.trim();
  return written && written.length > 0 ? written : fallback;
}

/** The parts a page can count a trace on. Pack and deck covers are not traced. */
export function tracedPartCount(page: DictionaryPage): number {
  return page.level === "card" ? page.parts.length : 0;
}

/** How many parts already carry a trace. */
export function tracedCount(page: DictionaryPage, trace: PageTrace | null | undefined): number {
  if (!trace) return 0;
  const seen = new Set(trace.traced);
  let count = 0;
  for (let index = 0; index < tracedPartCount(page); index += 1) {
    if (seen.has(index)) count += 1;
  }
  return count;
}

/** A page is read only when every part has a trace; an empty page never is. */
export function pageIsRead(page: DictionaryPage | null | undefined, trace: PageTrace | null | undefined): boolean {
  if (!page) return false;
  const total = tracedPartCount(page);
  return total > 0 && tracedCount(page, trace) === total;
}

/** The page count that "Pages read" reports: card pages only. */
export function readCount(
  pages: readonly DictionaryPage[],
  traces: readonly PageTrace[],
): { read: number; total: number } {
  const cardPages = pages.filter((page) => page.level === "card" && page.parts.length > 0);
  const byId = new Map(traces.map((trace) => [trace.id, trace]));
  return {
    read: cardPages.filter((page) => pageIsRead(page, byId.get(page.id))).length,
    total: cardPages.length,
  };
}

/**
 * Add one traced part. A known trace keeps its other parts; `readAt` is set
 * once, the first time the page is complete. An out-of-range part changes
 * nothing, so a stale screen cannot invent a trace.
 */
export function withTracedPart(
  page: DictionaryPage,
  previous: PageTrace | null | undefined,
  part: number,
  at: string,
): PageTrace {
  const total = tracedPartCount(page);
  const traced = new Set<number>();
  for (const index of previous?.traced ?? []) {
    if (Number.isInteger(index) && index >= 0 && index < total) traced.add(index);
  }
  if (Number.isInteger(part) && part >= 0 && part < total) traced.add(part);
  const sorted = [...traced].sort((left, right) => left - right);
  const complete = total > 0 && sorted.length === total;
  return {
    id: page.id,
    traced: sorted,
    ...(complete ? { readAt: previous?.readAt ?? at } : {}),
    updatedAt: at,
  };
}

/** One rule violation in a page, at the field it concerns. */
export interface PageRuleProblem {
  path: string;
  message: string;
}

/** The rules every page obeys, whether a learner saves it or a pack ships it. */
export function pageRuleProblems(page: {
  level: PageLevel;
  deckId?: string;
  cardId?: string;
  cover?: TeachingPart;
  parts: TeachingPart[];
}): PageRuleProblem[] {
  const problems: PageRuleProblem[] = [];
  if (page.cover && page.cover.type !== "image") {
    problems.push({ path: "cover", message: "a cover is a picture" });
  }
  if (page.level === "deck" && !page.deckId) {
    problems.push({ path: "deckId", message: "a deck page needs its deck" });
  }
  if (page.level === "card" && !page.cardId) {
    problems.push({ path: "cardId", message: "a card page needs its card" });
  }
  if (page.level === "card" && page.parts.length === 0) {
    problems.push({ path: "parts", message: "a card page needs at least one part" });
  }
  return problems;
}

/** The schema one saved page must pass: the parent is always named. */
export const savedPageSchema = z
  .object({
    level: z.enum(["pack", "deck", "card"]),
    packName: z.string().min(1, "a page belongs to a pack"),
    deckId: z.string().min(1).optional(),
    cardId: z.string().min(1).optional(),
    title: z.string().optional(),
    lead: z.string().optional(),
    cover: teachingPartSchema.optional(),
    parts: z.array(teachingPartSchema).default([]),
  })
  .superRefine((page, ctx) => {
    for (const problem of pageRuleProblems(page)) {
      ctx.addIssue({ code: "custom", path: [problem.path], message: problem.message });
    }
  });

export type SavedPage = z.infer<typeof savedPageSchema>;

/**
 * Turn a validated save into the stored row. Any save through this path is the
 * learner's own copy, so it carries the overlay mark; a shipped page arrives
 * through the package importer instead.
 */
export function pageFromSave(
  save: SavedPage,
  previous: DictionaryPage | null,
  at: string,
): DictionaryPage {
  // WHY: the first save over a shipped page keeps that page beside the
  // learner's words; later saves carry the first snapshot forward, so a revert
  // restores the course's page rather than the learner's last draft of it.
  const shippedCopy = previous
    ? previous.learnerEdited
      ? previous.shippedCopy
      : pageContent(previous)
    : undefined;
  return {
    id: pageIdFor(save.level, save.packName, save.deckId, save.cardId),
    level: save.level,
    packName: save.packName,
    ...(save.level === "pack" ? {} : { deckId: save.deckId }),
    ...(save.level === "card" ? { cardId: save.cardId } : {}),
    ...(save.title !== undefined ? { title: save.title } : {}),
    ...(save.lead !== undefined ? { lead: save.lead } : {}),
    ...(save.cover && save.cover.type === "image" ? { cover: save.cover } : {}),
    parts: save.parts,
    createdAt: previous?.createdAt ?? at,
    updatedAt: at,
    learnerEdited: true,
    // An untouched page can only have arrived in a pack file, so this save is
    // an overlay the learner may revert later.
    ...(previous
      ? previous.editedFromShipped || !previous.learnerEdited
        ? { editedFromShipped: true }
        : {}
      : {}),
    ...(shippedCopy ? { shippedCopy } : {}),
  };
}
