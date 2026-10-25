// WHY: The teaching layer is help, not card content, and a malformed layer must
// refuse the whole card before anything reaches the learner. These tests pin
// the three kinds, the source rules for each, and the old-card default.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching layer pack. [pack: teaching-layers]

import { describe, expect, it } from "vitest";
import { cardSourceSchema, studyLevelSchema, teachingPartSchema } from "@/lib/core/schema";
import { makeSource } from "./helpers";

function accepted(part: unknown): boolean {
  return teachingPartSchema.safeParse(part).success;
}

describe("teaching parts", () => {
  it("accepts plain text, a web image and a YouTube video", () => {
    expect(accepted({ type: "text", text: "Read it slowly." })).toBe(true);
    expect(
      accepted({ type: "image", source: "web", src: "https://example.com/a.png", alt: "A cup" }),
    ).toBe(true);
    expect(
      accepted({ type: "video", source: "youtube", src: "dQw4w9WgXcQ", start: 3, end: 9, search: "coffee" }),
    ).toBe(true);
  });

  it("refuses a text part with no words", () => {
    expect(accepted({ type: "text", text: "" })).toBe(false);
  });

  it("requires alt text on every image", () => {
    expect(accepted({ type: "image", source: "web", src: "https://example.com/a.png" })).toBe(false);
  });

  it("keeps a built-in source inside the packs folder", () => {
    expect(accepted({ type: "image", source: "builtin", src: "/packs/dev/a.svg", alt: "A box" })).toBe(true);
    expect(accepted({ type: "image", source: "builtin", src: "/packs/../key.json", alt: "A box" })).toBe(false);
    expect(accepted({ type: "image", source: "builtin", src: "https://example.com/a.svg", alt: "A box" })).toBe(false);
  });

  it("accepts only http or https web sources", () => {
    expect(accepted({ type: "image", source: "web", src: "http://example.com/a.png", alt: "A cup" })).toBe(true);
    expect(accepted({ type: "image", source: "web", src: "javascript:alert(1)", alt: "A cup" })).toBe(false);
  });

  it("accepts only media ids for a local source", () => {
    expect(accepted({ type: "image", source: "local", src: "media-photo-1", alt: "A cup" })).toBe(true);
    expect(accepted({ type: "image", source: "local", src: "media:photo", alt: "A cup" })).toBe(false);
    expect(accepted({ type: "image", source: "local", src: "photo.png", alt: "A cup" })).toBe(false);
  });

  it("accepts only an eleven-character YouTube id", () => {
    expect(accepted({ type: "video", source: "youtube", src: "dQw4w9WgXcQ" })).toBe(true);
    expect(accepted({ type: "video", source: "youtube", src: "https://youtu.be/dQw4w9WgXcQ" })).toBe(false);
    expect(accepted({ type: "video", source: "youtube", src: "short" })).toBe(false);
  });

  it("keeps start and end on YouTube and demands a later end", () => {
    expect(accepted({ type: "video", source: "youtube", src: "dQw4w9WgXcQ", start: 2, end: 8 })).toBe(true);
    expect(accepted({ type: "video", source: "youtube", src: "dQw4w9WgXcQ", start: 8, end: 8 })).toBe(false);
    expect(accepted({ type: "video", source: "youtube", src: "dQw4w9WgXcQ", start: 1.5 })).toBe(false);
    expect(accepted({ type: "video", source: "web", src: "https://example.com/a.mp4", start: 2 })).toBe(false);
  });

  it("refuses an empty layer and a fourth kind", () => {
    expect(accepted({ type: "audio", src: "/a.mp3" })).toBe(false);
    expect(cardSourceSchema.safeParse(makeSource({ teaching: [] })).success).toBe(false);
  });

  it("accepts a card with a layer and one without", () => {
    const layer = [{ type: "text" as const, text: "Read it slowly." }];
    expect(cardSourceSchema.safeParse(makeSource({ teaching: layer })).success).toBe(true);
    expect(cardSourceSchema.safeParse(makeSource()).success).toBe(true);
  });
});

describe("study levels", () => {
  it("names exactly three levels", () => {
    expect(studyLevelSchema.options).toEqual(["beginner", "intermediate", "advanced"]);
    expect(studyLevelSchema.safeParse("expert").success).toBe(false);
  });
});
