// WHY: A learner must be able to work out a hidden word from the prompt. These
// tests pin the two mechanical cases the app refuses on its own, and the sound
// cards it must leave alone. The prompt text covers the judgement cases.
// PACK: study-card-clarity
// 2026-11-22 opencode: created for the study-card-clarity pack. [pack: study-card-clarity]

import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  COUNT_WORDS,
  clozeContextIssue,
  normalizeStudyInstruction,
  promptLine,
  singularBase,
  spoilerIssues,
  studyInstructionField,
} from "@/lib/core/prompt-context";
import { PACK_BUNDLE_SCHEMA, validateCanonicalExample } from "@/lib/browser/bundle";
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

describe("study instruction normalisation", () => {
  it("keeps a learner-facing note and allows an absent one", () => {
    expect(normalizeStudyInstruction("  Read it aloud.  ")).toEqual({
      ok: true,
      value: "Read it aloud.",
    });
    expect(normalizeStudyInstruction(undefined)).toEqual({ ok: true });
    expect(normalizeStudyInstruction("  ")).toEqual({ ok: true });
  });

  it("unwraps an echoed prompt wrapper", () => {
    expect(
      normalizeStudyInstruction('Store this study instruction on the pack: "Read it aloud."'),
    ).toEqual({ ok: true, value: "Read it aloud." });
  });

  it("refuses AI-addressed meta text", () => {
    const bad = normalizeStudyInstruction("Your job is to create decks for every form.");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain("learner-facing");
  });

  it("rejects and unwraps through the shared zod field", () => {
    const field = z.object({ note: studyInstructionField });
    const unwrapped = field.safeParse({
      note: 'Store this study instruction on the pack: "Read it aloud."',
    });
    expect(unwrapped.success).toBe(true);
    if (unwrapped.success) expect(unwrapped.data.note).toBe("Read it aloud.");
    expect(field.safeParse({ note: "Your job is to create decks." }).success).toBe(false);
    expect(field.safeParse({}).success).toBe(true);
  });
});

// WHY: A mode's canonical example is teaching material. If its teaching or its
// hint spells the answer, the example teaches the learner to read the answer
// instead of the rule. These cases pin the one shared spoiler rule.
// PACK: learning-mode-core
// 2026-11-22 opencode: added for the learning-mode-core pack.
// [pack: learning-mode-core]

describe("spoilerIssues", () => {
  /** A sound cloze plus one teaching line, so a case changes only the line. */
  function taughtCard(expected: string, line: string): CardSource {
    return {
      ...cloze("Base word: cup. There are two ___ on the table.", expected),
      teaching: [{ type: "text", text: line }],
    };
  }

  it("refuses teaching that spells a blank answer", () => {
    const issues = spoilerIssues(taughtCard("cups", "The answer is cups."));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe("teaching");
    expect(issues[0]?.message).toContain("cups");
  });

  it("accepts teaching that names the rule and not the answer", () => {
    expect(
      spoilerIssues(taughtCard("cups", "A counted plural takes the plural form of the noun.")),
    ).toEqual([]);
  });

  it("refuses a hint that spells a correct option", () => {
    const source: CardSource = {
      ...cloze("The capital of France is ___.", "Paris"),
      answerDef: { mode: "picks", options: ["Paris", "Rome"], correct: ["Paris"] },
      hints: ["It starts with Paris."],
    };
    const issues = spoilerIssues(source);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe("hints");
    expect(issues[0]?.message).toContain("Paris");
  });

  it("checks expected as well as blanks", () => {
    const source: CardSource = {
      ...cloze("The capital of France is ___.", "Paris"),
      answerDef: { mode: "type", expected: ["Paris"] },
      hints: ["Paris is the answer."],
    };
    expect(spoilerIssues(source).map((issue) => issue.field)).toEqual(["hints"]);
  });

  it("does not refuse an ordinary short word that happens to appear in prose", () => {
    const source: CardSource = {
      ...cloze("She ___ to school.", "goes"),
      answerDef: { mode: "type", expected: ["to"] },
      teaching: [{ type: "text", text: "Use the present tense." }],
    };
    expect(spoilerIssues(source)).toEqual([]);
  });

  it("reads image alt text as teaching", () => {
    const source: CardSource = {
      ...cloze("The capital of France is ___.", "Paris"),
      teaching: [{ type: "image", source: "web", src: "https://example.test/paris.png", alt: "Paris" }],
    };
    expect(spoilerIssues(source)[0]?.field).toBe("teaching");
  });
});

describe("validateCanonicalExample spoilers", () => {
  /** One whole bundle with an optional teaching line on its only card. */
  function example(teaching?: string): Record<string, unknown> {
    return {
      schema: PACK_BUNDLE_SCHEMA,
      pack: { name: "mode-demo", version: "1.0.0" },
      decks: [{ id: "basics", name: "Basics", level: "intermediate" }],
      cards: [
        {
          deckId: "basics",
          summary: "The capital of France",
          prompt: [
            { type: "text", text: "The capital of France is" },
            { type: "blank", id: "b1" },
            { type: "text", text: "." },
          ],
          answer: [{ type: "text", text: "Paris." }],
          answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["Paris"] }] },
          ...(teaching ? { teaching: [{ type: "text", text: teaching }] } : {}),
        },
      ],
      words: [],
      pages: [],
    };
  }

  it("refuses an example whose teaching gives the answer away", () => {
    const issues = validateCanonicalExample(example("The answer is Paris."));
    expect(issues.some((issue) => issue.field === "teaching")).toBe(true);
  });

  it("passes a sound example", () => {
    expect(
      validateCanonicalExample(example("A capital city is where a country's government sits.")),
    ).toEqual([]);
  });
});
