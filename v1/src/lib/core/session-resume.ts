// WHY: A running lesson must survive a tab switch, a reload or a trip to the
// Library. This module is the pure half of that promise: it builds the one
// snapshot shape, refuses a shape it cannot trust, and drops entries whose card
// no longer exists. It touches no storage, so both rules can be pinned without
// a browser.
// PACK: study-resilience
// 2026-10-26 qoder: created for the study-resilience pack [pack: study-resilience]
// 2026-10-27 opencode: a snapshot now keeps the whole plan scope, and an older
// one-pack row is recovered from its plan cards. [pack: plan-multi-select]

import type { AnswerResult, Card, Plan, PlanScope } from "@/lib/shared/types";
import { isPlanScope } from "@/lib/core/plan-scope";

/** The snapshot shape version. A row from a newer shape is not guessed at. */
export const RESUME_VERSION = 2;

export type ResumeReturnKind = "cold" | "wrong" | null;

/** One trip through the card; mirrors the Study screen's own queue entry. */
export interface QueueEntry {
  entryId: string;
  card: Card;
  coldCheck: boolean;
  suppressTeaching: boolean;
  returnKind: ResumeReturnKind;
}

export interface ResumeLayerUi {
  entryId: string;
  open: boolean;
}

/**
 * Everything a running session holds, in one row. Transient things (spinner,
 * error banner, full-screen mode, speech playback) are deliberately absent
 * (GRILL Q6).
 */
export interface StoredSession {
  version: 2;
  savedAt: string;
  sessionId: string;
  /** The packs and decks this session draws from; empty means the library. */
  scope: PlanScope;
  offerChoice: number;
  plan: Plan;
  queue: QueueEntry[];
  index: number;
  results: Record<string, AnswerResult>;
  answersByEntry: Record<string, Record<string, string>>;
  working: string;
  hintTexts: string[];
  hintUsed: boolean;
  hintSource: string | null;
  approved: "none" | "yes" | "no";
  returned: string[];
  peeked: string[];
  autoHinted: string[];
  attempts: number;
  startedAt: number;
  layerUi: ResumeLayerUi | null;
}

/** The running screen's state, ready to be stamped into a snapshot. */
export interface StoredSessionInput extends Omit<StoredSession, "version" | "savedAt"> {
  /** Tests pass a fixed time; the screen lets the snapshot stamp itself. */
  savedAt?: string;
}

/** Build the snapshot; the version and the time are added here, never by callers. */
export function toStoredSession(input: StoredSessionInput): StoredSession {
  return {
    version: RESUME_VERSION,
    savedAt: input.savedAt ?? new Date().toISOString(),
    sessionId: input.sessionId,
    scope: input.scope,
    offerChoice: input.offerChoice,
    plan: input.plan,
    queue: input.queue,
    index: input.index,
    results: input.results,
    answersByEntry: input.answersByEntry,
    working: input.working,
    hintTexts: input.hintTexts,
    hintUsed: input.hintUsed,
    hintSource: input.hintSource,
    approved: input.approved,
    returned: input.returned,
    peeked: input.peeked,
    autoHinted: input.autoHinted,
    attempts: input.attempts,
    startedAt: input.startedAt,
    layerUi: input.layerUi,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A card must at least be drawable: identity, both sides and an answer rule. */
function isCard(value: unknown): value is Card {
  return (
    isRecord(value) &&
    isText(value.id) &&
    value.id.length > 0 &&
    Array.isArray(value.prompt) &&
    Array.isArray(value.answer) &&
    isRecord(value.answerDef)
  );
}

function isQueueEntry(value: unknown): value is QueueEntry {
  if (!isRecord(value)) return false;
  return (
    isText(value.entryId) &&
    value.entryId.length > 0 &&
    isCard(value.card) &&
    typeof value.coldCheck === "boolean" &&
    typeof value.suppressTeaching === "boolean" &&
    (value.returnKind === null || value.returnKind === "cold" || value.returnKind === "wrong")
  );
}

function isAnswerResult(value: unknown): value is AnswerResult {
  return (
    isRecord(value) &&
    isText(value.cardId) &&
    isText(value.cardOutcome) &&
    Array.isArray(value.results) &&
    Array.isArray(value.rows)
  );
}

function isResultMap(value: unknown): value is Record<string, AnswerResult> {
  return isRecord(value) && Object.values(value).every(isAnswerResult);
}

function isAnswerMap(value: unknown): value is Record<string, Record<string, string>> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (answers) => isRecord(answers) && Object.values(answers).every(isText),
    )
  );
}

function isPlan(value: unknown): value is Plan {
  return (
    isRecord(value) &&
    isText(value.sessionId) &&
    value.sessionId.length > 0 &&
    Array.isArray(value.cards) &&
    value.cards.every(isCard) &&
    Array.isArray(value.groups) &&
    isNumber(value.offer) &&
    (value.algorithm === "default" || value.algorithm === "fallback") &&
    isNumber(value.fallbackCount) &&
    (value.banner === null || isRecord(value.banner))
  );
}

function isLayerUi(value: unknown): value is ResumeLayerUi | null {
  if (value === null) return true;
  return isRecord(value) && isText(value.entryId) && typeof value.open === "boolean";
}

/**
 * Accept a stored row only when every rule the screen relies on holds: the
 * shape version, a plan that matches its session, and a position inside the
 * queue. Anything else is unreadable and falls back to the plan screen.
 */
/**
 * Recover the scope from an older one-pack snapshot. When no deck was named,
 * the plan cards tell which decks the pack actually drew from.
 */
function scopeFromVersionOne(raw: Record<string, unknown>, plan: Plan): PlanScope | null {
  if (!isText(raw.scopePack) || !isText(raw.scopeDeck)) return null;
  if (raw.scopePack === "") return [];
  if (raw.scopeDeck) return [{ pack: raw.scopePack, decks: [raw.scopeDeck] }];
  const decks = [
    ...new Set(
      plan.cards
        .filter((card) => card.packName === raw.scopePack)
        .map((card) => card.deckId)
        .filter((deck): deck is string => typeof deck === "string"),
    ),
  ];
  return decks.length > 0 ? [{ pack: raw.scopePack, decks }] : [];
}

export function parseStoredSession(raw: unknown): StoredSession | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1 && raw.version !== RESUME_VERSION) return null;
  if (!isText(raw.savedAt)) return null;
  if (!isText(raw.sessionId) || raw.sessionId.length === 0) return null;
  if (!isNumber(raw.offerChoice)) return null;
  const plan = raw.plan;
  if (!isPlan(plan) || plan.sessionId !== raw.sessionId) return null;

  let scope: PlanScope;
  if (raw.version === RESUME_VERSION) {
    if (!isPlanScope(raw.scope)) return null;
    scope = raw.scope;
  } else {
    const migrated = scopeFromVersionOne(raw, plan);
    if (!migrated) return null;
    scope = migrated;
  }

  if (!Array.isArray(raw.queue) || raw.queue.length === 0) return null;
  if (!raw.queue.every(isQueueEntry)) return null;
  if (
    !Number.isInteger(raw.index) ||
    (raw.index as number) < 0 ||
    (raw.index as number) >= raw.queue.length
  ) {
    return null;
  }
  if (!isResultMap(raw.results) || !isAnswerMap(raw.answersByEntry)) return null;
  if (!isText(raw.working) || !isTextList(raw.hintTexts)) return null;
  if (typeof raw.hintUsed !== "boolean") return null;
  if (!(raw.hintSource === null || isText(raw.hintSource))) return null;
  if (raw.approved !== "none" && raw.approved !== "yes" && raw.approved !== "no") return null;
  if (!isTextList(raw.returned) || !isTextList(raw.peeked) || !isTextList(raw.autoHinted)) {
    return null;
  }
  if (!Number.isInteger(raw.attempts) || (raw.attempts as number) < 0) return null;
  if (!isNumber(raw.startedAt)) return null;
  if (!isLayerUi(raw.layerUi)) return null;
  // WHY: Write one shape forward, without the old one-pack fields even when the
  // row arrived as version 1.
  const { scopePack: _pack, scopeDeck: _deck, ...rest } = raw;
  void _pack;
  void _deck;
  return { ...rest, version: RESUME_VERSION, scope } as unknown as StoredSession;
}

/** Copy a keyed map, keeping only the entries that still have a place. */
function keepKeys<T>(map: Record<string, T>, keys: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(map).filter(([key]) => keys.has(key)));
}

/**
 * Drop queue entries whose card is gone and move the position to the first
 * surviving entry at or after the old one (GRILL Q9). Nothing left to show, or
 * only already-passed cards left, means the session is over: null clears it.
 * Marks for dropped entries are dropped with them; the rest are untouched.
 */
export function pruneStoredSession(
  session: StoredSession,
  liveCardIds: Set<string>,
): StoredSession | null {
  const surviving = session.queue
    .map((entry, position) => ({ entry, position }))
    .filter(({ entry }) => liveCardIds.has(entry.card.id));
  if (surviving.length === 0) return null;
  const first = surviving.find(({ position }) => position >= session.index);
  if (!first) return null;

  const queue = surviving.map(({ entry }) => entry);
  const index = surviving.indexOf(first);
  const entryIds = new Set(queue.map((entry) => entry.entryId));
  const cardIds = new Set(queue.map((entry) => entry.card.id));

  return {
    ...session,
    queue,
    index,
    results: keepKeys(session.results, entryIds),
    answersByEntry: keepKeys(session.answersByEntry, entryIds),
    returned: session.returned.filter((id) => cardIds.has(id)),
    peeked: session.peeked.filter((id) => entryIds.has(id)),
    autoHinted: session.autoHinted.filter((id) => cardIds.has(id)),
    layerUi: session.layerUi && entryIds.has(session.layerUi.entryId) ? session.layerUi : null,
  };
}
