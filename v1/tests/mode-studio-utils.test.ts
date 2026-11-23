// WHY: Mode Studio's decisions are pure: what a mode prefills, what a preview
// renders, what an export contains and what a delete may touch. These tests
// hold those rules without a browser renderer.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created RED before the helper module existed. [pack: mode-studio-ui]

import { describe, expect, it } from "vitest";
import { PACK_BUNDLE_SCHEMA } from "@/lib/browser/bundle";
import { ApiError } from "@/lib/client/errors";
import { defaultCreationBrief } from "@/lib/shared/creation";
import type { LearningMode } from "@/lib/shared/types";
import {
  briefWithoutMode,
  canDeleteMode,
  cardMixForMode,
  inheritedModeNotice,
  modeDeleteName,
  modeExportText,
  modeImportBody,
  modeIssueLines,
  modeSaveRequest,
  previewCardsFromExample,
} from "@/app/library/mode-studio-utils";

/** One whole mode with a cloze example, valid unless a case overrides a fact. */
function mode(overrides: Partial<LearningMode> = {}): LearningMode {
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

describe("mode prefill helpers", () => {
  it("copies the selected mode's card mix without sharing its array", () => {
    const selected = mode();
    const mix = cardMixForMode(selected);
    expect(mix).toEqual(["cloze", "picks", "type"]);
    mix.pop();
    expect(selected.defaultCardMix).toHaveLength(3);
    expect(cardMixForMode(null)).toEqual([]);
  });

  it("clears hidden mode fields when the target changes away from pack", () => {
    const brief = defaultCreationBrief({
      modeId: "grammar-roles",
      cardMix: ["cloze"],
      modePreferences: "Short lines",
    });
    const cleared = briefWithoutMode(brief);
    expect(cleared.modeId).toBeUndefined();
    expect(cleared.cardMix).toBeUndefined();
    expect(cleared.modePreferences).toBeUndefined();
    expect(brief.modeId).toBe("grammar-roles");
  });

  it("shows an honest inherited notice for deck and cards, never for pack", () => {
    expect(inheritedModeNotice("pack")).toBeNull();
    expect(inheritedModeNotice("deck")).toContain("No learning mode is stored on this pack");
    expect(inheritedModeNotice("cards")).toContain("No learning mode is stored on this pack");
  });
});

describe("mode preview and validation helpers", () => {
  it("maps a canonical example to revealed card parts", () => {
    const selected = mode();
    const cards = previewCardsFromExample(selected);
    const example = selected.canonicalExample as { cards: Array<{ prompt: unknown }> };
    expect(cards).toHaveLength(1);
    expect(cards[0]?.revealAnswers).toEqual({ b1: "subject" });
    expect(cards[0]?.prompt).toEqual(example.cards[0]?.prompt);
  });

  it("turns API detail into field-named lines", () => {
    const error = new ApiError("The learning mode needs fixing.", [
      { field: "canonicalExample.cards.0", message: "a cloze needs a blank" },
    ]);
    expect(modeIssueLines(error)).toEqual(["canonicalExample.cards.0: a cloze needs a blank"]);
  });
});

describe("saving a drafted mode", () => {
  it("creates an unsaved draft and edits a stored row", () => {
    const draft = mode();
    const create = modeSaveRequest(draft, true);
    expect(create).toMatchObject({ method: "POST", url: "/api/modes" });
    expect(create.body).toEqual(draft);
    const edit = modeSaveRequest(draft, false);
    expect(edit).toMatchObject({ method: "PATCH", url: `/api/modes/${draft.id}` });
  });
});

describe("mode export and delete helpers", () => {
  it("exports only custom modes and parses an import body strictly", () => {
    const custom = mode();
    const builtIn = mode({ id: "language-general", name: "Language general", isBuiltIn: true });
    const text = modeExportText([custom, builtIn]);
    const exported = JSON.parse(text) as { modes: LearningMode[] };
    expect(exported.modes.map((entry) => entry.id)).toEqual(["grammar-roles"]);
    expect(modeImportBody(text)).toMatchObject({ modes: [{ id: "grammar-roles" }] });
    expect(() => modeImportBody("{oops")).toThrow();
  });

  it("allows delete only for learner-owned modes and names the visible label", () => {
    expect(canDeleteMode(mode())).toBe(true);
    expect(canDeleteMode(mode({ isBuiltIn: true }))).toBe(false);
    expect(modeDeleteName(mode({ name: "My roles" }))).toBe("My roles");
  });
});
