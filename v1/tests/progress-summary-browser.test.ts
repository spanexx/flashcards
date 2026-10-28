// WHY: The summary may leave the machine only after the learner sees the exact
// payload. The payload is compact categories, never card text, and the answer is
// returned to the screen without writing a summary row.
// PACK: progress-summary
// 2026-10-27 opencode: created for the progress summary pack [pack: progress-summary]

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { importBundle, PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { patchSettings, readCards, readPromptLog, writeProviderKey } from "@/lib/browser/repository";
import { localSend } from "@/lib/browser/router";
import {
  clearHeldSummariesForTests,
  generateProgressSummary,
  prepareProgressSummary,
} from "@/lib/browser/summary";

function oneCard(): string {
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
        topics: ["basics"],
      },
    ],
  });
}

let store: Store;

beforeEach(async () => {
  store = new MemoryStore();
  setBrowserStore(store);
  clearHeldSummariesForTests();
  await importBundle(oneCard(), { kind: "pack" });
});

afterEach(() => {
  clearHeldSummariesForTests();
  vi.unstubAllGlobals();
});

describe("the summary preview", () => {
  it("shows the compact payload without card text", async () => {
    await patchSettings(
      { provider: { url: "http://provider.test/v1", model: "test-model" } },
      store,
    );
    await writeProviderKey("test-key", store);
    const [card] = await readCards(store);
    await localSend("/api/answer", "POST", {
      cardId: card.id,
      answers: { b1: "kawę" },
      timeMs: 1000,
    });

    const prepared = await prepareProgressSummary();
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.prompt).toContain('"cards": 1');
    expect(prepared.prompt).not.toContain("Piję kawę");
    expect(prepared.prompt).not.toContain("kawę.");
  });

  it("refuses before holding anything when no provider is set up", async () => {
    const prepared = await prepareProgressSummary();
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.message).toContain("No provider");
  });
});

describe("the sent summary", () => {
  it("returns the answer once and logs the exact prompt", async () => {
    await patchSettings(
      { provider: { url: "http://provider.test/v1", model: "test-model" } },
      store,
    );
    await writeProviderKey("test-key", store);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "You have one card." } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const prepared = await prepareProgressSummary();
    if (!prepared.ok) throw new Error(prepared.message);
    const text = await generateProgressSummary(prepared.requestId);
    expect(text).toBe("You have one card.");

    const log = await readPromptLog(50, store);
    expect(log[0].kind).toBe("summary");
    expect(log[0].prompt).toBe(prepared.prompt);
    await expect(generateProgressSummary(prepared.requestId)).rejects.toThrow("expired");
  });
});
