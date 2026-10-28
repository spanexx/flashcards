// WHY: The progress summary uses the browser's provider key, but only after the
// learner has seen and approved the exact payload. The request is held briefly,
// sent once, and never stored; no summary row is written to the library.
// PACK: progress-summary
// 2026-10-27 opencode: created for the progress summary pack
// [pack: progress-summary]

import { newId } from "@/lib/core/id";
import { readProgress } from "@/lib/core/progress";
import {
  buildProgressSummaryPayload,
  type ProgressSummaryPayload,
} from "@/lib/core/progress-summary";
import type { ChatMessage } from "@/lib/provider/client";
import { callProvider } from "@/lib/provider/client";
import { buildProgressSummaryPrompt } from "@/lib/provider/summary";
import { providerConfig } from "@/lib/browser/provider";
import {
  appendPrompt,
  readCards,
  readEvidence,
  readSettings,
} from "@/lib/browser/repository";

/** One prepared summary, held only until it expires or is sent. */
interface HeldSummary {
  id: string;
  display: string;
  messages: ChatMessage[];
  payload: ProgressSummaryPayload;
  expiresAt: number;
}

/** Ten minutes is long enough to read the payload and short enough to forget. */
const TTL_MS = 10 * 60 * 1000;
const held = new Map<string, HeldSummary>();

/** What the Summary tab needs before it can show a confirmation. */
export type SummaryPreparation =
  | {
      ok: true;
      requestId: string;
      prompt: string;
      payload: ProgressSummaryPayload;
      expiresAt: number;
    }
  | { ok: false; message: string };

/** Build and hold the compact payload; no provider call happens here. */
export async function prepareProgressSummary(): Promise<SummaryPreparation> {
  const config = await providerConfig();
  if (!config.ok) return { ok: false, message: config.message };

  const [cards, rows, settings] = await Promise.all([
    readCards(),
    readEvidence(),
    readSettings(),
  ]);
  const progress = readProgress(
    cards.filter((card) => !card.retired),
    rows,
    {},
  );
  const payload = buildProgressSummaryPayload(progress, settings);
  const prompt = buildProgressSummaryPrompt(payload);
  const prepared: HeldSummary = {
    id: newId(),
    display: prompt.display,
    messages: prompt.messages,
    payload,
    expiresAt: Date.now() + TTL_MS,
  };
  held.set(prepared.id, prepared);

  // Keep the small map from growing without a timer.
  for (const [id, entry] of held) {
    if (entry.expiresAt <= Date.now()) held.delete(id);
  }

  return {
    ok: true,
    requestId: prepared.id,
    prompt: prepared.display,
    payload,
    expiresAt: prepared.expiresAt,
  };
}

/** Send the one held summary; the answer is shown, never stored. */
export async function generateProgressSummary(requestId: string): Promise<string> {
  if (!requestId) throw new Error("A prepared summary id is needed.");
  const prepared = held.get(requestId);
  held.delete(requestId);
  if (!prepared || prepared.expiresAt <= Date.now()) {
    throw new Error("That summary request has expired. Ask again.");
  }

  const config = await providerConfig();
  if (!config.ok) throw new Error(config.message);

  const result = await callProvider(config.config, prepared.messages, {
    timeoutMs: 60000,
  });
  await appendPrompt({
    at: new Date().toISOString(),
    kind: "summary",
    requestId: prepared.id,
    endpoint: config.config.url,
    model: config.config.model,
    prompt: prepared.display,
  });
  if (!result.ok) throw new Error(result.message);
  const text = result.text.trim();
  if (text.length === 0) throw new Error("The provider answered with no words.");
  return text;
}

/** Test isolation: forget every held summary. */
export function clearHeldSummariesForTests(): void {
  held.clear();
}
