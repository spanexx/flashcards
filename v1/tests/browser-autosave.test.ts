// WHY: Autosave promises that one chosen file is rewritten after every change
// and that the key never enters it. These tests use a direct store so the fake
// file handle keeps its own write function, which IndexedDB would carry anyway.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autosaveNow,
  autosaveState,
  chooseAutosaveFile,
  disconnectAutosave,
  scheduleAutosave,
  startAutosave,
  type AutosaveState,
} from "@/lib/browser/autosave";
import { markChanged } from "@/lib/browser/changes";
import { importBundle, PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { setBrowserStore, type Store, type StoreName, type StoredValue } from "@/lib/browser/store";
import { writeProviderKey } from "@/lib/browser/repository";

class DirectStore implements Store {
  private readonly rows = new Map<StoreName, Map<string, StoredValue>>();

  private map(store: StoreName): Map<string, StoredValue> {
    let found = this.rows.get(store);
    if (!found) {
      found = new Map<string, StoredValue>();
      this.rows.set(store, found);
    }
    return found;
  }

  async get<T extends StoredValue>(store: StoreName, id: string): Promise<T | null> {
    return (this.map(store).get(id) as T | undefined) ?? null;
  }

  async put<T extends StoredValue>(store: StoreName, value: T): Promise<void> {
    this.map(store).set(value.id, value);
  }

  async delete(store: StoreName, id: string): Promise<void> {
    this.map(store).delete(id);
  }

  async all<T extends StoredValue>(store: StoreName): Promise<T[]> {
    return [...this.map(store).values()] as T[];
  }

  async clear(store: StoreName): Promise<void> {
    this.map(store).clear();
  }
}

function bundle(): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name: "starter", version: "1.0.0", language: "pl" },
    decks: [{ id: "basics", name: "Basics" }],
    cards: [
      {
        deckId: "basics",
        summary: "Piję kawę",
        prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: "Piję kawę." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
        hints: [],
        fullLine: "Piję kawę.",
      },
    ],
  });
}

let store: DirectStore;
let writes: string[];
let permission: PermissionState;

function handle() {
  return {
    name: "my-backup.json",
    queryPermission: async () => permission,
    createWritable: async () => ({
      write: async (text: string) => {
        writes.push(text);
      },
      close: async () => undefined,
    }),
  };
}

beforeEach(async () => {
  store = new DirectStore();
  setBrowserStore(store);
  writes = [];
  permission = "granted";
  await importBundle(bundle(), { kind: "new" });
  await store.put("autosave", { id: "file", handle: handle(), lastSavedAt: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function desktopWindow(showSaveFilePicker: () => Promise<ReturnType<typeof handle>>) {
  return {
    showSaveFilePicker,
    setTimeout: (callback: () => void) => setTimeout(callback, 5),
    clearTimeout: (timer: number) => clearTimeout(timer),
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

describe("autosave", () => {
  it("rewrites the chosen file with the whole backup", async () => {
    const result = await autosaveNow(store);
    expect(result.ok).toBe(true);
    expect(writes).toHaveLength(1);
    const backup = JSON.parse(writes[0]);
    expect(backup.schema).toBe("flashcards.backup/v1");
    expect(backup.cards).toHaveLength(1);
    const state = await autosaveState(store);
    expect(state.fileName).toBe("my-backup.json");
    expect(state.lastSavedAt).toBeTruthy();
    expect(state.permission).toBe("granted");
  });

  it("never writes the provider key into the file", async () => {
    await writeProviderKey("super-secret", store);
    await autosaveNow(store);
    expect(writes[0]).not.toContain("super-secret");
  });

  it("does not write when permission was not granted", async () => {
    permission = "prompt";
    const result = await autosaveNow(store);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("permission");
    expect(writes).toHaveLength(0);
  });

  it("reports when no file is connected", async () => {
    await disconnectAutosave(store);
    const result = await autosaveNow(store);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("No backup file");
  });

  it("reads a phone-friendly state with no connected file", async () => {
    const state: AutosaveState = await autosaveState(store);
    expect(state.supported).toBe(false);
    await disconnectAutosave(store);
    expect((await autosaveState(store)).fileName).toBeNull();
  });

  it("chooses a file, writes the first backup, and reports the saved state", async () => {
    const picker = vi.fn(async () => handle());
    vi.stubGlobal("window", desktopWindow(picker));

    const state = await chooseAutosaveFile(store);
    expect(picker).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(1);
    expect(state.supported).toBe(true);
    expect(state.fileName).toBe("my-backup.json");
    expect(state.lastSavedAt).toBeTruthy();
  });

  it("refuses to choose when the browser has no file picker", async () => {
    vi.stubGlobal("window", {});
    await expect(chooseAutosaveFile(store)).rejects.toThrow("Download a backup");
  });

  it("writes once after a quiet moment when a change is scheduled", async () => {
    vi.stubGlobal("window", desktopWindow(async () => handle()));
    scheduleAutosave(5);
    await settle();
    expect(writes).toHaveLength(1);
  });

  it("starts listening once and writes after the library changes", async () => {
    vi.stubGlobal("window", desktopWindow(async () => handle()));
    startAutosave();
    startAutosave();
    markChanged();
    await settle();
    expect(writes).toHaveLength(1);
  });
});
