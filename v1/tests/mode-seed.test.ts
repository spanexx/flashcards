// WHY: Five generated modes reach the browser through one manifest. These
// tests strict-parse that output and exercise the real Track 1 seed hook, so a
// stale file, a wrong id or a silent failure is caught before a learner starts.
// PACK: built-in-modes
// 2026-11-23 opencode: created red before the generator existed. [pack: built-in-modes]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureModesSeeded, MODE_INDEX_SCHEMA } from "@/lib/browser/modes";
import { readModes, writeMode } from "@/lib/browser/repository";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { withBasePath } from "@/lib/shared/paths";
import type { LearningMode } from "@/lib/shared/types";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const IDS = [
  "grammar-roles",
  "language-general",
  "word-deep-dive",
  "system-architecture",
  "programming-language",
] as const;
const STAMP = "2026-11-23T00:00:00.000Z";
const AUTHOR_FIELDS = [
  "id",
  "name",
  "description",
  "version",
  "defaultCardMix",
  "usesWordStages",
  "skillInstructions",
  "canonicalExample",
];

let store: Store;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Strict parse, matching the seed's response.json() rather than loose repair. */
async function readJson(relative: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(projectRoot, relative), "utf8")) as Record<
    string,
    unknown
  >;
}

/** One manifest entry as the reader sees it. */
interface Entry {
  id: string;
  version: string;
  file: string;
}

/** Serve the manifest and named files; every other url is a 404. */
function stubModes(index: unknown, files: Record<string, unknown>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/modes/index.json")) return new Response(JSON.stringify(index));
      if (!(url in files)) return new Response("", { status: 404 });
      return new Response(JSON.stringify(files[url]));
    }),
  );
  return calls;
}

/** Build the url map the generated manifest names. */
async function generatedFiles(): Promise<Record<string, unknown>> {
  const files: Record<string, unknown> = {};
  for (const id of IDS) {
    files[withBasePath(`/modes/${id}.json`)] = await readJson(`public/modes/${id}.json`);
  }
  return files;
}

/** One complete stored mode, used to prove a learner row is never replaced. */
async function learnerCopy(id: string): Promise<LearningMode> {
  const generated = await readJson(`public/modes/${id}.json`);
  return { ...generated, isBuiltIn: false, version: "9.9.9" } as unknown as LearningMode;
}

describe("generated mode manifest", () => {
  it("lists exactly five three-field entries at version 1.0.0", async () => {
    const index = (await readJson("public/modes/index.json")) as {
      schema: string;
      modes: Entry[];
    };
    expect(index.schema).toBe(MODE_INDEX_SCHEMA);
    expect(index.modes.map((entry) => entry.id).sort()).toEqual([...IDS].sort());
    for (const entry of index.modes) {
      expect(Object.keys(entry).sort()).toEqual(["file", "id", "version"]);
      expect(entry.version).toBe("1.0.0");
      expect(entry.file).toBe(`/modes/${entry.id}.json`);
    }
  });

  it.each(IDS)("%s is stamped built-in with a fixed creation time", async (id) => {
    const generated = await readJson(`public/modes/${id}.json`);
    expect(Object.keys(generated).sort()).toEqual([...AUTHOR_FIELDS, "createdAt", "isBuiltIn"].sort());
    expect(generated.id).toBe(id);
    expect(generated.version).toBe("1.0.0");
    expect(generated.isBuiltIn).toBe(true);
    expect(generated.createdAt).toBe(STAMP);
  });
});

describe("installing generated modes", () => {
  it("installs five built-ins on a fresh browser", async () => {
    const index = await readJson("public/modes/index.json");
    stubModes(index, await generatedFiles());

    await ensureModesSeeded();

    const modes = await readModes(store);
    expect(modes).toHaveLength(5);
    for (const mode of modes) expect(mode.isBuiltIn).toBe(true);
    expect(modes.map((mode) => mode.id).sort()).toEqual([...IDS].sort());
  });

  it("fetches no mode file on a second pass with the same version", async () => {
    const index = await readJson("public/modes/index.json");
    const calls = stubModes(index, await generatedFiles());
    await ensureModesSeeded();
    const afterFirst = calls.length;
    await ensureModesSeeded();
    expect(calls).toHaveLength(afterFirst + 1);
  });

  it("replaces one built-in when only its manifest version is newer", async () => {
    const index = (await readJson("public/modes/index.json")) as { schema: string; modes: Entry[] };
    const files = await generatedFiles();
    stubModes(index, files);
    await ensureModesSeeded();

    const newerEntry = { ...index.modes[0], version: "1.1.0" };
    const newerIndex = { ...index, modes: [newerEntry, ...index.modes.slice(1)] };
    const newerFile = { ...(files[withBasePath(newerEntry.file)] as Record<string, unknown>), version: "1.1.0" };
    stubModes(newerIndex, { ...files, [withBasePath(newerEntry.file)]: newerFile });
    await ensureModesSeeded();

    const modes = await readModes(store);
    expect(modes.find((mode) => mode.id === newerEntry.id)?.version).toBe("1.1.0");
    const untouched = modes.find((mode) => mode.id === index.modes[1].id);
    expect(untouched?.version).toBe("1.0.0");
  });

  it("never replaces a learner-owned copy with the same id", async () => {
    await writeMode(await learnerCopy("grammar-roles"));
    const index = await readJson("public/modes/index.json");
    stubModes(index, await generatedFiles());

    await ensureModesSeeded();

    const own = (await readModes(store)).find((mode) => mode.id === "grammar-roles");
    expect(own).toMatchObject({ isBuiltIn: false, version: "9.9.9" });
  });

  it("leaves one mode as it was and retries next start when its file fails", async () => {
    const index = await readJson("public/modes/index.json");
    const files = await generatedFiles();
    const missing = withBasePath("/modes/language-general.json");
    const broken = { ...files };
    delete broken[missing];
    stubModes(index, broken);
    await ensureModesSeeded();
    expect(await readModes(store)).toHaveLength(4);

    stubModes(index, files);
    await ensureModesSeeded();
    expect(await readModes(store)).toHaveLength(5);
  });
});
