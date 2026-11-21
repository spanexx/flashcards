// WHY: A broken word lesson must be refused before it reaches storage, and the
// refusal must name the card a person wrote. These tests pin every defect the
// importer promises to catch, plus the promise that a plain pack is untouched.
// PACK: word-lessons
// 2026-11-21 opencode: created for the word-lessons pack. [pack: word-lessons]

import { describe, expect, it } from "vitest";
import type { CardSource, Word } from "@/lib/shared/types";
import { lessonIssues } from "@/lib/core/word-check";
import { makeSource } from "./helpers";

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "biuro",
    lemma: "biuro",
    meaning: "office",
    forms: [
      {
        label: "locative",
        to: "biurze",
        meaning: "in the office",
        why: [{ type: "text", text: "After w, neuter -o becomes -e." }],
      },
    ],
    pairs: [
      { target: "biuro", meaning: "office" },
      { target: "biurze", meaning: "in the office" },
    ],
    ...overrides,
  };
}

function formsCard(overrides: Partial<CardSource> = {}): CardSource {
  return makeSource({
    summary: "Forms of biuro",
    prompt: [{ type: "text", text: "biuro -> ___" }],
    answer: [{ type: "text", text: "biurze" }],
    answerDef: { mode: "type", expected: ["biurze"] },
    wordId: "biuro",
    stage: "forms",
    ...overrides,
  });
}

/** Every message the check produced, so one assertion can name them all. */
function messages(cards: CardSource[], words: Word[], existing: Word[] = []): string[] {
  return lessonIssues(cards, words, existing).map((issue) => issue.message);
}

describe("a whole lesson", () => {
  it("passes", () => {
    expect(messages([formsCard()], [makeWord()])).toEqual([]);
  });

  it("leaves a card with no word alone", () => {
    expect(messages([makeSource()], [])).toEqual([]);
  });

  it("accepts a word with no forms or pairs when no card asks for them", () => {
    const bare = makeWord({ forms: [], pairs: [] });
    expect(messages([makeSource()], [bare])).toEqual([]);
  });
});

describe("the card-to-word link", () => {
  it("refuses a word link without a stage", () => {
    const card = formsCard({ stage: undefined });
    expect(messages([card], [makeWord()])).toContain(
      'Card 1 ("Forms of biuro"): a word link needs a stage.',
    );
  });

  it("refuses a stage without a word", () => {
    const card = formsCard({ wordId: undefined });
    expect(messages([card], [makeWord()])).toContain(
      'Card 1 ("Forms of biuro"): a stage needs a word.',
    );
  });

  it("refuses a link to a word this pack does not define", () => {
    const card = formsCard({ wordId: "kawa" });
    expect(messages([card], [makeWord()])).toContain(
      'Card 1 ("Forms of biuro"): names the word "kawa", which this pack does not define.',
    );
  });

  it("accepts a link to a word the target pack already has", () => {
    expect(messages([formsCard()], [], [makeWord()])).toEqual([]);
  });

  it("refuses a matching card with no word to take pairs from", () => {
    const card = makeSource({
      summary: "Match biuro",
      prompt: [{ type: "text", text: "Match the pairs" }],
      answer: [{ type: "text", text: "Done" }],
      answerDef: { mode: "match" },
    });
    expect(messages([card], [])).toContain(
      'Card 1 ("Match biuro"): a matching card needs a word to take its pairs from.',
    );
  });
});

describe("stage and answer mode", () => {
  it("refuses a dialogue stage on a type card", () => {
    const card = formsCard({ stage: "dialogue" });
    expect(messages([card], [makeWord()])).toContain(
      'Card 1 ("Forms of biuro"): stage "dialogue" needs a picks card, not type.',
    );
  });

  it("accepts the three stages that share an existing mode", () => {
    const cards: CardSource[] = [
      makeSource({
        summary: "Story",
        wordId: "biuro",
        stage: "story",
        prompt: [{ type: "text", text: "Jestem w " }, { type: "blank", id: "b1" }],
        answer: [{ type: "text", text: "Jestem w biurze." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["biurze"] }] },
      }),
      formsCard({ summary: "Spelling", stage: "spelling" }),
      formsCard({ summary: "Forms", stage: "forms" }),
    ];
    expect(messages(cards, [makeWord()])).toEqual([]);
  });
});

describe("stage requirements", () => {
  it("refuses a forms card on a word with no forms", () => {
    const bare = makeWord({ forms: [] });
    expect(messages([formsCard()], [bare])).toContain(
      'Card 1 ("Forms of biuro"): stage "forms" needs at least one form on word "biuro".',
    );
  });

  it("refuses a matching card on a word with fewer than two pairs", () => {
    const thin = makeWord({ pairs: [{ target: "biuro", meaning: "office" }] });
    const card = makeSource({
      summary: "Match biuro",
      prompt: [{ type: "text", text: "Match the pairs" }],
      answer: [{ type: "text", text: "Done" }],
      answerDef: { mode: "match" },
      wordId: "biuro",
      stage: "matching",
    });
    expect(messages([card], [thin])).toContain(
      'Card 1 ("Match biuro"): stage "matching" needs at least two pairs on word "biuro".',
    );
  });
});

describe("word integrity", () => {
  it("refuses a duplicate word id", () => {
    expect(messages([], [makeWord(), makeWord()])).toContain(
      'Word "biuro" appears twice in this pack; a word id must be unique.',
    );
  });

  it("refuses two pairs with the same target", () => {
    const word = makeWord({
      pairs: [
        { target: "biuro", meaning: "office" },
        { target: "biuro", meaning: "the office" },
      ],
    });
    expect(messages([], [word])).toContain(
      'Word "biuro": two matching pairs share the target "biuro".',
    );
  });

  it("refuses two pairs with the same meaning", () => {
    const word = makeWord({
      pairs: [
        { target: "biuro", meaning: "office" },
        { target: "biura", meaning: "office" },
      ],
    });
    expect(messages([], [word])).toContain(
      'Word "biuro": two matching pairs share the meaning "office".',
    );
  });

  it("treats padding as the same text, not a distinct pair", () => {
    const word = makeWord({
      pairs: [
        { target: "biuro", meaning: "office" },
        { target: " biuro ", meaning: "office" },
      ],
    });
    expect(messages([], [word]).length).toBeGreaterThan(0);
  });
});
