// WHY: One bundle is create, import and export. These tests pin the promises a
// learner was given: whole-file refusal, three targets, additive updates, no
// deletes on import, and a backup that never carries the key.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import {
  ensureSeeded,
  exportBackup,
  exportPackBundle,
  importBundle,
  parseBundle,
  restoreBackup,
  PACK_BUNDLE_SCHEMA,
} from "@/lib/browser/bundle";
import {
  readCards,
  readMeta,
  readPack,
  readPacks,
  readProviderKey,
  readSettings,
  writeMeta,
  writePack,
  writeProviderKey,
  type BrowserPack,
} from "@/lib/browser/repository";

const now = "2026-10-20T10:00:00.000Z";

function source(summary: string) {
  return {
    summary,
    prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
    answer: [{ type: "text", text: "Piję kawę." }],
    answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
    hints: ["Accusative."],
    fullLine: "Piję kawę.",
  };
}

function bundle(version = "1.0.0", extra = false, name = "starter") {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name, version, language: "pl" },
    decks: [{ id: "basics", name: "Basics" }],
    cards: [
      { ...source("Piję kawę"), deckId: "basics" },
      ...(extra ? [{ ...source("Piję mleko"), deckId: "basics" }] : []),
    ],
  });
}

function deckFragment(decks: Array<{ id: string; name: string }>, cards: unknown[] = []): string {
  return JSON.stringify({ decks, cards });
}

function cardsFragment(cards: unknown[]): string {
  return JSON.stringify({ cards });
}

function packRecord(name = "starter", version = "1.0.0", decks = [{ id: "basics", name: "Basics" }]): BrowserPack {
  return { id: name, name, version, decks, prompts: null, createdAt: now, updatedAt: now };
}

let store: Store;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
});

describe("parseBundle", () => {
  it("names invalid JSON instead of throwing", () => {
    const result = parseBundle("{");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("(bundle)");
  });

  it("refuses a bundle that is missing its schema", () => {
    const result = parseBundle(JSON.stringify({ pack: { name: "x", version: "1" }, decks: [], cards: [] }));
    expect(result.ok).toBe(false);
  });
});

describe("importBundle", () => {
  it("creates a whole pack with decks and cards", async () => {
    const result = await importBundle(bundle(), { kind: "pack" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe("pack");
    expect(result.cardsAdded).toBe(1);
    expect(result.decksAdded).toBe(1);
    const pack = await readPack("starter", store);
    expect(pack?.decks).toEqual([{ id: "basics", name: "Basics" }]);
    const cards = await readCards(store);
    expect(cards[0].deckId).toBe("basics");
    expect(cards[0].topics).toEqual(["Basics"]);
    expect(cards[0].origin.kind).toBe("pack");
  });

  it("reports an exact repeat as a duplicate and adds nothing", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const again = await importBundle(bundle(), { kind: "pack" });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.cardsAdded).toBe(0);
      expect(again.duplicates).toBe(1);
    }
    expect(await readCards(store)).toHaveLength(1);
  });

  it("adds a newer version without deleting or renaming anything", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const newer = await importBundle(bundle("1.1.0", true), { kind: "pack" });
    expect(newer.ok).toBe(true);
    if (newer.ok) expect(newer.cardsAdded).toBe(1);
    expect(await readCards(store)).toHaveLength(2);
    expect((await readPack("starter", store))?.version).toBe("1.1.0");
  });

  it("refuses an older version and changes nothing", async () => {
    await importBundle(bundle("2.0.0"), { kind: "pack" });
    const older = await importBundle(bundle("1.0.0"), { kind: "pack" });
    expect(older.ok).toBe(false);
    if (!older.ok) expect(older.issues[0].field).toBe("pack.version");
    expect(await readCards(store)).toHaveLength(1);
  });

  it("adds a cards fragment to one chosen deck with an imported origin", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(cardsFragment([{ ...source("Nowa karta"), deckId: "basics" }]), {
      kind: "cards",
      packName: "starter",
      deckId: "basics",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("cards");
    const imported = (await readCards(store)).find((card) => card.summary === "Nowa karta");
    expect(imported?.origin).toMatchObject({ kind: "imported", note: "Imported by the learner." });
  });

  it("adds a deck fragment and its cards to an existing pack", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(deckFragment([{ id: "cases", name: "Cases" }], [source("Nowa karta")]), {
      kind: "deck",
      packName: "starter",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe("deck");
    expect(result.decksAdded).toBe(1);
    expect(result.deckIds).toEqual(["cases"]);
    const pack = await readPack("starter", store);
    expect(pack?.decks).toContainEqual({ id: "cases", name: "Cases" });
    const card = (await readCards(store)).find((entry) => entry.summary === "Nowa karta");
    expect(card?.deckId).toBe("cases");
    expect(card?.topics).toEqual(["Cases"]);
  });

  it("refuses a deck fragment that carries a pack header", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(bundle(), { kind: "deck", packName: "starter" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("(bundle)");
  });

  it("refuses a cards fragment that tries to add a deck", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(deckFragment([{ id: "cases", name: "Cases" }]), {
      kind: "cards",
      packName: "starter",
      deckId: "basics",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("(bundle)");
  });

  it("refuses the whole file when one card is broken", async () => {
    const broken = JSON.parse(bundle()) as { cards: Array<Record<string, unknown>> };
    broken.cards.push({ summary: "no prompt", answer: source("x").answer, answerDef: source("x").answerDef });
    const result = await importBundle(JSON.stringify(broken), { kind: "pack" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].index).toBe(1);
    expect(await readCards(store)).toHaveLength(0);
    expect(await readPacks(store)).toHaveLength(0);
  });

  it("refuses a new pack with no decks", async () => {
    const empty = JSON.stringify({
      schema: PACK_BUNDLE_SCHEMA,
      pack: { name: "empty", version: "1.0.0" },
      decks: [],
      cards: [],
    });
    const result = await importBundle(empty, { kind: "pack" });
    expect(result.ok).toBe(false);
  });

  it("suffixes a generated pack name on a collision", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(bundle("1.0.0"), { kind: "pack" }, { namePolicy: "auto-suffix" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.packName).toBe("starter-2");
    expect(await readPack("starter-2", store)).toBeTruthy();
  });

  it("suffixes a generated deck id and label on a collision", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(deckFragment([{ id: "basics", name: "Basics" }]), {
      kind: "deck",
      packName: "starter",
    }, { namePolicy: "auto-suffix" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.deckIds).toEqual(["basics-2"]);
    const pack = await readPack("starter", store);
    expect(pack?.decks).toContainEqual({ id: "basics-2", name: "Basics 2" });
  });

  it("refuses a duplicate deck id when names are strict", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(deckFragment([{ id: "basics", name: "Basics" }]), {
      kind: "deck",
      packName: "starter",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("decks.0.id");
  });

  it("refuses an older version on a pack target", async () => {
    await importBundle(bundle("2.0.0"), { kind: "pack" });
    const result = await importBundle(bundle("1.0.0"), { kind: "pack" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("pack.version");
  });

  it("keeps the installed deck name and metadata when the file uses the same id", async () => {
    await importBundle(JSON.stringify({
      schema: PACK_BUNDLE_SCHEMA,
      pack: { name: "starter", version: "1.0.0", description: "Old words", language: "pl" },
      decks: [{ id: "basics", name: "Basics" }],
      cards: [],
    }), { kind: "pack" });

    const result = await importBundle(JSON.stringify({
      schema: PACK_BUNDLE_SCHEMA,
      pack: { name: "starter", version: "2.0.0", description: "New words", language: "en" },
      decks: [{ id: "basics", name: "Renamed by the file" }],
      cards: [{ ...source("Nowa karta"), deckId: "basics" }],
    }), { kind: "pack" });

    expect(result.ok).toBe(true);
    const pack = await readPack("starter", store);
    expect(pack?.decks).toEqual([{ id: "basics", name: "Basics" }]);
    expect(pack?.description).toBe("New words");
  });

  it("counts a repeated card inside one file as a duplicate, not two cards", async () => {
    const twice = JSON.parse(bundle()) as { cards: Array<Record<string, unknown>> };
    twice.cards.push({ ...twice.cards[0] });
    const result = await importBundle(JSON.stringify(twice), { kind: "pack" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cardsAdded).toBe(1);
      expect(result.duplicates).toBe(1);
    }
    expect(await readCards(store)).toHaveLength(1);
  });

  it("refuses a card that points at a deck outside the pack", async () => {
    const wrong = JSON.parse(bundle()) as { cards: Array<Record<string, unknown>> };
    wrong.cards[0].deckId = "missing";
    const result = await importBundle(JSON.stringify(wrong), { kind: "pack" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("cards.deckId");
  });

  it("refuses a deck fragment card that names another deck", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(deckFragment([{ id: "cases", name: "Cases" }], [
      { ...source("Nowa karta"), deckId: "basics" },
    ]), { kind: "deck", packName: "starter" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("cards.deckId");
  });

  it("refuses a cards fragment card aimed at another deck", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(cardsFragment([
      { ...source("Nowa karta"), deckId: "cases" },
    ]), { kind: "cards", packName: "starter", deckId: "basics" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("cards.deckId");
  });

  it("refuses a deck target when the pack is gone", async () => {
    const result = await importBundle(deckFragment([{ id: "cases", name: "Cases" }]), {
      kind: "deck",
      packName: "gone",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("packName");
  });

  it("refuses a cards target when the deck is gone", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const result = await importBundle(cardsFragment([{ ...source("Nowa karta"), deckId: "gone" }]), {
      kind: "cards",
      packName: "starter",
      deckId: "gone",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toBe("deckId");
  });
});

describe("export and backup", () => {
  it("exports one pack without evidence", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const exported = await exportPackBundle("starter");
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      const parsed = JSON.parse(exported.json) as Record<string, unknown>;
      expect(parsed.schema).toBe(PACK_BUNDLE_SCHEMA);
      expect((parsed.cards as unknown[]).length).toBe(1);
      expect(parsed.evidence).toBeUndefined();
    }
    expect((await exportPackBundle("gone")).ok).toBe(false);
  });

  it("exports a backup without the provider key", async () => {
    await importBundle(bundle(), { kind: "pack" });
    await writeProviderKey("secret", store);
    const text = await exportBackup();
    expect(text).not.toContain("secret");
    expect(JSON.parse(text).schema).toBe("flashcards.backup/v1");
  });

  it("restores a backup and keeps the key that was already here", async () => {
    await importBundle(bundle(), { kind: "pack" });
    await writeProviderKey("secret", store);
    const text = await exportBackup();

    await writeProviderKey("kept", store);
    const result = await restoreBackup(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cards).toBe(1);
    expect(await readProviderKey(store)).toBe("kept");
    expect(await readCards(store)).toHaveLength(1);
  });

  it("refuses a malformed backup and changes nothing", async () => {
    await writeProviderKey("secret", store);
    const result = await restoreBackup("{not json");
    expect(result.ok).toBe(false);
    expect(await readSettings(store)).toBeTruthy();
    expect(await readProviderKey(store)).toBe("secret");
  });

  it("refuses a backup whose evidence rows have the wrong shape and changes nothing", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const text = await exportBackup();
    const backup = JSON.parse(text) as { evidence: unknown[] };
    backup.evidence.push({ id: "row", cardId: "card", attemptId: "try", outcome: "perfect" });
    const result = await restoreBackup(JSON.stringify(backup));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].field).toContain("evidence");
    expect(await readCards(store)).toHaveLength(1);
  });

  it("restores a keyless backup and leaves the key store empty", async () => {
    await importBundle(bundle(), { kind: "pack" });
    const text = await exportBackup();
    const result = await restoreBackup(text);
    expect(result.ok).toBe(true);
    expect(await readProviderKey(store)).toBe("");
  });
});

describe("ensureSeeded", () => {
  it("fetches the starter once and remembers it", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(bundle(), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await ensureSeeded();
    expect(await readMeta("seeded", store)).toBe("yes");
    expect(await readCards(store)).toHaveLength(1);

    await ensureSeeded();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when the library already has a pack", async () => {
    await writePack(packRecord(), store);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await ensureSeeded();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await readMeta("seeded", store)).toBe("yes");
  });

  it("does not fetch after a previous seed marker", async () => {
    await writeMeta("seeded", "yes", store);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await ensureSeeded();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("silently survives a missing seed asset", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await ensureSeeded();
    expect(await readMeta("seeded", store)).toBeNull();
  });
});
