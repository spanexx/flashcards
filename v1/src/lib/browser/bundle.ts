// WHY: One bundle is create, import and export. This module is the only place
// that decides whether a bundle is valid and what an import is allowed to touch,
// so the three paths cannot drift and a bad file changes nothing.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

import semver from "semver";
import { z } from "zod";
import type {
  Card,
  CardOrigin,
  CardSource,
  Deck,
  DictionaryPage,
  MediaRecord,
  PageContent,
  Tombstone,
} from "@/lib/shared/types";
import { buildCard, deckCardId, hardRuleIssues } from "@/lib/core/card";
import { parseJsonLoose, type RepairKind } from "@/lib/core/json-repair";
import { referencedMediaIds } from "@/lib/core/media";
import { pageIdFor, pageRuleProblems } from "@/lib/core/pages";
import {
  cardSourceSchema,
  packPromptsSchema,
  studyLevelSchema,
  teachingPartSchema,
  type ValidationIssue,
} from "@/lib/core/schema";
import { normalizeSettings } from "@/lib/core/settings-shape";
import { markChanged, resumeChanges, suspendChanges } from "@/lib/browser/changes";
import { uniqueDeckIdentity, uniquePackName } from "@/lib/browser/creation";
import {
  clearLibrary,
  readCards,
  readEvidence,
  readPack,
  readPacks,
  readPromptLog,
  readProviderKey,
  readSessions,
  readSettings,
  readSystemLicense,
  patchSettings,
  upsertCards,
  writePack,
  writeProviderKey,
  writeSystemLicense,
  appendEvidence,
  appendPrompt,
  appendSession,
  clearProviderKey,
  readTombstones,
  writeTombstones,
  type BrowserPack,
} from "@/lib/browser/repository";
import { readAllMedia } from "@/lib/browser/media";
import { readPages, readTraces, writePage, writeShippedPage, writeTrace } from "@/lib/browser/pages";

/** The one bundle schema. The skill and the app both speak this. */
export const PACK_BUNDLE_SCHEMA = "flashcards.pack/v1";
export const BACKUP_SCHEMA = "flashcards.backup/v1";

/** A deck id is stable, lowercase and safe in a file. */
const deckIdSchema = z
  .string()
  .min(1, "a deck needs an id")
  .regex(/^[a-z0-9][a-z0-9-]*$/, "a deck id uses lowercase letters, numbers and dashes");

/** One deck as it appears inside a bundle; an old file means intermediate. */
export const deckSchema = z.object({
  id: deckIdSchema,
  name: z.string().min(1, "a deck needs a name"),
  level: studyLevelSchema.default("intermediate"),
});

/** A bundle card is a card source plus the deck it belongs to. */
export const bundleCardSchema = cardSourceSchema.omit({ topics: true }).extend({
  deckId: z.string().optional(),
});

/** The pack header inside a bundle. */
export const bundlePackSchema = z.object({
  name: z
    .string()
    .min(1, "a pack needs a name")
    .regex(/^[a-z0-9][a-z0-9-]*$/, "a pack name uses lowercase letters, numbers and dashes"),
  version: z.string().min(1, "a pack needs an author-written version"),
  description: z.string().optional(),
  language: z.string().optional(),
  sourceLanguage: z.string().optional(),
  studyInstruction: z.string().optional(),
  prompts: packPromptsSchema.optional(),
  /** The pack asks every card page to be read before an answer counts. */
  requirePageRead: z.boolean().optional(),
});

/**
 * One Dictionary page inside a bundle. The pack header names the pack, so a
 * page only names its deck or card; reading traces never travel in a pack.
 */
export const bundlePageSchema = z
  .object({
    level: z.enum(["pack", "deck", "card"]),
    deckId: z.string().min(1).optional(),
    cardId: z.string().min(1).optional(),
    title: z.string().optional(),
    lead: z.string().optional(),
    cover: teachingPartSchema.optional(),
    parts: z.array(teachingPartSchema).default([]),
  })
  .superRefine((page, ctx) => {
    for (const problem of pageRuleProblems(page)) {
      ctx.addIssue({ code: "custom", path: [problem.path], message: problem.message });
    }
  });

/** A whole pack bundle. It creates a pack, or updates one when its version is newer. */
export const packBundleSchema = z.object({
  schema: z.literal(PACK_BUNDLE_SCHEMA),
  pack: bundlePackSchema,
  decks: z.array(deckSchema),
  cards: z.array(bundleCardSchema),
  pages: z.array(bundlePageSchema).default([]),
});

/** A deck fragment adds one or more decks to an existing pack. */
export const deckBundleSchema = z
  .object({
    schema: z.literal(PACK_BUNDLE_SCHEMA).optional(),
    decks: z.array(deckSchema).min(1, "a deck fragment needs at least one deck"),
    cards: z.array(bundleCardSchema).default([]),
  })
  .strict();

/** A cards fragment adds cards to one existing deck. */
export const cardsBundleSchema = z
  .object({
    schema: z.literal(PACK_BUNDLE_SCHEMA).optional(),
    cards: z.array(bundleCardSchema).min(1, "a cards fragment needs at least one card"),
  })
  .strict();

export type PackBundle = z.infer<typeof packBundleSchema>;
export type DeckBundle = z.infer<typeof deckBundleSchema>;
export type CardsBundle = z.infer<typeof cardsBundleSchema>;
export type BundleCard = z.infer<typeof bundleCardSchema>;
export type BundlePage = z.infer<typeof bundlePageSchema>;

/** Where an import is allowed to put its content. */
export type ImportTarget =
  | { kind: "pack" }
  | { kind: "deck"; packName: string }
  | { kind: "cards"; packName: string; deckId: string };

/** Generated names may take the next free suffix; learner-written names do not. */
export interface ImportOptions {
  namePolicy?: "strict" | "auto-suffix";
  /** Provider batches keep their generated origin while sharing this validator. */
  origin?: "generated";
  /** Card ids the learner deliberately removed; only a seed import passes this. */
  suppressCardIds?: ReadonlySet<string>;
  requestId?: string;
}

/** What an import did, in counts the screen can say out loud. */
export interface ImportSuccess {
  ok: true;
  kind: ImportTarget["kind"];
  packName: string;
  decksAdded: number;
  cardsAdded: number;
  duplicates: number;
  deckIds: string[];
  /** Matching cards whose teaching layer or version note changed in place. */
  cardsUpdated?: number;
  /** Pack cards a whole-pack update took out of study, with evidence kept. */
  cardsRetired?: number;
  /** Syntax repairs this hand-typed file needed; absent when it was already valid. */
  repairs?: RepairKind[];
}

/** An import either happened or named every problem. */
export type ImportResult = ImportSuccess | { ok: false; issues: ValidationIssue[] };

/** One problem in plain words, at the bundle item that caused it. */
function issue(field: string, message: string, index = 0): ValidationIssue {
  return { index, field, message };
}

/** Name the bundle item a schema failure came from, not just the field path. */
function schemaIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((problem) => {
    const parts = problem.path.map((part) => String(part));
    if ((parts[0] === "cards" || parts[0] === "decks" || parts[0] === "pages") && /^\d+$/.test(parts[1] ?? "")) {
      return {
        index: Number(parts[1]),
        field: parts.slice(2).join(".") || parts[0],
        message: problem.message,
      };
    }
    return { index: 0, field: parts.join(".") || "(bundle)", message: problem.message };
  });
}

/**
 * Read JSON once, so every target refuses malformed text the same way. A
 * hand-typed file is retried through the syntax repair first; the repairs it
 * needed travel with the result so the learner can be told.
 */
function readJson(
  text: string,
): { ok: true; raw: unknown; repairs: RepairKind[] } | { ok: false; issues: ValidationIssue[] } {
  try {
    const read = parseJsonLoose(text);
    return { ok: true, raw: read.value, repairs: read.repairs };
  } catch (error) {
    return {
      ok: false,
      issues: [
        issue(
          "(bundle)",
          error instanceof Error ? error.message : "the text is not valid JSON: unknown parse error",
        ),
      ],
    };
  }
}

/** Read the pasted or loaded text into a whole pack bundle. */
export function parseBundle(
  text: string,
): { ok: true; bundle: PackBundle; repairs: RepairKind[] } | { ok: false; issues: ValidationIssue[] } {
  const read = readJson(text);
  if (!read.ok) return read;
  const parsed = packBundleSchema.safeParse(read.raw);
  if (!parsed.success) return { ok: false, issues: schemaIssues(parsed.error) };
  return { ok: true, bundle: parsed.data, repairs: read.repairs };
}

/** Read a deck fragment: new decks for a pack that is already here. */
export function parseDeckBundle(
  text: string,
): { ok: true; bundle: DeckBundle; repairs: RepairKind[] } | { ok: false; issues: ValidationIssue[] } {
  const read = readJson(text);
  if (!read.ok) return read;
  if (read.raw && typeof read.raw === "object" && "pack" in read.raw) {
    return { ok: false, issues: [issue("(bundle)", "this is a whole pack; choose Pack as the target", 0)] };
  }
  const parsed = deckBundleSchema.safeParse(read.raw);
  if (!parsed.success) return { ok: false, issues: schemaIssues(parsed.error) };
  return { ok: true, bundle: parsed.data, repairs: read.repairs };
}

/** Read a cards fragment: cards for one deck that is already here. */
export function parseCardsBundle(
  text: string,
): { ok: true; bundle: CardsBundle; repairs: RepairKind[] } | { ok: false; issues: ValidationIssue[] } {
  const read = readJson(text);
  if (!read.ok) return read;
  if (read.raw && typeof read.raw === "object" && ("pack" in read.raw || "decks" in read.raw)) {
    return { ok: false, issues: [issue("(bundle)", "this is not a cards-only file; choose Pack or Deck", 0)] };
  }
  const parsed = cardsBundleSchema.safeParse(read.raw);
  if (!parsed.success) return { ok: false, issues: schemaIssues(parsed.error) };
  return { ok: true, bundle: parsed.data, repairs: read.repairs };
}

/** Compare two author-written versions. Null means they cannot be compared. */
export function compareVersions(left: string, right: string): number | null {
  if (left === right) return 0;
  const a = semver.coerce(left);
  const b = semver.coerce(right);
  if (!a || !b) return null;
  return semver.compare(a, b);
}

/** The deck a card names, or a problem. */
function deckFor(
  card: BundleCard,
  index: number,
  decks: Map<string, Deck>,
  fallback: string | null,
): { deck: Deck } | { issues: ValidationIssue[] } {
  const wanted = card.deckId ?? fallback;
  if (!wanted) {
    return { issues: [issue("cards.deckId", "a card must name the deck it belongs to", index)] };
  }
  const deck = decks.get(wanted);
  if (!deck) return { issues: [issue("cards.deckId", `there is no deck "${wanted}" in this pack`, index)] };
  if (fallback && card.deckId && card.deckId !== fallback) {
    return {
      issues: [issue("cards.deckId", `this file adds cards to "${fallback}", not "${card.deckId}"`, index)],
    };
  }
  return { deck };
}

/** Turn one bundle card into the learner's car, or problems with it. */
function cardFromBundle(
  bundleCard: BundleCard,
  index: number,
  deck: Deck,
  pack: { name: string; version: string },
  kind: "pack" | "imported" | "generated",
  now: string,
  requestId?: string,
): { card: Card } | { issues: ValidationIssue[] } {
  const withoutDeck = { ...bundleCard };
  delete withoutDeck.deckId;
  const source: CardSource = { ...withoutDeck, topics: [deck.name] };
  const problems = hardRuleIssues(source, index);
  if (problems.length > 0) return { issues: problems };

  const origin: CardOrigin =
    kind === "generated"
      ? {
          kind: "generated",
          note: `Generated from a request on ${now.slice(0, 10)}.`,
          packName: pack.name,
          requestId,
        }
      : kind === "imported"
        ? { kind: "imported", note: "Imported by the learner.", packName: pack.name }
        : {
            kind: "pack",
            note: `From the pack ${pack.name}, version ${pack.version}.`,
            packName: pack.name,
            packVersion: pack.version,
          };

  const card = buildCard(source, origin, deckCardId(pack.name, deck.id, source), now);
  card.packName = pack.name;
  card.deckId = deck.id;
  return { card };
}

/** Turn one bundle page into the stored row, or name what it points at wrongly. */
function pageFromBundle(
  bundlePage: BundlePage,
  index: number,
  packName: string,
  decks: Map<string, Deck>,
  cards: Map<string, Card>,
  now: string,
): { page: DictionaryPage } | { issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  let deckId = bundlePage.level === "deck" ? bundlePage.deckId : undefined;
  if (bundlePage.level === "deck" && deckId && !decks.has(deckId)) {
    issues.push(issue("pages.deckId", `there is no deck "${deckId}" in this pack`, index));
  }
  let cardId: string | undefined;
  if (bundlePage.level === "card" && bundlePage.cardId) {
    const card = cards.get(bundlePage.cardId);
    if (!card) {
      issues.push(issue("pages.cardId", `there is no card "${bundlePage.cardId}" in this pack`, index));
    } else {
      cardId = card.id;
      deckId = card.deckId;
    }
  }
  if (issues.length > 0) return { issues };
  return {
    page: {
      id: pageIdFor(bundlePage.level, packName, deckId, cardId),
      level: bundlePage.level,
      packName,
      ...(deckId ? { deckId } : {}),
      ...(cardId ? { cardId } : {}),
      ...(bundlePage.title !== undefined ? { title: bundlePage.title } : {}),
      ...(bundlePage.lead !== undefined ? { lead: bundlePage.lead } : {}),
      ...(bundlePage.cover && bundlePage.cover.type === "image" ? { cover: bundlePage.cover } : {}),
      parts: bundlePage.parts,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/** Keep only cards the learner does not already have. */
async function keepFreshCards(cards: Card[]): Promise<{ fresh: Card[]; duplicates: number }> {
  const existingCards = await readCards();
  const known = new Set(existingCards.map((card) => card.id));
  const fresh: Card[] = [];
  let duplicates = 0;
  for (const card of cards) {
    // A repeat inside the same file is a duplicate too, not a second card.
    if (known.has(card.id)) {
      duplicates += 1;
      continue;
    }
    known.add(card.id);
    fresh.push(card);
  }
  return { fresh, duplicates };
}

/** Replace or remove a layer without leaving an empty `teaching: []` behind. */
function withTeaching(card: Card, teaching: CardSource["teaching"]): Card {
  const next = { ...card };
  if (teaching && teaching.length > 0) next.teaching = teaching;
  else delete next.teaching;
  return next;
}

interface PackReconciliation {
  added: Card[];
  updated: Card[];
  retired: Card[];
  duplicates: number;
}

/**
 * Apply a whole-pack bundle to the learner's library. Matching content keeps
 * its id and evidence and only the help changes; pack cards the new version no
 * longer names leave study but keep their evidence. Learner and imported cards
 * are never retired by a pack update.
 */
async function reconcilePackCards(
  incoming: Card[],
  packName: string,
  version: string,
  deckIds: Set<string>,
): Promise<PackReconciliation> {
  const existing = await readCards();
  const known = new Map(existing.map((card) => [card.id, card]));
  const seen = new Set<string>();
  const added: Card[] = [];
  const updated: Card[] = [];
  let duplicates = 0;

  for (const card of incoming) {
    if (seen.has(card.id)) {
      duplicates += 1;
      continue;
    }
    seen.add(card.id);
    const old = known.get(card.id);
    if (!old) {
      added.push(card);
      continue;
    }
    duplicates += 1;
    const merged = withTeaching(old, card.teaching);
    delete merged.retired;
    merged.origin =
      old.origin.kind === "pack"
        ? {
            ...old.origin,
            packVersion: version,
            note: `From the pack ${packName}, version ${version}.`,
          }
        : old.origin;
    updated.push(merged);
  }

  const retired: Card[] = [];
  for (const old of existing) {
    if (old.packName !== packName || old.retired) continue;
    if (old.origin.kind !== "pack" || !old.deckId) continue;
    if (!deckIds.has(old.deckId) || seen.has(old.id)) continue;
    retired.push({ ...old, retired: true });
  }

  return { added, updated, retired, duplicates };
}

/** Create or update a whole pack. */
async function importPack(text: string, options: ImportOptions): Promise<ImportResult> {
  const namePolicy = options.namePolicy ?? "strict";
  const read = parseBundle(text);
  if (!read.ok) return read;
  const bundles = await readPacks();
  const chosen =
    namePolicy === "auto-suffix"
      ? uniquePackName(read.bundle.pack.name, bundles.map((pack) => pack.name))
      : read.bundle.pack.name;
  const bundle: PackBundle =
    chosen === read.bundle.pack.name
      ? read.bundle
      : { ...read.bundle, pack: { ...read.bundle.pack, name: chosen } };
  const installed = await readPack(bundle.pack.name);

  if (installed) {
    const order = compareVersions(bundle.pack.version, installed.version);
    if (order === null) {
      return {
        ok: false,
        issues: [
          issue(
            "pack.version",
            `one of the versions cannot be compared (stored ${installed.version}, file ${bundle.pack.version})`,
            0,
          ),
        ],
      };
    }
    if (order < 0) {
      return {
        ok: false,
        issues: [
          issue(
            "pack.version",
            `the installed pack is version ${installed.version}; this file is older (${bundle.pack.version})`,
            0,
          ),
        ],
      };
    }
  }

  const issues: ValidationIssue[] = [];
  if (bundle.decks.length === 0 && !installed) {
    issues.push(issue("decks", "a new pack needs at least one deck", 0));
  }

  const decks = new Map<string, Deck>();
  if (installed) for (const deck of installed.decks) decks.set(deck.id, deck);
  const decksBefore = new Set(decks.keys());
  for (const deck of bundle.decks) {
    const old = decks.get(deck.id);
    // WHY: A deck id is the identity; a display name is the learner's label.
    // An import may add a deck but never renames one behind their back. The
    // bundle's level is authoritative because it describes the new help.
    decks.set(
      deck.id,
      old
        ? { id: old.id, name: old.name, level: deck.level }
        : { id: deck.id, name: deck.name, level: deck.level },
    );
  }

  const now = new Date().toISOString();
  const cards: Card[] = [];
  for (const [index, bundleCard] of bundle.cards.entries()) {
    const found = deckFor(bundleCard, index, decks, null);
    if ("issues" in found) {
      issues.push(...found.issues);
      continue;
    }
    const built = cardFromBundle(
      bundleCard,
      index,
      found.deck,
      bundle.pack,
      options.origin === "generated" ? "generated" : "pack",
      now,
      options.requestId,
    );
    if ("issues" in built) issues.push(...built.issues);
    else cards.push(built.card);
  }

  // WHY: A page names a deck or a card that this import is about to write, so
  // the page is checked against the same two sets the cards were checked
  // against. A page pointing nowhere refuses the whole file, like a bad card.
  const knownCards = new Map<string, Card>();
  for (const card of await readCards()) {
    if (card.packName === bundle.pack.name) knownCards.set(card.id, card);
  }
  for (const card of cards) knownCards.set(card.id, card);
  const pages: DictionaryPage[] = [];
  for (const [index, bundlePage] of bundle.pages.entries()) {
    const built = pageFromBundle(bundlePage, index, bundle.pack.name, decks, knownCards, now);
    if ("issues" in built) issues.push(...built.issues);
    else pages.push(built.page);
  }

  if (issues.length > 0) return { ok: false, issues };

  // WHY: A seed must not bring back a card the learner deliberately deleted.
  // The id is content-based, so changed words arrive as a new card.
  const suppression = options.suppressCardIds;
  const incoming = suppression ? cards.filter((card) => !suppression.has(card.id)) : cards;
  const reconciled = await reconcilePackCards(
    incoming,
    bundle.pack.name,
    bundle.pack.version,
    new Set(bundle.decks.map((deck) => deck.id)),
  );
  const pack: BrowserPack = {
    id: bundle.pack.name,
    name: bundle.pack.name,
    version: bundle.pack.version,
    description: bundle.pack.description ?? installed?.description,
    language: bundle.pack.language ?? installed?.language,
    sourceLanguage: bundle.pack.sourceLanguage ?? installed?.sourceLanguage,
    studyInstruction: bundle.pack.studyInstruction ?? installed?.studyInstruction,
    decks: [...decks.values()],
    prompts: bundle.pack.prompts ?? installed?.prompts ?? null,
    requirePageRead: bundle.pack.requirePageRead ?? installed?.requirePageRead,
    createdAt: installed?.createdAt ?? now,
    updatedAt: now,
  };
  await writePack(pack);
  const writes = [...reconciled.added, ...reconciled.updated, ...reconciled.retired];
  if (writes.length > 0) await upsertCards(writes);
  for (const page of pages) await writeShippedPage(page);

  return {
    ok: true,
    kind: "pack",
    packName: pack.name,
    decksAdded: [...decks.keys()].filter((id) => !decksBefore.has(id)).length,
    cardsAdded: reconciled.added.length,
    duplicates: reconciled.duplicates,
    cardsUpdated: reconciled.updated.length,
    cardsRetired: reconciled.retired.length,
    deckIds: [...decks.keys()].filter((id) => !decksBefore.has(id)),
    ...(read.repairs.length > 0 ? { repairs: read.repairs } : {}),
  };
}

/** Add one or more decks to a pack that already exists. */
async function importDeck(text: string, packName: string, options: ImportOptions): Promise<ImportResult> {
  const namePolicy = options.namePolicy ?? "strict";
  const read = parseDeckBundle(text);
  if (!read.ok) return read;
  const bundle = read.bundle;
  const pack = await readPack(packName);
  if (!pack) {
    return { ok: false, issues: [issue("packName", `there is no pack "${packName}" here`, 0)] };
  }

  const issues: ValidationIssue[] = [];
  const decks = [...pack.decks];
  const added: Deck[] = [];
  const renamed = new Map<string, string>();
  for (const [index, deck] of bundle.decks.entries()) {
    if (renamed.has(deck.id)) {
      issues.push(issue(`decks.${index}.id`, `"${deck.id}" appears twice in this file`, index));
      continue;
    }
    const identity =
      namePolicy === "auto-suffix"
        ? uniqueDeckIdentity(deck.id, deck.name, decks)
        : { id: deck.id, name: deck.name };
    if (decks.some((existing) => existing.id === identity.id)) {
      issues.push(issue(`decks.${index}.id`, `a deck with the id "${identity.id}" is already here`, index));
      continue;
    }
    const placed: Deck = { id: identity.id, name: identity.name, level: deck.level };
    decks.push(placed);
    added.push(placed);
    renamed.set(deck.id, identity.id);
  }

  const now = new Date().toISOString();
  const cards: Card[] = [];
  for (const [index, bundleCard] of bundle.cards.entries()) {
    const named = bundleCard.deckId ?? (bundle.decks.length === 1 ? bundle.decks[0].id : null);
    if (!named) {
      issues.push(issue("cards.deckId", "a card must name one of this file's decks", index));
      continue;
    }
    const targetId = renamed.get(named);
    if (!targetId) {
      issues.push(issue("cards.deckId", `"${named}" is not a deck in this file`, index));
      continue;
    }
    const deck = added.find((entry) => entry.id === targetId);
    if (!deck) {
      issues.push(issue("cards.deckId", `"${named}" is not a deck in this file`, index));
      continue;
    }
    const built = cardFromBundle(
      bundleCard,
      index,
      deck,
      { name: pack.name, version: pack.version },
      options.origin === "generated" ? "generated" : "imported",
      now,
      options.requestId,
    );
    if ("issues" in built) issues.push(...built.issues);
    else cards.push(built.card);
  }

  if (issues.length > 0) return { ok: false, issues };

  const { fresh, duplicates } = await keepFreshCards(cards);
  await writePack({ ...pack, decks, updatedAt: now });
  if (fresh.length > 0) await upsertCards(fresh);

  return {
    ok: true,
    kind: "deck",
    packName: pack.name,
    decksAdded: added.length,
    cardsAdded: fresh.length,
    duplicates,
    deckIds: added.map((deck) => deck.id),
    ...(read.repairs.length > 0 ? { repairs: read.repairs } : {}),
  };
}

/** Add cards to one deck that already exists. */
async function importCards(
  text: string,
  packName: string,
  deckId: string,
  options: ImportOptions,
): Promise<ImportResult> {
  const read = parseCardsBundle(text);
  if (!read.ok) return read;
  const pack = await readPack(packName);
  if (!pack) {
    return { ok: false, issues: [issue("packName", `there is no pack "${packName}" here`, 0)] };
  }
  const deck = pack.decks.find((entry) => entry.id === deckId);
  if (!deck) {
    return { ok: false, issues: [issue("deckId", `there is no deck "${deckId}" in this pack`, 0)] };
  }

  const issues: ValidationIssue[] = [];
  const now = new Date().toISOString();
  const cards: Card[] = [];
  const only = new Map([[deck.id, deck]]);
  for (const [index, bundleCard] of read.bundle.cards.entries()) {
    const found = deckFor(bundleCard, index, only, deck.id);
    if ("issues" in found) {
      issues.push(...found.issues);
      continue;
    }
    const built = cardFromBundle(
      bundleCard,
      index,
      found.deck,
      { name: pack.name, version: pack.version },
      options.origin === "generated" ? "generated" : "imported",
      now,
      options.requestId,
    );
    if ("issues" in built) issues.push(...built.issues);
    else cards.push(built.card);
  }
  if (issues.length > 0) return { ok: false, issues };

  const { fresh, duplicates } = await keepFreshCards(cards);
  if (fresh.length > 0) await upsertCards(fresh);

  return {
    ok: true,
    kind: "cards",
    packName: pack.name,
    decksAdded: 0,
    cardsAdded: fresh.length,
    duplicates,
    deckIds: [deck.id],
    ...(read.repairs.length > 0 ? { repairs: read.repairs } : {}),
  };
}

/**
 * Import a bundle into one of the three targets. Validation runs over the whole
 * file first; a refusal writes nothing.
 */
export async function importBundle(
  text: string,
  target: ImportTarget,
  options: ImportOptions = {},
): Promise<ImportResult> {
  if (target.kind === "pack") return importPack(text, options);
  if (target.kind === "deck") return importDeck(text, target.packName, options);
  return importCards(text, target.packName, target.deckId, options);
}

/** A card as it appears inside an exported bundle. */
function cardToBundleCard(card: Card): BundleCard {
  return {
    ...(card.deckId ? { deckId: card.deckId } : {}),
    summary: card.summary,
    tags: card.tags,
    prompt: card.prompt,
    answer: card.answer,
    answerDef: card.answerDef,
    hints: card.hints,
    fullLine: card.fullLine,
    ...(card.teaching ? { teaching: card.teaching } : {}),
  };
}

/**
 * A page as it may leave this device in a shared pack. A learner's overlay of a
 * shipped page is private, so the pack carries the shipped copy kept beside it;
 * a page the learner wrote stays as it is.
 */
export function shareablePage(page: DictionaryPage): DictionaryPage {
  if (!page.editedFromShipped || !page.shippedCopy) return page;
  const copy = page.shippedCopy;
  return {
    id: page.id,
    level: page.level,
    packName: page.packName,
    ...(page.deckId !== undefined ? { deckId: page.deckId } : {}),
    ...(page.cardId !== undefined ? { cardId: page.cardId } : {}),
    ...(copy.title !== undefined ? { title: copy.title } : {}),
    ...(copy.lead !== undefined ? { lead: copy.lead } : {}),
    ...(copy.cover ? { cover: copy.cover } : {}),
    parts: copy.parts,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

/** A page as it appears inside an exported bundle: content, never traces. */
function pageToBundlePage(page: DictionaryPage): BundlePage {
  return {
    level: page.level,
    ...(page.deckId ? { deckId: page.deckId } : {}),
    ...(page.cardId ? { cardId: page.cardId } : {}),
    ...(page.title !== undefined ? { title: page.title } : {}),
    ...(page.lead !== undefined ? { lead: page.lead } : {}),
    ...(page.cover ? { cover: page.cover } : {}),
    parts: page.parts,
  };
}

/** Export one pack as a shareable bundle: content only, never evidence or traces. */
export async function exportPackBundle(name: string): Promise<{ ok: true; json: string } | { ok: false; message: string }> {
  const pack = await readPack(name);
  if (!pack) return { ok: false, message: `There is no pack "${name}" here.` };
  const cards = (await readCards()).filter((card) => card.packName === name && !card.retired);
  const pages = await readPages(name);
  const bundle: PackBundle = {
    schema: PACK_BUNDLE_SCHEMA,
    pack: {
      name: pack.name,
      version: pack.version,
      description: pack.description,
      language: pack.language,
      sourceLanguage: pack.sourceLanguage,
      studyInstruction: pack.studyInstruction,
      prompts: pack.prompts ?? undefined,
      ...(pack.requirePageRead !== undefined ? { requirePageRead: pack.requirePageRead } : {}),
    },
    decks: pack.decks,
    cards: cards.map(cardToBundleCard),
    pages: pages.map(shareablePage).map(pageToBundlePage),
  };
  return { ok: true, json: JSON.stringify(bundle, null, 2) };
}

/** The full backup shape. The provider key is deliberately absent. */
export const backupSchema = z.object({
  schema: z.literal(BACKUP_SCHEMA),
  exportedAt: z.string(),
  packs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      description: z.string().optional(),
      language: z.string().optional(),
      sourceLanguage: z.string().optional(),
      studyInstruction: z.string().optional(),
      decks: z.array(deckSchema),
      prompts: packPromptsSchema.nullable(),
      requirePageRead: z.boolean().optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  cards: z.array(
    cardSourceSchema.extend({
      id: z.string(),
      packName: z.string().optional(),
      deckId: z.string().optional(),
      origin: z.object({
        kind: z.enum(["pack", "learner", "generated", "imported"]),
        note: z.string(),
        packName: z.string().optional(),
        packVersion: z.string().optional(),
        requestId: z.string().optional(),
      }),
      createdAt: z.string(),
      retired: z.boolean().optional(),
      editedFrom: z.string().optional(),
    }),
  ),
  evidence: z.array(
    z.object({
      id: z.string(),
      cardId: z.string(),
      attemptId: z.string(),
      region: z.string().nullable(),
      outcome: z.enum(["again", "got_it", "nearly", "no", "unjudged"]),
      timeMs: z.number(),
      seenBefore: z.number(),
      at: z.string(),
      kind: z.enum(["answer", "correction"]),
      supersedes: z.string().optional(),
      helpSeen: z.boolean().optional(),
      coldCheck: z.boolean().optional(),
    }),
  ),
  sessions: z.array(
    z.object({
      type: z.enum(["started", "ended"]),
      id: z.string(),
      at: z.string(),
      offered: z.number(),
      answered: z.number().optional(),
      completed: z.boolean().optional(),
      stopped: z.boolean().optional(),
      pack: z.string().optional(),
      deck: z.string().optional(),
    }),
  ),
  // WHY: Dictionary pages are library content, so a full backup carries them.
  // Reading traces are device-local proof, so a backup carries those too and a
  // shared pack never does (GRILL entry 29). Both default empty so an older
  // backup still restores.
  pages: z
    .array(
      z.object({
        id: z.string(),
        level: z.enum(["pack", "deck", "card"]),
        packName: z.string(),
        deckId: z.string().optional(),
        cardId: z.string().optional(),
        title: z.string().optional(),
        lead: z.string().optional(),
        cover: teachingPartSchema.optional(),
        parts: z.array(teachingPartSchema),
        createdAt: z.string(),
        updatedAt: z.string(),
        learnerEdited: z.boolean().optional(),
        editedFromShipped: z.boolean().optional(),
        shippedCopy: z
          .object({
            title: z.string().optional(),
            lead: z.string().optional(),
            cover: teachingPartSchema.optional(),
            parts: z.array(teachingPartSchema),
          })
          .optional(),
      }),
    )
    .default([]),
  pageTraces: z
    .array(
      z.object({
        id: z.string(),
        traced: z.array(z.number().int().min(0)),
        readAt: z.string().optional(),
        updatedAt: z.string(),
      }),
    )
    .default([]),
  settings: z.unknown(),
  prompts: z.array(
    z.object({
      at: z.string(),
      kind: z.enum(["generation", "hint"]),
      requestId: z.string(),
      endpoint: z.string().nullable(),
      model: z.string().nullable(),
      prompt: z.string(),
    }),
  ),
  tombstones: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["pack", "card"]),
        at: z.string(),
      }),
    )
    .optional(),
});

export type Backup = z.infer<typeof backupSchema>;

/** What a backup export needs: the text and the Blobs kept beside it. */
export interface BackupContent {
  json: string;
  media: MediaRecord[];
}

/** Export everything the learner owns, but never the key. */
export async function buildBackup(): Promise<BackupContent> {
  const [packs, cards, evidence, sessions, settings, prompts, tombstones, allMedia, pages, pageTraces] =
    await Promise.all([
      readPacks(),
      readCards(),
      readEvidence(),
      readSessions(),
      readSettings(),
      readPromptLog(500),
      readTombstones(),
      readAllMedia(),
      readPages(),
      readTraces(),
    ]);
  const wanted = referencedMediaIds(cards, pages);
  const media = allMedia.filter((record) => wanted.has(record.id));
  const json = JSON.stringify(
    {
      schema: BACKUP_SCHEMA,
      exportedAt: new Date().toISOString(),
      packs,
      cards,
      evidence,
      sessions,
      pages,
      pageTraces,
      settings,
      prompts,
      tombstones,
    },
    null,
    2,
  );
  return { json, media };
}

/** The text half of a backup, for the paste path. */
export async function exportBackup(): Promise<string> {
  return (await buildBackup()).json;
}

/** Read a backup without changing anything. */
export function parseBackup(
  text: string,
): { ok: true; backup: Backup } | { ok: false; issues: ValidationIssue[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      ok: false,
      issues: [
        issue(
          "(backup)",
          `the text is not valid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`,
        ),
      ],
    };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: schemaIssues(parsed.error) };
  return { ok: true, backup: parsed.data };
}

/** Apply a backup that has already passed validation. */
export async function applyBackup(
  backup: Backup,
  options: { beforeApply?: () => Promise<void> } = {},
): Promise<{ ok: true; packs: number; cards: number }> {
  const key = await readProviderKey();
  // WHY: A backup never carries a stored secret, and restoring replaces the
  // settings store. Both the provider key and the subscription pass survive
  // the restore that way, matching the promise the screen makes.
  const license = await readSystemLicense();
  // The caller may stop background work after validation, but before the
  // library changes. A malformed backup must not kill a healthy job.
  await options.beforeApply?.();
  let restored = false;
  suspendChanges();
  try {
    await clearLibrary();

    for (const pack of backup.packs) await writePack(pack as BrowserPack);
    for (const card of backup.cards) {
      const { id, ...source } = card;
      const built = buildCard(source as CardSource, card.origin, id, card.createdAt);
      built.packName = card.packName;
      built.deckId = card.deckId;
      built.retired = card.retired;
      built.editedFrom = card.editedFrom;
      await upsertCards([built]);
    }
    for (const page of backup.pages) {
      const { cover, shippedCopy, ...rest } = page;
      let copy: PageContent | undefined;
      if (shippedCopy) {
        const { cover: copyCover, ...copyRest } = shippedCopy;
        copy = {
          ...copyRest,
          ...(copyCover && copyCover.type === "image" ? { cover: copyCover } : {}),
        };
      }
      await writePage({
        ...rest,
        ...(cover && cover.type === "image" ? { cover } : {}),
        ...(copy ? { shippedCopy: copy } : {}),
      });
    }
    for (const trace of backup.pageTraces) await writeTrace(trace);
    if (backup.evidence.length > 0) await appendEvidence(backup.evidence);
    for (const event of backup.sessions) await appendSession(event);
    for (const entry of backup.prompts) await appendPrompt(entry);
    await writeTombstones((backup.tombstones ?? []) as Tombstone[]);
    await patchSettings(normalizeSettings(backup.settings));
    if (key) await writeProviderKey(key);
    else await clearProviderKey();
    if (license) await writeSystemLicense(license.license, license.expiresAt);
    restored = true;
    return { ok: true, packs: backup.packs.length, cards: backup.cards.length };
  } finally {
    resumeChanges();
    if (restored) markChanged();
  }
}

/** Restore a backup as a whole. A malformed file changes nothing. */
export async function restoreBackup(
  text: string,
  options: { beforeApply?: () => Promise<void> } = {},
): Promise<{ ok: true; packs: number; cards: number } | { ok: false; issues: ValidationIssue[] }> {
  const read = parseBackup(text);
  if (!read.ok) return read;
  return applyBackup(read.backup, options);
}
