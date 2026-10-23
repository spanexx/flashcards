// WHY: Background work is only real if a learner can keep creating while a
// batch runs, see a timeout retry, import a file, recover from a bad file and
// reload without losing the truth. This is the post-implementation rehearsal
// from the PRD, through the real router, store and runner.
// PACK: background-jobs
// 2026-10-23 opencode: created for the background-jobs post-implementation rehearsal [pack: background-jobs]

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { localGet, localSend } from "@/lib/browser/router";
import { writeMeta } from "@/lib/browser/repository";
import { PACK_BUNDLE_SCHEMA, type ImportTarget } from "@/lib/browser/bundle";
import {
  createJobRunner,
  readJobViews,
  recoverInterruptedJobs,
  resetJobRuntimeForTests,
  RETRY_DELAY_MS,
  type BrowserJob,
  type JobRunner,
} from "@/lib/browser/jobs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const START = "2026-10-23T10:00:00.000Z";

function line(message: string): void {
  console.log(`-> ${message}`);
}

function packBundle(name: string): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name, version: "1.0.0", language: "pl" },
    decks: [{ id: "basics", name: "Basics" }],
    cards: [
      {
        deckId: "basics",
        summary: "Piję kawę",
        prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: "Piję kawę." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
        fullLine: "Piję kawę.",
      },
    ],
  });
}

function packReply(): unknown {
  return {
    pack: { name: "sim-pack", version: "1.0.0", language: "pl" },
    decks: [{ id: "basics", name: "Basics" }],
    lines: [
      { fullLine: "Piję kawę.", target: "kawę", style: "cloze", deckId: "basics" },
      { fullLine: "Mam kota.", target: "kota", style: "cloze", deckId: "basics" },
    ],
  };
}

function cardsReply(): unknown {
  return {
    lines: [{ fullLine: "Mam kota.", target: "kota", style: "cloze" }],
  };
}

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

function timeoutReply(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }),
  );
}

async function readBuiltChunks(folder: string): Promise<string> {
  const entries = await readdir(folder, { withFileTypes: true });
  const texts = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) return readBuiltChunks(full);
      if (entry.isFile() && entry.name.endsWith(".js")) return readFile(full, "utf8");
      return "";
    }),
  );
  return texts.join("\n");
}

async function prepare(target: ImportTarget, count = 2): Promise<string> {
  const prepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
    target,
    count,
  });
  return prepared.requestId;
}

async function enqueue(requestId: string): Promise<string> {
  const created = await localSend<{ job: { id: string; status: string } }>("/api/jobs", "POST", {
    kind: "generation",
    requestId,
  });
  expect(created.job.status).toBe("queued");
  return created.job.id;
}

let store: Store;
let runner: JobRunner;

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date(START) });
  store = new MemoryStore();
  setBrowserStore(store);
  resetJobRuntimeForTests();
  await writeMeta("seeded", "yes", store);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
  await localSend("/api/settings", "PATCH", {
    provider: { url: "https://provider.test/v1", model: "sim-model" },
  });
  await localSend("/api/provider/key", "POST", { key: "sim-secret" });
  runner = createJobRunner();
});

afterEach(() => {
  runner.stop();
  resetJobRuntimeForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("background jobs simulation", () => {
  it("walks the five promises through the real browser router", async () => {
    await localSend("/api/packs/import", "POST", {
      json: packBundle("starter"),
      target: { kind: "pack" },
    });

    // 1. Continue: enqueue returns while the batch is still queued, and a
    // second prompt can be prepared before the first one runs.
    providerReply(packReply());
    const first = await prepare({ kind: "pack" }, 2);
    const firstJob = await enqueue(first);
    const [queued] = await readJobViews();
    expect(queued.id).toBe(firstJob);
    expect(queued.status).toBe("queued");
    const second = await prepare({ kind: "cards", packName: "starter", deckId: "basics" }, 1);
    expect(second).not.toBe(first);
    line("Create can enqueue and prepare again while the first batch waits");

    // 2. Timeout: four tries a minute apart, then Try again starts a fresh job.
    await runner.wake();
    expect((await readJobViews()).find((job) => job.id === firstJob)?.status).toBe("succeeded");

    timeoutReply();
    const timeoutRequest = await prepare({ kind: "cards", packName: "starter", deckId: "basics" }, 1);
    const timeoutJob = await enqueue(timeoutRequest);
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await runner.wake();
      const current = (await readJobViews()).find((job) => job.id === timeoutJob);
      if (attempt < 4) {
        expect(current?.status).toBe("waiting");
        await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
      } else {
        expect(current?.status).toBe("failed");
        expect(current?.attempts).toBe(4);
        expect(current?.lastError).toContain("It was tried 4 times");
      }
    }
    providerReply(cardsReply());
    const retriedResponse = await localSend<{ job: { id: string } }>(
      `/api/jobs/${timeoutJob}/retry`,
      "POST",
    );
    await runner.wake();
    const retried = (await readJobViews()).find((job) => job.id === retriedResponse.job.id);
    expect(retried?.status).toBe("succeeded");
    line("a timed-out batch waits, retries four times, then a manual Try again succeeds");

    // 3. Import: the file becomes a pack without blocking the screen.
    const imported = await localSend<{ job: { id: string; status: string } }>("/api/jobs", "POST", {
      kind: "import",
      text: packBundle("from-chat"),
      target: { kind: "pack" },
      source: "chat",
    });
    expect(imported.job.status).toBe("queued");
    await runner.wake();
    const importView = (await readJobViews()).find((job) => job.id === imported.job.id);
    expect(importView?.status).toBe("succeeded");
    expect(importView?.result).toMatchObject({ kind: "pack", packName: "from-chat", count: 1 });
    line("Import is a queued job and writes the pack when it runs");

    // 4. Bad import: one failed job with field details and no partial write.
    const before = await localGet<{ packs: unknown[] }>("/api/packs");
    const bad = await localSend<{ job: { id: string } }>("/api/jobs", "POST", {
      kind: "import",
      text: JSON.stringify({ schema: PACK_BUNDLE_SCHEMA, pack: { name: "bad" } }),
      target: { kind: "pack" },
    });
    await runner.wake();
    const badView = (await readJobViews()).find((job) => job.id === bad.job.id);
    expect(badView?.status).toBe("failed");
    expect(badView?.errorDetails.length).toBeGreaterThan(0);
    expect((await localGet<{ packs: unknown[] }>("/api/packs")).packs).toHaveLength(before.packs.length);
    line("a bad import fails once with field details and writes nothing");

    // 5. Reload: a running job becomes a clear failure on the next boot.
    providerReply(cardsReply());
    const reloadRequest = await prepare({ kind: "cards", packName: "starter", deckId: "basics" }, 1);
    const reloadJob = await enqueue(reloadRequest);
    const stored = (await store.all<BrowserJob>("jobs")).find((job) => job.id === reloadJob);
    if (!stored) throw new Error("the reload job was not stored");
    await store.put("jobs", { ...stored, status: "running" });
    await recoverInterruptedJobs();
    const reloaded = (await readJobViews()).find((job) => job.id === reloadJob);
    expect(reloaded?.status).toBe("failed");
    expect(reloaded?.lastError).toBe("The page was reloaded before this job finished.");
    line("a reload marks the interrupted job instead of claiming it finished");

    // The built client still says what the dock and Create promise.
    const built = path.join(projectRoot, "out", "library", "index.html");
    expect(existsSync(built)).toBe(true);
    const html = await readFile(built, "utf8");
    expect(html).toContain(">Create</button>");
    const client = await readBuiltChunks(path.join(projectRoot, "out", "_next", "static", "chunks"));
    expect(client).toContain("Generation started. You can keep working.");
    expect(client).toContain("Generation finished");
    expect(client).toContain("Waiting for the current job to finish.");
    expect(client).toContain("Try again");
    expect(client).toContain("one minute apart");
    expect(client).toContain("Press Try again.");
    expect(client).toContain("The page was reloaded before this job finished.");
    expect(client).toContain("What needs fixing");
    line("built client carries the queue, retry, notice and recovery words");
  });
});
