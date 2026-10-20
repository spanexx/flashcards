// WHY: The algorithm reads summaries, not raw rows. These tests pin the facts
// a summary is allowed to state.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { buildSummaries } from "@/lib/core/summaries";
import { makeCard, makeRow } from "./helpers";

describe("buildSummaries", () => {
  it("marks an untouched card unseen", () => {
    const card = makeCard();
    const summaries = buildSummaries([card], []);
    const summary = summaries.get(card.id);
    expect(summary?.unseen).toBe(true);
    expect(summary?.attempts).toBe(0);
    expect(summary?.lastOutcome).toBeNull();
  });

  it("counts attempts, streak, wrongs and nearlys", () => {
    const card = makeCard();
    const rows = [
      makeRow({ attemptId: "a1", outcome: "no", at: "2026-10-01T10:00:00.000Z" }),
      makeRow({ attemptId: "a2", outcome: "nearly", at: "2026-10-02T10:00:00.000Z" }),
      makeRow({ attemptId: "a3", outcome: "got_it", at: "2026-10-03T10:00:00.000Z" }),
      makeRow({ attemptId: "a4", outcome: "got_it", at: "2026-10-04T10:00:00.000Z" }),
    ];
    const summary = buildSummaries([card], rows).get(card.id);
    expect(summary?.attempts).toBe(4);
    expect(summary?.firstOutcome).toBe("no");
    expect(summary?.lastOutcome).toBe("got_it");
    expect(summary?.correctStreak).toBe(2);
    expect(summary?.wrongCount).toBe(1);
    expect(summary?.nearlyCount).toBe(1);
  });

  it("stops the streak at the first non-got_it from the end", () => {
    const card = makeCard();
    const rows = [
      makeRow({ attemptId: "a1", outcome: "got_it", at: "2026-10-01T10:00:00.000Z" }),
      makeRow({ attemptId: "a2", outcome: "got_it", at: "2026-10-02T10:00:00.000Z" }),
      makeRow({ attemptId: "a3", outcome: "nearly", at: "2026-10-03T10:00:00.000Z" }),
      makeRow({ attemptId: "a4", outcome: "got_it", at: "2026-10-04T10:00:00.000Z" }),
    ];
    expect(buildSummaries([card], rows).get(card.id)?.correctStreak).toBe(1);
  });

  it("counts corrected regions", () => {
    const card = makeCard();
    const original = makeRow({ id: "row-1", attemptId: "a1", outcome: "no" });
    const correction = makeRow({
      id: "row-2",
      attemptId: "a1",
      outcome: "got_it",
      kind: "correction",
      supersedes: "row-1",
      at: "2026-10-02T11:00:00.000Z",
    });
    const summary = buildSummaries([card], [original, correction]).get(card.id);
    expect(summary?.correctedCount).toBe(1);
    expect(summary?.lastOutcome).toBe("got_it");
  });

  it("keeps one summary per card and none for missing ones", () => {
    const first = makeCard("card:a");
    const second = makeCard("card:b");
    const summaries = buildSummaries([first, second], []);
    expect(summaries.size).toBe(2);
  });
});
