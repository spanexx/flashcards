// WHY: A plan may draw from many packs and decks, so the union, its validation
// and the plain name shown to the learner must be pinned away from React.
// PACK: plan-multi-select
// 2026-10-27 opencode: created for the multi-pack plan scope pack
// [pack: plan-multi-select]

import { describe, expect, it } from "vitest";
import {
  allDecksItem,
  cardIsInScope,
  encodePlanScope,
  normalizePlanScope,
  parsePlanScope,
  pastScope,
  scopeSummary,
} from "@/lib/core/plan-scope";
import type { PastSession } from "@/lib/core/past-sessions";
import type { PackStatus, PlanScope } from "@/lib/shared/types";
import { makeCard } from "./helpers";

function pack(name: string, decks: string[]): PackStatus {
  return {
    name,
    version: "1.0.0",
    folder: "test",
    decks: decks.map((id) => ({ id, name: id, level: "intermediate" })),
    topics: [],
    topicLabels: {},
    cardCount: 0,
  };
}

const packs = [pack("polish", ["basics", "cases"]), pack("german", ["verbs"])];

describe("plan scope text", () => {
  it("round-trips a scope and treats an empty one as the whole library", () => {
    const scope: PlanScope = [{ pack: "polish", decks: ["basics"] }];
    expect(parsePlanScope(encodePlanScope(scope))).toEqual(scope);
    expect(parsePlanScope("")).toEqual([]);
    expect(parsePlanScope(null)).toEqual([]);
  });

  it("refuses text that is not a scope", () => {
    expect(parsePlanScope("[]")).toEqual([]);
    expect(parsePlanScope("{}")).toBeNull();
    expect(parsePlanScope('[{"pack":"polish"}]')).toBeNull();
    expect(parsePlanScope('[{"pack":"polish","decks":[1]}]')).toBeNull();
    expect(parsePlanScope("not json")).toBeNull();
  });

  it("keeps only known packs and decks in library order", () => {
    const result = normalizePlanScope(
      [
        { pack: "german", decks: ["verbs", "verbs"] },
        { pack: "polish", decks: ["cases", "basics"] },
      ],
      packs,
    );
    expect(result).toEqual({
      ok: true,
      scope: [
        { pack: "polish", decks: ["basics", "cases"] },
        { pack: "german", decks: ["verbs"] },
      ],
    });
  });

  it("names a missing pack, a missing deck and an empty pack choice", () => {
    const result = normalizePlanScope(
      [
        { pack: "missing", decks: ["basics"] },
        { pack: "polish", decks: ["nope"] },
        { pack: "german", decks: [] },
      ],
      packs,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual([
        "There is no pack “missing” here.",
        "There is no deck “nope” in “polish”.",
        "Choose at least one deck in “german”.",
      ]);
    }
  });
});

describe("the union", () => {
  it("includes only cards from the chosen decks", () => {
    const basics = makeCard("card:basics");
    const cases = makeCard("card:cases", {}, "2026-10-01T00:00:00.000Z");
    cases.packName = "polish";
    cases.deckId = "cases";
    basics.packName = "polish";
    basics.deckId = "basics";
    const scope: PlanScope = [{ pack: "polish", decks: ["cases"] }];
    expect(cardIsInScope(basics, scope)).toBe(false);
    expect(cardIsInScope(cases, scope)).toBe(true);
  });

  it("includes every pack when the scope is empty", () => {
    const card = makeCard();
    expect(cardIsInScope(card, [])).toBe(true);
  });
});

describe("the plain name", () => {
  it("names the whole library, one pack, one deck and many packs", () => {
    expect(scopeSummary([], packs)).toBe("the whole library");
    expect(
      scopeSummary([{ pack: "polish", decks: ["basics", "cases"] }], packs),
    ).toBe("polish");
    expect(scopeSummary([{ pack: "polish", decks: ["basics"] }], packs)).toBe(
      "polish / basics",
    );
    expect(
      scopeSummary([{ pack: "polish", decks: ["basics", "cases"] }, { pack: "german", decks: ["verbs"] }], packs),
    ).toBe("all decks in 2 packs");
    expect(
      scopeSummary([{ pack: "polish", decks: ["basics"] }, { pack: "german", decks: ["verbs"] }], packs),
    ).toBe("2 packs");
  });

  it("offers a pack with every deck as one click", () => {
    expect(allDecksItem(packs[0])).toEqual({ pack: "polish", decks: ["basics", "cases"] });
    expect(allDecksItem(pack("empty", []))).toBeNull();
  });
});

describe("a previous session", () => {
  const row: PastSession = {
    id: "s1",
    at: "2026-10-01T10:00:00.000Z",
    offered: 20,
    answered: 18,
    completed: true,
    stopped: false,
  };

  it("replays a recorded multi-pack scope", () => {
    const scope: PlanScope = [{ pack: "polish", decks: ["cases"] }, { pack: "german", decks: ["verbs"] }];
    expect(pastScope({ ...row, scope }, packs)).toEqual(scope);
  });

  it("replays an older one-pack row using today's deck list", () => {
    expect(pastScope({ ...row, pack: "polish", deck: "" }, packs)).toEqual([
      { pack: "polish", decks: ["basics", "cases"] },
    ]);
    expect(pastScope({ ...row, pack: "polish", deck: "cases" }, packs)).toEqual([
      { pack: "polish", decks: ["cases"] },
    ]);
  });

  it("leaves a row with no scope and no pack alone", () => {
    expect(pastScope(row, packs)).toBeNull();
  });

  it("refuses a row whose pack or deck is gone", () => {
    expect(pastScope({ ...row, pack: "gone", deck: "" }, packs)).toBeNull();
    expect(pastScope({ ...row, pack: "polish", deck: "gone" }, packs)).toBeNull();
    expect(
      pastScope({ ...row, scope: [{ pack: "gone", decks: ["basics"] }] }, packs),
    ).toBeNull();
    expect(
      pastScope({ ...row, scope: [{ pack: "polish", decks: ["gone"] }] }, packs),
    ).toBeNull();
    expect(
      pastScope({ ...row, scope: [{ pack: "polish", decks: [] }] }, packs),
    ).toBeNull();
  });
});
