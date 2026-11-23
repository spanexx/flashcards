// WHY: A cloze prompt that hides "Anna's" or "cups" without naming Anna or the
// base word makes the learner guess a random name or noun. The prompt text can
// teach the judgement cases, but two cases are mechanical: a possessive needs
// its owner, and a counted plural needs its base word. This module refuses only
// those two, so a sound card is never rejected for a rule the app cannot know.
// PACK: study-card-clarity
// 2026-11-22 opencode: created for the study-card-clarity pack.
// [pack: study-card-clarity]

import { z } from "zod";
import type { CardPart, CardSource } from "@/lib/shared/types";
import type { ValidationIssue } from "@/lib/core/schema";

/** The words that tell a learner a plural is expected. */
export const COUNT_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "a pair",
  "a couple",
  "several",
  "many",
  "few",
];

/** The readable side of a prompt: its text, code and spoken parts. */
export function promptLine(parts: CardPart[]): string {
  return parts
    .filter(
      (part): part is Extract<CardPart, { type: "text" | "code" | "speak" }> =>
        part.type === "text" || part.type === "code" || part.type === "speak",
    )
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a line into whole words, keeping an inner apostrophe or hyphen. */
function words(line: string): string[] {
  return line.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

/** True when the exact word or phrase appears, not as part of a longer word. */
function hasWholeWord(line: string, wanted: string): boolean {
  const target = wanted.trim().toLocaleLowerCase();
  if (target.length === 0) return false;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
    "u",
  ).test(line.toLocaleLowerCase());
}

/** The owner in "Anna's" or "the dog’s", or null when the answer is not possessive. */
function possessiveOwner(expected: string): string | null {
  const match = /^(.*?)['’]s$/u.exec(expected.trim());
  const owner = match?.[1]?.trim() ?? "";
  return owner.length > 0 ? owner : null;
}

/** A plural the rule can reason about: a word ending in s, but not ss. */
function looksPlural(expected: string): boolean {
  const lower = expected.toLocaleLowerCase();
  return lower.length >= 3 && lower.endsWith("s") && !lower.endsWith("ss");
}

/**
 * The singular a person would write before the sentence. It is for messages and
 * tests only; the check below uses prefix matching so an ambiguous ending such
 * as "buses" cannot produce a false refusal.
 */
export function singularBase(word: string): string | null {
  const lower = word.trim().toLocaleLowerCase();
  if (lower.length < 3 || !lower.endsWith("s") || lower.endsWith("ss")) return null;
  if (lower.endsWith("ies") && lower.length > 4) return `${lower.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes)$/.test(lower)) return lower.slice(0, -2);
  return lower.slice(0, -1);
}

/**
 * True when the prompt already names the base of a plural. A whole word that is
 * a strict prefix of the plural counts ("cup" for "cups", "bus" for "buses"),
 * and the -ies -> -y change counts ("city" for "cities").
 */
function namesBase(line: string, expected: string): boolean {
  const wanted = expected.toLocaleLowerCase();
  const tokens = words(line);
  if (
    tokens.some(
      (token) =>
        token.length >= 3 && token.length < wanted.length && wanted.startsWith(token),
    )
  ) {
    return true;
  }
  return wanted.endsWith("ies") && wanted.length > 4
    ? tokens.includes(`${wanted.slice(0, -3)}y`)
    : false;
}

/** One problem with a cloze prompt, in the shape the validator reports. */
export interface ClozeContextIssue {
  field: string;
  message: string;
}

/**
 * Refuse a cloze card whose missing word cannot be known from the prompt.
 * The two cases are narrow on purpose; the prompt text covers the rest.
 */
export function clozeContextIssue(
  source: Pick<CardSource, "prompt" | "answerDef">,
): ClozeContextIssue | null {
  if (source.answerDef.mode !== "cloze") return null;
  const line = promptLine(source.prompt);
  const counted = COUNT_WORDS.some((word) => hasWholeWord(line, word));

  for (const blank of source.answerDef.blanks ?? []) {
    const expected = blank.expected?.[0]?.trim() ?? "";
    if (expected.length === 0) continue;

    const owner = possessiveOwner(expected);
    if (owner) {
      if (!hasWholeWord(line, owner)) {
        return {
          field: "answerDef.blanks",
          message: `the prompt asks for "${expected}" but never names its owner; write the owner first, for example "Owner: Anna. That is ___ winter coat."`,
        };
      }
      continue;
    }

    if (counted && looksPlural(expected) && !namesBase(line, expected)) {
      return {
        field: "answerDef.blanks",
        message: `the prompt asks for "${expected}" after a count but never names its base word; write the base word first, for example "Base word: cup. There are two ___ on the table."`,
      };
    }
  }

  return null;
}

// WHY: A canonical example is teaching material, so a teaching line or a hint
// that spells the answer teaches the learner to read the answer instead of the
// rule. This is the one shared spoiler rule; every mode example runs it.
// PACK: learning-mode-core
// 2026-11-22 opencode: created for the learning-mode-core pack.
// [pack: learning-mode-core]

/** The readable words of a card's teaching layer: text, image alt and video alt/search. */
function teachingLine(parts: CardSource["teaching"]): string {
  if (!parts) return "";
  return parts
    .map((part) => {
      if (part.type === "text") return part.text;
      if (part.type === "image") return part.alt;
      return [part.alt ?? "", part.search ?? ""].join(" ");
    })
    .join(" ");
}

/** Every answer a card must not give away, folded to one entry per spelling. */
function answerTokens(def: CardSource["answerDef"]): string[] {
  const raw = [
    ...(def.blanks ?? []).flatMap((blank) => blank.expected ?? []),
    ...(def.expected ?? []),
    ...(def.correct ?? []),
  ];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const value of raw) {
    const token = value.trim();
    // WHY: A one- or two-letter token ("to", "is", "a") occurs in ordinary
    // prose. Policing it would refuse sound teaching, which the risk section
    // of this pack forbids. A real answer token is a word. [pack: learning-mode-core]
    if (token.length < 3) continue;
    const key = token.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push(token);
  }
  return tokens;
}

/**
 * Refuse teaching or a hint that spells one of the card's answers.
 *
 * The check is literal and whole-word: a line that names the rule passes, and
 * only the answer token itself is refused. At most one issue per field, so a
 * card with several spoilered tokens still reads as one sentence per field.
 */
export function spoilerIssues(
  source: Pick<CardSource, "teaching" | "hints" | "answerDef">,
  index = 0,
): ValidationIssue[] {
  const tokens = answerTokens(source.answerDef);
  if (tokens.length === 0) return [];

  const fields = [
    { field: "teaching", text: teachingLine(source.teaching) },
    { field: "hints", text: (source.hints ?? []).join(" ") },
  ];

  const issues: ValidationIssue[] = [];
  for (const { field, text } of fields) {
    if (text.length === 0) continue;
    const token = tokens.find((candidate) => hasWholeWord(text, candidate));
    if (!token) continue;
    issues.push({
      index,
      field,
      message:
        field === "hints"
          ? `a hint gives away the answer "${token}"; a hint must point at the rule, never the answer`
          : `the teaching gives away the answer "${token}"; show how to work it out instead`,
    });
  }
  return issues;
}

// WHY (D-48): the prompt lanes ask the provider to write a learner-facing note,
// but a provider can still echo the old wrapper or an AI directive. This guard
// is the last line of defence at pack storage; it keeps the field optional so
// old packs still import. [pack: study-card-clarity / word-lessons]

const STUDY_NOTE_WRAPPER = /^store this study instruction on the pack:\s*["“']?([\s\S]*?)["”']?\s*$/i;
const STUDY_NOTE_AI_META =
  /^(you are|you're|your job is|your task is|as an? (ai|assistant)|you must|you should|please (write|create|generate|build)|store this study instruction)\b/i;
const STUDY_NOTE_AI_TASK =
  /^(write|create|generate|build|produce)\b.{0,100}\b(decks?|packs?|cards?|json|bundle|jargon)s?\b/i;

export type StudyInstructionResult =
  | { ok: true; value?: string }
  | { ok: false; message: string };

/** Trim, unwrap an echoed prompt wrapper, and refuse AI-addressed study notes. */
export function normalizeStudyInstruction(value: unknown): StudyInstructionResult {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value !== "string") {
    return { ok: false, message: "The study instruction must be text." };
  }
  let text = value.trim();
  if (text.length === 0) return { ok: true };
  const wrapper = STUDY_NOTE_WRAPPER.exec(text);
  if (wrapper) text = wrapper[1].trim();
  if (text.length === 0) return { ok: true };
  if (STUDY_NOTE_AI_META.test(text) || STUDY_NOTE_AI_TASK.test(text)) {
    return {
      ok: false,
      message: "The study instruction must be a learner-facing rule, not an AI instruction.",
    };
  }
  return { ok: true, value: text };
}

/** One zod field for every place a pack's study note is accepted. */
export const studyInstructionField = z
  .string()
  .optional()
  .superRefine((value, ctx) => {
    const result = normalizeStudyInstruction(value);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
    }
  })
  .transform((value) => {
    const result = normalizeStudyInstruction(value);
    return result.ok ? result.value : undefined;
  });
