// WHY: The repair action must show the exact refused text, send only on the
// learner's second press, and save only when the normal validator accepts the
// answer. These tests walk the failed job through that whole path.
// PACK: import-repair
// 2026-10-27 opencode: created for the import repair pack [pack: import-repair]

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { importBundle, PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { patchSettings, readCards, readPromptLog, writeProviderKey } from "@/lib/browser/repository";
import {
  createJobRunner,
  enqueueImportJob,
  readJobViews,
  resetJobRuntimeForTests,
  type JobRunner,
} from "@/lib/browser/jobs";
import {
  clearHeldRepairsForTests,
  prepareImportRepair,
  repairImportJob,
} from "@/lib/browser/import-repair";

function cleanPack(): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name: "starter", version: "1.0.0", language: "pl" },
    decks: [{ id: "basics", name: "Basics" }],
    cards: [],
  });
}

function fixedCards(): string {
  return JSON.stringify({
    cards: [
      {
        deckId: "basics",
        summary: "Nowa karta",
        prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: "Piję kawę." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
      },
    ],
  });
}

function providerReply(text: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: text } }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

let store: Store;
let runner: JobRunner | null = null;

beforeEach(async () => {
  store = new MemoryStore();
  setBrowserStore(store);
  resetJobRuntimeForTests();
  clearHeldRepairsForTests();
  await patchSettings(
    { provider: { url: "http://provider.test/v1", model: "test-model" } },
    store,
  );
  await writeProviderKey("test-key", store);
});

afterEach(() => {
  runner?.stop();
  resetJobRuntimeForTests();
  clearHeldRepairsForTests();
  vi.unstubAllGlobals();
});

async function failedImport(): Promise<string> {
  await importBundle(cleanPack(), { kind: "pack" });
  runner = createJobRunner();
  const queued = await enqueueImportJob({
    text: '{"cards": [',
    target: { kind: "cards", packName: "starter", deckId: "basics" },
  });
  await runner.wake();
  const [job] = await readJobViews();
  expect(job.id).toBe(queued.id);
  expect(job.status).toBe("failed");
  return job.id;
}

describe("the preview", () => {
  it("holds the exact refused text and sends nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const jobId = await failedImport();

    const prepared = await prepareImportRepair(jobId);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.prompt).toContain('{"cards": [');
    expect(prepared.prompt).toContain("The validator said:");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the sent repair", () => {
  it("saves only the validated answer and marks the job repaired", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => providerReply(fixedCards())));
    const jobId = await failedImport();
    const prepared = await prepareImportRepair(jobId);
    if (!prepared.ok) throw new Error(prepared.message);

    const result = await repairImportJob(prepared.requestId);
    expect(result.ok).toBe(true);
    expect(await readCards(store)).toHaveLength(1);
    expect((await readCards(store))[0].summary).toBe("Nowa karta");

    const [job] = await readJobViews();
    expect(job.status).toBe("succeeded");
    expect(job.result?.repairedByAI).toBe(true);

    const log = await readPromptLog(50, store);
    expect(log[0].kind).toBe("import-repair");
    expect(log[0].prompt).toContain('{"cards": [');
  });

  it("keeps the job failed and writes nothing when the answer still fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => providerReply('{"cards": [')));
    const jobId = await failedImport();
    const prepared = await prepareImportRepair(jobId);
    if (!prepared.ok) throw new Error(prepared.message);

    const result = await repairImportJob(prepared.requestId);
    expect(result.ok).toBe(false);
    expect(await readCards(store)).toHaveLength(0);
    const [job] = await readJobViews();
    expect(job.status).toBe("failed");
    expect(job.result).toBeNull();
  });

  it("cannot be sent twice", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => providerReply(fixedCards())));
    const jobId = await failedImport();
    const prepared = await prepareImportRepair(jobId);
    if (!prepared.ok) throw new Error(prepared.message);

    expect((await repairImportJob(prepared.requestId)).ok).toBe(true);
    const again = await repairImportJob(prepared.requestId);
    expect(again.ok).toBe(false);
  });
});
