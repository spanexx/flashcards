// WHY: A mode reaches a learner through a manifest read on each start. These
// tests pin install, the idempotent pass, the newer-version update, silence on a
// broken manifest, and the promise that a failed file leaves the store exactly
// as it was for the next start to retry.
// PACK: learning-mode-core
// 2026-11-22 opencode: created for the learning-mode-core pack.
// [pack: learning-mode-core]

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { readModes, writeMode } from "@/lib/browser/repository";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { ensureModesSeeded, MODE_INDEX_SCHEMA } from "@/lib/browser/modes";
import { withBasePath } from "@/lib/shared/paths";
import type { LearningMode } from "@/lib/shared/types";

const MODE_FILE = "/modes/calm-basics.json";
const INDEX_FILE = "/modes/index.json";
const modeUrl = withBasePath(MODE_FILE);
const indexUrl = withBasePath(INDEX_FILE);

let store: Store;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** One whole mode file a manifest can name. */
function modeFile(overrides: Partial<LearningMode> = {}): LearningMode {
  return {
    id: "calm-basics",
    name: "Calm basics",
    description: "One short card at a time.",
    version: "1.0.0",
    defaultCardMix: ["cloze"],
    usesWordStages: false,
    skillInstructions: "Ask one question, then wait.",
    canonicalExample: {
      schema: PACK_BUNDLE_SCHEMA,
      pack: { name: "mode-demo", version: "1.0.0" },
      decks: [{ id: "basics", name: "Basics", level: "intermediate" }],
      cards: [],
      words: [],
      pages: [],
    },
    isBuiltIn: false,
    createdAt: "2026-11-22T09:00:00.000Z",
    ...overrides,
  };
}

/** One manifest body, with only the entries a case cares about. */
function manifest(entries: Array<{ id: string; version: string; file: string }>) {
  return { schema: MODE_INDEX_SCHEMA, modes: entries };
}

/** Answer the manifest and any named file; anything else is a 404. */
function stubModes(index: unknown, files: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/modes/index.json")) {
      return typeof index === "string"
        ? new Response(index, { status: 200 })
        : new Response(JSON.stringify(index), { status: 200 });
    }
    if (!(url in files)) return new Response("", { status: 404 });
    const body = files[url];
    return typeof body === "string"
      ? new Response(body, { status: 200 })
      : new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("ensureModesSeeded", () => {
  it("installs a fresh mode and stamps it as built-in", async () => {
    const calls = stubModes(manifest([{ id: "calm-basics", version: "1.0.0", file: MODE_FILE }]), {
      [modeUrl]: modeFile(),
    });

    await ensureModesSeeded();

    // WHY: the manifest is read from the app's base path, so a hosted build
    // under a sub-path still finds its own modes. [pack: learning-mode-core]
    expect(calls[0]).toBe(indexUrl);
    const modes = await readModes(store);
    expect(modes).toHaveLength(1);
    expect(modes[0]).toMatchObject({
      id: "calm-basics",
      version: "1.0.0",
      isBuiltIn: true,
    });
  });

  it("writes nothing and fetches no file on a second pass with the same version", async () => {
    const calls = stubModes(manifest([{ id: "calm-basics", version: "1.0.0", file: MODE_FILE }]), {
      [modeUrl]: modeFile(),
    });

    await ensureModesSeeded();
    await ensureModesSeeded();

    expect(calls.filter((url) => url === modeUrl)).toHaveLength(1);
    expect((await readModes(store))[0]?.version).toBe("1.0.0");
  });

  it("replaces the row when the manifest is newer and keeps its id", async () => {
    stubModes(manifest([{ id: "calm-basics", version: "1.0.0", file: MODE_FILE }]), {
      [modeUrl]: modeFile(),
    });
    await ensureModesSeeded();

    stubModes(manifest([{ id: "calm-basics", version: "1.1.0", file: MODE_FILE }]), {
      [modeUrl]: modeFile({ version: "1.1.0", skillInstructions: "Ask two questions." }),
    });
    await ensureModesSeeded();

    const modes = await readModes(store);
    expect(modes).toHaveLength(1);
    expect(modes[0]?.version).toBe("1.1.0");
    expect(modes[0]?.skillInstructions).toBe("Ask two questions.");
  });

  it("keeps an installed mode when the manifest is older", async () => {
    stubModes(manifest([{ id: "calm-basics", version: "2.0.0", file: MODE_FILE }]), {
      [modeUrl]: modeFile({ version: "2.0.0" }),
    });
    await ensureModesSeeded();

    const calls = stubModes(manifest([{ id: "calm-basics", version: "1.9.0", file: MODE_FILE }]), {
      [modeUrl]: modeFile({ version: "1.9.0", skillInstructions: "An older rule." }),
    });
    await ensureModesSeeded();

    expect(calls.filter((url) => url === modeUrl)).toHaveLength(0);
    expect((await readModes(store))[0]?.skillInstructions).toBe(
      "Ask one question, then wait.",
    );
  });

  it("stays silent on a manifest with the wrong schema", async () => {
    stubModes(
      { schema: "flashcards.mode-index/v2", modes: [{ id: "calm-basics", version: "1.0.0", file: MODE_FILE }] },
      { [modeUrl]: modeFile() },
    );

    await expect(ensureModesSeeded()).resolves.toBeUndefined();
    expect(await readModes(store)).toEqual([]);
  });

  it("stays silent on a manifest that is not JSON", async () => {
    stubModes("{", { [modeUrl]: modeFile() });

    await expect(ensureModesSeeded()).resolves.toBeUndefined();
    expect(await readModes(store)).toEqual([]);
  });

  it("leaves the store unchanged when a file fails, then installs it next start", async () => {
    // The bad mode is listed first; the good one must still install.
    stubModes(
      manifest([
        { id: "broken", version: "1.0.0", file: "/modes/broken.json" },
        { id: "calm-basics", version: "1.0.0", file: MODE_FILE },
      ]),
      { [modeUrl]: modeFile() },
    );

    await ensureModesSeeded();
    expect((await readModes(store)).map((mode) => mode.id)).toEqual(["calm-basics"]);

    stubModes(
      manifest([
        { id: "broken", version: "1.0.0", file: "/modes/broken.json" },
        { id: "calm-basics", version: "1.0.0", file: MODE_FILE },
      ]),
      {
        [modeUrl]: modeFile(),
        [withBasePath("/modes/broken.json")]: modeFile({ id: "broken", name: "Broken no more" }),
      },
    );
    await ensureModesSeeded();

    expect((await readModes(store)).map((mode) => mode.id).sort()).toEqual([
      "broken",
      "calm-basics",
    ]);
  });

  it("refuses a file whose id does not match its manifest entry", async () => {
    stubModes(manifest([{ id: "calm-basics", version: "1.0.0", file: MODE_FILE }]), {
      [modeUrl]: modeFile({ id: "something-else" }),
    });

    await ensureModesSeeded();
    expect(await readModes(store)).toEqual([]);
  });

  it("never deletes a mode when the manifest drops it", async () => {
    stubModes(manifest([{ id: "calm-basics", version: "1.0.0", file: MODE_FILE }]), {
      [modeUrl]: modeFile(),
    });
    await ensureModesSeeded();

    stubModes(manifest([]));
    await ensureModesSeeded();

    expect((await readModes(store)).map((mode) => mode.id)).toEqual(["calm-basics"]);
  });

  it("leaves the learner's copy alone on a re-seed", async () => {
    stubModes(manifest([{ id: "calm-basics", version: "1.0.0", file: MODE_FILE }]), {
      [modeUrl]: modeFile(),
    });
    await ensureModesSeeded();

    const copy: LearningMode = {
      ...modeFile(),
      id: "my-calm",
      name: "My calm",
      isBuiltIn: false,
      sourceModeId: "calm-basics",
      skillInstructions: "My own rule.",
    };
    await writeMode(copy, store);

    await ensureModesSeeded();

    const stored = await readModes(store);
    expect(stored.map((mode) => mode.id).sort()).toEqual(["calm-basics", "my-calm"]);
    expect(stored.find((mode) => mode.id === "my-calm")?.skillInstructions).toBe("My own rule.");
  });
});
