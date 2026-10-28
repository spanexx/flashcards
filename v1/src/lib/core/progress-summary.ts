// WHY: The learner may ask the tutor for a summary, but the payload must stay
// small and derived: counts, topic labels and outcome categories. Card text,
// answers and learner words never enter it. Building the shape here keeps that
// promise testable without a provider.
// PACK: progress-summary
// 2026-10-27 opencode: created for the progress summary pack
// [pack: progress-summary]

import type { Outcome, ProgressView, Settings } from "@/lib/shared/types";
import { humanizeTopic } from "@/lib/core/algorithm/default";

/** One topic the learner has worked on, named without any card text. */
export interface SummaryTopic {
  label: string;
  cards: number;
}

/** The latest outcome for one topic, as a category rather than a card. */
export interface SummaryOutcome {
  topic: string;
  outcome: Outcome;
}

/** The compact, derived shape that may leave the machine on request. */
export interface ProgressSummaryPayload {
  counts: {
    improvements: number;
    faster: number;
    nextTopics: number;
    strengths: number;
  };
  topics: SummaryTopic[];
  recentOutcomes: SummaryOutcome[];
  level: Settings["level"];
  learningStyle: Settings["learningStyle"];
}

/** How many topic rows and outcome rows the provider may see. */
const TOPIC_LIMIT = 8;
const OUTCOME_LIMIT = 8;

/** Build the payload from the read-time progress view and the saved categories. */
export function buildProgressSummaryPayload(
  progress: ProgressView,
  settings: Pick<Settings, "level" | "learningStyle">,
): ProgressSummaryPayload {
  // WHY: The topic items already carry the app's display labels, so the payload
  // never needs the card summary those items also hold.
  const labels = new Map<string, string>();
  for (const item of [...progress.nextTopics, ...progress.strengths]) {
    labels.set(item.topic, item.label);
  }

  const counts = new Map<string, number>();
  for (const card of progress.cards) {
    for (const topic of new Set(card.topics)) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }

  const topics: SummaryTopic[] = [...counts.entries()]
    .map(([topic, cards]) => ({ label: labels.get(topic) ?? humanizeTopic(topic), cards }))
    .sort((left, right) => {
      if (right.cards !== left.cards) return right.cards - left.cards;
      return left.label.localeCompare(right.label);
    })
    .slice(0, TOPIC_LIMIT);

  // WHY: progress.cards is already newest first. One row per topic is enough to
  // say how it last went without a card-by-card record.
  const seen = new Set<string>();
  const recentOutcomes: SummaryOutcome[] = [];
  for (const card of progress.cards) {
    if (!card.lastOutcome) continue;
    for (const topic of card.topics) {
      if (seen.has(topic)) continue;
      seen.add(topic);
      recentOutcomes.push({
        topic: labels.get(topic) ?? humanizeTopic(topic),
        outcome: card.lastOutcome,
      });
      if (recentOutcomes.length >= OUTCOME_LIMIT) break;
    }
    if (recentOutcomes.length >= OUTCOME_LIMIT) break;
  }

  return {
    counts: {
      improvements: progress.improvements.length,
      faster: progress.faster.length,
      nextTopics: progress.nextTopics.length,
      strengths: progress.strengths.length,
    },
    topics,
    recentOutcomes,
    level: settings.level,
    learningStyle: settings.learningStyle,
  };
}
