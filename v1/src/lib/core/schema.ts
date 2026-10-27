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
    lang: z.string().optional(),
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

/** How a deck presents help. A missing level means intermediate. */
export const studyLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);

/** A built-in file stays inside the app's own packs folder. */
const builtinSourceSchema = z
  .string()
  .regex(/^\/packs\/[A-Za-z0-9._/-]+$/, "a built-in source lives under /packs/")
  .refine((value) => !value.split("/").includes(".."), "a built-in source cannot leave the packs folder");

/** A web source is an ordinary http or https address. */
const webSourceSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, "a web source must be an http or https address");

/** A local source names a record in the media store. */
const localSourceSchema = z
  .string()
  .regex(/^media-[A-Za-z0-9-]+$/, "a local source must be a media id");

/** A YouTube source is the video id alone, never a whole link. */
const youTubeSourceSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{11}$/, "a YouTube source is an 11-character video id");

/** The problem with one media source, or null when the source matches its kind. */
function sourceProblem(source: "builtin" | "web" | "local" | "youtube", value: string): string | null {
  const checked =
    source === "builtin"
      ? builtinSourceSchema
      : source === "youtube"
        ? youTubeSourceSchema
        : source === "web"
          ? webSourceSchema
          : localSourceSchema;
  const result = checked.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "the source is not valid");
}

/** A teaching part is text, an image or a video, in any order. */
export const teachingPartSchema = z.union([
  z.object({
    type: z.literal("text"),
    text: z.string().min(1, "a text part needs words"),
    lang: z.string().min(1).optional(),
  }),
  z
    .object({
      type: z.literal("image"),
      source: z.enum(["builtin", "web", "local"]),
      src: z.string().min(1, "an image part needs a source"),
      alt: z.string().min(1, "an image part needs alt text"),
    })
    .superRefine((part, ctx) => {
      const problem = sourceProblem(part.source, part.src);
      if (problem) ctx.addIssue({ code: "custom", path: ["src"], message: problem });
    }),
  z
    .object({
      type: z.literal("video"),
      source: z.enum(["youtube", "web", "local"]),
      src: z.string().min(1, "a video part needs a source"),
      start: z.number().int().min(0, "a start time is a whole number of seconds").optional(),
      end: z.number().int().min(0, "an end time is a whole number of seconds").optional(),
      search: z.string().min(1).optional(),
      alt: z.string().optional(),
    })
    .superRefine((part, ctx) => {
      const problem = sourceProblem(part.source, part.src);
      if (problem) ctx.addIssue({ code: "custom", path: ["src"], message: problem });
      if (part.source !== "youtube" && (part.start !== undefined || part.end !== undefined)) {
        ctx.addIssue({
          code: "custom",
          path: ["start"],
          message: "start and end belong to a YouTube video",
        });
      }
      if (part.start !== undefined && part.end !== undefined && part.end <= part.start) {
        ctx.addIssue({
          code: "custom",
          path: ["end"],
          message: "the end time must be after the start time",
        });
      }
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
  teaching: z
    .array(teachingPartSchema)
    .min(1, "a teaching layer needs at least one part")
    .optional(),
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
  sourceLanguage: z.string().optional(),
  studyInstruction: z.string().optional(),
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
