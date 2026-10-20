"use client";

// WHY: Packs come and go; the learner's cards stay. This screen shows both
// sides honestly: what loaded, what broke and why, and the evidence behind
// every card the learner can look at. Tabs keep four jobs - packs, cards,
// generation and chat authoring - from becoming one long wall.
// PACK: browser-app
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]
// 2026-10-19 opencode: tabbed shell and record drawer [pack: v1-prototype]
// 2026-10-20 opencode: browser pack/deck targets, chat answer path [pack: browser-app]
// 2026-10-20 opencode: fold pack create/import into small tabs; taller card list [pack: browser-app]
// 2026-10-20 opencode: search packs and cards; taller pack list [pack: browser-app]

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend, ApiError } from "@/lib/client/api";
import { OUTCOME_LABELS, OUTCOME_MEANINGS } from "@/lib/core/outcome";
import type { Card, Outcome, PackStatus, ProviderStatus } from "@/lib/shared/types";

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
}

/** The attempts and rows the evidence endpoint returns. */
interface EvidenceAnswer {
  card: Card;
  rows: Array<{
    id: string;
    attemptId: string;
    region: string | null;
    outcome: Outcome;
    kind: "answer" | "correction";
    supersedes?: string;
    at: string;
  }>;
  attempts: RecordAttempt[];
}

/** Plain text of a card side, with blanks shown as underlines. */
function plainText(parts: Card["prompt"]): string {
  return parts
    .map((part) => {
      if (part.type === "text" || part.type === "code" || part.type === "speak") return part.text;
      if (part.type === "blank") return "___";
      return part.alt ?? "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function errorLines(error: unknown): string[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.detail)) return [];
  return error.detail
    .map((item) => {
      if (item && typeof item === "object") {
        const record = item as { field?: unknown; message?: unknown };
        const message = typeof record.message === "string" ? record.message : null;
        const field = typeof record.field === "string" ? record.field : null;
        if (message) return field ? `${field}: ${message}` : message;
      }
      return null;
    })
    .filter((line): line is string => line !== null);
}

type LibraryTab = "packs" | "add" | "generate" | "chat";
type AddMode = "none" | "write" | "import";

/** A deck picker value names its pack too, because deck ids repeat across packs. */
interface DeckChoice {
  value: string;
  id: string;
  name: string;
  pack: string;
}

function deckValue(packName: string, deckId: string): string {
  return `${packName}::${deckId}`;
}

function readDeckValue(value: string): { packName: string; deckId: string } | null {
  const at = value.indexOf("::");
  if (at < 1) return null;
  return { packName: value.slice(0, at), deckId: value.slice(at + 2) };
}

/** Decks as one flat list, with their pack name, for a simple picker. */
function deckChoices(packs: PackStatus[]): DeckChoice[] {
  const choices: DeckChoice[] = [];
  for (const pack of packs) {
    if (pack.error) continue;
    const decks = pack.decks ?? pack.topics.map((topic) => ({ id: topic, name: topic }));
    for (const deck of decks) {
      choices.push({ value: deckValue(pack.name, deck.id), id: deck.id, name: deck.name, pack: pack.name });
    }
  }
  return choices;
}

/** Ignore case and Polish marks so "samochod" still finds "samochód". */
function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Search the words a learner can see, not internal ids alone. */
function cardMatches(card: Card, query: string): boolean {
  const sides = [...card.prompt, ...card.answer].map((part) => ("text" in part ? part.text : ""));
  const haystack = [
    card.summary,
    card.packName ?? "",
    card.deckId ?? "",
    ...card.topics,
    ...card.tags,
    ...sides,
    ...(card.hints ?? []),
  ].join(" ");
  return searchable(haystack).includes(query);
}

/** Search pack metadata and its deck names, so the list narrows in plain words. */
function packMatches(pack: PackStatus, query: string): boolean {
  const decks = pack.decks ?? pack.topics.map((topic) => ({ id: topic, name: topic }));
  const haystack = [
    pack.name,
    pack.version,
    pack.description ?? "",
    ...decks.flatMap((deck) => [deck.id, deck.name]),
  ].join(" ");
  return searchable(haystack).includes(query);
}

export default function LibraryClient() {
  const [packs, setPacks] = useState<PackStatus[]>([]);
  const [orphans, setOrphans] = useState<string[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<LibraryTab>("packs");
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [packMode, setPackMode] = useState<"none" | "create" | "import">("none");
  const [packSearch, setPackSearch] = useState("");
  const [cardSearch, setCardSearch] = useState("");

  const [form, setForm] = useState({ front: "", back: "", deckId: "", summary: "", mode: "auto", options: "" });
  const [importText, setImportText] = useState("");
  const [importDeckId, setImportDeckId] = useState("");
  const [bundleText, setBundleText] = useState("");
  const [bundleKind, setBundleKind] = useState<"new" | "pack" | "deck">("new");
  const [bundlePack, setBundlePack] = useState("");
  const [bundleDeckId, setBundleDeckId] = useState("");
  const [chatKind, setChatKind] = useState<"new" | "pack" | "deck">("deck");
  const [chatPack, setChatPack] = useState("");
  const [chatDeck, setChatDeck] = useState("");
  const [chatName, setChatName] = useState("my-pack");
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [packForm, setPackForm] = useState({
    name: "",
    version: "1.0.0",
    deckName: "Basics",
    deckId: "basics",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ front: "", back: "", topics: "", summary: "" });
  const [evidence, setEvidence] = useState<EvidenceAnswer | null>(null);
  const [generate, setGenerate] = useState<{ packName: string; topic: string; count: number }>({
    packName: "",
    topic: "",
    count: 5,
  });
  const [prepared, setPrepared] = useState<{ requestId: string; prompt: string } | null>(null);

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
      setGenerate((previous) => {
        const loaded = packsAnswer.packs.filter((pack) => !pack.error);
        const packName = previous.packName || loaded[0]?.name || "";
        const pack = loaded.find((entry) => entry.name === packName);
        const topic = previous.topic || pack?.topics[0] || "";
        return { packName, topic, count: previous.count };
      });
      const choices = deckChoices(packsAnswer.packs);
      const firstValue = choices[0]?.value ?? "";
      const known = (value: string) => choices.some((choice) => choice.value === value);
      setForm((previous) => ({ ...previous, deckId: known(previous.deckId) ? previous.deckId : firstValue }));
      setImportDeckId((previous) => (known(previous) ? previous : firstValue));
      setBundleDeckId((previous) => (known(previous) ? previous : firstValue));
      setBundlePack((previous) => previous || packsAnswer.packs.find((pack) => !pack.error)?.name || "");
      setChatPack((previous) => previous || packsAnswer.packs.find((pack) => !pack.error)?.name || "");
      setChatDeck((previous) => (known(previous) ? previous : firstValue));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The library could not be read.");
    }
  }, []);

  useEffect(() => {
    const pending = Promise.resolve().then(() => refresh());
    return () => {
      void pending;
    };
  }, [refresh]);

  const openEvidence = useCallback(async (cardId: string) => {
    try {
      const data = await apiGet<EvidenceAnswer>(`/api/evidence?cardId=${encodeURIComponent(cardId)}`);
      setEvidence(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The record could not be read.");
    }
  }, []);

  useEffect(() => {
    const pending = Promise.resolve().then(() => {
      const wanted = new URLSearchParams(window.location.search).get("card");
      if (wanted) {
        setTab("add");
        void openEvidence(wanted);
      }
    });
    return () => {
      void pending;
    };
  }, [openEvidence]);

  const rescan = useCallback(async () => {
    try {
      const data = await apiSend<{ packs: PackStatus[]; orphans: string[]; folder: string }>(
        "/api/packs/rescan",
        "POST",
      );
      setPacks(data.packs);
      setOrphans(data.orphans);
      setNotice("The library was refreshed.");
      const cardsAnswer = await apiGet<{ cards: Card[] }>("/api/cards");
      setCards(cardsAnswer.cards);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The library could not be refreshed.");
    }
  }, []);

  const writeCard = useCallback(async () => {
    setMessage(null);
    setNotice(null);
    try {
      const placement = readDeckValue(form.deckId);
      if (!placement) throw new Error("Choose the deck this card belongs to.");
      const options = form.options.split(",").map((option) => option.trim()).filter((option) => option.length > 0);
      await apiSend("/api/cards", "POST", {
        front: form.front,
        back: form.back,
        summary: form.summary || undefined,
        packName: placement.packName,
        deckId: placement.deckId,
        mode: form.mode,
        options: form.mode === "picks" ? options : undefined,
      });
      setForm((previous) => ({ front: "", back: "", deckId: previous.deckId, summary: "", mode: "auto", options: "" }));
      setNotice("The card was added.");
      const cardsAnswer = await apiGet<{ cards: Card[] }>("/api/cards");
      setCards(cardsAnswer.cards);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The card could not be saved.");
      for (const line of errorLines(error)) setNotice(line);
    }
  }, [form]);

  const beginEdit = useCallback((card: Card) => {
    setEditingId(card.id);
    setEditForm({
      front: plainText(card.prompt),
      back: plainText(card.answer),
      topics: card.topics.join(", "),
      summary: card.summary,
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setMessage(null);
    try {
      const topics = editForm.topics.split(",").map((topic) => topic.trim()).filter((topic) => topic.length > 0);
      await apiSend(`/api/cards/${encodeURIComponent(editingId)}`, "PATCH", {
        front: editForm.front,
        back: editForm.back,
        topics,
        summary: editForm.summary || undefined,
      });
      setEditingId(null);
      setNotice("The card was replaced with an edited copy. The old one is kept in the record.");
      const cardsAnswer = await apiGet<{ cards: Card[] }>("/api/cards");
      setCards(cardsAnswer.cards);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The edit could not be saved.");
    }
  }, [editForm, editingId]);

  const removeCard = useCallback(
    async (cardId: string) => {
      if (!window.confirm("Delete this card and its record? This cannot be undone.")) return;
      setMessage(null);
      try {
        const data = await apiSend<{ removedEvidenceRows: number }>(
          `/api/cards/${encodeURIComponent(cardId)}`,
          "DELETE",
        );
        setNotice(`The card was deleted, along with ${data.removedEvidenceRows} record rows.`);
        if (evidence?.card.id === cardId) setEvidence(null);
        const cardsAnswer = await apiGet<{ cards: Card[] }>("/api/cards");
        setCards(cardsAnswer.cards);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The card could not be deleted.");
      }
    },
    [evidence],
  );

  const runImport = useCallback(async () => {
    setMessage(null);
    setNotice(null);
    try {
      const placement = readDeckValue(importDeckId);
      if (!placement) throw new Error("Choose the deck these cards belong to.");
      const data = await apiSend<{ imported: number; duplicates: number }>("/api/cards/import", "POST", {
        json: importText,
        packName: placement.packName,
        deckId: placement.deckId,
      });
      setNotice(`Imported ${data.imported} card(s); ${data.duplicates} were already in the deck.`);
      setImportText("");
      const cardsAnswer = await apiGet<{ cards: Card[] }>("/api/cards");
      setCards(cardsAnswer.cards);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The import could not be read.");
      const lines = errorLines(error);
      if (lines.length > 0) setNotice(lines.join(" · "));
    }
  }, [importDeckId, importText]);

  const runBundleImport = useCallback(async () => {
    setMessage(null);
    setNotice(null);
    try {
      const target =
        bundleKind === "new"
          ? { kind: "new" as const }
          : bundleKind === "pack"
            ? bundlePack
              ? { kind: "pack" as const, packName: bundlePack }
              : null
            : (() => {
                const placement = readDeckValue(bundleDeckId);
                return placement ? { kind: "deck" as const, ...placement } : null;
              })();
      if (!target) throw new Error("Choose the pack or deck this file should join.");
      const data = await apiSend<{ cardsAdded: number; decksAdded: number; duplicates: number }>("/api/packs/import", "POST", {
        json: bundleText,
        target,
      });
      setNotice(`Imported ${data.cardsAdded} card(s) and ${data.decksAdded} deck(s); ${data.duplicates} were already here.`);
      setBundleText("");
      setPackMode("none");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The bundle could not be imported.");
      const lines = errorLines(error);
      if (lines.length > 0) setNotice(lines.join(" · "));
    }
  }, [bundleDeckId, bundleKind, bundlePack, bundleText, refresh]);

  const exportPack = useCallback(async (name: string) => {
    setMessage(null);
    try {
      const data = await apiGet<{ json: string }>(`/api/packs/export?name=${encodeURIComponent(name)}`);
      const blob = new Blob([data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${name}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice(`Exported ${name}. Learner evidence stays out of the file.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The pack could not be exported.");
    }
  }, []);

  const createPack = useCallback(async () => {
    setMessage(null);
    setNotice(null);
    try {
      await apiSend("/api/packs", "POST", packForm);
      const createdPack = packForm.name.trim();
      const createdDeck = deckValue(createdPack, packForm.deckId);
      setForm((previous) => ({ ...previous, deckId: createdDeck }));
      setImportDeckId(createdDeck);
      setChatPack(createdPack);
      setChatDeck(createdDeck);
      setGenerate((previous) => ({ ...previous, packName: createdPack, topic: packForm.deckName }));
      setNotice(`The pack "${createdPack}" was created with one deck.`);
      setPackForm({ name: "", version: "1.0.0", deckName: "Basics", deckId: "basics" });
      setPackMode("none");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The pack could not be created.");
      const lines = errorLines(error);
      if (lines.length > 0) setNotice(lines.join(" · "));
    }
  }, [packForm, refresh]);

  const prepareAuthoringPrompt = useCallback(async () => {
    setMessage(null);
    setChatPrompt("");
    try {
      const target =
        chatKind === "new"
          ? { kind: "new", name: chatName.trim() || "my-pack" }
          : chatKind === "pack"
            ? { kind: "pack", packName: chatPack }
            : (() => {
                const placement = readDeckValue(chatDeck);
                return placement ? { kind: "deck", ...placement } : null;
              })();
      if (!target) throw new Error("Choose the deck the chat should add to.");
      const data = await apiSend<{ prompt: string }>("/api/authoring/prompt", "POST", { target });
      setChatPrompt(data.prompt);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The authoring prompt could not be built.");
    }
  }, [chatDeck, chatKind, chatName, chatPack]);

  const copyAuthoringPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(chatPrompt);
      setNotice("The authoring prompt was copied. Paste the chat's JSON answer below.");
    } catch {
      setMessage("The prompt could not be copied automatically. Select it and copy by hand.");
    }
  }, [chatPrompt]);

  const downloadAuthoringPrompt = useCallback(() => {
    const blob = new Blob([chatPrompt], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flashcards-authoring-prompt.md";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("The authoring prompt was downloaded.");
  }, [chatPrompt]);

  const importChatAnswer = useCallback(async () => {
    setMessage(null);
    setNotice(null);
    try {
      const target =
        chatKind === "new"
          ? { kind: "new" as const }
          : chatKind === "pack"
            ? { kind: "pack" as const, packName: chatPack }
            : (() => {
                const placement = readDeckValue(chatDeck);
                return placement ? { kind: "deck" as const, ...placement } : null;
              })();
      if (!target) throw new Error("Choose the deck this answer should join.");
      const data = await apiSend<{ cardsAdded: number; decksAdded: number; duplicates: number }>(
        "/api/packs/import",
        "POST",
        { json: chatAnswer, target },
      );
      setNotice(
        `Imported ${data.cardsAdded} card(s) and ${data.decksAdded} deck(s); ${data.duplicates} were already here.`,
      );
      setChatAnswer("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The chat's answer could not be imported.");
      const lines = errorLines(error);
      if (lines.length > 0) setNotice(lines.join(" · "));
    }
  }, [chatAnswer, chatDeck, chatKind, chatPack, refresh]);

  const prepareGeneration = useCallback(async () => {
    setMessage(null);
    setPrepared(null);
    try {
      const data = await apiSend<{ requestId: string; prompt: string }>("/api/provider/prepare", "POST", generate);
      setPrepared({ requestId: data.requestId, prompt: data.prompt });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The prompt could not be prepared.");
    }
  }, [generate]);

  const copyPrompt = useCallback(async () => {
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText(prepared.prompt);
      setNotice("The prompt was copied.");
    } catch {
      setMessage("The prompt could not be copied automatically. Select the text and copy it by hand.");
    }
  }, [prepared]);

  const sendGeneration = useCallback(async () => {
    if (!prepared) return;
    setMessage(null);
    try {
      const data = await apiSend<{ cards: Card[] }>("/api/provider/generate", "POST", {
        requestId: prepared.requestId,
      });
      setNotice(`The provider wrote ${data.cards.length} card(s).`);
      setPrepared(null);
      const cardsAnswer = await apiGet<{ cards: Card[] }>("/api/cards");
      setCards(cardsAnswer.cards);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The cards could not be generated.");
      setPrepared(null);
    }
  }, [prepared]);

  const active = cards.filter((card) => !card.retired);
  const retired = cards.filter((card) => card.retired);
  const packQuery = searchable(packSearch.trim());
  const cardQuery = searchable(cardSearch.trim());
  const shownPacks = packQuery ? packs.filter((pack) => packMatches(pack, packQuery)) : packs;
  const shownCards = cardQuery ? active.filter((card) => cardMatches(card, cardQuery)) : active;
  const shownRetired = cardQuery ? retired.filter((card) => cardMatches(card, cardQuery)) : retired;
  const packTopics = packs.find((pack) => pack.name === generate.packName && !pack.error)?.topics ?? [];
  const choices = deckChoices(packs);
  const chatDecks = choices.filter((choice) => choice.pack === chatPack);

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
        <button className="tab" type="button" role="tab" aria-selected={tab === "add"} onClick={() => setTab("add")}>
          Add cards
        </button>
        <button
          className="tab"
          type="button"
          role="tab"
          aria-selected={tab === "generate"}
          onClick={() => setTab("generate")}
        >
          Generate
        </button>
        <button
          className="tab"
          type="button"
          role="tab"
          aria-selected={tab === "chat"}
          onClick={() => setTab("chat")}
        >
          Create with a chat
        </button>
      </div>

      {tab === "packs" ? (
        <div>
          <div className="card tight">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="row" style={{ flex: "1 1 18rem" }}>
                <span className="muted">
                  {packQuery
                    ? `${shownPacks.length} of ${packs.length} packs`
                    : packs.length === 1
                      ? "1 pack"
                      : `${packs.length} packs`}
                </span>
                <input
                  className="field search-field"
                  type="search"
                  aria-label="Search packs"
                  placeholder="Search packs"
                  value={packSearch}
                  onChange={(event) => setPackSearch(event.target.value)}
                />
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn small"
                  type="button"
                  aria-pressed={packMode === "create"}
                  onClick={() => setPackMode(packMode === "create" ? "none" : "create")}
                >
                  New pack
                </button>
                <button
                  className="btn small"
                  type="button"
                  aria-pressed={packMode === "import"}
                  onClick={() => setPackMode(packMode === "import" ? "none" : "import")}
                >
                  Import
                </button>
                <button className="btn small" type="button" onClick={() => void rescan()}>
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {packMode === "create" ? (
            <div className="card stack compact-panel">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>New pack</h2>
                <button className="btn small" type="button" onClick={() => setPackMode("none")}>
                  Close
                </button>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Starts with one deck. Cards can stay empty.
              </p>
              <div className="row">
                <input
                  className="field"
                  style={{ flex: "2 1 11rem" }}
                  placeholder="Pack name"
                  value={packForm.name}
                  onChange={(event) => setPackForm((previous) => ({ ...previous, name: event.target.value }))}
                />
                <input
                  className="field"
                  style={{ flex: "0 1 6rem" }}
                  placeholder="Version"
                  value={packForm.version}
                  onChange={(event) => setPackForm((previous) => ({ ...previous, version: event.target.value }))}
                />
                <input
                  className="field"
                  style={{ flex: "2 1 10rem" }}
                  placeholder="First deck name"
                  value={packForm.deckName}
                  onChange={(event) => setPackForm((previous) => ({ ...previous, deckName: event.target.value }))}
                />
                <input
                  className="field"
                  style={{ flex: "1 1 8rem" }}
                  placeholder="Deck id (lowercase)"
                  value={packForm.deckId}
                  onChange={(event) => setPackForm((previous) => ({ ...previous, deckId: event.target.value }))}
                />
                <button className="btn primary" type="button" onClick={() => void createPack()} disabled={!packForm.name.trim()}>
                  Create pack
                </button>
              </div>
            </div>
          ) : null}

          {packMode === "import" ? (
            <div className="card stack compact-panel">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>Import a bundle</h2>
                <button className="btn small" type="button" onClick={() => setPackMode("none")}>
                  Close
                </button>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                JSON bundle: a whole pack, decks, or cards. The whole file is checked before saving.
              </p>
              <div className="row">
                <select
                  className="field"
                  value={bundleKind}
                  onChange={(event) => setBundleKind(event.target.value as "new" | "pack" | "deck")}
                >
                  <option value="new">Whole pack</option>
                  <option value="pack">Decks into a pack</option>
                  <option value="deck">Cards into a deck</option>
                </select>
                {bundleKind === "pack" ? (
                  <select className="field" value={bundlePack} onChange={(event) => setBundlePack(event.target.value)}>
                    {packs.filter((pack) => !pack.error).map((pack) => (
                      <option key={pack.name} value={pack.name}>
                        {pack.name} · {pack.version}
                      </option>
                    ))}
                  </select>
                ) : null}
                {bundleKind === "deck" ? (
                  <select className="field" value={bundleDeckId} onChange={(event) => setBundleDeckId(event.target.value)}>
                    {choices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.pack} · {choice.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  className="field"
                  style={{ flex: "1 1 13rem" }}
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void file.text().then((text) => setBundleText(text));
                  }}
                />
              </div>
              <textarea
                className="answer-input"
                rows={4}
                placeholder='{"schema":"flashcards.pack/v1","pack":{"name":"my-pack","version":"1.0.0"},"decks":[...],"cards":[...]}'
                value={bundleText}
                onChange={(event) => setBundleText(event.target.value)}
              />
              <div>
                <button className="btn primary" type="button" onClick={() => void runBundleImport()} disabled={!bundleText.trim()}>
                  Import bundle
                </button>
              </div>
            </div>
          ) : null}

          {packs.length === 0 ? (
            <p className="muted">No packs yet. Use New pack, Import, or Create with a chat.</p>
          ) : shownPacks.length === 0 ? (
            <p className="muted">No packs match &quot;{packSearch.trim()}&quot;.</p>
          ) : (
            <div className="scroll-area pack-list">
              <table>
                <thead>
                  <tr>
                    <th>Pack</th>
                    <th>Version</th>
                    <th>Cards</th>
                    <th>Decks</th>
                    <th>Export</th>
                  </tr>
                </thead>
                <tbody>
                  {shownPacks.map((pack) => (
                    <tr key={pack.name}>
                      <td>
                        <strong>{pack.name}</strong>
                        {pack.error ? <div className="muted">Could not load: {pack.error}</div> : null}
                        {pack.description ? <div className="muted">{pack.description}</div> : null}
                      </td>
                      <td>{pack.version}</td>
                      <td>{pack.error ? "—" : pack.cardCount}</td>
                      <td>{pack.decks?.length ?? pack.topics.length}</td>
                      <td>
                        <button className="btn small" type="button" onClick={() => void exportPack(pack.name)} disabled={Boolean(pack.error)}>
                          Export
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {orphans.length > 0 ? (
            <p className="muted">
              Cards whose pack is gone: {orphans.join(", ")}. The cards and their record stay.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "generate" ? (
        <div className="card">
          {provider?.configured && provider.hasKey ? null : (
            <p className="muted">
              No provider is set up. You can still prepare the exact prompt below; sending will stop with a plain
              message until a provider and key are set in Settings.
            </p>
          )}
          <div className="row">
            <select
              className="field"
              value={generate.packName}
              onChange={(event) => {
                const pack = packs.find((entry) => entry.name === event.target.value);
                setGenerate((previous) => ({
                  ...previous,
                  packName: event.target.value,
                  topic: pack?.topics[0] ?? "",
                }));
                setPrepared(null);
              }}
            >
              {packs.filter((pack) => !pack.error).map((pack) => (
                <option key={pack.name} value={pack.name}>
                  {pack.name}
                </option>
              ))}
            </select>
            <select
              className="field"
              value={generate.topic}
              onChange={(event) => {
                setGenerate((previous) => ({ ...previous, topic: event.target.value }));
                setPrepared(null);
              }}
            >
              {packTopics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
            <label>
              Cards:{" "}
              <input
                className="field"
                type="number"
                min={1}
                max={20}
                value={generate.count}
                onChange={(event) => setGenerate((previous) => ({ ...previous, count: Number(event.target.value) || 1 }))}
                style={{ width: "4.5rem" }}
              />
            </label>
            <button className="btn" type="button" onClick={() => void prepareGeneration()} disabled={!generate.packName || !generate.topic}>
              Prepare the prompt
            </button>
          </div>

          {prepared ? (
            <div style={{ marginTop: 12 }}>
              <p>
                {provider?.configured ? (
                  <>
                    This is exactly what will be sent to <strong>{provider.model}</strong>. Nothing leaves until
                    you press send.
                  </>
                ) : (
                  <>This is exactly what would be sent. Nothing leaves this machine until a provider is set up.</>
                )}
              </p>
              <pre className="code-block">{prepared.prompt}</pre>
              <div className="row">
                <button className="btn primary" type="button" onClick={() => void sendGeneration()}>
                  Send it
                </button>
                <button className="btn" type="button" onClick={() => void copyPrompt()}>
                  Copy the prompt
                </button>
                <button className="btn" type="button" onClick={() => setPrepared(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "add" ? (
        <div>
          <div className="row">
            <button
              className="btn"
              type="button"
              aria-pressed={addMode === "write"}
              onClick={() => setAddMode(addMode === "write" ? "none" : "write")}
            >
              Write a card
            </button>
            <button
              className="btn"
              type="button"
              aria-pressed={addMode === "import"}
              onClick={() => setAddMode(addMode === "import" ? "none" : "import")}
            >
              Import a batch
            </button>
          </div>

          {addMode === "write" ? (
            <div className="card stack">
              <input
                className="field"
                placeholder="Front (use ___ for a hidden word)"
                value={form.front}
                onChange={(event) => setForm((previous) => ({ ...previous, front: event.target.value }))}
              />
              <input
                className="field"
                placeholder="Back"
                value={form.back}
                onChange={(event) => setForm((previous) => ({ ...previous, back: event.target.value }))}
              />
              <div className="row">
                <select
                  className="field"
                  value={form.deckId}
                  onChange={(event) => setForm((previous) => ({ ...previous, deckId: event.target.value }))}
                  style={{ flex: 1 }}
                >
                  {choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.pack} · {choice.name}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={form.mode}
                  onChange={(event) => setForm((previous) => ({ ...previous, mode: event.target.value }))}
                >
                  <option value="auto">Guess the mode</option>
                  <option value="cloze">Hide a word</option>
                  <option value="picks">Pick from options</option>
                  <option value="type">Type the answer</option>
                </select>
              </div>
              {form.mode === "picks" ? (
                <input
                  className="field"
                  placeholder="Options, comma separated"
                  value={form.options}
                  onChange={(event) => setForm((previous) => ({ ...previous, options: event.target.value }))}
                />
              ) : null}
              <input
                className="field"
                placeholder="Short name (optional)"
                value={form.summary}
                onChange={(event) => setForm((previous) => ({ ...previous, summary: event.target.value }))}
              />
              <div>
                <button className="btn primary" type="button" onClick={() => void writeCard()} disabled={!form.front || !form.back || !form.deckId}>
                  Add the card
                </button>
              </div>
            </div>
          ) : null}

          {addMode === "import" ? (
            <div className="card stack">
              <p className="muted">
                Paste a list of cards as JSON, or choose a JSON file. Each card needs at least front and back. The whole
                batch is refused if one card has a problem.
              </p>
              <select className="field" value={importDeckId} onChange={(event) => setImportDeckId(event.target.value)}>
                {choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    Import into {choice.pack} · {choice.name}
                  </option>
                ))}
              </select>
              <input
                className="field"
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void file.text().then((text) => setImportText(text));
                }}
              />
              <textarea
                className="answer-input"
                rows={5}
                placeholder='[{"front":"Jestem z Polski.","back":"I am from Poland."}]'
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
              <div>
                <button className="btn" type="button" onClick={() => void runImport()} disabled={!importText.trim()}>
                  Import the batch
                </button>
              </div>
            </div>
          ) : null}

          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <h2 style={{ margin: 0 }}>
              Your cards ({cardQuery ? `${shownCards.length} of ${active.length}` : active.length})
            </h2>
            {active.length > 0 ? (
              <input
                className="field search-field"
                type="search"
                aria-label="Search cards"
                placeholder="Search cards"
                value={cardSearch}
                onChange={(event) => setCardSearch(event.target.value)}
              />
            ) : null}
          </div>
          {shownCards.length === 0 ? (
            <p className="muted">
              {active.length === 0 ? "No cards yet." : `No cards match "${cardSearch.trim()}".`}
            </p>
          ) : (
            <div className="scroll-area tall stack">
              {shownCards.map((card) => (
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
                        from a {card.origin.kind === "learner" ? "card you wrote" : card.origin.kind} · {card.origin.note}
                      </div>
                    </div>
                    <div className="row">
                      <button className="btn small" type="button" onClick={() => void openEvidence(card.id)}>
                        Record
                      </button>
                      <button className="btn small" type="button" onClick={() => beginEdit(card)}>
                        Edit
                      </button>
                      <button className="btn small" type="button" onClick={() => void removeCard(card.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {editingId === card.id ? (
                    <div className="stack" style={{ marginTop: 10 }}>
                      <input
                        className="field"
                        value={editForm.front}
                        onChange={(event) => setEditForm((previous) => ({ ...previous, front: event.target.value }))}
                      />
                      <input
                        className="field"
                        value={editForm.back}
                        onChange={(event) => setEditForm((previous) => ({ ...previous, back: event.target.value }))}
                      />
                      <p className="muted" style={{ margin: 0 }}>
                        Deck: {card.packName ?? "unknown"} · {card.topics.join(", ")}
                      </p>
                      <input
                        className="field"
                        value={editForm.summary}
                        onChange={(event) => setEditForm((previous) => ({ ...previous, summary: event.target.value }))}
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
                Retired cards ({cardQuery ? `${shownRetired.length} of ${retired.length}` : retired.length})
              </summary>
              <p className="muted">Older versions kept for the record. Their evidence stays with them.</p>
              <ul className="plain">
                {shownRetired.map((card) => (
                  <li key={card.id}>
                    {card.summary} <span className="muted">({card.origin.note})</span>{" "}
                    <button className="btn small" type="button" onClick={() => void openEvidence(card.id)}>
                      Record
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {tab === "chat" ? (
        <div className="card stack">
          <h2>Create with a chat</h2>
          <ol className="plain" style={{ margin: 0 }}>
            <li>Choose the pack and deck the cards should join.</li>
            <li>Build the prompt, then copy or download it into any chat.</li>
            <li>Paste the chat&apos;s answer below. Nothing saves until the whole answer passes.</li>
          </ol>
          <div className="row">
            <select className="field" value={chatKind} onChange={(event) => setChatKind(event.target.value as "new" | "pack" | "deck")}>
              <option value="deck">Add cards to one deck</option>
              <option value="pack">Add to a whole pack</option>
              <option value="new">Write a new pack</option>
            </select>
            {chatKind === "new" ? (
              <input className="field" value={chatName} onChange={(event) => setChatName(event.target.value)} placeholder="New pack name" />
            ) : (
              <select
                className="field"
                value={chatPack}
                onChange={(event) => {
                  setChatPack(event.target.value);
                  const first = choices.find((choice) => choice.pack === event.target.value);
                  setChatDeck(first?.value ?? "");
                }}
              >
                {packs.filter((pack) => !pack.error).map((pack) => (
                  <option key={pack.name} value={pack.name}>
                    {pack.name}
                  </option>
                ))}
              </select>
            )}
            {chatKind === "deck" ? (
              <select className="field" value={chatDeck} onChange={(event) => setChatDeck(event.target.value)}>
                {chatDecks.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button className="btn" type="button" onClick={() => void prepareAuthoringPrompt()}>
              Build the prompt
            </button>
          </div>
          {chatPrompt ? (
            <>
              <pre className="code-block">{chatPrompt}</pre>
              <div className="row">
                <button className="btn primary" type="button" onClick={() => void copyAuthoringPrompt()}>
                  Copy the prompt
                </button>
                <button className="btn" type="button" onClick={downloadAuthoringPrompt}>
                  Download .md
                </button>
                <button className="btn" type="button" onClick={() => setChatPrompt("")}>
                  Clear
                </button>
              </div>
            </>
          ) : null}
          <h3>Bring the answer back</h3>
          <p className="muted" style={{ margin: 0 }}>
            Paste the chat&apos;s JSON, or choose the file it produced. The whole answer is checked before anything is
            saved.
          </p>
          <input
            className="field"
            type="file"
            accept=".json,.md,application/json,text/markdown"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => setChatAnswer(text));
            }}
          />
          <textarea
            className="answer-input"
            rows={6}
            placeholder="Paste the chat's JSON answer here"
            value={chatAnswer}
            onChange={(event) => setChatAnswer(event.target.value)}
          />
          <div>
            <button className="btn" type="button" onClick={() => void importChatAnswer()} disabled={!chatAnswer.trim()}>
              Import the answer
            </button>
          </div>
        </div>
      ) : null}

      {evidence ? (
        <>
          <div className="drawer-scrim" onClick={() => setEvidence(null)} />
          <aside className="drawer" aria-label="Card record">
            <div className="drawer-head">
              <h2>Record: {evidence.card.summary}</h2>
              <button className="btn small" type="button" onClick={() => setEvidence(null)}>
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
                    </span>
                  </div>
                  {attempt.regions.map((region) => (
                    <div className="muted" key={`${attempt.attemptId}-${region.region ?? "whole"}`}>
                      {region.region ?? "answer"} → <span className={`outcome outcome-${region.outcome}`}>{OUTCOME_LABELS[region.outcome]}</span>.{" "}
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
                    {new Date(row.at).toLocaleString()}
                  </li>
                ))}
              </ul>
            </details>
          </aside>
        </>
      ) : null}
    </div>
  );
}
