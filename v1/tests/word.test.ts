// WHY: A word lesson's behaviour must be pinned before any screen depends on
// it: which form a card is about, where its help comes from, and the promise
// that adding a word link never resets evidence.
// PACK: word-lessons
// 2026-11-21 opencode: created for the word-lessons pack. [pack: word-lessons]

import { describe, expect, it } from "vitest";
import type { Word } from "@/lib/shared/types";
import { canonicalContent, deckCardId } from "@/lib/core/card";
import { STAGE_MODE, wordSchema } from "@/lib/core/schema";
import { formForCard, resolveCardHelp, stageRank, wordById } from "@/lib/core/word";
import { makeCard, makeSource } from "./helpers";

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "biuro",
    lemma: "biuro",
    meaning: "office",
    lang: "pl",
    forms: [
      {
        label: "locative",
        to: "biurze",
        meaning: "in the office",
        why: [{ type: "text", text: "After w, neuter -o becomes -e." }],
        use: "Jestem w ___.",
      },
    ],
    pairs: [
      { target: "biuro", meaning: "office" },
      { target: "biurze", meaning: "in the office" },
    ],
    ...overrides,
  };
}

describe("word lookup", () => {
  it("finds a word by id and refuses an unknown one", () => {
    const words = [makeWord()];
    expect(wordById(words, "biuro")?.lemma).toBe("biuro");
    expect(wordById(words, "kawa")).toBeNull();
    expect(wordById(undefined, "biuro")).toBeNull();
  });
});

describe("formForCard", () => {
  it("picks the longest matching form, not the lemma it contains", () => {
    const word = makeWord({
      forms: [
        { label: "base", to: "dom", meaning: "house", why: [{ type: "text", text: "base" }] },
        { label: "genitive", to: "domu", meaning: "of the house", why: [{ type: "text", text: "genitive" }] },
      ],
    });
    const card = makeCard("card:dom", {
      prompt: [{ type: "text", text: "Nie ma " }, { type: "blank", id: "b1" }],
      answer: [{ type: "text", text: "Nie ma domu." }],
      answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["domu"] }] },
    });
    expect(formForCard(word, card)?.label).toBe("genitive");
  });

  it("returns the only form even when the text does not name it", () => {
    const card = makeCard("card:plain", {
      prompt: [{ type: "text", text: "Where do you work?" }],
      answer: [{ type: "text", text: "W biurze." }],
      answerDef: { mode: "type", expected: ["W biurze."] },
    });
    expect(formForCard(makeWord(), card)?.to).toBe("biurze");
  });

  it("returns nothing when several forms fit and none matches", () => {
    const word = makeWord({
      forms: [
        { label: "one", to: "a", meaning: "a", why: [{ type: "text", text: "a" }] },
        { label: "two", to: "b", meaning: "b", why: [{ type: "text", text: "b" }] },
      ],
    });
    const card = makeCard("card:none", {
      prompt: [{ type: "text", text: "Choose." }],
      answer: [{ type: "text", text: "c" }],
      answerDef: { mode: "type", expected: ["c"] },
    });
    expect(formForCard(word, card)).toBeNull();
  });
});

describe("resolveCardHelp", () => {
  it("shows the card's own teaching first", () => {
    const card = makeCard("card:own", {
      teaching: [{ type: "text", text: "Card help." }],
    });
    const help = resolveCardHelp({
      card,
      word: makeWord({ note: [{ type: "text", text: "Word note." }] }),
      pageParts: [{ type: "text", text: "Page help." }],
    });
    expect(help).toEqual([{ type: "text", text: "Card help." }]);
  });

  it("shows the word note and the form's reason next", () => {
    const card = makeCard("card:word", {
      prompt: [{ type: "text", text: "Jestem w " }, { type: "blank", id: "b1" }],
      answer: [{ type: "text", text: "Jestem w biurze." }],
      answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["biurze"] }] },
    });
    const help = resolveCardHelp({
      card,
      word: makeWord({ note: [{ type: "text", text: "Word note." }] }),
      pageParts: [{ type: "text", text: "Page help." }],
    });
    expect(help.map((part) => (part.type === "text" ? part.text : ""))).toEqual([
      "Word note.",
      "After w, neuter -o becomes -e.",
    ]);
  });

  it("falls back to the card's Dictionary page", () => {
    const card = makeCard("card:page");
    const help = resolveCardHelp({
      card,
      word: null,
      pageParts: [{ type: "text", text: "Page help." }],
    });
    expect(help).toEqual([{ type: "text", text: "Page help." }]);
  });

  it("returns nothing rather than an empty promise", () => {
    expect(resolveCardHelp({ card: makeCard("card:bare") })).toEqual([]);
  });
});

describe("the word layer does not touch card identity", () => {
  it("hashes a linked card exactly like an unlinked one", () => {
    const plain = makeSource();
    const linked = makeSource({ wordId: "kawa", stage: "story" });
    expect(canonicalContent(linked)).toBe(canonicalContent(plain));
    expect(deckCardId("polish-starter", "cases", linked)).toBe(
      deckCardId("polish-starter", "cases", plain),
    );
  });
});

describe("stage rules", () => {
  it("fixes one answer mode per stage", () => {
    expect(STAGE_MODE).toEqual({
      story: "cloze",
      spelling: "type",
      forms: "type",
      dialogue: "picks",
      matching: "match",
    });
  });

  it("walks the stages in order and sorts unknown ones last", () => {
    expect(stageRank("story")).toBeLessThan(stageRank("spelling"));
    expect(stageRank("forms")).toBeLessThan(stageRank("dialogue"));
    expect(stageRank("dialogue")).toBeLessThan(stageRank("matching"));
    expect(stageRank(undefined)).toBeGreaterThan(stageRank("matching"));
  });
});

describe("wordSchema", () => {
  it("accepts a complete word", () => {
    expect(wordSchema.safeParse(makeWord()).success).toBe(true);
  });

  it("refuses a form with no reason", () => {
    const broken = { ...makeWord(), forms: [{ label: "x", to: "y", meaning: "z", why: [] }] };
    expect(wordSchema.safeParse(broken).success).toBe(false);
  });

  it("refuses a word id that is not a plain slug", () => {
    expect(wordSchema.safeParse({ ...makeWord(), id: "Biuro Dom" }).success).toBe(false);
  });

  it("defaults forms and pairs so a bare word is still valid", () => {
    const parsed = wordSchema.parse({ id: "kawa", lemma: "kawa", meaning: "coffee" });
    expect(parsed.forms).toEqual([]);
    expect(parsed.pairs).toEqual([]);
  });
});
