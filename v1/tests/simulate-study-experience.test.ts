// WHY: This is the Pack 3 rehearsal: two packs exist, the learner studies one,
// answers a listening card, and asks for a hint from the pack. It also checks
// the built study screen actually carries the new words.
// PACK: study-experience
// 2026-10-23 opencode: created for the study experience pack [pack: study-experience]

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore, setBrowserStore, type Store } from "@/lib/browser/store";
import { localGet, localSend } from "@/lib/browser/router";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { writeMeta } from "@/lib/browser/repository";
import { LISTEN_INSTRUCTION, listenPrompt, studyModeLabel } from "@/lib/client/study-view";
import type { AnswerResult, Plan } from "@/lib/shared/types";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function line(message: string): void {
  console.log(`-> ${message}`);
}

function bundle(name: string, deckId: string, deckName: string, card: Record<string, unknown>): string {
  return JSON.stringify({
    schema: PACK_BUNDLE_SCHEMA,
    pack: { name, version: "1.0.0", language: "pl" },
    decks: [{ id: deckId, name: deckName }],
    cards: [{ deckId, ...card }],
  });
}

const greetingBundle = bundle("greetings", "basics", "Basics", {
  summary: "Dzień dobry",
  prompt: [{ type: "text", text: "Dzień " }, { type: "blank", id: "b1" }, { type: "text", text: "." }],
  answer: [{ type: "text", text: "Dzień dobry." }],
  answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["dobry"] }] },
  hints: ["A greeting."],
  fullLine: "Dzień dobry.",
});

const travelBundle = bundle("travel", "station", "Station", {
  summary: "Gdzie jest dworzec?",
  prompt: [{ type: "speak", text: "Gdzie jest dworzec?", lang: "pl" }],
  answer: [{ type: "text", text: "Gdzie jest dworzec?" }],
  answerDef: { mode: "hear_type", expected: ["Gdzie jest dworzec?"] },
  hints: ["A station."],
  fullLine: "Gdzie jest dworzec?",
});

async function readTree(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const parts = await Promise.all(
    entries.map(async (entry) => {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) return readTree(full);
      if (!/\.(js|html)$/.test(entry.name)) return "";
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

describe("study experience rehearsal", () => {
  it("studies one pack, answers a listening card and asks for a pack hint", async () => {
    await localSend("/api/packs/import", "POST", { json: greetingBundle, target: { kind: "pack" } });
    await localSend("/api/packs/import", "POST", { json: travelBundle, target: { kind: "pack" } });

    const all = await localGet<{ plan: Plan | null; message: string | null }>("/api/plan");
    expect(all.plan?.cards).toHaveLength(2);
    line("seeds two packs; the default plan offers both");

    const travel = await localGet<{ plan: Plan | null; message: string | null }>("/api/plan?pack=travel");
    expect(travel.plan?.cards).toHaveLength(1);
    const card = travel.plan?.cards[0];
    if (!card) throw new Error("no travel card planned");
    expect(card.packName).toBe("travel");
    expect(card.answerDef.mode).toBe("hear_type");
    expect(studyModeLabel(card.answerDef.mode)).toBe("Listen and type");
    expect(studyModeLabel(card.answerDef.mode)).not.toBe(card.summary);
    expect(listenPrompt(card)).toEqual({ text: "Gdzie jest dworzec?", lang: "pl" });
    expect(LISTEN_INSTRUCTION).not.toContain(card.summary);
    line("chooses the travel pack; the listening card speaks its line without printing it");

    const answer = await localSend<AnswerResult>("/api/answer", "POST", {
      cardId: card.id,
      answers: { answer: "nie wiem" },
      timeMs: 900,
    });
    expect(["again", "no"]).toContain(answer.cardOutcome);
    line(`answers wrongly; the result is ${answer.cardOutcome}`);

    const hint = await localSend<{ text: string | null; source: string }>("/api/provider/hint", "POST", {
      cardId: card.id,
      approved: false,
      usedHints: [],
      outcomeCategory: "No",
    });
    expect(hint.source).toBe("pack");
    expect(hint.text).toContain("station");
    line("the pack hint arrives without a provider");

    const built = join(projectRoot, "out");
    if (existsSync(built)) {
      const text = await readTree(built);
      expect(text).toContain("Play the line");
      expect(text).toContain("Was this fair?");
      expect(text).toContain("Study from");
      expect(text).toContain("Tutor hint");
      expect(text).toContain("Pack hint");
      line("the built study screen carries the new labels");
    }
  });
});
