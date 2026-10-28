// WHY: The last few finished sessions belong under Start as a plain list, not
// another history page. Each row can rebuild a fresh plan on the same sources;
// older rows without a recorded scope stay readable but offer no action.
// PACK: study-sidebar-and-history, plan-multi-select
// 2026-10-27 opencode: created for the study sidebar and history pack
// [pack: study-sidebar-and-history]
// 2026-10-27 opencode: a row may name many packs and decks. [pack: plan-multi-select]

"use client";

import { pastScope, scopeSummary } from "@/lib/core/plan-scope";
import type { PastSession } from "@/lib/core/past-sessions";
import type { PackStatus, PlanScope } from "@/lib/shared/types";

interface PreviousSessionsProps {
  past: PastSession[];
  packs: PackStatus[];
  onRelearn: (scope: PlanScope) => void;
}

/** The row's scope as plain words, or null when the row cannot be replayed. */
function scopeLabel(row: PastSession, packs: PackStatus[]): string | null {
  const scope = pastScope(row, packs);
  return scope === null ? null : scopeSummary(scope, packs);
}

function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function stateLabel(row: PastSession): string {
  // WHY: The list says finished or stopped, the two states the learner named.
  // An ended session that did not finish reads as stopped.
  return row.completed ? "finished" : "stopped";
}

/** The plan's short list of finished sessions. */
export default function PreviousSessions({ past, packs, onRelearn }: PreviousSessionsProps) {
  return (
    <section className="study-past" aria-labelledby="study-past-title">
      <h2 className="study-past-title" id="study-past-title">
        Previous sessions
      </h2>
      {past.length === 0 ? (
        <p className="study-past-empty">No finished sessions yet. The first one will wait here.</p>
      ) : (
        <ul className="study-past-list">
          {past.map((row) => {
            const scope = pastScope(row, packs);
            return (
              <li className="study-past-row" key={row.id}>
                <span className="study-past-when">{whenLabel(row.at)}</span>
                <span className="study-past-scope">{scopeLabel(row, packs)}</span>
                <span className="study-past-count">
                  {row.answered} / {row.offered} answered ·{" "}
                  <span className={`study-past-state ${stateLabel(row)}`}>{stateLabel(row)}</span>
                </span>
                {scope !== null ? (
                  <button
                    className="study-ghost study-past-again"
                    type="button"
                    onClick={() => onRelearn(scope)}
                  >
                    Learn again
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
