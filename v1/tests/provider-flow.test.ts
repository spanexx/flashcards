// WHY: The prepared prompt is the exact text the learner approves, so it is
// one-time and short-lived. Generation must refuse a bad batch whole, and a
// hint must always fall back to the pack's own words.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-22 opencode: cloze, type and hear_type lines are checked here, and a
// batch that ignores the requested style is refused whole. [pack: creation-control]
// 2026-10-27 qoder: the learner's edit is pinned as the whole request, and a
// generated deck is stored at the level the caller passed. [D-29, D-30]

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPromptEdit,
  clearPrepared,
  holdPrepared,
  takePrepared,
} from "@/lib/provider/prepare";
import {
  deriveCard,
  generateCardsFromText,
  generatedCardsBundle,
  generatedDeckBundle,
  generatedPackBundle,
} from "@/lib/provider/generate";
import { pickPackHint, requestTutorHint } from "@/lib/provider/hint";
import type { PackRecord } from "@/lib/packs/types";
import type { ProviderConfig } from "@/lib/provider/config";
import { makeCard, makeSource } from "./helpers";

const NOW = "2026-10-10T12:00:00.000Z";

function makePack(overrides: Partial<PackRecord> = {}): PackRecord {
  return {
    name: "test-pack",
    version: "1.0.0",
    folder: "/packs/test-pack",
    topics: ["cases"],
    topicLabels: {},
    cards: [makeSource()],
    prompts: null,
    ...overrides,
  };
}

const config: ProviderConfig = {
  url: "http://provider.test/v1",
  model: "some-model",
  key: "test-key",
  swappedForWsl: false,
};

afterEach(() => {
  clearPrepared();
  vi.unstubAllGlobals();
});

describe("prepared requests", () => {
  it("hands out an id and takes the prompt once", () => {
    const prepared = holdPrepared({
      kind: "generation",
      display: "the exact text",
      messages: [{ role: "user", content: "the exact text" }],
      targetKind: "cards",
      packName: "test-pack",
      topic: "cases",
      deckId: "cases",
      count: 3,
      cardId: null,
    });
    expect(takePrepared(prepared.id)?.display).toBe("the exact text");
    expect(takePrepared(prepared.id)).toBeNull();
    expect(takePrepared("no-such-id")).toBeNull();
  });

  it("forgets a prompt that waited too long", () => {
    vi.useFakeTimers();
    try {
      const prepared = holdPrepared({
        kind: "hint",
        display: "old",
        messages: [{ role: "user", content: "old" }],
        packName: "test-pack",
        topic: null,
        deckId: null,
        count: null,
        cardId: "card:a",
      });
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(takePrepared(prepared.id)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("takes the learner's edit as the whole request", () => {
    const prepared = holdPrepared({
      kind: "generation",
      display: "the exact text",
      messages: [
        { role: "system", content: "SYSTEM-TEXT" },
        { role: "user", content: "the exact text" },
      ],
      targetKind: "cards",
      packName: "test-pack",
      topic: "cases",
      deckId: "cases",
      count: 3,
      cardId: null,
    });
    const edited = applyPromptEdit(prepared, "  Write one line about the weather.  ");
    expect(edited.display).toBe("Write one line about the weather.");
    expect(edited.messages).toEqual([
      { role: "user", content: "Write one line about the weather." },
    ]);
    expect(edited.id).toBe(prepared.id);
    expect(edited.topic).toBe("cases");
  });

  it("keeps the held prompt when the edit is blank or unchanged", () => {
    const prepared = holdPrepared({
      kind: "generation",
      display: "the exact text",
      messages: [{ role: "user", content: "the exact text" }],
      packName: "test-pack",
      topic: null,
      deckId: null,
      count: null,
      cardId: null,
    });
    expect(applyPromptEdit(prepared, "   ")).toBe(prepared);
    expect(applyPromptEdit(prepared, "the exact text")).toBe(prepared);
  });
});

describe("deriveCard", () => {
  it("hides exactly the target the model named", () => {
    const card = deriveCard(
      makePack(),
      "request-1",
      { fullLine: "Piję kawę.", target: "kawę", translation: "I am drinking coffee.", summary: "Piję kawę", topics: ["cases"] },
      "cases",
      NOW,
    );
    expect(card.prompt).toEqual([
      { type: "text", text: "Piję " },
      { type: "blank", id: "b1" },
      { type: "text", text: "." },
    ]);
    expect(card.answerDef.blanks?.[0].expected).toEqual(["kawę"]);
    expect(
      card.answer.some((part) => part.type === "text" && part.role === "translation"),
    ).toBe(true);
    expect(card.origin.kind).toBe("generated");
    expect(card.origin.requestId).toBe("request-1");
  });

  it("finds the target even when the case differs", () => {
    const card = deriveCard(
      makePack(),
      "request-1",
      { fullLine: "Piję Kawę.", target: "kawę" },
      "cases",
      NOW,
    );
    expect(card.prompt[0]).toEqual({ type: "text", text: "Piję " });
  });

  it("refuses a target that is not inside the line", () => {
    expect(() =>
      deriveCard(makePack(), "request-1", { fullLine: "Piję kawę.", target: "herbatę" }, "cases", NOW),
    ).toThrow("not inside the line");
  });

  it("keeps only pack topics and falls back to the chosen one", () => {
    const offTopic = deriveCard(
      makePack(),
      "request-1",
      { fullLine: "Piję kawę.", target: "kawę", topics: ["invented"] },
      "cases",
      NOW,
    );
    expect(offTopic.topics).toEqual(["cases"]);

    const kept = deriveCard(
      makePack(),
      "request-1",
      { fullLine: "Piję kawę.", target: "kawę", topics: ["cases"] },
      "cases",
      NOW,
    );
    expect(kept.topics).toEqual(["cases"]);
  });

  it("turns a type line into a translation prompt and a typed answer", () => {
    const card = deriveCard(
      makePack(),
      "request-1",
      {
        fullLine: "Piję kawę.",
        target: "kawę",
        translation: "I am drinking coffee.",
        style: "type",
      },
      "cases",
      NOW,
    );
    expect(card.prompt).toEqual([{ type: "text", text: "I am drinking coffee." }]);
    expect(card.answer).toEqual([{ type: "text", text: "Piję kawę." }]);
    expect(card.answerDef).toEqual({ mode: "type", expected: ["Piję kawę."] });
  });

  it("turns a hear_type line into a spoken prompt in the pack language", () => {
    const card = deriveCard(
      makePack(),
      "request-1",
      { fullLine: "Piję kawę.", target: "kawę", style: "hear_type" },
      "cases",
      NOW,
      undefined,
      { language: "pl" },
    );
    expect(card.prompt).toEqual([
      { type: "speak", text: "Piję kawę.", lang: "pl", label: "Listen" },
    ]);
    expect(card.answerDef).toEqual({ mode: "hear_type", expected: ["Piję kawę."] });
  });

  it("leaves the language off a hear_type card when the pack has none", () => {
    const card = deriveCard(
      makePack(),
      "request-1",
      { fullLine: "Piję kawę.", target: "kawę", style: "hear_type" },
      "cases",
      NOW,
    );
    expect(card.prompt).toEqual([{ type: "speak", text: "Piję kawę.", label: "Listen" }]);
  });
});

describe("generateCardsFromText", () => {
  it("reads a whole good batch", () => {
    const text = JSON.stringify({
      lines: [
        { fullLine: "Piję kawę.", target: "kawę", topics: ["cases"] },
        { fullLine: "Mam kota.", target: "kota", topics: ["cases"] },
      ],
    });
    const cards = generateCardsFromText(makePack(), "request-1", text, "cases", NOW);
    expect(cards).toHaveLength(2);
  });

  it("reads a fenced reply", () => {
    const text = '```json\n{"lines":[{"fullLine":"Mam kota.","target":"kota"}]}\n```';
    expect(generateCardsFromText(makePack(), "request-1", text, "cases", NOW)).toHaveLength(1);
  });

  it("refuses the whole batch when one line is unusable", () => {
    const text = JSON.stringify({
      lines: [
        { fullLine: "Piję kawę.", target: "kawę" },
        { fullLine: "Mam kota.", target: "rybę" },
      ],
    });
    expect(() => generateCardsFromText(makePack(), "request-1", text, "cases", NOW)).toThrow(
      "not inside the line",
    );
  });

  it("refuses a batch that is not shaped right", () => {
    expect(() => generateCardsFromText(makePack(), "request-1", '{"lines":[]}', "cases", NOW)).toThrow(
      "not usable",
    );
    expect(() => generateCardsFromText(makePack(), "request-1", "no json at all", "cases", NOW)).toThrow(
      "JSON object",
    );
  });

  it("drops an exact duplicate line", () => {
    const line = { fullLine: "Piję kawę.", target: "kawę" };
    const text = JSON.stringify({ lines: [line, line] });
    expect(generateCardsFromText(makePack(), "request-1", text, "cases", NOW)).toHaveLength(1);
  });

  it("treats an omitted style as cloze for a mixed request", () => {
    const text = JSON.stringify({ lines: [{ fullLine: "Piję kawę.", target: "kawę" }] });
    const cards = generateCardsFromText(makePack(), "request-1", text, "cases", NOW, undefined, {
      cardStyle: "mixed",
    });
    expect(cards[0].answerDef.mode).toBe("cloze");
  });

  it("refuses a line whose style ignores the learner's request", () => {
    const text = JSON.stringify({
      lines: [
        {
          fullLine: "Piję kawę.",
          target: "kawę",
          translation: "I am drinking coffee.",
          style: "type",
        },
      ],
    });
    expect(() =>
      generateCardsFromText(makePack(), "request-1", text, "cases", NOW, undefined, {
        cardStyle: "cloze",
      }),
    ).toThrow(/cloze/i);
  });

  it("refuses a line with no style when a specific style was requested", () => {
    const text = JSON.stringify({ lines: [{ fullLine: "Piję kawę.", target: "kawę" }] });
    expect(() =>
      generateCardsFromText(makePack(), "request-1", text, "cases", NOW, undefined, {
        cardStyle: "cloze",
      }),
    ).toThrow(/style/i);
  });

  it("refuses a type line that has no translation", () => {
    const text = JSON.stringify({
      lines: [{ fullLine: "Piję kawę.", target: "kawę", style: "type" }],
    });
    expect(() =>
      generateCardsFromText(makePack(), "request-1", text, "cases", NOW, undefined, {
        cardStyle: "type",
      }),
    ).toThrow(/translation/i);
  });
});

describe("structured generation bundles", () => {
  it("reads a generated pack into a whole-pack bundle", () => {
    const text = JSON.stringify({
      pack: { name: "slow-polish", version: "1.0.0", language: "pl" },
      decks: [{ id: "basics", name: "Basics" }],
      lines: [{ deckId: "basics", fullLine: "Piję kawę.", target: "kawę" }],
    });
    const read = generatedPackBundle(text);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.bundle.pack).toMatchObject({ name: "slow-polish" });
    expect(read.bundle.decks).toEqual([{ id: "basics", name: "Basics", level: "intermediate" }]);
    const cards = read.bundle.cards as Array<{ deckId: string }>;
    expect(cards[0].deckId).toBe("basics");
  });

  it("refuses a generated pack line that names an undefined deck", () => {
    const text = JSON.stringify({
      pack: { name: "slow-polish" },
      decks: [{ id: "basics", name: "Basics" }],
      lines: [{ deckId: "gone", fullLine: "Piję kawę.", target: "kawę" }],
    });
    const read = generatedPackBundle(text);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.message).toContain("did not define");
  });

  it("reads a generated deck and generated cards into their fragments", () => {
    const deck = generatedDeckBundle(JSON.stringify({
      deck: { id: "extra", name: "Extra" },
      lines: [{ fullLine: "Piję kawę.", target: "kawę" }],
    }));
    expect(deck.ok).toBe(true);
    if (deck.ok) expect(deck.bundle.decks).toEqual([{ id: "extra", name: "Extra", level: "intermediate" }]);

    const cards = generatedCardsBundle(
      JSON.stringify({ lines: [{ fullLine: "Piję kawę.", target: "kawę" }] }),
      { id: "cases", name: "Cases" },
    );
    expect(cards.ok).toBe(true);
    if (cards.ok) {
      expect(cards.bundle.cards).toEqual([
        expect.objectContaining({ deckId: "cases", fullLine: "Piję kawę." }),
      ]);
    }
  });

  it("stores a generated deck at the level the caller passed", () => {
    const pack = generatedPackBundle(
      JSON.stringify({
        pack: { name: "slow-polish" },
        decks: [{ id: "basics", name: "Basics" }],
        lines: [{ deckId: "basics", fullLine: "Piję kawę.", target: "kawę" }],
      }),
      { level: "advanced" },
    );
    expect(pack.ok).toBe(true);
    if (!pack.ok) return;
    expect(pack.bundle.decks).toEqual([{ id: "basics", name: "Basics", level: "advanced" }]);

    const deck = generatedDeckBundle(
      JSON.stringify({
        deck: { id: "extra", name: "Extra" },
        lines: [{ fullLine: "Piję kawę.", target: "kawę" }],
      }),
      { level: "beginner" },
    );
    expect(deck.ok).toBe(true);
    if (deck.ok) {
      expect(deck.bundle.decks).toEqual([{ id: "extra", name: "Extra", level: "beginner" }]);
    }
  });

  it("keeps the brief's pair and instruction when the provider names another", () => {
    const text = JSON.stringify({
      pack: { name: "slow-polish", version: "1.0.0", language: "pl", sourceLanguage: "pl" },
      decks: [{ id: "basics", name: "Basics" }],
      lines: [{ deckId: "basics", fullLine: "The cat is black.", target: "black" }],
    });
    const read = generatedPackBundle(text, {
      language: "en",
      sourceLanguage: "en",
      studyInstruction: "Say the line before typing.",
    });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.bundle.pack).toMatchObject({
      language: "en",
      sourceLanguage: "en",
      studyInstruction: "Say the line before typing.",
    });
  });

  it("builds the requested type style inside a generated pack bundle", () => {
    const text = JSON.stringify({
      pack: { name: "slow-polish", version: "1.0.0", language: "pl" },
      decks: [{ id: "basics", name: "Basics" }],
      lines: [
        {
          deckId: "basics",
          style: "type",
          fullLine: "Piję kawę.",
          target: "kawę",
          translation: "I am drinking coffee.",
        },
      ],
    });
    const read = generatedPackBundle(text, { cardStyle: "type" });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const cards = read.bundle.cards as Array<{ answerDef: { mode: string }; prompt: unknown[] }>;
    expect(cards[0].answerDef.mode).toBe("type");
    expect(cards[0].prompt).toEqual([{ type: "text", text: "I am drinking coffee." }]);
  });

  it("uses the pack language for a hear_type generated deck", () => {
    const text = JSON.stringify({
      deck: { id: "extra", name: "Extra" },
      lines: [{ style: "hear_type", fullLine: "Piję kawę.", target: "kawę" }],
    });
    const read = generatedDeckBundle(text, { cardStyle: "hear_type", language: "pl" });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const cards = read.bundle.cards as Array<{ prompt: unknown[] }>;
    expect(cards[0].prompt).toEqual([
      { type: "speak", text: "Piję kawę.", lang: "pl", label: "Listen" },
    ]);
  });

  it("refuses a whole bundle that ignores a specific requested style", () => {
    const text = JSON.stringify({
      lines: [
        {
          fullLine: "Piję kawę.",
          target: "kawę",
          translation: "I am drinking coffee.",
          style: "type",
        },
      ],
    });
    const read = generatedCardsBundle(text, { id: "cases", name: "Cases" }, { cardStyle: "cloze" });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.message).toMatch(/cloze|style/i);
  });

  it("carries a line's teaching layer into the card it builds", () => {
    const teaching = [{ type: "text", text: "Kawa to napój.", lang: "pl" }];
    const cards = generatedCardsBundle(
      JSON.stringify({ lines: [{ fullLine: "Piję kawę.", target: "kawę", teaching }] }),
      { id: "cases", name: "Cases" },
    );
    expect(cards.ok).toBe(true);
    if (cards.ok) {
      const built = cards.bundle.cards as Array<{ teaching?: unknown }>;
      expect(built[0]).toMatchObject({ teaching });
    }

    const pack = generatedPackBundle(
      JSON.stringify({
        pack: { name: "slow-polish" },
        decks: [{ id: "basics", name: "Basics" }],
        lines: [{ deckId: "basics", fullLine: "Piję kawę.", target: "kawę", teaching }],
      }),
    );
    expect(pack.ok).toBe(true);
    if (pack.ok) {
      const built = pack.bundle.cards as Array<{ teaching?: unknown }>;
      expect(built[0]).toMatchObject({ teaching });
    }
  });

  it("refuses a line whose teaching layer is not valid", () => {
    const read = generatedCardsBundle(
      JSON.stringify({
        lines: [
          {
            fullLine: "Piję kawę.",
            target: "kawę",
            teaching: [{ type: "image", source: "web", src: "https://example.test/cup.png" }],
          },
        ],
      }),
      { id: "cases", name: "Cases" },
    );
    expect(read.ok).toBe(false);
  });

  it("refuses a whole bundle whose style is not one the app knows", () => {
    const text = JSON.stringify({
      lines: [{ fullLine: "Piję kawę.", target: "kawę", style: "picks" }],
    });
    const read = generatedCardsBundle(text, { id: "cases", name: "Cases" });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.message).toMatch(/style|usable/i);
  });
});

describe("pickPackHint", () => {
  it("walks the pack's hints once each", () => {
    const card = { ...makeCard("card:a"), hints: ["first", "second"] };
    expect(pickPackHint(card, [])).toBe("first");
    expect(pickPackHint(card, ["first"])).toBe("second");
    expect(pickPackHint(card, ["first", "second"])).toBeNull();
    expect(pickPackHint(makeCard("card:b"), [])).toBeNull();
  });
});

describe("requestTutorHint", () => {
  it("asks the provider with the question side only and returns the words", async () => {
    let sentBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body?: string }) => {
        sentBody = init.body ?? "";
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "Think about the accusative." } }] }),
        } as unknown as Response;
      }),
    );
    const card = makeCard("card:a");
    const result = await requestTutorHint(makePack(), card, { weakTopics: [], level: "beginner", learningStyle: "examples-first" }, "Again", config);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("Think about the accusative.");
    expect(sentBody).toContain("Piję");
    expect(sentBody).not.toContain("kawę.");
  });

  it("reports a failed call with the prompt that was sent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response));
    const result = await requestTutorHint(makePack(), makeCard("card:a"), { weakTopics: [], level: "beginner", learningStyle: "examples-first" }, "Again", config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("key");
      expect(result.prompt.length).toBeGreaterThan(0);
    }
  });
});
