// WHY: The summary request is shown to the learner before it leaves, so its
// exact text is built here. The model sees counts and topic labels only; the
// prompt never asks for or repeats a card's words.
// PACK: progress-summary
// 2026-10-27 opencode: created for the progress summary pack
// [pack: progress-summary]

import type { ChatMessage } from "@/lib/provider/client";
import type { BuiltPrompt } from "@/lib/provider/prompt";
import type { ProgressSummaryPayload } from "@/lib/core/progress-summary";

/** The tutor's standing instruction for a progress summary. */
export const SUMMARY_SYSTEM =
  "You summarise one learner's progress for that learner. Use only the counts, topic labels and outcome categories in the message. Do not invent card content, give a score or percentage, or set a study plan. Write two short paragraphs in plain words: what is going well, and what is still asking for work.";

/** Build the exact preview text and the messages that will be sent. */
export function buildProgressSummaryPrompt(payload: ProgressSummaryPayload): BuiltPrompt {
  const shape = JSON.stringify(payload, null, 2);
  const user = [
    "Here is the learner's progress, as counts and labels only:",
    "",
    shape,
  ].join("\n");
  const messages: ChatMessage[] = [
    { role: "system", content: SUMMARY_SYSTEM },
    { role: "user", content: user },
  ];
  // WHY: The display is the whole user message, so the learner sees the exact
  // payload shape rather than a paraphrase of it.
  return { display: user, messages };
}
