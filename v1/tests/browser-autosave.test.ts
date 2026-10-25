// WHY: Autosave promises that one chosen file is rewritten after every change
// and that the key never enters it. The file is now a zip so local media can
// travel with the text, and an old .json handle is retired instead of losing
// media. These tests use a direct store so the fake file handle keeps its own
// write function, which IndexedDB would carry anyway.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.
// 2026-10-25 opencode: autosave writes the media zip. [pack: teaching-layers]

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
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
let writes: Blob[];
let permission: PermissionState;

function handle(name = "my-backup.zip") {
  return {
    name,
    queryPermission: async () => permission,
    createWritable: async () => ({
      write: async (data: Blob) => {
        writes.push(data);
      },
      close: async () => undefined,
    }),
  };
}

/** The text half of one written zip, the same way a future restore reads it. */
async function writtenBackup(index = 0): Promise<Record<string, unknown>> {
  const files = unzipSync(new Uint8Array(await writes[index].arrayBuffer()));
  return JSON.parse(strFromU8(files["backup.json"])) as Record<string, unknown>;
}

beforeEach(async () => {
  store = new DirectStore();
  setBrowserStore(store);
  writes = [];
  permission = "granted";
  await importBundle(bundle(), { kind: "pack" });
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
  it("rewrites the chosen zip with the whole backup", async () => {
    const result = await autosaveNow(store);
    expect(result.ok).toBe(true);
    expect(writes).toHaveLength(1);
    const backup = await writtenBackup();
    expect(backup.schema).toBe("flashcards.backup/v1");
    expect(backup.cards).toHaveLength(1);
    const state = await autosaveState(store);
    expect(state.fileName).toBe("my-backup.zip");
    expect(state.lastSavedAt).toBeTruthy();
    expect(state.permission).toBe("granted");
  });

  it("never writes the provider key into the file", async () => {
    await writeProviderKey("super-secret", store);
    await autosaveNow(store);
    expect(JSON.stringify(await writtenBackup())).not.toContain("super-secret");
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

  it("retires an old .json handle once and asks for a zip", async () => {
    await store.put("autosave", { id: "file", handle: handle("old-backup.json"), lastSavedAt: null });
    const result = await autosaveNow(store);
    expect(result.ok).toBe(false);
    expect(result.message).toContain(".zip");
    expect(writes).toHaveLength(0);
    expect(await store.get("autosave", "file")).toBeNull();

    const again = await autosaveNow(store);
    expect(again.message).toContain("No backup file");
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
    expect(state.fileName).toBe("my-backup.zip");
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
