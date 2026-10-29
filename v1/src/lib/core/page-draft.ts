// WHY: A drafted page is a starting point the learner edits, so the exact
// prompt and the exact answer shape have to be decided in one pure place. The
// browser module only holds and sends that prompt; the rules live here.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import { z } from "zod";
import { parseJsonLoose } from "@/lib/core/json-repair";
import { teachingPartSchema } from "@/lib/core/schema";
import type { PageLevel, TeachingPart } from "@/lib/shared/types";
import type { ChatMessage } from "@/lib/provider/client";

/** What the draft prompt is allowed to know about the page and its course. */
export interface PageDraftContext {
  level: PageLevel;
  packName: string;
  packDescription?: string;
  deckName?: string;
  cardSummary?: string;
  cardQuestion?: string;
  cardAnswer?: string;
  title?: string;
  lead?: string;
  language?: string;
  sourceLanguage?: string;
}

/** The largest answer accepted: enough for a lesson, small enough to read. */
const DRAFT_MAX_PARTS = 8;

/** One line naming what the page should explain, at the level it lives. */
function levelLine(context: PageDraftContext): string {
  if (context.level === "card") {
    return `This is the card page for one card. The learner opens it after the card to understand it deeply.`;
  }
  if (context.level === "deck") {
    return `This is the deck page: an introduction to the deck "${context.deckName ?? ""}" inside the pack.`;
  }
  return `This is the pack page: an introduction to the whole pack.`;
}

/** The course facts the prompt may see, and nothing else. */
function contextLines(context: PageDraftContext): string[] {
  const lines = [levelLine(context), `Pack name: ${context.packName}.`];
  if (context.packDescription) lines.push(`Pack description: ${context.packDescription}`);
  if (context.deckName) lines.push(`Deck name: ${context.deckName}.`);
  if (context.cardSummary) lines.push(`Card summary: ${context.cardSummary}`);
  if (context.cardQuestion) lines.push(`Card question: ${context.cardQuestion}`);
  if (context.cardAnswer) lines.push(`Card answer: ${context.cardAnswer}`);
  if (context.title) lines.push(`Page title so far: ${context.title}`);
  if (context.lead) lines.push(`Page lead so far: ${context.lead}`);
  if (context.language) lines.push(`The cards teach: ${context.language}.`);
  if (context.sourceLanguage) lines.push(`The questions are written in: ${context.sourceLanguage}.`);
  return lines;
}

const DRAFT_SYSTEM = [
  "You write one Dictionary page for a flashcard app.",
  "The page is help the learner reads in order: short text parts, one idea each.",
  "Return JSON only, with this shape:",
  '{"title":"a short page title","lead":"one sentence that says what this page covers","parts":[{"type":"text","text":"..."}]}',
  "Rules:",
  "- Write 2 to 6 text parts, each at most 60 words.",
  "- Never write the answer to a flashcard as a bare fact without explaining it.",
  "- You may add one video part as {\"type\":\"video\",\"source\":\"youtube\",\"src\":\"<11-character id>\"} only if you are sure of the id.",
  "- Never invent images, and never write markdown.",
].join("\n");

/** Build the exact prompt the learner approves before it leaves. */
export function buildPageDraftPrompt(
  context: PageDraftContext,
  instruction: string,
): { display: string; messages: ChatMessage[] } {
  const asked = instruction.trim() || "Explain this part of the course clearly.";
  const display = [
    "Write one Dictionary page.",
    "",
    ...contextLines(context),
    "",
    `Instruction: ${asked}`,
    "",
    DRAFT_SYSTEM,
  ].join("\n");
  return {
    display,
    messages: [
      { role: "system", content: DRAFT_SYSTEM },
      { role: "user", content: [...contextLines(context), "", `Instruction: ${asked}`].join("\n") },
    ],
  };
}

const draftSchema = z.object({
  title: z.string().min(1).optional(),
  lead: z.string().min(1).optional(),
  parts: z.array(z.unknown()),
});

/** A drafted page, ready to drop into the editor. Nothing is saved here. */
export interface PageDraft {
  title?: string;
  lead?: string;
  parts: TeachingPart[];
}

/**
 * Read the provider's answer into parts the editor can hold. A part that does
 * not match the teaching shape is dropped; an answer with no usable part is
 * refused instead of saving an empty page.
 */
export function readPageDraft(text: string): { ok: true; draft: PageDraft } | { ok: false; message: string } {
  let raw: unknown;
  try {
    raw = parseJsonLoose(text).value;
  } catch {
    return { ok: false, message: "the answer was not JSON" };
  }
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "the answer did not name a list of parts" };
  }
  const parts: TeachingPart[] = [];
  for (const part of parsed.data.parts.slice(0, DRAFT_MAX_PARTS)) {
    const checked = teachingPartSchema.safeParse(part);
    if (checked.success) parts.push(checked.data);
  }
  if (parts.length === 0) {
    return { ok: false, message: "the answer had no usable page part" };
  }
  return {
    ok: true,
    draft: {
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      ...(parsed.data.lead ? { lead: parsed.data.lead } : {}),
      parts,
    },
  };
}
