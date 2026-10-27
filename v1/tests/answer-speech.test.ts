// WHY: The answer voice must say the right words in the right language even
// though no browser is available to the test run. The pure helper carries the
// rule; the device check is proven to stay silent outside a browser.
// PACK: answer-speech
// 2026-10-27 opencode: created for the answer speech pack [pack: answer-speech]

import { describe, expect, it } from "vitest";
import { CODE_ANSWER_LINE, answerSpeech } from "@/lib/client/answer-speech";
import { speak, speechSupported } from "@/lib/client/speech";
import type { CardPart, TeachingPart } from "@/lib/shared/types";

const polishAnswer: CardPart[] = [
  { type: "text", text: "My jedliśmy obiad." },
  { type: "text", text: "We were eating dinner.", role: "translation" },
];

const pythonAnswer: CardPart[] = [{ type: "code", text: "print(2 ** 3)", language: "python" }];

const teaching: TeachingPart[] = [
  { type: "text", text: "The double star is exponentiation." },
  { type: "image", source: "web", src: "https://example.test/power.png", alt: "A power table" },
];

describe("answerSpeech", () => {
  it("speaks text parts in display order, translation included", () => {
    expect(answerSpeech(polishAnswer, { lang: "pl" })).toEqual({
      text: "My jedliśmy obiad. We were eating dinner.",
      lang: "pl",
    });
  });

  it("keeps numbers in the learning language by tagging the pack language", () => {
    const parts: CardPart[] = [{ type: "text", text: "There are 3 apples and 12 pears." }];
    expect(answerSpeech(parts, { lang: "en" })).toEqual({
      text: "There are 3 apples and 12 pears.",
      lang: "en",
    });
  });

  it("explains a code answer with the teaching text instead of the code", () => {
    const result = answerSpeech(pythonAnswer, { lang: "en", teaching });
    expect(result.text).toBe("The double star is exponentiation.");
    expect(result.text).not.toMatch(/[(){}*/[\]]/);
  });

  it("names a code answer when the card has no teaching text", () => {
    const result = answerSpeech(pythonAnswer, { lang: "en" });
    expect(result.text).toBe(CODE_ANSWER_LINE);
    expect(result.text).not.toMatch(/[(){}*/[\]]/);
  });

  it("still speaks the words beside a code part", () => {
    const parts: CardPart[] = [
      { type: "text", text: "It prints 8." },
      { type: "code", text: "print(2 ** 3)" },
    ];
    expect(answerSpeech(parts, { lang: "en", teaching }).text).toBe(
      "It prints 8. The double star is exponentiation.",
    );
  });

  it("keeps the explanation in the code part's place, not always last", () => {
    const parts: CardPart[] = [
      { type: "code", text: "print(2 ** 3)" },
      { type: "text", text: "It prints 8." },
    ];
    expect(answerSpeech(parts, { lang: "en", teaching }).text).toBe(
      "The double star is exponentiation. It prints 8.",
    );
  });

  it("says the code explanation once when several code parts exist", () => {
    const parts: CardPart[] = [
      { type: "code", text: "print(2 ** 3)" },
      { type: "code", text: "print(3 ** 2)" },
    ];
    expect(answerSpeech(parts, { lang: "en", teaching }).text).toBe(
      "The double star is exponentiation.",
    );
  });

  it("skips media and blanks, and says nothing for an empty answer", () => {
    const parts: CardPart[] = [
      { type: "media", src: "media-1", alt: "A photo" },
      { type: "blank", id: "b1" },
    ];
    expect(answerSpeech(parts, { lang: "pl" }).text).toBe("");
  });

  it("does not leave a space before punctuation", () => {
    const parts: CardPart[] = [
      { type: "text", text: "To jest" },
      { type: "text", text: ", oczywiście." },
    ];
    expect(answerSpeech(parts).text).toBe("To jest, oczywiście.");
  });

  it("trims the language and reports none when the pack has none", () => {
    expect(answerSpeech(polishAnswer, { lang: "  pl  " }).lang).toBe("pl");
    expect(answerSpeech(polishAnswer).lang).toBe("");
  });
});

describe("speech support outside a browser", () => {
  it("reports no device voice during the node test run", () => {
    expect(speechSupported()).toBe(false);
  });

  it("speaking does nothing and does not throw", () => {
    expect(() => speak("Hello", "en")).not.toThrow();
  });
});
