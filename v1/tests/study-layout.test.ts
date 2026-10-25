// WHY: The redesigned Study screen states its offer in words and its position
// in pips. Both are easy to get wrong at the edges (one card, the last card,
// an empty session), so they are pinned away from React.
// PACK: study-tab-redesign
// 2026-10-25 opencode: created for the Study redesign [pack: study-tab-redesign]

import { describe, expect, it } from "vitest";
import { pipStates, planHeadline, planLede } from "@/lib/client/study-layout";

describe("study plan copy", () => {
  it("singles out one card", () => {
    expect(planHeadline(1)).toBe("1 card is laid out.");
  });

  it("names a countable offer", () => {
    expect(planHeadline(20)).toBe("20 cards are laid out.");
  });

  it("names the scope and the offer in one line", () => {
    expect(planLede("the whole library")).toBe(
      "From the whole library. It's an offer — stop whenever you like.",
    );
    expect(planLede("Polish Starter / Basics")).toBe(
      "From Polish Starter / Basics. It's an offer — stop whenever you like.",
    );
  });
});

describe("study position pips", () => {
  it("marks earlier cards done, the current one now, later ones future", () => {
    expect(pipStates(3, 20)).toEqual([
      "done",
      "done",
      "done",
      "now",
      ...Array(16).fill("future"),
    ]);
  });

  it("marks the only card as now", () => {
    expect(pipStates(0, 1)).toEqual(["now"]);
  });

  it("keeps the last card marked as now", () => {
    expect(pipStates(19, 20).slice(-2)).toEqual(["done", "now"]);
  });

  it("has no pips for an empty session", () => {
    expect(pipStates(0, 0)).toEqual([]);
  });

  it("clamps an over-run index to the last pip", () => {
    const pips = pipStates(25, 20);
    expect(pips).toHaveLength(20);
    expect(pips[19]).toBe("now");
    expect(pips.filter((state) => state === "now")).toHaveLength(1);
  });
});
