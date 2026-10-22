// WHY: The Library shell moves between panels and carries a create result into
// the next view. These small rules decide which cards are shown, which pack or
// deck a value names, and where a create lands; the panels should not each
// invent them.
// PACK: library-create-flow
// 2026-10-21 opencode: created before the panel split [pack: library-create-flow]

import { describe, expect, it } from "vitest";
import type { Card, PackStatus } from "@/lib/shared/types";
import {
  cardMatches,
  cardsInFocus,
  createDestination,
  deckChoices,
  deckLabel,
  deckValue,
  deleteName,
  packMatches,
  readDeckValue,
  searchable,
} from "@/app/library/library-utils";
import { makeCard } from "./helpers";

function makePack(overrides: Partial<PackStatus> = {}): PackStatus {
  return {
    name: "starter",
    version: "1.0.0",
    folder: "/packs/starter",
    topics: ["basics"],
    topicLabels: {},
    cardCount: 2,
    decks: [{ id: "basics", name: "Basics" }],
    ...overrides,
  };
}

function placedCard(overrides: Partial<Card> = {}): Card {
  return { ...makeCard("card:placed"), packName: "starter", deckId: "basics", ...overrides };
}

describe("deck values", () => {
  it("keeps a pack-qualified value readable even when deck ids repeat", () => {
    const value = deckValue("starter", "basics");
    expect(value).toBe("starter::basics");
    expect(readDeckValue(value)).toEqual({ packName: "starter", deckId: "basics" });
    expect(readDeckValue("starter")).toBeNull();
  });

  it("lists real decks, falls back to topics, and skips a broken pack", () => {
    const choices = deckChoices([
      makePack(),
      makePack({
        name: "legacy",
        decks: undefined,
        topics: ["cases"],
        topicLabels: { cases: "Cases" },
      }),
      makePack({ name: "broken", error: "could not read" }),
    ]);
    expect(choices.map((choice) => choice.value)).toEqual([
      "starter::basics",
      "legacy::cases",
    ]);
  });

  it("names a deck from its pack, then falls back to the stored id", () => {
    expect(deckLabel([makePack()], "starter", "basics")).toBe("Basics");
    expect(deckLabel([makePack()], "starter", "gone")).toBe("gone");
    expect(deckLabel([makePack()], undefined, undefined)).toBe("unknown");
  });
});

describe("search", () => {
  it("ignores case and Polish marks", () => {
    expect(searchable("Samochód")).toBe("samochod");
  });

  it("finds a card by its visible words, pack and deck", () => {
    const card = placedCard({
      summary: "Samochód",
      prompt: [{ type: "text", text: "Jadę samochodem." }],
      answer: [{ type: "text", text: "I am going by car." }],
      topics: ["Travel"],
    });
    expect(cardMatches(card, "samochod")).toBe(true);
    expect(cardMatches(card, "starter")).toBe(true);
    expect(cardMatches(card, "travel")).toBe(true);
    expect(cardMatches(card, "rower")).toBe(false);
  });

  it("finds a pack by a deck name, not only its own name", () => {
    const pack = makePack({ description: "Everyday Polish" });
    expect(packMatches(pack, "basics")).toBe(true);
    expect(packMatches(pack, "everyday")).toBe(true);
    expect(packMatches(pack, "cases")).toBe(false);
  });
});

describe("focus and destination", () => {
  it("shows only cards in the chosen pack and deck", () => {
    const cards = [
      placedCard(),
      placedCard({ id: "card:other", deckId: "cases" }),
      placedCard({ id: "card:elsewhere", packName: "other" }),
    ];
    expect(cardsInFocus(cards, { packName: "starter", deckId: "basics" })).toHaveLength(1);
    expect(cardsInFocus(cards, null)).toHaveLength(3);
  });

  it("sends a pack or deck to Packs and cards to Cards", () => {
    expect(createDestination({ kind: "pack", packName: "slow" })).toEqual({
      tab: "packs",
      packName: "slow",
    });
    expect(createDestination({ kind: "deck", packName: "slow", deckId: "basics" })).toEqual({
      tab: "packs",
      packName: "slow",
    });
    expect(
      createDestination({ kind: "cards", packName: "slow", deckId: "basics", count: 5 }),
    ).toEqual({ tab: "cards", packName: "slow", deckId: "basics" });
  });

  it("asks for the name the learner actually sees before deleting", () => {
    expect(deleteName({ kind: "pack", packName: "starter" })).toBe("starter");
    expect(
      deleteName({ kind: "deck", packName: "starter", deckId: "basics", deckName: "Basics" }),
    ).toBe("Basics");
  });
});
