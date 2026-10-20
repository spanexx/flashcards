// WHY: The append-only files are the learner's record. This module is the only
// place that opens them for writing, so the append-only promise is one small
// file rather than a habit spread across routes.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import "server-only";
import type { EvidenceRow, SessionEvent } from "@/lib/shared/types";
import { appendJsonl, appendJsonlMany, readJsonl, writeJsonl } from "@/lib/storage/jsonl";
import { dataFile } from "@/lib/storage/paths";

/** Every evidence row, in the order it was written. */
export function readEvidence(): Promise<EvidenceRow[]> {
  return readJsonl<EvidenceRow>(dataFile("evidence.jsonl"));
}

/** Append answer rows. Nothing here may ever update or delete a row. */
export function appendEvidence(rows: EvidenceRow[]): Promise<void> {
  return appendJsonlMany(dataFile("evidence.jsonl"), rows);
}

/** Every session fact: started, ended, offered, answered, stopped. */
export function readSessions(): Promise<SessionEvent[]> {
  return readJsonl<SessionEvent>(dataFile("sessions.jsonl"));
}

/** Record one session fact. */
export function appendSession(event: SessionEvent): Promise<void> {
  return appendJsonl(dataFile("sessions.jsonl"), event);
}

/**
 * Remove one card's evidence. This is the only rewrite of an append-only file,
 * and it happens only because the learner deliberately deleted the card. The
 * row count removed is returned so the caller can say what happened.
 */
export async function deleteCardEvidence(cardId: string): Promise<number> {
  const rows = await readEvidence();
  const kept = rows.filter((row) => row.cardId !== cardId);
  const removed = rows.length - kept.length;
  if (removed > 0) await writeJsonl(dataFile("evidence.jsonl"), kept);
  return removed;
}
