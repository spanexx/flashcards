// WHY: The four outcome words are locked vocabulary. This module is the only
// place that ranks them, caps them or decides between Again and No, so every
// reader agrees on what each word means.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import type { Outcome } from "@/lib/shared/types";

/** The locked words, in display order. Unjudged is not one of the four. */
export const OUTCOMES: Outcome[] = ["again", "got_it", "nearly", "no"];

/** Plain labels for the screen. */
export const OUTCOME_LABELS: Record<Outcome, string> = {
  again: "Again",
  got_it: "Got it",
  nearly: "Nearly",
  no: "No",
  unjudged: "Not judged",
};

/** One-line meanings, quoted from the evidence ticket. */
export const OUTCOME_MEANINGS: Record<Outcome, string> = {
  again: "wrong, but familiar. A lapse in something already known.",
  got_it: "correct.",
  nearly: "substantially correct, a word or detail slipped.",
  no: "wrong, and it was not previously known. A gap.",
  unjudged: "no judge was available, so this answer is not called right or wrong.",
};

/** Higher is better. Unjudged sits below every judged outcome. */
const RANK: Record<Outcome, number> = {
  got_it: 4,
  nearly: 3,
  again: 2,
  no: 1,
  unjudged: 0,
};

/** True for the two wrong outcomes. Nearly is not wrong. */
export function isWrong(outcome: Outcome): boolean {
  return outcome === "again" || outcome === "no";
}

/** True for the one fully correct outcome. */
export function isCorrect(outcome: Outcome): boolean {
  return outcome === "got_it";
}

/** True when a judge decided anything, including a wrong verdict. */
export function isJudged(outcome: Outcome): boolean {
  return outcome !== "unjudged";
}

/** The worst judged outcome in a list, or unjudged when nothing was judged. */
export function worstOutcome(outcomes: Outcome[]): Outcome {
  const judged = outcomes.filter(isJudged);
  if (judged.length === 0) return "unjudged";
  return judged.reduce((worst, next) => (RANK[next] < RANK[worst] ? next : worst));
}

/** Compare two outcomes by rank. Exported so tests can pin the order. */
export function outcomeRank(outcome: Outcome): number {
  return RANK[outcome];
}

/** A hint means the answer was not produced unaided, so Got it becomes Nearly. */
export function capForHint(outcome: Outcome): Outcome {
  return outcome === "got_it" ? "nearly" : outcome;
}

/**
 * Wrong is a lapse when the card has been seen before and a gap when it has
 * not. This is read straight from the evidence ticket: Again is a slip in
 * existing knowledge, No is missing knowledge.
 */
export function wrongOutcomeFor(seenBefore: number): "again" | "no" {
  return seenBefore > 0 ? "again" : "no";
}
