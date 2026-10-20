"use client";

// WHY: Progress is read fresh from the evidence every time. Nothing here is a
// stored conclusion, and nothing is a comparison with anyone else. Two tabs
// keep the summary and the whole deck apart, and the record opens in a side
// panel so the page never grows into a wall.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-19 opencode: tabbed layout and side-panel record [pack: v1-prototype]

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { OUTCOME_LABELS } from "@/lib/core/outcome";
import type { Card, EvidenceRow, Outcome, ProgressView } from "@/lib/shared/types";

interface EvidenceAnswer {
  card: Card;
  rows: EvidenceRow[];
}

const CORRECTIONS: Array<{ outcome: Outcome; label: string }> = [
  { outcome: "got_it", label: "I got it" },
  { outcome: "nearly", label: "Nearly" },
  { outcome: "again", label: "I missed it" },
  { outcome: "no", label: "No" },
];

type ProgressTab = "overview" | "cards";

export default function ProgressClient() {
  const [progress, setProgress] = useState<ProgressView | null>(null);
  const [evidence, setEvidence] = useState<EvidenceAnswer | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<ProgressTab>("overview");

  const loadProgress = useCallback(async () => {
    try {
      const data = await apiGet<{ progress: ProgressView }>("/api/progress");
      setProgress(data.progress);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Progress could not be read.");
    }
  }, []);

  useEffect(() => {
    const pending = Promise.resolve().then(() => loadProgress());
    return () => {
      void pending;
    };
  }, [loadProgress]);

  const openEvidence = useCallback(async (cardId: string) => {
    setMessage(null);
    setNotice(null);
    try {
      const data = await apiGet<EvidenceAnswer>(`/api/evidence?cardId=${encodeURIComponent(cardId)}`);
      setEvidence(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The record could not be read.");
    }
  }, []);

  const correctRow = useCallback(
    async (cardId: string, rowId: string, outcome: Outcome) => {
      setMessage(null);
      try {
        await apiSend("/api/evidence/correction", "POST", { rowId, outcome });
        setNotice("The correction was written as a new row. The old row stays.");
        const data = await apiGet<EvidenceAnswer>(`/api/evidence?cardId=${encodeURIComponent(cardId)}`);
        setEvidence(data);
        await loadProgress();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The correction could not be saved.");
      }
    },
    [loadProgress],
  );

  if (message && !progress) return <div className="notice error">{message}</div>;
  if (!progress) return <p className="muted">Reading the record…</p>;

  return (
    <div>
      <h1>Progress</h1>
      <p className="lead">Read straight from your record. No scores, no percentages.</p>

      {message ? <div className="notice error">{message}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <div className="tabs" role="tablist" aria-label="Progress">
        <button className="tab" type="button" role="tab" aria-selected={tab === "overview"} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button className="tab" type="button" role="tab" aria-selected={tab === "cards"} onClick={() => setTab("cards")}>
          Every card
        </button>
      </div>

      {tab === "overview" ? (
        <div>
          <h2>Cards you now handle</h2>
          {progress.improvements.length === 0 ? (
            <p className="muted">Nothing has turned the corner yet — that is normal early on.</p>
          ) : (
            <ul className="plain">
              {progress.improvements.map((card) => (
                <li key={card.cardId}>
                  <span className="progress-good">{card.summary}</span>{" "}
                  <span className="muted">
                    — wrong early, right the last time ({card.attempts} attempts)
                  </span>{" "}
                  <button className="btn small" type="button" onClick={() => void openEvidence(card.cardId)}>
                    Record
                  </button>
                </li>
              ))}
            </ul>
          )}

          {progress.faster.length > 0 ? (
            <>
              <h2>Smoother now</h2>
              <ul className="plain">
                {progress.faster.map((card) => (
                  <li key={card.cardId}>
                    {card.summary} <span className="muted">— answered much faster than at first</span>{" "}
                    <button className="btn small" type="button" onClick={() => void openEvidence(card.cardId)}>
                      Record
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h2>Worth another pass</h2>
          {progress.nextTopics.length === 0 ? (
            <p className="muted">No topic is calling for attention right now.</p>
          ) : (
            <ul className="plain">
              {progress.nextTopics.map((topic) => (
                <li key={topic.topic}>
                  <strong>{topic.label}</strong> — {topic.reason}{" "}
                  <span className="chip">{topic.cardIds.length} cards</span>
                </li>
              ))}
            </ul>
          )}

          <h2>Solid ground</h2>
          {progress.strengths.length === 0 ? (
            <p className="muted">No topic has earned that word yet.</p>
          ) : (
            <ul className="plain">
              {progress.strengths.map((topic) => (
                <li key={topic.topic}>
                  <strong>{topic.label}</strong> — {topic.reason}{" "}
                  <span className="chip">{topic.cardIds.length} cards</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "cards" ? (
        <div className="scroll-area">
          <table>
            <thead>
              <tr>
                <th>Card</th>
                <th>Topics</th>
                <th>Attempts</th>
                <th>Last time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {progress.cards.map((card) => (
                <tr key={card.cardId}>
                  <td>{card.summary}</td>
                  <td className="muted">{card.topics.join(", ")}</td>
                  <td>{card.attempts}</td>
                  <td>
                    {card.lastOutcome ? (
                      <span className={`outcome outcome-${card.lastOutcome}`}>{OUTCOME_LABELS[card.lastOutcome]}</span>
                    ) : (
                      <span className="muted">not seen yet</span>
                    )}
                    {card.lastAt ? (
                      <span className="muted"> · {new Date(card.lastAt).toLocaleDateString()}</span>
                    ) : null}
                  </td>
                  <td>
                    <button className="btn small" type="button" onClick={() => void openEvidence(card.cardId)}>
                      Record
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {evidence ? (
        <>
          <div className="drawer-scrim" onClick={() => setEvidence(null)} />
          <aside className="drawer" aria-label="Card record">
            <div className="drawer-head">
              <h2>The record for “{evidence.card.summary}”</h2>
              <button className="btn small" type="button" onClick={() => setEvidence(null)}>
                Close
              </button>
            </div>
            <p className="muted">
              Every row as written, newest first. A correction adds a row and never changes an old one.
            </p>
            {evidence.rows.length === 0 ? (
              <p className="muted">No rows yet.</p>
            ) : (
              <div className="stack">
                {[...evidence.rows].reverse().map((row) => (
                  <div className="card tight" key={row.id}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div>
                        <span className={`outcome outcome-${row.outcome}`}>{OUTCOME_LABELS[row.outcome]}</span>{" "}
                        <span className="muted">
                          {row.region ?? "the answer"} · {new Date(row.at).toLocaleString()} ·{" "}
                          {row.kind === "correction" ? "a correction" : "as answered"}
                        </span>
                      </div>
                      <div className="row">
                        {CORRECTIONS.map((choice) => (
                          <button
                            key={choice.outcome}
                            className="btn small"
                            type="button"
                            onClick={() => void correctRow(evidence.card.id, row.id, choice.outcome)}
                          >
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </>
      ) : null}
    </div>
  );
}
