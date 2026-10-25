// WHY: Study scope is two linked choices: a pack, then one of its decks. The
// plan screen and the empty screen both need them, and the deck list must
// disappear when the pack has no decks.
// PACK: study-tab-redesign
// 2026-10-25 opencode: moved from StudyClient for the Study redesign [pack: study-tab-redesign]

import type { PackStatus } from "@/lib/shared/types";

interface ScopePickerProps {
  packs: PackStatus[];
  packName: string;
  deckId: string;
  onChange: (packName: string, deckId: string) => void;
}

/** Pick a pack and, when it has decks, one deck. All cards is the default. */
export default function ScopePicker({ packs, packName, deckId, onChange }: ScopePickerProps) {
  const selected = packs.find((pack) => pack.name === packName) ?? null;
  const decks = selected?.decks ?? [];
  return (
    <div className="study-scope">
      <label className="study-scope-field">
        <span>Study from</span>
        <span className="select-wrap">
          <select
            className="study-select"
            value={packName}
            onChange={(event) => onChange(event.target.value, "")}
          >
            <option value="">All cards</option>
            {packs.map((pack) => (
              <option key={pack.name} value={pack.name}>
                {pack.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      {selected && decks.length > 0 ? (
        <label className="study-scope-field">
          <span>Deck</span>
          <span className="select-wrap">
            <select
              className="study-select"
              value={deckId}
              onChange={(event) => onChange(packName, event.target.value)}
            >
              <option value="">All decks</option>
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
