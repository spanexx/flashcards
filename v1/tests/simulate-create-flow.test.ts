// WHY: The create flow spans writes, generation, chat, strict imports, deletion
// and the built Library page. This rehearsal walks those promises through the
// real browser router and memory store so a passing unit test cannot hide a
// broken path between them. It is the post-implementation simulation from the
// PRD, not a copy of the pre-implementation HTML.
// PACK: library-create-flow
// 2026-10-21 opencode: created for the post-implementation create-flow rehearsal [pack: library-create-flow]

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { localGet, localSend } from "@/lib/browser/router";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import {
  appendEvidence,
  readEvidence,
  readMeta,
  readPack,
  readPacks,
  writeMeta,
  type BrowserPack,
} from "@/lib/browser/repository";
import { createDestination } from "@/app/library/library-utils";
import type { Card, EvidenceRow, PackStatus } from "@/lib/shared/types";

const seedPath = fileURLToPath(new URL("../public/packs/polish-starter.json", import.meta.url));
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const now = "2026-10-21T12:00:00.000Z";

function line(message: string): void {
  console.log(`-> ${message}`);
}

function cardSource(deckId: string, summary: string, front: string, back: string) {
  return {
    deckId,
    summary,
    prompt: [{ type: "text" as const, text: front }],
    answer: [{ type: "text" as const, text: back }],
    answerDef: { mode: "type" as const, expected: [back] },
  };
}

function evidence(cardId: string, index: number): EvidenceRow {
  return {
    id: `sim-row-${index}`,
    cardId,
    attemptId: `sim-attempt-${index}`,
    region: null,
    outcome: "got_it",
    timeMs: 800,
    seenBefore: 0,
    at: now,
    kind: "answer",
  };
}

function providerReply(content: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

async function errorText(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    return "";
  } catch (problem) {
    return problem instanceof Error ? problem.message : String(problem);
  }
}

let store: Store;

beforeEach(async () => {
  store = new MemoryStore();
  setBrowserStore(store);
  await writeMeta("seeded", "yes", store);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("create flow simulation", () => {
  it("walks write, generate, chat, import, delete and the built Library page", async () => {
    const seed = await readFile(seedPath, "utf8");
    const seeded = await localSend<{ cardsAdded: number }>("/api/packs/import", "POST", {
      json: seed,
      target: { kind: "pack" },
    });
    expect(seeded.cardsAdded).toBe(32);

    const made = await localSend<{ pack: BrowserPack }>("/api/packs", "POST", {
      name: "Sim Create",
      language: "pl",
      sourceLanguage: "en",
      version: "1.0.0",
      deckName: "First",
    });
    expect(made.pack).toMatchObject({ name: "sim-create", language: "pl", sourceLanguage: "en" });
    expect(made.pack.decks.map((deck) => deck.id)).toEqual(["first"]);
    expect(made.pack.decks[0].name).toBe("First");
    const duplicate = await errorText(
      localSend("/api/packs", "POST", {
        name: "Sim Create",
        language: "pl",
        version: "1.0.0",
        deckName: "Again",
      }),
    );
    expect(duplicate).toContain("already here");
    line("Write pack -> one deck, zero cards; duplicate refused");

    const extra = await localSend<{ deck: { id: string; name: string; level: string } }>(
      "/api/packs/sim-create/decks",
      "POST",
      { name: "Second" },
    );
    // A new deck follows the learner's current level, and a fresh store is beginner.
    expect(extra.deck).toEqual({ id: "second", name: "Second", level: "beginner" });
    const written = await localSend<{ card: Card }>("/api/cards", "POST", {
      front: "To jest kot.",
      back: "This is a cat.",
      packName: "sim-create",
      deckId: "first",
    });
    expect(written.card.deckId).toBe("first");
    line("Write deck -> empty deck; Write card -> card in chosen deck");

    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "sim-model" },
    });
    await localSend("/api/provider/key", "POST", { key: "sim-secret" });

    providerReply(
      JSON.stringify({
        pack: { name: "sim-create", version: "1.0.0", language: "pl" },
        decks: [{ id: "generated", name: "Generated" }],
        lines: [{ deckId: "generated", fullLine: "Piję wodę.", target: "wodę" }],
      }),
    );
    const packPrompt = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "pack" },
      count: 1,
    });
    const generatedPack = await localSend<{ kind: string; packName: string; count: number }>(
      "/api/provider/generate",
      "POST",
      { requestId: packPrompt.requestId },
    );
    expect(generatedPack.kind).toBe("pack");
    expect(generatedPack.packName).toBe("sim-create-2");
    expect(generatedPack.count).toBe(1);

    providerReply(
      JSON.stringify({
        deck: { id: "first", name: "First" },
        lines: [{ fullLine: "Mam psa.", target: "psa" }],
      }),
    );
    const deckPrompt = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "deck", packName: "sim-create" },
      count: 1,
    });
    const generatedDeck = await localSend<{
      kind: string;
      deckId: string;
      pack: { decks: Array<{ id: string; name: string }> };
    }>("/api/provider/generate", "POST", { requestId: deckPrompt.requestId });
    expect(generatedDeck.kind).toBe("deck");
    expect(generatedDeck.deckId).toBe("first-2");
    expect(generatedDeck.pack.decks).toContainEqual({ id: "first-2", name: "First 2", level: "intermediate" });

    providerReply(JSON.stringify({ lines: [{ fullLine: "To jest dom.", target: "dom" }] }));
    const cardsPrompt = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "cards", packName: "sim-create", deckId: "first" },
      count: 1,
    });
    const generatedCards = await localSend<{ kind: string; deckId: string; count: number }>(
      "/api/provider/generate",
      "POST",
      { requestId: cardsPrompt.requestId },
    );
    expect(generatedCards.kind).toBe("cards");
    expect(generatedCards.deckId).toBe("first");
    expect(generatedCards.count).toBe(1);

    const cardsBeforeBadBatch = (await localGet<{ cards: Card[] }>("/api/cards")).cards.length;
    providerReply(JSON.stringify({ lines: [{ fullLine: "To jest dom.", target: "nie-ma" }] }));
    const badPrompt = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "cards", packName: "sim-create", deckId: "first" },
      count: 1,
    });
    const badBatchError = await errorText(
      localSend("/api/provider/generate", "POST", { requestId: badPrompt.requestId }),
    );
    expect(badBatchError).toContain('"nie-ma"');
    expect(badBatchError).toContain("not inside the line");
    expect((await localGet<{ cards: Card[] }>("/api/cards")).cards).toHaveLength(cardsBeforeBadBatch);
    line("Generate Pack/Deck/Cards with a fake provider -> all-or-nothing");

    const suffixError = await errorText(
      localSend("/api/packs", "POST", { name: "sim-create", language: "pl", version: "1.0.0", deckName: "Again" }),
    );
    expect(suffixError).toContain("already here");
    line("generated collision gets -2 (and -3); deck label/id stay paired");

    const packAuthoring = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "pack" },
    });
    const deckAuthoring = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "deck", packName: "sim-create" },
    });
    const cardsAuthoring = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "cards", packName: "sim-create", deckId: "first" },
    });
    expect(packAuthoring.prompt).toContain("Choose a short lowercase pack name");
    expect(deckAuthoring.prompt).toContain("sim-create");
    expect(deckAuthoring.prompt).toContain("Choose short lowercase deck ids");
    expect(cardsAuthoring.prompt).toContain('"first"');
    expect(cardsAuthoring.prompt).not.toContain("What name should the learner use");

    const chatPack = await localSend<{ packName: string }>("/api/packs/import", "POST", {
      json: JSON.stringify({
        schema: PACK_BUNDLE_SCHEMA,
        pack: { name: "sim-create", version: "1.0.1", language: "pl" },
        decks: [{ id: "chat-pack", name: "Chat Pack" }],
        cards: [],
      }),
      target: { kind: "pack" },
      namePolicy: "auto-suffix",
    });
    expect(chatPack.packName).toBe("sim-create-3");

    const chatDeck = await localSend<{ packName: string; deckIds: string[] }>("/api/packs/import", "POST", {
      json: JSON.stringify({
        decks: [{ id: "first", name: "First" }],
        cards: [cardSource("first", "Chat card", "Cześć", "Hello")],
      }),
      target: { kind: "deck", packName: "sim-create" },
      namePolicy: "auto-suffix",
    });
    expect(chatDeck.deckIds).toEqual(["first-3"]);
    const afterChatDeck = await readPack("sim-create", store);
    expect(afterChatDeck?.decks).toContainEqual({ id: "first-3", name: "First 3", level: "intermediate" });
    line("Chat prompt has no name field; Chat Pack/Deck collision auto-numbers");

    const cardsImport = await localSend<{ cardsAdded: number; deckIds: string[] }>("/api/packs/import", "POST", {
      json: JSON.stringify({ cards: [cardSource("first", "Strict card", "Pies", "Dog")] }),
      target: { kind: "cards", packName: "sim-create", deckId: "first" },
    });
    expect(cardsImport.cardsAdded).toBe(1);
    expect(cardsImport.deckIds).toEqual(["first"]);

    const beforeMismatch = await Promise.all([
      localGet<{ packs: PackStatus[] }>("/api/packs"),
      localGet<{ cards: Card[] }>("/api/cards"),
    ]);
    const packMismatch = await errorText(
      localSend("/api/packs/import", "POST", {
        json: JSON.stringify({ decks: [{ id: "nope", name: "Nope" }], cards: [] }),
        target: { kind: "pack" },
      }),
    );
    const deckMismatch = await errorText(
      localSend("/api/packs/import", "POST", {
        json: JSON.stringify({ cards: [cardSource("first", "Wrong", "A", "B")] }),
        target: { kind: "deck", packName: "sim-create" },
      }),
    );
    const cardsMismatch = await errorText(
      localSend("/api/packs/import", "POST", {
        json: JSON.stringify({
          schema: PACK_BUNDLE_SCHEMA,
          pack: { name: "wrong", version: "1.0.0" },
          decks: [{ id: "wrong", name: "Wrong" }],
          cards: [],
        }),
        target: { kind: "cards", packName: "sim-create", deckId: "first" },
      }),
    );
    expect(packMismatch).toContain("Nothing was imported");
    expect(deckMismatch).toContain("Nothing was imported");
    expect(cardsMismatch).toContain("Nothing was imported");
    const afterMismatch = await Promise.all([
      localGet<{ packs: PackStatus[] }>("/api/packs"),
      localGet<{ cards: Card[] }>("/api/cards"),
    ]);
    expect(afterMismatch[0].packs).toHaveLength(beforeMismatch[0].packs.length);
    expect(afterMismatch[1].cards).toHaveLength(beforeMismatch[1].cards.length);
    line("Import Pack/Deck/Cards accept only their shape; mismatch writes nothing");

    const firstCards = (await localGet<{ cards: Card[] }>("/api/cards")).cards.filter(
      (card) => card.packName === "sim-create" && card.deckId === "first",
    );
    await appendEvidence(firstCards.map((card, index) => evidence(card.id, index)), store);
    const removedDeck = await localSend<{
      removedDecks: number;
      removedCards: number;
      removedEvidenceRows: number;
    }>("/api/packs/sim-create/decks/first", "DELETE");
    expect(removedDeck.removedDecks).toBe(1);
    expect(removedDeck.removedCards).toBe(firstCards.length);
    expect(removedDeck.removedEvidenceRows).toBe(firstCards.length);
    const afterDeckDelete = await readPack("sim-create", store);
    expect(afterDeckDelete?.decks.some((deck) => deck.id === "first")).toBe(false);

    await localSend("/api/packs", "POST", { name: "solo", language: "pl", version: "1.0.0", deckName: "Basics" });
    const lastDeck = await errorText(localSend("/api/packs/solo/decks/basics", "DELETE"));
    expect(lastDeck).toContain("must keep at least one deck");
    line("Delete deck removes its cards + evidence; last deck refused");

    const promptsBefore = await localGet<{ entries: unknown[] }>("/api/prompts?limit=50");
    const packBeforeDelete = await readPack("sim-create", store);
    if (!packBeforeDelete) throw new Error("the simulation pack is gone before deletion");
    const evidenceBeforeDelete = await readEvidence(store);
    const removedPack = await localSend<{
      removedDecks: number;
      removedCards: number;
      removedEvidenceRows: number;
    }>("/api/packs/sim-create", "DELETE");
    expect(removedPack.removedDecks).toBe(packBeforeDelete.decks.length);
    expect(removedPack.removedCards).toBeGreaterThan(0);
    expect(removedPack.removedEvidenceRows).toBe(evidenceBeforeDelete.length);
    const promptsAfter = await localGet<{ entries: unknown[] }>("/api/prompts?limit=50");
    expect(promptsAfter.entries).toHaveLength(promptsBefore.entries.length);
    line("Delete pack removes pack/decks/cards/evidence; prompt history stays");

    await localSend("/api/packs/polish-starter", "DELETE");
    expect(await readPack("polish-starter", store)).toBeNull();
    expect(await readMeta("seeded", store)).toBe("yes");
    expect((await readPacks(store)).some((pack) => pack.name === "polish-starter")).toBe(false);
    line("seed fact unchanged after deleting the starter pack");

    expect(createDestination({ kind: "pack", packName: "x" })).toEqual({ tab: "packs", packName: "x" });
    expect(createDestination({ kind: "deck", packName: "x", deckId: "d" })).toEqual({
      tab: "packs",
      packName: "x",
    });
    expect(createDestination({ kind: "cards", packName: "x", deckId: "d", count: 2 })).toEqual({
      tab: "cards",
      packName: "x",
      deckId: "d",
    });
    line("create result navigation selects Packs expanded or Cards filtered");

    const built = path.join(projectRoot, "out", "library", "index.html");
    expect(existsSync(built)).toBe(true);
    const html = await readFile(built, "utf8");
    expect(html).toContain(">Packs</button>");
    expect(html).toContain(">Cards</button>");
    expect(html).toContain(">Create</button>");
    expect(html).not.toContain("Create with a chat");
    line("built Library page has the three tabs and no old Create with a chat tab");

    const evidenceAfter = await readEvidence(store);
    expect(evidenceAfter).toHaveLength(0);
    expect((await localGet<{ cards: Card[] }>("/api/cards")).cards.some((card) => card.packName === "sim-create")).toBe(false);
  });
});
