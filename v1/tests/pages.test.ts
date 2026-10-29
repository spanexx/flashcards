// WHY: The Dictionary's promises are numbers and gates: how long a text must
// stay, when a page counts as read, and what "Pages read" means. These tests
// pin the pure rules so the reader, the router and the seed cannot drift.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import { describe, expect, it } from "vitest";
import {
  PICTURE_SECONDS,
  TEXT_MIN_SECONDS,
  VIDEO_TRACED_SHARE,
  cardPageId,
  deckPageId,
  packPageId,
  pageIdFor,
  pageIsRead,
  pageIsWritten,
  pageTitle,
  pageFromSave,
  readCount,
  savedPageSchema,
  tracedTextMs,
  withTracedPart,
} from "@/lib/core/pages";
import type { DictionaryPage, PageTrace, TeachingPart } from "@/lib/shared/types";

const at = "2026-10-29T10:00:00.000Z";
const later = "2026-10-29T10:05:00.000Z";

function textPart(text: string): TeachingPart {
  return { type: "text", text };
}

function cardPage(parts: TeachingPart[] = [textPart("one"), textPart("two"), textPart("three")]): DictionaryPage {
  return {
    id: cardPageId("card-1"),
    level: "card",
    packName: "polish",
    deckId: "basics",
    cardId: "card-1",
    parts,
    createdAt: at,
    updatedAt: at,
  };
}

function traceOf(ids: number[]): PageTrace {
  return { id: cardPageId("card-1"), traced: ids, updatedAt: at };
}

describe("page ids", () => {
  it("names each level from its parents", () => {
    expect(packPageId("polish")).toBe("page:pack:polish");
    expect(deckPageId("polish", "basics")).toBe("page:deck:polish:basics");
    expect(cardPageId("card-1")).toBe("page:card:card-1");
    expect(pageIdFor("pack", "polish")).toBe("page:pack:polish");
    expect(pageIdFor("deck", "polish", "basics")).toBe("page:deck:polish:basics");
    expect(pageIdFor("card", "polish", "basics", "card-1")).toBe("page:card:card-1");
  });
});

describe("trace thresholds", () => {
  it("keeps ten words on screen for the five-second floor", () => {
    expect(tracedTextMs("one two three four five six seven eight nine ten")).toBe(TEXT_MIN_SECONDS * 1000);
  });

  it("gives a hundred words ten seconds", () => {
    const words = Array.from({ length: 100 }, (_, index) => `w${index}`).join(" ");
    expect(tracedTextMs(words)).toBe(10_000);
  });

  it("keeps the picture and video promises at their documented numbers", () => {
    expect(PICTURE_SECONDS).toBe(3);
    expect(VIDEO_TRACED_SHARE).toBe(0.8);
  });
});

describe("withTracedPart", () => {
  it("adds parts in order and never duplicates one", () => {
    const first = withTracedPart(cardPage(), null, 1, at);
    expect(first.traced).toEqual([1]);
    expect(first.readAt).toBeUndefined();
    const second = withTracedPart(cardPage(), first, 1, later);
    expect(second.traced).toEqual([1]);
    const third = withTracedPart(cardPage(), second, 0, later);
    expect(third.traced).toEqual([0, 1]);
  });

  it("sets readAt once, the first time every part is traced", () => {
    const two = traceOf([0, 1]);
    const complete = withTracedPart(cardPage(), two, 2, at);
    expect(complete.traced).toEqual([0, 1, 2]);
    expect(complete.readAt).toBe(at);
    const again = withTracedPart(cardPage(), complete, 2, later);
    expect(again.readAt).toBe(at);
    expect(again.updatedAt).toBe(later);
  });

  it("ignores a part the page does not have", () => {
    const next = withTracedPart(cardPage(), null, 9, at);
    expect(next.traced).toEqual([]);
    expect(next.readAt).toBeUndefined();
  });

  it("never marks an empty page read", () => {
    const empty = cardPage([]);
    expect(withTracedPart(empty, null, 0, at).readAt).toBeUndefined();
    expect(pageIsRead(empty, traceOf([0]))).toBe(false);
  });
});

describe("pageIsRead and readCount", () => {
  it("needs every part traced", () => {
    expect(pageIsRead(cardPage(), traceOf([0]))).toBe(false);
    expect(pageIsRead(cardPage(), traceOf([0, 1, 2]))).toBe(true);
    expect(pageIsRead(cardPage(), null)).toBe(false);
  });

  it("counts card pages only, never covers", () => {
    const cover: DictionaryPage = {
      id: packPageId("polish"),
      level: "pack",
      packName: "polish",
      title: "Polish",
      parts: [],
      createdAt: at,
      updatedAt: at,
    };
    const deck: DictionaryPage = {
      id: deckPageId("polish", "basics"),
      level: "deck",
      packName: "polish",
      deckId: "basics",
      lead: "The basics.",
      parts: [],
      createdAt: at,
      updatedAt: at,
    };
    const pages = [cover, deck, cardPage(), { ...cardPage(), id: cardPageId("card-2"), cardId: "card-2", parts: [] }];
    const traces = [traceOf([0, 1, 2]), { id: cardPageId("card-2"), traced: [0], updatedAt: at }];
    expect(readCount(pages, traces)).toEqual({ read: 1, total: 1 });
  });
});

describe("saved pages", () => {
  it("refuses a deck page without its deck, a card page without parts, and a video cover", () => {
    expect(savedPageSchema.safeParse({ level: "deck", packName: "polish", parts: [] }).success).toBe(false);
    expect(
      savedPageSchema.safeParse({ level: "card", packName: "polish", cardId: "c1", parts: [] }).success,
    ).toBe(false);
    expect(
      savedPageSchema.safeParse({
        level: "pack",
        packName: "polish",
        cover: { type: "video", source: "youtube", src: "abcdefghijk" },
        parts: [],
      }).success,
    ).toBe(false);
  });

  it("accepts a pack page with only a cover", () => {
    const parsed = savedPageSchema.safeParse({
      level: "pack",
      packName: "polish",
      cover: { type: "image", source: "web", src: "https://example.com/a.jpg", alt: "A cover" },
      parts: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("marks every learner save as an overlay and keeps the first created time", () => {
    const previous: DictionaryPage = { ...cardPage(), createdAt: at, updatedAt: at };
    const page = pageFromSave(
      { level: "card", packName: "polish", deckId: "basics", cardId: "card-1", parts: [textPart("new")] },
      previous,
      later,
    );
    expect(page.id).toBe(cardPageId("card-1"));
    expect(page.learnerEdited).toBe(true);
    expect(page.createdAt).toBe(at);
    expect(page.updatedAt).toBe(later);
  });

  it("tells a written page from a missing one", () => {
    expect(pageIsWritten(null)).toBe(false);
    expect(pageIsWritten({ ...cardPage(), parts: [] })).toBe(false);
    expect(pageIsWritten(cardPage())).toBe(true);
    expect(pageTitle({ ...cardPage(), title: "  Coffee  " }, "Card")).toBe("Coffee");
    expect(pageTitle(null, "Card")).toBe("Card");
  });
});
