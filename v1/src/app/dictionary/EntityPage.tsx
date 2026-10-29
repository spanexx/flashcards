"use client";

// WHY: A pack page and a deck page are covers, not dashboards: one picture, a
// promise, and the path onward. The contents window is capped so the page never
// becomes a vertical wall, and its search stays a slim field on one line.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import TeachingMedia from "@/app/TeachingMedia";
import { cardPageId, deckPageId, pageIsWritten, pageTitle } from "@/lib/core/pages";
import type { Card, Deck, DictionaryPage, PackStatus, StudyLevel } from "@/lib/shared/types";

interface EntityPageProps {
  level: "pack" | "deck";
  pack: PackStatus;
  deck?: Deck;
  page: DictionaryPage | null;
  cards: Card[];
  pages: DictionaryPage[];
  onEdit: () => void;
}

const LEVEL_LABELS: Record<StudyLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const SEARCH = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const CHEVRON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** The level words a pack covers, from the decks it holds. */
function levelRange(decks: readonly Deck[]): string {
  const seen = new Set(decks.map((deck) => deck.level));
  if (seen.size === 0) return "No decks yet";
  if (seen.size === 1) return LEVEL_LABELS[[...seen][0]];
  return "Beginner to advanced";
}

export default function EntityPage({ level, pack, deck, page, cards, pages, onEdit }: EntityPageProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchBox = useRef<HTMLDivElement | null>(null);
  const searchToggle = useRef<HTMLButtonElement | null>(null);

  // WHY: Escape or a press outside closes the slim field and clears the filter,
  // so the list is never narrowed by a field the learner cannot see (GRILL 19).
  useEffect(() => {
    if (!searchOpen) return;
    const close = () => {
      setQuery("");
      setSearchOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      searchToggle.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const box = searchBox.current;
      if (box && event.target instanceof Node && box.contains(event.target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [searchOpen]);

  const pageById = useMemo(() => new Map(pages.map((entry) => [entry.id, entry])), [pages]);

  const deckCards = useMemo(() => {
    if (!deck) return [];
    return cards.filter(
      (card) => card.packName === pack.name && card.deckId === deck.id && !card.retired,
    );
  }, [cards, deck, pack.name]);

  const decks = pack.decks ?? [];
  const needle = query.trim().toLowerCase();
  const visibleDecks = decks.filter((entry) => entry.name.toLowerCase().includes(needle));
  const visibleCards = deckCards.filter((card) => card.summary.toLowerCase().includes(needle));

  const written = pageIsWritten(page);
  const title = pageTitle(page, level === "pack" ? pack.name : (deck?.name ?? "Deck"));
  const shown = level === "pack" ? visibleDecks.length : visibleCards.length;
  const total = level === "pack" ? decks.length : deckCards.length;

  return (
    <section>
      {page?.cover ? (
        <div className="dict-cover">
          <TeachingMedia part={page.cover} />
        </div>
      ) : null}

      <div className="dict-page-head">
        <div>
          <p className="eyebrow">{level === "pack" ? "Pack page" : "Deck page"}</p>
          <h1>{title}</h1>
          <div className="row" style={{ marginTop: 6 }}>
            {level === "pack" ? (
              <>
                <span className="chip">{decks.length} decks</span>
                <span className="chip">{levelRange(decks)}</span>
              </>
            ) : (
              <>
                {deck ? <span className="chip">{LEVEL_LABELS[deck.level]}</span> : null}
                <span className="chip">{deckCards.length} cards</span>
              </>
            )}
            <span className="chip good">Always open</span>
            {page?.learnerEdited ? <span className="chip accent">Your copy — private</span> : null}
            {written ? null : <span className="chip">Page not written</span>}
          </div>
        </div>
        <button className="btn small" type="button" onClick={onEdit}>
          Edit page
        </button>
      </div>

      {page?.lead?.trim() ? (
        <p className="lead" style={{ marginTop: 12 }}>
          {page.lead}
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          {written
            ? "This page has a cover or a title but no promise yet. Edit it to say what the course covers."
            : "No page yet. Say what this course covers and why it is worth the time."}
        </p>
      )}

      <div className="dict-list-head">
        <p className="eyebrow" style={{ margin: 0 }}>
          {level === "pack" ? "The path" : "The cards"}
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }} ref={searchBox}>
          {searchOpen ? (
            <input
              className="field dict-search"
              type="search"
              value={query}
              autoFocus
              spellCheck={false}
              placeholder={level === "pack" ? "Search decks" : "Search cards"}
              aria-label={level === "pack" ? "Search decks" : "Search cards"}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}
          <button
            ref={searchToggle}
            className="dict-search-toggle"
            type="button"
            aria-label={level === "pack" ? "Search decks" : "Search cards"}
            title={level === "pack" ? "Search decks" : "Search cards"}
            aria-expanded={searchOpen}
            onClick={() => {
              if (searchOpen) setQuery("");
              setSearchOpen((open) => !open);
            }}
          >
            {SEARCH}
          </button>
        </div>
      </div>

      {shown === 0 ? (
        <p className="muted small" style={{ margin: "8px 0" }}>
          {total === 0
            ? level === "pack"
              ? "This pack has no decks yet."
              : "This deck has no cards yet."
            : "Nothing matches that search."}
        </p>
      ) : (
        <div className="dict-list scroll">
          {level === "pack"
            ? visibleDecks.map((entry) => {
                const deckPage = pageById.get(deckPageId(pack.name, entry.id));
                return (
                  <Link
                    key={entry.id}
                    className="dict-row"
                    href={`/dictionary?pack=${encodeURIComponent(pack.name)}&deck=${encodeURIComponent(entry.id)}`}
                  >
                    <span className={pageIsWritten(deckPage) ? "dict-dot ok" : "dict-dot"} aria-hidden="true" />
                    <span className="dict-row-name">{entry.name}</span>
                    <span className="tag">{LEVEL_LABELS[entry.level]}</span>
                    <span className="dict-chevron" aria-hidden="true">
                      {CHEVRON}
                    </span>
                  </Link>
                );
              })
            : visibleCards.map((card) => {
                const cardPage = pageById.get(cardPageId(card.id));
                return (
                  <Link
                    key={card.id}
                    className="dict-row"
                    href={`/dictionary?pack=${encodeURIComponent(pack.name)}&deck=${encodeURIComponent(
                      deck?.id ?? "",
                    )}&card=${encodeURIComponent(card.id)}`}
                  >
                    <span className={pageIsWritten(cardPage) ? "dict-dot ok" : "dict-dot"} aria-hidden="true" />
                    <span className="dict-row-name">{card.summary}</span>
                    <span className="dict-chevron" aria-hidden="true">
                      {CHEVRON}
                    </span>
                  </Link>
                );
              })}
        </div>
      )}

      <p className="muted small" style={{ margin: "10px 0 0" }}>
        A green dot means the page is written. A grey dot means it is empty.
      </p>

      {level === "deck" ? (
        <div className="row" style={{ marginTop: 14 }}>
          <Link className="btn small" href={`/dictionary?pack=${encodeURIComponent(pack.name)}`}>
            Pack page ↑
          </Link>
        </div>
      ) : null}
    </section>
  );
}
