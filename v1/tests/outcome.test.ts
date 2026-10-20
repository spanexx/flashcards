// WHY: The outcome words are locked vocabulary; this file pins their meaning
// so a refactor cannot quietly reorder them.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import {
  capForHint,
  isCorrect,
  isJudged,
  isWrong,
  OUTCOME_LABELS,
  outcomeRank,
  worstOutcome,
  wrongOutcomeFor,
} from "@/lib/core/outcome";

describe("outcome vocabulary", () => {
  it("keeps every word labelled", () => {
    expect(OUTCOME_LABELS.got_it).toBe("Got it");
    expect(OUTCOME_LABELS.nearly).toBe("Nearly");
    expect(OUTCOME_LABELS.again).toBe("Again");
    expect(OUTCOME_LABELS.no).toBe("No");
    expect(OUTCOME_LABELS.unjudged).toBe("Not judged");
  });

  it("ranks got_it above nearly above again above no above unjudged", () => {
    expect(outcomeRank("got_it")).toBeGreaterThan(outcomeRank("nearly"));
    expect(outcomeRank("nearly")).toBeGreaterThan(outcomeRank("again"));
    expect(outcomeRank("again")).toBeGreaterThan(outcomeRank("no"));
    expect(outcomeRank("no")).toBeGreaterThan(outcomeRank("unjudged"));
  });

  it("finds the worst judged outcome", () => {
    expect(worstOutcome(["got_it", "nearly", "no"])).toBe("no");
    expect(worstOutcome(["got_it", "nearly"])).toBe("nearly");
    expect(worstOutcome(["unjudged"])).toBe("unjudged");
  });

  it("treats an all-unjudged card as unjudged, not wrong", () => {
    expect(worstOutcome(["unjudged", "unjudged"])).toBe("unjudged");
  });

  it("caps a hinted got_it at nearly and nothing else", () => {
    expect(capForHint("got_it")).toBe("nearly");
    expect(capForHint("nearly")).toBe("nearly");
    expect(capForHint("again")).toBe("again");
    expect(capForHint("unjudged")).toBe("unjudged");
  });

  it("distinguishes a lapse from a gap", () => {
    expect(wrongOutcomeFor(0)).toBe("no");
    expect(wrongOutcomeFor(1)).toBe("again");
    expect(wrongOutcomeFor(7)).toBe("again");
  });

  it("classifies each outcome", () => {
    expect(isWrong("again")).toBe(true);
    expect(isWrong("no")).toBe(true);
    expect(isWrong("nearly")).toBe(false);
    expect(isCorrect("got_it")).toBe(true);
    expect(isCorrect("nearly")).toBe(false);
    expect(isJudged("no")).toBe(true);
    expect(isJudged("unjudged")).toBe(false);
  });
});
