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
import type { BrowserPack } from "@/lib/browser/repository";
import {
  defaultCreationBrief,
  libraryInventoryFromPacks,
} from "@/lib/shared/creation";

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

  it("uses the learner's pair and instruction for a new pack", () => {
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
    expect(prompt).toContain("Spanish");
    expect(prompt).toContain("English");
    expect(prompt).toContain("Say each line aloud first.");
    const parsed = parseBundle(example(prompt));
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (parsed.ok) {
      expect(parsed.bundle.pack).toMatchObject({ language: "es", sourceLanguage: "en" });
      expect(parsed.bundle.pack.studyInstruction).toBe("Say each line aloud first.");
    }
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
});
