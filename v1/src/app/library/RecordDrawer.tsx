"use client";

// WHY: The record is the learner's, not the app's: it shows what happened on
// the card and keeps every row, but never the words the learner typed.
// PACK: library-create-flow
// 2026-10-21 opencode: moved out of the Library shell during the panel split [pack: library-create-flow]

import { OUTCOME_LABELS, OUTCOME_MEANINGS } from "@/lib/core/outcome";
import type { Card, Outcome } from "@/lib/shared/types";

/** One region as the record keeps it: outcome only, never the typed words. */
interface RecordRegion {
  region: string | null;
  outcome: Outcome;
  corrected: boolean;
}

/** One attempt, resolved against the local record. */
interface RecordAttempt {
  attemptId: string;
  at: string;
  timeMs: number;
  seenBefore: number;
  outcome: Outcome;
  regions: RecordRegion[];
  helpSeen?: boolean;
  coldCheck?: boolean;
}

/** The attempts and rows the evidence endpoint returns. */
export interface EvidenceAnswer {
  card: Card;
  rows: Array<{
    id: string;
    attemptId: string;
    region: string | null;
    outcome: Outcome;
    kind: "answer" | "correction";
    supersedes?: string;
    at: string;
    helpSeen?: boolean;
    coldCheck?: boolean;
  }>;
  attempts: RecordAttempt[];
}

/** The two facts a teaching layer leaves on an attempt, when true. */
function LayerFlags({ helpSeen, coldCheck }: { helpSeen?: boolean; coldCheck?: boolean }) {
  if (!helpSeen && !coldCheck) return null;
  return (
    <>
      {helpSeen ? <span className="chip">help seen</span> : null}{" "}
      {coldCheck ? <span className="chip chip-cold">cold check</span> : null}
    </>
  );
}

/** A read-only drawer over the current screen; closing it changes no data. */
export default function RecordDrawer({ evidence, onClose }: { evidence: EvidenceAnswer; onClose: () => void }) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" aria-label="Card record">
        <div className="drawer-head">
          <h2>Record: {evidence.card.summary}</h2>
          <button className="btn small" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {evidence.attempts.length === 0 ? (
          <p className="muted">Nothing has been answered for this card yet.</p>
        ) : (
          evidence.attempts.map((attempt) => (
            <div key={attempt.attemptId} style={{ marginTop: 12 }}>
              <div>
                <span className={`outcome outcome-${attempt.outcome}`}>{OUTCOME_LABELS[attempt.outcome]}</span>{" "}
                <span className="muted">
                  {new Date(attempt.at).toLocaleString()} · {Math.round(attempt.timeMs / 1000)}s · seen{" "}
                  {attempt.seenBefore} time(s) before
                </span>{" "}
                <LayerFlags helpSeen={attempt.helpSeen} coldCheck={attempt.coldCheck} />
              </div>
              {attempt.regions.map((region) => (
                <div className="muted" key={`${attempt.attemptId}-${region.region ?? "whole"}`}>
                  {region.region ?? "answer"} →{" "}
                  <span className={`outcome outcome-${region.outcome}`}>{OUTCOME_LABELS[region.outcome]}</span>.{" "}
                  {OUTCOME_MEANINGS[region.outcome]} {region.corrected ? "(corrected by you)" : ""}
                </div>
              ))}
            </div>
          ))
        )}
        <details className="disclosure">
          <summary>Every row as written ({evidence.rows.length})</summary>
          <ul className="plain">
            {evidence.rows.map((row) => (
              <li key={row.id} className="muted">
                {row.kind === "correction" ? "correction of an earlier row" : "answer"} · {row.outcome} ·{" "}
                {new Date(row.at).toLocaleString()}{" "}
                <LayerFlags helpSeen={row.helpSeen} coldCheck={row.coldCheck} />
              </li>
            ))}
          </ul>
        </details>
      </aside>
    </>
  );
}
