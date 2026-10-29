// WHY: A page is content, a trace is proof, and an overlay is the learner's
// own copy of a shipped page. These tests pin those three against the memory
// store so a seed, a restore or a delete cannot quietly break them.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setBrowserStore } from "@/lib/browser/store";
import {
  deletePage,
  readPage,
  readPages,
  readTrace,
  readTraces,
  recordTracedPart,
  savePage,
  writeShippedPage,
} from "@/lib/browser/pages";
import { deleteUnreferenced, putMedia, readAllMedia } from "@/lib/browser/media";
import { deleteCard, upsertCards } from "@/lib/browser/repository";
import { cardPageId, deckPageId, packPageId } from "@/lib/core/pages";
import type { Card, DictionaryPage } from "@/lib/shared/types";

const at = "2026-10-29T10:00:00.000Z";
const later = "2026-10-29T11:00:00.000Z";

function card(): Card {
  return {
    id: "card-1",
    summary: "Coffee",
    topics: ["Basics"],
    tags: [],
    prompt: [{ type: "text", text: "Piję kawę." }],
    answer: [{ type: "text", text: "I drink coffee." }],
    answerDef: { mode: "type", expected: ["I drink coffee"] },
    packName: "polish",
    deckId: "basics",
    origin: { kind: "learner", note: "Written by the learner." },
    createdAt: at,
  };
}

function shippedCardPage(): DictionaryPage {
  return {
    id: cardPageId("card-1"),
    level: "card",
    packName: "polish",
    deckId: "basics",
    cardId: "card-1",
    title: "Coffee",
    parts: [{ type: "text", text: "One" }, { type: "text", text: "Two" }],
    createdAt: at,
    updatedAt: at,
  };
}

beforeEach(() => {
  setBrowserStore(new MemoryStore());
});

describe("saving pages", () => {
  it("stores a learner save as an overlay and keeps its first created time", async () => {
    const first = await savePage(
      { level: "card", packName: "polish", deckId: "basics", cardId: "card-1", parts: [{ type: "text", text: "One" }] },
      at,
    );
    expect(first.learnerEdited).toBe(true);
    const second = await savePage(
      { level: "card", packName: "polish", deckId: "basics", cardId: "card-1", parts: [{ type: "text", text: "Two" }] },
      later,
    );
    expect(second.createdAt).toBe(at);
    expect(second.updatedAt).toBe(later);
    expect(second.parts).toEqual([{ type: "text", text: "Two" }]);
  });

  it("never lets a shipped page replace the learner's copy", async () => {
    await savePage(
      { level: "card", packName: "polish", deckId: "basics", cardId: "card-1", parts: [{ type: "text", text: "Mine" }] },
      at,
    );
    const written = await writeShippedPage(shippedCardPage());
    expect(written).toBe(false);
    expect((await readPage(cardPageId("card-1")))?.parts).toEqual([{ type: "text", text: "Mine" }]);
  });

  it("writes a shipped page when the learner has not edited it", async () => {
    expect(await writeShippedPage(shippedCardPage())).toBe(true);
    expect((await readPage(cardPageId("card-1")))?.title).toBe("Coffee");
  });

  it("reverts a shipped page by deleting the overlay row", async () => {
    await savePage(
      { level: "card", packName: "polish", deckId: "basics", cardId: "card-1", parts: [{ type: "text", text: "Mine" }] },
      at,
    );
    await deletePage(cardPageId("card-1"));
    expect(await readPage(cardPageId("card-1"))).toBeNull();
    expect(await writeShippedPage(shippedCardPage())).toBe(true);
  });

  it("filters pages by pack", async () => {
    await writeShippedPage(shippedCardPage());
    await writeShippedPage({ ...shippedCardPage(), id: packPageId("other"), level: "pack", packName: "other", cardId: undefined });
    expect((await readPages("polish")).map((page) => page.id)).toEqual([cardPageId("card-1")]);
    expect((await readPages()).length).toBe(2);
  });
});

describe("traces", () => {
  it("records parts and marks the page read once complete", async () => {
    await writeShippedPage(shippedCardPage());
    expect(await recordTracedPart(cardPageId("card-1"), 0, at)).toMatchObject({ traced: [0] });
    const complete = await recordTracedPart(cardPageId("card-1"), 1, later);
    expect(complete?.traced).toEqual([0, 1]);
    expect(complete?.readAt).toBe(later);
    expect((await readTrace(cardPageId("card-1")))?.traced).toEqual([0, 1]);
    expect((await readTraces()).length).toBe(1);
  });

  it("records nothing for a page that is not here", async () => {
    expect(await recordTracedPart(cardPageId("missing"), 0, at)).toBeNull();
    expect(await readTraces()).toEqual([]);
  });

  it("takes the trace with the page when it is deleted", async () => {
    await writeShippedPage(shippedCardPage());
    await recordTracedPart(cardPageId("card-1"), 0, at);
    await deletePage(cardPageId("card-1"));
    expect(await readTrace(cardPageId("card-1"))).toBeNull();
  });
});

describe("media and deletion follow the pages", () => {
  it("keeps media a page still shows and frees it after the page is gone", async () => {
    const record = await putMedia({ blob: new Blob(["x"]), mime: "image/png", kind: "image" });
    await writeShippedPage({
      ...shippedCardPage(),
      parts: [{ type: "image", source: "local", src: record.id, alt: "A picture" }],
    });
    expect(await deleteUnreferenced()).toEqual([]);
    expect((await readAllMedia()).map((entry) => entry.id)).toEqual([record.id]);
    await deletePage(cardPageId("card-1"));
    expect(await deleteUnreferenced()).toEqual([record.id]);
  });

  it("takes a card's page and trace with the card", async () => {
    await writeShippedPage(shippedCardPage());
    await recordTracedPart(cardPageId("card-1"), 0, at);
    await upsertCards([card()]);
    await deleteCard("card-1");
    expect(await readPage(cardPageId("card-1"))).toBeNull();
    expect(await readTrace(cardPageId("card-1"))).toBeNull();
  });

  it("leaves a deck page alone when its card is deleted", async () => {
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
    await writeShippedPage(deck);
    await upsertCards([card()]);
    await deleteCard("card-1");
    expect(await readPage(deckPageId("polish", "basics"))).not.toBeNull();
  });
});
