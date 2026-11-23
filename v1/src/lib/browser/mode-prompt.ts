// WHY: prompt layers accept two mode strings, while Track 1 stores a whole
// LearningMode. This module owns the one adapter and the one resolver, so the
// generation and chat routes agree on how a selected mode reaches a prompt.
// PACK: D-52
// 2026-11-23 opencode: created the mode contribution seam. [D-52]

import { ensureModesSeeded, readLearningMode } from "@/lib/browser/modes";
import { readMode } from "@/lib/browser/repository";
import type { ModePromptContribution } from "@/lib/shared/prompt-layers";
import type { LearningMode } from "@/lib/shared/types";

/** One seed pass per app start; a mode read must not race the first install. */
let modeSeedPass: Promise<void> | null = null;

async function readyModes(): Promise<void> {
  // WHY: the manifest is read once. A missing manifest leaves the store as it
  // was, and a later start retries instead of blocking a prompt.
  modeSeedPass ??= ensureModesSeeded();
  await modeSeedPass;
}

/**
 * Turn a validated stored mode into the seam the prompt layers render.
 * WHY: the seam carries a compact JSON string, not the stored bundle object.
 */
export function modeContribution(mode: LearningMode): ModePromptContribution {
  return {
    skillInstructions: mode.skillInstructions,
    canonicalExample: JSON.stringify(mode.canonicalExample),
  };
}

/**
 * Resolve the brief's mode selection.
 * WHY: a stale or broken selection must not break generation, so it adds no
 * layer 3 and the prompt keeps its old wording.
 */
export async function resolveModePrompt(
  modeId?: string | null,
): Promise<ModePromptContribution | null> {
  if (!modeId) return null;
  await readyModes();
  const row = await readMode(modeId);
  if (!row) return null;
  const read = readLearningMode(row);
  if (!read.ok) return null;
  return modeContribution(read.mode);
}
