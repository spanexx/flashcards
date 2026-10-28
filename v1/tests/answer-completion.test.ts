// WHY: A beginner may know the line but fight its spelling. The completion
// reads only the card's own expected answers and the learner's typing, so the
// ghost is honest, local and never a stored answer.
// PACK: study-card-guidance
// 2026-10-28 opencode: created for the beginner inline completion.
// [pack: study-card-guidance]

import { describe, expect, it } from "vitest";
import { answerCompletion } from "@/lib/core/answer-completion";

describe("an inline answer completion", () => {
  it("stays silent before the learner types", () => {
    expect(answerCompletion("", ["cztery"])).toBeNull();
    expect(answerCompletion("   ", ["cztery"])).toBeNull();
    expect(answerCompletion("x", [])).toBeNull();
  });

  it("shows the rest of the expected word after a matching start", () => {
    expect(answerCompletion("czter", ["cztery"])).toEqual({ value: "cztery", suffix: "y" });
    expect(answerCompletion("The num", ["The number four"])).toEqual({
      value: "The number four",
      suffix: "ber four",
    });
  });

  it("folds case and diacritics like the loose judge", () => {
    expect(answerCompletion("CZTER", ["cztery"])).toEqual({ value: "cztery", suffix: "y" });
    expect(answerCompletion("pije", ["Piję kawę"])).toEqual({
      value: "Piję kawę",
      suffix: " kawę",
    });
    expect(answerCompletion("piję", ["Piję kawę"])).toEqual({
      value: "Piję kawę",
      suffix: " kawę",
    });
  });

  it("offers nothing once a whole expected answer is typed", () => {
    expect(answerCompletion("cztery", ["cztery"])).toBeNull();
    expect(answerCompletion("Piję kawę", ["Piję kawę."])).toBeNull();
    expect(answerCompletion("dwa", ["dwa", "dwa tysiące"])).toBeNull();
  });

  it("keeps the shortest remaining suffix among variants", () => {
    expect(answerCompletion("czter", ["czterysta", "cztery"])).toEqual({
      value: "cztery",
      suffix: "y",
    });
  });

  it("stays silent when the start does not match or the line is already longer", () => {
    expect(answerCompletion("czterx", ["cztery"])).toBeNull();
    expect(answerCompletion("czteryy", ["cztery"])).toBeNull();
  });
});
