// WHY: The plan may draw from many packs and decks. One compact dropdown keeps
// the choice out of the page until it is needed; a search finds a pack or deck
// quickly, a green dot marks a chosen source, and the chevron opens the nested
// deck list to narrow one. An empty list is the whole library.
// PACK: study-tab-redesign, plan-multi-select
// 2026-10-25 opencode: moved from StudyClient for the Study redesign [pack: study-tab-redesign]
// 2026-10-27 opencode: replaced the two single dropdowns with the checked
// multi-pack panel. [pack: plan-multi-select]
// 2026-10-28 opencode: learner review asked for the pack dropdown back, with
// decks folded inside it and a search. [pack: plan-multi-select]
// 2026-10-28 opencode: learner review replaced the checkboxes with green dots
// and capped each open deck list with a scroll. [pack: plan-multi-select]

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { allDecksItem, scopeSummary } from "@/lib/core/plan-scope";
import type { PackStatus, PlanScope } from "@/lib/shared/types";

interface ScopePickerProps {
  packs: PackStatus[];
  scope: PlanScope;
  onChange: (scope: PlanScope) => void;
}

/** Replace one pack's decks without moving it, or append a new pack. */
function withPack(scope: PlanScope, pack: string, decks: string[]): PlanScope {
  if (decks.length === 0) return scope.filter((item) => item.pack !== pack);
  const index = scope.findIndex((item) => item.pack === pack);
  const next = { pack, decks };
  if (index === -1) return [...scope, next];
  return scope.map((item, at) => (at === index ? next : item));
}

function packMeta(pack: PackStatus): string {
  const decks = pack.decks ?? [];
  if (decks.length === 0) return "no decks";
  return `${decks.length} ${decks.length === 1 ? "deck" : "decks"} · ${pack.cardCount} ${
    pack.cardCount === 1 ? "card" : "cards"
  }`;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`study-scope-chevron${open ? " open" : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * A chosen source keeps a green dot. The empty space is deliberate: a row with
 * no dot still lines up with one that has a dot.
 */
function Dot({ state }: { state: "off" | "on" | "partial" }) {
  return (
    <span
      className={`study-scope-dot${state === "off" ? " off" : state === "partial" ? " partial" : ""}`}
      aria-hidden="true"
    />
  );
}

/** Pick any number of packs and decks from one searchable dropdown. */
export default function ScopePicker({ packs, scope, onChange }: ScopePickerProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const menuId = `${baseId}-menu`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const all = scope.length === 0;
  const summary = scopeSummary(scope, packs);
  const chosen = useMemo(() => new Map(scope.map((item) => [item.pack, new Set(item.decks)])), [scope]);
  const needle = query.trim().toLocaleLowerCase();

  const rows = useMemo(() => {
    return packs.flatMap((pack) => {
      const decks = pack.decks ?? [];
      const packMatch = needle.length === 0 || pack.name.toLocaleLowerCase().includes(needle);
      const matched = packMatch
        ? decks
        : decks.filter((deck) => deck.name.toLocaleLowerCase().includes(needle));
      if (!packMatch && matched.length === 0) return [];
      return [{ pack, decks: matched }];
    });
  }, [needle, packs]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const toggleExpanded = (name: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  /** Tick or untick a whole pack; a partial pack returns to every deck first. */
  const togglePack = (pack: PackStatus) => {
    const every = allDecksItem(pack);
    if (!every) return;
    const selected = chosen.get(pack.name);
    const fully = selected !== null && every.decks.every((deck) => selected?.has(deck));
    onChange(fully ? scope.filter((item) => item.pack !== pack.name) : withPack(scope, pack.name, every.decks));
  };

  /** Tick or untick one deck; the last unticked deck removes its pack. */
  const toggleDeck = (pack: PackStatus, deckId: string) => {
    const current = chosen.get(pack.name) ?? new Set<string>();
    const next = new Set(current);
    if (next.has(deckId)) next.delete(deckId);
    else next.add(deckId);
    const decks = (pack.decks ?? []).map((deck) => deck.id).filter((id) => next.has(id));
    onChange(withPack(scope, pack.name, decks));
  };

  return (
    <div className="study-scope-field study-scope-dropdown" ref={rootRef}>
      <span id={labelId}>Study from</span>
      <div className="study-scope-control">
        <button
          className="study-select study-scope-trigger"
          type="button"
          ref={triggerRef}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={`Study from ${summary}`}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className="study-scope-value">{summary}</span>
          <Chevron open={open} />
        </button>

        {open ? (
          <div className="study-scope-menu" id={menuId} role="dialog" aria-label="Choose packs and decks">
            <div className="study-scope-search">
              <input
                type="search"
                value={query}
                placeholder="Search packs and decks"
                aria-label="Search packs and decks"
                spellCheck={false}
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <button
              className="study-scope-choice study-scope-all"
              type="button"
              role="checkbox"
              aria-checked={all}
              onClick={() => onChange([])}
            >
              <Dot state={all ? "on" : "off"} />
              <span>
                <strong>All cards</strong>
                <small>the whole library</small>
              </span>
            </button>

            {packs.length === 0 ? (
              <p className="study-scope-empty">No packs yet. Create or import one in the library.</p>
            ) : rows.length === 0 ? (
              <p className="study-scope-empty">No pack or deck matches “{query.trim()}”.</p>
            ) : (
              <ul className="study-scope-options">
                {rows.map(({ pack, decks }, index) => {
                  const selected = chosen.get(pack.name) ?? null;
                  const allDecks = pack.decks ?? [];
                  const packChosen = selected !== null && selected.size > 0;
                  const everyDeck =
                    packChosen && allDecks.length > 0 && allDecks.every((deck) => selected?.has(deck.id));
                  const partial = packChosen && !everyDeck;
                  const showDecks = needle.length > 0 || expanded.has(pack.name);
                  return (
                    <li className="study-scope-pack" key={pack.name}>
                      <div className="study-scope-pack-row">
                        <button
                          className="study-scope-choice"
                          type="button"
                          role="checkbox"
                          aria-checked={partial ? "mixed" : everyDeck}
                          disabled={allDecks.length === 0}
                          onClick={() => togglePack(pack)}
                        >
                          <Dot state={everyDeck ? "on" : partial ? "partial" : "off"} />
                          <span>
                            <strong>{pack.name}</strong>
                            <small>{packMeta(pack)}</small>
                          </span>
                        </button>
                        {needle.length === 0 && allDecks.length > 0 ? (
                          <button
                            className="study-scope-expand"
                            type="button"
                            aria-expanded={showDecks}
                            aria-controls={`${baseId}-decks-${index}`}
                            aria-label={`${showDecks ? "Hide" : "Show"} decks in ${pack.name}`}
                            title={`${showDecks ? "Hide" : "Show"} decks in ${pack.name}`}
                            onClick={() => toggleExpanded(pack.name)}
                          >
                            <Chevron open={showDecks} />
                          </button>
                        ) : null}
                      </div>
                      {showDecks && decks.length > 0 ? (
                        <ul className="study-scope-decks" id={`${baseId}-decks-${index}`}>
                          {decks.map((deck) => {
                            const deckChosen = selected?.has(deck.id) ?? false;
                            return (
                              <li key={deck.id}>
                                <button
                                  className="study-scope-choice"
                                  type="button"
                                  role="checkbox"
                                  aria-checked={deckChosen}
                                  onClick={() => toggleDeck(pack, deck.id)}
                                >
                                  <Dot state={deckChosen ? "on" : "off"} />
                                  <span>
                                    <strong>{deck.name}</strong>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
