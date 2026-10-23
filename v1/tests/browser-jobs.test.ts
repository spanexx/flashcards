// WHY: The job store is the only durable owner of background work. These tests
// pin the view/payload boundary, the retry budget and the safe transitions.
// PACK: background-jobs
// 2026-10-23 opencode: created for the background job pack [pack: background-jobs]

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import {
  dismissJob,
  enqueueGenerationJob,
  enqueueImportJob,
  interruptJobs,
  jobResultHref,
  pruneFinishedJobs,
  readJobViews,
  recoverInterruptedJobs,
  resetJobRuntimeForTests,
  retryJob,
  type BrowserJob,
} from "@/lib/browser/jobs";
import type { PreparedRequest } from "@/lib/provider/prepare";
import type { ImportTarget } from "@/lib/browser/bundle";

const NOW = "2026-10-23T10:00:00.000Z";

function prepared(overrides: Partial<PreparedRequest> = {}): PreparedRequest {
  return {
    id: "prepared-1",
    kind: "generation",
    display: "the exact prompt",
    messages: [{ role: "user", content: "the exact prompt" }],
    targetKind: "cards",
    packName: "starter",
    topic: "Basics",
    deckId: "basics",
    count: 5,
    cardId: null,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

function importTarget(): ImportTarget {
  return { kind: "cards", packName: "starter", deckId: "basics" };
}

async function stored(store: Store): Promise<BrowserJob[]> {
  return store.all<BrowserJob>("jobs");
}

let store: Store;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
  resetJobRuntimeForTests();
});

afterEach(() => {
  resetJobRuntimeForTests();
});

describe("enqueue", () => {
  it("stores a generation job but returns a view without the prompt", async () => {
    const view = await enqueueGenerationJob(prepared());
    expect(view.status).toBe("queued");
    expect(view.kind).toBe("generation");
    expect(view.title).toBe("Generate 5 cards");
    expect(view.detail).toBe("starter → Basics");
    expect(view.maxAttempts).toBe(4);
    expect(view.attempts).toBe(0);
    expect("payload" in view).toBe(false);

    const jobs = await stored(store);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].payload.kind).toBe("generation");
    if (jobs[0].payload.kind === "generation") {
      expect(jobs[0].payload.prepared.display).toBe("the exact prompt");
    }
  });

  it("stores an import job with one attempt and field-safe labels", async () => {
    const view = await enqueueImportJob({
      text: JSON.stringify({ cards: [] }),
      target: importTarget(),
      source: "chat",
    });
    expect(view.kind).toBe("import");
    expect(view.title).toBe("Save chat answer");
    expect(view.detail).toBe("starter → basics");
    expect(view.maxAttempts).toBe(1);
    expect(view.count).toBeNull();

    const jobs = await stored(store);
    expect(jobs[0].payload.kind).toBe("import");
    if (jobs[0].payload.kind === "import") {
      expect(jobs[0].payload.namePolicy).toBe("strict");
      expect(jobs[0].payload.source).toBe("chat");
    }
  });

  it("refuses an empty import before storing it", async () => {
    await expect(
      enqueueImportJob({ text: "   ", target: importTarget() }),
    ).rejects.toThrow("Paste the bundle");
    expect(await readJobViews()).toHaveLength(0);
  });
});

describe("actions", () => {
  it("replaces a failed job with a fresh queued retry", async () => {
    const view = await enqueueGenerationJob(prepared());
    const [job] = await stored(store);
    await store.put("jobs", {
      ...job,
      status: "failed",
      lastError: "The provider took too long to answer.",
      finishedAt: NOW,
    });

    const retried = await retryJob(view.id);
    expect(retried.id).not.toBe(view.id);
    expect(retried.status).toBe("queued");
    expect(retried.attempts).toBe(0);
    expect(retried.maxAttempts).toBe(4);
    expect(retried.lastError).toBeNull();
    const jobs = await stored(store);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(retried.id);
  });

  it("refuses to dismiss an active job", async () => {
    const view = await enqueueGenerationJob(prepared());
    await expect(dismissJob(view.id)).rejects.toThrow("cannot be dismissed");
  });

  it("dismisses a finished job", async () => {
    const view = await enqueueGenerationJob(prepared());
    const [job] = await stored(store);
    await store.put("jobs", { ...job, status: "succeeded", result: {
      kind: "cards",
      packName: "starter",
      deckId: "basics",
      count: 5,
      decksAdded: 0,
      duplicates: 0,
    }, finishedAt: NOW });
    await dismissJob(view.id);
    expect(await readJobViews()).toHaveLength(0);
  });

  it("marks every active job failed on interrupt and keeps finished history", async () => {
    const first = await enqueueGenerationJob(prepared({ id: "prepared-a" }));
    await enqueueImportJob({ text: "{}", target: importTarget() });
    const [a, b] = await stored(store);
    await store.put("jobs", { ...a, status: "running" });
    await store.put("jobs", { ...b, status: "waiting", nextAttemptAt: NOW });
    await interruptJobs("The library was restored.");

    const views = await readJobViews();
    expect(views.every((job) => job.status === "failed")).toBe(true);
    expect(views.every((job) => job.lastError === "The library was restored.")).toBe(true);
    expect(first.status).toBe("queued");
  });

  it("marks a running job interrupted on boot", async () => {
    const view = await enqueueGenerationJob(prepared());
    const [job] = await stored(store);
    await store.put("jobs", { ...job, status: "running" });
    await recoverInterruptedJobs();
    const [recovered] = await readJobViews();
    expect(recovered.status).toBe("failed");
    expect(recovered.lastError).toBe("The page was reloaded before this job finished.");
    expect(view.status).toBe("queued");
  });

  it("prunes old finished jobs but never an active one", async () => {
    const base = await enqueueGenerationJob(prepared());
    const [first] = await stored(store);
    for (let index = 0; index < 22; index += 1) {
      const id = `old-${index}`;
      await store.put("jobs", {
        ...first,
        id,
        status: "failed",
        lastError: "old",
        createdAt: new Date(Date.parse(NOW) + index * 1000).toISOString(),
        updatedAt: new Date(Date.parse(NOW) + index * 1000).toISOString(),
        finishedAt: new Date(Date.parse(NOW) + index * 1000).toISOString(),
      });
    }
    await store.put("jobs", { ...first, id: base.id, status: "queued", finishedAt: null });
    await pruneFinishedJobs(20);
    const jobs = await readJobViews();
    expect(jobs).toHaveLength(21);
    expect(jobs.some((job) => job.id === base.id)).toBe(true);
  });
});

describe("links", () => {
  it("opens packs for pack/deck results and the filtered Cards tab for cards", () => {
    expect(jobResultHref({ kind: "pack", packName: "starter", deckId: null, count: 5, decksAdded: 1, duplicates: 0 })).toBe(
      "/library?pack=starter",
    );
    expect(jobResultHref({ kind: "cards", packName: "starter", deckId: "basics", count: 5, decksAdded: 0, duplicates: 0 })).toBe(
      "/library?pack=starter&deck=basics",
    );
  });
});
