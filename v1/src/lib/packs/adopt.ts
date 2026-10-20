// WHY: A pack suggests cards; the learner owns them. Adoption gives each pack
// card a stable identity so reinstalling or updating cannot duplicate it, and
// it leaves cards in place when a pack folder disappears.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import type { Card, CardSource, PackStatus } from "@/lib/shared/types";
import { buildCard, packCardId } from "@/lib/core/card";
import type { PackRecord } from "@/lib/packs/types";

/** What adoption changed, and the display status for every pack folder. */
export interface AdoptionResult {
  cards: Card[];
  added: number;
  updated: number;
  statuses: PackStatus[];
}

/** The origin note a pack card carries. It names the pack, never the learner. */
function packOrigin(pack: PackRecord) {
  return {
    kind: "pack" as const,
    note: `From the ${pack.name} pack, version ${pack.version}.`,
    packName: pack.name,
    packVersion: pack.version,
  };
}

/** Turn one pack source into a learner-owned card with a stable id. */
function adoptSource(pack: PackRecord, source: CardSource, now: string): Card {
  return buildCard(source, packOrigin(pack), packCardId(pack.name, source), now);
}

/**
 * Fold every loaded pack into the learner's card set. Existing cards keep
 * their evidence; only the pack's version note is refreshed.
 */
export function adoptPacks(
  packs: PackRecord[],
  existingCards: Card[],
  now: string,
): AdoptionResult {
  const byId = new Map(existingCards.map((card) => [card.id, card]));
  const statuses: PackStatus[] = [];
  let added = 0;
  let updated = 0;

  for (const pack of packs) {
    if (pack.error) {
      statuses.push({
        name: pack.name,
        version: pack.version,
        folder: pack.folder,
        topics: [],
        topicLabels: {},
        cardCount: 0,
        error: pack.error,
      });
      continue;
    }

    let cardCount = 0;
    for (const source of pack.cards) {
      const id = packCardId(pack.name, source);
      const existing = byId.get(id);
      if (existing) {
        // Same identity means same content: refresh the version note, keep all
        // evidence and tags exactly where they are.
        if (existing.origin.packVersion !== pack.version) {
          byId.set(id, {
            ...existing,
            origin: { ...existing.origin, packVersion: pack.version, note: packOrigin(pack).note },
          });
          updated += 1;
        }
      } else {
        byId.set(id, adoptSource(pack, source, now));
        added += 1;
      }
      cardCount += 1;
    }

    statuses.push({
      name: pack.name,
      version: pack.version,
      folder: pack.folder,
      description: pack.description,
      language: pack.language,
      topics: pack.topics,
      topicLabels: pack.topicLabels,
      cardCount,
    });
  }

  return { cards: [...byId.values()], added, updated, statuses };
}

/** Packs whose cards still exist even though the folder is gone. */
export function orphanedPackNames(cards: Card[], statuses: PackStatus[]): string[] {
  const installed = new Set(statuses.filter((status) => !status.error).map((status) => status.name));
  const orphans = new Set<string>();
  for (const card of cards) {
    const packName = card.origin.packName;
    if (packName && !installed.has(packName)) orphans.add(packName);
  }
  return [...orphans];
}

/** Merge the topic labels from every installed pack for display only. */
export function collectTopicLabels(statuses: PackStatus[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const status of statuses) {
    if (status.error) continue;
    for (const [topic, label] of Object.entries(status.topicLabels)) {
      labels[topic] = label;
    }
  }
  return labels;
}
