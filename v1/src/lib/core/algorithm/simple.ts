// WHY: When the learner's algorithm fails or returns something implausible,
// the card is better than the message. This fallback is deliberately dull:
// unseen, then oldest, then previously wrong.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import type { Card } from "@/lib/shared/types";
import type { CardSummary } from "@/lib/core/summaries";
import { humanizeTopic, type Selection } from "@/lib/core/algorithm/default";

/** Everything the fallback is allowed to know. */
export interface SimpleInput {
  cards: Card[];
  summaries: Map<string, CardSummary>;
  topicLabels: Record<string, string>;
  offer: number;
}

/** Unseen first, then the card that has waited longest, then wrong answers. */
export function selectSimple(input: SimpleInput): Selection {
  const active = input.cards.filter((card) => !card.retired);
  const rank = (card: Card): number => {
    const summary = input.summaries.get(card.id);
    if (!summary || summary.unseen) return 0;
    if (summary.lastOutcome === "again" || summary.lastOutcome === "no") return 2;
    return 1;
  };

  const ordered = [...active].sort((left, right) => {
    const byRank = rank(left) - rank(right);
    if (byRank !== 0) return byRank;
    const leftAt = input.summaries.get(left.id)?.lastAt ?? left.createdAt;
    const rightAt = input.summaries.get(right.id)?.lastAt ?? right.createdAt;
    return leftAt.localeCompare(rightAt);
  });

  const chosen = ordered.slice(0, Math.max(0, input.offer));
  const groups = new Map<string, string[]>();
  for (const card of chosen) {
    const topic = card.topics[0] ?? "(no topic)";
    const bucket = groups.get(topic);
    if (bucket) bucket.push(card.id);
    else groups.set(topic, [card.id]);
  }

  return {
    cards: chosen,
    groups: [...groups.entries()].map(([topic, cardIds]) => ({
      topic,
      label: input.topicLabels[topic] ?? humanizeTopic(topic),
      reason: "no idea, these came first",
      cardIds,
    })),
  };
}
