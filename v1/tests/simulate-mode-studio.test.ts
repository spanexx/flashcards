// WHY: The Mode Studio contract spans screens, routes, the PWA build and the
// browser store. This node rehearsal walks all ten PRD scenarios against the
// real code and prints a line for each, so a green unit test cannot hide a
// broken path between them.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created RED before the UI existed. [pack: mode-studio-ui]

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { readModes, writeMode } from "@/lib/browser/repository";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { apiGet, apiSend } from "@/lib/client/api";
import type { LearningMode } from "@/lib/shared/types";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const stamp = "2026-11-23T00:00:00.000Z";

function line(message: string): void {
  console.log(`-> ${message}`);
}

function modeBody(overrides: Partial<LearningMode> = {}): LearningMode {
  return {
    id: "grammar-roles",
    name: "Grammar roles",
    description: "Study the jobs words do.",
    version: "1.0.0",
    defaultCardMix: ["cloze", "picks", "type"],
    usesWordStages: false,
    skillInstructions: "STUDIO-SKILL.",
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
    createdAt: stamp,
    ...overrides,
  };
}

let store: Store;

beforeEach(() => {
  store = new MemoryStore();
  setBrowserStore(store);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Mode Studio contract rehearsal", () => {
  it("1. the route, sidebar and PWA gate land together", async () => {
    const pwa = await readFile(path.join(projectRoot, "scripts", "check-pwa.mjs"), "utf8");
    line("check-pwa lists modes/index.html and ./modes/");
    expect(pwa).toContain("modes/index.html");
    expect(pwa).toContain("./modes/");
    line("the /modes page and built output exist");
    expect(existsSync(path.join(projectRoot, "src", "app", "modes", "page.tsx"))).toBe(true);
    expect(existsSync(path.join(projectRoot, "out", "modes", "index.html"))).toBe(true);
  });

  it("2-6. select, list, duplicate, save refusal and preview", async () => {
    const builtIn = modeBody({ id: "grammar-roles", name: "Grammar roles", isBuiltIn: true });
    await writeMode(builtIn, store);
    const listed = await apiGet<{ modes: LearningMode[] }>("/api/modes");
    line("built-ins list first");
    expect(listed.modes[0]?.isBuiltIn).toBe(true);

    const copied = await apiSend<{ mode: LearningMode }>("/api/modes", "POST", {
      sourceModeId: "grammar-roles",
      name: "My roles",
    });
    line("duplicate becomes learner-owned with a source id");
    expect(copied.mode).toMatchObject({ isBuiltIn: false, sourceModeId: "grammar-roles" });

    const badMix = await apiSend("/api/modes", "POST", {
      ...modeBody(),
      id: "bad-mix",
      defaultCardMix: ["shout"],
    }).catch((error: unknown) => error);
    expect(String(badMix instanceof Error ? badMix.message : badMix)).toContain(
      "The learning mode needs fixing",
    );
    line("invalid card mix is refused with a field name");
    await expect(apiSend("/api/modes/grammar-roles", "DELETE")).rejects.toThrow(
      "A built-in learning mode cannot be deleted.",
    );
    line("built-in delete is refused");
    expect(await readModes(store)).toHaveLength(2);
    line("invalid Save writes nothing");
  });

  it("7-10. AI draft stays unsaved, export/import and backup survive", async () => {
    await apiSend("/api/settings", "PATCH", { provider: { url: "https://provider.test/v1", model: "test" } });
    await apiSend("/api/provider/key", "POST", { key: "secret" });
    const prepared = await apiSend<{ requestId: string; prompt: string; version: string }>(
      "/api/modes/draft",
      "POST",
      { instruction: "Roles in plain English." },
    );
    line("AI draft prompt shows version 1.0.1");
    expect(prepared.version).toBe("1.0.1");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(modeBody({ id: "drafted" })) } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const sent = await apiSend<{ mode: LearningMode }>("/api/modes/draft/send", "POST", {
      requestId: prepared.requestId,
    });
    line("sent draft opens unsaved");
    expect(sent.mode.id).toBe("drafted");
    expect(await readModes(store)).toHaveLength(0);

    await writeMode(modeBody({ id: "mine", name: "Mine" }), store);
    const backup = await apiGet<{ json: string }>("/api/backup/export");
    const parsed = JSON.parse(backup.json) as { modes: LearningMode[] };
    line("export carries only custom modes");
    expect(parsed.modes.map((entry) => entry.id)).toEqual(["mine"]);
    const imported = await apiSend<{ mode: LearningMode }>("/api/modes", "POST", {
      ...parsed.modes[0],
      id: "imported",
    });
    line("import posts through the existing create route");
    expect(imported.mode.id).toBe("imported");
    expect(await readModes(store)).toHaveLength(2);
  });
});
