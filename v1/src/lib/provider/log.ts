// WHY: The privacy boundary promises a local log of what was sent and when.
// It lives beside the learner's other data and is never uploaded anywhere.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import "server-only";
import type { PromptLogEntry } from "@/lib/shared/types";
import { appendJsonl, readJsonl } from "@/lib/storage/jsonl";
import { dataFile } from "@/lib/storage/paths";

/** Add one outbound prompt to the local log. */
export async function appendPromptLog(entry: PromptLogEntry): Promise<void> {
  await appendJsonl(dataFile("prompt-log.jsonl"), entry);
}

/** The most recent entries, newest first. */
export async function readPromptLog(limit = 50): Promise<PromptLogEntry[]> {
  const entries = await readJsonl<PromptLogEntry>(dataFile("prompt-log.jsonl"));
  return entries.slice(-limit).reverse();
}
