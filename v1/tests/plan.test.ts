// WHY: The plan is the visible face of the algorithm: cards, groups and plain
// reasons. These tests pin what the learner sees.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { buildPlan, orderWordCards } from "@/lib/core/plan";
import { makeCard, makeRow } from "./helpers";

const NOW = new Date("2026-10-10T12:00:00.000Z");

describe("buildPlan", () => {
  it("builds a plan with groups and reasons for unseen cards", () => {
    const cards = [
      makeCard("card:a", { summary: "A", topics: ["cases"] }),
      makeCard("card:b", { summary: "B", topics: ["basics"] }),
    ];
    const result = buildPlan({ cards, rows: [], events: [], topicLabels: {}, now: NOW, offer: 2 });
    expect(result.plan.cards).toHaveLength(2);
    expect(result.plan.groups.length).toBeGreaterThan(0);
    expect(result.plan.groups[0].reason.length).toBeGreaterThan(0);
    expect(result.plan.algorithm).toBe("default");
    expect(result.usedFallback).toBe(false);
  });

  it("keeps retired cards out of the plan", () => {
    const active = makeCard("card:a", { summary: "A" });
    const retired = { ...makeCard("card:b", { summary: "B" }), retired: true };
    const result = buildPlan({ cards: [active, retired], rows: [], events: [], topicLabels: {}, now: NOW });
    expect(result.plan.cards.map((card) => card.id)).toEqual(["card:a"]);
  });

  it("honours the offer as an upper bound", () => {
    const cards = Array.from({ length: 10 }, (_, index) =>
      makeCard(`card:${index}`, { summary: `Card ${index}` }),
    );
    const result = buildPlan({ cards, rows: [], events: [], topicLabels: {}, now: NOW, offer: 3 });
    expect(result.plan.cards.length).toBeLessThanOrEqual(3);
  });

  it("gives a slipped card its own reason", () => {
    const cards = [
      makeCard("card:a", { summary: "A", topics: ["cases"] }),
      makeCard("card:b", { summary: "B", topics: ["basics"] }),
      makeCard("card:c", { summary: "C", topics: ["cases"] }),
      makeCard("card:d", { summary: "D", topics: ["basics"] }),
      makeCard("card:e", { summary: "E", topics: ["cases"] }),
    ];
    const rows = [makeRow({ cardId: "card:a", attemptId: "a1", outcome: "no", at: "2026-10-09T10:00:00.000Z" })];
    const result = buildPlan({ cards, rows, events: [], topicLabels: {}, now: NOW, offer: 5 });
    const group = result.plan.groups.find((entry) => entry.topic === "cases");
    expect(group?.reason).toContain("getting these wrong");
  });

  it("carries the fallback count forward", () => {
    const result = buildPlan(
      { cards: [makeCard("card:a", { summary: "A" })], rows: [], events: [], topicLabels: {}, now: NOW },
      4,
    );
    expect(result.plan.fallbackCount).toBe(4);
  });

  it("starts with no banner: the tutor disclosure is added later, with the learner's eye on it", () => {
    const result = buildPlan({
      cards: [makeCard("card:a", { summary: "A" })],
      rows: [],
      events: [],
      topicLabels: {},
      now: NOW,
    });
    expect(result.plan.banner).toBeNull();
    expect(result.plan.sessionId.length).toBeGreaterThan(0);
  });
});

describe("orderWordCards", () => {
  it("keeps one word's leaves together and walks them in stage order", () => {
    const cards = [
      makeCard("card:match", { summary: "Match", wordId: "biuro", stage: "matching" }),
      makeCard("card:plain", { summary: "Plain" }),
      makeCard("card:story", { summary: "Story", wordId: "biuro", stage: "story" }),
      makeCard("card:forms", { summary: "Forms", wordId: "biuro", stage: "forms" }),
    ];
    expect(orderWordCards(cards).map((card) => card.id)).toEqual([
      "card:story",
      "card:forms",
      "card:match",
      "card:plain",
    ]);
  });

  it("places each word block at its first selected card", () => {
    const cards = [
      makeCard("card:one", { summary: "One", wordId: "a", stage: "story" }),
      makeCard("card:two", { summary: "Two", wordId: "b", stage: "story" }),
      makeCard("card:one-last", { summary: "One last", wordId: "a", stage: "matching" }),
      makeCard("card:two-last", { summary: "Two last", wordId: "b", stage: "matching" }),
    ];
    expect(orderWordCards(cards).map((card) => card.id)).toEqual([
      "card:one",
      "card:one-last",
      "card:two",
      "card:two-last",
    ]);
  });

  it("puts an unknown stage last without dropping the card", () => {
    const cards = [
      makeCard("card:odd", { summary: "Odd", wordId: "biuro", stage: "matching" }),
      makeCard("card:unknown", { summary: "Unknown", wordId: "biuro", stage: "mystery" as "story" }),
      makeCard("card:story", { summary: "Story", wordId: "biuro", stage: "story" }),
    ];
    expect(orderWordCards(cards).map((card) => card.id)).toEqual([
      "card:story",
      "card:odd",
      "card:unknown",
    ]);
  });

  it("leaves a plan with no words exactly as the algorithm built it", () => {
    const cards = [makeCard("card:a", { summary: "A" }), makeCard("card:b", { summary: "B" })];
    expect(orderWordCards(cards)).toEqual(cards);
  });
});
