// WHY: Repair is only useful if it reaches the import lanes a learner uses.
// These tests pin that a sloppy cards bundle imports through the library and a
// job, that a clean file stays silent, that a truncated file still writes
// nothing, and that a backup stays strict.
// PACK: study-resilience
// 2026-10-26 opencode: created for the study resilience pack [pack: study-resilience]

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import {
  exportBackup,
  importBundle,
  PACK_BUNDLE_SCHEMA,
  restoreBackup,
} from "@/lib/browser/bundle";
import { readCards, readPacks } from "@/lib/browser/repository";
import {
  createJobRunner,
  enqueueImportJob,
  readJobViews,
  resetJobRuntimeForTests,
  type JobRunner,
} from "@/lib/browser/jobs";
import { importCards } from "@/lib/core/import";

const NOW = "2026-10-26T12:00:00.000Z";

/** A card source the bundle schema accepts, with a unique summary. */
function source(summary: string) {
  return {
    summary,
    prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
    answer: [{ type: "text", text: "Piję kawę." }],
    answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
    hints: ["Accusative."],
    fullLine: "Piję kawę.",
  };
}

/** A clean pack with one deck and no cards, so fragments have a home. */
function cleanPack(name = "starter"): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name, version: "1.0.0", language: "pl" },
    decks: [{ id: "basics", name: "Basics" }],
    cards: [],
  });
}

/**
 * A cards fragment as a learner types it by hand: a byte-order mark, a fence,
 * a comment, a bare key, single quotes, curly quotes and a trailing comma.
 */
function sloppyCards(summary = "Nowa karta"): string {
  return [
    "\uFEFF```json",
    "{",
    "  // typed by hand",
    "  cards: [",
    "    {",
    "      deckId: 'basics',",
    `      summary: “${summary}”,`,
    '      prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],',
    '      answer: [{ type: "text", text: "Piję kawę." }],',
    '      answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },',
    '      hints: ["Accusative."],',
    '      fullLine: "Piję kawę.",',
    "    },",
    "  ],",
    "}",
    "```",
  ].join("\n");
}

function cardsTarget() {
  return { kind: "cards" as const, packName: "starter", deckId: "basics" };
}

let store: Store;
let runner: JobRunner | null = null;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
  resetJobRuntimeForTests();
});

afterEach(() => {
  runner?.stop();
  resetJobRuntimeForTests();
});

describe("a bundle import repairs before it refuses", () => {
  it("imports a sloppy cards bundle and reports every kind it fixed", async () => {
    await importBundle(cleanPack(), { kind: "pack" });
    const result = await importBundle(sloppyCards(), cardsTarget());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cardsAdded).toBe(1);
    expect(result.repairs).toEqual(
      expect.arrayContaining([
        "bom",
        "code-fence",
        "smart-quotes",
        "comments",
        "trailing-comma",
        "unquoted-key",
        "single-quoted-string",
      ]),
    );

    const card = (await readCards(store)).find((entry) => entry.summary === "Nowa karta");
    expect(card?.deckId).toBe("basics");
    expect(card?.answer[0]).toEqual({ type: "text", text: "Piję kawę." });
  });

  it("says nothing about repair for a clean bundle", async () => {
    await importBundle(cleanPack(), { kind: "pack" });
    const result = await importBundle(
      JSON.stringify({ cards: [{ ...source("Czysta karta"), deckId: "basics" }] }),
      cardsTarget(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.repairs).toBeUndefined();
  });

  it("still writes nothing and names the problem for a truncated bundle", async () => {
    await importBundle(cleanPack(), { kind: "pack" });
    const before = (await readCards(store)).length;
    const result = await importBundle('{"cards": [{"summary": "Nowa karta"', cardsTarget());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].message).toContain("not valid JSON");
    }
    expect((await readCards(store)).length).toBe(before);
  });
});

describe("a job carries the repairs", () => {
  it("imports a sloppy file through the runner with repairs on the result", async () => {
    await importBundle(cleanPack(), { kind: "pack" });
    runner = createJobRunner();
    await enqueueImportJob({ text: sloppyCards("Karta z pracy"), target: cardsTarget(), source: "file" });
    await runner.wake();

    const [job] = await readJobViews();
    expect(job.status).toBe("succeeded");
    expect(job.result?.repairs).toEqual(
      expect.arrayContaining(["smart-quotes", "trailing-comma", "unquoted-key"]),
    );
    expect(job.result?.count).toBe(1);
    const card = (await readCards(store)).find((entry) => entry.summary === "Karta z pracy");
    expect(card).toBeTruthy();
  });

  it("keeps a clean job result free of repairs", async () => {
    await importBundle(cleanPack(), { kind: "pack" });
    runner = createJobRunner();
    await enqueueImportJob({
      text: JSON.stringify({ cards: [{ ...source("Bez naprawy"), deckId: "basics" }] }),
      target: cardsTarget(),
    });
    await runner.wake();

    const [job] = await readJobViews();
    expect(job.status).toBe("succeeded");
    expect(job.result?.repairs).toBeUndefined();
  });

  it("fails a truncated import and writes nothing", async () => {
    await importBundle(cleanPack(), { kind: "pack" });
    runner = createJobRunner();
    await enqueueImportJob({ text: '{"cards": [', target: cardsTarget() });
    await runner.wake();

    const [job] = await readJobViews();
    expect(job.status).toBe("failed");
    expect(job.errorDetails.length).toBeGreaterThan(0);
    expect(await readCards(store)).toHaveLength(0);
  });
});

describe("the legacy flat import repairs too", () => {
  it("reads a hand-typed array with single quotes and a trailing comma", () => {
    const result = importCards("[{ front: 'kawa', back: 'coffee', topics: ['basics'] },]", [], NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].answer).toEqual([{ type: "text", text: "coffee" }]);
    }
  });

  it("still refuses text that no repair can save", () => {
    const result = importCards("[{ front: 'kawa'", [], NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].message).toContain("not valid JSON");
  });
});

describe("a backup stays strict", () => {
  it("refuses a backup with a trailing comma and changes nothing", async () => {
    await importBundle(
      JSON.stringify({
        schema: PACK_BUNDLE_SCHEMA,
        pack: { name: "starter", version: "1.0.0", language: "pl" },
        decks: [{ id: "basics", name: "Basics" }],
        cards: [{ ...source("Zapisana karta"), deckId: "basics" }],
      }),
      { kind: "pack" },
    );
    const before = (await readCards(store)).length;
    const backup = await exportBackup();
    const sloppy = `${backup.slice(0, -1)},\n}`;

    const result = await restoreBackup(sloppy);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].message).toContain("not valid JSON");
    expect((await readCards(store)).length).toBe(before);
    expect(await readPacks(store)).toHaveLength(1);
  });
});
