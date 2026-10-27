// WHY: The last few finished sessions belong under Start as a plain list, not
// another history page. Each row can rebuild a fresh plan on the same pack and
// deck; older rows without a recorded scope stay readable but offer no action.
// PACK: study-sidebar-and-history
// 2026-10-27 opencode: created for the study sidebar and history pack
// [pack: study-sidebar-and-history]

"use client";

import type { PastSession } from "@/lib/core/past-sessions";
import type { PackStatus } from "@/lib/shared/types";

interface PreviousSessionsProps {
  past: PastSession[];
  packs: PackStatus[];
  onRelearn: (pack: string, deck: string) => void;
}

function scopeLabel(row: PastSession, packs: PackStatus[]): string | null {
  // WHY: An absent pack is an older row, not the whole library.
  if (row.pack === undefined) return null;
  if (row.pack === "") return "the whole library";
  const pack = packs.find((entry) => entry.name === row.pack);
  const deck = row.deck ? pack?.decks?.find((entry) => entry.id === row.deck) : null;
  return deck ? `${row.pack} / ${deck.name}` : row.pack;
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
            const scope = scopeLabel(row, packs);
            return (
              <li className="study-past-row" key={row.id}>
                <span className="study-past-when">{whenLabel(row.at)}</span>
                <span className="study-past-scope">{scope}</span>
                <span className="study-past-count">
                  {row.answered} / {row.offered} answered ·{" "}
                  <span className={`study-past-state ${stateLabel(row)}`}>{stateLabel(row)}</span>
                </span>
                {row.pack !== undefined ? (
                  <button
                    className="study-ghost study-past-again"
                    type="button"
                    onClick={() => onRelearn(row.pack ?? "", row.deck ?? "")}
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
