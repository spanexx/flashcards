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
    cards: result.selection.cards,
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
