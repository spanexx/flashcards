// WHY: The authoring prompt is a versioned copy target. If it drifts from the
// bundle shape, a chat's answer fails at import. These tests keep the parent ids
// and target rules written where the chat can see them.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build (ticket 17).
// 2026-10-21 opencode: target-first Pack/Deck/Cards prompt contract.
// 2026-10-22 opencode: the learner's brief and the allowed library facts are now
// part of every target's prompt. [pack: creation-control]

import { describe, expect, it } from "vitest";
import { AUTHORING_SKILL_VERSION, buildAuthoringPrompt } from "@/lib/browser/authoring";
import { parseBundle, parseCardsBundle, parseDeckBundle } from "@/lib/browser/bundle";
import { clozeContextIssue, promptLine } from "@/lib/core/prompt-context";
import type { BrowserPack } from "@/lib/browser/repository";
import {
  defaultCreationBrief,
  libraryInventoryFromPacks,
} from "@/lib/shared/creation";
import { modeSection } from "@/lib/shared/prompt-layers";

function example(prompt: string): string {
  const at = prompt.lastIndexOf("Return JSON shaped like this");
  const start = prompt.indexOf("{", at);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < prompt.length; index += 1) {
    const char = prompt[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return prompt.slice(start, index + 1);
    }
  }
  return prompt.slice(start);
}

const pack: BrowserPack = {
  id: "starter",
  name: "starter",
  version: "1.2.3",
  decks: [
    { id: "basics", name: "Basics", level: "intermediate" },
    { id: "cases", name: "Cases", level: "intermediate" },
  ],
  prompts: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
};

describe("buildAuthoringPrompt", () => {
  it("lets the chat name a new pack and shows a whole pack shape", () => {
    const prompt = buildAuthoringPrompt({ kind: "pack" });
    expect(prompt).toContain(AUTHORING_SKILL_VERSION);
    expect(prompt).toContain("Choose a short lowercase pack name");
    expect(prompt).toContain("study-pack");
    expect(prompt).toContain("flashcards.pack/v1");
    const result = parseBundle(example(prompt));
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it("does not assume Polish when neither a pack nor a brief declares one", () => {
    const prompt = buildAuthoringPrompt({ kind: "pack" });
    expect(prompt).toContain("study-pack");
    expect(prompt).not.toContain("Polish");
    expect(parseBundle(example(prompt)).ok).toBe(true);
  });

  // WHY: The raw request is context for the chat, not the note it must write.
  // The example shape teaches the distilled shape without echoing the request.
  // PACK: study-card-clarity
  // 2026-11-22 opencode: changed the note and cloze assertions. [pack: study-card-clarity]
  it("quotes the learner's preference but teaches a distilled note", () => {
    const prompt = buildAuthoringPrompt(
      { kind: "pack" },
      null,
      {
        brief: defaultCreationBrief({
          subject: "ordering coffee",
          targetLanguage: "es",
          sourceLanguage: "en",
          studyInstruction: "Say each line aloud first.",
        }),
      },
    );
    expect(AUTHORING_SKILL_VERSION).toBe("9.0.0");
    expect(prompt).toContain("Spanish");
    expect(prompt).toContain("English");
    expect(prompt).toContain("Say each line aloud first.");
    expect(prompt).toContain("Write one short learner-facing study note from it");
    expect(prompt).toContain("Base word: cup. There are two ___ on the table.");
    expect(prompt).toContain("Owner: Anna. That is ___ winter coat.");
    const shape = example(prompt);
    expect(shape).toContain("<one short learner-facing sentence on how to study>");
    expect(shape).not.toContain("Say each line aloud first.");
    const parsed = parseBundle(shape);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (parsed.ok) {
      expect(parsed.bundle.pack).toMatchObject({ language: "es", sourceLanguage: "en" });
      expect(parsed.bundle.pack.studyInstruction).toBe(
        "<one short learner-facing sentence on how to study>",
      );
    }
  });

  it("shows a self-contained cloze example that passes the same guard as a real card", () => {
    const prompt = buildAuthoringPrompt(
      { kind: "cards", packName: "starter", deckId: "basics" },
      pack,
    );
    expect(prompt).toContain("Base word: apple. There are two apples on the table.");
    expect(prompt).not.toContain("The red apple is sweet.");
    const parsed = parseCardsBundle(example(prompt));
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (!parsed.ok) return;
    const card = parsed.bundle.cards[0];
    expect(card.fullLine).toBe("Base word: apple. There are two apples on the table.");
    expect(promptLine(card.prompt)).toBe("Base word: apple. There are two on the table.");
    expect(JSON.stringify(card.prompt)).toContain('"type":"blank","id":"b1"');
    expect(card.answerDef).toMatchObject({ mode: "cloze", blanks: [{ expected: ["apples"] }] });
    expect(clozeContextIssue(card)).toBeNull();
    expect(JSON.stringify(card.teaching)).not.toContain("apples");
  });

  it("reads the pair and instruction from an existing pack", () => {
    const polishPack: BrowserPack = {
      ...pack,
      language: "pl",
      sourceLanguage: "en",
      studyInstruction: "Read the whole line before typing.",
    };
    const prompt = buildAuthoringPrompt({ kind: "cards", packName: "starter", deckId: "cases" }, polishPack);
    expect(prompt).toContain("Polish");
    expect(prompt).toContain("English");
    expect(prompt).toContain("Read the whole line before typing.");
    expect(parseCardsBundle(example(prompt)).ok).toBe(true);
  });

  it("names the existing pack and asks for new decks only", () => {
    const prompt = buildAuthoringPrompt({ kind: "deck", packName: "starter" }, pack);
    expect(prompt).toContain("starter");
    expect(prompt).toContain("basics = Basics");
    expect(prompt).toContain("cases = Cases");
    expect(prompt).toContain("Do not include a \"pack\" header");
    expect(prompt).not.toContain("\"pack\": { \"name\": \"starter\"");
    const result = parseDeckBundle(example(prompt));
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it("names the real deck and asks for cards only", () => {
    const prompt = buildAuthoringPrompt({ kind: "cards", packName: "starter", deckId: "cases" }, pack);
    expect(prompt).toContain('"cases"');
    expect(prompt).toContain("Cases");
    expect(prompt).toContain("Return only cards for the target deck");
    const result = parseCardsBundle(example(prompt));
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(example(prompt)).toContain('"deckId": "cases"');
  });

  it("picks a new deck id that does not collide with an existing one", () => {
    const withExtra: BrowserPack = {
      ...pack,
      decks: [...pack.decks, { id: "extra", name: "Extra", level: "intermediate" }],
    };
    const prompt = buildAuthoringPrompt({ kind: "deck", packName: "starter" }, withExtra);
    expect(prompt).toContain('"id": "extra-2"');
  });

  it("refuses an existing target whose pack is gone", () => {
    expect(() => buildAuthoringPrompt({ kind: "deck", packName: "starter" }, null)).toThrow(/starter/);
  });

  it("refuses a deck that is not in the pack", () => {
    expect(() =>
      buildAuthoringPrompt({ kind: "cards", packName: "starter", deckId: "gone" }, pack),
    ).toThrow(/gone/);
  });

  it("puts the learner brief and library into all three targets", () => {
    const inventory = libraryInventoryFromPacks([
      {
        name: "starter",
        description: "Everyday Polish",
        language: "pl",
        decks: [{ name: "Basics" }, { name: "Cases" }],
      },
    ]);
    const context = {
      brief: defaultCreationBrief({
        subject: "ordering coffee",
        deckFocus: "cafes, paying",
        cardStyle: "type",
        packName: "cafe",
      }),
      inventory,
    };
    for (const target of [
      { kind: "pack" as const },
      { kind: "deck" as const, packName: "starter" },
      { kind: "cards" as const, packName: "starter", deckId: "cases" },
    ]) {
      const prompt = buildAuthoringPrompt(target, pack, context);
      expect(prompt).toContain("ordering coffee");
      expect(prompt).toContain("cafes, paying");
      expect(prompt).toContain("Everyday Polish");
      expect(prompt).toContain("Basics");
      expect(prompt).toContain("Cases");
      expect(prompt).toContain('"cafe"');
      expect(prompt).toContain("type");
      expect(prompt).toMatch(/translation/i);
    }
  });

  // WHY: chat cards carry their answer mode in answerDef.mode, not in a
  // "style" field. This pin keeps the chat's style words card-shaped after the
  // shared rule was moved into the common layer.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: added after line-shaped words leaked into chat. [pack: prompt-assembler]
  it("teaches answer modes on cards, never a style field on lines", () => {
    const prompt = buildAuthoringPrompt(
      { kind: "cards", packName: "starter", deckId: "cases" },
      pack,
      {
        brief: defaultCreationBrief({
          cardStyle: "mixed",
          targetLanguage: "pl",
          sourceLanguage: "en",
        }),
      },
    );
    expect(prompt).toContain(
      "Card style: mixed. Use a mix of cloze, type and hear_type answer modes across the cards.",
    );
    expect(prompt).not.toContain('Set "style" on each line');
    expect(prompt).not.toContain('Every line must set "style"');
  });

  // WHY: the type and hear_type extras are card words too. The generation
  // lane's "every line" wording would teach a shape the chat cannot import.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: pinned the fixed-style card words. [pack: prompt-assembler]
  it("keeps the exact card words for fixed type and hear_type styles", () => {
    const typed = buildAuthoringPrompt({ kind: "pack" }, pack, {
      brief: defaultCreationBrief({
        cardStyle: "type",
        targetLanguage: "pl",
        sourceLanguage: "en",
      }),
    });
    expect(typed).toContain(
      "Card style: type. Every card must build a type answer. A card with another answer mode does not match the learner's request.",
    );
    expect(typed).toContain(
      "Every type card needs a translation part in English, because the learner reads it and types the full Polish line.",
    );
    expect(typed).not.toContain("Every type line must include a translation");

    const heard = buildAuthoringPrompt({ kind: "pack" }, pack, {
      brief: defaultCreationBrief({
        cardStyle: "hear_type",
        targetLanguage: "pl",
        sourceLanguage: "en",
      }),
    });
    expect(heard).toContain(
      "Card style: hear_type. Every card must build a hear_type answer. A card with another answer mode does not match the learner's request.",
    );
    expect(heard).toContain(
      "Every hear_type card speaks the full line in Polish, and the learner types the full Polish line.",
    );
    expect(heard).not.toContain("Every hear_type line is spoken");
  });

  it("lets the chat choose from the library when the provider mode is on", () => {
    const context = {
      brief: defaultCreationBrief({ subjectMode: "provider", subject: "ignored" }),
      inventory: libraryInventoryFromPacks([
        { name: "starter", description: "Everyday Polish", decks: [{ name: "Basics" }] },
      ]),
    };
    const prompt = buildAuthoringPrompt({ kind: "pack" }, undefined, context);
    expect(prompt).toMatch(/gap/i);
    expect(prompt).toContain("starter");
    expect(prompt).toContain("Basics");
    expect(prompt).not.toContain("ignored");
  });

  it("asks for a teaching layer that never gives the answer away", () => {
    const prompt = buildAuthoringPrompt({ kind: "cards", packName: "starter", deckId: "cases" }, pack);
    expect(prompt).toContain('"teaching"');
    expect(prompt).toContain("never contains the answer");
    expect(prompt).toContain("nobody has checked that it still plays");
    expect(buildAuthoringPrompt({ kind: "pack" })).toContain("no teaching part gives the answer away");
    const parsed = parseCardsBundle(example(prompt));
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (parsed.ok) {
      expect(parsed.bundle.cards[0].teaching?.[0]).toMatchObject({ type: "text" });
    }
  });

  it("still returns a parseable example when the brief is present", () => {
    const context = {
      brief: defaultCreationBrief({ subject: "ordering coffee", cardStyle: "mixed" }),
      inventory: libraryInventoryFromPacks([
        { name: "starter", description: "Everyday Polish", decks: [{ name: "Basics" }] },
      ]),
    };
    const prompt = buildAuthoringPrompt(
      { kind: "cards", packName: "starter", deckId: "cases" },
      pack,
      context,
    );
    expect(parseCardsBundle(example(prompt)).ok).toBe(true);
  });

  it("shows a whole word lesson the importer will accept", () => {
    const prompt = buildAuthoringPrompt({ kind: "pack" });
    expect(prompt).toContain('"words"');
    expect(prompt).toContain('"matching"');
    expect(prompt).toContain("Stage fixes the answer mode");
    const result = parseBundle(example(prompt));
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) {
      expect(result.bundle.words[0].lemma).toBe("the base word");
      expect(result.bundle.cards.filter((card) => card.stage)).toHaveLength(5);
      const forms = result.bundle.cards.find((card) => card.stage === "forms");
      expect(promptLine(forms?.prompt ?? [])).toBe('Type the changed form of "the base word":');
      expect(promptLine(forms?.prompt ?? [])).not.toContain("___");
      expect(prompt).toContain("A forms card is a type card, not a cloze");
    }
  });

  it("carries the focus word into both lanes and keeps it out of fragments' shape", () => {
    const brief = defaultCreationBrief({ subject: "at the office", focusWord: "biuro" });
    const packPrompt = buildAuthoringPrompt({ kind: "pack" }, null, { brief });
    const cardsPrompt = buildAuthoringPrompt(
      { kind: "cards", packName: "starter", deckId: "basics" },
      pack,
      { brief },
    );
    expect(packPrompt).toContain('lemma "biuro"');
    expect(cardsPrompt).toContain('lemma "biuro"');
    expect(cardsPrompt).toContain("A fragment cannot define a word");
    expect(parseCardsBundle(example(cardsPrompt)).ok).toBe(true);
  });
});

// WHY: the chat lane must place the same mode section once, before its JSON
// shape, and leave every other line alone. [pack: prompt-assembler]
// 2026-11-23 opencode: added the chat mode-seam assertions. [pack: prompt-assembler]
describe("learning mode in chat prompts", () => {
  const targets = [
    { kind: "pack" as const },
    { kind: "deck" as const, packName: "starter" },
    { kind: "cards" as const, packName: "starter", deckId: "cases" },
  ];
  const modeA = {
    skillInstructions: "MODE-A-SKILL: name each role in plain English.",
    canonicalExample: '{"pack":{"name":"example-a"}}',
  };
  const modeB = {
    skillInstructions: "MODE-B-SKILL: one card for each changed form.",
    canonicalExample: '{"pack":{"name":"example-b"}}',
  };

  function build(mode?: typeof modeA) {
    return targets.map((target) => buildAuthoringPrompt(target, pack, { mode }));
  }

  it("injects the skill and example once before the JSON shape in every target", () => {
    const sectionA = modeSection(modeA).join("\n");
    const prompts = build(modeA);
    for (let index = 0; index < prompts.length; index += 1) {
      const prompt = prompts[index];
      expect(prompt.split(modeA.skillInstructions)).toHaveLength(2);
      expect(prompt.split(modeA.canonicalExample)).toHaveLength(2);
      expect(prompt.split(sectionA)).toHaveLength(2);
      expect(prompt.indexOf(modeA.skillInstructions)).toBeLessThan(
        prompt.lastIndexOf("Return JSON shaped like this:"),
      );
      const shape = example(prompt);
      expect(shape.length).toBeGreaterThan(10);
      if (targets[index].kind === "pack") expect(parseBundle(shape).ok).toBe(true);
      if (targets[index].kind === "deck") expect(parseDeckBundle(shape).ok).toBe(true);
      if (targets[index].kind === "cards") expect(parseCardsBundle(shape).ok).toBe(true);
    }
  });

  it("changes only layer 3 when a different mode is selected", () => {
    const sectionA = modeSection(modeA).join("\n");
    const sectionB = modeSection(modeB).join("\n");
    const first = build(modeA);
    const second = build(modeB);
    for (let index = 0; index < first.length; index += 1) {
      expect(first[index]).not.toBe(second[index]);
      expect(first[index].replace(sectionA, "MODE")).toBe(second[index].replace(sectionB, "MODE"));
    }
  });

  it("leaves the prompt unchanged when no mode or an empty skill is given", () => {
    const bare = build();
    const empty = build({ skillInstructions: "   ", canonicalExample: "x" });
    for (let index = 0; index < bare.length; index += 1) {
      expect(empty[index]).toBe(bare[index]);
      expect(bare[index]).not.toContain("Learning mode:");
    }
  });
});
