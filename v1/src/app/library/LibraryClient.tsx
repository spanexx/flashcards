"use client";

// WHY: Library has three jobs now. Packs browses, Cards manages, and Create is
// the only place that writes. The shell owns the loaded library, the tab, the
// short notices and the record drawer; each panel owns its own form.
// PACK: library-create-flow
// 2026-10-21 opencode: rebuilt as a three-tab shell around Packs, Cards and
// Create panels, with typed-name delete and after-create navigation
// [pack: library-create-flow]
// 2026-10-23 opencode: finished jobs refresh the shelves, and a job View link
// focuses the affected pack/deck without a reload. [pack: background-jobs]

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { onJobFinished } from "@/lib/browser/jobs";
import { LIBRARY_FOCUS_EVENT, type LibraryFocus } from "@/lib/client/library-focus";
import type { Card, PackStatus, ProviderStatus } from "@/lib/shared/types";
import CardsPanel from "./CardsPanel";
import CreatePanel from "./CreatePanel";
import DeleteDialog from "./DeleteDialog";
import PacksPanel from "./PacksPanel";
import RecordDrawer, { type EvidenceAnswer } from "./RecordDrawer";
import {
  createDestination,
  packDecks,
  type CardFocus,
  type CreateResult,
  type CreateSeed,
  type DeleteTarget,
  type LibraryTab,
} from "./library-utils";

export default function LibraryClient() {
  const [packs, setPacks] = useState<PackStatus[]>([]);
  const [orphans, setOrphans] = useState<string[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<LibraryTab>("packs");
  const [evidence, setEvidence] = useState<EvidenceAnswer | null>(null);
  const [packsFocus, setPacksFocus] = useState<{ packName: string; token: number } | null>(null);
  const [cardFocus, setCardFocus] = useState<(CardFocus & { token: number }) | null>(null);
  const [createSeed, setCreateSeed] = useState<CreateSeed | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<string | undefined>(undefined);

  // One read gets the three panels everything they need to stay honest.
  const refresh = useCallback(async () => {
    try {
      const [packsAnswer, cardsAnswer, settingsAnswer] = await Promise.all([
        apiGet<{ packs: PackStatus[]; orphans: string[]; folder: string }>("/api/packs"),
        apiGet<{ cards: Card[] }>("/api/cards"),
        apiGet<{ provider: ProviderStatus }>("/api/settings"),
      ]);
      setPacks(packsAnswer.packs);
      setOrphans(packsAnswer.orphans);
      setCards(cardsAnswer.cards);
      setProvider(settingsAnswer.provider);
      setMessage(null);
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "The library could not be read.");
    }
  }, []);

  // The first load happens once; the cleanup only marks the promise as handled.
  useEffect(() => {
    const pending = Promise.resolve().then(() => refresh());
    return () => {
      void pending;
    };
  }, [refresh]);

  // A record link from Study opens the Cards tab and the card's drawer.
  const openEvidence = useCallback(async (cardId: string) => {
    try {
      const data = await apiGet<EvidenceAnswer>(`/api/evidence?cardId=${encodeURIComponent(cardId)}`);
      setEvidence(data);
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "The record could not be read.");
    }
  }, []);

  useEffect(() => {
    const pending = Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const wantedCard = params.get("card");
      if (wantedCard) {
        setTab("cards");
        void openEvidence(wantedCard);
        return;
      }
      const wantedPack = params.get("pack");
      const wantedDeck = params.get("deck");
      if (wantedPack && wantedDeck) {
        setTab("cards");
        setCardFocus({ packName: wantedPack, deckId: wantedDeck, token: Date.now() });
        return;
      }
      if (wantedPack) {
        setTab("packs");
        setPacksFocus({ packName: wantedPack, token: Date.now() });
      }
    });
    return () => {
      void pending;
    };
  }, [openEvidence]);

  // A completed job writes behind the screen. Refresh the packs/cards, but only
  // when the job actually succeeded; a failure has nothing new to show.
  useEffect(
    () =>
      onJobFinished((job) => {
        if (job.status === "succeeded") void refresh();
      }),
    [refresh],
  );

  // A View link from the global job dock can point at a Library that is
  // already mounted. Focus it without reloading the page and stopping work.
  useEffect(() => {
    const focus = (event: Event) => {
      const detail = (event as CustomEvent<LibraryFocus>).detail;
      if (!detail?.packName) return;
      if (detail.deckId) {
        setTab("cards");
        setCardFocus({ packName: detail.packName, deckId: detail.deckId, token: Date.now() });
        return;
      }
      setTab("packs");
      setPacksFocus({ packName: detail.packName, token: Date.now() });
    };
    window.addEventListener(LIBRARY_FOCUS_EVENT, focus);
    return () => window.removeEventListener(LIBRARY_FOCUS_EVENT, focus);
  }, []);

  // Refresh reads every pack again and keeps the list honest after a change.
  const rescan = useCallback(async () => {
    try {
      const data = await apiSend<{ packs: PackStatus[]; orphans: string[]; folder: string }>("/api/packs/rescan", "POST");
      setPacks(data.packs);
      setOrphans(data.orphans);
      setNotice("The library was refreshed.");
      const cardsAnswer = await apiGet<{ cards: Card[] }>("/api/cards");
      setCards(cardsAnswer.cards);
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "The library could not be refreshed.");
    }
  }, []);

  // After a create, the result chooses the destination; the panel already built the notice.
  const created = useCallback(
    (result: CreateResult, createdNotice: string) => {
      const destination = createDestination(result);
      if (destination.tab === "packs") {
        setPacksFocus({ packName: destination.packName, token: Date.now() });
      } else if (destination.deckId) {
        setCardFocus({ packName: destination.packName, deckId: destination.deckId, token: Date.now() });
      }
      setTab(destination.tab);
      setNotice(createdNotice);
      void refresh();
    },
    [refresh],
  );

  // Packs can send the learner to Create with a target and method already chosen.
  const createPack = () => {
    setCreateSeed({ target: "pack", method: "write", token: Date.now() });
    setTab("create");
  };

  // Add cards from an expanded deck lands in Create → Cards → Write, preselecting both parents.
  const addCardsTo = (packName: string, deckId: string) => {
    setCreateSeed({ target: "cards", method: "write", packName, deckId, token: Date.now() });
    setTab("create");
  };

  // A delete asks for the visible name; the last deck is refused before the route.
  const askDelete = (target: DeleteTarget) => {
    const pack = target.kind === "deck" ? packs.find((entry) => entry.name === target.packName) : null;
    const lastDeck = target.kind === "deck" && pack ? packDecks(pack).length <= 1 : false;
    setDeleteBlocked(
      lastDeck ? "A pack must keep at least one deck. Delete the pack instead." : undefined,
    );
    setDeleteTarget(target);
  };

  // Confirming removes the pack or deck and keeps its reported counts in the notice.
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const data =
      deleteTarget.kind === "pack"
        ? await apiSend<{ removedDecks: number; removedCards: number; removedEvidenceRows: number }>(
            `/api/packs/${encodeURIComponent(deleteTarget.packName)}`,
            "DELETE",
          )
        : await apiSend<{ removedDecks: number; removedCards: number; removedEvidenceRows: number }>(
            `/api/packs/${encodeURIComponent(deleteTarget.packName)}/decks/${encodeURIComponent(deleteTarget.deckId)}`,
            "DELETE",
          );
    const removed = deleteTarget;
    setDeleteTarget(null);
    setDeleteBlocked(undefined);
    setNotice(
      removed.kind === "pack"
        ? `Deleted pack "${removed.packName}", ${data.removedDecks} deck(s), ${data.removedCards} card(s) and ${data.removedEvidenceRows} record row(s).`
        : `Deleted deck "${removed.deckName}", ${data.removedCards} card(s) and ${data.removedEvidenceRows} record row(s).`,
    );
    // Removing one deck keeps the pack open; only a removed pack loses its focus.
    setPacksFocus((previous) =>
      removed.kind === "pack" && previous?.packName === removed.packName ? null : previous,
    );
    setCardFocus((previous) => {
      if (!previous) return previous;
      if (removed.kind === "pack") return previous.packName === removed.packName ? null : previous;
      return previous.packName === removed.packName && previous.deckId === removed.deckId ? null : previous;
    });
    if (evidence?.card.packName === removed.packName) setEvidence(null);
    await refresh();
  };

  // Removing one card also closes its drawer if that card was open.
  const cardRemoved = (cardId: string) => {
    if (evidence?.card.id === cardId) setEvidence(null);
  };

  return (
    <div>
      <h1>Library</h1>
      <p className="lead">Packs, cards and their record live in this browser. Nothing is sent to a server.</p>

      {message ? <div className="notice error">{message}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <div className="tabs" role="tablist" aria-label="Library">
        <button className="tab" type="button" role="tab" aria-selected={tab === "packs"} onClick={() => setTab("packs")}>
          Packs
        </button>
        <button className="tab" type="button" role="tab" aria-selected={tab === "cards"} onClick={() => setTab("cards")}>
          Cards
        </button>
        <button className="tab" type="button" role="tab" aria-selected={tab === "create"} onClick={() => setTab("create")}>
          Create
        </button>
      </div>

      {tab === "packs" ? (
        <PacksPanel
          key={`packs-${packsFocus?.token ?? "initial"}`}
          packs={packs}
          cards={cards}
          orphans={orphans}
          initialOpen={packsFocus?.packName ?? null}
          onCreatePack={createPack}
          onAddCards={addCardsTo}
          onDelete={askDelete}
          onRefresh={rescan}
          onError={setMessage}
          onNotice={setNotice}
        />
      ) : null}

      {tab === "cards" ? (
        <CardsPanel
          key={`cards-${cardFocus?.token ?? "initial"}`}
          cards={cards}
          packs={packs}
          focus={cardFocus}
          onOpenRecord={(cardId) => void openEvidence(cardId)}
          onCardRemoved={cardRemoved}
          onChanged={refresh}
          onError={setMessage}
          onNotice={setNotice}
        />
      ) : null}

      {tab === "create" ? (
        <CreatePanel
          key={`create-${createSeed?.token ?? "initial"}`}
          packs={packs}
          provider={provider}
          seed={createSeed}
          onCreated={created}
          onError={setMessage}
          onNotice={setNotice}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteDialog
          key={`${deleteTarget.kind}-${deleteTarget.packName}-${deleteTarget.kind === "deck" ? deleteTarget.deckId : ""}`}
          target={deleteTarget}
          blockedReason={deleteBlocked}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteBlocked(undefined);
          }}
          onConfirm={confirmDelete}
        />
      ) : null}

      {evidence ? <RecordDrawer evidence={evidence} onClose={() => setEvidence(null)} /> : null}
    </div>
  );
}
