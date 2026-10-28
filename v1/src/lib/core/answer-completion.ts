// WHY: A beginner may know the line but fight its spelling. One pure rule
// reads only the card's own expected answers and the learner's typing, so the
// ghost is local, testable and never stored.
// PACK: study-card-guidance
// 2026-10-28 opencode: created for the beginner inline completion.
// [pack: study-card-guidance]

import { normalizeAnswer } from "@/lib/core/normalize";

/** The full expected answer and the raw part still to type after the cursor. */
export interface AnswerCompletion {
  value: string;
  suffix: string;
}

/**
 * Suggest the rest of an expected answer after what the learner has typed.
 * Matching folds case and diacritics like the loose judge. Nothing is offered
 * before a real character, when a whole expected answer is already typed, or
 * when no expected answer starts that way. Among several matches the shortest
 * remaining suffix wins, so "cztery" follows "czter" ahead of "czterysta".
 */
export function answerCompletion(typed: string, expected: string[]): AnswerCompletion | null {
  const wanted = normalizeAnswer(typed);
  if (wanted.length === 0) return null;
  // WHY: A complete answer is not a prefix to finish; offering a longer variant
  // would push the learner past the line they already reached.
  if (expected.some((candidate) => normalizeAnswer(candidate) === wanted)) return null;

  let best: AnswerCompletion | null = null;
  for (const candidate of expected) {
    // WHY: The boundary is found on the raw text, because the visible suffix
    // must fit what the learner typed even when folding changed the spelling.
    for (let end = 1; end <= candidate.length; end += 1) {
      if (normalizeAnswer(candidate.slice(0, end)) !== wanted) continue;
      const suffix = candidate.slice(end);
      if (suffix.trim().length > 0 && (best === null || suffix.length < best.suffix.length)) {
        best = { value: candidate, suffix };
      }
      break;
    }
  }
  return best;
}
