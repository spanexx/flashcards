"use client";

// WHY: A course is written in one place: the tree shows every page a pack owns
// and whether it is written, and the right pane edits exactly one. Nothing is
// saved until the editor says so.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { cardPageId, deckPageId, packPageId, pageIsWritten } from "@/lib/core/pages";
import type { Card, DictionaryPage, PackStatus } from "@/lib/shared/types";
import PageEditor from "@/app/dictionary/PageEditor";

/** The one page the editor is holding. */
type Target =
  | { level: "pack" }
  | { level: "deck"; deckId: string }
  | { level: "card"; cardId: string };

interface PagesAnswer {
  pages: DictionaryPage[];
  traces: unknown[];
  progress: { read: number; total: number };
}

function problemText(problem: unknown, fallback: string): string {
  return problem instanceof Error ? problem.message : fallback;
}

/** The stored id of one target's page. */
function targetPageId(packName: string, target: Target): string {
  if (target.level === "pack") return packPageId(packName);
  if (target.level === "deck") return deckPageId(packName, target.deckId);
  return cardPageId(target.cardId);
}

/** The address of one target's page in the reader. */
function targetHref(packName: string, target: Target): string {
  const base = `/dictionary?pack=${encodeURIComponent(packName)}`;
  if (target.level === "pack") return base;
  if (target.level === "deck") return `${base}&deck=${encodeURIComponent(target.deckId)}`;
  return `${base}&card=${encodeURIComponent(target.cardId)}`;
}

function sameTarget(a: Target, b: Target): boolean {
  if (a.level !== b.level) return false;
  if (a.level === "deck" && b.level === "deck") return a.deckId === b.deckId;
  if (a.level === "card" && b.level === "card") return a.cardId === b.cardId;
  return true;
}

export default function BuilderClient() {
  const router = useRouter();
  const search = useSearchParams();
  const packParam = search.get("pack")?.trim() ?? "";

  const [packs, setPacks] = useState<PackStatus[] | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [pages, setPages] = useState<DictionaryPage[]>([]);
  const [target, setTarget] = useState<Target>({ level: "pack" });
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([apiGet<{ packs: PackStatus[] }>("/api/packs"), apiGet<{ cards: Card[] }>("/api/cards")])
      .then(([packAnswer, cardAnswer]) => {
        if (!active) return;
        setPacks(packAnswer.packs);
        setCards(cardAnswer.cards);
      })
      .catch((problem: unknown) => {
        if (!active) return;
        setPacks([]);
        setMessage(problemText(problem, "The library could not be read."));
      });
    return () => {
      active = false;
    };
  }, []);

  const activePack = useMemo(() => {
    if (!packs || packs.length === 0) return null;
    return packs.find((pack) => pack.name === packParam) ?? packs[0];
  }, [packs, packParam]);

  useEffect(() => {
    if (!activePack || packParam === activePack.name) return;
    const next = new URLSearchParams(search.toString());
    next.set("pack", activePack.name);
    router.replace(`/builder?${next.toString()}`);
  }, [activePack, packParam, router, search]);

  // A new pack starts at its cover; the old selection names another course.
  // WHY: the reset waits one tick so it lands after this commit, never during
  // it; the screen keeps its state until the new pack is actually shown.
  useEffect(() => {
    Promise.resolve().then(() => {
      setTarget({ level: "pack" });
      setNotice(null);
      setMessage(null);
    });
  }, [activePack?.name]);

  useEffect(() => {
    if (!activePack) return;
    let active = true;
    apiGet<PagesAnswer>(`/api/pages?pack=${encodeURIComponent(activePack.name)}`)
      .then((answer) => {
        if (active) setPages(answer.pages);
      })
      .catch((problem: unknown) => {
        if (active) setMessage(problemText(problem, "The pages could not be read."));
      });
    return () => {
      active = false;
    };
  }, [activePack]);

  const deckCards = useCallback(
    (deckId: string): Card[] =>
      cards.filter(
        (card) =>
          card.packName === activePack?.name && card.deckId === deckId && !card.retired,
      ),
    [cards, activePack?.name],
  );

  const unplaced = useMemo(() => {
    if (!activePack) return [];
    const known = new Set((activePack.decks ?? []).map((deck) => deck.id));
    return cards.filter(
      (card) =>
        card.packName === activePack.name &&
        !card.retired &&
        (!card.deckId || !known.has(card.deckId)),
    );
  }, [cards, activePack]);

  const pageById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const selectedId = activePack ? targetPageId(activePack.name, target) : "";
  const selectedPage = pageById.get(selectedId) ?? null;

  const scrollToPage = useCallback((next: Target) => {
    setTarget(next);
    setNotice(null);
    setMessage(null);
  }, []);

  const saved = (savedPage: DictionaryPage) => {
    setPages((previous) => [...previous.filter((page) => page.id !== savedPage.id), savedPage]);
    setNotice("Page saved.");
  };

  const revert = async () => {
    if (!activePack) return;
    try {
      const answer = await apiSend<{ deleted: boolean; page: DictionaryPage | null }>(
        `/api/pages/${encodeURIComponent(selectedId)}`,
        "DELETE",
      );
      setPages((previous) => [
        ...previous.filter((page) => page.id !== selectedId),
        ...(answer.page ? [answer.page] : []),
      ]);
      setNotice(
        answer.page ? "Your copy is gone. The shipped page is back." : "Your copy is gone.",
      );
    } catch (problem) {
      setMessage(problemText(problem, "That page could not be reverted."));
    }
  };

  const fallbackTitle = (() => {
    if (!activePack) return "";
    if (target.level === "pack") return activePack.name;
    if (target.level === "deck") {
      return (activePack.decks ?? []).find((deck) => deck.id === target.deckId)?.name ?? "Deck";
    }
    return cards.find((card) => card.id === target.cardId)?.summary ?? "Card";
  })();

  const editorDeckId =
    target.level === "deck"
      ? target.deckId
      : target.level === "card"
        ? cards.find((card) => card.id === target.cardId)?.deckId
        : undefined;

  if (!packs) return <p className="muted">Opening the course builder...</p>;

  if (packs.length === 0) {
    return (
      <section>
        <p className="eyebrow">Course Builder</p>
        <h1>No course material yet.</h1>
        <div className="empty" style={{ marginTop: 14 }}>
          <strong>The builder follows your packs.</strong> Import or create a pack first.
          <div className="row" style={{ marginTop: 10 }}>
            <Link className="btn small" href="/library">
              Open the library
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!activePack) return <p className="muted">Opening the course builder...</p>;

  const decks = activePack.decks ?? [];

  /** One tree row; the dot says whether its page exists. */
  const row = (options: {
    next: Target;
    label: string;
    detail?: string;
    className?: string;
  }) => {
    const id = targetPageId(activePack.name, options.next);
    const written = pageIsWritten(pageById.get(id) ?? null);
    const current = sameTarget(target, options.next);
    return (
      <button
        key={id}
        type="button"
        className={`builder-row${current ? " on" : ""}${options.className ? ` ${options.className}` : ""}`}
        aria-pressed={current}
        onClick={() => scrollToPage(options.next)}
      >
        <span className={`dict-dot${written ? " ok" : ""}`} aria-hidden="true" />
        <span className="builder-row-text">
          <span>{options.label}</span>
          {options.detail ? <span className="muted small">{options.detail}</span> : null}
        </span>
      </button>
    );
  };

  return (
    <section>
      <div className="split-head">
        <div>
          <p className="eyebrow">Course Builder</p>
          <h1 style={{ margin: "2px 0 0" }}>{activePack.name}</h1>
        </div>
        <div className="row">
          {packs.length > 1 ? (
            <label className="field-label" style={{ margin: 0 }}>
              Pack
              <select
                className="field"
                value={activePack.name}
                onChange={(event) =>
                  router.replace(`/builder?pack=${encodeURIComponent(event.target.value)}`)
                }
              >
                {packs.map((pack) => (
                  <option key={pack.name} value={pack.name}>
                    {pack.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Link className="btn small" href={targetHref(activePack.name, target)}>
            Read this page
          </Link>
        </div>
      </div>

      {message ? (
        <div className="notice error" style={{ marginTop: 10 }}>
          {message}
        </div>
      ) : null}
      {notice ? (
        <div className="notice" style={{ marginTop: 10 }} role="status">
          {notice}
        </div>
      ) : null}

      <div className="builder">
        <aside className="builder-tree" aria-label="Course pages">
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>
            Pages
          </p>
          {row({ next: { level: "pack" }, label: activePack.name, detail: "Course cover" })}
          {decks.map((deck) => (
            <div key={deck.id} className="builder-group">
              {row({
                next: { level: "deck", deckId: deck.id },
                label: deck.name,
                detail: "Deck cover",
              })}
              <div className="builder-cards">
                {deckCards(deck.id).map((card) =>
                  row({
                    next: { level: "card", cardId: card.id },
                    label: card.summary,
                    className: "builder-card-row",
                  }),
                )}
              </div>
            </div>
          ))}
          {unplaced.length > 0 ? (
            <div className="builder-group">
              <p className="eyebrow" style={{ margin: "10px 0 4px" }}>
                Cards without a deck
              </p>
              {unplaced.map((card) =>
                row({
                  next: { level: "card", cardId: card.id },
                  label: card.summary,
                  className: "builder-card-row",
                }),
              )}
            </div>
          ) : null}
        </aside>

        <div className="builder-editor">
          <PageEditor
            key={selectedId}
            level={target.level}
            packName={activePack.name}
            deckId={editorDeckId}
            cardId={target.level === "card" ? target.cardId : undefined}
            fallbackTitle={fallbackTitle}
            page={selectedPage}
            onSaved={saved}
            onCancel={() => setTarget({ level: "pack" })}
            onRevert={
              selectedPage?.learnerEdited && selectedPage.editedFromShipped
                ? () => void revert()
                : undefined
            }
          />
        </div>
      </div>
    </section>
  );
}
