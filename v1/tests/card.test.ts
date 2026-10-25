// WHY: Card identity is the promise that updates do not duplicate or detach
// evidence. These tests pin what counts as the same card and what a broken card
// looks like.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { describe, expect, it } from "vitest";
import {
  buildCard,
  canonicalContent,
  generatedCardId,
  hardRuleIssues,
  importCardId,
  looksLikeSimpleCard,
  manualCardId,
  packCardId,
  renderPlainText,
  simpleCardToSource,
  stableStringify,
} from "@/lib/core/card";
import { makeSource } from "./helpers";

describe("stableStringify", () => {
  it("sorts object keys so key order cannot change an identity", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it("keeps arrays in order", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe("card identity", () => {
  it("ignores the pack version and timestamps", () => {
    const source = makeSource();
    const same = { ...source };
    expect(canonicalContent(source)).toBe(canonicalContent(same));
  });

  it("ignores a source key, which is only for authors", () => {
    const withKey = makeSource({ key: "some-key" });
    expect(canonicalContent(withKey)).toBe(canonicalContent(makeSource()));
  });

  it("changes when the content changes", () => {
    const changed = makeSource({ hints: ["a hint"] });
    expect(canonicalContent(changed)).not.toBe(canonicalContent(makeSource()));
  });

  it("ignores the teaching layer, which is help rather than content", () => {
    const withLayer = makeSource({
      teaching: [{ type: "text", text: "Read it slowly." }],
    });
    expect(canonicalContent(withLayer)).toBe(canonicalContent(makeSource()));
  });

  it("scopes pack identity to the pack name", () => {
    const source = makeSource();
    expect(packCardId("pack-a", source)).not.toBe(packCardId("pack-b", source));
  });

  it("keeps the same identity across a reinstall", () => {
    expect(packCardId("polish", makeSource())).toBe(packCardId("polish", makeSource()));
  });

  it("makes import identity content-only, so importing twice is the same card", () => {
    expect(importCardId(makeSource())).toBe(importCardId(makeSource()));
  });

  it("makes generated identity from pack, line and target", () => {
    const first = generatedCardId("polish", "Piję kawę.", "kawę");
    expect(first).toBe(generatedCardId("polish", "Piję kawę.", "kawę"));
    expect(first).not.toBe(generatedCardId("polish", "Piję kawę.", "Piję"));
    expect(first).not.toBe(generatedCardId("other", "Piję kawę.", "kawę"));
  });

  it("makes manual identity deliberately unique", () => {
    expect(manualCardId("a")).not.toBe(manualCardId("b"));
  });
});

describe("buildCard", () => {
  it("carries the teaching layer and leaves it absent when there is none", () => {
    const teaching = [{ type: "text" as const, text: "Read it slowly." }];
    const built = buildCard(
      makeSource({ teaching }),
      { kind: "pack", note: "From the test pack." },
      "pack-test:1",
      "2026-10-25T00:00:00.000Z",
    );
    expect(built.teaching).toEqual(teaching);
    const plain = buildCard(
      makeSource(),
      { kind: "pack", note: "From the test pack." },
      "pack-test:2",
      "2026-10-25T00:00:00.000Z",
    );
    expect(plain.teaching).toBeUndefined();
  });
});

describe("renderPlainText", () => {
  it("joins text, code and speak parts and skips blanks and media", () => {
    const text = renderPlainText([
      { type: "text", text: "Piję" },
      { type: "blank", id: "b1" },
      { type: "code", text: "kawę" },
      { type: "media", src: "x.png" },
    ]);
    expect(text).toBe("Piję kawę");
  });
});

describe("hardRuleIssues", () => {
  it("accepts a sound cloze card", () => {
    expect(hardRuleIssues(makeSource())).toEqual([]);
  });

  it("refuses a cloze card with no blank", () => {
    const issues = hardRuleIssues(
      makeSource({
        prompt: [{ type: "text", text: "Piję kawę." }],
        answerDef: { mode: "cloze", blanks: [] },
      }),
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.field === "prompt")).toBe(true);
  });

  it("refuses a cloze blank with no declared answer", () => {
    const issues = hardRuleIssues(
      makeSource({
        answerDef: { mode: "cloze", blanks: [] },
      }),
    );
    expect(issues.some((issue) => issue.field === "answerDef.blanks")).toBe(true);
  });

  it("refuses a picks card with fewer than two options or a stranger correct answer", () => {
    const single = hardRuleIssues(
      makeSource({
        prompt: [{ type: "text", text: "Wybierz." }],
        answer: [{ type: "text", text: "kawę" }],
        answerDef: { mode: "picks", options: ["kawę"], correct: ["kawę"] },
      }),
    );
    expect(single.some((issue) => issue.field === "answerDef.options")).toBe(true);

    const stranger = hardRuleIssues(
      makeSource({
        prompt: [{ type: "text", text: "Wybierz." }],
        answer: [{ type: "text", text: "herbatę" }],
        answerDef: { mode: "picks", options: ["kawę", "herbatę"], correct: ["sok"] },
      }),
    );
    expect(stranger.some((issue) => issue.field === "answerDef.correct")).toBe(true);
  });

  it("refuses a card whose answer repeats its prompt", () => {
    const issues = hardRuleIssues(
      makeSource({
        prompt: [{ type: "text", text: "Piję kawę." }],
        answer: [{ type: "text", text: "Piję kawę." }],
        answerDef: { mode: "type", expected: ["Piję kawę."] },
      }),
    );
    expect(issues.some((issue) => issue.field === "answer")).toBe(true);
  });

  it("refuses a card missing its summary or topics", () => {
    const issues = hardRuleIssues(makeSource({ summary: "", topics: [] }));
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("simpleCardToSource", () => {
  it("turns underscores into a cloze blank", () => {
    const source = simpleCardToSource({
      front: "Piję ___.",
      back: "kawę",
      topics: ["cases"],
    });
    expect(source.answerDef.mode).toBe("cloze");
    expect(source.answerDef.blanks?.[0].expected).toEqual(["kawę"]);
    expect(source.prompt.some((part) => part.type === "blank")).toBe(true);
  });

  it("makes a picks card when options are given", () => {
    const source = simpleCardToSource({
      front: "Co piję?",
      back: "kawę",
      topics: ["cases"],
      mode: "picks",
      options: ["kawę", "herbatę"],
    });
    expect(source.answerDef.mode).toBe("picks");
    expect(source.answerDef.correct).toEqual(["kawę"]);
  });

  it("falls back to a typed answer", () => {
    const source = simpleCardToSource({ front: "kawa", back: "coffee", topics: ["basics"] });
    expect(source.answerDef.mode).toBe("type");
    expect(source.answerDef.expected).toEqual(["coffee"]);
  });

  it("carries a plain summary of the pair", () => {
    const source = simpleCardToSource({ front: "kawa", back: "coffee", topics: ["basics"] });
    expect(source.summary).toBe("kawa → coffee");
  });
});

describe("looksLikeSimpleCard", () => {
  it("recognises the front/back shorthand", () => {
    expect(looksLikeSimpleCard({ front: "a", back: "b" })).toBe(true);
    expect(looksLikeSimpleCard({ summary: "a" })).toBe(false);
    expect(looksLikeSimpleCard(null)).toBe(false);
  });
});
