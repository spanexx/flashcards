// WHY: A silent decider of what to study is exactly what this project exists
// to avoid, so the plan is assembled here with its plain reasons. The reason is
// returned for display and never written anywhere.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: global random id instead of the Node-only import, so
// planning works in the browser build.
// 2026-10-22 opencode: newId keeps planning working on a static HTTP host.
// [pack: library-create-flow]

import type { Card, EvidenceRow, Plan, SessionEvent } from "@/lib/shared/types";
import { newId } from "@/lib/core/id";
import { buildSummaries } from "@/lib/core/summaries";
import { runSelection } from "@/lib/core/algorithm/run";
import { computeOffer } from "@/lib/core/session";
import { stageRank } from "@/lib/core/word";

/**
 * Keep one word's cards together and walk them in stage order. A card with no
 * word stays exactly where the algorithm put it, and a word is placed at its
 * first selected card, so a session reads as a lesson instead of five unrelated
 * questions about the same word.
 */
export function orderWordCards<T extends Pick<Card, "wordId" | "stage">>(
  cards: readonly T[],
): T[] {
  const blocks = new Map<string, T[]>();
  for (const card of cards) {
    if (!card.wordId) continue;
    const block = blocks.get(card.wordId);
    if (block) block.push(card);
    else blocks.set(card.wordId, [card]);
  }

  const placed = new Set<string>();
  const ordered: T[] = [];
  for (const card of cards) {
    if (!card.wordId) {
      ordered.push(card);
      continue;
    }
    if (placed.has(card.wordId)) continue;
    placed.add(card.wordId);
    const block = [...(blocks.get(card.wordId) ?? [])];
    // WHY: sort is stable, so two cards of the same stage keep the algorithm's
    // order rather than shuffling for no reason.
    block.sort((left, right) => stageRank(left.stage) - stageRank(right.stage));
    ordered.push(...block);
  }
  return ordered;
}

/** Everything needed to plan one session. */
export interface PlanInput {
  cards: Card[];
  rows: EvidenceRow[];
  events: SessionEvent[];
  topicLabels: Record<string, string>;
  now: Date;
  offer?: number;
}

/** The plan plus the receipt facts the settings line needs. */
export interface PlanResult {
  plan: Plan;
  usedFallback: boolean;
  fallbackReason: string | null;
  fallbackCount: number;
}

/**
 * Build the plan: choose the cards, explain the groups, and expose which
 * algorithm ran so a fallback is visible later in settings rather than now.
 */
export function buildPlan(input: PlanInput, fallbackCountBefore = 0): PlanResult {
  const summaries = buildSummaries(input.cards, input.rows, input.now);
  const offer = input.offer ?? computeOffer(input.events);
  const result = runSelection({
    cards: input.cards,
    summaries,
    topicLabels: input.topicLabels,
    offer,
    now: input.now,
  });

  const fallbackCount = fallbackCountBefore + (result.usedFallback ? 1 : 0);
  const plan: Plan = {
    sessionId: newId(),
    cards: orderWordCards(result.selection.cards),
    groups: result.selection.groups,
    offer,
    algorithm: result.algorithm,
    fallbackCount,
    banner: null,
  };

  return {
    plan,
    usedFallback: result.usedFallback,
    fallbackReason: result.reason,
    fallbackCount,
  };
}
