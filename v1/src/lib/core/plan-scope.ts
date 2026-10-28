// WHY: The plan can draw from many packs and decks, so the selection must be
// one checked shape that the screen, the router and the session fact all agree
// on. The rules live here, away from React, so the union and its plain name can
// be tested without a browser.
// PACK: plan-multi-select
// 2026-10-27 opencode: created for the multi-pack plan scope pack
// [pack: plan-multi-select]

import type { Card, PackStatus, PlanScope, PlanScopeItem } from "@/lib/shared/types";
import type { PastSession } from "@/lib/core/past-sessions";

/** A value is a plan scope only when every item has a pack and deck ids. */
export function isPlanScope(value: unknown): value is PlanScope {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (item === null || typeof item !== "object") return false;
    const record = item as { pack?: unknown; decks?: unknown };
    return (
      typeof record.pack === "string" &&
      record.pack.length > 0 &&
      Array.isArray(record.decks) &&
      record.decks.every((deck) => typeof deck === "string" && deck.length > 0)
    );
  });
}

/** Read the scope from a URL or a stored fact; null means it was not valid. */
export function parsePlanScope(raw: string | null): PlanScope | null {
  if (raw === null || raw.trim().length === 0) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return isPlanScope(value) ? value : null;
  } catch {
    return null;
  }
}

/** The one text form carried in a plan request. An empty scope sends nothing. */
export function encodePlanScope(scope: PlanScope): string {
  return scope.length === 0 ? "" : JSON.stringify(scope);
}

/** Keep only packs and decks that exist, and drop duplicate choices. */
export function normalizePlanScope(
  scope: PlanScope,
  packs: readonly PackStatus[],
): { ok: true; scope: PlanScope } | { ok: false; problems: string[] } {
  const byName = new Map(packs.map((pack) => [pack.name, pack]));
  const problems: string[] = [];
  const merged = new Map<string, Set<string>>();

  for (const item of scope) {
    const pack = byName.get(item.pack);
    if (!pack) {
      problems.push(`There is no pack “${item.pack}” here.`);
      continue;
    }
    const known = new Set((pack.decks ?? []).map((deck) => deck.id));
    const chosen = item.decks.filter((deck) => known.has(deck));
    const missing = item.decks.filter((deck) => !known.has(deck));
    for (const deck of missing) problems.push(`There is no deck “${deck}” in “${item.pack}”.`);
    if (chosen.length === 0) {
      if (missing.length === 0) problems.push(`Choose at least one deck in “${item.pack}”.`);
      continue;
    }
    const bucket = merged.get(item.pack) ?? new Set<string>();
    for (const deck of chosen) bucket.add(deck);
    merged.set(item.pack, bucket);
  }

  if (problems.length > 0) return { ok: false, problems };

  const normalized: PlanScope = [];
  for (const pack of packs) {
    const chosen = merged.get(pack.name);
    if (!chosen) continue;
    normalized.push({
      pack: pack.name,
      decks: (pack.decks ?? []).map((deck) => deck.id).filter((deck) => chosen.has(deck)),
    });
  }
  return { ok: true, scope: normalized };
}

/** Does a card come from the chosen source? An empty scope is the library. */
export function cardIsInScope(card: Card, scope: PlanScope): boolean {
  if (scope.length === 0) return true;
  const deckId = card.deckId;
  if (typeof deckId !== "string") return false;
  return scope.some((item) => item.pack === card.packName && item.decks.includes(deckId));
}

/** The plain name of a selection, used by the plan and the history list. */
export function scopeSummary(scope: PlanScope, packs: readonly PackStatus[]): string {
  if (scope.length === 0) return "the whole library";

  const rows = scope.map((item) => {
    const pack = packs.find((entry) => entry.name === item.pack) ?? null;
    const allDecks = pack?.decks?.map((deck) => deck.id) ?? [];
    const allSelected =
      allDecks.length > 0 && allDecks.every((deck) => item.decks.includes(deck));
    return { item, pack, allDecks, allSelected };
  });

  if (rows.length === 1) {
    const row = rows[0];
    if (row.allSelected) return row.item.pack;
    if (row.item.decks.length === 1) {
      const deck = row.pack?.decks?.find((entry) => entry.id === row.item.decks[0]);
      return deck ? `${row.item.pack} / ${deck.name}` : row.item.pack;
    }
    return `${row.item.decks.length} decks in ${row.item.pack}`;
  }

  const everyDeck = rows.every((row) => row.allSelected);
  return everyDeck ? `all decks in ${rows.length} packs` : `${rows.length} packs`;
}

/** The scope a previous session can replay, or null when the row is too old. */
export function pastScope(row: PastSession, packs: readonly PackStatus[]): PlanScope | null {
  if (row.scope !== undefined) {
    const checked = normalizePlanScope(row.scope, packs);
    return checked.ok ? checked.scope : null;
  }
  // WHY: Older rows only named one pack and deck. The deck list comes from the
  // current library, so all-decks remains all-decks after the feature lands.
  if (row.pack === undefined) return null;
  if (row.pack === "") return [];
  const pack = packs.find((entry) => entry.name === row.pack);
  if (!pack) return null;
  if (row.deck) {
    const known = (pack.decks ?? []).some((deck) => deck.id === row.deck);
    return known ? [{ pack: row.pack, decks: [row.deck] }] : null;
  }
  const decks = (pack.decks ?? []).map((deck) => deck.id);
  return decks.length > 0 ? [{ pack: row.pack, decks }] : null;
}

/** A scope item for a pack with every deck ticked, or null when it has none. */
export function allDecksItem(pack: PackStatus): PlanScopeItem | null {
  const decks = (pack.decks ?? []).map((deck) => deck.id);
  return decks.length === 0 ? null : { pack: pack.name, decks };
}
