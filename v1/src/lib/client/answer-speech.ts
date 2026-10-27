// WHY: The answer is made of parts the learner may ask to hear. The browser
// owns the voice, but the words and the language must be decided without one,
// so this pure helper keeps the rule testable and out of the card component.
// PACK: answer-speech
// 2026-10-27 opencode: created for the answer speech pack [pack: answer-speech]

import type { SpeechLine } from "@/lib/client/layer";
import type { CardPart, TeachingPart } from "@/lib/shared/types";

/** What the learner hears when a code answer has no teaching text to explain it. */
export const CODE_ANSWER_LINE = "This answer is code. Read it on screen.";

function teachingText(teaching: readonly TeachingPart[] | undefined): string {
  if (!teaching) return "";
  return teaching
    .filter((part): part is Extract<TeachingPart, { type: "text" }> => part.type === "text")
    .map((part) => part.text.trim())
    .filter((text) => text.length > 0)
    .join(" ");
}

/**
 * The words for one answer, with the language the device should use. Text and
 * speak parts are read in order. A code part is replaced by the card's teaching
 * text, or by one short line, so raw symbols are never spoken. Media and blanks
 * contribute nothing.
 */
export function answerSpeech(
  parts: readonly CardPart[],
  options: { lang?: string; teaching?: readonly TeachingPart[] } = {},
): SpeechLine {
  const segments: string[] = [];
  let hasCode = false;

  for (const part of parts) {
    if (part.type === "text" || part.type === "speak") {
      if (part.text.trim().length > 0) segments.push(part.text);
    } else if (part.type === "code" && !hasCode) {
      // WHY: The explanation takes the code's place in the sentence, so an
      // answer that starts with code is not read back to front.
      segments.push(teachingText(options.teaching) || CODE_ANSWER_LINE);
      hasCode = true;
    }
  }

  const text = segments
    .join(" ")
    .replace(/\s+([,.;:!?…])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return { text, lang: options.lang?.trim() ?? "" };
}
