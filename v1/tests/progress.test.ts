// WHY: Progress claims "you can do this now" only when the record says so.
// These tests pin the evidence rules behind every claim.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { deriveWeakTopics, readProgress } from "@/lib/core/progress";
import { makeCard, makeRow } from "./helpers";

describe("readProgress", () => {
  it("names a card improved only after a poor start and a correct last answer", () => {
    const card = makeCard("card:a", { summary: "A" });
    const rows = [
      makeRow({ cardId: "card:a", attemptId: "a1", outcome: "no", at: "2026-10-01T10:00:00.000Z" }),
      makeRow({ cardId: "card:a", attemptId: "a2", outcome: "got_it", at: "2026-10-02T10:00:00.000Z" }),
    ];
    const view = readProgress([card], rows, {});
    expect(view.improvements.map((item) => item.cardId)).toEqual(["card:a"]);
  });

  it("does not call a first-time correct card an improvement", () => {
    const card = makeCard("card:a", { summary: "A" });
    const rows = [makeRow({ cardId: "card:a", attemptId: "a1", outcome: "got_it" })];
    const view = readProgress([card], rows, {});
    expect(view.improvements).toHaveLength(0);
  });

  it("names a card faster when a slow start became a quick finish", () => {
    const card = makeCard("card:a", { summary: "A" });
    const rows = [
      makeRow({ cardId: "card:a", attemptId: "a1", outcome: "got_it", timeMs: 12000, at: "2026-10-01T10:00:00.000Z" }),
      makeRow({ cardId: "card:a", attemptId: "a2", outcome: "got_it", timeMs: 4000, at: "2026-10-02T10:00:00.000Z" }),
    ];
    const view = readProgress([card], rows, {});
    expect(view.faster.map((item) => item.cardId)).toEqual(["card:a"]);
  });

  it("lists topics still asking for work", () => {
    const first = makeCard("card:a", { summary: "A", topics: ["cases"] });
    const second = makeCard("card:b", { summary: "B", topics: ["cases"] });
    const rows = [
      makeRow({ cardId: "card:a", attemptId: "a1", outcome: "no" }),
      makeRow({ cardId: "card:b", attemptId: "b1", outcome: "got_it" }),
    ];
    const view = readProgress([first, second], rows, { cases: "Cases" });
    expect(view.nextTopics.map((topic) => topic.topic)).toEqual(["cases"]);
    expect(view.nextTopics[0].label).toBe("Cases");
    expect(view.nextTopics[0].cardIds).toEqual(["card:a"]);
  });

  it("calls a topic solid ground when two or more cards are settled", () => {
    const first = makeCard("card:a", { summary: "A", topics: ["cases"] });
    const second = makeCard("card:b", { summary: "B", topics: ["cases"] });
    const rows = [
      makeRow({ cardId: "card:a", attemptId: "a1", outcome: "got_it" }),
      makeRow({ cardId: "card:b", attemptId: "b1", outcome: "got_it" }),
    ];
    const view = readProgress([first, second], rows, {});
    expect(view.strengths.map((topic) => topic.topic)).toEqual(["cases"]);
  });

  it("lists every active card with its last outcome and skips retired ones", () => {
    const active = makeCard("card:a", { summary: "A" });
    const retired = { ...makeCard("card:b", { summary: "B" }), retired: true };
    const rows = [makeRow({ cardId: "card:a", attemptId: "a1", outcome: "nearly" })];
    const view = readProgress([active, retired], rows, {});
    expect(view.cards).toHaveLength(1);
    expect(view.cards[0].lastOutcome).toBe("nearly");
    expect(view.cards[0].attempts).toBe(1);
  });

  it("falls back to a humanized topic label when the pack gave none", () => {
    const card = makeCard("card:a", { summary: "A", topics: ["past-tense"] });
    const rows = [makeRow({ cardId: "card:a", attemptId: "a1", outcome: "no" })];
    const view = readProgress([card], rows, {});
    expect(view.nextTopics[0].label).toBe("Past tense");
  });
});

describe("deriveWeakTopics", () => {
  it("collects topics whose latest answer slipped or was wrong", () => {
    const first = makeCard("card:a", { summary: "A", topics: ["cases", "basics"] });
    const second = makeCard("card:b", { summary: "B", topics: ["cases"] });
    const rows = [
      makeRow({ cardId: "card:a", attemptId: "a1", outcome: "no", at: "2026-10-01T10:00:00.000Z" }),
      makeRow({ cardId: "card:b", attemptId: "b1", outcome: "nearly", at: "2026-10-02T10:00:00.000Z" }),
    ];
    const weak = deriveWeakTopics([first, second], rows);
    expect(weak[0]).toBe("cases");
    expect(weak).toContain("basics");
  });

  it("drops a topic once its latest answer is correct", () => {
    const card = makeCard("card:a", { summary: "A", topics: ["cases"] });
    const rows = [
      makeRow({ cardId: "card:a", attemptId: "a1", outcome: "no", at: "2026-10-01T10:00:00.000Z" }),
      makeRow({ cardId: "card:a", attemptId: "a2", outcome: "got_it", at: "2026-10-02T10:00:00.000Z" }),
    ];
    expect(deriveWeakTopics([card], rows)).toEqual([]);
  });

  it("ignores retired cards and respects the limit", () => {
    const retired = { ...makeCard("card:retired", { summary: "R", topics: ["cases"] }), retired: true };
    const rows = [makeRow({ cardId: "card:retired", attemptId: "r1", outcome: "no" })];
    expect(deriveWeakTopics([retired], rows)).toEqual([]);

    const cards = ["a", "b", "c", "d", "e", "f"].map((letter, index) =>
      makeCard(`card:${letter}`, { summary: letter, topics: [`topic-${index}`] }),
    );
    const many = cards.map((card, index) =>
      makeRow({
        cardId: card.id,
        attemptId: `attempt-${index}`,
        outcome: "no",
        at: `2026-10-0${index + 1}T10:00:00.000Z`,
      }),
    );
    expect(deriveWeakTopics(cards, many, 3)).toHaveLength(3);
  });
});
