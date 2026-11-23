// WHY: The full-page editor carries an unsaved draft and a return notice
// through sessionStorage. These tests prove the guarded, clear-on-read contract.
// PACK: mode-editor-design
// 2026-11-23 opencode: created after the fresh-eyes review. [pack: mode-editor-design]

import { afterEach, describe, expect, it, vi } from "vitest";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import type { LearningMode } from "@/lib/shared/types";
import { saveModeDraft, saveModeNotice, takeModeDraft, takeModeNotice } from "@/lib/browser/mode-editor-handoff";

/** Minimal Storage stand-in; node has no sessionStorage. */
function fakeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => { values.clear(); },
  } as Storage;
}

function draft(): LearningMode {
  return {
    id: "drafted",
    name: "Drafted mode",
    description: "A drafted mode.",
    version: "1.0.0",
    defaultCardMix: ["cloze"],
    usesWordStages: false,
    skillInstructions: "Ask one question.",
    canonicalExample: {
      schema: PACK_BUNDLE_SCHEMA,
      pack: { name: "mode-demo-drafted", version: "1.0.0" },
      decks: [],
      cards: [],
      words: [],
      pages: [],
    },
    isBuiltIn: false,
    createdAt: "2026-11-23T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mode editor handoff", () => {
  it("returns the draft once and clears it", () => {
    vi.stubGlobal("sessionStorage", fakeStorage());
    saveModeDraft(draft());
    expect(takeModeDraft()).toMatchObject({ id: "drafted" });
    expect(takeModeDraft()).toBeNull();
  });

  it("returns the notice once and clears it", () => {
    vi.stubGlobal("sessionStorage", fakeStorage());
    saveModeNotice("Drafted mode was saved.");
    expect(takeModeNotice()).toBe("Drafted mode was saved.");
    expect(takeModeNotice()).toBeNull();
  });

  it("ignores a malformed draft", () => {
    const store = fakeStorage();
    store.setItem("flashcards:mode-draft", "{oops");
    vi.stubGlobal("sessionStorage", store);
    expect(takeModeDraft()).toBeNull();
  });

  it("does nothing when session storage is unavailable", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(takeModeDraft()).toBeNull();
    expect(takeModeNotice()).toBeNull();
    expect(() => { saveModeDraft(draft()); saveModeNotice("x"); }).not.toThrow();
  });
});
