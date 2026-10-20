// WHY: The algorithm is one possible reading, and its fallback must be dull
// and reliable. These tests pin classing, ordering, grouping and the fallback.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { classify, humanizeTopic, reasonForCard, selectDefault } from "@/lib/core/algorithm/default";
import { selectSimple } from "@/lib/core/algorithm/simple";
import { runSelection, sanityCheck } from "@/lib/core/algorithm/run";
import { buildSummaries, type CardSummary } from "@/lib/core/summaries";
import { makeCard, makeRow } from "./helpers";

const NOW = new Date("2026-10-10T12:00:00.000Z");

function summary(overrides: Partial<CardSummary> = {}): CardSummary {
  return {
    cardId: "card:a",
    attempts: 1,
    unseen: false,
    firstOutcome: "got_it",
    lastOutcome: "got_it",
    firstAt: "2026-10-09T10:00:00.000Z",
    lastAt: "2026-10-09T10:00:00.000Z",
    firstTimeMs: 3000,
    lastTimeMs: 3000,
    correctStreak: 1,
    wrongCount: 0,
    nearlyCount: 0,
    correctedCount: 0,
    ...overrides,
  };
}

describe("classify", () => {
  it("classes unseen cards first", () => {
    expect(classify(summary({ unseen: true, lastOutcome: null }), NOW)).toBe("unseen");
  });

  it("classes a wrong or nearly last answer as slipped", () => {
    expect(classify(summary({ lastOutcome: "no" }), NOW)).toBe("slipped");
    expect(classify(summary({ lastOutcome: "again" }), NOW)).toBe("slipped");
    expect(classify(summary({ lastOutcome: "nearly" }), NOW)).toBe("slipped");
  });

  it("classes a well-known card answered days ago as strong", () => {
    expect(
      classify(
        summary({
          lastAt: "2026-10-05T10:00:00.000Z",
          correctStreak: 3,
        }),
        NOW,
      ),
    ).toBe("strong");
  });

  it("classes a card answered yesterday as stale", () => {
    expect(classify(summary({ lastAt: "2026-10-09T10:00:00.000Z", correctStreak: 1 }), NOW)).toBe("stale");
  });

  it("classes a card answered today as fresh", () => {
    expect(classify(summary({ lastAt: "2026-10-10T09:00:00.000Z", correctStreak: 1 }), NOW)).toBe("fresh");
  });
});

describe("humanizeTopic and reasons", () => {
  it("turns a dashed topic into a readable label", () => {
    expect(humanizeTopic("past-tense")).toBe("Past tense");
    expect(humanizeTopic("cases")).toBe("Cases");
  });

  it("gives every class a plain reason", () => {
    for (const cardClass of ["unseen", "slipped", "stale", "strong", "fresh"] as const) {
      expect(reasonForCard(cardClass).length).toBeGreaterThan(0);
    }
  });
});

describe("selectDefault", () => {
  it("puts unseen cards ahead of settled ones", () => {
    const seen = makeCard("card:seen", { summary: "Seen" });
    const fresh = makeCard("card:fresh", { summary: "Fresh" });
    const rows = [makeRow({ cardId: "card:seen", attemptId: "a1", outcome: "got_it", at: "2026-10-10T10:00:00.000Z" })];
    const selection = selectDefault({
      cards: [seen, fresh],
      summaries: buildSummaries([seen, fresh], rows, NOW),
      topicLabels: {},
      offer: 2,
      now: NOW,
    });
    expect(selection.cards[0].id).toBe("card:fresh");
  });

  it("spreads the session across topics", () => {
    const cards = [
      makeCard("card:a1", { summary: "A1", topics: ["alpha"] }),
      makeCard("card:a2", { summary: "A2", topics: ["alpha"] }),
      makeCard("card:a3", { summary: "A3", topics: ["alpha"] }),
      makeCard("card:b1", { summary: "B1", topics: ["beta"] }),
    ];
    const selection = selectDefault({
      cards,
      summaries: buildSummaries(cards, [], NOW),
      topicLabels: {},
      offer: 2,
      now: NOW,
    });
    const topics = new Set(selection.cards.map((card) => card.topics[0]));
    expect(topics.size).toBe(2);
  });

  it("labels groups from the pack when it can", () => {
    const cards = [makeCard("card:a", { summary: "A", topics: ["cases"] })];
    const selection = selectDefault({
      cards,
      summaries: buildSummaries(cards, [], NOW),
      topicLabels: { cases: "Cases" },
      offer: 1,
      now: NOW,
    });
    expect(selection.groups[0].label).toBe("Cases");
  });
});

describe("selectSimple", () => {
  it("prefers unseen, then waiting, then wrong cards", () => {
    const unseen = makeCard("card:unseen", { summary: "Unseen" });
    const wrong = makeCard("card:wrong", { summary: "Wrong" });
    const old = makeCard("card:old", { summary: "Old" });
    const rows = [
      makeRow({ cardId: "card:wrong", attemptId: "w1", outcome: "no", at: "2026-10-01T10:00:00.000Z" }),
      makeRow({ cardId: "card:old", attemptId: "o1", outcome: "got_it", at: "2026-09-01T10:00:00.000Z" }),
    ];
    const summaries = buildSummaries([unseen, wrong, old], rows, NOW);
    const selection = selectSimple({ cards: [old, wrong, unseen], summaries, topicLabels: {}, offer: 3 });
    expect(selection.cards.map((card) => card.id)).toEqual(["card:unseen", "card:old", "card:wrong"]);
  });

  it("keeps retired cards out", () => {
    const retired = { ...makeCard("card:retired", { summary: "R" }), retired: true };
    const active = makeCard("card:active", { summary: "A" });
    const selection = selectSimple({
      cards: [retired, active],
      summaries: buildSummaries([retired, active], [], NOW),
      topicLabels: {},
      offer: 5,
    });
    expect(selection.cards.map((card) => card.id)).toEqual(["card:active"]);
  });
});

describe("sanityCheck and runSelection", () => {
  const cards = Array.from({ length: 6 }, (_, index) =>
    makeCard(`card:${index}`, { summary: `Card ${index}`, topics: index % 2 === 0 ? ["alpha"] : ["beta"] }),
  );
  const input = {
    cards,
    summaries: buildSummaries(cards, [], NOW),
    topicLabels: {},
    offer: 6,
    now: NOW,
  };

  it("accepts a healthy selection", () => {
    const selection = selectDefault(input);
    expect(sanityCheck(input, selection)).toBeNull();
  });

  it("refuses an empty selection when cards exist", () => {
    expect(sanityCheck(input, { cards: [], groups: [] })).toContain("no cards");
  });

  it("refuses fewer cards than the minimum available", () => {
    const selection = selectDefault(input);
    expect(sanityCheck(input, { cards: selection.cards.slice(0, 1), groups: [] })).toContain("at least");
  });

  it("refuses the same card twice", () => {
    const selection = selectDefault(input);
    const doubled = { cards: [...selection.cards, selection.cards[0]], groups: [] };
    expect(sanityCheck(input, doubled)).toContain("more than once");
  });

  it("refuses a single-topic plan when two topics are available", () => {
    const alphaCards = Array.from({ length: 6 }, (_, index) =>
      makeCard(`card:alpha-${index}`, { summary: `Alpha ${index}`, topics: ["alpha"] }),
    );
    const betaCard = makeCard("card:beta", { summary: "Beta", topics: ["beta"] });
    const localInput = {
      cards: [...alphaCards, betaCard],
      summaries: buildSummaries([...alphaCards, betaCard], [], NOW),
      topicLabels: {},
      offer: 6,
      now: NOW,
    };
    // A deliberately lopsided plan: the six alpha cards and none of the beta.
    const selection = { cards: alphaCards, groups: [] };
    expect(sanityCheck(localInput, selection)).toContain("only one topic");
  });

  it("refuses a plan that ignores unseen cards", () => {
    const rows = cards.map((card, index) =>
      makeRow({ cardId: card.id, attemptId: `a${index}`, outcome: "got_it" }),
    );
    const seenSummaries = buildSummaries(cards, rows, NOW);
    const oneUnseen = makeCard("card:unseen", { summary: "Unseen" });
    const seenSelection = selectDefault({
      cards,
      summaries: seenSummaries,
      topicLabels: {},
      offer: 6,
      now: NOW,
    });
    const localInput = {
      ...input,
      cards: [...cards, oneUnseen],
      summaries: buildSummaries([...cards, oneUnseen], rows, NOW),
    };
    expect(sanityCheck(localInput, seenSelection)).toContain("never seen");
  });

  it("refuses a short plan on the minimum before reaching the unseen rule", () => {
    const seen = makeCard("card:seen", { summary: "Seen", topics: ["alpha"] });
    const unseen = makeCard("card:unseen", { summary: "Unseen", topics: ["beta"] });
    const rows = [makeRow({ cardId: "card:seen", attemptId: "a1", outcome: "got_it" })];
    const localInput = {
      cards: [seen, unseen],
      summaries: buildSummaries([seen, unseen], rows, NOW),
      topicLabels: {},
      offer: 1,
      now: NOW,
    };
    // A one-card selection can never pass the minimum while two cards exist,
    // so the unseen rule cannot be the first thing to fail here.
    expect(sanityCheck(localInput, { cards: [seen], groups: [] })).toContain("at least");
    expect(sanityCheck(localInput, { cards: [unseen], groups: [] })).toContain("at least");
  });

  it("runs the default algorithm on a healthy deck", () => {
    const single = makeCard("card:single", { summary: "Only" });
    const result = runSelection({
      cards: [single],
      summaries: buildSummaries([single], [], NOW),
      topicLabels: {},
      offer: 1,
      now: NOW,
    });
    expect(result.algorithm).toBe("default");
    expect(result.usedFallback).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.selection.cards).toHaveLength(1);
  });
});
