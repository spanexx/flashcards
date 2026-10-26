"use client";

// WHY: Packs is for browsing what already exists. It can fold a pack open,
// export it, send the learner to Create with a deck ready, or start a typed
// delete. It never grows a create form of its own.
// PACK: library-create-flow
// 2026-10-21 opencode: created during the Packs browse and delete rework [pack: library-create-flow]

import { useState } from "react";
import { exportPackArchive, importPackFile } from "@/lib/browser/archive";
import { repairClause } from "@/lib/core/json-repair";
import { languagePairLabel } from "@/lib/shared/language";
import type { Card, PackStatus } from "@/lib/shared/types";
import PackEditor from "./PackEditor";
import { packDecks, packMatches, searchable, type DeleteTarget } from "./library-utils";

/** What the Packs panel needs from the shell and its current packs. */
interface PacksPanelProps {
  packs: PackStatus[];
  cards: Card[];
  orphans: string[];
  initialOpen: string | null;
  onCreatePack: () => void;
  onAddCards: (packName: string, deckId: string) => void;
  onDelete: (target: DeleteTarget) => void;
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

export default function PacksPanel({
  packs,
  cards,
  orphans,
  initialOpen,
  onCreatePack,
  onAddCards,
  onDelete,
  onRefresh,
  onError,
  onNotice,
}: PacksPanelProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    initialOpen ? new Set([initialOpen]) : new Set(),
  );
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  // A create result mounts this panel with that pack already open; the shell's
  // token is the signal, so the panel never has to correct itself after paint.
  const query = searchable(search.trim());
  const shown = query ? packs.filter((pack) => packMatches(pack, query)) : packs;

  // Fold or unfold one pack without losing the other open packs.
  const toggle = (name: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Export one pack: JSON when it has no local media, a zip when it does.
  const exportPack = async (name: string) => {
    onError(null);
    setBusy(true);
    try {
      const exported = await exportPackArchive(name);
      if (!exported.ok) throw new Error(exported.message);
      const url = URL.createObjectURL(exported.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exported.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      onNotice(`Exported ${name} as ${exported.fileName}. Learner evidence stays out of the file.`);
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "The pack could not be exported.");
    } finally {
      setBusy(false);
    }
  };

  // A shared pack may arrive as JSON or as a zip that carries its own media.
  const importPack = async (file: File) => {
    onError(null);
    onNotice(null);
    setBusy(true);
    try {
      const result = await importPackFile(file, { kind: "pack" });
      if (!result.ok) {
        const first = result.issues[0];
        onError(
          `The pack was not imported: ${first ? `${first.field}: ${first.message}` : "the file needs fixing."}`,
        );
        return;
      }
      await onRefresh();
      const counts = [
        `${result.decksAdded} deck(s)`,
        `${result.cardsAdded} card(s)`,
        result.cardsUpdated ? `${result.cardsUpdated} updated in place` : "",
        result.cardsRetired ? `${result.cardsRetired} retired` : "",
      ].filter((line) => line.length > 0);
      // A hand-typed file says what was fixed before it says what landed.
      const repaired = repairClause(result.repairs);
      onNotice(
        `${repaired ? `${repaired}. ` : ""}Imported ${result.packName}: ${counts.join(", ")}.`,
      );
    } catch (problem) {
      onError(problem instanceof Error ? problem.message : "That pack file could not be read.");
    } finally {
      setBusy(false);
    }
  };

  // Refresh reads the library again; the shell owns the notice.
  const refresh = async () => {
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  // Count cards in a deck from the loaded card list, including retired copies.
  const deckCardCount = (packName: string, deckId: string) =>
    cards.filter((card) => card.packName === packName && card.deckId === deckId).length;

  return (
    <section className="card">
      <div className="split-head">
        <div>
          <h2 style={{ margin: 0 }}>Packs</h2>
          <p className="muted" style={{ margin: "3px 0 0" }}>
            Browse what is here. New content lives in Create.
          </p>
        </div>
        <span className="pill">{packs.length === 1 ? "1 pack" : `${packs.length} packs`}</span>
      </div>

      <div className="row" style={{ margin: "12px 0" }}>
        <input
          className="field search-field"
          type="search"
          aria-label="Search packs and decks"
          placeholder="Search packs and decks"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn primary" type="button" onClick={onCreatePack}>
          Create a pack
        </button>
        <button className="btn" type="button" onClick={() => void refresh()} disabled={busy}>
          Refresh
        </button>
        <label className="btn">
          Import a pack file
          <input
            type="file"
            accept=".json,.zip,application/json,application/zip"
            style={{ display: "none" }}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importPack(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {packs.length === 0 ? (
        <div className="empty">
          <strong>No packs yet.</strong> Use Create to write, generate, chat or import one.
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <strong>No packs match.</strong> Try a different search.
        </div>
      ) : (
        <div className="scroll-area pack-list">
          {shown.map((pack) => {
            const open = expanded.has(pack.name) && !pack.error;
            const count = packDecks(pack).length;
            return (
              <div key={pack.name} data-pack={pack.name}>
                <div className="pack-row">
                  <button
                    className="btn small ghost"
                    type="button"
                    aria-expanded={open}
                    aria-label={open ? `Collapse ${pack.name}` : `Expand ${pack.name}`}
                    onClick={() => toggle(pack.name)}
                    disabled={Boolean(pack.error)}
                  >
                    {open ? "▾" : "▸"}
                  </button>
                  <div className="pack-main">
                    <strong>{pack.name}</strong>
                    <div className="muted">
                      v{pack.version} · {count === 1 ? "1 deck" : `${count} decks`} · {pack.cardCount} cards ·{" "}
                      {languagePairLabel(pack)}
                    </div>
                    {pack.description ? <div className="muted">{pack.description}</div> : null}
                    {pack.error ? <div className="muted">Could not load: {pack.error}</div> : null}
                  </div>
                  <div className="row">
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => setEditing((current) => (current === pack.name ? null : pack.name))}
                      disabled={Boolean(pack.error)}
                    >
                      {editing === pack.name ? "Close editor" : "Edit"}
                    </button>
                    <button className="btn small" type="button" onClick={() => void exportPack(pack.name)} disabled={busy || Boolean(pack.error)}>
                      Export
                    </button>
                    <button className="btn small danger" type="button" onClick={() => onDelete({ kind: "pack", packName: pack.name })}>
                      Delete pack
                    </button>
                  </div>
                </div>

                {editing === pack.name ? (
                  <PackEditor
                    pack={pack}
                    onSaved={async () => {
                      await onRefresh();
                      setEditing(null);
                    }}
                    onClose={() => setEditing(null)}
                    onError={onError}
                    onNotice={onNotice}
                  />
                ) : null}

                {open ? (
                  <div className="deck-list">
                    {packDecks(pack).map((deck) => (
                      <div className="deck-row" key={deck.id}>
                        <div className="pack-main">
                          <div>{deck.name}</div>
                          <div className="muted">
                            {deckCardCount(pack.name, deck.id)} cards · {deck.level}
                          </div>
                        </div>
                        <div className="row">
                          <button className="btn small" type="button" onClick={() => onAddCards(pack.name, deck.id)}>
                            Add cards
                          </button>
                          <button
                            className="btn small danger"
                            type="button"
                            onClick={() =>
                              onDelete({ kind: "deck", packName: pack.name, deckId: deck.id, deckName: deck.name })
                            }
                          >
                            Delete deck
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {orphans.length > 0 ? (
        <p className="muted">
          Cards whose pack is gone: {orphans.join(", ")}. The cards and their record stay.
        </p>
      ) : null}
    </section>
  );
}
