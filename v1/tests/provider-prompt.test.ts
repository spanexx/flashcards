// WHY: Everything the provider sees passes through here, so the tests check
// both directions: the allowed slots go in, the learner's words never do.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import {
  buildDeckGenerationPrompt,
  buildGenerationPrompt,
  buildHintPrompt,
  buildPackGenerationPrompt,
  describeTutorShape,
  describeTutorSlots,
  promptSideText,
  renderTemplate,
  tutorSlotNames,
} from "@/lib/provider/prompt";
import type { PackRecord } from "@/lib/packs/types";
import { makeCard, makeSource } from "./helpers";

function makePack(overrides: Partial<PackRecord> = {}): PackRecord {
  return {
    name: "test-pack",
    version: "1.0.0",
    folder: "/packs/test-pack",
    topics: ["cases"],
    topicLabels: { cases: "Cases" },
    cards: [makeSource()],
    prompts: null,
    ...overrides,
  };
}

const slots = { weakTopics: ["cases", "aspect"], level: "beginner", learningStyle: "examples-first" };

describe("renderTemplate", () => {
  it("fills known slots and empties unknown ones", () => {
    expect(renderTemplate("a {{one}} b {{two}}", { one: "1" })).toBe("a 1 b ");
    expect(renderTemplate("{{a}}{{a}}", { a: "x" })).toBe("xx");
  });
});

describe("buildGenerationPrompt", () => {
  it("uses the pack's own prompt text when it ships some", () => {
    const pack = makePack({
      prompts: {
        generation: { system: "SYSTEM-TEXT", template: "Write {{count}} lines about {{topic}} for a {{level}} learner." },
      },
    });
    const built = buildGenerationPrompt(pack, slots, { topic: "cases", count: 4 });
    expect(built.messages[0].content).toBe("SYSTEM-TEXT");
    expect(built.messages[1].content).toBe("Write 4 lines about cases for a beginner learner.");
    expect(built.display).toContain("SYSTEM-TEXT");
    expect(built.display).toContain("Write 4 lines");
  });

  it("falls back to the app's own words when the pack ships none", () => {
    const built = buildGenerationPrompt(makePack(), slots, { topic: "cases", count: 3 });
    expect(built.messages[0].content).toContain("complete, correct study lines");
    expect(built.messages[1].content).toContain("cases");
    expect(built.display.length).toBeGreaterThan(0);
  });

  it("carries the weak topic categories as labels only", () => {
    const built = buildGenerationPrompt(makePack(), slots, { topic: "cases", count: 3 });
    expect(built.messages[1].content).toContain("cases, aspect");
  });

  it("says none known when there is nothing weak", () => {
    const built = buildGenerationPrompt(makePack(), { ...slots, weakTopics: [] }, { topic: "cases", count: 3 });
    expect(built.messages[1].content).toContain("none known");
  });

  it("asks for varied nouns, verbs and sentence shapes", () => {
    const built = buildGenerationPrompt(makePack(), slots, { topic: "cases", count: 3 });
    expect(built.messages[1].content).toContain("Vary the nouns, verbs and sentence shapes");
  });
});

describe("structured generation prompts", () => {
  it("asks a generated pack to choose its own name, decks and lines", () => {
    const built = buildPackGenerationPrompt(slots, 4, ["Basics", "Cases"]);
    expect(built.messages[0].content).toContain("choose the containers");
    expect(built.messages[1].content).toContain("Write 4 complete");
    expect(built.messages[1].content).toContain("Basics, Cases");
    expect(built.messages[1].content).toContain('"pack":{"name"');
    expect(built.messages[1].content).toContain('"deckId":"basics"');
    expect(built.display).toContain("beginner");
  });

  it("asks a generated deck to avoid the pack's existing ids", () => {
    const built = buildDeckGenerationPrompt(makePack(), slots, 3);
    expect(built.messages[1].content).toContain("Write 3 complete");
    expect(built.messages[1].content).toContain("test-pack");
    expect(built.messages[1].content).toContain("Do not reuse one of those ids");
    expect(built.messages[1].content).toContain('"deck":{"id"');
  });
});

describe("promptSideText", () => {
  it("renders the question side with hints and never the answer", () => {
    const card = makeCard("card:a", {
      prompt: [
        { type: "text", text: "Piję " },
        { type: "blank", id: "b1", hint: "a drink, accusative" },
        { type: "text", text: "." },
      ],
      answer: [{ type: "text", text: "Piję kawę. SECRET-ANSWER" }],
    });
    const text = promptSideText(card);
    expect(text).toContain("Piję");
    expect(text).toContain("(a drink, accusative)");
    expect(text).not.toContain("SECRET-ANSWER");
  });

  it("names a speak part, an attachment and a plain blank", () => {
    const card = makeCard("card:a", {
      prompt: [
        { type: "speak", text: "Gdzie jest dworzec?" },
        { type: "media", src: "x.png", alt: "a station" },
        { type: "blank", id: "b1" },
      ],
      answer: [{ type: "text", text: "elsewhere" }],
    });
    const text = promptSideText(card);
    expect(text).toContain("Gdzie jest dworzec?");
    expect(text).toContain("a station");
    expect(text).toContain("___");
  });
});

describe("buildHintPrompt", () => {
  it("includes the question, the category and the pack's tutor words", () => {
    const pack = makePack({
      prompts: {
        generation: { system: "g", template: "g" },
        tutor: { system: "TUTOR-SYSTEM", hintTemplate: "Card: {{cardText}} Outcome: {{outcomeCategory}}" },
      },
    });
    const card = makeCard("card:a");
    const built = buildHintPrompt(pack, card, slots, "Nearly");
    expect(built.messages[0].content).toBe("TUTOR-SYSTEM");
    expect(built.messages[1].content).toContain("Card: Piję");
    expect(built.messages[1].content).toContain("___");
    expect(built.messages[1].content).toContain("Outcome: Nearly");
  });

  it("falls back to app words when the pack ships no tutor", () => {
    const built = buildHintPrompt(makePack(), makeCard("card:a"), slots, "not answered yet");
    expect(built.messages[0].content).toContain("never give the full answer");
    expect(built.messages[1].content).toContain("not answered yet");
  });

  it("never carries the answer side anywhere", () => {
    const card = makeCard("card:a", {
      answer: [{ type: "text", text: "MARKER-TYPED-ANSWER" }],
    });
    const built = buildHintPrompt(makePack(), card, slots, "Again");
    expect(built.display).not.toContain("MARKER-TYPED-ANSWER");
    expect(JSON.stringify(built.messages)).not.toContain("MARKER-TYPED-ANSWER");
  });
});

describe("describeTutorShape", () => {
  it("shows the placeholders in plain words", () => {
    const shape = describeTutorShape(makePack());
    expect(shape).toContain("card's question text");
    expect(shape).toContain("how the last answer went");
    expect(shape).not.toContain("{{");
  });

  it("shows a pack's own extra slots, like weak topics", () => {
    const pack = makePack({
      prompts: {
        generation: { system: "g", template: "g" },
        tutor: { system: "s", hintTemplate: "Card: {{cardText}} Weak: {{weakTopics}}" },
      },
    });
    const shape = describeTutorShape(pack);
    expect(shape).toContain("your weak topic categories");
    expect(shape).toContain("Card: (the card's question text)");
  });
});

describe("tutorSlotNames", () => {
  it("reports what the app's own hint words use", () => {
    expect(tutorSlotNames(makePack())).toEqual([
      "cardText",
      "topic",
      "level",
      "learningStyle",
      "outcomeCategory",
    ]);
  });

  it("reports only what a pack's own words use, without repeats", () => {
    const pack = makePack({
      prompts: {
        generation: { system: "g", template: "g" },
        tutor: { system: "s", hintTemplate: "{{cardText}} then {{cardText}} and {{weakTopics}}" },
      },
    });
    expect(tutorSlotNames(pack)).toEqual(["cardText", "weakTopics"]);
    expect(describeTutorSlots(pack)).toEqual([
      "the card's question text",
      "your weak topic categories",
    ]);
  });
});
