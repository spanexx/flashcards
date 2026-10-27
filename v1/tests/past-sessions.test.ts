// WHY: The previous-sessions list must pair each finished session with the
// scope it started from, cap itself at five and never invent a scope for an
// older row. These tests pin those rules without a screen.
// PACK: study-sidebar-and-history
// 2026-10-27 opencode: created for the study sidebar and history pack
// [pack: study-sidebar-and-history]

import { describe, expect, it } from "vitest";
import { recentSessions } from "@/lib/core/past-sessions";
import type { SessionEvent } from "@/lib/shared/types";

function started(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    type: "started",
    id: "s1",
    at: "2026-10-01T09:00:00.000Z",
    offered: 20,
    ...overrides,
  };
}

function ended(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    type: "ended",
    id: "s1",
    at: "2026-10-01T10:00:00.000Z",
    offered: 20,
    answered: 18,
    completed: true,
    stopped: false,
    ...overrides,
  };
}

describe("recentSessions", () => {
  it("pairs a finished session with the scope it started from", () => {
    const events = [started({ pack: "Polish", deck: "food" }), ended()];
    expect(recentSessions(events)).toEqual([
      {
        id: "s1",
        at: "2026-10-01T10:00:00.000Z",
        offered: 20,
        answered: 18,
        completed: true,
        stopped: false,
        pack: "Polish",
        deck: "food",
      },
    ]);
  });

  it("reads the scope from the ended fact when the start was replaced", () => {
    const [row] = recentSessions([ended({ pack: "Polish", deck: "food" })]);
    expect(row).toMatchObject({ pack: "Polish", deck: "food" });
  });

  it("keeps an empty pack as the whole library", () => {
    const events = [started({ pack: "", deck: "" }), ended()];
    const [row] = recentSessions(events);
    expect(row.pack).toBe("");
    expect(row.deck).toBe("");
  });

  it("leaves the scope out when the started fact is missing", () => {
    const [row] = recentSessions([ended()]);
    expect(row).not.toHaveProperty("pack");
    expect(row).not.toHaveProperty("deck");
    expect(row.answered).toBe(18);
  });

  it("shows only ended sessions, newest first", () => {
    const events = [
      started({ id: "old" }),
      ended({ id: "old", at: "2026-10-01T10:00:00.000Z" }),
      started({ id: "new" }),
      ended({ id: "new", at: "2026-10-03T10:00:00.000Z" }),
      started({ id: "running" }),
    ];
    expect(recentSessions(events).map((row) => row.id)).toEqual(["new", "old"]);
  });

  it("caps the list at five", () => {
    const events = Array.from({ length: 7 }, (_, index) => [
      started({ id: `s${index}` }),
      ended({ id: `s${index}`, at: `2026-10-0${index + 1}T10:00:00.000Z` }),
    ]).flat();
    expect(recentSessions(events).map((row) => row.id)).toEqual([
      "s6",
      "s5",
      "s4",
      "s3",
      "s2",
    ]);
  });

  it("defaults a missing answer count to zero and keeps the stop flag", () => {
    const [row] = recentSessions([
      ended({ answered: undefined, completed: false, stopped: true }),
    ]);
    expect(row.answered).toBe(0);
    expect(row.stopped).toBe(true);
    expect(row.completed).toBe(false);
  });

  it("returns nothing when there is no history", () => {
    expect(recentSessions([])).toEqual([]);
    expect(recentSessions([started()])).toEqual([]);
  });
});
