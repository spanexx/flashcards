// WHY: The algorithm should read facts about a card's history, not re-scan the
// raw row file on every decision. This module folds rows into one honest
// summary per card without concluding anything about the learner.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import type { Card, EvidenceRow, Outcome } from "@/lib/shared/types";
import { attemptsByCard, type AttemptSummary } from "@/lib/core/evidence";

/** Facts about one card's history. Nothing here says "strong" or "weak". */
export interface CardSummary {
  cardId: string;
  attempts: number;
  unseen: boolean;
  firstOutcome: Outcome | null;
  lastOutcome: Outcome | null;
  firstAt: string | null;
  lastAt: string | null;
  firstTimeMs: number;
  lastTimeMs: number;
  correctStreak: number;
  wrongCount: number;
  nearlyCount: number;
  correctedCount: number;
}

/** Build one summary per card from the append-only rows. */
export function buildSummaries(
  cards: Card[],
  rows: EvidenceRow[],
  now: Date = new Date(),
): Map<string, CardSummary> {
  // The clock is passed in so tests can freeze it; the value is not used for
  // scoring yet, but keeping it in the signature avoids a later breaking change.
  void now;
  const attempts = attemptsByCard(rows);
  const summaries = new Map<string, CardSummary>();

  for (const card of cards) {
    const history: AttemptSummary[] = attempts.get(card.id) ?? [];
    const first = history[0];
    const last = history[history.length - 1];
    let streak = 0;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index].outcome === "got_it") streak += 1;
      else break;
    }
    summaries.set(card.id, {
      cardId: card.id,
      attempts: history.length,
      unseen: history.length === 0,
      firstOutcome: first?.outcome ?? null,
      lastOutcome: last?.outcome ?? null,
      firstAt: first?.at ?? null,
      lastAt: last?.at ?? null,
      firstTimeMs: first?.timeMs ?? 0,
      lastTimeMs: last?.timeMs ?? 0,
      correctStreak: streak,
      wrongCount: history.filter((attempt) => attempt.outcome === "again" || attempt.outcome === "no").length,
      nearlyCount: history.filter((attempt) => attempt.outcome === "nearly").length,
      correctedCount: history.reduce(
        (count, attempt) => count + attempt.regions.filter((region) => region.corrected).length,
        0,
      ),
    });
  }

  return summaries;
}
