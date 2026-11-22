// WHY: A learner must be able to work out a hidden word from the prompt. These
// tests pin the two mechanical cases the app refuses on its own, and the sound
// cards it must leave alone. The prompt text covers the judgement cases.
// PACK: study-card-clarity
// 2026-11-22 opencode: created for the study-card-clarity pack. [pack: study-card-clarity]

import { describe, expect, it } from "vitest";
import {
  COUNT_WORDS,
  clozeContextIssue,
  promptLine,
  singularBase,
} from "@/lib/core/prompt-context";
import type { CardPart, CardSource } from "@/lib/shared/types";

/** The readable prompt is the whole line, including code and spoken parts. */
function cloze(
  prompt: string,
  expected: string,
  overrides: Partial<CardSource> = {},
): CardSource {
  const parts: CardPart[] = [
    { type: "text", text: prompt },
    { type: "blank", id: "b1" },
  ];
  return {
    summary: prompt,
    topics: ["grammar"],
    prompt: parts,
    answer: [{ type: "text", text: expected }],
    answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: [expected] }] },
    ...overrides,
  };
}

describe("promptLine", () => {
  it("joins text, code and spoken parts and skips blanks and media", () => {
    expect(
      promptLine([
        { type: "text", text: "Owner: Anna." },
        { type: "blank", id: "b1" },
        { type: "code", text: "That is" },
        { type: "media", src: "coat.png" },
        { type: "speak", text: "winter coat." },
      ]),
    ).toBe("Owner: Anna. That is winter coat.");
  });
});

describe("clozeContextIssue", () => {
  it("refuses a possessive whose owner is absent and names that owner", () => {
    const issue = clozeContextIssue(cloze("That is ___ winter coat.", "Anna's"));
    expect(issue).not.toBeNull();
    expect(issue?.field).toBe("answerDef.blanks");
    expect(issue?.message).toContain("Anna");
    expect(issue?.message).toContain("Owner: Anna.");
  });

  it("accepts a possessive whose owner is named as a whole word", () => {
    expect(clozeContextIssue(cloze("Owner: Anna. That is ___ winter coat.", "Anna's"))).toBeNull();
  });

  it("does not treat a longer word as the owner", () => {
    expect(clozeContextIssue(cloze("Annabel has a ___ winter coat.", "Anna's"))).not.toBeNull();
  });

  it("refuses a counted plural whose base word is absent and names the base", () => {
    const issue = clozeContextIssue(cloze("There are two ___ on the table.", "cups"));
    expect(issue).not.toBeNull();
    expect(issue?.message).toContain("cups");
    expect(issue?.message).toContain("Base word: cup.");
  });

  it("accepts a counted plural whose base word is named first", () => {
    expect(
      clozeContextIssue(cloze("Base word: cup. There are two ___ on the table.", "cups")),
    ).toBeNull();
  });

  it("does not treat a longer word as the base", () => {
    expect(clozeContextIssue(cloze("Look at the cupboard. There are two ___.", "cups"))).not.toBeNull();
  });

  it("does not accept a prefix fragment too short to name the base", () => {
    expect(clozeContextIssue(cloze("There are two cu___ on the table.", "cups"))).not.toBeNull();
  });

  it("accepts an -ies plural when the -y base is named", () => {
    expect(clozeContextIssue(cloze("There are two ___ in the bag.", "cities"))).not.toBeNull();
    expect(clozeContextIssue(cloze("Base word: city. There are two ___ in the bag.", "cities"))).toBeNull();
  });

  it("accepts an -es plural when its stem is named", () => {
    expect(clozeContextIssue(cloze("There are two ___ on the shelf.", "boxes"))).not.toBeNull();
    expect(clozeContextIssue(cloze("Base word: box. There are two ___ on the shelf.", "boxes"))).toBeNull();
  });

  it("leaves words ending in ss alone", () => {
    expect(clozeContextIssue(cloze("There are two ___ on the shelf.", "glass"))).toBeNull();
  });

  it("needs both a count word and a plural before it complains", () => {
    expect(clozeContextIssue(cloze("I can see ___ on the table.", "cups"))).toBeNull();
    expect(clozeContextIssue(cloze("There are two ___ on the table.", "cup"))).toBeNull();
  });

  it("recognises every count word in the fixed list", () => {
    expect(COUNT_WORDS).toContain("two");
    expect(COUNT_WORDS).toContain("a pair");
    expect(COUNT_WORDS).toContain("several");
    expect(clozeContextIssue(cloze("There are a pair of ___ on the table.", "cups"))).not.toBeNull();
    expect(clozeContextIssue(cloze("There are several ___ on the table.", "cups"))).not.toBeNull();
  });

  it("leaves other answer modes to the other rules", () => {
    expect(clozeContextIssue(cloze("That is ___ winter coat.", "Anna's", {
      answerDef: { mode: "type", expected: ["Anna's"] },
    }))).toBeNull();
  });

  it("does not refuse a word it cannot identify as a possessive or plural", () => {
    expect(clozeContextIssue(cloze("The capital of France is ___.", "Paris"))).toBeNull();
  });
});

describe("singularBase", () => {
  it("names the base a person would write before the sentence", () => {
    expect(singularBase("cups")).toBe("cup");
    expect(singularBase("boxes")).toBe("box");
    expect(singularBase("cities")).toBe("city");
  });

  it("returns null when there is no safe base to name", () => {
    expect(singularBase("glass")).toBeNull();
    expect(singularBase("as")).toBeNull();
    expect(singularBase("cup")).toBeNull();
  });
});
