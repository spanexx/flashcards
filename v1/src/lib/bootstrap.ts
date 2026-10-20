// WHY: The app opens the same way every time: make the folders, look in the
// one pack library, adopt what is there, and keep the learner's copy of every
// card. A broken pack is named and skipped; nothing else is disturbed.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { readJson, writeJson } from "@/lib/storage/json";
import { dataFile, ensureDir, getDataDir, getPacksDir } from "@/lib/storage/paths";
import { scanPacks } from "@/lib/packs/loader";
import { adoptPacks, collectTopicLabels, orphanedPackNames } from "@/lib/packs/adopt";
import type { PackRecord } from "@/lib/packs/types";
import type { Card, PackStatus } from "@/lib/shared/types";

/** The learner's card file. Cards belong to the learner, not to a pack. */
interface CardsFile {
  version: number;
  cards: Card[];
}

/** What the app knows after boot: cards, packs, labels and the pack library path. */
export interface BootstrapState {
  cards: Card[];
  packs: PackRecord[];
  statuses: PackStatus[];
  topicLabels: Record<string, string>;
  orphanedPacks: string[];
  packsDir: string;
  loadedAt: string;
}

let cached: Promise<BootstrapState> | null = null;

/** Read the learner's cards, with an empty deck as the starting point. */
export async function loadCards(): Promise<Card[]> {
  const file = await readJson<CardsFile>(dataFile("cards.json"), { version: 1, cards: [] });
  return Array.isArray(file.cards) ? file.cards : [];
}

/** The bare file write, without touching the boot cache. */
async function writeCardsFile(cards: Card[]): Promise<void> {
  await writeJson(dataFile("cards.json"), { version: 1, cards } satisfies CardsFile);
}

/**
 * Replace the learner's card file. Evidence rows are separate and untouched.
 * The cached boot state is dropped, because it still holds the old deck: a
 * read right after a write must see what was just written.
 */
export async function saveCards(cards: Card[]): Promise<void> {
  await writeCardsFile(cards);
  resetBootstrapCache();
}

/** Forget the cached boot state; the next call rescans the library. */
export function resetBootstrapCache(): void {
  cached = null;
}

/** Boot the app: folders, pack scan, adoption, pack status. */
export function ensureBootstrapped(force = false): Promise<BootstrapState> {
  if (force) cached = null;
  if (!cached) {
    cached = bootstrap().catch((error) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}

/** The one real boot pass. */
async function bootstrap(): Promise<BootstrapState> {
  await ensureDir(getDataDir());
  const packsDir = getPacksDir();
  const now = new Date().toISOString();

  const existing = await loadCards();
  const packs = await scanPacks(packsDir);
  const adopted = adoptPacks(packs, existing, now);

  const changed =
    adopted.added > 0 ||
    adopted.updated > 0 ||
    adopted.cards.length !== existing.length ||
    packs.some((pack) => pack.error);

  if (changed || existing.length === 0) {
    await writeCardsFile(adopted.cards);
  }

  const orphans = orphanedPackNames(adopted.cards, adopted.statuses);
  await writeJson(dataFile("pack-status.json"), {
    at: now,
    packsDir,
    statuses: adopted.statuses,
    orphanedPacks: orphans,
  });

  return {
    cards: adopted.cards,
    packs,
    statuses: adopted.statuses,
    topicLabels: collectTopicLabels(adopted.statuses),
    orphanedPacks: orphans,
    packsDir,
    loadedAt: now,
  };
}
