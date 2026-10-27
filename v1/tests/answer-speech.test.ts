// WHY: The answer voice must say Polish words with the Polish voice and English
// words with the English voice, even though no browser is available to the test
// run. The pure helper carries the rule; the device check is proven to stay
// silent outside a browser.
// PACK: answer-speech
// 2026-10-27 opencode: created for the answer speech pack [pack: answer-speech]
// 2026-10-27 opencode: split the answer into per-language lines after the
// learner heard an English translation read with the Polish voice.
// [pack: answer-speech]

import { describe, expect, it } from "vitest";
import { CODE_ANSWER_LINE, answerSpeech } from "@/lib/client/answer-speech";
import { speak, speakLines, speechSupported } from "@/lib/client/speech";
import type { CardPart, TeachingPart } from "@/lib/shared/types";

const polishAnswer: CardPart[] = [
  { type: "text", text: "Byłem w domu.", lang: "pl" },
  { type: "text", text: "I was at home.", role: "translation", lang: "en" },
];

const legacyPolishAnswer: CardPart[] = [
  { type: "text", text: "Byłem w domu." },
  { type: "text", text: "I was at home.", role: "translation" },
];

const pythonAnswer: CardPart[] = [{ type: "code", text: "print(2 ** 3)", language: "python" }];

const teaching: TeachingPart[] = [
  { type: "text", text: "The double star is exponentiation." },
  { type: "image", source: "web", src: "https://example.test/power.png", alt: "A power table" },
];

describe("answerSpeech", () => {
  it("speaks each tagged part in its own language", () => {
    expect(answerSpeech(polishAnswer, { lang: "pl", sourceLang: "en" })).toEqual([
      { text: "Byłem w domu.", lang: "pl" },
      { text: "I was at home.", lang: "en" },
    ]);
  });

  it("trusts the card tag even when the pack pair says otherwise", () => {
    const parts: CardPart[] = [
      { type: "text", text: "Estou em casa.", lang: "pt" },
      { type: "text", text: "I am at home.", role: "translation", lang: "en" },
    ];
    expect(answerSpeech(parts, { lang: "es", sourceLang: "fr" })).toEqual([
      { text: "Estou em casa.", lang: "pt" },
      { text: "I am at home.", lang: "en" },
    ]);
  });

  it("reads an untagged older card by the pack pair", () => {
    expect(answerSpeech(legacyPolishAnswer, { lang: "pl", sourceLang: "en" })).toEqual([
      { text: "Byłem w domu.", lang: "pl" },
      { text: "I was at home.", lang: "en" },
    ]);
  });

  it("joins neighbouring parts that share a language", () => {
    const parts: CardPart[] = [
      { type: "text", text: "To jest" },
      { type: "text", text: ", oczywiście." },
    ];
    expect(answerSpeech(parts, { lang: "pl", sourceLang: "en" })).toEqual([
      { text: "To jest, oczywiście.", lang: "pl" },
    ]);
  });

  it("uses no language tag when an older card's pack names no question language", () => {
    expect(answerSpeech(legacyPolishAnswer, { lang: "pl" })).toEqual([
      { text: "Byłem w domu.", lang: "pl" },
      { text: "I was at home.", lang: "" },
    ]);
  });

  it("keeps numbers in the learning language by tagging the pack language", () => {
    const parts: CardPart[] = [{ type: "text", text: "There are 3 apples and 12 pears." }];
    expect(answerSpeech(parts, { lang: "en" })).toEqual([
      { text: "There are 3 apples and 12 pears.", lang: "en" },
    ]);
  });

  it("explains a code answer with the teaching text instead of the code", () => {
    const result = answerSpeech(pythonAnswer, { lang: "en", teaching });
    expect(result.map((line) => line.text)).toEqual(["The double star is exponentiation."]);
    expect(result[0].text).not.toMatch(/[(){}*/[\]]/);
  });

  it("names a code answer when the card has no teaching text", () => {
    const result = answerSpeech(pythonAnswer, { lang: "en" });
    expect(result.map((line) => line.text)).toEqual([CODE_ANSWER_LINE]);
    expect(result[0].text).not.toMatch(/[(){}*/[\]]/);
  });

  it("still speaks the words beside a code part", () => {
    const parts: CardPart[] = [
      { type: "text", text: "It prints 8." },
      { type: "code", text: "print(2 ** 3)" },
    ];
    expect(answerSpeech(parts, { lang: "en", teaching }).map((line) => line.text)).toEqual([
      "It prints 8. The double star is exponentiation.",
    ]);
  });

  it("keeps the explanation in the code part's place, not always last", () => {
    const parts: CardPart[] = [
      { type: "code", text: "print(2 ** 3)" },
      { type: "text", text: "It prints 8." },
    ];
    expect(answerSpeech(parts, { lang: "en", teaching }).map((line) => line.text)).toEqual([
      "The double star is exponentiation. It prints 8.",
    ]);
  });

  it("says the code explanation once when several code parts exist", () => {
    const parts: CardPart[] = [
      { type: "code", text: "print(2 ** 3)" },
      { type: "code", text: "print(3 ** 2)" },
    ];
    expect(answerSpeech(parts, { lang: "en", teaching }).map((line) => line.text)).toEqual([
      "The double star is exponentiation.",
    ]);
  });

  it("keeps a speak part's own language", () => {
    const parts: CardPart[] = [
      { type: "text", text: "Posłuchaj:" },
      { type: "speak", text: "Good morning.", lang: "en" },
    ];
    expect(answerSpeech(parts, { lang: "pl", sourceLang: "en" })).toEqual([
      { text: "Posłuchaj:", lang: "pl" },
      { text: "Good morning.", lang: "en" },
    ]);
  });

  it("skips media and blanks, and says nothing for an empty answer", () => {
    const parts: CardPart[] = [
      { type: "media", src: "media-1", alt: "A photo" },
      { type: "blank", id: "b1" },
    ];
    expect(answerSpeech(parts, { lang: "pl" })).toEqual([]);
  });

  it("trims the languages and reports none when the card has none", () => {
    expect(answerSpeech(legacyPolishAnswer, { lang: "  pl  ", sourceLang: "  en  " })[0].lang).toBe(
      "pl",
    );
    expect(answerSpeech(legacyPolishAnswer, { lang: "  pl  ", sourceLang: "  en  " })[1].lang).toBe(
      "en",
    );
    expect(answerSpeech([{ type: "text", text: "Hi" }])).toEqual([{ text: "Hi", lang: "" }]);
  });
});

describe("speech support outside a browser", () => {
  it("reports no device voice during the node test run", () => {
    expect(speechSupported()).toBe(false);
  });

  it("speaking does nothing and does not throw", () => {
    expect(() => speak("Hello", "en")).not.toThrow();
    expect(() => speakLines([{ text: "Hello", lang: "en" }])).not.toThrow();
  });
});
