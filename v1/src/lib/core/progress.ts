// WHY: The screen answers one question: what can I do now that I could not do
// before. Everything here is computed fresh from the rows, never stored, and
// familiarity is never sold as progress.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import type { Card, EvidenceRow, ProgressCardItem, ProgressView, TopicItem } from "@/lib/shared/types";
import { attemptsByCard, realAttempts, type AttemptSummary } from "@/lib/core/evidence";
import { humanizeTopic } from "@/lib/core/algorithm/default";

/** How many named topics to show before the rest folds away. */
const TOPIC_LIMIT = 3;

/** Too slow to count as quick, used only for the "faster now" read. */
const SLOW_MS = 8000;

/** A card improved only if early attempts were genuinely poor. */
function isImproved(attempts: AttemptSummary[]): boolean {
  if (attempts.length < 2) return false;
  const first = attempts[0].outcome;
  const last = attempts[attempts.length - 1].outcome;
  const poorStart = first === "again" || first === "no";
  return poorStart && last === "got_it";
}

/** A card that used to be slow and is now quick, without a first-time-correct boost. */
function isFaster(attempts: AttemptSummary[]): boolean {
  if (attempts.length < 2) return false;
  const first = attempts[0];
  const last = attempts[attempts.length - 1];
  if (first.outcome === "got_it" && last.outcome === "got_it" && first.timeMs >= SLOW_MS) {
    return last.timeMs > 0 && last.timeMs <= first.timeMs * 0.6;
  }
  return false;
}

/** Read the latest real attempt outcome per card for one topic. */
function latestOutcomes(
  cardIds: string[],
  attempts: Map<string, AttemptSummary[]>,
): AttemptSummary[] {
  const latest: AttemptSummary[] = [];
  for (const cardId of cardIds) {
    const history = realAttempts(attempts.get(cardId) ?? []);
    if (history.length > 0) latest.push(history[history.length - 1]);
  }
  return latest;
}

/** Does a topic still ask for work: its latest answers slipped or were wrong. */
function needsWork(latest: AttemptSummary[]): boolean {
  return latest.some(
    (attempt) =>
      attempt.outcome === "again" || attempt.outcome === "no" || attempt.outcome === "nearly",
  );
}

/** A topic is strong when several cards are settled and nothing slipped recently. */
function isStrength(latest: AttemptSummary[]): boolean {
  if (latest.length < 2) return false;
  if (latest.some((attempt) => attempt.outcome !== "got_it")) return false;
  return true;
}

/**
 * The weak topic categories allowed into a prompt: labels of topics whose
 * latest answer slipped or was wrong. Never learner-written text, and the
 * learner sees them in the prompt preview before anything leaves.
 */
export function deriveWeakTopics(cards: Card[], rows: EvidenceRow[], limit = 5): string[] {
  const attempts = attemptsByCard(rows);
  const scores = new Map<string, { count: number; lastAt: string }>();

  for (const card of cards) {
    if (card.retired) continue;
    const history = realAttempts(attempts.get(card.id) ?? []);
    const last = history[history.length - 1];
    if (!last) continue;
    if (last.outcome !== "again" && last.outcome !== "no" && last.outcome !== "nearly") continue;
    for (const topic of card.topics) {
      const current = scores.get(topic);
      if (current) {
        current.count += 1;
        if (last.at > current.lastAt) current.lastAt = last.at;
      } else {
        scores.set(topic, { count: 1, lastAt: last.at });
      }
    }
  }

  return [...scores.entries()]
    .sort((left, right) => {
      if (right[1].count !== left[1].count) return right[1].count - left[1].count;
      return right[1].lastAt.localeCompare(left[1].lastAt);
    })
    .slice(0, limit)
    .map(([topic]) => topic);
}

/**
 * Build the read-time progress view: named cards, next work and strengths.
 * No scores, no percentages, no comparisons, no stored conclusions.
 */
export function readProgress(
  cards: Card[],
  rows: EvidenceRow[],
  topicLabels: Record<string, string>,
): ProgressView {
  const attempts = attemptsByCard(rows);
  const active = cards.filter((card) => !card.retired);

  const improvements: ProgressCardItem[] = [];
  const faster: ProgressCardItem[] = [];

  for (const card of active) {
    // WHY: A cold check must never become a progress claim on its own.
    const history = realAttempts(attempts.get(card.id) ?? []);
    if (history.length === 0) continue;
    if (isImproved(history)) {
      improvements.push({
        cardId: card.id,
        summary: card.summary,
        topics: card.topics,
        attempts: history.length,
        kind: "improved",
      });
    } else if (isFaster(history)) {
      faster.push({
        cardId: card.id,
        summary: card.summary,
        topics: card.topics,
        attempts: history.length,
        kind: "faster",
      });
    }
  }

  const topics = new Map<string, string[]>();
  for (const card of active) {
    for (const topic of card.topics) {
      const bucket = topics.get(topic);
      if (bucket) bucket.push(card.id);
      else topics.set(topic, [card.id]);
    }
  }

  const nextTopics: TopicItem[] = [];
  const strengths: TopicItem[] = [];

  for (const [topic, cardIds] of topics) {
    const unique = [...new Set(cardIds)];
    const latest = latestOutcomes(unique, attempts);
    if (latest.length === 0) continue;
    const slipping = unique.filter((cardId) => needsWork(latestOutcomes([cardId], attempts)));
    if (slipping.length > 0) {
      nextTopics.push({
        topic,
        label: topicLabels[topic] ?? humanizeTopic(topic),
        cardIds: slipping,
        reason: "these are still slipping, so they are next",
      });
    } else if (isStrength(latest)) {
      strengths.push({
        topic,
        label: topicLabels[topic] ?? humanizeTopic(topic),
        cardIds: unique,
        reason: "these come back now and then to check you are still strong",
      });
    }
  }

  nextTopics.sort((left, right) => right.cardIds.length - left.cardIds.length);
  strengths.sort((left, right) => right.cardIds.length - left.cardIds.length);

  const cardList = active
    .map((card) => {
      const history = realAttempts(attempts.get(card.id) ?? []);
      const last = history[history.length - 1];
      return {
        cardId: card.id,
        summary: card.summary,
        topics: card.topics,
        attempts: history.length,
        lastOutcome: last?.outcome ?? null,
        lastAt: last?.at ?? null,
      };
    })
    .filter((entry) => entry.attempts > 0)
    .sort((left, right) => (right.lastAt ?? "").localeCompare(left.lastAt ?? ""));

  return {
    improvements: improvements.slice(0, 20),
    faster: faster.slice(0, 20),
    nextTopics: nextTopics.slice(0, TOPIC_LIMIT),
    strengths: strengths.slice(0, TOPIC_LIMIT),
    cards: cardList,
  };
}
