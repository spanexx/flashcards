// WHY: The Library shell and its panels share a small set of decisions: how a
// pack-qualified deck value reads, what a card search can see, and where a
// create result should land. Keeping them here stops each panel from growing
// its own slightly different answer.
// PACK: library-create-flow
// 2026-10-21 opencode: created during the panel split [pack: library-create-flow]

import type { Card, PackStatus } from "@/lib/shared/types";
import { ApiError } from "@/lib/client/api";

/** The three jobs the Library offers. Create is the only one that writes. */
export type LibraryTab = "packs" | "cards" | "create";

/** The object a create flow is making. The object comes before the method. */
export type CreateTarget = "pack" | "deck" | "cards";

/** The four ways to make that object. Every one ends in the same validator. */
export type CreateMethod = "write" | "generate" | "chat" | "import";

/** What a successful create returns to the shell, whichever method made it. */
export type CreateResult =
  | { kind: "pack"; packName: string }
  | { kind: "deck"; packName: string; deckId: string }
  | { kind: "cards"; packName: string; deckId: string; count: number };

/** A pack-qualified deck value, because deck ids repeat across packs. */
export interface DeckChoice {
  value: string;
  id: string;
  name: string;
  pack: string;
}

/** The pack and deck a Cards view is narrowed to after a create. */
export interface CardFocus {
  packName: string;
  deckId: string;
}

/** A pack or deck the learner asked to delete, with the name they must type. */
export type DeleteTarget =
  | { kind: "pack"; packName: string }
  | { kind: "deck"; packName: string; deckId: string; deckName: string };

/** The shell opens a create panel at this target and method, once per token. */
export interface CreateSeed {
  target: CreateTarget;
  method: CreateMethod;
  packName?: string;
  deckId?: string;
  token: number;
}

/** Turn a pack and deck id into a value a select can carry without ambiguity. */
export function deckValue(packName: string, deckId: string): string {
  return `${packName}::${deckId}`;
}

/** Read that value back; a value without both parts is not a placement. */
export function readDeckValue(value: string): { packName: string; deckId: string } | null {
  const at = value.indexOf("::");
  if (at < 1) return null;
  const packName = value.slice(0, at);
  const deckId = value.slice(at + 2);
  return packName && deckId ? { packName, deckId } : null;
}

/**
 * A pack's decks as a plain list. Older packs only carry topic ids, so those
 * stand in as decks; a pack that failed to load is left out of every picker.
 */
export function packDecks(pack: PackStatus): Array<{ id: string; name: string }> {
  if (pack.decks && pack.decks.length > 0) return pack.decks;
  return pack.topics.map((topic) => ({ id: topic, name: pack.topicLabels[topic] ?? topic }));
}

/** Every real deck in every readable pack, tagged with its pack. */
export function deckChoices(packs: PackStatus[]): DeckChoice[] {
  const choices: DeckChoice[] = [];
  for (const pack of packs) {
    if (pack.error) continue;
    for (const deck of packDecks(pack)) {
      choices.push({ value: deckValue(pack.name, deck.id), id: deck.id, name: deck.name, pack: pack.name });
    }
  }
  return choices;
}

/** The label for a stored deck id, or the id itself when the label is gone. */
export function deckLabel(packs: PackStatus[], packName: string | undefined, deckId: string | undefined): string {
  if (!packName || !deckId) return "unknown";
  const pack = packs.find((entry) => entry.name === packName);
  return pack ? (packDecks(pack).find((deck) => deck.id === deckId)?.name ?? deckId) : deckId;
}

/** Ignore case and Polish marks so "samochod" still finds "samochód". */
export function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Search the words a learner can see: both sides, notes, topics and tags. */
export function cardMatches(card: Card, query: string): boolean {
  const sides = [...card.prompt, ...card.answer].map((part) => ("text" in part ? part.text : ""));
  const haystack = [
    card.summary,
    card.packName ?? "",
    card.deckId ?? "",
    ...card.topics,
    ...card.tags,
    ...sides,
    ...(card.hints ?? []),
  ].join(" ");
  return searchable(haystack).includes(query);
}

/** Search pack metadata and its deck names, so the list narrows in plain words. */
export function packMatches(pack: PackStatus, query: string): boolean {
  const haystack = [pack.name, pack.version, pack.description ?? "", ...packDecks(pack).flatMap((deck) => [deck.id, deck.name])].join(
    " ",
  );
  return searchable(haystack).includes(query);
}

/** A Cards view keeps every card until a create result names one deck. */
export function cardsInFocus(cards: Card[], focus: CardFocus | null): Card[] {
  if (!focus) return cards;
  return cards.filter((card) => card.packName === focus.packName && card.deckId === focus.deckId);
}

/** A pack or deck create opens Packs; a card create opens the filtered Cards. */
export function createDestination(
  result: CreateResult,
): { tab: LibraryTab; packName: string; deckId?: string } {
  if (result.kind === "cards") {
    return { tab: "cards", packName: result.packName, deckId: result.deckId };
  }
  return { tab: "packs", packName: result.packName };
}

/** The exact visible name the learner must type before a delete can happen. */
export function deleteName(target: DeleteTarget): string {
  return target.kind === "pack" ? target.packName : target.deckName;
}

/** Turn an API validation detail list into one line per problem. */
export function errorLines(error: unknown): string[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.detail)) return [];
  return error.detail
    .map((item) => {
      if (item && typeof item === "object") {
        const record = item as { field?: unknown; message?: unknown };
        const message = typeof record.message === "string" ? record.message : null;
        const field = typeof record.field === "string" ? record.field : null;
        if (message) return field ? `${field}: ${message}` : message;
      }
      return null;
    })
    .filter((line): line is string => line !== null);
}

/** Plain text of a card side, with blanks shown as underlines for an edit box. */
export function plainText(parts: Card["prompt"]): string {
  return parts
    .map((part) => {
      if (part.type === "text" || part.type === "code" || part.type === "speak") return part.text;
      if (part.type === "blank") return "___";
      return part.alt ?? "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
