// WHY: The study screen must not leak the answer through its own labels, and a
// listening card must speak the line instead of printing it. These pure helpers
// keep those two decisions testable without a browser.
// PACK: study-experience
// 2026-10-23 opencode: created for the study experience pack [pack: study-experience]

import { isWrong } from "@/lib/core/outcome";
import { packLanguagePair } from "@/lib/shared/language";
import type { AnswerMode, Card, Outcome } from "@/lib/shared/types";

/** The note under the one play control; it never prints the spoken line. */
export const LISTEN_INSTRUCTION = "Play it as often as you need. The line appears after you answer.";

/** A pack's pair and its optional instruction, as the card needs them. */
export interface StudyPackInstruction {
  language?: string;
  sourceLanguage?: string;
  studyInstruction?: string;
}

/** The pack's own words when it has them, otherwise a plain mode-aware line. */
export function studyCardInstruction(
  card: Pick<Card, "answerDef">,
  pack?: StudyPackInstruction | null,
): string {
  const own = pack?.studyInstruction?.trim();
  if (own) return own;
  const pair = packLanguagePair(pack);
  const mode = card.answerDef.mode;
  if (mode === "cloze") {
    return pair.known && !pair.same
      ? `Fill the blank in the ${pair.targetName} line.`
      : "Fill the blank in the line.";
  }
  if (mode === "type") {
    return pair.known && !pair.same
      ? `Read the ${pair.sourceName} line, then type the full ${pair.targetName} line.`
      : "Type the full line.";
  }
  if (mode === "hear_type") {
    return pair.known && !pair.same
      ? `Listen, then type the full ${pair.targetName} line.`
      : "Listen, then type the full line.";
  }
  return pair.known && !pair.same
    ? `Choose the correct ${pair.sourceName} meaning.`
    : "Choose the correct meaning.";
}

/** A neutral label for the kind of card, never the card's summary. */
export function studyModeLabel(mode: AnswerMode): string {
  if (mode === "cloze") return "Fill the blank";
  if (mode === "type") return "Type the line";
  if (mode === "hear_type") return "Listen and type";
  return "Choose the meaning";
}

/** What the listen control should say, in the pack language when it is known. */
export function listenPrompt(card: Card): { text: string; lang?: string } {
  const spoken = card.prompt.find((part): part is Extract<typeof part, { type: "speak" }> => part.type === "speak");
  if (spoken) return { text: spoken.text, lang: spoken.lang };
  return { text: card.fullLine ?? card.summary };
}

/** The tutor helps after a wrong answer, once per card and only when it is on. */
export function shouldAutoHint(input: {
  approved: boolean;
  outcome: Outcome;
  alreadyAutoHinted: boolean;
}): boolean {
  return input.approved && isWrong(input.outcome) && !input.alreadyAutoHinted;
}
