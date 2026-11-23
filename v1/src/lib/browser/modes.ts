// WHY: A mode has two gates: its stored shape and its worked example. Both must
// speak the same plain ValidationIssue a screen already shows, and both must be
// readable by the router and the seed loader from one place. This module is that
// one place; the loader and the routes are added in the same pack, never a
// second copy of the checks.
// PACK: learning-mode-core
// 2026-11-22 opencode: created for the learning-mode-core pack.
// [pack: learning-mode-core]

import { z } from "zod";
import type { LearningMode } from "@/lib/shared/types";
import {
  issuesFromZod,
  learningModeSchema,
  type ValidationIssue,
} from "@/lib/core/schema";
import { compareVersions, validateCanonicalExample } from "@/lib/browser/bundle";
import { readModes, writeMode } from "@/lib/browser/repository";
import { withBasePath } from "@/lib/shared/paths";

/** The manifest version. A manifest without it is ignored, never guessed. */
export const MODE_INDEX_SCHEMA = "flashcards.mode-index/v1";

const MODES_INDEX_PATH = "/modes/index.json";

/** The whole pass gets one deadline, so a stalled network cannot hold the app. */
const MODES_TIMEOUT_MS = 4_000;

/** A file a manifest may name: under the modes folder and never above it. */
const modeFileSchema = z
  .string()
  .regex(/^\/modes\/[A-Za-z0-9._/-]+$/, "a mode file lives under /modes/")
  .refine((value) => !value.split("/").includes(".."), "a mode file cannot leave the modes folder");

const modeIndexSchema = z.object({
  schema: z.literal(MODE_INDEX_SCHEMA),
  modes: z.array(
    z.object({
      id: z.string().min(1),
      version: z.string().min(1),
      file: modeFileSchema,
    }),
  ),
});

interface ModeEntry {
  id: string;
  version: string;
  file: string;
}

/** A browser without AbortSignal.timeout still gets an unbounded attempt. */
function modesSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(MODES_TIMEOUT_MS)
    : undefined;
}

/** Read and check the manifest. A missing or broken file is silent. */
async function readModeIndex(signal?: AbortSignal): Promise<ModeEntry[] | null> {
  try {
    const response = await fetch(withBasePath(MODES_INDEX_PATH), { cache: "no-store", signal });
    if (!response.ok) return null;
    const parsed = modeIndexSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.modes : null;
  } catch {
    return null;
  }
}

/**
 * Install or refresh the app's built-in modes.
 *
 * Each manifest entry is independent: one broken or missing file leaves that
 * mode exactly as it was and the next start tries again. A built-in is replaced
 * only when the manifest's version is newer, and no code path deletes a row, so
 * a learner's copy is never removed by a seed.
 */

export async function ensureModesSeeded(): Promise<void> {
  const signal = modesSignal();
  try {
    const entries = await readModeIndex(signal);
    if (!entries) return;
    const installed = new Map((await readModes()).map((mode) => [mode.id, mode]));
    for (const entry of entries) {
      try {
        const current = installed.get(entry.id);
        // WHY: A row the learner owns is not the app's to replace, even if its
        // id happens to match a built-in. The learner's copy wins.
        if (current && !current.isBuiltIn) continue;
        if (current) {
          const order = compareVersions(entry.version, current.version);
          // WHY: An unreadable or equal version is not newer, so the installed
          // row stays exactly as the learner last saw it.
          if (order === null || order <= 0) continue;
        }

        const response = await fetch(withBasePath(entry.file), { cache: "no-store", signal });
        if (!response.ok) continue;
        const read = readLearningMode(await response.json());
        // WHY: A file that does not wear the id its manifest entry names is not
        // the mode the manifest promised, so it is left for a fixed deploy.
        if (!read.ok || read.mode.id !== entry.id) continue;

        await writeMode({ ...read.mode, isBuiltIn: true });
      } catch {
        // Never stop the app or the other modes; the next start tries again.
      }
    }
  } catch {
    // A manifest that cannot be read leaves the library exactly as it was.
  }
}

/** A checked mode, or the plain problems that stop it. */
export type LearningModeRead =
  | { ok: true; mode: LearningMode }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Read one stored mode. The stored shape is checked first, because the example
 * check needs a string id and a truthy name to name its own problem; then the
 * example runs the bundle, card, lesson and spoiler rules.
 */
export function readLearningMode(value: unknown, index = 0): LearningModeRead {
  const parsed = learningModeSchema.safeParse(value);
  if (!parsed.success) return { ok: false, issues: issuesFromZod(parsed.error, index) };

  const exampleIssues = validateCanonicalExample(parsed.data.canonicalExample);
  if (exampleIssues.length > 0) {
    return {
      ok: false,
      // WHY: The field names the place a person must fix: the example, not the
      // mode's own row. The card index from the bundle check is kept, so a
      // multi-card example still points at the card that is wrong.
      // [pack: learning-mode-core]
      issues: exampleIssues.map((issue) => ({
        ...issue,
        field: `canonicalExample.${issue.field}`,
      })),
    };
  }

  return { ok: true, mode: parsed.data };
}

/** The problems with one mode, or an empty list when it is ready to store. */
export function learningModeIssues(value: unknown, index = 0): ValidationIssue[] {
  const read = readLearningMode(value, index);
  return read.ok ? [] : read.issues;
}
