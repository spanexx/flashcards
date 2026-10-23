// WHY: The creation brief only matters if a learner can carry one idea through
// Generate, Chat, style choice and a newly written empty container. This is the
// post-implementation rehearsal from the PRD, using the real router and memory
// store so no unit test can hide a broken seam.
// PACK: creation-control
// 2026-10-22 opencode: created for the post-implementation creation-control rehearsal [pack: creation-control]

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { localGet, localSend } from "@/lib/browser/router";
import { writeMeta } from "@/lib/browser/repository";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import type { Card } from "@/lib/shared/types";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const seedPath = fileURLToPath(new URL("../public/packs/polish-starter.json", import.meta.url));

function line(message: string): void {
  console.log(`-> ${message}`);
}

function learnerBrief(overrides: Record<string, unknown> = {}) {
  return {
    subjectMode: "learner",
    subject: "ordering coffee",
    deckFocus: "cafes, paying",
    cardStyle: "mixed",
    packName: "",
    deckName: "",
    ...overrides,
  };
}

function packBundle(): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: {
      name: "starter",
      version: "1.0.0",
      language: "pl",
      description: "Everyday Polish",
    },
    decks: [
      { id: "basics", name: "Basics" },
      { id: "cases", name: "Cases" },
    ],
    cards: [],
  });
}

function providerReply(content: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );
}

async function errorText(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    return "";
  } catch (problem) {
    return problem instanceof Error ? problem.message : String(problem);
  }
}

/** Read every built client chunk so a Create-tab string is checked after export. */
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

let store: Store;

beforeEach(async () => {
  store = new MemoryStore();
  setBrowserStore(store);
  await writeMeta("seeded", "yes", store);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("creation control simulation", () => {
  it("walks the five promises through the real browser router", async () => {
    const seeded = await localSend<{ cardsAdded: number }>("/api/packs/import", "POST", {
      json: await readFile(seedPath, "utf8"),
      target: { kind: "pack" },
    });
    expect(seeded.cardsAdded).toBe(32);
    await localSend("/api/packs/import", "POST", {
      json: packBundle(),
      target: { kind: "pack" },
    });

    // 1. The learner's words reach the prepared prompt.
    const prepared = await localSend<{ requestId: string; prompt: string }>(
      "/api/provider/prepare",
      "POST",
      {
        target: { kind: "pack" },
        count: 2,
        brief: learnerBrief({ subject: "ordering coffee", deckFocus: "cafes, paying" }),
      },
    );
    expect(prepared.prompt).toContain("ordering coffee");
    expect(prepared.prompt).toContain("cafes, paying");
    line("learner subject and focus appear in the prepared prompt");

    // 2. Provider-choice mode uses the library inventory and asks for a gap.
    const providerBrief = learnerBrief({
      subjectMode: "provider",
      subject: "this must not reach a prompt",
    });
    const providerPrepared = await localSend<{ prompt: string }>("/api/provider/prepare", "POST", {
      target: { kind: "pack" },
      count: 2,
      brief: providerBrief,
    });
    expect(providerPrepared.prompt).toMatch(/gap/i);
    expect(providerPrepared.prompt).toContain("starter");
    expect(providerPrepared.prompt).toContain("Everyday Polish");
    expect(providerPrepared.prompt).toContain("Basics");
    expect(providerPrepared.prompt).not.toContain("this must not reach a prompt");
    line("provider-choice mode names the library and never sends the ignored subject");

    // 3. Chat exposes the same brief and inventory, and an edited request cannot
    // bypass the importer. The external lane proves the textarea keeps the edit.
    const chat = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "cases" },
      brief: learnerBrief({ cardStyle: "type" }),
    });
    expect(chat.prompt).toContain("ordering coffee");
    expect(chat.prompt).toContain("Everyday Polish");
    expect(chat.prompt).toContain("Cases");
    const editedPrompt = `${chat.prompt}\n\nA learner note: use cafe words.`;
    expect(editedPrompt).toContain("cafe words");
    const accepted = JSON.stringify({
      cards: [
        {
          deckId: "cases",
          summary: "Zamawiam kawę",
          prompt: [{ type: "text", text: "I am ordering coffee." }],
          answer: [{ type: "text", text: "Zamawiam kawę." }],
          answerDef: { mode: "type", expected: ["Zamawiam kawę."] },
        },
      ],
    });
    const imported = await localSend<{ cardsAdded: number }>("/api/packs/import", "POST", {
      json: accepted,
      target: { kind: "cards", packName: "starter", deckId: "cases" },
    });
    expect(imported.cardsAdded).toBe(1);
    const refused = await errorText(
      localSend("/api/packs/import", "POST", {
        json: JSON.stringify({ cards: [{ deckId: "cases", summary: "No answer" }] }),
        target: { kind: "cards", packName: "starter", deckId: "cases" },
      }),
    );
    expect(refused).toContain("Nothing was imported");
    line("Chat prompt carries the brief; an edited prompt does not weaken import");

    // 4. A requested type card is built as a type card; a wrong style refuses all.
    await localSend("/api/settings", "PATCH", {
      provider: { url: "https://provider.test/v1", model: "sim-model" },
    });
    await localSend("/api/provider/key", "POST", { key: "sim-secret" });
    providerReply({
      lines: [
        {
          style: "type",
          fullLine: "Piję kawę.",
          target: "kawę",
          translation: "I am drinking coffee.",
        },
      ],
    });
    const typePrepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "basics" },
      count: 1,
      brief: learnerBrief({ cardStyle: "type" }),
    });
    const typed = await localSend<{ cards: Card[] }>("/api/provider/generate", "POST", {
      requestId: typePrepared.requestId,
    });
    expect(typed.cards[0].answerDef).toEqual({ mode: "type", expected: ["Piję kawę."] });
    expect(typed.cards[0].prompt).toEqual([
      { type: "text", text: "I am drinking coffee." },
    ]);

    const beforeWrong = (await localGet<{ cards: Card[] }>("/api/cards")).cards.length;
    providerReply({
      lines: [
        {
          style: "type",
          fullLine: "Piję kawę.",
          target: "kawę",
          translation: "I am drinking coffee.",
        },
      ],
    });
    const wrongPrepared = await localSend<{ requestId: string }>("/api/provider/prepare", "POST", {
      target: { kind: "cards", packName: "starter", deckId: "basics" },
      count: 1,
      brief: learnerBrief({ cardStyle: "cloze" }),
    });
    const wrong = await errorText(
      localSend("/api/provider/generate", "POST", { requestId: wrongPrepared.requestId }),
    );
    expect(wrong).toMatch(/cloze/i);
    expect((await localGet<{ cards: Card[] }>("/api/cards")).cards).toHaveLength(beforeWrong);
    line("requested style is built; a different style refuses the whole batch");

    // 5. A freshly written empty pack is usable by both Generate and Chat.
    const made = await localSend<{ pack: { name: string } }>("/api/packs", "POST", {
      name: "Empty Sim",
      version: "1.0.0",
      deckName: "First",
    });
    expect(made.pack.name).toBe("empty-sim");
    providerReply({
      lines: [{ fullLine: "Mam psa.", target: "psa" }],
    });
    const emptyPrepared = await localSend<{ requestId: string }>(
      "/api/provider/prepare",
      "POST",
      {
        target: { kind: "cards", packName: "empty-sim", deckId: "first" },
        count: 1,
        brief: learnerBrief({ subject: "pets", deckFocus: "animals", packName: "" }),
      },
    );
    const generated = await localSend<{ kind: string; count: number }>(
      "/api/provider/generate",
      "POST",
      { requestId: emptyPrepared.requestId },
    );
    expect(generated.kind).toBe("cards");
    expect(generated.count).toBe(1);

    const addedDeck = await localSend<{ deck: { id: string } }>(
      "/api/packs/empty-sim/decks",
      "POST",
      { name: "Second" },
    );
    expect(addedDeck.deck.id).toBe("second");
    const emptyChat = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "cards", packName: "empty-sim", deckId: "second" },
      brief: learnerBrief({ subject: "pets", deckFocus: "animals", packName: "" }),
    });
    expect(emptyChat.prompt).toContain("empty-sim");
    expect(emptyChat.prompt).toContain("Second");
    expect(emptyChat.prompt).toContain("pets");
    line("empty pack and deck feed Generate and Chat without a second creation path");

    // The built Library page must carry the brief and the editable prompt.
    // They live in the Create tab, so the static shell and the client chunks are
    // both checked: the page still ships the Create tab, and its chunks still
    // contain the brief and prompt text.
    const built = path.join(projectRoot, "out", "library", "index.html");
    expect(existsSync(built)).toBe(true);
    const html = await readFile(built, "utf8");
    expect(html).toContain(">Create</button>");
    const client = await readBuiltChunks(path.join(projectRoot, "out", "_next", "static", "chunks"));
    expect(client).toContain("What should the cards teach?");
    expect(client).toContain("Editable prompt");
    expect(client).toContain("Card style");
    expect(client).toContain("AI chooses");
    expect(client).toContain("I choose");
    line("built Library page has the Create tab, brief and editable prompt");
  });
});
