// WHY: The study screen must not leak the answer through its own labels, and a
// listening card must speak the line instead of printing it. These pure helpers
// keep those two decisions testable without a browser.
// PACK: study-experience
// 2026-10-23 opencode: created for the study experience pack [pack: study-experience]

import { isWrong } from "@/lib/core/outcome";
import type { AnswerMode, Card, Outcome } from "@/lib/shared/types";

/** The one instruction a listening card shows before the answer. */
export const LISTEN_INSTRUCTION = "Listen, then type what you hear.";

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
