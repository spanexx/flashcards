// WHY: A cloze prompt that hides "Anna's" or "cups" without naming Anna or the
// base word makes the learner guess a random name or noun. The prompt text can
// teach the judgement cases, but two cases are mechanical: a possessive needs
// its owner, and a counted plural needs its base word. This module refuses only
// those two, so a sound card is never rejected for a rule the app cannot know.
// PACK: study-card-clarity
// 2026-11-22 opencode: created for the study-card-clarity pack.
// [pack: study-card-clarity]

import type { CardPart, CardSource } from "@/lib/shared/types";

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
