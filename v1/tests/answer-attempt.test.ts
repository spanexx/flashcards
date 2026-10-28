// WHY: The Answer button must not be enabled by an empty card. One core rule
// says what counts as an attempt, so the button, the Enter key and these tests
// cannot disagree about an empty field.
// PACK: study-card-guidance
// 2026-10-28 opencode: created with the rule that requires an attempt before
// an answer can be submitted. [pack: study-card-guidance]

import { describe, expect, it } from "vitest";
import { hasAnswerAttempt } from "@/lib/core/answer-attempt";
import type { CardSource } from "@/lib/shared/types";
import { makeCard } from "./helpers";

/** A two-blank cloze card, so "any one blank" is proven, not assumed. */
function twoBlank(): CardSource {
  return {
    summary: "Jeden dwa trzy",
    topics: ["basics"],
    prompt: [
      { type: "text", text: "Jeden " },
      { type: "blank", id: "b1" },
      { type: "text", text: " i " },
      { type: "blank", id: "b2" },
    ],
    answer: [{ type: "text", text: "Jeden dwa i trzy." }],
    answerDef: {
      mode: "cloze",
      blanks: [
        { id: "b1", expected: ["dwa"] },
        { id: "b2", expected: ["trzy"] },
      ],
    },
  };
}

const typed = makeCard("card:typed", {
  prompt: [{ type: "text", text: "The number four" }],
  answer: [{ type: "text", text: "cztery" }],
  answerDef: { mode: "type", expected: ["cztery"] },
});

const heard = makeCard("card:heard", {
  prompt: [{ type: "speak", text: "cztery", lang: "pl" }],
  answer: [{ type: "text", text: "cztery" }],
  answerDef: { mode: "hear_type", expected: ["cztery"] },
});

const picked = makeCard("card:picked", {
  prompt: [{ type: "text", text: "The number four" }],
  answer: [{ type: "text", text: "cztery" }],
  answerDef: { mode: "picks", options: ["cztery", "dwa"], correct: ["cztery"] },
});

describe("an answer attempt", () => {
  it("needs a real character on a typed card", () => {
    expect(hasAnswerAttempt(typed, {})).toBe(false);
    expect(hasAnswerAttempt(typed, { answer: "" })).toBe(false);
    expect(hasAnswerAttempt(typed, { answer: "   " })).toBe(false);
    expect(hasAnswerAttempt(typed, { answer: "c" })).toBe(true);
  });

  it("counts one filled blank as an attempt on a cloze card", () => {
    const card = makeCard("card:two-blanks", twoBlank());
    expect(hasAnswerAttempt(card, {})).toBe(false);
    expect(hasAnswerAttempt(card, { b1: " ", b2: "" })).toBe(false);
    expect(hasAnswerAttempt(card, { b1: "dwa" })).toBe(true);
    expect(hasAnswerAttempt(card, { b2: "trzy" })).toBe(true);
  });

  it("keeps the picks card's existing rule", () => {
    expect(hasAnswerAttempt(picked, {})).toBe(false);
    expect(hasAnswerAttempt(picked, { choice: "dwa" })).toBe(true);
  });

  it("treats hear-then-type like any typed answer", () => {
    expect(hasAnswerAttempt(heard, {})).toBe(false);
    expect(hasAnswerAttempt(heard, { answer: "cztery" })).toBe(true);
  });
});
