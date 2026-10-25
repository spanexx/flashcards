// WHY: The editor holds half-typed rows and the card stores finished parts.
// These pure conversions decide when a save is allowed, so they are tested
// without a browser: a bad row must refuse the whole layer, never drop a part.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the three-step teaching editor [pack: teaching-layers]

import { describe, expect, it } from "vitest";
import {
  blankTeachingRow,
  teachingPartFromRow,
  teachingPartsFromRows,
  teachingRowFromPart,
  teachingRowsFrom,
} from "@/lib/client/teaching-editor";
import type { TeachingPart } from "@/lib/shared/types";

const id = "dQw4w9WgXcQ";

describe("teachingRowFromPart", () => {
  it("keeps a pack picture a pack picture", () => {
    const part: TeachingPart = {
      type: "image",
      source: "builtin",
      src: "/images/deck.png",
      alt: "A deck of cards",
    };
    const row = teachingRowFromPart(part, "row-1");
    expect(row).toMatchObject({
      key: "row-1",
      kind: "image",
      imageSource: "builtin",
      imageSrc: "/images/deck.png",
      imageBuiltinSrc: "/images/deck.png",
    });
    expect(teachingPartFromRow(row)).toEqual({ ok: true, part });
  });

  it("shows a video's time range as text and reads it back", () => {
    const part: TeachingPart = {
      type: "video",
      source: "youtube",
      src: id,
      start: 12,
      end: 40,
      search: "past tense",
    };
    const row = teachingRowFromPart(part, "row-2");
    expect(row).toMatchObject({ start: "12", end: "40", videoSrc: id, search: "past tense" });
    expect(teachingPartFromRow(row)).toEqual({ ok: true, part });
  });

  it("reads every stored part in display order", () => {
    const parts: TeachingPart[] = [
      { type: "text", text: "first" },
      { type: "text", text: "second", lang: "pl" },
    ];
    expect(teachingRowsFrom(parts).map((row) => row.text)).toEqual(["first", "second"]);
    expect(teachingRowsFrom(parts)[1].lang).toBe("pl");
  });
});

describe("teachingPartFromRow", () => {
  it("trims a text part and keeps an explicit language", () => {
    const row = { ...blankTeachingRow("text", "row-1"), text: "  Kawa to napój.  ", lang: " pl " };
    expect(teachingPartFromRow(row)).toEqual({
      ok: true,
      part: { type: "text", text: "Kawa to napój.", lang: "pl" },
    });
  });

  it("turns a pasted YouTube link into the bare id", () => {
    const row = {
      ...blankTeachingRow("video", "row-1"),
      videoSrc: `https://www.youtube.com/watch?v=${id}`,
    };
    const built = teachingPartFromRow(row);
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.part).toMatchObject({ type: "video", src: id });
  });

  it("refuses a start that is not a whole number of seconds", () => {
    const row = { ...blankTeachingRow("video", "row-1"), videoSrc: id, start: "1.5" };
    expect(teachingPartFromRow(row)).toEqual({
      ok: false,
      message: "The start time is a whole number of seconds.",
    });
  });

  it("refuses an empty layer and names the part that needs fixing", () => {
    const rows = [
      { ...blankTeachingRow("text", "row-1"), text: "Kawa to napój." },
      { ...blankTeachingRow("image", "row-2"), imageSrc: "https://example.test/a.png" },
    ];
    expect(teachingPartsFromRows(rows)).toEqual({
      ok: false,
      issues: ["Part 2: Give the image a short description."],
    });
  });

  it("returns every good row in order", () => {
    const rows = [
      { ...blankTeachingRow("text", "row-1"), text: "pierwszy" },
      { ...blankTeachingRow("image", "row-2"), imageSrc: "https://example.test/a.png", imageAlt: "A cup" },
    ];
    const built = teachingPartsFromRows(rows);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.parts.map((part) => part.type)).toEqual(["text", "image"]);
    }
  });
});
