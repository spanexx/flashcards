// WHY: "Draft a learning mode" must use the same provider lane and the same
// approve-before-send rule as a page draft. This module owns the versioned
// meta-skill prompt and the answer reader; it never writes a mode to the store.
// The router only holds and sends the prompt, so one screen can later show it.
// PACK: prompt-assembler
// 2026-11-23 opencode: created the AI mode draft module. [pack: prompt-assembler]

import type { LearningMode } from "@/lib/shared/types";
import { ProviderTimeoutError } from "@/lib/provider/client";
import { callBrowserProvider } from "@/lib/browser/provider-call";
import { holdPrepared, takePrepared } from "@/lib/provider/prepare";
import { parseJsonLoose } from "@/lib/core/json-repair";
import { readLearningMode } from "@/lib/browser/modes";
import { providerConfig } from "@/lib/browser/provider";
import { appendPrompt } from "@/lib/browser/repository";

/** Bump when the meta-skill text or the answer shape it teaches changes. */
export const MODE_DRAFT_VERSION = "1.0.0";

/**
 * The meta-skill prompt. It asks for JSON only and names the stored shape,
 * because a draft the Track 1 reader cannot accept is not a draft at all.
 */
const DRAFT_SYSTEM = [
  "You design one learning mode for a flashcards app.",
  "Answer with one JSON object and nothing else: no markdown fence, no explanation, no comments.",
  "The object carries exactly these fields:",
  '"id": a lowercase slug of letters, numbers and dashes.',
  '"name": a short human name; "description": one sentence; "version": a number like 1.0.0.',
  '"defaultCardMix": a non-empty array of the five answer modes: cloze, picks, type, hear_type, match.',
  '"usesWordStages": a boolean.',
  '"skillInstructions": the rules a generator follows when it writes cards for this mode. Teach the approach, never one answer.',
  '"canonicalExample": a whole flashcards.pack/v1 bundle object, never a JSON string inside JSON. Every card names a deck in "decks"; every blank has one expected answer; every picks card has "correct" inside "options"; no teaching part gives an answer away.',
  '"isBuiltIn": false; "createdAt": an ISO date and time.',
  "Never include learner evidence, a provider key, a backup or screen text.",
].join("\n");

/** Build the exact prompt the learner approves before it leaves. */
export function buildModeDraftPrompt(instruction: string): {
  display: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
} {
  // WHY: an empty instruction still names a task, so the provider is never
  // asked to invent both a subject and a whole mode with no direction.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: added the mode draft prompt. [pack: prompt-assembler]
  const asked = instruction.trim() || "Design a mode that teaches through plain-English rules.";
  return {
    display: ["Write one learning mode.", "", `Instruction: ${asked}`, "", DRAFT_SYSTEM].join("\n"),
    messages: [
      { role: "system", content: DRAFT_SYSTEM },
      { role: "user", content: `Instruction: ${asked}` },
    ],
  };
}

/** What the screen must hold between prepare and send. */
export interface PreparedModeDraft {
  requestId: string;
  prompt: string;
  expiresAt: number;
  version: string;
}

/** Build the prompt and hold it until the learner approves it. */
export async function prepareModeDraft(instruction?: string): Promise<PreparedModeDraft> {
  // WHY: holding once keeps the displayed text and the sent messages identical,
  // which is the promise every prepared prompt in this app makes.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: added the prepare step. [pack: prompt-assembler]
  const prompt = buildModeDraftPrompt(instruction ?? "");
  const prepared = holdPrepared({
    kind: "mode",
    display: prompt.display,
    messages: prompt.messages as Parameters<typeof holdPrepared>[0]["messages"],
    packName: null,
    topic: null,
    count: 1,
    cardId: null,
  });
  return {
    requestId: prepared.id,
    prompt: prompt.display,
    expiresAt: prepared.expiresAt,
    version: MODE_DRAFT_VERSION,
  };
}

/** Send one approved draft prompt. The answer goes back to the editor unsaved. */
export async function generateModeDraft(requestId: string): Promise<LearningMode> {
  if (!requestId) throw new Error("A prepared prompt id is needed.");
  const prepared = takePrepared(requestId);
  // WHY: a mode draft reads a whole mode, not a page or a line batch. Checking
  // the kind stops one held prompt from being spent through the wrong reader.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: added the one-time send step. [pack: prompt-assembler]
  if (!prepared || prepared.kind !== "mode") {
    throw new Error("That prepared prompt has expired. Prepare it again.");
  }
  const config = await providerConfig();
  if (!config.ok) throw new Error(config.message);

  const result = await callBrowserProvider(config.config, prepared.messages, { timeoutMs: 60000 });
  await appendPrompt({
    at: new Date().toISOString(),
    kind: "generation",
    requestId: prepared.id,
    endpoint: config.config.url,
    model: config.config.model,
    prompt: prepared.display,
  });
  if (!result.ok) {
    if (result.reason === "timeout") throw new ProviderTimeoutError(result.message);
    throw new Error(result.message);
  }

  let raw: unknown;
  try {
    raw = parseJsonLoose(result.text).value;
  } catch {
    throw new Error("Nothing was drafted, because the answer was not JSON.");
  }
  const record = raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  // WHY: isBuiltIn and createdAt describe where a row came from, so the app owns
  // them. An AI answer may never create an app-owned mode or a backdated one.
  // PACK: prompt-assembler
  // 2026-11-23 opencode: added the server-owned field override. [pack: prompt-assembler]
  const read = readLearningMode({
    ...record,
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
  });
  if (!read.ok) {
    const first = read.issues[0];
    const reason = first ? ` ${first.field}: ${first.message}` : "";
    throw new Error(`Nothing was drafted, because the answer was not a usable learning mode.${reason}`);
  }
  return read.mode;
}
