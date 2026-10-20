// WHY: Evidence is append-only and corrections layer on top. These tests pin
// that the original row always survives and that reading resolves the winner.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import {
  attemptsByCard,
  countSeenBefore,
  groupAttempts,
  makeAnswerRows,
  makeCorrectionRow,
  resolveRows,
} from "@/lib/core/evidence";
import { makeRow } from "./helpers";

describe("makeAnswerRows", () => {
  it("writes one row per region under one attempt", () => {
    const rows = makeAnswerRows(
      "card:1",
      "attempt-9",
      [
        { region: "b1", outcome: "got_it", given: "kawę", expected: ["kawę"], nearMiss: false },
        { region: "b2", outcome: "no", given: "noc", expected: ["ciasto"], nearMiss: false },
      ],
      1500,
      2,
      "2026-10-05T09:00:00.000Z",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].attemptId).toBe("attempt-9");
    expect(rows[0].kind).toBe("answer");
    expect(rows[1].region).toBe("b2");
    expect(rows[0].seenBefore).toBe(2);
  });
});

describe("resolveRows", () => {
  it("keeps the last row for a region and marks a correction as corrected", () => {
    const original = makeRow({ id: "row-1", outcome: "no", at: "2026-10-02T10:00:00.000Z" });
    const correction = makeCorrectionRow(original, "got_it", "2026-10-02T11:00:00.000Z");
    const resolved = resolveRows([original, correction]);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].outcome).toBe("got_it");
    expect(resolved[0].corrected).toBe(true);
    expect(resolved[0].originalId).toBe("row-1");
  });

  it("keeps the original when it is the only row", () => {
    const resolved = resolveRows([makeRow({ id: "row-1" })]);
    expect(resolved[0].corrected).toBe(false);
    expect(resolved[0].originalId).toBe("row-1");
  });

  it("resolves two blanks separately", () => {
    const first = makeRow({ id: "row-1", region: "b1" });
    const second = makeRow({ id: "row-2", region: "b2" });
    expect(resolveRows([first, second])).toHaveLength(2);
  });
});

describe("makeCorrectionRow", () => {
  it("points at the row it answers without changing it", () => {
    const original = makeRow({ id: "row-7", outcome: "no" });
    const correction = makeCorrectionRow(original, "nearly", "2026-10-02T12:00:00.000Z");
    expect(correction.kind).toBe("correction");
    expect(correction.supersedes).toBe("row-7");
    expect(correction.cardId).toBe(original.cardId);
    expect(correction.region).toBe(original.region);
    expect(original.outcome).toBe("no");
    expect(original.kind).toBe("answer");
  });
});

describe("countSeenBefore", () => {
  it("counts distinct attempts at one card", () => {
    const rows = [
      makeRow({ attemptId: "a1", region: "b1" }),
      makeRow({ attemptId: "a1", region: "b2" }),
      makeRow({ attemptId: "a2", region: "b1" }),
      makeRow({ attemptId: "a3", cardId: "card:other" }),
    ];
    expect(countSeenBefore(rows, "card:test-1")).toBe(2);
    expect(countSeenBefore(rows, "card:none")).toBe(0);
  });
});

describe("groupAttempts", () => {
  it("groups rows into attempts, oldest first, with the worst outcome", () => {
    const rows = [
      makeRow({ attemptId: "late", region: "b1", outcome: "got_it", at: "2026-10-03T10:00:00.000Z" }),
      makeRow({ attemptId: "early", region: "b1", outcome: "no", at: "2026-10-02T10:00:00.000Z" }),
      makeRow({ attemptId: "early", region: "b2", outcome: "nearly", at: "2026-10-02T10:00:00.000Z" }),
    ];
    const attempts = groupAttempts(rows, "card:test-1");
    expect(attempts.map((attempt) => attempt.attemptId)).toEqual(["early", "late"]);
    expect(attempts[0].outcome).toBe("no");
    expect(attempts[0].regions).toHaveLength(2);
  });

  it("lets a correction change what the attempt reads as", () => {
    const original = makeRow({
      id: "row-1",
      attemptId: "one",
      outcome: "no",
      at: "2026-10-02T10:00:00.000Z",
    });
    const correction = makeCorrectionRow(original, "got_it", "2026-10-02T11:00:00.000Z");
    const attempts = groupAttempts([original, correction]);
    expect(attempts[0].outcome).toBe("got_it");
    expect(attempts[0].regions[0].corrected).toBe(true);
  });

  it("keeps the slowest time and highest seen count", () => {
    const rows = [
      makeRow({ attemptId: "one", region: "b1", timeMs: 1000, seenBefore: 0 }),
      makeRow({ attemptId: "one", region: "b2", timeMs: 9000, seenBefore: 4 }),
    ];
    const attempts = groupAttempts(rows);
    expect(attempts[0].timeMs).toBe(9000);
    expect(attempts[0].seenBefore).toBe(4);
  });
});

describe("attemptsByCard", () => {
  it("keys attempts by card", () => {
    const rows = [
      makeRow({ cardId: "card:a", attemptId: "a1" }),
      makeRow({ cardId: "card:b", attemptId: "b1" }),
    ];
    const map = attemptsByCard(rows);
    expect(map.get("card:a")).toHaveLength(1);
    expect(map.get("card:b")).toHaveLength(1);
    expect(map.get("card:c")).toBeUndefined();
  });
});
