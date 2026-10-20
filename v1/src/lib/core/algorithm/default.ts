// WHY: The learner owns the algorithm, so the default is only one possible
// reading of the evidence. It leans on unseen cards, slips and staleness and
// spreads the session across topics, and it never stores a conclusion.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import type { Card } from "@/lib/shared/types";
import type { PlanGroup } from "@/lib/shared/types";
import type { CardSummary } from "@/lib/core/summaries";

/** Everything the default algorithm is allowed to know. */
export interface SelectionInput {
  cards: Card[];
  summaries: Map<string, CardSummary>;
  topicLabels: Record<string, string>;
  offer: number;
  now: Date;
}

/** The ordered cards plus the display groups and their reasons. */
export interface Selection {
  cards: Card[];
  groups: PlanGroup[];
}

type CardClass = "unseen" | "slipped" | "stale" | "strong" | "fresh";

interface Candidate {
  card: Card;
  topic: string;
  score: number;
  createdAtMs: number;
  lastAtMs: number;
  cardClass: CardClass;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days between an ISO timestamp and now. Missing timestamps count as very old. */
function daysSince(iso: string | null, now: Date): number {
  if (!iso) return 9999;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 9999;
  return Math.max(0, (now.getTime() - then) / DAY_MS);
}

/** Plain label for a topic the pack did not label itself. */
export function humanizeTopic(topic: string): string {
  const spaced = topic.replace(/[-_]+/g, " ").trim();
  return spaced.length > 0 ? spaced[0].toUpperCase() + spaced.slice(1) : topic;
}

/** Decide how a card's history reads. */
export function classify(summary: CardSummary, now: Date): CardClass {
  if (summary.unseen) return "unseen";
  if (summary.lastOutcome === "again" || summary.lastOutcome === "no") return "slipped";
  if (summary.lastOutcome === "nearly") return "slipped";
  if (summary.lastOutcome === "got_it") {
    if (daysSince(summary.lastAt, now) >= 3 && summary.correctStreak >= 2) return "strong";
    if (daysSince(summary.lastAt, now) >= 1) return "stale";
    return "fresh";
  }
  return "slipped";
}

/** Score a candidate so the order is explainable rather than random. */
function scoreFor(cardClass: CardClass, summary: CardSummary, now: Date): number {
  switch (cardClass) {
    case "unseen":
      return 100;
    case "slipped":
      return 90 + Math.min(9, summary.wrongCount) - daysSince(summary.lastAt, now) * 0.01;
    case "stale":
      return 60 + Math.min(30, daysSince(summary.lastAt, now));
    case "strong":
      return 40;
    case "fresh":
      return 20;
  }
}

/** The plain reason a card is in the plan. Shown to the learner, never stored. */
export function reasonForCard(cardClass: CardClass): string {
  switch (cardClass) {
    case "unseen":
      return "no idea, these came first";
    case "slipped":
      return "because you have been getting these wrong";
    case "stale":
      return "because it has been a while";
    case "strong":
      return "because you are strong there and they check you are still strong";
    case "fresh":
      return "to keep it fresh";
  }
}

/** The plain reason a group of cards is in the plan. */
function reasonForGroup(classes: CardClass[]): string {
  if (classes.includes("slipped")) return "because you have been getting these wrong";
  if (classes.every((value) => value === "unseen")) return "no idea, these came first";
  if (classes.every((value) => value === "strong")) {
    return "because you are strong there and they check you are still strong";
  }
  if (classes.includes("stale")) return "because it has been a while";
  return "to keep them fresh";
}

/** Round-robin one card at a time across topics, so no topic fills the session. */
function spreadAcrossTopics(candidates: Candidate[], offer: number): Candidate[] {
  const buckets = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const bucket = buckets.get(candidate.topic);
    if (bucket) bucket.push(candidate);
    else buckets.set(candidate.topic, [candidate]);
  }

  const orderedBuckets = [...buckets.values()].sort(
    (left, right) => right[0].score - left[0].score,
  );
  const chosen: Candidate[] = [];
  let index = 0;

  while (chosen.length < offer) {
    let placed = false;
    for (let bucketIndex = 0; bucketIndex < orderedBuckets.length; bucketIndex += 1) {
      const bucketPosition = (bucketIndex + index) % orderedBuckets.length;
      const bucket = orderedBuckets[bucketPosition];
      const next = bucket.shift();
      if (next) {
        chosen.push(next);
        placed = true;
        if (chosen.length >= offer) break;
      }
    }
    if (!placed) break;
    index += 1;
  }

  return chosen;
}

/** Build groups from the chosen cards, keeping the selection order inside a topic. */
function buildGroups(
  chosen: Candidate[],
  topicLabels: Record<string, string>,
): PlanGroup[] {
  const groups = new Map<string, { classes: CardClass[]; cardIds: string[] }>();
  for (const candidate of chosen) {
    const bucket = groups.get(candidate.topic);
    if (bucket) {
      bucket.classes.push(candidate.cardClass);
      bucket.cardIds.push(candidate.card.id);
    } else {
      groups.set(candidate.topic, { classes: [candidate.cardClass], cardIds: [candidate.card.id] });
    }
  }
  return [...groups.entries()].map(([topic, bucket]) => ({
    topic,
    label: topicLabels[topic] ?? humanizeTopic(topic),
    reason: reasonForGroup(bucket.classes),
    cardIds: bucket.cardIds,
  }));
}

/**
 * The default selection: unseen cards first, then slips, then stale cards,
 * then strength checks, spread across topics.
 */
export function selectDefault(input: SelectionInput): Selection {
  const active = input.cards.filter((card) => !card.retired);
  const candidates: Candidate[] = active.map((card) => {
    const summary = input.summaries.get(card.id) ?? {
      cardId: card.id,
      attempts: 0,
      unseen: true,
      firstOutcome: null,
      lastOutcome: null,
      firstAt: null,
      lastAt: null,
      firstTimeMs: 0,
      lastTimeMs: 0,
      correctStreak: 0,
      wrongCount: 0,
      nearlyCount: 0,
      correctedCount: 0,
    };
    const cardClass = classify(summary, input.now);
    return {
      card,
      topic: card.topics[0] ?? "(no topic)",
      score: scoreFor(cardClass, summary, input.now),
      createdAtMs: Date.parse(card.createdAt) || 0,
      lastAtMs: summary.lastAt ? Date.parse(summary.lastAt) : 0,
      cardClass,
    };
  });

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.lastAtMs !== right.lastAtMs) return left.lastAtMs - right.lastAtMs;
    if (left.createdAtMs !== right.createdAtMs) return left.createdAtMs - right.createdAtMs;
    return left.card.summary.localeCompare(right.card.summary);
  });

  const chosen = spreadAcrossTopics(candidates, Math.max(0, input.offer));
  return {
    cards: chosen.map((candidate) => candidate.card),
    groups: buildGroups(chosen, input.topicLabels),
  };
}
