// WHY: A learning mode is stored data that a generator reads, so its shape and
// its worked example must be refused before either can reach a prompt. These
// tests pin the stored shape, the one shared answer-mode list, and the composed
// canonical-example check.
// PACK: learning-mode-core
// 2026-11-22 opencode: created for the learning-mode-core pack.
// [pack: learning-mode-core]

import { describe, expect, it } from "vitest";
import { answerModeSchema, learningModeSchema } from "@/lib/core/schema";
import { PACK_BUNDLE_SCHEMA, validateCanonicalExample } from "@/lib/browser/bundle";
import { learningModeIssues, readLearningMode } from "@/lib/browser/modes";
import { ANSWER_MODES, type LearningMode } from "@/lib/shared/types";

/** One whole bundle a mode can show as its worked example. */
function canonicalExample(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
      },
    ],
    words: [],
    pages: [],
    ...overrides,
  };
}

/** A stored mode that passes every rule, so a test changes one fact only. */
function mode(overrides: Partial<LearningMode> = {}): LearningMode {
  return {
    id: "calm-basics",
    name: "Calm basics",
    description: "One short card at a time, with the rule first.",
    version: "1.0.0",
    defaultCardMix: ["cloze", "type"],
    usesWordStages: false,
    skillInstructions: "Ask one question at a time and explain the rule before the next card.",
    canonicalExample: canonicalExample(),
    isBuiltIn: true,
    createdAt: "2026-11-22T09:00:00.000Z",
    ...overrides,
  };
}

describe("answerModeSchema", () => {
  it("names the same five modes as the shared list", () => {
    expect(answerModeSchema.options).toEqual([...ANSWER_MODES]);
  });

  it("refuses a mode name the app does not know", () => {
    expect(answerModeSchema.safeParse("shout").success).toBe(false);
  });
});

describe("learningModeSchema", () => {
  it("accepts a complete mode", () => {
    const parsed = learningModeSchema.safeParse(mode());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.defaultCardMix).toEqual(["cloze", "type"]);
      expect(parsed.data.isBuiltIn).toBe(true);
    }
  });

  it("refuses an id that is not a lowercase slug", () => {
    const parsed = learningModeSchema.safeParse(mode({ id: "Calm Basics" }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["id"]);
  });

  it("refuses an empty card mix", () => {
    const parsed = learningModeSchema.safeParse(mode({ defaultCardMix: [] }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["defaultCardMix"]);
  });

  it("refuses an unknown answer mode in the mix", () => {
    const parsed = learningModeSchema.safeParse({
      ...mode(),
      defaultCardMix: ["cloze", "shout"],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["defaultCardMix", 1]);
  });

  it("refuses a usesWordStages that is not a boolean", () => {
    const parsed = learningModeSchema.safeParse({ ...mode(), usesWordStages: "yes" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["usesWordStages"]);
  });

  it("refuses a mode with no skill instructions", () => {
    // WHY: The key is removed by name, so the rest of the mode stays exactly as
    // the valid fixture wrote it and only one fact differs. [pack: learning-mode-core]
    const withoutSkill: Record<string, unknown> = { ...mode() };
    delete withoutSkill.skillInstructions;
    const parsed = learningModeSchema.safeParse(withoutSkill);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["skillInstructions"]);
  });

  it("refuses a createdAt that is not an ISO date and time", () => {
    const parsed = learningModeSchema.safeParse(mode({ createdAt: "22 November 2026" }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["createdAt"]);
  });

  it("refuses a canonical example that is a JSON string", () => {
    const parsed = learningModeSchema.safeParse({
      ...mode(),
      canonicalExample: JSON.stringify(canonicalExample()),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["canonicalExample"]);
  });
});

describe("readLearningMode", () => {
  it("returns the parsed mode when the shape and the example are sound", () => {
    const read = readLearningMode(mode());
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.mode.id).toBe("calm-basics");
  });

  it("refuses an example that is not a pack bundle", () => {
    const read = readLearningMode({
      ...mode(),
      canonicalExample: { schema: "something/else" },
    });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.issues.length).toBeGreaterThan(0);
      expect(read.issues[0]?.field.startsWith("canonicalExample")).toBe(true);
    }
  });

  it("refuses an example whose hard rule is broken", () => {
    const broken = canonicalExample({
      cards: [
        {
          deckId: "basics",
          summary: "A broken cloze",
          prompt: [{ type: "text", text: "No dotted blank here." }],
          answer: [{ type: "text", text: "Anything." }],
          answerDef: { mode: "cloze", blanks: [] },
        },
      ],
    });
    const issues = learningModeIssues({ ...mode(), canonicalExample: broken });
    expect(issues.some((issue) => issue.message.includes("dotted blank"))).toBe(true);
  });
});

describe("validateCanonicalExample", () => {
  it("accepts a sound example with no issue", () => {
    expect(validateCanonicalExample(canonicalExample())).toEqual([]);
  });

  it("refuses a teaching line that spells the answer", () => {
    const spoiled = canonicalExample({
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
          teaching: [{ type: "text", text: "The answer is Paris." }],
        },
      ],
    });
    const issues = validateCanonicalExample(spoiled);
    expect(issues.some((issue) => issue.field === "teaching")).toBe(true);
  });

  it("accepts a teaching line that names the rule and not the answer", () => {
    const sound = canonicalExample({
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
          teaching: [{ type: "text", text: "A capital city is the seat of a country's government." }],
        },
      ],
    });
    expect(validateCanonicalExample(sound)).toEqual([]);
  });
});
