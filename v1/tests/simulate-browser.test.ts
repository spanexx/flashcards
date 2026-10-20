// WHY: This is the post-implementation rehearsal from the PRD contract. It
// walks the learner's promises against the real browser router and the memory
// store, then checks the static build wrote the pages. It makes no network call.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { localGet, localSend } from "@/lib/browser/router";
import { PACK_BUNDLE_SCHEMA, exportBackup, importBundle, restoreBackup } from "@/lib/browser/bundle";
import { readCards, readProviderKey, writeMeta, writeProviderKey } from "@/lib/browser/repository";
import { ApiError } from "@/lib/client/errors";
import type { Card, Plan } from "@/lib/shared/types";

const seedPath = fileURLToPath(new URL("../public/packs/polish-starter.json", import.meta.url));
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function line(message: string): void {
  console.log(`-> ${message}`);
}

function exampleFromPrompt(prompt: string): string {
  const at = prompt.lastIndexOf("Return JSON shaped like this");
  const start = prompt.indexOf("{", at);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < prompt.length; index += 1) {
    const char = prompt[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return prompt.slice(start, index + 1);
    }
  }
  throw new Error("the authoring prompt had no example");
}

function miniBundle(): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name: "sim-pack", version: "1.0.0", language: "pl" },
    decks: [{ id: "greetings", name: "Greetings" }],
    cards: [
      {
        deckId: "greetings",
        summary: "Dzień dobry",
        prompt: [{ type: "text", text: "Dzień " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: "Dzień dobry." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["dobry"] }] },
        hints: ["A greeting."],
        fullLine: "Dzień dobry.",
      },
    ],
  });
}

let store: Store;

beforeEach(async () => {
  store = new MemoryStore();
  setBrowserStore(store);
  await writeMeta("seeded", "yes", store);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
});

describe("browser simulation contract", () => {
  it("walks every promise without a server", async () => {
    const seed = await readFile(seedPath, "utf8");
    const seeded = await importBundle(seed, { kind: "new" });
    expect(seeded.ok).toBe(true);
    const packs = await localGet<{ packs: Array<{ name: string; cardCount: number; decks?: unknown[] }> }>("/api/packs");
    expect(packs.packs).toHaveLength(1);
    expect(packs.packs[0].cardCount).toBe(32);
    expect(packs.packs[0].decks).toHaveLength(6);
    line("seeds the Polish pack: 1 pack, 6 decks, 32 cards");

    const made = await localSend<{ pack: { name: string } }>("/api/packs", "POST", {
      name: "sim-pack",
      version: "1.0.0",
      deckName: "Greetings",
      deckId: "greetings",
    });
    expect(made.pack.name).toBe("sim-pack");
    const created = await localSend<{ card: Card }>("/api/cards", "POST", {
      front: "Do zobaczenia",
      back: "See you later",
      packName: "sim-pack",
      deckId: "greetings",
    });
    const after = await localGet<{ cards: Card[] }>("/api/cards");
    expect(after.cards.some((card) => card.id === created.card.id)).toBe(true);
    line("creates a pack + deck + card; reading it back keeps it");

    let refusal: ApiError | null = null;
    try {
      await localSend("/api/packs/import", "POST", {
        json: JSON.stringify({ schema: PACK_BUNDLE_SCHEMA, pack: { name: "bad", version: "1.0.0" }, decks: [], cards: [{ deckId: "gone" }] }),
        target: { kind: "new" },
      });
    } catch (error) {
      refusal = error as ApiError;
    }
    expect(refusal).toBeInstanceOf(ApiError);
    const issues = refusal?.detail as Array<{ index: number; field: string }>;
    expect(issues[0].index).toBe(0);
    expect(issues[0].field).toBeTruthy();
    line(`refuses a bad bundle with item ${issues[0].index} and field ${issues[0].field}`);

    const flat = await localSend<{ imported: number; duplicates: number }>("/api/cards/import", "POST", {
      json: JSON.stringify([{ front: "Dobranoc", back: "Good night" }]),
      packName: "sim-pack",
      deckId: "greetings",
    });
    expect(flat.imported).toBe(1);
    const repeat = await localSend<{ imported: number; duplicates: number }>("/api/cards/import", "POST", {
      json: JSON.stringify([{ front: "Dobranoc", back: "Good night" }]),
      packName: "sim-pack",
      deckId: "greetings",
    });
    expect(repeat.duplicates).toBe(1);
    line("imports cards into a deck; the repeat is reported as a duplicate");

    const deckOnly = JSON.stringify({
      schema: PACK_BUNDLE_SCHEMA,
      pack: { name: "sim-pack", version: "1.0.0" },
      decks: [{ id: "farewells", name: "Farewells" }],
      cards: [],
    });
    const addedDeck = await localSend<{ decksAdded: number }>("/api/packs/import", "POST", {
      json: deckOnly,
      target: { kind: "pack", packName: "sim-pack" },
    });
    expect(addedDeck.decksAdded).toBe(1);
    line("adds one deck to an existing pack");

    const newer = await importBundle(miniBundle().replace("1.0.0", "1.1.0"), { kind: "new" });
    const older = await importBundle(miniBundle(), { kind: "new" });
    expect(newer.ok).toBe(true);
    expect(older.ok).toBe(false);
    line("a newer version adds; an older version is refused");

    const plan = await localGet<{ plan: Plan | null }>("/api/plan");
    const deckIds = new Set(plan.plan?.cards.map((card) => card.deckId) ?? []);
    expect(deckIds.size).toBeGreaterThan(1);
    line(`the plan draws across ${deckIds.size} decks`);

    const cards = await readCards(store);
    const hinted = cards.find((card) => (card.hints ?? []).length > 0);
    expect(hinted).toBeTruthy();
    const hint = await localSend<{ source: string; providerMessage: string | null }>("/api/provider/hint", "POST", {
      cardId: hinted?.id,
      approved: true,
    });
    expect(hint.source).toBe("pack");
    expect(hint.providerMessage).toContain("No provider");
    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "test-model" },
    });
    await writeProviderKey("simulation-key", store);
    const status = await localGet<{ provider: { keyStore: string; hasKey: boolean } }>("/api/settings");
    expect(status.provider.keyStore).toBe("browser");
    line("no-key hint falls back to the pack; the key-present path is named");

    const backup = await exportBackup();
    expect(backup).not.toContain("simulation-key");
    const restored = await restoreBackup(backup);
    expect(restored.ok).toBe(true);
    expect(await readProviderKey(store)).toBe("simulation-key");
    line("backup excludes the key; restore replaces the library and keeps the key");

    const broken = JSON.parse(backup) as { evidence: unknown[] };
    broken.evidence.push({ id: "bad-row", cardId: "card", attemptId: "try", outcome: "perfect" });
    let refused: ApiError | null = null;
    try {
      await localSend("/api/backup/restore", "POST", { json: JSON.stringify(broken) });
    } catch (error) {
      refused = error as ApiError;
    }
    expect(refused).toBeInstanceOf(ApiError);
    expect(await readProviderKey(store)).toBe("simulation-key");
    line("a backup with a bad evidence row is refused and changes nothing");

    const prompt = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "deck", packName: "sim-pack", deckId: "greetings" },
    });
    expect(prompt.prompt).toContain('"greetings"');
    expect(prompt.prompt).toContain("sim-pack");
    const answer = await localSend<{ cardsAdded: number }>("/api/packs/import", "POST", {
      json: exampleFromPrompt(prompt.prompt),
      target: { kind: "deck", packName: "sim-pack", deckId: "greetings" },
    });
    expect(answer.cardsAdded).toBe(1);
    line("the authoring prompt names real ids; its example imports back");

    expect(existsSync(`${projectRoot}/out/index.html`)).toBe(true);
    expect(existsSync(`${projectRoot}/out/library/index.html`)).toBe(true);
    expect(existsSync(`${projectRoot}/out/settings/index.html`)).toBe(true);
    line("the static build wrote the study, library and settings pages");
  });
});
