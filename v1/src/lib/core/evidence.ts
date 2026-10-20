// WHY: Evidence is the only record the learner's algorithm can trust, so it is
// append-only and scoped to one card. This module writes rows, layers
// corrections on top without editing the original, and reads attempts back.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-20 opencode: global randomUUID (browser and test process) instead of
// the Node-only import, so the same evidence code runs in IndexedDB.
// [pack: browser-app]

import type { EvidenceRow, Outcome } from "@/lib/shared/types";
import type { JudgedRegion } from "@/lib/core/judge";
import { worstOutcome } from "@/lib/core/outcome";

/** A row after corrections have been layered in. It may be the original or a correction. */
export interface ResolvedRow extends EvidenceRow {
  originalId: string;
  corrected: boolean;
}

/** One attempt at one card, with every region resolved. */
export interface AttemptSummary {
  attemptId: string;
  cardId: string;
  at: string;
  timeMs: number;
  seenBefore: number;
  outcome: Outcome;
  regions: ResolvedRow[];
}

/** Group key: one correction answers the same attempt and region it disagrees with. */
function groupKey(row: EvidenceRow): string {
  return `${row.attemptId}\u0000${row.region ?? ""}`;
}

/** Write one answer row per judged region. All rows share the attempt id. */
export function makeAnswerRows(
  cardId: string,
  attemptId: string,
  regions: JudgedRegion[],
  timeMs: number,
  seenBefore: number,
  at: string,
): EvidenceRow[] {
  return regions.map((region) => ({
    id: crypto.randomUUID(),
    cardId,
    attemptId,
    region: region.region,
    outcome: region.outcome,
    timeMs,
    seenBefore,
    at,
    kind: "answer" as const,
  }));
}

/** A correction is a second row. The original stands; the correction points at it. */
export function makeCorrectionRow(
  original: EvidenceRow,
  outcome: Outcome,
  at: string,
): EvidenceRow {
  return {
    id: crypto.randomUUID(),
    cardId: original.cardId,
    attemptId: original.attemptId,
    region: original.region,
    outcome,
    timeMs: original.timeMs,
    seenBefore: original.seenBefore,
    at,
    kind: "correction",
    supersedes: original.id,
  };
}

/**
 * Read rows as the learner sees them: the last row for an attempt and region
 * wins. Corrections never erase the row they answer; they sit on top of it.
 */
export function resolveRows(rows: EvidenceRow[]): ResolvedRow[] {
  const winners = new Map<string, EvidenceRow>();
  const originals = new Map<string, string>();

  for (const row of rows) {
    const key = groupKey(row);
    const first = winners.get(key);
    if (first === undefined) originals.set(key, row.id);
    winners.set(key, row);
  }

  return [...winners.values()].map((row) => {
    const originalId = originals.get(groupKey(row)) ?? row.id;
    return {
      ...row,
      originalId,
      corrected: row.kind === "correction",
    };
  });
}

/** How many attempts the learner has made at this card before now. */
export function countSeenBefore(rows: EvidenceRow[], cardId: string): number {
  const attempts = new Set<string>();
  for (const row of rows) {
    if (row.cardId === cardId) attempts.add(row.attemptId);
  }
  return attempts.size;
}

/** Group resolved rows into attempts, oldest first. */
export function groupAttempts(rows: EvidenceRow[], cardId?: string): AttemptSummary[] {
  const resolved = resolveRows(rows).filter((row) => (cardId ? row.cardId === cardId : true));
  const byAttempt = new Map<string, ResolvedRow[]>();

  for (const row of resolved) {
    const bucket = byAttempt.get(row.attemptId);
    if (bucket) bucket.push(row);
    else byAttempt.set(row.attemptId, [row]);
  }

  const attempts: AttemptSummary[] = [];
  for (const [attemptId, regions] of byAttempt) {
    const first = regions[0];
    attempts.push({
      attemptId,
      cardId: first.cardId,
      at: regions.reduce((oldest, row) => (row.at < oldest ? row.at : oldest), first.at),
      timeMs: regions.reduce((slowest, row) => Math.max(slowest, row.timeMs), 0),
      seenBefore: regions.reduce((most, row) => Math.max(most, row.seenBefore), 0),
      outcome: worstOutcome(regions.map((region) => region.outcome)),
      regions,
    });
  }

  return attempts.sort((left, right) => left.at.localeCompare(right.at));
}

/** Every card's attempts, keyed by card id. */
export function attemptsByCard(rows: EvidenceRow[]): Map<string, AttemptSummary[]> {
  const map = new Map<string, AttemptSummary[]>();
  for (const attempt of groupAttempts(rows)) {
    const bucket = map.get(attempt.cardId);
    if (bucket) bucket.push(attempt);
    else map.set(attempt.cardId, [attempt]);
  }
  return map;
}
