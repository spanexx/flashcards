// WHY: An empty card is not an attempt. One core rule decides whether the
// answering surface holds a real try, so the Answer button and the Enter key
// cannot enable a submission that would be recorded as a miss.
// PACK: study-card-guidance
// 2026-10-28 opencode: created so an empty card cannot be submitted as an
// answer. [pack: study-card-guidance]

import type { Card } from "@/lib/shared/types";

/**
 * Does the card hold at least one attempt? A pick counts once a choice is made,
 * a cloze counts any filled blank, and the typed surfaces count the one answer
 * field. Spaces alone are not an attempt.
 */
export function hasAnswerAttempt(card: Card, answers: Record<string, string>): boolean {
  if (card.answerDef.mode === "picks") {
    return (answers.choice ?? "").trim().length > 0;
  }
  if (card.answerDef.mode === "cloze") {
    return (card.answerDef.blanks ?? []).some(
      (blank) => (answers[blank.id] ?? "").trim().length > 0,
    );
  }
  return (answers.answer ?? "").trim().length > 0;
}
