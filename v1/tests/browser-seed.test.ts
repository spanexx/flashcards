// WHY: The seed manifest is how a new lesson reaches a learner who already has
// a library, without ever undoing a deliberate removal. These tests pin the
// install, update, dismissal and deleted-card promises with no network.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { PACK_BUNDLE_SCHEMA, importBundle } from "@/lib/browser/bundle";
import {
  SEED_INDEX_SCHEMA,
  deleteBuiltInCard,
  dismissPack,
  ensureSeeded,
  seedState,
} from "@/lib/browser/seed";
import {
  deleteCard,
  readCards,
  readEvidence,
  readPack,
  readTombstones,
  writeCard,
} from "@/lib/browser/repository";
import { withBasePath } from "@/lib/shared/paths";
import type { Card } from "@/lib/shared/types";

const now = "2026-10-25T10:00:00.000Z";
// The manifest lists the logical path; the browser fetch sees it behind the
// deploy base path, so the stub must answer the same address the seed requests.
const starterFile = "/packs/starter.json";
const starterUrl = withBasePath(starterFile);
const indexUrl = withBasePath("/packs/index.json");

let store: Store;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
});

/** A one-card pack whose teaching line can change without changing identity. */
function seedBundle(version = "1.0.0", teaching = "A short teaching line.", summary = "Piję kawę"): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name: "starter", version, language: "pl" },
    decks: [{ id: "basics", name: "Basics", level: "beginner" }],
    cards: [
      {
        deckId: "basics",
        summary,
        prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: summary }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
        hints: ["Accusative."],
        fullLine: summary,
        teaching: [{ type: "text", text: teaching }],
      },
    ],
  });
}

function manifest(version = "1.0.0") {
  return {
    schema: SEED_INDEX_SCHEMA,
    packs: [{ name: "starter", version, file: starterFile }],
  };
}

/** Answer the manifest and any named pack file; anything else is a 404. */
function stubSeed(index: { status: number; body?: string }, files: Record<string, string | number> = {}) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/packs/index.json")) {
      return new Response(index.body ?? "", { status: index.status });
    }
    const file = files[url];
    if (typeof file === "string") return new Response(file, { status: 200 });
    if (typeof file === "number") return new Response("", { status: file });
    return new Response("", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function learnerCard(): Card {
  return {
    id: "card:learner",
    topics: ["Basics"],
    tags: [],
    summary: "My own card",
    prompt: [{ type: "text", text: "kot" }],
    answer: [{ type: "text", text: "cat" }],
    answerDef: { mode: "type", expected: ["cat"] },
    origin: { kind: "learner", note: "Written by the learner." },
    createdAt: now,
  };
}

describe("ensureSeeded", () => {
  it("installs a listed pack on a library that does not have it", async () => {
    stubSeed({ status: 200, body: JSON.stringify(manifest()) }, { [starterUrl]: seedBundle() });

    await ensureSeeded();

    const pack = await readPack("starter", store);
    expect(pack?.version).toBe("1.0.0");
    expect(pack?.decks).toEqual([{ id: "basics", name: "Basics", level: "beginner" }]);
    const cards = await readCards(store);
    expect(cards).toHaveLength(1);
    expect(cards[0].teaching).toEqual([{ type: "text", text: "A short teaching line." }]);
  });

  it("applies a newer version in place and keeps evidence attached", async () => {
    await importBundle(seedBundle("1.0.0"), { kind: "pack" });
    const [before] = await readCards(store);
    await store.put("evidence", {
      id: "row-1",
      cardId: before.id,
      attemptId: "try-1",
      region: null,
      outcome: "perfect",
      timeMs: 900,
      seenBefore: 0,
      at: now,
      kind: "answer",
    });
    stubSeed({ status: 200, body: JSON.stringify(manifest("1.1.0")) }, {
      [starterUrl]: seedBundle("1.1.0", "A corrected teaching line."),
    });

    await ensureSeeded();

    expect((await readPack("starter", store))?.version).toBe("1.1.0");
    const [after] = await readCards(store);
    expect(after.id).toBe(before.id);
    expect(after.teaching).toEqual([{ type: "text", text: "A corrected teaching line." }]);
    expect(await readEvidence(store)).toHaveLength(1);
  });

  it("does nothing for an equal or older version", async () => {
    await importBundle(seedBundle("1.1.0"), { kind: "pack" });
    for (const version of ["1.1.0", "0.9.0"]) {
      const { calls } = stubSeed({ status: 200, body: JSON.stringify(manifest(version)) }, {
        [starterUrl]: seedBundle(version, "Must not arrive."),
      });
      await ensureSeeded();
      expect(calls).toEqual([indexUrl]);
    }
    const [card] = await readCards(store);
    expect(card.teaching).toEqual([{ type: "text", text: "A short teaching line." }]);
  });

  it("leaves a dismissed pack out", async () => {
    await dismissPack("starter");
    const { calls } = stubSeed({ status: 200, body: JSON.stringify(manifest()) }, {
      [starterUrl]: seedBundle(),
    });

    await ensureSeeded();

    expect(await readPack("starter", store)).toBeNull();
    expect(calls).toEqual([indexUrl]);
    expect((await readTombstones(store)).map((row) => row.id)).toContain("starter");
  });

  it("keeps a deleted built-in card deleted while its words are unchanged", async () => {
    await importBundle(seedBundle("1.0.0"), { kind: "pack" });
    const [card] = await readCards(store);
    await deleteCard(card.id, store);
    await deleteBuiltInCard(card);
    stubSeed({ status: 200, body: JSON.stringify(manifest("1.1.0")) }, {
      [starterUrl]: seedBundle("1.1.0", "A corrected teaching line."),
    });

    await ensureSeeded();

    expect(await readCards(store)).toHaveLength(0);
    expect((await readPack("starter", store))?.version).toBe("1.1.0");
  });

  it("brings a deleted card back when its words change", async () => {
    await importBundle(seedBundle("1.0.0"), { kind: "pack" });
    const [card] = await readCards(store);
    await deleteCard(card.id, store);
    await deleteBuiltInCard(card);
    stubSeed({ status: 200, body: JSON.stringify(manifest("1.1.0")) }, {
      [starterUrl]: seedBundle("1.1.0", "A short teaching line.", "Piję mleko"),
    });

    await ensureSeeded();

    const cards = await readCards(store);
    expect(cards).toHaveLength(1);
    expect(cards[0].id).not.toBe(card.id);
    expect(cards[0].summary).toBe("Piję mleko");
  });

  it("stays silent after a failure and succeeds on the next start", async () => {
    stubSeed({ status: 500 });
    await ensureSeeded();
    expect(await readPack("starter", store)).toBeNull();

    stubSeed({ status: 200, body: JSON.stringify(manifest()) }, { [starterUrl]: seedBundle() });
    await ensureSeeded();
    expect((await readPack("starter", store))?.version).toBe("1.0.0");
  });

  it("ignores a manifest with the wrong shape", async () => {
    const { calls } = stubSeed({ status: 200, body: JSON.stringify({ schema: "other", packs: [] }) });
    await ensureSeeded();
    expect(calls).toEqual([indexUrl]);
    expect(await readPack("starter", store)).toBeNull();
  });

  it("does not remember a deleted learner card as a built-in removal", async () => {
    const card = learnerCard();
    await writeCard(card, store);
    await deleteBuiltInCard(card);
    expect(await readTombstones(store)).toHaveLength(0);
  });
});

describe("seedState", () => {
  it("reports install, update, dismissed and unchanged without writing", async () => {
    await importBundle(seedBundle("1.0.0"), { kind: "pack" });
    await dismissPack("gone");
    const index = {
      schema: SEED_INDEX_SCHEMA,
      packs: [
        { name: "starter", version: "1.1.0", file: starterFile },
        { name: "fresh", version: "1.0.0", file: "/packs/fresh.json" },
        { name: "gone", version: "2.0.0", file: "/packs/gone.json" },
      ],
    };
    stubSeed({ status: 200, body: JSON.stringify(index) });

    const states = await seedState();

    expect(states.map((state) => [state.name, state.action])).toEqual([
      ["starter", "update"],
      ["fresh", "install"],
      ["gone", "none"],
    ]);
    expect((await readPack("starter", store))?.version).toBe("1.0.0");
  });
});
