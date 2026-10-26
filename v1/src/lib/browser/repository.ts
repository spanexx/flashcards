// WHY: The screens should not know whether data sits in IndexedDB, a test map
// or a future adapter. This module is the domain vocabulary over the storage
// seam: packs, cards, the append-only record, settings and the local prompt log.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.
// 2026-10-26 qoder: one live snapshot keeps a running session alive across a
// reload; replacing the library clears it. [pack: study-resilience]

import type {
  Card,
  Deck,
  EvidenceRow,
  PackStatus,
  PromptLogEntry,
  SessionEvent,
  Settings,
  Tombstone,
} from "@/lib/shared/types";
import type { PackPrompts } from "@/lib/packs/types";
import type { StoredSession } from "@/lib/core/session-resume";
import { defaultSettings, mergeSettings, normalizeSettings } from "@/lib/core/settings-shape";
import { browserStore, type StoredValue, type Store } from "@/lib/browser/store";
import { markChanged } from "@/lib/browser/changes";

/** A pack as the browser keeps it: identity, decks and prompts, no cards. */
export interface BrowserPack extends StoredValue {
  id: string;
  name: string;
  version: string;
  description?: string;
  language?: string;
  sourceLanguage?: string;
  studyInstruction?: string;
  decks: Deck[];
  prompts: PackPrompts | null;
  createdAt: string;
  updatedAt: string;
}

/** The settings row wraps the settings object because every row needs an id. */
interface SettingsRow extends StoredValue {
  id: "settings";
  value: Settings;
}

/** The provider key is stored on its own so a backup can leave it behind. */
interface KeyRow extends StoredValue {
  id: "provider-key";
  key: string;
}

/** A small named fact, such as whether the starter pack was seeded. */
interface MetaRow extends StoredValue {
  id: string;
  value: string;
}

/** Writes that read before they write share one queue, so a fast answer loop cannot interleave. */
let writeQueue: Promise<unknown> = Promise.resolve();

/** Run one write after the previous write has finished. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(work, work);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Old pack rows predate deck levels; a missing level means intermediate. */
function withLevels(pack: BrowserPack): BrowserPack {
  return {
    ...pack,
    decks: pack.decks.map((deck) => ({ ...deck, level: deck.level ?? "intermediate" })),
  };
}

/** All packs, newest name order is left to the caller. */
export async function readPacks(store: Store = browserStore()): Promise<BrowserPack[]> {
  return (await store.all<BrowserPack>("packs")).map(withLevels);
}

/** One pack by its exact name. */
export async function readPack(name: string, store: Store = browserStore()): Promise<BrowserPack | null> {
  const pack = await store.get<BrowserPack>("packs", name);
  return pack ? withLevels(pack) : null;
}

/** Add or replace one pack manifest. */
export async function writePack(pack: BrowserPack, store: Store = browserStore()): Promise<void> {
  await store.put("packs", { ...pack, id: pack.name });
  markChanged();
}

/** Every card the learner owns, retired ones included. */
export async function readCards(store: Store = browserStore()): Promise<Card[]> {
  return store.all<Card>("cards");
}

/** Add or replace one card by its identity. */
export async function writeCard(card: Card, store: Store = browserStore()): Promise<void> {
  await store.put("cards", card);
  markChanged();
}

/** Add or replace a batch of cards, queued so nothing is lost between writes. */
export function upsertCards(cards: Card[], store: Store = browserStore()): Promise<void> {
  return serial(async () => {
    for (const card of cards) await store.put("cards", card);
    markChanged();
  });
}

/** Remove one card only. Its evidence is a separate, explicit act. */
export function deleteCard(cardId: string, store: Store = browserStore()): Promise<void> {
  return serial(async () => {
    await store.delete("cards", cardId);
    markChanged();
  });
}

/** Every evidence row in the order it was written. */
export async function readEvidence(store: Store = browserStore()): Promise<EvidenceRow[]> {
  return store.all<EvidenceRow>("evidence");
}

/** Append rows; nothing here may update or delete an existing row. */
export function appendEvidence(rows: EvidenceRow[], store: Store = browserStore()): Promise<void> {
  return serial(async () => {
    for (const row of rows) await store.put("evidence", row);
    if (rows.length > 0) markChanged();
  });
}

/** Remove all rows for one card, only when the learner deliberately deletes it. */
export function deleteCardEvidence(cardId: string, store: Store = browserStore()): Promise<number> {
  return serial(async () => {
    const rows = await store.all<EvidenceRow>("evidence");
    const doomed = rows.filter((row) => row.cardId === cardId);
    for (const row of doomed) await store.delete("evidence", row.id);
    if (doomed.length > 0) markChanged();
    return doomed.length;
  });
}

/** What a deliberate deletion took out, said in counts the screen can show. */
export interface DeletionResult {
  removedDecks: number;
  removedCards: number;
  removedEvidenceRows: number;
}

/** A deck deletion can be refused without touching any row. */
export type DeleteDeckResult =
  | ({ ok: true } & DeletionResult)
  | { ok: false; reason: "missing-pack" | "missing-deck" | "last-deck" };

/** Delete a pack, every card under it, and those cards' evidence. */
export function deletePack(name: string, store: Store = browserStore()): Promise<DeletionResult | null> {
  return serial(async () => {
    const pack = await store.get<BrowserPack>("packs", name);
    if (!pack) return null;
    const cards = await store.all<Card>("cards");
    const doomedCards = cards.filter((card) => card.packName === name);
    const cardIds = new Set(doomedCards.map((card) => card.id));
    const evidence = await store.all<EvidenceRow>("evidence");
    const doomedEvidence = evidence.filter((row) => cardIds.has(row.cardId));
    for (const card of doomedCards) await store.delete("cards", card.id);
    for (const row of doomedEvidence) await store.delete("evidence", row.id);
    await store.delete("packs", name);
    markChanged();
    return {
      removedDecks: pack.decks.length,
      removedCards: doomedCards.length,
      removedEvidenceRows: doomedEvidence.length,
    };
  });
}

/** Delete one deck, its cards and their evidence, but keep the pack and its other decks. */
export function deleteDeck(packName: string, deckId: string, store: Store = browserStore()): Promise<DeleteDeckResult> {
  return serial(async () => {
    const pack = await store.get<BrowserPack>("packs", packName);
    if (!pack) return { ok: false, reason: "missing-pack" };
    if (!pack.decks.some((deck) => deck.id === deckId)) return { ok: false, reason: "missing-deck" };
    // WHY: A pack with no decks has no place to study and no shape a bundle
    // can restore, so the learner must delete the whole pack instead.
    if (pack.decks.length <= 1) return { ok: false, reason: "last-deck" };

    const cards = await store.all<Card>("cards");
    const doomedCards = cards.filter((card) => card.packName === packName && card.deckId === deckId);
    const cardIds = new Set(doomedCards.map((card) => card.id));
    const evidence = await store.all<EvidenceRow>("evidence");
    const doomedEvidence = evidence.filter((row) => cardIds.has(row.cardId));
    for (const card of doomedCards) await store.delete("cards", card.id);
    for (const row of doomedEvidence) await store.delete("evidence", row.id);
    await store.put<BrowserPack>("packs", {
      ...pack,
      decks: pack.decks.filter((deck) => deck.id !== deckId),
      updatedAt: new Date().toISOString(),
    });
    markChanged();
    return {
      ok: true,
      removedDecks: 1,
      removedCards: doomedCards.length,
      removedEvidenceRows: doomedEvidence.length,
    };
  });
}

/** Every session fact. */
export async function readSessions(store: Store = browserStore()): Promise<SessionEvent[]> {
  return store.all<SessionEvent>("sessions");
}

/** Add one session fact. */
export function appendSession(event: SessionEvent, store: Store = browserStore()): Promise<void> {
  return serial(async () => {
    await store.put("sessions", event);
    markChanged();
  });
}

/** The one resume row: the whole snapshot under a stable id. */
interface ResumeRow extends StoredValue {
  id: "active";
  session: StoredSession;
}

/** The live snapshot, unvalidated; `parseStoredSession` is the gate. */
export async function readStoredSession(store: Store = browserStore()): Promise<StoredSession | null> {
  const row = await store.get<ResumeRow>("resume", "active");
  return row?.session ?? null;
}

/**
 * Replace the live snapshot. It is device-local live state, not library
 * content, so it does not announce a change or travel in a backup (GRILL Q11).
 */
export function writeStoredSession(session: StoredSession, store: Store = browserStore()): Promise<void> {
  return serial(() => store.put<ResumeRow>("resume", { id: "active", session }));
}

/** Forget the snapshot; a finished or stopped session is not in progress. */
export function clearStoredSession(store: Store = browserStore()): Promise<void> {
  return serial(() => store.delete("resume", "active"));
}

/** Stored prompts carry the row id the shared type does not need. */
type StoredPrompt = PromptLogEntry & { id: string };

/** The prompt log, newest first, capped at the requested limit. */
export async function readPromptLog(limit = 50, store: Store = browserStore()): Promise<PromptLogEntry[]> {
  const entries = await store.all<StoredPrompt>("prompts");
  return entries
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, Math.max(0, limit));
}

/** Record one outbound prompt locally. */
export function appendPrompt(entry: PromptLogEntry, store: Store = browserStore()): Promise<void> {
  return serial(async () => {
    await store.put("prompts", { ...entry, id: `${entry.at}-${entry.requestId}-${entry.kind}` });
    markChanged();
  });
}

/** Read settings with defaults filled in. */
export async function readSettings(store: Store = browserStore()): Promise<Settings> {
  const row = await store.get<SettingsRow>("settings", "settings");
  return normalizeSettings(row?.value ?? defaultSettings());
}

/** Replace settings after a patch; only the named fields change. */
export function patchSettings(patch: Partial<Settings>, store: Store = browserStore()): Promise<Settings> {
  return serial(async () => {
    const current = await readSettings(store);
    const next = mergeSettings(current, patch);
    await store.put<SettingsRow>("settings", { id: "settings", value: next });
    markChanged();
    return next;
  });
}

/** Remember which planner ran last and how often it fell back. */
export function recordAlgorithmRun(
  algorithm: "default" | "fallback",
  at: string,
  store: Store = browserStore(),
): Promise<Settings> {
  return serial(async () => {
    const current = await readSettings(store);
    const next: Settings = {
      ...current,
      algorithm: {
        lastAlgorithm: algorithm,
        fallbackCount: current.algorithm.fallbackCount + (algorithm === "fallback" ? 1 : 0),
        lastFallbackAt: algorithm === "fallback" ? at : current.algorithm.lastFallbackAt,
      },
    };
    await store.put<SettingsRow>("settings", { id: "settings", value: next });
    markChanged();
    return next;
  });
}

/** The provider key, or an empty string when the learner has not set one. */
export async function readProviderKey(store: Store = browserStore()): Promise<string> {
  const row = await store.get<KeyRow>("settings", "provider-key");
  return row?.key ?? "";
}

/** Store the provider key in the browser. It never leaves this origin. */
export function writeProviderKey(key: string, store: Store = browserStore()): Promise<void> {
  return serial(() => store.put<KeyRow>("settings", { id: "provider-key", key }));
}

/** Forget the provider key. */
export function clearProviderKey(store: Store = browserStore()): Promise<void> {
  return serial(() => store.delete("settings", "provider-key"));
}

/** Read one named fact. */
export async function readMeta(id: string, store: Store = browserStore()): Promise<string | null> {
  const row = await store.get<MetaRow>("meta", id);
  return row?.value ?? null;
}

/** Write one named fact. */
export function writeMeta(id: string, value: string, store: Store = browserStore()): Promise<void> {
  return serial(() => store.put<MetaRow>("meta", { id, value }));
}

/** Every deliberate removal, so a seed can leave what the learner took out. */
export async function readTombstones(store: Store = browserStore()): Promise<Tombstone[]> {
  return store.all<Tombstone>("tombstones");
}

/** The ids the learner removed, optionally only packs or only cards. */
export async function readTombstoneIds(
  kind?: Tombstone["kind"],
  store: Store = browserStore(),
): Promise<Set<string>> {
  const rows = await readTombstones(store);
  return new Set(rows.filter((row) => !kind || row.kind === kind).map((row) => row.id));
}

/** Remember one deliberate removal. */
export function writeTombstone(tombstone: Tombstone, store: Store = browserStore()): Promise<void> {
  return serial(async () => {
    await store.put("tombstones", tombstone);
    markChanged();
  });
}

/** Remember several removals, such as those carried by a restored backup. */
export function writeTombstones(tombstones: Tombstone[], store: Store = browserStore()): Promise<void> {
  return serial(async () => {
    for (const tombstone of tombstones) await store.put("tombstones", tombstone);
    if (tombstones.length > 0) markChanged();
  });
}

/** Turn a pack and its cards into the status shape the screens already know. */
export function packStatus(pack: BrowserPack, cards: Card[]): PackStatus {
  const deckNames = pack.decks.map((deck) => deck.name);
  return {
    name: pack.name,
    version: pack.version,
    folder: "This browser",
    description: pack.description,
    language: pack.language,
    sourceLanguage: pack.sourceLanguage,
    studyInstruction: pack.studyInstruction,
    prompts: pack.prompts,
    decks: pack.decks,
    topics: deckNames,
    topicLabels: {},
    cardCount: cards.filter((card) => card.packName === pack.name && !card.retired).length,
  };
}

/** The shape the pure prompt and generation code expects from a pack. */
export function packRecord(pack: BrowserPack) {
  return {
    name: pack.name,
    version: pack.version,
    folder: "This browser",
    description: pack.description,
    language: pack.language,
    sourceLanguage: pack.sourceLanguage,
    studyInstruction: pack.studyInstruction,
    topics: pack.decks.map((deck) => deck.name),
    topicLabels: {},
    cards: [],
    prompts: pack.prompts,
  };
}

/** Cards whose pack is gone are still the learner's cards. */
export function orphanedPackNames(cards: Card[], packs: BrowserPack[]): string[] {
  const known = new Set(packs.map((pack) => pack.name));
  const missing = new Set<string>();
  for (const card of cards) {
    if (card.packName && !known.has(card.packName)) missing.add(card.packName);
  }
  return [...missing].sort();
}

/**
 * Remove the library. Used by restore, never by normal use. Local media stays
 * because the incoming backup may point at it; removal tombstones stay because
 * a restore must not undo what the learner deliberately took out. The running
 * session goes because its cards are gone (GRILL Q11).
 */
export function clearLibrary(store: Store = browserStore()): Promise<void> {
  return serial(async () => {
    for (const name of [
      "packs",
      "cards",
      "evidence",
      "sessions",
      "prompts",
      "settings",
      "meta",
      "resume",
    ] as const) {
      await store.clear(name);
    }
    markChanged();
  });
}
