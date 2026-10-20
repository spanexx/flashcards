// WHY: The plan is the visible face of the algorithm: cards, groups and plain
// reasons. These tests pin what the learner sees.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { buildPlan } from "@/lib/core/plan";
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
