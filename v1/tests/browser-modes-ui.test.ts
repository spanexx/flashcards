// WHY: Mode Studio screens call apiGet/apiSend, not the router internals. These
// tests walk the exact URLs the screens use so a passing unit test cannot hide
// a broken path between a screen and the mode store.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created RED before the UI existed. [pack: mode-studio-ui]

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { readModes, writeMode } from "@/lib/browser/repository";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { apiGet, apiSend } from "@/lib/client/api";
import type { LearningMode } from "@/lib/shared/types";
import { modeIssueLines, previewCardsFromExample } from "@/app/library/mode-studio-utils";

let store: Store;

beforeEach(async () => {
  store = new MemoryStore();
  setBrowserStore(store);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** One schema-valid mode body, valid unless a case changes one fact. */
function modeBody(overrides: Partial<LearningMode> = {}): LearningMode {
  return {
    id: "grammar-roles",
    name: "Grammar roles",
    description: "Study the jobs words do.",
    version: "1.0.0",
    defaultCardMix: ["cloze", "picks", "type"],
    usesWordStages: false,
    skillInstructions: "Name each role in plain English.",
    canonicalExample: {
      schema: PACK_BUNDLE_SCHEMA,
      pack: { name: "mode-demo-grammar-roles", version: "1.0.0" },
      decks: [{ id: "doer", name: "Doer" }],
      cards: [
        {
          deckId: "doer",
          summary: "The doer",
          prompt: [
            { type: "text", text: "The doer is the" },
            { type: "blank", id: "b1" },
            { type: "text", text: "." },
          ],
          answer: [{ type: "text", text: "The doer is the subject." }],
          answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["subject"] }] },
        },
      ],
      words: [],
      pages: [],
    },
    isBuiltIn: false,
    createdAt: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

function briefWithMode() {
  return {
    subjectMode: "learner",
    subject: "ordering coffee",
    cardStyle: "mixed",
    targetLanguage: "pl",
    sourceLanguage: "en",
    modeId: "my-roles",
    modePreferences: "Short lines",
  };
}

function replyWith(content: unknown): void {
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

describe("mode studio list and CRUD through the screen API", () => {
  it("lists built-ins first, then custom modes by name", async () => {
    await writeMode(modeBody({ id: "zeta", name: "Zeta" }), store);
    await writeMode(modeBody({ id: "alpha", name: "Alpha" }), store);
    await writeMode(modeBody({ id: "grammar-roles", name: "Grammar roles", isBuiltIn: true }), store);

    const result = await apiGet<{ modes: LearningMode[]; folder: string }>("/api/modes");
    expect(result.modes.map((entry) => entry.id)).toEqual(["grammar-roles", "alpha", "zeta"]);
    expect(result.folder).toBeTruthy();
  });

  it("duplicates a built-in into a learner-owned copy and leaves the source alone", async () => {
    const builtIn = modeBody({ id: "grammar-roles", name: "Grammar roles", isBuiltIn: true });
    await writeMode(builtIn, store);

    const created = await apiSend<{ mode: LearningMode }>("/api/modes", "POST", {
      sourceModeId: "grammar-roles",
      name: "My roles",
    });

    expect(created.mode).toMatchObject({
      id: "my-roles",
      name: "My roles",
      isBuiltIn: false,
      sourceModeId: "grammar-roles",
    });
    expect((await readModes(store)).find((entry) => entry.id === "grammar-roles")).toMatchObject({
      name: "Grammar roles",
      isBuiltIn: true,
    });
  });

  it("refuses built-in edits and deletes through the same API", async () => {
    await writeMode(modeBody({ id: "grammar-roles", name: "Grammar roles", isBuiltIn: true }), store);
    await expect(apiSend("/api/modes/grammar-roles", "PATCH", { name: "Hijack" })).rejects.toThrow(
      "A built-in learning mode cannot be edited.",
    );
    await expect(apiSend("/api/modes/grammar-roles", "DELETE")).rejects.toThrow(
      "A built-in learning mode cannot be deleted.",
    );
  });

  it("names an invalid card mix and a missing name on Save", async () => {
    await expect(
      apiSend("/api/modes", "POST", { ...modeBody(), name: "   " }),
    ).rejects.toThrow("Give the learning mode a name.");
    const badMix = await apiSend("/api/modes", "POST", {
      ...modeBody(),
      id: "bad-mix",
      defaultCardMix: ["shout"],
    }).catch((error: unknown) => error);
    expect(modeIssueLines(badMix).join(" ")).toContain("defaultCardMix.0: Invalid option");
  });

  it("previews an example without writing anything", async () => {
    await writeMode(modeBody(), store);
    const before = await readModes(store);
    const cards = previewCardsFromExample(modeBody());
    expect(cards[0]?.revealAnswers).toEqual({ b1: "subject" });
    expect(await readModes(store)).toEqual(before);
  });
});

describe("AI creator through the screen API", () => {
  it("prepares a versioned prompt and sends a draft without saving it", async () => {
    await apiSend("/api/settings", "PATCH", { provider: { url: "https://provider.test/v1", model: "test" } });
    await apiSend("/api/provider/key", "POST", { key: "secret" });
    const prepared = await apiSend<{ requestId: string; prompt: string; version: string }>(
      "/api/modes/draft",
      "POST",
      { instruction: "Roles in plain English." },
    );
    expect(prepared.version).toBe("1.0.1");
    expect(prepared.prompt).toContain("Roles in plain English.");
    expect(await readModes(store)).toHaveLength(0);

    replyWith(modeBody({ id: "drafted-mode", name: "Drafted mode" }));
    const sent = await apiSend<{ mode: LearningMode }>("/api/modes/draft/send", "POST", {
      requestId: prepared.requestId,
    });
    expect(sent.mode.id).toBe("drafted-mode");
    expect(await readModes(store)).toHaveLength(0);
  });
});

describe("mode selection through the screen brief", () => {
  it("puts a selected mode into both prompt lanes", async () => {
    await writeMode(modeBody({ id: "my-roles", name: "My roles", skillInstructions: "MY-ROLES-SKILL." }), store);
    const generated = await apiSend<{ prompt: string }>("/api/provider/prepare", "POST", {
      target: { kind: "pack" },
      count: 1,
      brief: briefWithMode(),
    });
    const chat = await apiSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "pack" },
      brief: briefWithMode(),
    });
    expect(generated.prompt).toContain("MY-ROLES-SKILL.");
    expect(chat.prompt).toContain("MY-ROLES-SKILL.");
  });
});
