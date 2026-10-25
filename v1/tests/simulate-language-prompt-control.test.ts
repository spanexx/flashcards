// WHY: This is the language-prompt-control rehearsal. It walks the eight PRD
// promises through the real router and memory store, then checks the built
// client carries the new words. The pre-implementation simulation printed a
// design; this one reads real state and fails when a seam drifts.
// PACK: language-prompt-control
// 2026-10-24 opencode: created for the post-implementation rehearsal
// [pack: language-prompt-control]

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { localGet, localSend } from "@/lib/browser/router";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { writeMeta } from "@/lib/browser/repository";
import { listenPrompt, studyCardInstruction, studyModeLabel } from "@/lib/client/study-view";
import { briefForTarget } from "@/app/library/library-utils";
import { defaultCreationBrief, withBriefOnPackText } from "@/lib/shared/creation";
import type { PackStatus, Plan } from "@/lib/shared/types";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const seedPath = fileURLToPath(new URL("../public/packs/polish-starter.json", import.meta.url));

function line(message: string): void {
  console.log(`-> ${message}`);
}

function travelBundle(): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name: "travel", version: "1.0.0", language: "pl", sourceLanguage: "en" },
    decks: [{ id: "station", name: "Station" }],
    cards: [
      {
        deckId: "station",
        summary: "Gdzie jest dworzec?",
        prompt: [{ type: "speak", text: "Gdzie jest dworzec?", lang: "pl" }],
        answer: [{ type: "text", text: "Gdzie jest dworzec?" }],
        answerDef: { mode: "hear_type", expected: ["Gdzie jest dworzec?"] },
        hints: ["A station."],
        fullLine: "Gdzie jest dworzec?",
      },
    ],
  });
}

function typedBundle(): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name: "typed", version: "1.0.0", language: "pl", sourceLanguage: "en" },
    decks: [{ id: "basics", name: "Basics" }],
    cards: [
      {
        deckId: "basics",
        summary: "I drink coffee.",
        prompt: [{ type: "text", text: "I drink coffee." }],
        answer: [{ type: "text", text: "Piję kawę." }],
        answerDef: { mode: "type", expected: ["Piję kawę."] },
        hints: ["Use the first person."],
        fullLine: "Piję kawę.",
      },
    ],
  });
}

function oldBundle(): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name: "old-pack", version: "1.0.0" },
    decks: [{ id: "basics", name: "Basics" }],
    cards: [
      {
        deckId: "basics",
        summary: "Piję kawę.",
        prompt: [{ type: "text", text: "Piję " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
        answer: [{ type: "text", text: "Piję kawę." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["kawę"] }] },
        hints: ["Accusative."],
        fullLine: "Piję kawę.",
      },
    ],
  });
}

async function readTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const parts = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) return readTree(full);
      if (!/\.(js|html|css)$/.test(entry.name)) return "";
      return readFile(full, "utf8");
    }),
  );
  return parts.join("\n");
}

let store: Store;

beforeEach(async () => {
  store = new MemoryStore();
  setBrowserStore(store);
  await writeMeta("seeded", "yes", store);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
});

describe("language and prompt control rehearsal", () => {
  it("walks the eight PRD promises through the real browser router", async () => {
    const newPack = await localSend<{ pack: { name: string; language: string; sourceLanguage: string } }>(
      "/api/packs",
      "POST",
      {
        name: "English Adjectives",
        language: "en",
        sourceLanguage: "en",
        deckName: "Basics",
        deckId: "basics",
      },
    );
    expect(newPack.pack).toMatchObject({ name: "english-adjectives", language: "en", sourceLanguage: "en" });
    const noSource = await localSend<{ pack: { sourceLanguage?: string } }>("/api/packs", "POST", {
      name: "No Source",
      language: "en",
    });
    expect(noSource.pack.sourceLanguage).toBe("en");
    expect(
      studyCardInstruction({ answerDef: { mode: "hear_type" } }, { language: "en", sourceLanguage: "en" }),
    ).toBe("Listen, then type the full line.");
    expect(
      studyCardInstruction({ answerDef: { mode: "picks" } }, { language: "en", sourceLanguage: "en" }),
    ).toBe("Choose the correct meaning.");
    const preview = await localSend<{ prompt: string }>("/api/authoring/prompt", "POST", {
      target: { kind: "pack" },
      brief: {
        subjectMode: "learner",
        subject: "adjectives",
        deckFocus: "",
        cardStyle: "mixed",
        packName: "",
        deckName: "",
        targetLanguage: "en",
        sourceLanguage: "en",
      },
    });
    expect(preview.prompt).toContain("English");
    expect(preview.prompt).not.toContain("Polish");
    expect(preview.prompt).not.toContain("Piję kawę");
    line("an English/English pack previews English and never falls back to Polish");

    const seeded = await localSend<{ cardsAdded: number }>("/api/packs/import", "POST", {
      json: await readFile(seedPath, "utf8"),
      target: { kind: "pack" },
    });
    expect(seeded.cardsAdded).toBe(32);
    await localSend("/api/packs/import", "POST", { json: travelBundle(), target: { kind: "pack" } });
    await localSend("/api/packs/import", "POST", { json: typedBundle(), target: { kind: "pack" } });
    line("seeds the Polish starter, one listening pack and one type pack");

    const library = await localGet<{ packs: PackStatus[] }>("/api/packs");
    const starter = library.packs.find((pack) => pack.name === "polish-starter");
    if (!starter) throw new Error("the Polish starter is missing");
    expect(starter).toMatchObject({
      language: "pl",
      sourceLanguage: "en",
      studyInstruction: "Answer in Polish. Ask for a hint if you get stuck.",
    });
    const inherited = briefForTarget(defaultCreationBrief({ targetLanguage: "es" }), "deck", starter);
    expect(inherited).toMatchObject({
      targetLanguage: "pl",
      sourceLanguage: "en",
      studyInstruction: "Answer in Polish. Ask for a hint if you get stuck.",
    });
    line("a deck or card target inherits the starter pl/en pair and instruction");

    const chatBrief = defaultCreationBrief({
      targetLanguage: "en",
      sourceLanguage: "en",
      studyInstruction: "Say the line before typing.",
    });
    const chatText = withBriefOnPackText(
      JSON.stringify({
        schema: PACK_BUNDLE_SCHEMA,
        pack: { name: "chat-english", version: "1.0.0" },
        decks: [{ id: "basics", name: "Basics" }],
        cards: [],
      }),
      chatBrief,
    );
    await localSend("/api/packs/import", "POST", { json: chatText, target: { kind: "pack" } });
    const afterChat = await localGet<{ packs: PackStatus[] }>("/api/packs");
    expect(afterChat.packs.find((pack) => pack.name === "chat-english")).toMatchObject({
      language: "en",
      sourceLanguage: "en",
      studyInstruction: "Say the line before typing.",
    });
    line("a Chat pack stores the brief's pair and instruction even when the answer omits them");

    const typed = await localGet<{ plan: Plan | null; message: string | null }>("/api/plan?pack=typed");
    const typeCard = typed.plan?.cards[0];
    if (!typeCard) throw new Error("the type card was not planned");
    expect(typeCard.answerDef.mode).toBe("type");
    expect(studyCardInstruction(typeCard, { language: "pl", sourceLanguage: "en" })).toBe(
      "Read the English line, then type the full Polish line.",
    );
    line("a type card names the English question and the Polish answer");

    const travel = await localGet<{ plan: Plan | null; message: string | null }>("/api/plan?pack=travel");
    const listening = travel.plan?.cards[0];
    if (!listening) throw new Error("the listening card was not planned");
    expect(studyCardInstruction(listening, { language: "pl", sourceLanguage: "en" })).toBe(
      "Listen, then type the full Polish line.",
    );
    expect(studyModeLabel(listening.answerDef.mode)).toBe("Listen and type");
    expect(studyModeLabel(listening.answerDef.mode)).not.toContain(listening.summary);
    expect(listenPrompt(listening)).toEqual({ text: "Gdzie jest dworzec?", lang: "pl" });
    line("a listening card speaks its line and its label never prints the summary");

    const prompts = {
      generation: { system: "You build Polish cards.", template: "Write {{count}} lines." },
      tutor: { system: "You are a tutor.", hintTemplate: "Hint for {{cardText}}." },
    };
    const patched = await localSend<{
      pack: { language: string; sourceLanguage: string; studyInstruction?: string; prompts: typeof prompts | null };
    }>("/api/packs/polish-starter", "PATCH", {
      targetLanguage: "Polish",
      sourceLanguage: "English",
      studyInstruction: "Say each line aloud first.",
      prompts,
    });
    expect(patched.pack).toMatchObject({
      language: "pl",
      sourceLanguage: "en",
      studyInstruction: "Say each line aloud first.",
      prompts,
    });
    const reset = await localSend<{
      pack: { language: string; sourceLanguage: string; studyInstruction?: string; prompts: typeof prompts | null };
    }>("/api/packs/polish-starter", "PATCH", { prompts: null });
    expect(reset.pack).toMatchObject({
      language: "pl",
      sourceLanguage: "en",
      studyInstruction: "Say each line aloud first.",
      prompts: null,
    });
    line("editing changes pair, instruction and prompts; reset clears only the prompts");

    await localSend("/api/packs/polish-starter", "PATCH", { prompts });
    const exported = await localGet<{ json: string }>("/api/packs/export?name=polish-starter");
    expect(JSON.parse(exported.json).pack).toMatchObject({
      language: "pl",
      sourceLanguage: "en",
      studyInstruction: "Say each line aloud first.",
      prompts,
    });
    const oldImported = await localSend<{ cardsAdded: number }>("/api/packs/import", "POST", {
      json: oldBundle(),
      target: { kind: "pack" },
    });
    expect(oldImported.cardsAdded).toBe(1);
    const afterOld = await localGet<{ packs: PackStatus[] }>("/api/packs");
    const oldPack = afterOld.packs.find((pack) => pack.name === "old-pack");
    if (!oldPack) throw new Error("the old pack did not load");
    expect(studyCardInstruction({ answerDef: { mode: "cloze" } }, oldPack)).toBe(
      "Fill the blank in the line.",
    );
    line("export carries the new fields and an old pack still loads with neutral words");

    const backup = await localGet<{ json: string }>("/api/backup/export");
    const restored = await localSend<{ packs: number }>("/api/backup/restore", "POST", {
      json: backup.json,
    });
    expect(restored.packs).toBeGreaterThanOrEqual(3);
    const afterRestore = await localGet<{ packs: PackStatus[] }>("/api/packs");
    expect(afterRestore.packs.find((pack) => pack.name === "polish-starter")).toMatchObject({
      language: "pl",
      sourceLanguage: "en",
      studyInstruction: "Say each line aloud first.",
      prompts,
    });
    line("backup restores the pair, instruction and prompts");

    const out = path.join(projectRoot, "out");
    expect(existsSync(out), "run npm run build first").toBe(true);
    const built = await readTree(out);
    for (const words of [
      "The line appears after you answer.",
      "study-instruction",
      "Cards teach",
      "Questions in",
      "Customize prompts",
      "Reset to app defaults",
      "Language not set",
      "the target language",
      "the question language",
      "This pack owns the language pair",
      "Afrikaans",
      "Zulu",
      "Other language",
      "Full screen",
      "Exit full screen",
      "This session",
      "End the session",
    ]) {
      expect(built, `the built client is missing "${words}"`).toContain(words);
    }
    line("the built client carries the language, reveal and editor words");
  });
});
