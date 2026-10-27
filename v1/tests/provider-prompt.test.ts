// WHY: Everything the provider sees passes through here, so the tests check
// both directions: the allowed slots go in, the learner's words never do, and
// the learner's creation brief reaches all three prompts.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-22 opencode: the brief and library inventory are now checked here too
// [pack: creation-control]

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
import type { ProfileSlots } from "@/lib/provider/prompt";
import {
  defaultCreationBrief,
  libraryInventoryFromPacks,
  type CreationBrief,
} from "@/lib/shared/creation";
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

const slots: ProfileSlots = { weakTopics: ["cases", "aspect"], level: "beginner", learningStyle: "examples-first" };

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
    // The pack's own words come first; only the teaching rule is added around
    // them, because this template leaves the layer out. [D-28]
    expect(
      built.messages[1].content.startsWith("Write 4 lines about cases for a beginner learner."),
    ).toBe(true);
    expect(built.messages[1].content).toContain('may add "teaching"');
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

  it("offers an optional teaching layer without leaking the answer", () => {
    const built = buildGenerationPrompt(makePack(), slots, { topic: "cases", count: 3 });
    const text = built.messages[1].content;
    expect(text).toContain('may add "teaching"');
    expect(text).toContain("never contains the answer");
    expect(text).toContain("not that it still plays");
    expect(text).toContain('"teaching"');
  });
});

const inventory = libraryInventoryFromPacks([
  {
    name: "starter",
    description: "Everyday Polish",
    language: "pl",
    decks: [{ name: "Basics" }, { name: "Cases" }],
  },
]);

/** The learner's brief used by the prompt tests. */
function learnerBrief(overrides: Partial<CreationBrief> = {}): CreationBrief {
  return defaultCreationBrief({ subject: "ordering coffee", ...overrides });
}

/** A pack with its own generation template, like the Polish starter. */
function ownTemplatePack(): PackRecord {
  return makePack({
    prompts: {
      generation: {
        system: "SYSTEM-TEXT",
        template: "Write {{count}} lines about {{topic}} for a {{level}} learner.",
      },
    },
  });
}

/** Build all three generation prompts with one context. */
function allGenerationPrompts(brief: CreationBrief) {
  return {
    pack: buildPackGenerationPrompt(slots, 4, { brief, inventory }),
    deck: buildDeckGenerationPrompt(makePack(), slots, 3, { brief, inventory }),
    cards: buildGenerationPrompt(makePack(), slots, {
      topic: "cases",
      count: 3,
      brief,
      inventory,
    }),
  };
}

describe("structured generation prompts", () => {
  it("asks a generated pack to choose its own name, decks and lines", () => {
    const built = buildPackGenerationPrompt(slots, 4, { inventory });
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

  it("puts the learner's subject in all three generation prompts", () => {
    const built = allGenerationPrompts(learnerBrief());
    expect(built.pack.messages[1].content).toContain("ordering coffee");
    expect(built.deck.messages[1].content).toContain("ordering coffee");
    expect(built.cards.messages[1].content).toContain("ordering coffee");
  });

  it("names the library and asks for a gap in provider mode for all three", () => {
    const built = allGenerationPrompts(defaultCreationBrief({ subjectMode: "provider" }));
    for (const prompt of [built.pack, built.deck, built.cards]) {
      expect(prompt.messages[1].content).toMatch(/gap/i);
      expect(prompt.messages[1].content).toContain("starter");
      expect(prompt.messages[1].content).toContain("Basics");
      expect(prompt.messages[1].content).toContain("Cases");
    }
  });

  it("does not send the library to a learner-subject prompt", () => {
    const built = allGenerationPrompts(learnerBrief());
    expect(built.pack.messages[1].content).not.toContain("Cases");
    expect(built.deck.messages[1].content).not.toContain("Cases");
    expect(built.cards.messages[1].content).not.toContain("Cases");
  });

  it("states a requested name and leaves a blank name to the provider", () => {
    const named = allGenerationPrompts(learnerBrief({ packName: "cafe", deckName: "ordering" }));
    for (const prompt of [named.pack, named.deck, named.cards]) {
      expect(prompt.messages[1].content).toContain('"cafe"');
      expect(prompt.messages[1].content).toContain('"ordering"');
    }

    const blank = allGenerationPrompts(learnerBrief());
    for (const prompt of [blank.pack, blank.deck, blank.cards]) {
      expect(prompt.messages[1].content).not.toContain("asked for the pack name");
      expect(prompt.messages[1].content).not.toContain("asked for the deck name");
    }
  });

  it("asks for one concrete style on all three when the learner chose one", () => {
    const built = allGenerationPrompts(learnerBrief({ cardStyle: "type" }));
    for (const prompt of [built.pack, built.deck, built.cards]) {
      expect(prompt.messages[1].content).toContain('"style"');
      expect(prompt.messages[1].content).toContain('"type"');
      expect(prompt.messages[1].content).toMatch(/translation/i);
    }
  });

  it("puts the target language, question language and study instruction in all three", () => {
    const built = allGenerationPrompts(
      learnerBrief({
        targetLanguage: "es",
        sourceLanguage: "en",
        studyInstruction: "Keep each line under six words.",
      }),
    );
    for (const prompt of [built.pack, built.deck, built.cards]) {
      expect(prompt.messages[1].content).toContain("Spanish (es)");
      expect(prompt.messages[1].content).toContain("English (en)");
      expect(prompt.messages[1].content).toContain("Keep each line under six words.");
    }
  });

  it("uses neutral words for an old pack and never assumes Polish", () => {
    const cards = buildGenerationPrompt(makePack(), slots, { topic: "cases", count: 3 });
    expect(cards.messages[1].content).toContain("the target language");
    expect(cards.messages[1].content).toContain("the question language");
    expect(cards.messages[1].content).not.toContain("Polish");
    const packPrompt = buildPackGenerationPrompt(slots, 3, {});
    expect(packPrompt.messages[1].content).not.toContain("Polish");
    expect(packPrompt.messages[1].content).toContain("The red apple is sweet.");
  });

  it("puts the same teaching rule in all three shapes", () => {
    const pack = buildPackGenerationPrompt(slots, 4);
    const deck = buildDeckGenerationPrompt(makePack(), slots, 3);
    const cards = buildGenerationPrompt(makePack(), slots, {
      topic: "cases",
      count: 3,
      brief: learnerBrief(),
      inventory,
    });
    for (const built of [pack, deck, cards]) {
      const text = built.messages[1].content;
      expect(text).toContain('may add "teaching"');
      expect(text).toContain("never contains the answer");
      expect(text).toContain("not that it still plays");
      expect(text).toContain('"teaching":[{"type":"text"');
    }
  });

  it("asks for the teaching layer when a pack's own template leaves it out", () => {
    const built = buildGenerationPrompt(ownTemplatePack(), slots, {
      topic: "cases",
      count: 3,
      brief: learnerBrief(),
      inventory,
    });
    expect(built.messages[1].content).toContain('may add "teaching"');
  });

  it("says the teaching rule once when the app's own template carries it", () => {
    const built = buildGenerationPrompt(makePack(), slots, {
      topic: "cases",
      count: 3,
      brief: learnerBrief(),
      inventory,
    });
    expect(built.messages[1].content.split('may add "teaching"')).toHaveLength(2);
  });

  it("lets a mixed brief reuse an omitted style as cloze", () => {
    const built = allGenerationPrompts(learnerBrief({ cardStyle: "mixed" }));
    for (const prompt of [built.pack, built.deck, built.cards]) {
      expect(prompt.messages[1].content).toContain("mixed");
      expect(prompt.messages[1].content).toContain("cloze");
    }
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
