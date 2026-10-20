// WHY: Judging is the app's promise of fairness. These tests pin every mode,
// the hint cap and the unjudged state.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { judgeCard, judgeRegion } from "@/lib/core/judge";

describe("judgeRegion", () => {
  it("marks an unjudged row when the card declared nothing", () => {
    const judged = judgeRegion("cokolwiek", [], {}, 0);
    expect(judged.outcome).toBe("unjudged");
    expect(judged.nearMiss).toBe(false);
  });

  it("marks a correct answer got_it", () => {
    expect(judgeRegion("kawę", ["kawę"], {}, 0).outcome).toBe("got_it");
  });

  it("marks a slip nearly", () => {
    const judged = judgeRegion("kawi", ["kawę"], {}, 0);
    expect(judged.outcome).toBe("nearly");
    expect(judged.nearMiss).toBe(true);
  });

  it("marks a wrong first answer no and a wrong repeat again", () => {
    expect(judgeRegion("noc", ["kawę"], {}, 0).outcome).toBe("no");
    expect(judgeRegion("noc", ["kawę"], {}, 3).outcome).toBe("again");
  });
});

describe("judgeCard", () => {
  it("judges every cloze blank as its own region", () => {
    const judged = judgeCard(
      {
        mode: "cloze",
        blanks: [
          { id: "b1", expected: ["kawę"] },
          { id: "b2", expected: ["ciasto"] },
        ],
      },
      { b1: "kawę", b2: "ciasto" },
      0,
      false,
    );
    expect(judged.results).toHaveLength(2);
    expect(judged.results.map((region) => region.region)).toEqual(["b1", "b2"]);
    expect(judged.cardOutcome).toBe("got_it");
    expect(judged.judge).toBe("local");
  });

  it("takes the worst region for the card outcome", () => {
    const judged = judgeCard(
      {
        mode: "cloze",
        blanks: [
          { id: "b1", expected: ["kawę"] },
          { id: "b2", expected: ["ciasto"] },
        ],
      },
      { b1: "kawę", b2: "noc" },
      0,
      false,
    );
    expect(judged.cardOutcome).toBe("no");
  });

  it("caps a hinted correct answer at nearly", () => {
    const judged = judgeCard({ mode: "type", expected: ["kawę"] }, { answer: "kawę" }, 0, true);
    expect(judged.results[0].outcome).toBe("nearly");
    expect(judged.capped).toBe(true);
    expect(judged.cardOutcome).toBe("nearly");
  });

  it("does not cap a wrong answer that had help", () => {
    const judged = judgeCard({ mode: "type", expected: ["kawę"] }, { answer: "noc" }, 0, true);
    expect(judged.results[0].outcome).toBe("no");
    expect(judged.capped).toBe(false);
  });

  it("judges picks against the declared correct options", () => {
    const judged = judgeCard(
      { mode: "picks", options: ["kawę", "herbatę"], correct: ["kawę"] },
      { choice: "herbatę" },
      0,
      false,
    );
    expect(judged.results[0].outcome).toBe("no");
    expect(judged.results[0].region).toBeNull();
  });

  it("marks the card learner-judged when nothing could be judged", () => {
    const judged = judgeCard({ mode: "type", expected: [] }, { answer: "coś" }, 0, false);
    expect(judged.judge).toBe("learner");
    expect(judged.cardOutcome).toBe("unjudged");
  });

  it("keeps exact judge style strict: no near matches", () => {
    const judged = judgeCard({ mode: "type", expected: ["kawę"], judge: "exact" }, { answer: "kawi" }, 0, false);
    expect(judged.results[0].outcome).toBe("no");
  });
});
