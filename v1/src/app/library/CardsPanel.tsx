"use client";

// WHY: Cards is the management surface. It lists, searches, edits, retires and
// opens the record, but it never writes a new card; that belongs to Create.
// A create result can narrow this list to one pack and deck.
// PACK: library-create-flow
// 2026-10-21 opencode: created during the Cards management rework [pack: library-create-flow]

import { useState } from "react";
import Link from "next/link";
import { apiSend } from "@/lib/client/api";
import type { Card, PackStatus } from "@/lib/shared/types";
import TeachingEditor from "./TeachingEditor";
import {
  cardMatches,
  cardsInFocus,
  deckLabel,
  plainText,
  searchable,
  type CardFocus,
} from "./library-utils";

/** The book mark that opens a card's Dictionary page. */
const BOOK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

/** What the Cards panel needs from the shell and the loaded library. */
interface CardsPanelProps {  cards: Card[];
  packs: PackStatus[];
  focus: (CardFocus & { token: number }) | null;
  onOpenRecord: (cardId: string) => void;
  onCardRemoved: (cardId: string) => void;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

export default function CardsPanel({
  cards,
  packs,
  focus,
  onOpenRecord,
  onCardRemoved,
  onChanged,
  onError,
  onNotice,
}: CardsPanelProps) {
  const [search, setSearch] = useState("");
  const [narrowed, setNarrowed] = useState<CardFocus | null>(() =>
    focus ? { packName: focus.packName, deckId: focus.deckId } : null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [teachingId, setTeachingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ front: "", back: "", topics: "", summary: "" });

  // A new create result mounts this panel through a fresh token, so the focus
  // arrives as the starting state instead of a second render.
  const query = searchable(search.trim());
  const inFocus = cardsInFocus(cards, narrowed);
  const active = inFocus.filter((card) => !card.retired);
  const retired = inFocus.filter((card) => card.retired);
  const shownActive = query ? active.filter((card) => cardMatches(card, query)) : active;
  const shownRetired = query ? retired.filter((card) => cardMatches(card, query)) : retired;

  // Editing starts from the visible sides, not the stored parts.
  const beginEdit = (card: Card) => {
    setTeachingId(null);
    setEditingId(card.id);
    setEditForm({
      front: plainText(card.prompt),
      back: plainText(card.answer),
      topics: card.topics.join(", "),
      summary: card.summary,
    });
  };

  // The layer editor is its own action: saving it keeps the card and its record.
  const beginTeaching = (card: Card) => {
    setEditingId(null);
    setTeachingId((current) => (current === card.id ? null : card.id));
  };

  // A saved edit becomes a new copy; the old one stays retired in the record.
  const saveEdit = async () => {
    if (!editingId) return;
    onError(null);
    try {
      const topics = editForm.topics.split(",").map((topic) => topic.trim()).filter((topic) => topic.length > 0);
      await apiSend(`/api/cards/${encodeURIComponent(editingId)}`, "PATCH", {
        front: editForm.front,
        back: editForm.back,
        topics,
        summary: editForm.summary || undefined,
      });
      setEditingId(null);
      onNotice("The card was replaced with an edited copy. The old one is kept in the record.");
      await onChanged();
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "The edit could not be saved.");
    }
  };

  // Deletion keeps its existing confirmation and removes the card's record rows.
  const removeCard = async (cardId: string) => {
    if (!window.confirm("Delete this card and its record? This cannot be undone.")) return;
    onError(null);
    try {
      const data = await apiSend<{ removedEvidenceRows: number }>(`/api/cards/${encodeURIComponent(cardId)}`, "DELETE");
      onNotice(`The card was deleted, along with ${data.removedEvidenceRows} record rows.`);
      onCardRemoved(cardId);
      await onChanged();
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "The card could not be deleted.");
    }
  };

  return (
    <section className="card">
      <div className="split-head">
        <div>
          <h2 style={{ margin: 0 }}>Cards</h2>
          <p className="muted" style={{ margin: "3px 0 0" }}>
            Edit and remove existing cards. New cards live in Create.
          </p>
        </div>
        <span className="pill">manage only</span>
      </div>

      <div className="row" style={{ margin: "12px 0" }}>
        <input
          className="field search-field"
          type="search"
          aria-label="Search cards"
          placeholder="Search cards"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {narrowed ? (
          <>
            <span className="chip">
              {narrowed.packName} → {deckLabel(packs, narrowed.packName, narrowed.deckId)}
            </span>
            <button className="btn small" type="button" onClick={() => setNarrowed(null)}>
              Clear filter
            </button>
          </>
        ) : null}
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>
          Your cards ({query ? `${shownActive.length} of ${active.length}` : active.length})
        </h3>
      </div>

      {shownActive.length === 0 ? (
        <div className="empty">
          <strong>{active.length === 0 ? "No cards here yet." : "No cards match."}</strong>{" "}
          {narrowed ? "Clear the filter or make cards in Create." : "Make cards in Create."}
        </div>
      ) : (
        <div className="scroll-area tall stack">
          {shownActive.map((card) => (
            <div className="card tight" key={card.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>{card.summary}</strong>
                  <div className="muted">
                    {card.topics.map((topic) => (
                      <span className="chip" key={topic} style={{ marginRight: 6 }}>
                        {topic}
                      </span>
                    ))}
                    {card.packName ?? "unknown"} → {deckLabel(packs, card.packName, card.deckId)} · from a{" "}
                    {card.origin.kind === "learner" ? "card you wrote" : card.origin.kind} · {card.origin.note}
                    {card.teaching && card.teaching.length > 0 ? (
                      <span className="chip" style={{ marginLeft: 6 }}>
                        layer
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="row">
                  <Link
                    className="btn small icon-only"
                    href={`/dictionary?card=${encodeURIComponent(card.id)}`}
                    aria-label="Open the card page"
                    title="Card page"
                  >
                    {BOOK}
                  </Link>
                  <button className="btn small" type="button" onClick={() => onOpenRecord(card.id)}>
                    Record
                  </button>
                  <button className="btn small" type="button" onClick={() => beginTeaching(card)}>
                    {teachingId === card.id ? "Close teaching" : "Teaching"}
                  </button>
                  <button className="btn small" type="button" onClick={() => beginEdit(card)}>
                    Edit
                  </button>
                  <button className="btn small danger" type="button" onClick={() => void removeCard(card.id)}>
                    Delete
                  </button>
                </div>
              </div>

              {teachingId === card.id ? (
                <TeachingEditor
                  key={`teaching-${card.id}`}
                  card={card}
                  onSaved={onChanged}
                  onClose={() => setTeachingId(null)}
                  onError={onError}
                  onNotice={onNotice}
                />
              ) : null}

              {editingId === card.id ? (
                <div className="stack" style={{ marginTop: 10 }}>
                  <input
                    className="field"
                    value={editForm.front}
                    onChange={(event) => setEditForm((previous) => ({ ...previous, front: event.target.value }))}
                    aria-label="Card front"
                  />
                  <input
                    className="field"
                    value={editForm.back}
                    onChange={(event) => setEditForm((previous) => ({ ...previous, back: event.target.value }))}
                    aria-label="Card back"
                  />
                  <p className="muted" style={{ margin: 0 }}>
                    Deck: {card.packName ?? "unknown"} · {card.topics.join(", ")}
                  </p>
                  <input
                    className="field"
                    value={editForm.summary}
                    onChange={(event) => setEditForm((previous) => ({ ...previous, summary: event.target.value }))}
                    aria-label="Short card name"
                  />
                  <div className="row">
                    <button className="btn primary small" type="button" onClick={() => void saveEdit()}>
                      Save the edit
                    </button>
                    <button className="btn small" type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {shownRetired.length > 0 ? (
        <details className="disclosure">
          <summary>
            Retired cards ({query ? `${shownRetired.length} of ${retired.length}` : retired.length})
          </summary>
          <p className="muted">Older versions kept for the record. Their evidence stays with them.</p>
          <ul className="plain">
            {shownRetired.map((card) => (
              <li key={card.id}>
                {card.summary} <span className="muted">({card.origin.note})</span>{" "}
                <button className="btn small" type="button" onClick={() => onOpenRecord(card.id)}>
                  Record
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
