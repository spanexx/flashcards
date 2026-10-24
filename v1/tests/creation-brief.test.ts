// WHY: The creation brief is the learner's intent, so its shape, defaults and
// refusals are checked once here before any prompt or card builder trusts it.
// PACK: creation-control
// 2026-10-22 opencode: created for the creation-control pack [pack: creation-control]

import { describe, expect, it } from "vitest";
import {
  DEFAULT_CREATION_BRIEF,
  defaultCreationBrief,
  describeCreationBrief,
  describeLibraryInventory,
  isCardStyle,
  libraryInventoryFromPacks,
  validateCreationBrief,
  withBriefOnPackText,
} from "@/lib/shared/creation";

describe("creation brief defaults", () => {
  it("starts as a learner brief with no subject and a mixed style", () => {
    expect(DEFAULT_CREATION_BRIEF).toEqual({
      subjectMode: "learner",
      subject: "",
      deckFocus: "",
      cardStyle: "mixed",
      packName: "",
      deckName: "",
      targetLanguage: "",
      sourceLanguage: "en",
      studyInstruction: "",
    });
    expect(defaultCreationBrief({ subject: "ordering coffee" }).subject).toBe("ordering coffee");
    expect(defaultCreationBrief({ subject: "x" }).subjectMode).toBe("learner");
  });

  it("knows the four styles the screen may send", () => {
    expect(isCardStyle("mixed")).toBe(true);
    expect(isCardStyle("cloze")).toBe(true);
    expect(isCardStyle("type")).toBe(true);
    expect(isCardStyle("hear_type")).toBe(true);
    expect(isCardStyle("picks")).toBe(false);
    expect(isCardStyle("")).toBe(false);
  });
});

describe("validateCreationBrief", () => {
  it("trims a learner brief and keeps every field", () => {
    const result = validateCreationBrief({
      subjectMode: "learner",
      subject: "  ordering coffee  ",
      deckFocus: " drinks, paying ",
      cardStyle: "type",
      packName: " cafe ",
      deckName: " ordering ",
      targetLanguage: " Polish ",
      sourceLanguage: " English ",
      studyInstruction: " Read the English line. ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief).toEqual({
      subjectMode: "learner",
      subject: "ordering coffee",
      deckFocus: "drinks, paying",
      cardStyle: "type",
      packName: "cafe",
      deckName: "ordering",
      targetLanguage: "pl",
      sourceLanguage: "en",
      studyInstruction: "Read the English line.",
    });
  });

  it("refuses a learner brief with no subject", () => {
    const result = validateCreationBrief({
      subjectMode: "learner",
      subject: "   ",
      deckFocus: "",
      cardStyle: "mixed",
      packName: "",
      deckName: "",
      targetLanguage: "pl",
      sourceLanguage: "en",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/subject/i);
  });

  it("ignores the subject text when the provider chooses", () => {
    const result = validateCreationBrief({
      subjectMode: "provider",
      subject: "this text must be ignored",
      deckFocus: "",
      cardStyle: "mixed",
      packName: "",
      deckName: "",
      targetLanguage: "pl",
      sourceLanguage: "en",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.brief.subject).toBe("");
  });

  it("defaults an omitted style to mixed and refuses an unknown one", () => {
    const omitted = validateCreationBrief({
      subjectMode: "learner",
      subject: "verbs",
      targetLanguage: "pl",
    });
    expect(omitted.ok).toBe(true);
    if (omitted.ok) expect(omitted.brief.cardStyle).toBe("mixed");

    const unknown = validateCreationBrief({
      subjectMode: "learner",
      subject: "verbs",
      targetLanguage: "pl",
      cardStyle: "picks",
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.message).toMatch(/style/i);
  });

  it("refuses an unknown subject mode and a non-object brief", () => {
    expect(validateCreationBrief({ subjectMode: "robot", subject: "verbs" }).ok).toBe(false);
    expect(validateCreationBrief(null).ok).toBe(false);
    expect(validateCreationBrief("learner").ok).toBe(false);
  });

  it("keeps an omitted source unknown instead of guessing English", () => {
    const result = validateCreationBrief({
      subjectMode: "learner",
      subject: "verbs",
      targetLanguage: "pl",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.brief.sourceLanguage).toBe("");
  });
});

describe("withBriefOnPackText", () => {
  const brief = defaultCreationBrief({
    targetLanguage: "en",
    sourceLanguage: "en",
    studyInstruction: "Say the line before typing.",
  });

  it("puts the brief's pair and instruction on a Chat pack", () => {
    const text = JSON.stringify({
      pack: { name: "chat-pack", version: "1.0.0", language: "pl", sourceLanguage: "pl" },
      decks: [{ id: "basics", name: "Basics" }],
      cards: [],
    });
    const parsed = JSON.parse(withBriefOnPackText(text, brief));
    expect(parsed.pack).toMatchObject({
      name: "chat-pack",
      language: "en",
      sourceLanguage: "en",
      studyInstruction: "Say the line before typing.",
    });
    expect(parsed.cards).toEqual([]);
  });

  it("leaves invalid or non-pack text for the normal import error", () => {
    expect(withBriefOnPackText("not json", brief)).toBe("not json");
    expect(withBriefOnPackText(JSON.stringify({ decks: [] }), brief)).toBe(
      JSON.stringify({ decks: [] }),
    );
  });
});

describe("library inventory", () => {
  it("keeps pack names, descriptions, languages and deck labels only", () => {
    const inventory = libraryInventoryFromPacks([
      {
        name: "starter",
        description: "Everyday Polish",
        language: "pl",
        sourceLanguage: "en",
        decks: [{ name: "Basics" }, { name: "Cases" }],
      },
      {
        name: "empty",
        decks: [],
      },
    ]);
    expect(inventory).toEqual([
      {
        name: "starter",
        description: "Everyday Polish",
        language: "pl",
        sourceLanguage: "en",
        decks: ["Basics", "Cases"],
      },
      { name: "empty", description: "", language: "", sourceLanguage: "", decks: [] },
    ]);
    const text = describeLibraryInventory(inventory);
    expect(text).toContain("starter");
    expect(text).toContain("Everyday Polish");
    expect(text).toContain("Polish");
    expect(text).toContain("English");
    expect(text).toContain("Basics, Cases");
    expect(text).toContain("empty");
    expect(text).not.toContain("card");
  });

  it("says the library is empty in plain words", () => {
    expect(describeLibraryInventory([])).toMatch(/library is empty/i);
  });
});

describe("describeCreationBrief", () => {
  const inventory = libraryInventoryFromPacks([
    { name: "starter", description: "Everyday Polish", language: "pl", decks: [{ name: "Basics" }] },
  ]);

  it("states a learner subject, deck focus and requested names", () => {
    const lines = describeCreationBrief(
      defaultCreationBrief({
        subject: "ordering coffee",
        deckFocus: "drinks, paying",
        packName: "cafe",
        deckName: "ordering",
      }),
      inventory,
    );
    const text = lines.join("\n");
    expect(text).toContain("ordering coffee");
    expect(text).toContain("drinks, paying");
    expect(text).toContain('"cafe"');
    expect(text).toContain('"ordering"');
  });

  it("asks the provider to fill a gap and names the library", () => {
    const lines = describeCreationBrief(
      defaultCreationBrief({ subjectMode: "provider", subject: "ignored" }),
      inventory,
    );
    const text = lines.join("\n");
    expect(text).toMatch(/gap/i);
    expect(text).toContain("starter");
    expect(text).toContain("Basics");
    expect(text).not.toContain("ignored");
  });

  it("includes the library for a learner brief only when asked", () => {
    const brief = defaultCreationBrief({ subject: "ordering coffee" });
    expect(describeCreationBrief(brief, inventory).join("\n")).not.toContain("starter");
    expect(
      describeCreationBrief(brief, inventory, { includeInventory: true }).join("\n"),
    ).toContain("starter");
  });
});
