// WHY: A broken algorithm must never trap the learner. This file makes the
// default algorithm fail on purpose and proves the dull fallback still runs.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { beforeEach, describe, expect, it, vi } from "vitest";

const switches = { throwDefault: false, throwSimple: false };

vi.mock("@/lib/core/algorithm/default", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/core/algorithm/default")>();
  return {
    ...actual,
    selectDefault: (input: Parameters<typeof actual.selectDefault>[0]) => {
      if (switches.throwDefault) throw new Error("the default algorithm broke");
      return actual.selectDefault(input);
    },
  };
});

vi.mock("@/lib/core/algorithm/simple", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/core/algorithm/simple")>();
  return {
    ...actual,
    selectSimple: (input: Parameters<typeof actual.selectSimple>[0]) => {
      if (switches.throwSimple) throw new Error("the fallback broke too");
      return actual.selectSimple(input);
    },
  };
});

const { runSelection } = await import("@/lib/core/algorithm/run");
const { buildSummaries } = await import("@/lib/core/summaries");
const { makeCard } = await import("./helpers");

const NOW = new Date("2026-10-10T12:00:00.000Z");

function input() {
  const cards = [
    makeCard("card:a", { summary: "A", topics: ["alpha"] }),
    makeCard("card:b", { summary: "B", topics: ["beta"] }),
    makeCard("card:c", { summary: "C", topics: ["alpha"] }),
    makeCard("card:d", { summary: "D", topics: ["beta"] }),
    makeCard("card:e", { summary: "E", topics: ["alpha"] }),
  ];
  return {
    cards,
    summaries: buildSummaries(cards, [], NOW),
    topicLabels: {},
    offer: 5,
    now: NOW,
  };
}

beforeEach(() => {
  switches.throwDefault = false;
  switches.throwSimple = false;
});

describe("runSelection fallback", () => {
  it("uses the simple spread when the default algorithm throws", () => {
    switches.throwDefault = true;
    const result = runSelection(input());
    expect(result.algorithm).toBe("fallback");
    expect(result.usedFallback).toBe(true);
    expect(result.reason).toBe("the default algorithm broke");
    expect(result.selection.cards.length).toBeGreaterThan(0);
  });

  it("uses the oldest cards when both algorithms throw", () => {
    switches.throwDefault = true;
    switches.throwSimple = true;
    const result = runSelection(input());
    expect(result.algorithm).toBe("fallback");
    expect(result.usedFallback).toBe(true);
    expect(result.reason).toContain("the fallback broke too");
    expect(result.selection.cards[0].id).toBe("card:a");
    expect(result.selection.groups[0].reason).toBe("no idea, these came first");
  });
});
