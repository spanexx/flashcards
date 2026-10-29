"use client";

// WHY: One screen reads the whole course: a pack cover, a deck cover or one
// card's page, placed by the address. The shell owns loading, the deepest-view
// choice, traces and the inline editor, so the three views stay presentational.
// PACK: course-dictionary
// 2026-10-29 qoder: created for the course dictionary pack. [pack: course-dictionary]

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { cardPageId, deckPageId, packPageId } from "@/lib/core/pages";
import type { Card, Deck, DictionaryPage, PageTrace, PackStatus } from "@/lib/shared/types";
import CardPage from "./dictionary/CardPage";
import EntityPage from "./dictionary/EntityPage";
import PageEditor from "./dictionary/PageEditor";

/** The pages and traces one pack holds, as the router answers them. */
interface PackPagesAnswer {
  pages: DictionaryPage[];
  traces: PageTrace[];
  progress: { read: number; total: number };
}

function problemText(problem: unknown, fallback: string): string {
  return problem instanceof Error ? problem.message : fallback;
}

export default function DictionaryClient() {
  const router = useRouter();
  const search = useSearchParams();
  const packParam = search.get("pack")?.trim() ?? "";
  const deckParam = search.get("deck")?.trim() ?? "";
  const cardParam = search.get("card")?.trim() ?? "";

  const [packs, setPacks] = useState<PackStatus[] | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [pages, setPages] = useState<DictionaryPage[]>([]);
  const [traces, setTraces] = useState<PageTrace[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const pendingTraces = useRef(new Set<string>());

  // One read of the shelves; cards are needed to place a bare ?card= address.
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

  /**
   * The deepest place the address names. A card may arrive without its pack
   * (the library's book button knows only the card), so the card chooses it.
   */
  const activePack = useMemo(() => {
    if (!packs || packs.length === 0) return null;
    const named = packParam ? packs.find((pack) => pack.name === packParam) : undefined;
    if (named) return named;
    if (cardParam) {
      const card = cards.find((entry) => entry.id === cardParam);
      const owner = card?.packName ? packs.find((pack) => pack.name === card.packName) : undefined;
      if (owner) return owner;
    }
    if (deckParam) {
      const owner = packs.find((pack) => (pack.decks ?? []).some((deck) => deck.id === deckParam));
      if (owner) return owner;
    }
    return packs[0];
  }, [packs, cards, packParam, deckParam, cardParam]);

  // Keep the address honest, so a copied link and every breadcrumb agree.
  useEffect(() => {
    if (!activePack || packParam === activePack.name) return;
    const next = new URLSearchParams(search.toString());
    next.set("pack", activePack.name);
    router.replace(`/dictionary?${next.toString()}`);
  }, [activePack, packParam, router, search]);

  useEffect(() => {
    if (!activePack) return;
    let active = true;
    apiGet<PackPagesAnswer>(`/api/pages?pack=${encodeURIComponent(activePack.name)}`)
      .then((answer) => {
        if (!active) return;
        setPages(answer.pages);
        setTraces(answer.traces);
      })
      .catch((problem: unknown) => {
        if (active) setMessage(problemText(problem, "The pages could not be read."));
      });
    return () => {
      active = false;
    };
  }, [activePack, reloadToken]);

  const card = useMemo(() => {
    if (!activePack || !cardParam) return null;
    const found = cards.find((entry) => entry.id === cardParam && !entry.retired);
    if (!found || (found.packName && found.packName !== activePack.name)) return null;
    return found;
  }, [activePack, cards, cardParam]);

  const deck = useMemo<Deck | null>(() => {
    if (!activePack) return null;
    if (card?.deckId) {
      return (activePack.decks ?? []).find((entry) => entry.id === card.deckId) ?? null;
    }
    if (!deckParam) return null;
    return (activePack.decks ?? []).find((entry) => entry.id === deckParam) ?? null;
  }, [activePack, card, deckParam]);

  const level = card ? "card" : deck ? "deck" : "pack";
  const pageId = !activePack
    ? ""
    : card
      ? cardPageId(card.id)
      : deck
        ? deckPageId(activePack.name, deck.id)
        : packPageId(activePack.name);
  const page = pages.find((entry) => entry.id === pageId) ?? null;
  const trace = traces.find((entry) => entry.id === pageId) ?? null;

  // A traced part is a hint, never a score: it is written once and kept.
  const recordTrace = useCallback(
    (index: number) => {
      const id = page?.id;
      if (!id) return;
      const key = `${id}:${index}`;
      if (pendingTraces.current.has(key)) return;
      pendingTraces.current.add(key);
      apiSend<{ trace: PageTrace }>(`/api/pages/${encodeURIComponent(id)}/traced`, "POST", { index })
        .then((answer) => {
          setTraces((previous) => [
            ...previous.filter((entry) => entry.id !== answer.trace.id),
            answer.trace,
          ]);
        })
        .catch((problem: unknown) => {
          setMessage(problemText(problem, "That part could not be marked as read."));
        })
        .finally(() => {
          pendingTraces.current.delete(key);
        });
    },
    [page?.id],
  );

  const openEditor = () => {
    setEditing(true);
    setMessage(null);
    setNotice(null);
  };

  const saved = (savedPage: DictionaryPage) => {
    setPages((previous) => [...previous.filter((entry) => entry.id !== savedPage.id), savedPage]);
    setEditing(false);
    setNotice("Page saved.");
    setReloadToken((value) => value + 1);
  };

  const revert = async () => {
    if (!page) return;
    try {
      const answer = await apiSend<{ deleted: boolean; page: DictionaryPage | null }>(
        `/api/pages/${encodeURIComponent(page.id)}`,
        "DELETE",
      );
      setPages((previous) => [
        ...previous.filter((entry) => entry.id !== page.id),
        ...(answer.page ? [answer.page] : []),
      ]);
      setTraces((previous) => previous.filter((entry) => entry.id !== page.id));
      setEditing(false);
      setNotice(
        answer.page
          ? "Your copy is gone. The shipped page is back."
          : "Your copy is gone.",
      );
    } catch (problem) {
      setMessage(problemText(problem, "That page could not be reverted."));
    }
  };

  if (!packs) return <p className="muted">Opening the dictionary...</p>;

  if (packs.length === 0) {
    return (
      <section>
        <p className="eyebrow">Dictionary</p>
        <h1>No course material yet.</h1>
        <div className="empty" style={{ marginTop: 14 }}>
          <strong>The dictionary follows your packs.</strong> Import or create a pack, then write
          the story behind it here.
          <div className="row" style={{ marginTop: 10 }}>
            <Link className="btn small" href="/library">
              Open the library
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!activePack) return <p className="muted">Opening the dictionary...</p>;

  const deckName = deck?.name;
  const editor = editing ? (
    <PageEditor
      key={`${level}:${pageId}`}
      level={level}
      packName={activePack.name}
      deckId={level === "deck" ? deck?.id : card?.deckId}
      cardId={card?.id}
      fallbackTitle={card?.summary ?? deckName ?? activePack.name}
      page={page}
      onSaved={saved}
      onCancel={() => setEditing(false)}
      onRevert={page?.learnerEdited && page.editedFromShipped ? () => void revert() : undefined}
    />
  ) : null;

  return (
    <section>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          Dictionary
        </p>
        <Link
          className="btn small"
          href={`/builder?pack=${encodeURIComponent(activePack.name)}`}
        >
          Course Builder
        </Link>
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

      <div style={{ marginTop: 6 }}>
        {editor ??
          (card ? (
            <CardPage
              page={page}
              trace={trace}
              card={card}
              packName={activePack.name}
              deckId={deck?.id ?? card.deckId}
              deckName={deckName}
              language={activePack.language}
              onTraced={recordTrace}
              onEdit={openEditor}
            />
          ) : deck ? (
            <EntityPage
              level="deck"
              pack={activePack}
              deck={deck}
              page={page}
              cards={cards}
              pages={pages}
              onEdit={openEditor}
            />
          ) : (
            <EntityPage
              level="pack"
              pack={activePack}
              page={page}
              cards={cards}
              pages={pages}
              onEdit={openEditor}
            />
          ))}
      </div>
    </section>
  );
}
