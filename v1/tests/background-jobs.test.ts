// WHY: The runner is where a background job becomes a library write. These
// tests pin success, the four-try timeout, non-timeout failures and the
// restore/reload boundaries without waiting four real minutes.
// PACK: background-jobs
// 2026-10-23 opencode: created for the background job pack [pack: background-jobs]

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import {
  createJobRunner,
  enqueueGenerationJob,
  enqueueImportJob,
  interruptJobs,
  readJobViews,
  resetJobRuntimeForTests,
  RETRY_DELAY_MS,
  type BrowserJob,
  type JobRunner,
} from "@/lib/browser/jobs";
import { patchSettings, readCards, readPacks, writeProviderKey } from "@/lib/browser/repository";
import type { PreparedRequest } from "@/lib/provider/prepare";
import { PACK_BUNDLE_SCHEMA, type ImportTarget } from "@/lib/browser/bundle";

const START = "2026-10-23T10:00:00.000Z";

function prepared(): PreparedRequest {
  return {
    id: "prepared-job",
    kind: "generation",
    display: "the exact prompt",
    messages: [{ role: "user", content: "the exact prompt" }],
    targetKind: "pack",
    packName: null,
    topic: null,
    deckId: null,
    count: 1,
    cardId: null,
    expiresAt: Date.parse(START) + 60_000,
  };
}

function packReply(): unknown {
  return {
    pack: { name: "job-pack", version: "1.0.0", language: "pl" },
    decks: [{ id: "basics", name: "Basics" }],
    lines: [{ fullLine: "Piję kawę.", target: "kawę", style: "cloze", deckId: "basics" }],
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

function cardsTarget(): ImportTarget {
  return { kind: "cards", packName: "starter", deckId: "basics" };
}

let store: Store;
let runner: JobRunner;

beforeEach(async () => {
  store = new MemoryStore();
  setBrowserStore(store);
  resetJobRuntimeForTests();
  await patchSettings({ provider: { url: "http://provider.test/v1", model: "test-model" } });
  await writeProviderKey("secret");
  runner = createJobRunner();
});

afterEach(() => {
  runner.stop();
  resetJobRuntimeForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("generation runner", () => {
  it("runs a queued generation and stores the pack", async () => {
    providerReply(packReply());
    await enqueueGenerationJob(prepared());
    await runner.wake();

    const [job] = await readJobViews();
    expect(job.status).toBe("succeeded");
    expect(job.attempts).toBe(1);
    expect(job.result).toMatchObject({ kind: "pack", packName: "job-pack", count: 1 });
    expect((await readPacks())[0].name).toBe("job-pack");
    expect(await readCards()).toHaveLength(1);
  });

  it("waits a minute after a timeout, retries three times, then fails", async () => {
    vi.useFakeTimers({ now: new Date(START) });
    timeoutReply();
    await enqueueGenerationJob(prepared());
    await runner.wake();

    let [job] = await readJobViews();
    expect(job.status).toBe("waiting");
    expect(job.attempts).toBe(1);
    expect(job.nextAttemptAt).toBe(new Date(Date.parse(START) + RETRY_DELAY_MS).toISOString());

    for (let attempt = 2; attempt <= 4; attempt += 1) {
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
      await runner.wake();
      [job] = await readJobViews();
      if (attempt < 4) {
        expect(job.status).toBe("waiting");
        expect(job.attempts).toBe(attempt);
      }
    }

    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(4);
    expect(job.lastError).toContain("It was tried 4 times");
    expect((vi.mocked(fetch)).mock.calls).toHaveLength(4);
  });

  it("resumes a waiting retry after a boot with no other work", async () => {
    vi.useFakeTimers({ now: new Date(START) });
    providerReply(packReply());
    await enqueueGenerationJob(prepared());
    const [stored] = await store.all<BrowserJob>("jobs");
    await store.put("jobs", {
      ...stored,
      status: "waiting",
      attempts: 1,
      nextAttemptAt: new Date(Date.parse(START) + RETRY_DELAY_MS).toISOString(),
      lastError: "The provider took too long to answer.",
    });

    await runner.wake();
    expect((await readJobViews())[0].status).toBe("waiting");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    await runner.wake();
    const [job] = await readJobViews();
    expect(job.status).toBe("succeeded");
    expect(job.attempts).toBe(2);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("does not automatically retry a non-timeout failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await enqueueGenerationJob(prepared());
    await runner.wake();

    const [job] = await readJobViews();
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(1);
    expect(job.lastError).toContain("key");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("stops a waiting job when the library is restored", async () => {
    vi.useFakeTimers({ now: new Date(START) });
    timeoutReply();
    await enqueueGenerationJob(prepared());
    await runner.wake();
    await interruptJobs("The library was restored.");
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    await runner.wake();

    const [job] = await readJobViews();
    expect(job.status).toBe("failed");
    expect(job.lastError).toBe("The library was restored.");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});

describe("import runner", () => {
  it("runs a valid import as a job", async () => {
    const text = JSON.stringify({
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
          fullLine: "Piję kawę.",
        },
      ],
    });
    await enqueueImportJob({ text, target: { kind: "pack" } });
    await runner.wake();

    const [job] = await readJobViews();
    expect(job.status).toBe("succeeded");
    expect(job.result).toMatchObject({ kind: "pack", count: 1, decksAdded: 1 });
    expect((await readPacks())[0].name).toBe("starter");
  });

  it("fails once with field details and writes nothing", async () => {
    await enqueueImportJob({ text: "{not json", target: cardsTarget() });
    await runner.wake();

    const [job] = await readJobViews();
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(1);
    expect(job.lastError).toContain("file needs fixing");
    expect(job.errorDetails.length).toBeGreaterThan(0);
    expect(await readPacks()).toHaveLength(0);
    expect(await readCards()).toHaveLength(0);
  });
});
