// WHY: A batch import either lands whole or not at all. These tests pin the
// friendly shapes it accepts and the problems it names.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { importCards } from "@/lib/core/import";
import { importCardId, simpleCardToSource } from "@/lib/core/card";

const NOW = "2026-10-10T12:00:00.000Z";

describe("importCards", () => {
  it("accepts a bare array of simple cards", () => {
    const result = importCards(
      JSON.stringify([{ front: "kawa", back: "coffee", topics: ["basics"] }]),
      [],
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].origin.kind).toBe("imported");
    }
  });

  it("accepts an object with a cards list", () => {
    const result = importCards(
      JSON.stringify({ cards: [{ front: "kawa", back: "coffee", topics: ["basics"] }] }),
      [],
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it("accepts a full card source", () => {
    const source = {
      summary: "Piję kawę",
      topics: ["cases"],
      prompt: [
        { type: "text", text: "Piję " },
        { type: "blank", id: "b1" },
        { type: "text", text: "." },
      ],
      answer: [{ type: "text", text: "Piję kawę." }],
      answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
    };
    const result = importCards(JSON.stringify([source]), [], NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cards[0].answerDef.mode).toBe("cloze");
  });

  it("names unreadable JSON", () => {
    const result = importCards("{not json", [], NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].message).toContain("not valid JSON");
  });

  it("refuses a batch with nothing in it", () => {
    expect(importCards(JSON.stringify([]), [], NOW).ok).toBe(false);
    expect(importCards(JSON.stringify({ cards: [] }), [], NOW).ok).toBe(false);
  });

  it("refuses the whole batch when one card is broken", () => {
    const result = importCards(
      JSON.stringify([
        { front: "kawa", back: "coffee", topics: ["basics"] },
        { front: "", back: "coffee", topics: ["basics"] },
      ]),
      [],
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
  });

  it("reports a duplicate by identity instead of importing twice", () => {
    const source = simpleCardToSource({ front: "kawa", back: "coffee", topics: ["basics"] });
    const existing = [importCardId(source)];
    const result = importCards(
      JSON.stringify([{ front: "kawa", back: "coffee", topics: ["basics"] }]),
      existing,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards).toHaveLength(0);
      expect(result.duplicates).toBe(1);
    }
  });

  it("deduplicates within the batch itself", () => {
    const result = importCards(
      JSON.stringify([
        { front: "kawa", back: "coffee", topics: ["basics"] },
        { front: "kawa", back: "coffee", topics: ["basics"] },
      ]),
      [],
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards).toHaveLength(1);
      expect(result.duplicates).toBe(1);
    }
  });
});
