// WHY: Only cards decide which local media must survive. Collecting those
// references in one place keeps garbage collection, backup and export from
// each guessing and accidentally deleting a file a retired card still shows.
// PACK: teaching-layers
// 2026-10-25 opencode: created for the teaching layer pack. [pack: teaching-layers]

import type { Card } from "@/lib/shared/types";

/** A local media id is the only kind of source this app owns a Blob for. */
const MEDIA_ID = /^media-[A-Za-z0-9-]+$/;

/** True when a source names a record in the media store. */
export function isMediaId(value: string): boolean {
  return MEDIA_ID.test(value);
}

/** The card fields that can point at local media. */
export type MediaCarrier = Pick<Card, "prompt" | "answer" | "teaching">;

/** Every local media id one card points at, side media and teaching alike. */
export function mediaIdsInCard(card: MediaCarrier): string[] {
  const ids = new Set<string>();
  for (const part of card.teaching ?? []) {
    if ((part.type === "image" || part.type === "video") && part.source === "local") ids.add(part.src);
  }
  for (const part of [...card.prompt, ...card.answer]) {
    if (part.type === "media" && isMediaId(part.src)) ids.add(part.src);
  }
  return [...ids];
}

/** Every local media id the library still needs. Retired cards count. */
export function referencedMediaIds(cards: MediaCarrier[]): Set<string> {
  const ids = new Set<string>();
  for (const card of cards) {
    for (const id of mediaIdsInCard(card)) ids.add(id);
  }
  return ids;
}
