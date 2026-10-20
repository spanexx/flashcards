// WHY: A card is one flat shape across every subject, so the shape itself can
// be checked once. This module is the rulebook: anything that passes here is a
// card, and anything that fails names the field that is wrong.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { z } from "zod";

/** One ordered part of a card side. */
export const cardPartSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().min(1, "a text part needs words"),
    role: z.enum(["translation", "note"]).optional(),
  }),
  z.object({
    type: z.literal("code"),
    text: z.string().min(1, "a code part needs words"),
    language: z.string().optional(),
  }),
  z.object({
    type: z.literal("speak"),
    text: z.string().min(1, "a speak part needs words to say"),
    lang: z.string().optional(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal("media"),
    src: z.string().min(1, "a media part needs a source"),
    alt: z.string().optional(),
    mime: z.string().optional(),
  }),
  z.object({
    type: z.literal("blank"),
    id: z.string().min(1, "a blank needs an id"),
    hint: z.string().optional(),
    width: z.enum(["short", "medium", "long"]).optional(),
  }),
]);

/** One blank's expected answers and optional local options. */
export const blankDefSchema = z.object({
  id: z.string().min(1, "a blank needs an id"),
  expected: z.array(z.string()).default([]),
  options: z.array(z.string()).optional(),
});

/** The answering rule the pack declared for this card. */
export const answerDefSchema = z.object({
  mode: z.enum(["cloze", "picks", "type", "hear_type"]),
  blanks: z.array(blankDefSchema).optional(),
  options: z.array(z.string()).optional(),
  correct: z.array(z.string()).optional(),
  expected: z.array(z.string()).optional(),
  judge: z.enum(["loose", "exact"]).optional(),
  caseSensitive: z.boolean().optional(),
  working: z
    .object({ label: z.string().min(1), expected: z.string().min(1) })
    .optional(),
});

/** The pack author's card source, before identity is assigned. */
export const cardSourceSchema = z.object({
  key: z.string().optional(),
  summary: z.string().min(1, "every card needs a plain-text summary"),
  topics: z.array(z.string().min(1)).min(1, "a card belongs to at least one topic"),
  tags: z.array(z.string()).optional(),
  prompt: z.array(cardPartSchema).min(1, "the prompt side needs at least one part"),
  answer: z.array(cardPartSchema).min(1, "the answer side needs at least one part"),
  answerDef: answerDefSchema,
  hints: z.array(z.string()).optional(),
  fullLine: z.string().optional(),
});

/** The pack manifest. Name and version identify the pack; version is not card identity. */
export const packManifestSchema = z.object({
  name: z
    .string()
    .min(1, "a pack needs a name")
    .regex(/^[a-z0-9][a-z0-9-]*$/, "a pack name uses lowercase letters, numbers and dashes"),
  version: z.string().min(1, "a pack needs an author-written version"),
  author: z.string().optional(),
  description: z.string().optional(),
  coreRange: z.string().default("*"),
  language: z.string().optional(),
  topics: z.array(z.string().min(1)).min(1, "a pack needs at least one topic"),
  topicLabels: z.record(z.string(), z.string()).default({}),
});

/** One item in a pack's cards file. */
export const packCardsSchema = z.object({
  cards: z.array(cardSourceSchema),
});

/** The pack's prompt text. The app owns the three slots it fills in. */
export const packPromptsSchema = z.object({
  generation: z.object({
    system: z.string().min(1, "a generation prompt needs a system line"),
    template: z.string().min(1, "a generation prompt needs a template"),
  }),
  tutor: z
    .object({
      system: z.string().min(1, "a tutor prompt needs a system line"),
      hintTemplate: z.string().min(1, "a tutor hint prompt needs a template"),
    })
    .optional(),
});

/** A validation problem a person can act on: where it is and what is wrong. */
export interface ValidationIssue {
  index: number;
  field: string;
  message: string;
}

/** Turn zod issues into plain, index-aware problems. */
export function issuesFromZod(
  error: z.ZodError,
  index: number,
): ValidationIssue[] {
  return error.issues.map((issue) => ({
    index,
    field: issue.path.length > 0 ? issue.path.join(".") : "(card)",
    message: issue.message,
  }));
}
