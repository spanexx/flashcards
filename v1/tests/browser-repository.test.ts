// WHY: The browser repository is the domain vocabulary over IndexedDB. These
// tests hold it to the same promises the old file repository made, using the
// memory adapter so no browser is needed.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import {
  appendEvidence,
  appendPrompt,
  appendSession,
  clearLibrary,
  deleteCardEvidence,
  orphanedPackNames,
  packRecord,
  packStatus,
  patchSettings,
  readCards,
  readEvidence,
  readPack,
  readPacks,
  readPromptLog,
  readProviderKey,
  readSettings,
  recordAlgorithmRun,
  upsertCards,
  writePack,
  writeProviderKey,
  type BrowserPack,
} from "@/lib/browser/repository";
import type { Card, EvidenceRow } from "@/lib/shared/types";

const now = "2026-10-20T10:00:00.000Z";

function pack(name = "starter"): BrowserPack {
  return {
    id: name,
    name,
    version: "1.0.0",
    description: "A starter",
    language: "pl",
    decks: [
      { id: "basics", name: "Basics" },
      { id: "cases", name: "Cases" },
    ],
    prompts: null,
    createdAt: now,
    updatedAt: now,
  };
}

function card(id: string, deckId = "basics"): Card {
  return {
    id,
    packName: "starter",
    deckId,
    topics: [deckId],
    tags: [],
    summary: id,
    prompt: [{ type: "text", text: "Front" }],
    answer: [{ type: "text", text: "Back" }],
    answerDef: { mode: "type", expected: ["Back"] },
    origin: { kind: "learner", note: "Written by the learner." },
    createdAt: now,
  };
}

function row(id: string, cardId: string): EvidenceRow {
  return { id, cardId, attemptId: `a-${id}`, region: null, outcome: "got_it", timeMs: 900, seenBefore: 0, at: now, kind: "answer" };
}

let store: Store;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
});

describe("settings", () => {
  it("starts from defaults and keeps a partial patch", async () => {
    const initial = await readSettings();
    expect(initial.level).toBe("beginner");

    const next = await patchSettings({ learningStyle: "rules-first" }, store);
    expect(next.learningStyle).toBe("rules-first");
    expect(next.level).toBe("beginner");
    expect((await readSettings(store)).learningStyle).toBe("rules-first");
  });

  it("counts a fallback without losing the rest of the settings", async () => {
    const next = await recordAlgorithmRun("fallback", now, store);
    expect(next.algorithm.lastAlgorithm).toBe("fallback");
    expect(next.algorithm.fallbackCount).toBe(1);
    expect(next.algorithm.lastFallbackAt).toBe(now);
  });
});

describe("the provider key", () => {
  it("round-trips in the browser store", async () => {
    expect(await readProviderKey(store)).toBe("");
    await writeProviderKey("secret", store);
    expect(await readProviderKey(store)).toBe("secret");
  });
});

describe("packs and cards", () => {
  it("reads a pack by its exact name and reports its decks", async () => {
    await writePack(pack(), store);
    const found = await readPack("starter", store);
    expect(found?.decks).toHaveLength(2);
    expect((await readPacks(store))[0].name).toBe("starter");
  });

  it("counts only live cards for a pack and names orphaned packs", async () => {
    await writePack(pack(), store);
    await upsertCards([card("one"), { ...card("two"), retired: true }, { ...card("three"), packName: "gone" }], store);
    const status = packStatus(pack(), await readCards(store));
    expect(status.cardCount).toBe(1);
    expect(status.decks?.map((deck) => deck.id)).toEqual(["basics", "cases"]);
    expect(orphanedPackNames(await readCards(store), [pack()])).toEqual(["gone"]);
  });

  it("builds the pure pack record from decks", async () => {
    const record = packRecord(pack());
    expect(record.topics).toEqual(["Basics", "Cases"]);
    expect(record.cards).toEqual([]);
  });
});

describe("the record", () => {
  it("appends evidence and only deletes it when a card is deleted", async () => {
    await appendEvidence([row("one", "c1"), row("two", "c1"), row("three", "c2")], store);
    expect(await readEvidence(store)).toHaveLength(3);
    expect(await deleteCardEvidence("c1", store)).toBe(2);
    expect((await readEvidence(store)).map((entry) => entry.id)).toEqual(["three"]);
  });

  it("keeps session facts", async () => {
    await appendSession({ type: "started", id: "s1", at: now, offered: 10 }, store);
    expect(await store.get("sessions", "s1")).not.toBeNull();
  });

  it("returns the prompt log newest first and capped", async () => {
    await appendPrompt({ at: "2026-10-20T09:00:00.000Z", kind: "hint", requestId: "a", endpoint: null, model: null, prompt: "old" }, store);
    await appendPrompt({ at: "2026-10-20T11:00:00.000Z", kind: "generation", requestId: "b", endpoint: null, model: null, prompt: "new" }, store);
    const entries = await readPromptLog(1, store);
    expect(entries).toHaveLength(1);
    expect(entries[0].prompt).toBe("new");
  });
});

describe("clearLibrary", () => {
  it("removes every store", async () => {
    await writePack(pack(), store);
    await upsertCards([card("one")], store);
    await appendEvidence([row("one", "one")], store);
    await writeProviderKey("secret", store);
    await clearLibrary(store);
    expect(await readPacks(store)).toEqual([]);
    expect(await readCards(store)).toEqual([]);
    expect(await readEvidence(store)).toEqual([]);
    expect(await readProviderKey(store)).toBe("");
  });
});
