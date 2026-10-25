// WHY: Built-in packs arrive through a manifest that is read on each app start.
// One frozen seed asset could never deliver a second pack or a fixed lesson, so
// this module decides install, additive update, dismissal and silence on failure.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching-layers pack [pack: teaching-layers]

import { z } from "zod";
import type { Card } from "@/lib/shared/types";
import { withBasePath } from "@/lib/shared/paths";
import { compareVersions, importBundle } from "@/lib/browser/bundle";
import { readPacks, readTombstoneIds, writeTombstone } from "@/lib/browser/repository";

/** The manifest version. A manifest without it is ignored, never guessed. */
export const SEED_INDEX_SCHEMA = "flashcards.pack-index/v1";

const SEED_INDEX_PATH = "/packs/index.json";

/** The whole pass gets one deadline, so a stalled network cannot hold the app. */
const SEED_TIMEOUT_MS = 4_000;

/** A file a manifest may name: under the packs folder and never above it. */
const seedFileSchema = z
  .string()
  .regex(/^\/packs\/[A-Za-z0-9._/-]+$/, "a seed file lives under /packs/")
  .refine((value) => !value.split("/").includes(".."), "a seed file cannot leave the packs folder");

const seedIndexSchema = z.object({
  schema: z.literal(SEED_INDEX_SCHEMA),
  packs: z.array(
    z.object({
      name: z.string().min(1),
      version: z.string().min(1),
      file: seedFileSchema,
    }),
  ),
});

interface SeedEntry {
  name: string;
  version: string;
  file: string;
}

/** What a start would do with one listed pack. */
export type SeedAction = "install" | "update" | "none";

/** One manifest entry beside what the library already holds. */
export interface SeedPackState extends SeedEntry {
  installedVersion: string | null;
  dismissed: boolean;
  action: SeedAction;
}

/** A browser without AbortSignal.timeout still gets an unbounded attempt. */
function seedSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(SEED_TIMEOUT_MS)
    : undefined;
}

/** Read and check the manifest. A missing or broken file is silent. */
async function readIndex(signal?: AbortSignal): Promise<SeedEntry[] | null> {
  try {
    const response = await fetch(withBasePath(SEED_INDEX_PATH), { cache: "no-store", signal });
    if (!response.ok) return null;
    const parsed = seedIndexSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.packs : null;
  } catch {
    return null;
  }
}

/** Decide one pack's fate from its version, the installed version and dismissal. */
function actionFor(version: string, installedVersion: string | null, dismissed: boolean): SeedAction {
  if (dismissed) return "none";
  if (installedVersion === null) return "install";
  const order = compareVersions(version, installedVersion);
  if (order === null) return "none";
  return order > 0 ? "update" : "none";
}

/** Pair the manifest with the library. Null means there is no usable manifest. */
async function planSeeds(signal?: AbortSignal): Promise<SeedPackState[] | null> {
  const entries = await readIndex(signal);
  if (!entries) return null;
  const [packs, dismissed] = await Promise.all([readPacks(), readTombstoneIds("pack")]);
  const installed = new Map(packs.map((pack) => [pack.name, pack.version]));
  return entries.map((entry) => {
    const installedVersion = installed.get(entry.name) ?? null;
    const isDismissed = dismissed.has(entry.name);
    return {
      ...entry,
      installedVersion,
      dismissed: isDismissed,
      action: actionFor(entry.version, installedVersion, isDismissed),
    };
  });
}

/** What the next start would do, without changing a row. */
export async function seedState(): Promise<SeedPackState[]> {
  return (await planSeeds(seedSignal())) ?? [];
}

/**
 * Apply the manifest. Each pack is independent: one failure stays silent and is
 * retried on the next start, while the others still install. A deleted card is
 * skipped by its content id, so changed words arrive as a new card.
 */
export async function ensureSeeded(): Promise<void> {
  const signal = seedSignal();
  try {
    const states = await planSeeds(signal);
    if (!states) return;
    const suppressed = await readTombstoneIds("card");
    for (const state of states) {
      if (state.action === "none") continue;
      try {
        const response = await fetch(withBasePath(state.file), { cache: "no-store", signal });
        if (!response.ok) continue;
        const text = await response.text();
        await importBundle(text, { kind: "pack" }, { suppressCardIds: suppressed });
      } catch {
        // Never stop the app or the other packs; the next start tries again.
      }
    }
  } catch {
    // A manifest that cannot be read leaves the library exactly as it was.
  }
}

/** Remember that the learner removed a built-in pack, so a seed leaves it out. */
export function dismissPack(name: string): Promise<void> {
  return writeTombstone({ id: name, kind: "pack", at: new Date().toISOString() });
}

/** Remember a deleted pack-origin card without touching the card row. */
export function deleteBuiltInCard(card: Pick<Card, "id" | "origin">): Promise<void> {
  if (card.origin.kind !== "pack") return Promise.resolve();
  return writeTombstone({ id: card.id, kind: "card", at: new Date().toISOString() });
}
