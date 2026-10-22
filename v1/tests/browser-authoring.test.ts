// WHY: The authoring prompt is a versioned copy target. If it drifts from the
// bundle shape, a chat's answer fails at import. These tests keep the parent ids
// and target rules written where the chat can see them.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build (ticket 17).
// 2026-10-21 opencode: target-first Pack/Deck/Cards prompt contract.

import { describe, expect, it } from "vitest";
import { AUTHORING_SKILL_VERSION, buildAuthoringPrompt } from "@/lib/browser/authoring";
import { parseBundle, parseCardsBundle, parseDeckBundle } from "@/lib/browser/bundle";
import type { BrowserPack } from "@/lib/browser/repository";

function example(prompt: string): string {
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
  return prompt.slice(start);
}

const pack: BrowserPack = {
  id: "starter",
  name: "starter",
  version: "1.2.3",
  decks: [
    { id: "basics", name: "Basics" },
    { id: "cases", name: "Cases" },
  ],
  prompts: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
};

describe("buildAuthoringPrompt", () => {
  it("lets the chat name a new pack and shows a whole pack shape", () => {
    const prompt = buildAuthoringPrompt({ kind: "pack" });
    expect(prompt).toContain(AUTHORING_SKILL_VERSION);
    expect(prompt).toContain("Choose a short lowercase pack name");
    expect(prompt).toContain("slow-polish");
    expect(prompt).toContain("flashcards.pack/v1");
    const result = parseBundle(example(prompt));
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it("names the existing pack and asks for new decks only", () => {
    const prompt = buildAuthoringPrompt({ kind: "deck", packName: "starter" }, pack);
    expect(prompt).toContain("starter");
    expect(prompt).toContain("basics = Basics");
    expect(prompt).toContain("cases = Cases");
    expect(prompt).toContain("Do not include a \"pack\" header");
    expect(prompt).not.toContain("\"pack\": { \"name\": \"starter\"");
    const result = parseDeckBundle(example(prompt));
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it("names the real deck and asks for cards only", () => {
    const prompt = buildAuthoringPrompt({ kind: "cards", packName: "starter", deckId: "cases" }, pack);
    expect(prompt).toContain('"cases"');
    expect(prompt).toContain("Cases");
    expect(prompt).toContain("Return only cards for the target deck");
    const result = parseCardsBundle(example(prompt));
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(example(prompt)).toContain('"deckId": "cases"');
  });

  it("picks a new deck id that does not collide with an existing one", () => {
    const withExtra: BrowserPack = { ...pack, decks: [...pack.decks, { id: "extra", name: "Extra" }] };
    const prompt = buildAuthoringPrompt({ kind: "deck", packName: "starter" }, withExtra);
    expect(prompt).toContain('"id": "extra-2"');
  });

  it("refuses an existing target whose pack is gone", () => {
    expect(() => buildAuthoringPrompt({ kind: "deck", packName: "starter" }, null)).toThrow(/starter/);
  });

  it("refuses a deck that is not in the pack", () => {
    expect(() =>
      buildAuthoringPrompt({ kind: "cards", packName: "starter", deckId: "gone" }, pack),
    ).toThrow(/gone/);
  });
});
