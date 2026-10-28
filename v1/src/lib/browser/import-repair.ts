// WHY: A refused import fails the same way every time, so the learner can ask
// the provider to repair the exact file once. The request is held for preview,
// sent only on confirmation, and its answer must pass the normal validator
// before anything is saved.
// PACK: import-repair
// 2026-10-27 opencode: created for the import repair pack
// [pack: import-repair]

import { newId } from "@/lib/core/id";
import { importBundle, type ImportTarget } from "@/lib/browser/bundle";
import { providerConfig } from "@/lib/browser/provider";
import { callBrowserProvider } from "@/lib/browser/provider-call";
import type { ChatMessage } from "@/lib/provider/client";
import { buildImportRepairPrompt } from "@/lib/provider/repair";
import { appendPrompt } from "@/lib/browser/repository";
import {
  failImportRepair,
  finishImportRepair,
  importJobResult,
  markImportRepairStarted,
  readImportRepairInput,
  type JobResult,
} from "@/lib/browser/jobs";

/** One repair preview, held only until it is sent or forgotten. */
interface HeldRepair {
  id: string;
  jobId: string;
  text: string;
  target: ImportTarget;
  namePolicy: "strict" | "auto-suffix";
  display: string;
  messages: ChatMessage[];
  details: string[];
  expiresAt: number;
}

/** Ten minutes is long enough to read the file and short enough to forget. */
const TTL_MS = 10 * 60 * 1000;
const held = new Map<string, HeldRepair>();

/** What the dock needs before it can show the exact send. */
export type RepairPreparation =
  | { ok: true; requestId: string; prompt: string }
  | { ok: false; message: string };

/** Build and hold the repair prompt; no provider call happens here. */
export async function prepareImportRepair(jobId: string): Promise<RepairPreparation> {
  const input = await readImportRepairInput(jobId);
  if (!input) {
    return { ok: false, message: "That import is no longer waiting for a repair." };
  }
  if (input.text.trim().length === 0) {
    return { ok: false, message: "There is no refused text to send." };
  }
  const config = await providerConfig();
  if (!config.ok) return { ok: false, message: config.message };

  const prompt = buildImportRepairPrompt(input.text, input.details, input.target.kind);
  const prepared: HeldRepair = {
    id: newId(),
    jobId,
    text: input.text,
    target: input.target,
    namePolicy: input.namePolicy,
    display: prompt.display,
    messages: prompt.messages,
    details: input.details,
    expiresAt: Date.now() + TTL_MS,
  };
  held.set(prepared.id, prepared);

  for (const [id, entry] of held) {
    if (entry.expiresAt <= Date.now()) held.delete(id);
  }

  return { ok: true, requestId: prepared.id, prompt: prepared.display };
}

/** What the dock says after a repair attempt. */
export type RepairResult =
  | { ok: true; result: JobResult }
  | { ok: false; message: string; details: string[] };

/** Turn a refused import into a validator issue list, keeping its field names. */
function refusalDetails(issues: Array<{ field: string; message: string }>): string[] {
  return issues.map((issue) => `${issue.field}: ${issue.message}`);
}

/** Send one held repair and save only when the normal validator passes. */
export async function repairImportJob(requestId: string): Promise<RepairResult> {
  if (!requestId) return { ok: false, message: "A prepared repair id is needed.", details: [] };
  const prepared = held.get(requestId);
  held.delete(requestId);
  if (!prepared || prepared.expiresAt <= Date.now()) {
    return { ok: false, message: "That repair request has expired. Press Fix with AI again.", details: [] };
  }

  const config = await providerConfig();
  if (!config.ok) return { ok: false, message: config.message, details: prepared.details };

  try {
    await markImportRepairStarted(prepared.jobId);
  } catch (problem) {
    return {
      ok: false,
      message: problem instanceof Error ? problem.message : "That import is no longer waiting.",
      details: prepared.details,
    };
  }

  const result = await callBrowserProvider(config.config, prepared.messages, {
    timeoutMs: 60000,
  });
  await appendPrompt({
    at: new Date().toISOString(),
    kind: "import-repair",
    requestId: prepared.id,
    endpoint: config.config.url,
    model: config.config.model,
    prompt: prepared.display,
  });

  if (!result.ok) {
    await failImportRepair(prepared.jobId, result.message, prepared.details);
    return { ok: false, message: result.message, details: prepared.details };
  }

  try {
    const imported = await importBundle(result.text, prepared.target, {
      namePolicy: prepared.namePolicy,
    });
    if (!imported.ok) {
      const details = refusalDetails(imported.issues);
      const message = "Nothing was imported, because the provider's answer still needs fixing.";
      await failImportRepair(prepared.jobId, message, details);
      return { ok: false, message, details };
    }
    const outcome = importJobResult(imported);
    await finishImportRepair(prepared.jobId, outcome);
    return { ok: true, result: outcome };
  } catch (problem) {
    const message = problem instanceof Error
      ? problem.message
      : "The repaired file could not be read.";
    await failImportRepair(prepared.jobId, message, prepared.details);
    return { ok: false, message, details: prepared.details };
  }
}

/** Test isolation: forget every held repair. */
export function clearHeldRepairsForTests(): void {
  held.clear();
}
