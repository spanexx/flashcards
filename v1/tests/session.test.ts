// WHY: The offer is a quiet adjustment, never a punishment. These tests pin
// the arithmetic and the floor.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import { computeOffer, DEFAULT_OFFER, MINIMUM_OFFER } from "@/lib/core/session";
import type { SessionEvent } from "@/lib/shared/types";

function ended(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    type: "ended",
    id: "session-1",
    at: "2026-10-01T10:00:00.000Z",
    offered: 20,
    answered: 20,
    completed: true,
    stopped: false,
    ...overrides,
  };
}

describe("computeOffer", () => {
  it("starts at the default with no history", () => {
    expect(computeOffer([])).toBe(DEFAULT_OFFER);
  });

  it("leaves the offer alone after a single short stop", () => {
    const events = [ended({ answered: 4, completed: false, stopped: true })];
    expect(computeOffer(events)).toBe(DEFAULT_OFFER);
  });

  it("lowers the offer by five once, when two recent sessions stop short", () => {
    const events = Array.from({ length: 2 }, (_, index) =>
      ended({ id: `s${index}`, at: `2026-10-0${index + 1}T10:00:00.000Z`, answered: 4, completed: false, stopped: true }),
    );
    expect(computeOffer(events)).toBe(DEFAULT_OFFER - 5);
  });

  it("lowers by five only once even after many short stops", () => {
    const events = Array.from({ length: 5 }, (_, index) =>
      ended({ id: `s${index}`, at: `2026-10-0${index + 1}T10:00:00.000Z`, answered: 1, completed: false, stopped: true }),
    );
    expect(computeOffer(events)).toBe(DEFAULT_OFFER - 5);
  });

  it("raises the offer after finished sessions, up to the base", () => {
    const events = [ended({ answered: 18, completed: true })];
    expect(computeOffer(events)).toBe(20);
  });

  it("brings a lowered offer back after finishing sessions", () => {
    const lowered = Array.from({ length: 2 }, (_, index) =>
      ended({ id: `stop-${index}`, at: `2026-10-0${index + 1}T10:00:00.000Z`, answered: 4, completed: false, stopped: true }),
    );
    const finished = ended({ id: "done", at: "2026-10-03T10:00:00.000Z", answered: 15, completed: true });
    expect(computeOffer([...lowered, finished])).toBe(DEFAULT_OFFER);
  });

  it("never falls below the floor", () => {
    const events = Array.from({ length: 5 }, (_, index) =>
      ended({ id: `s${index}`, at: `2026-10-0${index + 1}T10:00:00.000Z`, answered: 1, completed: false, stopped: true }),
    );
    expect(computeOffer(events, MINIMUM_OFFER)).toBe(MINIMUM_OFFER);
  });

  it("ignores started events and non-stopped short answers", () => {
    const events: SessionEvent[] = [
      { type: "started", id: "s1", at: "2026-10-01T09:00:00.000Z", offered: 20 },
      ended({ answered: 9, completed: false, stopped: false }),
    ];
    expect(computeOffer(events)).toBe(20);
  });

  it("reads only the last five ended sessions", () => {
    const old = Array.from({ length: 2 }, (_, index) =>
      ended({ id: `old-${index}`, at: `2026-09-0${index + 1}T10:00:00.000Z`, answered: 1, completed: false, stopped: true }),
    );
    const recent = Array.from({ length: 4 }, (_, index) =>
      ended({ id: `quiet-${index}`, at: `2026-10-0${index + 1}T10:00:00.000Z`, answered: 9, completed: false, stopped: false }),
    );
    // Of the last five, only one is a short stop, so nothing is lowered even
    // though two short stops exist in the full history.
    expect(computeOffer([...old, ...recent])).toBe(DEFAULT_OFFER);
    // With just five sessions in total, both stops sit inside the window.
    expect(computeOffer([...old, ...recent.slice(1)])).toBe(DEFAULT_OFFER - 5);
  });
});
