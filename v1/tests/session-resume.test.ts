// WHY: A running lesson must survive a reload, but only a snapshot it can
// trust may come back. These tests pin the shape gate, the prune rule, the one
// storage row and the write order that makes "newest wins" true.
// PACK: study-resilience
// 2026-10-26 qoder: created for the study-resilience pack [pack: study-resilience]

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Card, Plan } from "@/lib/shared/types";
import { MemoryStore, STORE_NAMES, setBrowserStore, type StoredValue, type StoreName } from "@/lib/browser/store";
import {
  clearLibrary,
  clearStoredSession,
  readStoredSession,
  upsertCards,
  writeStoredSession,
} from "@/lib/browser/repository";
import {
  cancelSessionSave,
  flushSessionSave,
  loadResumableSession,
  queueSessionSave,
} from "@/lib/browser/session-save";
import {
  parseStoredSession,
  pruneStoredSession,
  toStoredSession,
  type QueueEntry,
  type StoredSession,
  type StoredSessionInput,
} from "@/lib/core/session-resume";

const now = "2026-10-26T10:00:00.000Z";

function card(id: string): Card {
  return {
    id,
    packName: "starter",
    deckId: "basics",
    topics: ["basics"],
    tags: [],
    summary: `Summary ${id}`,
    prompt: [{ type: "text", text: `Prompt ${id}` }],
    answer: [{ type: "text", text: `Answer ${id}` }],
    answerDef: { mode: "type", expected: [`Answer ${id}`] },
    teaching: [{ type: "text", text: `Layer ${id}` }],
    origin: { kind: "pack", note: "A test card." },
    createdAt: now,
  };
}

function entry(id: string): QueueEntry {
  return {
    entryId: `e-${id}`,
    card: card(id),
    coldCheck: false,
    suppressTeaching: false,
    returnKind: null,
  };
}

function plan(cardIds: string[]): Plan {
  return {
    sessionId: "session-1",
    cards: cardIds.map(card),
    groups: [],
    offer: 20,
    algorithm: "default",
    fallbackCount: 0,
    banner: null,
  };
}

function input(cardIds: string[] = ["a", "b", "c"], index = 1): StoredSessionInput {
  return {
    sessionId: "session-1",
    savedAt: "2026-10-26T10:00:00.000Z",
    scopePack: "",
    scopeDeck: "",
    offerChoice: 20,
    plan: plan(cardIds),
    queue: cardIds.map(entry),
    index,
    results: {},
    answersByEntry: { "e-b": { answer: "half" } },
    working: "scratch working",
    hintTexts: ["A pack hint"],
    hintUsed: true,
    hintSource: "pack",
    approved: "yes",
    returned: ["a"],
    peeked: ["e-b"],
    autoHinted: [],
    attempts: 2,
    startedAt: 1000,
    layerUi: { entryId: "e-b", open: true },
  };
}

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
  void cancelSessionSave();
});

afterEach(() => {
  void cancelSessionSave();
  setBrowserStore(null);
  vi.useRealTimers();
});

describe("the snapshot shape", () => {
  it("round trips through JSON unchanged", () => {
    const stored = toStoredSession(input());
    const parsed = parseStoredSession(JSON.parse(JSON.stringify(stored)));
    expect(parsed).toEqual(stored);
  });

  it("refuses a wrong version or garbage", () => {
    const stored = toStoredSession(input());
    expect(parseStoredSession({ ...stored, version: 2 })).toBeNull();
    for (const raw of [null, undefined, "session", 42, [], {}, { version: 1 }]) {
      expect(parseStoredSession(raw)).toBeNull();
    }
  });

  it("refuses a position outside the queue and a plan from another session", () => {
    const stored = toStoredSession(input(["a", "b", "c"], 1));
    expect(parseStoredSession({ ...stored, index: 3 })).toBeNull();
    expect(parseStoredSession({ ...stored, index: -1 })).toBeNull();
    expect(parseStoredSession({ ...stored, index: 1.5 })).toBeNull();
    expect(parseStoredSession({ ...stored, queue: [] })).toBeNull();
    expect(parseStoredSession({ ...stored, sessionId: "other" })).toBeNull();
  });

  it("keeps the queue entry shape aligned with the running screen", () => {
    const stored = toStoredSession(input());
    expect(stored.queue[0]).toMatchObject({
      entryId: expect.any(String),
      card: expect.objectContaining({ id: "a" }),
      coldCheck: false,
      suppressTeaching: false,
      returnKind: null,
    });
  });
});

describe("pruning against the live library", () => {
  it("keeps everything when every card still exists", () => {
    const stored = toStoredSession(input());
    const pruned = pruneStoredSession(stored, new Set(["a", "b", "c"]));
    expect(pruned).toEqual(stored);
  });

  it("drops a missing entry before the position and keeps the same current card", () => {
    const stored = toStoredSession(input(["a", "b", "c"], 2));
    const pruned = pruneStoredSession(stored, new Set(["a", "c"]));
    expect(pruned?.queue.map((item) => item.card.id)).toEqual(["a", "c"]);
    expect(pruned?.index).toBe(1);
    expect(pruned?.queue[pruned.index].card.id).toBe("c");
  });

  it("moves to the next card when the current one is gone", () => {
    const stored = toStoredSession(input(["a", "b", "c"], 1));
    const pruned = pruneStoredSession(stored, new Set(["a", "c"]));
    expect(pruned?.queue.map((item) => item.card.id)).toEqual(["a", "c"]);
    expect(pruned?.queue[pruned.index].card.id).toBe("c");
  });

  it("drops results, answers, peek marks and a layer choice for removed entries", () => {
    const stored = toStoredSession({
      ...input(["a", "b", "c"], 1),
      results: {
        "e-b": {
          cardId: "b",
          attemptId: "attempt-1",
          results: [],
          cardOutcome: "again",
          capped: false,
          judge: "local",
          rows: [],
        },
      },
    });
    const pruned = pruneStoredSession(stored, new Set(["a", "c"]));
    expect(pruned?.results).toEqual({});
    expect(pruned?.answersByEntry).toEqual({});
    expect(pruned?.peeked).toEqual([]);
    expect(pruned?.layerUi).toBeNull();
    expect(pruned?.returned).toEqual(["a"]);
  });

  it("returns null when no card survives", () => {
    const stored = toStoredSession(input());
    expect(pruneStoredSession(stored, new Set())).toBeNull();
    expect(pruneStoredSession(stored, new Set(["x"]))).toBeNull();
  });

  it("returns null when only already-passed cards survive", () => {
    const stored = toStoredSession(input(["a", "b", "c"], 2));
    expect(pruneStoredSession(stored, new Set(["a", "b"]))).toBeNull();
  });
});

describe("the resume row", () => {
  it("lives in its own store and round trips through the repository", async () => {
    expect(STORE_NAMES).toContain("resume");
    const stored = toStoredSession(input());
    await writeStoredSession(stored);
    expect(await readStoredSession()).toEqual(stored);
    await clearStoredSession();
    expect(await readStoredSession()).toBeNull();
  });

  it("starts empty when nothing was saved", async () => {
    expect(await readStoredSession()).toBeNull();
  });

  it("is cleared when the library is replaced", async () => {
    await upsertCards([card("a"), card("b"), card("c")]);
    await writeStoredSession(toStoredSession(input()));
    await clearLibrary();
    expect(await readStoredSession()).toBeNull();
    expect(await store.all("cards")).toEqual([]);
  });
});

describe("loading a snapshot for the Study screen", () => {
  it("prunes against the cards that exist now", async () => {
    await upsertCards([card("a"), card("c")]);
    await writeStoredSession(toStoredSession(input(["a", "b", "c"], 1)));
    const loaded = await loadResumableSession();
    expect(loaded?.queue.map((item) => item.card.id)).toEqual(["a", "c"]);
    expect(loaded?.queue[loaded.index].card.id).toBe("c");
  });

  it("clears an unreadable row and falls back to the plan", async () => {
    await writeStoredSession({ version: 2 } as unknown as StoredSession);
    expect(await loadResumableSession()).toBeNull();
    expect(await readStoredSession()).toBeNull();
  });

  it("clears a row whose cards are all gone", async () => {
    await writeStoredSession(toStoredSession(input()));
    expect(await loadResumableSession()).toBeNull();
    expect(await readStoredSession()).toBeNull();
  });

  it("drops an edited card, because an edit retires the old identity", async () => {
    // Editing writes a new card id and marks the old row retired; the retired
    // row is still in the store, so existence alone is not enough.
    await upsertCards([{ ...card("a"), retired: true }, card("b"), card("c")]);
    await writeStoredSession(toStoredSession(input(["a", "b", "c"], 0)));
    const loaded = await loadResumableSession();
    expect(loaded?.queue.map((item) => item.card.id)).toEqual(["b", "c"]);
    expect(loaded?.queue[loaded.index].card.id).toBe("b");
  });

  it("clears the row when every card in it was retired", async () => {
    await upsertCards([{ ...card("a"), retired: true }]);
    await writeStoredSession(toStoredSession(input(["a"], 0)));
    expect(await loadResumableSession()).toBeNull();
    expect(await readStoredSession()).toBeNull();
  });

  it("waits for a write started on the way out before it reads", async () => {
    class SlowStore extends MemoryStore {
      override async put<T extends StoredValue>(name: StoreName, value: T): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 5));
        await super.put(name, value);
      }
    }

    setBrowserStore(new SlowStore());
    await upsertCards([card("a"), card("b"), card("c")]);
    const saved = toStoredSession(input(["a", "b", "c"], 2));
    queueSessionSave(saved);
    // The unmount flush is not awaited by navigation; the load must still see it.
    void flushSessionSave();
    const loaded = await loadResumableSession();
    expect(loaded?.index).toBe(2);
    expect(loaded?.sessionId).toBe(saved.sessionId);
  });
});

describe("saving the snapshot", () => {
  it("waits for a short pause and keeps only the newest snapshot", async () => {
    vi.useFakeTimers();
    const first = toStoredSession(input(["a", "b", "c"], 0));
    const second = toStoredSession(input(["a", "b", "c"], 2));
    queueSessionSave(first);
    queueSessionSave(second);
    expect(await readStoredSession()).toBeNull();
    vi.advanceTimersByTime(300);
    await flushSessionSave();
    expect(await readStoredSession()).toEqual(second);
  });

  it("does not let an older write land after a newer one", async () => {
    class SlowStore extends MemoryStore {
      writes = 0;

      override async put<T extends StoredValue>(name: StoreName, value: T): Promise<void> {
        this.writes += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        await super.put(name, value);
      }
    }

    const slow = new SlowStore();
    setBrowserStore(slow);
    const first = toStoredSession(input(["a", "b", "c"], 0));
    const second = toStoredSession(input(["a", "b", "c"], 2));

    queueSessionSave(first);
    const firstFlush = flushSessionSave();
    queueSessionSave(second);
    const secondFlush = flushSessionSave();
    await Promise.all([firstFlush, secondFlush]);

    expect(slow.writes).toBe(2);
    expect(await readStoredSession()).toEqual(second);
  });

  it("can drop a pending write so a finished session stays finished", async () => {
    queueSessionSave(toStoredSession(input()));
    await cancelSessionSave();
    await flushSessionSave();
    expect(await readStoredSession()).toBeNull();
  });
});
