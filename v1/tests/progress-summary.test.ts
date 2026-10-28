// WHY: The learner controls what a summary sends, and the promise is that it
// carries counts and topic labels only. These tests pin the compact shape and
// the exact preview text without a provider.
// PACK: progress-summary
// 2026-10-27 opencode: created for the progress summary pack
// [pack: progress-summary]

import { describe, expect, it } from "vitest";
import {
  buildProgressSummaryPayload,
  type ProgressSummaryPayload,
} from "@/lib/core/progress-summary";
import { buildProgressSummaryPrompt } from "@/lib/provider/summary";
import type { ProgressView } from "@/lib/shared/types";

const progress: ProgressView = {
  improvements: [
    {
      cardId: "card:pije",
      summary: "Piję kawę",
      topics: ["cases"],
      attempts: 3,
      kind: "improved",
    },
  ],
  faster: [
    {
      cardId: "card:kot",
      summary: "Mam kota",
      topics: ["animals"],
      attempts: 4,
      kind: "faster",
    },
  ],
  nextTopics: [
    {
      topic: "cases",
      label: "Cases",
      cardIds: ["card:pije"],
      reason: "these are still slipping, so they are next",
    },
  ],
  strengths: [
    {
      topic: "animals",
      label: "Animals",
      cardIds: ["card:kot"],
      reason: "these come back now and then to check you are still strong",
    },
  ],
  cards: [
    {
      cardId: "card:pije",
      summary: "Piję kawę",
      topics: ["cases"],
      attempts: 3,
      lastOutcome: "nearly",
      lastAt: "2026-10-02T10:00:00.000Z",
    },
    {
      cardId: "card:kot",
      summary: "Mam kota",
      topics: ["animals"],
      attempts: 4,
      lastOutcome: "got_it",
      lastAt: "2026-10-01T10:00:00.000Z",
    },
  ],
};

const settings = { level: "beginner" as const, learningStyle: "gentle" as const };

function json(payload: ProgressSummaryPayload): string {
  return JSON.stringify(payload);
}

describe("the summary payload", () => {
  it("carries counts, topic labels, outcomes and the two saved categories", () => {
    expect(buildProgressSummaryPayload(progress, settings)).toEqual({
      counts: { improvements: 1, faster: 1, nextTopics: 1, strengths: 1 },
      topics: [
        { label: "Animals", cards: 1 },
        { label: "Cases", cards: 1 },
      ],
      recentOutcomes: [
        { topic: "Cases", outcome: "nearly" },
        { topic: "Animals", outcome: "got_it" },
      ],
      level: "beginner",
      learningStyle: "gentle",
    });
  });

  it("never carries a card summary, a card id or a learner answer", () => {
    const text = json(buildProgressSummaryPayload(progress, settings));
    expect(text).not.toContain("Piję kawę");
    expect(text).not.toContain("Mam kota");
    expect(text).not.toContain("card:pije");
    expect(text).not.toContain("card:kot");
    expect(text).not.toContain("kawę");
  });

  it("caps topics and outcomes so the request stays short", () => {
    const many: ProgressView = {
      ...progress,
      cards: Array.from({ length: 20 }, (_, index) => ({
        cardId: `card:${index}`,
        summary: `secret ${index}`,
        topics: [`topic-${index}`],
        attempts: 1,
        lastOutcome: "got_it" as const,
        lastAt: `2026-10-${String(20 - index).padStart(2, "0")}T10:00:00.000Z`,
      })),
    };
    const payload = buildProgressSummaryPayload(many, settings);
    expect(payload.topics).toHaveLength(8);
    expect(payload.recentOutcomes).toHaveLength(8);
    expect(json(payload)).not.toContain("secret");
  });
});

describe("the summary prompt", () => {
  it("shows the exact payload and sends the same user message", () => {
    const payload = buildProgressSummaryPayload(progress, settings);
    const prompt = buildProgressSummaryPrompt(payload);
    expect(prompt.display).toContain('"counts"');
    expect(prompt.display).toContain('"level": "beginner"');
    expect(prompt.messages[1]).toEqual({ role: "user", content: prompt.display });
    expect(prompt.display).not.toContain("Piję kawę");
  });
});
