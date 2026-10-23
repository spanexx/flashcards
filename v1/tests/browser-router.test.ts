// WHY: The router is the seam that keeps the screens unchanged while the data
// moves into the browser. These tests walk a learner's whole day through those
// URL-shaped calls, with no server and no IndexedDB.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.
// 2026-10-22 opencode: the creation brief and requested card style are checked
// through this same seam. [pack: creation-control]

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { localGet, localSend } from "@/lib/browser/router";
import { writeMeta } from "@/lib/browser/repository";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import type { BrowserJob, JobView } from "@/lib/browser/jobs";
import { ApiError } from "@/lib/client/errors";
import type { AnswerResult, Card, Plan, ProviderStatus } from "@/lib/shared/types";

function packBundle(): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name: "starter", version: "1.0.0", language: "pl" },
    decks: [
      { id: "basics", name: "Basics" },
      { id: "cases", name: "Cases" },
    ],
    cards: [
      {
        deckId: "basics",
        summary: "Piję kawę",
        prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: "Piję kawę." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
        hints: ["Accusative."],
        fullLine: "Piję kawę.",
      },
    ],
  });
}

function seedFetch() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
}

let store: Store;

beforeEach(async () => {
  store = new MemoryStore();
  setBrowserStore(store);
  await writeMeta("seeded", "yes", store);
  seedFetch();
});

describe("library reads and writes", () => {
  it("imports a bundle and reports packs, cards and settings", async () => {
    const imported = await localSend<{ cardsAdded: number; decksAdded: number }>("/api/packs/import", "POST", {
      json: packBundle(),
      target: { kind: "pack" },
    });
    expect(imported.cardsAdded).toBe(1);
    expect(imported.decksAdded).toBe(2);

    const packs = await localGet<{ packs: Array<{ name: string; topics: string[] }>; orphan: string[] }>("/api/packs");
    expect(packs.packs[0].name).toBe("starter");
    expect(packs.packs[0].topics).toEqual(["Basics", "Cases"]);

    const cards = await localGet<{ cards: Card[] }>("/api/cards");
    expect(cards.cards).toHaveLength(1);

    const settings = await localGet<{ settings: { level: string }; provider: ProviderStatus; version: string }>("/api/settings");
    expect(settings.settings.level).toBe("beginner");
    expect(settings.provider.keyStore).toBe("none");
    expect(settings.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("creates, edits and deletes a card in a chosen deck", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });

    const created = await localSend<{ card: Card }>("/api/cards", "POST", {
      front: "Mam kota",
      back: "I have a cat",
      packName: "starter",
      deckId: "cases",
    });
    expect(created.card.deckId).toBe("cases");
    expect(created.card.topics).toEqual(["Cases"]);

    const edited = await localSend<{ card: Card; retired: string }>(`/api/cards/${created.card.id}`, "PATCH", {
      front: "Mam psa",
      back: "I have a dog",
    });
    expect(edited.card.summary).toContain("Mam psa");
    expect((await localGet<{ cards: Card[] }>("/api/cards")).cards.find((card) => card.id === created.card.id)?.retired).toBe(true);

    const removed = await localSend<{ removedEvidenceRows: number }>(`/api/cards/${created.card.id}`, "DELETE");
    expect(removed.removedEvidenceRows).toBe(0);
  });

  it("creates a pack, keeps deck choices pack-qualified, and refuses a repeated card", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const made = await localSend<{ pack: { name: string; version: string; decks: Array<{ id: string; name: string }> } }>(
      "/api/packs",
      "POST",
      { name: "other", version: "1.0.0", deckName: "Basics", deckId: "basics" },
    );
    expect(made.pack.name).toBe("other");
    expect(made.pack.decks).toEqual([{ id: "basics", name: "Basics" }]);

    const created = await localSend<{ card: Card }>("/api/cards", "POST", {
      front: "Mam kota",
      back: "I have a cat",
      packName: "other",
      deckId: "basics",
    });
    expect(created.card.packName).toBe("other");
    expect(created.card.deckId).toBe("basics");

    await expect(
      localSend("/api/cards", "POST", {
        front: "Mam kota",
        back: "I have a cat",
        packName: "other",
        deckId: "basics",
      }),
    ).rejects.toThrow("already in this deck");
  });

  it("refuses a deck choice when the named pack does not hold it", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await expect(
      localSend("/api/cards", "POST", { front: "A", back: "B", packName: "starter", deckId: "missing" }),
    ).rejects.toThrow('not in "starter"');
  });

  it("imports flat cards into the pack-qualified deck, not a same-id deck elsewhere", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await localSend("/api/packs", "POST", { name: "other", version: "1.0.0", deckName: "Other basics", deckId: "basics" });
    await localSend("/api/cards/import", "POST", {
      json: JSON.stringify([{ front: "Dzień dobry", back: "Good morning" }]),
      packName: "other",
      deckId: "basics",
    });
    const card = (await localGet<{ cards: Card[] }>("/api/cards")).cards.find((entry) => entry.summary.includes("Dzień"));
    expect(card?.packName).toBe("other");
    expect(card?.topics).toEqual(["Other basics"]);
  });

  it("refuses a manual card with no deck to hold it", async () => {
    await expect(
      localSend("/api/cards", "POST", { front: "A", back: "B" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("imports flat cards into the chosen deck", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const result = await localSend<{ imported: number; duplicates: number }>("/api/cards/import", "POST", {
      json: JSON.stringify([{ front: "Dzień dobry", back: "Good morning" }]),
      packName: "starter",
      deckId: "basics",
    });
    expect(result.imported).toBe(1);
    const card = (await localGet<{ cards: Card[] }>("/api/cards")).cards.find((entry) => entry.summary.includes("Dzień"));
    expect(card?.deckId).toBe("basics");
    expect(card?.origin.kind).toBe("imported");
  });

  it("reads health, the prompt log and a refresh without a server", async () => {
    const health = await localGet<{ ok: boolean; version: string }>("/api/health");
    expect(health.ok).toBe(true);
    expect(health.version).toMatch(/^\d+\.\d+\.\d+/);

    const log = await localGet<{ entries: unknown[] }>("/api/prompts?limit=5");
    expect(log.entries).toEqual([]);

    const refreshed = await localSend<{ folder: string }>("/api/packs/rescan", "POST");
    expect(refreshed.folder).toContain("This browser");
  });

  it("creates packs and refuses duplicates, missing names and bad shapes", async () => {
    const created = await localSend<{ pack: { name: string; decks: Array<{ id: string }> } }>("/api/packs", "POST", {
      name: "new-pack",
      deckName: "First deck",
      deckId: "first",
    });
    expect(created.pack.name).toBe("new-pack");
    expect(created.pack.decks).toHaveLength(1);

    await expect(localSend("/api/packs", "POST", { name: "new-pack" })).rejects.toThrow("already here");
    await expect(localSend("/api/packs", "POST", {})).rejects.toThrow("Give the pack a name");
    const slugged = await localSend<{ pack: { name: string } }>("/api/packs", "POST", { name: "Bad Name" });
    expect(slugged.pack.name).toBe("bad-name");
  });

  it("adds a deck to an existing pack through the deck target", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const deckOnly = JSON.stringify({
      decks: [{ id: "extra", name: "Extra" }],
      cards: [],
    });
    const result = await localSend<{ decksAdded: number }>("/api/packs/import", "POST", {
      json: deckOnly,
      target: { kind: "deck", packName: "starter" },
    });
    expect(result.decksAdded).toBe(1);
    await expect(
      localSend("/api/packs/import", "POST", { json: deckOnly, target: { kind: "deck" } }),
    ).rejects.toThrow("Choose the pack");
    await expect(localSend("/api/packs/import", "POST", { target: { kind: "pack" } })).rejects.toThrow("Paste the bundle");
  });

  it("adds and deletes decks and packs through the router", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const made = await localSend<{ deck: { id: string; name: string } }>("/api/packs/starter/decks", "POST", {
      name: "Extra Words",
    });
    expect(made.deck).toMatchObject({ id: "extra-words", name: "Extra Words" });

    const card = await localSend<{ card: Card }>("/api/cards", "POST", {
      front: "Nowy",
      back: "New",
      packName: "starter",
      deckId: "extra-words",
    });
    const removedDeck = await localSend<{ removedCards: number }>("/api/packs/starter/decks/extra-words", "DELETE");
    expect(removedDeck.removedCards).toBe(1);
    expect((await localGet<{ cards: Card[] }>("/api/cards")).cards.some((entry) => entry.id === card.card.id)).toBe(false);
    await expect(localSend("/api/packs/starter/decks/gone", "DELETE")).rejects.toThrow("There is no deck");

    await localSend("/api/packs", "POST", { name: "solo", deckName: "Only" });
    await expect(localSend("/api/packs/solo/decks/only", "DELETE")).rejects.toThrow("must keep at least one deck");
    const removedPack = await localSend<{ removedDecks: number }>("/api/packs/solo", "DELETE");
    expect(removedPack.removedDecks).toBe(1);
    expect((await localGet<{ packs: Array<{ name: string }> }>("/api/packs")).packs.map((entry) => entry.name)).toEqual([
      "starter",
    ]);
  });

  it("round-trips a backup through the router and refuses bad ones", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const backup = await localGet<{ json: string }>("/api/backup/export");
    const restored = await localSend<{ packs: number; cards: number }>("/api/backup/restore", "POST", {
      json: backup.json,
    });
    expect(restored).toMatchObject({ packs: 1, cards: 1 });
    await expect(localSend("/api/backup/restore", "POST", { json: "{" })).rejects.toThrow("Nothing was restored");
    await expect(localSend("/api/backup/restore", "POST", {})).rejects.toThrow("Paste the backup");
  });

  it("returns plain refusals for missing ids, bad rows and bad export names", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await expect(localGet("/api/packs/export")).rejects.toThrow("Choose a pack");
    await expect(localGet("/api/evidence")).rejects.toThrow("card id");
    await expect(localGet("/api/evidence?cardId=missing")).rejects.toThrow("not in the deck");
    await expect(localSend("/api/session/end", "POST", {})).rejects.toThrow("needs its id");
    await expect(localSend("/api/evidence/correction", "POST", {})).rejects.toThrow("which answer");
    await expect(
      localSend("/api/evidence/correction", "POST", { rowId: "row", outcome: "perfect" }),
    ).rejects.toThrow("must pick");
    await expect(
      localSend("/api/evidence/correction", "POST", { rowId: "row", outcome: "no" }),
    ).rejects.toThrow("not in the record");
    await expect(localSend("/api/provider/key", "POST", {})).rejects.toThrow("A key is needed");
    await expect(localSend("/api/provider/hint", "POST", {})).rejects.toThrow("which card");
    await expect(localSend("/api/provider/generate", "POST", {})).rejects.toThrow("prompt id");
    await expect(localSend("/api/cards/row", "PATCH")).rejects.toThrow("shape");
    await expect(localSend("/api/cards/row", "DELETE")).rejects.toThrow("not in the deck");
    await expect(localSend("/api/authoring/prompt", "POST", { target: { kind: "deck" } })).rejects.toThrow(
      "Choose the pack",
    );
    await expect(
      localSend("/api/authoring/prompt", "POST", { target: { kind: "cards", packName: "starter" } }),
    ).rejects.toThrow("pack and deck");
    await expect(
      localSend("/api/authoring/prompt", "POST", { target: { kind: "deck", packName: "gone" } }),
    ).rejects.toThrow("There is no pack");
  });

  it("refuses an answer with no card", async () => {
    await expect(localSend("/api/answer", "POST", {})).rejects.toThrow("which card");
    await expect(localSend("/api/answer", "POST", { cardId: "missing" })).rejects.toThrow("not in the deck");
  });

  it("returns a plain refusal for an unknown path", async () => {
    await expect(localGet("/api/unknown")).rejects.toMatchObject({ name: "ApiError" });
    await expect(localSend("/api/unknown", "POST")).rejects.toMatchObject({ name: "ApiError" });
  });
});

describe("plan, answer and progress", () => {
  it("plans, judges an answer, reads it back and records a correction", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const plan = await localGet<{ plan: Plan | null; message: string | null }>("/api/plan");
    expect(plan.plan?.cards).toHaveLength(1);
    expect(plan.message).toBeNull();

    const card = plan.plan?.cards[0];
    if (!card) throw new Error("no card planned");
    const answered = await localSend<AnswerResult>("/api/answer", "POST", {
      cardId: card.id,
      answers: { b1: "kawę" },
      timeMs: 1200,
    });
    expect(answered.cardOutcome).toBe("got_it");

    const evidence = await localGet<{ attempts: Array<{ outcome: string }>; rows: Array<{ id: string; outcome: string }> }>(
      `/api/evidence?cardId=${encodeURIComponent(card.id)}`,
    );
    expect(evidence.attempts[0].outcome).toBe("got_it");
    expect(evidence.rows).toHaveLength(1);

    const correction = await localSend<{ correction: { outcome: string; kind: string } }>(
      "/api/evidence/correction",
      "POST",
      { rowId: evidence.rows[0].id, outcome: "no" },
    );
    expect(correction.correction).toMatchObject({ outcome: "no", kind: "correction" });

    const progress = await localGet<{ progress: { cards: unknown[] } }>("/api/progress");
    expect(progress.progress).toBeTruthy();

    const ended = await localSend<{ ok: boolean }>("/api/session/end", "POST", {
      sessionId: plan.plan?.sessionId,
      offered: 10,
      answered: 1,
      completed: true,
    });
    expect(ended.ok).toBe(true);
  });

  it("says there is nothing to study in an empty library", async () => {
    const plan = await localGet<{ plan: null; message: string }>("/api/plan");
    expect(plan.plan).toBeNull();
    expect(plan.message).toContain("No cards");
  });

  it("studies one pack or one deck at a time", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await localSend("/api/packs", "POST", {
      name: "other",
      version: "1.0.0",
      deckName: "Basics",
      deckId: "basics",
    });
    await localSend("/api/cards", "POST", {
      front: "Dzień dobry",
      back: "Good morning",
      packName: "other",
      deckId: "basics",
    });
    await localSend("/api/cards", "POST", {
      front: "Mam kota",
      back: "I have a cat",
      packName: "starter",
      deckId: "cases",
    });
    await localSend("/api/packs", "POST", {
      name: "empty",
      version: "1.0.0",
      deckName: "Only",
      deckId: "only",
    });

    const starter = await localGet<{ plan: Plan | null; message: string | null }>(
      "/api/plan?pack=starter",
    );
    expect(starter.plan?.cards).toHaveLength(2);
    expect(starter.plan?.cards.every((card) => card.packName === "starter")).toBe(true);

    const limited = await localGet<{ plan: Plan | null; message: string | null }>(
      "/api/plan?pack=starter&offer=1",
    );
    expect(limited.plan?.cards).toHaveLength(1);

    const cases = await localGet<{ plan: Plan | null; message: string | null }>(
      "/api/plan?pack=starter&deck=cases",
    );
    expect(cases.plan?.cards).toHaveLength(1);
    expect(cases.plan?.cards[0].deckId).toBe("cases");

    const other = await localGet<{ plan: Plan | null; message: string | null }>(
      "/api/plan?pack=other",
    );
    expect(other.plan?.cards).toHaveLength(1);
    expect(other.plan?.cards[0].packName).toBe("other");

    const missingPack = await localGet<{ plan: null; message: string }>(
      "/api/plan?pack=missing",
    );
    expect(missingPack.plan).toBeNull();
    expect(missingPack.message).toContain("no pack");

    const missingDeck = await localGet<{ plan: null; message: string }>(
      "/api/plan?pack=starter&deck=missing",
    );
    expect(missingDeck.plan).toBeNull();
    expect(missingDeck.message).toContain("no deck");

    const deckWithoutPack = await localGet<{ plan: null; message: string }>(
      "/api/plan?deck=basics",
    );
    expect(deckWithoutPack.plan).toBeNull();
    expect(deckWithoutPack.message).toContain("Choose a pack");

    const empty = await localGet<{ plan: null; message: string }>("/api/plan?pack=empty");
    expect(empty.plan).toBeNull();
    expect(empty.message).toContain("No cards in");
  });
});

describe("settings and export", () => {
  it("saves categories, provider address and key without returning the key", async () => {
    const saved = await localSend<{ settings: { learningStyle: string } }>("/api/settings", "PATCH", {
      learningStyle: "rules-first",
      provider: { url: "https://provider.test/v1", model: "test-model" },
    });
    expect(saved.settings.learningStyle).toBe("rules-first");

    const key = await localSend<{ hasKey: boolean; keyStore: string }>("/api/provider/key", "POST", { key: "secret" });
    expect(key).toMatchObject({ hasKey: true, keyStore: "browser" });

    const settings = await localGet<{ provider: ProviderStatus }>("/api/settings");
    expect(settings.provider.hasKey).toBe(true);
    expect(JSON.stringify(settings)).not.toContain("secret");

    const cleared = await localSend<{ hasKey: boolean }>("/api/provider/key", "DELETE");
    expect(cleared.hasKey).toBe(false);

    const emptyKey = await localSend<{ hasKey: boolean }>("/api/provider/key", "POST", { key: "   " });
    expect(emptyKey.hasKey).toBe(false);

    await expect(
      localSend("/api/settings", "PATCH", { level: "wizard" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("exports a pack and a full backup", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const pack = await localGet<{ json: string }>("/api/packs/export?name=starter");
    expect(JSON.parse(pack.json).schema).toBe(PACK_BUNDLE_SCHEMA);
    const backup = await localGet<{ json: string }>("/api/backup/export");
    expect(JSON.parse(backup.json).schema).toBe("flashcards.backup/v1");
  });

  it("builds an authoring prompt for cards in a deck", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const result = await localSend<{ prompt: string; version: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "basics" },
    });
    expect(result.prompt).toContain('"basics"');
    expect(result.version).toBeTruthy();
  });
});

describe("provider calls", () => {
  it("prepares, generates and hints through the browser", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "test-model" },
    });
    await localSend("/api/provider/key", "POST", { key: "secret" });

    const reply = JSON.stringify({
      lines: [
        {
          fullLine: "Piję mleko.",
          target: "mleko",
          translation: "I am drinking milk.",
          topics: ["Basics"],
          tags: [],
          summary: "Piję mleko",
        },
      ],
    });
    const providerFetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", providerFetch);

    const test = await localSend<{ ok: boolean; message: string }>("/api/provider/test", "POST");
    expect(test.ok).toBe(true);

    const prepared = await localSend<{ requestId: string; prompt: string }>("/api/provider/prepare", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "basics" },
      count: 1,
    });
    expect(prepared.prompt.length).toBeGreaterThan(0);

    const generated = await localSend<{ cards: Card[] }>("/api/provider/generate", "POST", {
      requestId: prepared.requestId,
    });
    expect(generated.cards).toHaveLength(1);
    expect(generated.cards[0].deckId).toBe("basics");
    expect(generated.cards[0].origin.kind).toBe("generated");

    const card = (await localGet<{ cards: Card[] }>("/api/cards")).cards.find((entry) => entry.origin.kind === "generated");
    if (!card) throw new Error("no generated card");
    const hint = await localSend<{ text: string | null; source: string }>("/api/provider/hint", "POST", {
      cardId: card.id,
      approved: true,
    });
    expect(hint.source).toBe("tutor");
    expect(hint.text).toBeTruthy();

    const log = await localGet<{ entries: Array<{ kind: string }> }>("/api/prompts?limit=10");
    expect(log.entries.map((entry) => entry.kind)).toEqual(["hint", "generation"]);
  });

  it("generates a whole pack and suffixes a generated name collision", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "test-model" },
    });
    await localSend("/api/provider/key", "POST", { key: "secret" });
    const reply = JSON.stringify({
      pack: { name: "starter", version: "1.0.0", language: "pl" },
      decks: [{ id: "basics", name: "Basics" }],
      lines: [{ deckId: "basics", fullLine: "Piję kawę.", target: "kawę" }],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const prepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "pack" },
      count: 1,
    });
    const generated = await localSend<{
      kind: string;
      packName: string;
      count: number;
      cards: Card[];
      pack: { decks: Array<{ id: string }> };
    }>("/api/provider/generate", "POST", { requestId: prepared.requestId });
    expect(generated.kind).toBe("pack");
    expect(generated.packName).toBe("starter-2");
    expect(generated.count).toBe(1);
    expect(generated.cards[0].origin.kind).toBe("generated");
    expect(generated.pack.decks).toContainEqual({ id: "basics", name: "Basics" });
  });

  it("generates one deck with a paired id and label suffix", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "test-model" },
    });
    await localSend("/api/provider/key", "POST", { key: "secret" });
    const reply = JSON.stringify({
      deck: { id: "basics", name: "Basics" },
      lines: [{ fullLine: "Piję kawę.", target: "kawę" }],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const prepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "deck", packName: "starter" },
      count: 1,
    });
    const generated = await localSend<{
      kind: string;
      packName: string;
      deckId: string;
      count: number;
      pack: { decks: Array<{ id: string; name: string }> };
    }>("/api/provider/generate", "POST", { requestId: prepared.requestId });
    expect(generated.kind).toBe("deck");
    expect(generated.packName).toBe("starter");
    expect(generated.deckId).toBe("basics-2");
    expect(generated.count).toBe(1);
    expect(generated.pack.decks).toContainEqual({ id: "basics-2", name: "Basics 2" });
  });

  it("reports a test failure when no provider is set up", async () => {
    const test = await localSend<{ ok: boolean; message: string }>("/api/provider/test", "POST");
    expect(test.ok).toBe(false);
    expect(test.message).toContain("No provider");
  });

  it("refuses provider calls whose pack, deck or prepared prompt is gone", async () => {
    await expect(localSend("/api/provider/prepare", "POST", {})).rejects.toThrow("Choose Pack, Deck or Cards");
    await expect(
      localSend("/api/provider/prepare", "POST", { target: { kind: "cards", packName: "starter" } }),
    ).rejects.toThrow("Choose the pack and deck");
    await expect(
      localSend("/api/provider/prepare", "POST", { target: { kind: "deck", packName: "starter" } }),
    ).rejects.toThrow("not here");
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await expect(
      localSend("/api/provider/prepare", "POST", {
        target: { kind: "cards", packName: "starter", deckId: "nope" },
      }),
    ).rejects.toThrow("not in");
    await expect(
      localSend("/api/provider/generate", "POST", { requestId: "expired" }),
    ).rejects.toThrow("expired");
  });

  it("saves nothing when the provider's batch is unusable, but logs the prompt", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "test-model" },
    });
    await localSend("/api/provider/key", "POST", { key: "secret" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "not json at all" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const prepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "basics" },
      count: 1,
    });
    await expect(
      localSend("/api/provider/generate", "POST", { requestId: prepared.requestId }),
    ).rejects.toThrow("Nothing was saved");

    expect((await localGet<{ cards: Card[] }>("/api/cards")).cards).toHaveLength(1);
    const log = await localGet<{ entries: Array<{ kind: string }> }>("/api/prompts?limit=10");
    expect(log.entries[0].kind).toBe("generation");
  });

  it("explains a provider failure and still offers the pack hint", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "test-model" },
    });
    await localSend("/api/provider/key", "POST", { key: "secret" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "nope" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const card = (await localGet<{ cards: Card[] }>("/api/cards")).cards[0];
    const hint = await localSend<{
      text: string | null;
      source: string;
      providerMessage: string | null;
    }>("/api/provider/hint", "POST", { cardId: card.id, approved: true });
    expect(hint.source).toBe("pack");
    expect(hint.providerMessage).toContain("problem");
  });

  it("names a missing key instead of hiding the provider setup", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "test-model" },
    });
    const card = (await localGet<{ cards: Card[] }>("/api/cards")).cards[0];
    const hint = await localSend<{ source: string; providerMessage: string | null }>("/api/provider/hint", "POST", {
      cardId: card.id,
      approved: true,
    });
    expect(hint.source).toBe("pack");
    expect(hint.providerMessage).toContain("no key");
  });

  it("says no hint exists when the card has none", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const created = await localSend<{ card: Card }>("/api/cards", "POST", {
      front: "Mam kota",
      back: "I have a cat",
      packName: "starter",
      deckId: "basics",
    });
    const hint = await localSend<{ text: string | null; source: string; providerMessage: string }>(
      "/api/provider/hint",
      "POST",
      { cardId: created.card.id, approved: false },
    );
    expect(hint).toMatchObject({ text: null, source: "none" });
    expect(hint.providerMessage).toContain("No hint");
    await expect(
      localSend("/api/provider/hint", "POST", { cardId: "missing", approved: false }),
    ).rejects.toThrow("not in the deck");
  });

  it("builds prompts for a new pack, a new deck and existing cards", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const pack = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "pack" },
    });
    expect(pack.prompt).toContain("new pack");
    const deck = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "deck", packName: "starter" },
    });
    expect(deck.prompt).toContain("starter");
    expect(deck.prompt).toContain("new deck");
    const cards = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "cases" },
    });
    expect(cards.prompt).toContain("Cases");
    await expect(localSend("/api/authoring/prompt", "POST", {})).rejects.toThrow("Choose what");
    await expect(
      localSend("/api/authoring/prompt", "POST", { target: { kind: "other" } }),
    ).rejects.toThrow("Choose Pack, Deck or Cards");
  });

  it("refuses broken JSON and a deck named without its pack", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    await expect(
      localSend("/api/cards/import", "POST", { json: "[", packName: "starter", deckId: "basics" }),
    ).rejects.toThrow("Nothing was imported");

    await expect(
      localSend("/api/cards/import", "POST", {
        json: JSON.stringify([{ front: "Do widzenia", back: "Goodbye" }]),
        deckId: "basics",
      }),
    ).rejects.toThrow("Choose the pack and deck");
    await expect(
      localSend("/api/cards", "POST", { front: "Tak", back: "Yes", deckId: "basics" }),
    ).rejects.toThrow("Choose the pack and deck");
  });

  it("still gives a pack hint when no provider is set up", async () => {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
    const card = (await localGet<{ cards: Card[] }>("/api/cards")).cards[0];
    const hint = await localSend<{ text: string | null; source: string }>("/api/provider/hint", "POST", {
      cardId: card.id,
      approved: true,
    });
    expect(hint.source).toBe("pack");
    expect(hint.text).toBe("Accusative.");
  });
});

describe("creation brief through the router", () => {
  /** Import the starter pack so every target has a real parent. */
  async function seedStarter(): Promise<void> {
    await localSend("/api/packs/import", "POST", { json: packBundle(), target: { kind: "pack" } });
  }

  /** Turn a provider on and store a key, without making a real network call. */
  async function seedProvider(): Promise<void> {
    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "test-model" },
    });
    await localSend("/api/provider/key", "POST", { key: "secret" });
  }

  /** Answer the next provider call with one JSON object. */
  function providerReply(content: unknown): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  }

  /** A learner-written brief with the fields the screen sends. */
  function learnerBrief(overrides: Record<string, unknown> = {}) {
    return {
      subjectMode: "learner",
      subject: "ordering coffee",
      deckFocus: "cafes, paying",
      cardStyle: "mixed",
      packName: "",
      deckName: "",
      ...overrides,
    };
  }

  it("puts a learner brief and the library into all three Chat prompts", async () => {
    await seedStarter();
    for (const target of [
      { kind: "pack" },
      { kind: "deck", packName: "starter" },
      { kind: "cards", packName: "starter", deckId: "cases" },
    ]) {
      const result = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
        target,
        brief: learnerBrief(),
      });
      expect(result.prompt).toContain("ordering coffee");
      expect(result.prompt).toContain("cafes, paying");
      expect(result.prompt).toContain("starter");
      expect(result.prompt).toContain("Basics");
      expect(result.prompt).toContain("Cases");
    }
  });

  it("lets the provider choose from the library in Generate and Chat", async () => {
    await seedStarter();
    const providerBrief = {
      subjectMode: "provider",
      subject: "this must not reach a prompt",
      deckFocus: "",
      cardStyle: "mixed",
      packName: "",
      deckName: "",
    };
    const prepared = await localSend<{ prompt: string }>("/api/provider/prepare", "POST", {
      target: { kind: "pack" },
      count: 2,
      brief: providerBrief,
    });
    expect(prepared.prompt).toMatch(/gap/i);
    expect(prepared.prompt).toContain("starter");
    expect(prepared.prompt).toContain("Basics");
    expect(prepared.prompt).not.toContain("this must not reach a prompt");

    const chat = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "pack" },
      brief: providerBrief,
    });
    expect(chat.prompt).toMatch(/gap/i);
    expect(chat.prompt).toContain("starter");
    expect(chat.prompt).not.toContain("this must not reach a prompt");
  });

  it("refuses a learner brief with no subject and an unknown style", async () => {
    await seedStarter();
    await expect(
      localSend("/api/provider/prepare", "POST", {
        target: { kind: "pack" },
        brief: learnerBrief({ subject: "  " }),
      }),
    ).rejects.toThrow(/subject/i);
    await expect(
      localSend("/api/authoring/prompt", "POST", {
        target: { kind: "pack" },
        brief: learnerBrief({ subject: "  " }),
      }),
    ).rejects.toThrow(/subject/i);
    await expect(
      localSend("/api/provider/prepare", "POST", {
        target: { kind: "pack" },
        brief: learnerBrief({ cardStyle: "picks" }),
      }),
    ).rejects.toThrow(/style/i);
  });

  it("refuses a batch that ignores the requested style and saves nothing", async () => {
    await seedStarter();
    await seedProvider();
    providerReply({
      lines: [
        {
          style: "type",
          fullLine: "Piję kawę.",
          target: "kawę",
          translation: "I am drinking coffee.",
        },
      ],
    });
    const prepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "cases" },
      count: 1,
      brief: learnerBrief({ cardStyle: "cloze" }),
    });
    await expect(
      localSend("/api/provider/generate", "POST", { requestId: prepared.requestId }),
    ).rejects.toThrow(/cloze/i);
    expect((await localGet<{ cards: Card[] }>("/api/cards")).cards).toHaveLength(1);
  });

  it("builds a type card and a hear_type card from a requested style", async () => {
    await seedStarter();
    await seedProvider();

    providerReply({
      lines: [
        {
          style: "type",
          fullLine: "Piję kawę.",
          target: "kawę",
          translation: "I am drinking coffee.",
        },
      ],
    });
    const typePrepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "cases" },
      count: 1,
      brief: learnerBrief({ cardStyle: "type" }),
    });
    const typed = await localSend<{ cards: Card[] }>("/api/provider/generate", "POST", {
      requestId: typePrepared.requestId,
    });
    expect(typed.cards[0].answerDef).toEqual({ mode: "type", expected: ["Piję kawę."] });
    expect(typed.cards[0].prompt).toEqual([{ type: "text", text: "I am drinking coffee." }]);

    providerReply({
      lines: [{ style: "hear_type", fullLine: "Mam kota.", target: "kota" }],
    });
    const hearPrepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "cases" },
      count: 1,
      brief: learnerBrief({ cardStyle: "hear_type" }),
    });
    const heard = await localSend<{ cards: Card[] }>("/api/provider/generate", "POST", {
      requestId: hearPrepared.requestId,
    });
    expect(heard.cards[0].answerDef).toEqual({ mode: "hear_type", expected: ["Mam kota."] });
    expect(heard.cards[0].prompt).toEqual([
      { type: "speak", text: "Mam kota.", lang: "pl", label: "Listen" },
    ]);
  });
});

describe("background job routes", () => {
  async function preparedRequest(): Promise<string> {
    const prepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "pack" },
      count: 1,
    });
    return prepared.requestId;
  }

  it("enqueues a generation job and returns a payload-free view", async () => {
    const requestId = await preparedRequest();
    const created = await localSend<{ job: JobView }>("/api/jobs", "POST", {
      kind: "generation",
      requestId,
    });
    expect(created.job.status).toBe("queued");
    expect(created.job.kind).toBe("generation");
    expect(created.job.maxAttempts).toBe(4);
    expect("payload" in created.job).toBe(false);

    const listed = await localGet<{ jobs: JobView[] }>("/api/jobs");
    expect(listed.jobs).toHaveLength(1);
    expect(listed.jobs[0].id).toBe(created.job.id);
    expect("payload" in listed.jobs[0]).toBe(false);
  });

  it("refuses a prepared request twice", async () => {
    const requestId = await preparedRequest();
    await localSend("/api/jobs", "POST", { kind: "generation", requestId });
    await expect(localSend("/api/jobs", "POST", { kind: "generation", requestId })).rejects.toThrow(
      "expired",
    );
    expect((await localGet<{ jobs: JobView[] }>("/api/jobs")).jobs).toHaveLength(1);
  });

  it("enqueues an import without writing it yet", async () => {
    const created = await localSend<{ job: JobView }>("/api/jobs", "POST", {
      kind: "import",
      text: packBundle(),
      target: { kind: "pack" },
      source: "import",
    });
    expect(created.job.kind).toBe("import");
    expect(created.job.title).toBe("Import pack");
    expect(created.job.maxAttempts).toBe(1);
    expect((await localGet<{ packs: unknown[] }>("/api/packs")).packs).toHaveLength(0);
  });

  it("rejects an empty or badly targeted import before enqueueing", async () => {
    await expect(
      localSend("/api/jobs", "POST", { kind: "import", text: "  ", target: { kind: "pack" } }),
    ).rejects.toThrow("Paste the bundle");
    await expect(
      localSend("/api/jobs", "POST", {
        kind: "import",
        text: packBundle(),
        target: { kind: "nope" },
      }),
    ).rejects.toThrow("Choose Pack");
    expect((await localGet<{ jobs: JobView[] }>("/api/jobs")).jobs).toHaveLength(0);
  });

  it("retries a failed job with a fresh budget and dismisses a finished one", async () => {
    const created = await localSend<{ job: JobView }>("/api/jobs", "POST", {
      kind: "import",
      text: packBundle(),
      target: { kind: "pack" },
    });
    const [stored] = await store.all<BrowserJob>("jobs");
    await store.put("jobs", {
      ...stored,
      status: "failed",
      lastError: "boom",
      updatedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
    await expect(localSend(`/api/jobs/${created.job.id}/retry`, "POST")).resolves.toMatchObject({
      job: { status: "queued", attempts: 0 },
    });
    const retried = await localGet<{ jobs: JobView[] }>("/api/jobs");
    const fresh = retried.jobs[0];
    expect(fresh.id).not.toBe(created.job.id);

    const [queued] = await store.all<BrowserJob>("jobs");
    await store.put("jobs", {
      ...queued,
      status: "failed",
      lastError: "boom",
      updatedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
    await expect(localSend(`/api/jobs/${fresh.id}`, "DELETE")).resolves.toMatchObject({
      dismissed: true,
    });
    expect((await localGet<{ jobs: JobView[] }>("/api/jobs")).jobs).toHaveLength(0);
  });

  it("marks an active job interrupted when a backup is restored", async () => {
    const requestId = await preparedRequest();
    const created = await localSend<{ job: JobView }>("/api/jobs", "POST", {
      kind: "generation",
      requestId,
    });
    const [stored] = await store.all<BrowserJob>("jobs");
    await store.put("jobs", { ...stored, status: "running" });

    const backup = await localGet<{ json: string }>("/api/backup/export");
    await localSend("/api/backup/restore", "POST", { json: backup.json });

    const [job] = (await localGet<{ jobs: JobView[] }>("/api/jobs")).jobs;
    expect(job.id).toBe(created.job.id);
    expect(job.status).toBe("failed");
    expect(job.lastError).toBe("The library was restored.");
  });

  it("keeps a running job when the backup is refused", async () => {
    const requestId = await preparedRequest();
    const created = await localSend<{ job: JobView }>("/api/jobs", "POST", {
      kind: "generation",
      requestId,
    });
    const [stored] = await store.all<BrowserJob>("jobs");
    await store.put("jobs", { ...stored, status: "running" });

    await expect(
      localSend("/api/backup/restore", "POST", { json: JSON.stringify({ schema: "nope" }) }),
    ).rejects.toThrow("Nothing was restored");
    const [job] = (await localGet<{ jobs: JobView[] }>("/api/jobs")).jobs;
    expect(job.id).toBe(created.job.id);
    expect(job.status).toBe("running");
  });

  it("will not dismiss a running job", async () => {
    const requestId = await preparedRequest();
    const created = await localSend<{ job: JobView }>("/api/jobs", "POST", {
      kind: "generation",
      requestId,
    });
    const [stored] = await store.all<BrowserJob>("jobs");
    await store.put("jobs", { ...stored, status: "running" });
    await expect(localSend(`/api/jobs/${created.job.id}`, "DELETE")).rejects.toThrow(
      "cannot be dismissed",
    );
  });
});
