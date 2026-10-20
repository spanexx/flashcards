// WHY: The authoring prompt is a versioned copy target. If it drifts from the
// bundle shape, a chat's answer fails at import. These tests keep the ids and the
// target rules written where the chat can see them.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build (ticket 17).

import { describe, expect, it } from "vitest";
import { AUTHORING_SKILL_VERSION, buildAuthoringPrompt } from "@/lib/browser/authoring";
import { parseBundle } from "@/lib/browser/bundle";
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
  it("names the version and the new pack", () => {
    const prompt = buildAuthoringPrompt({ kind: "new", name: "my-pack" });
    expect(prompt).toContain(AUTHORING_SKILL_VERSION);
    expect(prompt).toContain('"my-pack"');
    expect(prompt).toContain("flashcards.pack/v1");
  });

  it("writes the real deck id for a deck target and forbids new decks", () => {
    const prompt = buildAuthoringPrompt({ kind: "deck", packName: "starter", deckId: "cases" }, pack);
    expect(prompt).toContain('"cases"');
    expect(prompt).toContain("Cases");
    expect(prompt).toContain('"decks": []');
    expect(prompt).not.toContain('"decks": [\n    {');
  });

  it("lists existing decks for a pack target", () => {
    const prompt = buildAuthoringPrompt({ kind: "pack", packName: "starter" }, pack);
    expect(prompt).toContain("basics = Basics");
    expect(prompt).toContain("cases = Cases");
    expect(prompt).toContain("1.2.3");
  });

  it("shows examples the validator accepts, with the real version", () => {
    for (const prompt of [
      buildAuthoringPrompt({ kind: "new", name: "my-pack" }),
      buildAuthoringPrompt({ kind: "pack", packName: "starter" }, pack),
      buildAuthoringPrompt({ kind: "deck", packName: "starter", deckId: "cases" }, pack),
    ]) {
      const result = parseBundle(example(prompt));
      expect(result.ok, JSON.stringify(result)).toBe(true);
    }
    const deckPrompt = buildAuthoringPrompt({ kind: "deck", packName: "starter", deckId: "cases" }, pack);
    expect(deckPrompt).toContain('"version": "1.2.3"');
    expect(deckPrompt).toContain('"deckId": "cases"');
  });

  it("gives a pack example a new deck id that cannot rename an existing one", () => {
    const prompt = buildAuthoringPrompt({ kind: "pack", packName: "starter" }, pack);
    expect(prompt).toContain('"id": "extra"');
    expect(prompt).not.toContain('"id": "basics", "name": "Everyday basics"');
  });

  it("refuses an existing target whose pack is gone", () => {
    expect(() => buildAuthoringPrompt({ kind: "pack", packName: "starter" }, null)).toThrow(/starter/);
  });

  it("picks a new deck id that does not collide with an existing one", () => {
    const withExtra: BrowserPack = { ...pack, decks: [...pack.decks, { id: "extra", name: "Extra" }] };
    const prompt = buildAuthoringPrompt({ kind: "pack", packName: "starter" }, withExtra);
    expect(prompt).toContain('"id": "extra-2"');
    expect(prompt).toContain('"version": "1.2.3"');
  });

  it("refuses a deck that is not in the pack", () => {
    expect(() => buildAuthoringPrompt({ kind: "deck", packName: "starter", deckId: "gone" }, pack)).toThrow(/gone/);
  });
});
