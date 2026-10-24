// WHY: The study screen's quiet decisions are easy to regress: a label could
// start echoing the answer, a listening card could print its line, or the
// tutor could fire more than once. These tests pin those decisions.
// PACK: study-experience
// 2026-10-23 opencode: created for the study experience pack [pack: study-experience]

import { describe, expect, it } from "vitest";
import {
  LISTEN_INSTRUCTION,
  listenPrompt,
  shouldAutoHint,
  studyCardInstruction,
  studyModeLabel,
} from "@/lib/client/study-view";
import type { Card } from "@/lib/shared/types";

const listeningCard: Card = {
  id: "card-1",
  packName: "travel",
  deckId: "basics",
  topics: ["Travel"],
  tags: [],
  summary: "Gdzie jest dworzec?",
  prompt: [{ type: "speak", text: "Gdzie jest dworzec?", lang: "pl" }],
  answer: [{ type: "text", text: "Gdzie jest dworzec?" }],
  answerDef: { mode: "hear_type" },
  hints: ["A station."],
  fullLine: "Gdzie jest dworzec?",
  origin: { kind: "pack", note: "seed" },
  createdAt: "2026-10-23T00:00:00.000Z",
};

describe("study view decisions", () => {
  it("uses neutral mode labels that never repeat the card summary", () => {
    const labels = [
      studyModeLabel("cloze"),
      studyModeLabel("type"),
      studyModeLabel("hear_type"),
      studyModeLabel("picks"),
    ];
    expect(labels).toEqual(["Fill the blank", "Type the line", "Listen and type", "Choose the meaning"]);
    expect(labels).not.toContain(listeningCard.summary);
  });

  it("speaks the prompt line and keeps the answer out of the instruction", () => {
    expect(LISTEN_INSTRUCTION).toBe("Listen, then type what you hear.");
    expect(LISTEN_INSTRUCTION).not.toContain(listeningCard.summary);
    expect(listenPrompt(listeningCard)).toEqual({
      text: "Gdzie jest dworzec?",
      lang: "pl",
    });
  });

  it("falls back to the full line, then the summary, for a spoken prompt", () => {
    expect(
      listenPrompt({
        ...listeningCard,
        prompt: [{ type: "text", text: "hidden" }],
      }),
    ).toEqual({ text: "Gdzie jest dworzec?" });
    expect(
      listenPrompt({
        ...listeningCard,
        prompt: [{ type: "text", text: "hidden" }],
        fullLine: undefined,
      }),
    ).toEqual({ text: "Gdzie jest dworzec?" });
  });

  it("speaks and types in the pack's target language", () => {
    const pack = { language: "pl", sourceLanguage: "en" };
    expect(studyCardInstruction({ answerDef: { mode: "cloze" } }, pack)).toBe(
      "Fill the blank in the Polish line.",
    );
    expect(studyCardInstruction({ answerDef: { mode: "type" } }, pack)).toBe(
      "Read the English line, then type the full Polish line.",
    );
    expect(studyCardInstruction(listeningCard, pack)).toBe("Listen, then type the full Polish line.");
    expect(studyCardInstruction({ answerDef: { mode: "picks" } }, pack)).toBe(
      "Choose the correct English meaning.",
    );
  });

  it("keeps neutral words for an old pack and lets its instruction win", () => {
    expect(studyCardInstruction({ answerDef: { mode: "type" } })).toBe("Type the full line.");
    expect(studyCardInstruction(listeningCard)).toBe("Listen, then type the full line.");
    expect(studyCardInstruction({ answerDef: { mode: "picks" } })).toBe("Choose the correct meaning.");
    expect(
      studyCardInstruction({ answerDef: { mode: "type" } }, {
        language: "pl",
        sourceLanguage: "en",
        studyInstruction: "  Say it before you type.  ",
      }),
    ).toBe("Say it before you type.");
  });

  it("uses neutral words when the source is missing or both languages are the same", () => {
    const same = { language: "en", sourceLanguage: "en" };
    expect(studyCardInstruction({ answerDef: { mode: "cloze" } }, same)).toBe(
      "Fill the blank in the line.",
    );
    expect(studyCardInstruction({ answerDef: { mode: "type" } }, same)).toBe(
      "Type the full line.",
    );
    expect(studyCardInstruction(listeningCard, same)).toBe("Listen, then type the full line.");
    expect(studyCardInstruction({ answerDef: { mode: "picks" } }, same)).toBe(
      "Choose the correct meaning.",
    );

    const targetOnly = { language: "pl" };
    expect(studyCardInstruction(listeningCard, targetOnly)).toBe(
      "Listen, then type the full line.",
    );
    expect(studyCardInstruction({ answerDef: { mode: "picks" } }, targetOnly)).toBe(
      "Choose the correct meaning.",
    );
  });

  it("auto-hints once, only for a wrong answer, and only when the tutor is on", () => {
    expect(shouldAutoHint({ approved: true, outcome: "no", alreadyAutoHinted: false })).toBe(true);
    expect(shouldAutoHint({ approved: true, outcome: "again", alreadyAutoHinted: false })).toBe(true);
    expect(shouldAutoHint({ approved: true, outcome: "nearly", alreadyAutoHinted: false })).toBe(false);
    expect(shouldAutoHint({ approved: true, outcome: "got_it", alreadyAutoHinted: false })).toBe(false);
    expect(shouldAutoHint({ approved: false, outcome: "no", alreadyAutoHinted: false })).toBe(false);
    expect(shouldAutoHint({ approved: true, outcome: "no", alreadyAutoHinted: true })).toBe(false);
  });
});
