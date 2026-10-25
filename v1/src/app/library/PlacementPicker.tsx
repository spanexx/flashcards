// WHY: Deck and Cards targets both need the same parent choice. Keeping it out
// of CreatePanel means the growing brief form and the picker can change without
// stepping on each other.
// PACK: creation-control
// 2026-10-22 opencode: extracted from CreatePanel for the creation brief
// [pack: creation-control]

import type { PackStatus } from "@/lib/shared/types";
import { packDecks } from "./library-utils";

/** A pack and deck picker, because deck ids repeat across packs. */
export interface PlacementPickerProps {
  packs: PackStatus[];
  packName: string;
  deckId: string;
  withDeck: boolean;
  packLabel: string;
  deckLabel: string;
  onPack: (name: string) => void;
  onDeck: (id: string) => void;
}

/** One parent choice for Deck and Cards. Pack target never renders this. */
export default function PlacementPicker({
  packs,
  packName,
  deckId,
  withDeck,
  packLabel,
  deckLabel,
  onPack,
  onDeck,
}: PlacementPickerProps) {
  const readable = packs.filter((pack) => !pack.error);
  const pack = readable.find((entry) => entry.name === packName);
  const decks = pack ? packDecks(pack) : [];

  if (readable.length === 0) {
    return <p className="muted">There is no pack yet. Create or import a pack first.</p>;
  }

  return (
    <div className="row">
      <label className="field-label">
        {packLabel}
        <span className="select-wrap">
          <select className="field" value={packName} onChange={(event) => onPack(event.target.value)}>
            {readable.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name} · v{entry.version}
              </option>
            ))}
          </select>
        </span>
      </label>
      {withDeck ? (
        <label className="field-label">
          {deckLabel}
          <span className="select-wrap">
            <select className="field" value={deckId} onChange={(event) => onDeck(event.target.value)}>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          </span>
        </label>
      ) : null}
    </div>
  );
}
