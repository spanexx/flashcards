// WHY: A non-crashing failure is more dangerous than a crash, so the app
// checks what the algorithm returned and falls back immediately when it does
// not look like a real session. The fallback is silent in the moment.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { selectDefault, type Selection, type SelectionInput } from "@/lib/core/algorithm/default";
import { selectSimple } from "@/lib/core/algorithm/simple";

/** What the runner returns: the selection and which algorithm actually ran. */
export interface RunResult {
  selection: Selection;
  algorithm: "default" | "fallback";
  usedFallback: boolean;
  reason: string | null;
}

/** Count distinct topics across the chosen cards. */
function topicCount(selection: Selection): number {
  return new Set(selection.cards.map((card) => card.topics[0] ?? "(no topic)")).size;
}

/**
 * Check the returned session for plausibility: enough cards, no duplicates,
 * enough variety, and unseen cards not ignored. A reason means failure.
 */
export function sanityCheck(input: SelectionInput, selection: Selection): string | null {
  const available = input.cards.filter((card) => !card.retired);
  if (available.length === 0) return "there are no cards to choose from";
  if (selection.cards.length === 0) return "the algorithm returned no cards";

  const minimum = Math.min(5, available.length);
  if (selection.cards.length < minimum) {
    return `the algorithm returned ${selection.cards.length} cards when at least ${minimum} were available`;
  }

  const ids = new Set(selection.cards.map((card) => card.id));
  if (ids.size !== selection.cards.length) {
    return "the algorithm returned the same card more than once";
  }

  const availableTopics = new Set(available.map((card) => card.topics[0] ?? "(no topic)"));
  if (availableTopics.size >= 2 && selection.cards.length >= 2 && topicCount(selection) < 2) {
    return "the algorithm returned cards from only one topic";
  }

  const unseenAvailable = available.some((card) => (input.summaries.get(card.id)?.unseen ?? false));
  const unseenSelected = selection.cards.some(
    (card) => input.summaries.get(card.id)?.unseen ?? false,
  );
  if (unseenAvailable && !unseenSelected) {
    return "the algorithm ignored cards the learner has never seen";
  }

  return null;
}

/** The last resort: the oldest cards in creation order, so a card still appears. */
function directSelection(input: SelectionInput): Selection {
  const active = input.cards.filter((card) => !card.retired);
  const chosen = [...active]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, Math.max(0, input.offer));
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
      label: input.topicLabels[topic] ?? topic,
      reason: "no idea, these came first",
      cardIds,
    })),
  };
}

/** Try the learner's algorithm once; on failure or implausibility, fall back. */
export function runSelection(input: SelectionInput): RunResult {
  let first: Selection | null = null;
  let reason: string | null = null;

  try {
    first = selectDefault(input);
    reason = sanityCheck(input, first);
  } catch (error) {
    reason = error instanceof Error ? error.message : "the algorithm failed";
  }

  if (first && reason === null) {
    return { selection: first, algorithm: "default", usedFallback: false, reason: null };
  }

  try {
    const fallback = selectSimple(input);
    const fallbackReason = sanityCheck(input, fallback);
    if (fallbackReason === null) {
      return { selection: fallback, algorithm: "fallback", usedFallback: true, reason };
    }
    return {
      selection: directSelection(input),
      algorithm: "fallback",
      usedFallback: true,
      reason: fallbackReason,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "the fallback failed";
    return {
      selection: directSelection(input),
      algorithm: "fallback",
      usedFallback: true,
      reason: `${reason ?? "the algorithm failed"}; ${message}`,
    };
  }
}
