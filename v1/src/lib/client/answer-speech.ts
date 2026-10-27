// WHY: The answer is made of parts the learner may ask to hear. A translation
// belongs to the question language, not the language being learned, so the
// answer is split into per-language lines. The browser owns the voice, but the
// words and the lines must be decided without one, so this pure helper keeps
// the rule testable and out of the card component.
// PACK: answer-speech
// 2026-10-27 opencode: created for the answer speech pack [pack: answer-speech]
// 2026-10-27 opencode: the translation now keeps its own language line, after
// the learner heard English read with the Polish voice. [pack: answer-speech]
// 2026-10-27 opencode: a text part's own language tag wins; the pack pair is
// only a fallback for older cards that predate tags. [pack: answer-speech]

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

/** One space between words, no space before punctuation. */
function tidy(text: string): string {
  return text
    .replace(/\s+([,.;:!?…])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The lines for one answer, each with the language the device should use. Text
 * and speak parts are read in order. A part's own language tag wins, because
 * the card was written knowing what language its words are in. Older cards
 * without tags fall back to the pack pair: a translation is read in the
 * question language, the rest in the language being learned. A code part is
 * replaced, in its own place, by the card's teaching text or by one short line,
 * so raw symbols are never spoken. Line parts with the same language are joined
 * into one utterance.
 */
export function answerSpeech(
  parts: readonly CardPart[],
  options: { lang?: string; sourceLang?: string; teaching?: readonly TeachingPart[] } = {},
): SpeechLine[] {
  const lang = options.lang?.trim() ?? "";
  const sourceLang = options.sourceLang?.trim() ?? "";
  const lines: SpeechLine[] = [];

  function push(text: string, lineLang: string): void {
    const cleaned = tidy(text);
    if (cleaned.length === 0) return;
    const last = lines[lines.length - 1];
    if (last && last.lang === lineLang) {
      last.text = tidy(`${last.text} ${cleaned}`);
      return;
    }
    lines.push({ text: cleaned, lang: lineLang });
  }

  let hasCode = false;
  for (const part of parts) {
    if (part.type === "text") {
      // WHY: The card's own tag is the truth. The pack pair only covers cards
      // written before every text part carried a language.
      push(part.text, part.lang?.trim() || (part.role === "translation" ? sourceLang : lang));
    } else if (part.type === "speak") {
      push(part.text, part.lang?.trim() || lang);
    } else if (part.type === "code" && !hasCode) {
      // WHY: The explanation takes the code's place in the sentence, so an
      // answer that starts with code is not read back to front.
      push(teachingText(options.teaching) || CODE_ANSWER_LINE, lang);
      hasCode = true;
    }
  }

  return lines;
}
