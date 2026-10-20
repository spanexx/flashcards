// WHY: The append-only files are the learner's record. These tests pin that
// answers only ever add rows, and that deleting a card is the one act that
// deliberately removes them.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import {
  appendEvidence,
  appendSession,
  deleteCardEvidence,
  readEvidence,
  readSessions,
} from "@/lib/repository";
import { withDataDir, makeRow } from "./helpers";

describe("evidence repository", () => {
  it("appends and reads rows in order", async () => {
    await withDataDir(async () => {
      await appendEvidence([makeRow({ id: "r1" }), makeRow({ id: "r2" })]);
      await appendEvidence([makeRow({ id: "r3" })]);
      const rows = await readEvidence();
      expect(rows.map((row) => row.id)).toEqual(["r1", "r2", "r3"]);
    });
  });

  it("deletes one card's rows and leaves the rest", async () => {
    await withDataDir(async () => {
      await appendEvidence([
        makeRow({ id: "a1", cardId: "card:a" }),
        makeRow({ id: "a2", cardId: "card:a" }),
        makeRow({ id: "b1", cardId: "card:b" }),
      ]);
      expect(await deleteCardEvidence("card:a")).toBe(2);
      const rows = await readEvidence();
      expect(rows.map((row) => row.id)).toEqual(["b1"]);
    });
  });

  it("does not rewrite anything when the card has no rows", async () => {
    await withDataDir(async () => {
      await appendEvidence([makeRow({ id: "a1", cardId: "card:a" })]);
      expect(await deleteCardEvidence("card:missing")).toBe(0);
      expect(await readEvidence()).toHaveLength(1);
    });
  });
});

describe("session repository", () => {
  it("records session facts in order", async () => {
    await withDataDir(async () => {
      await appendSession({ type: "started", id: "s1", at: "2026-10-01T10:00:00.000Z", offered: 20 });
      await appendSession({
        type: "ended",
        id: "s1",
        at: "2026-10-01T10:20:00.000Z",
        offered: 20,
        answered: 20,
        completed: true,
        stopped: false,
      });
      const events = await readSessions();
      expect(events.map((event) => event.type)).toEqual(["started", "ended"]);
    });
  });
});
