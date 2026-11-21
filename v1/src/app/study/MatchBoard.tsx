// WHY: Matching is the only new answering surface in the word lesson. It must
// work with taps, never drag, because the card is used on a phone and in a
// narrow column. A correct pair locks; a wrong pair shakes once and clears; the
// card reports what it locked as a count, so judging needs no new evidence
// shape. The board never reveals which pair is right before the learner picks.
// PACK: word-lessons
// 2026-11-21 opencode: created for the word-lessons pack. [pack: word-lessons]

import { useEffect, useRef, useState } from "react";
import type { WordPair } from "@/lib/shared/types";

interface MatchBoardProps {
  pairs: WordPair[];
  /** After the answer, the board stays visible but stops accepting taps. */
  frozen: boolean;
  /** How many pairs are locked now, so the Answer button can enable. */
  onProgress: (got: number, total: number) => void;
  /** Every pair is locked: the card answers itself. */
  onComplete: (got: number, total: number) => void;
}

/** Shuffle a list of pair indexes without mutating the input. */
function shuffled(count: number): number[] {
  const order = Array.from({ length: count }, (_value, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
}

type Pick = { side: "left" | "right"; pair: number } | null;

/** Two columns of pair halves, paired by tapping one from each side. */
export default function MatchBoard({ pairs, frozen, onProgress, onComplete }: MatchBoardProps) {
  const [left] = useState<number[]>(() => shuffled(pairs.length));
  const [right] = useState<number[]>(() => shuffled(pairs.length));
  const [picked, setPicked] = useState<Pick>(null);
  const [locked, setLocked] = useState<number[]>([]);
  const [wrong, setWrong] = useState<{ left: number; right: number } | null>(null);
  const clearWrong = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (clearWrong.current) clearTimeout(clearWrong.current);
    },
    [],
  );

  const total = pairs.length;

  const choose = (side: "left" | "right", pair: number) => {
    if (frozen || locked.includes(pair) || wrong) return;

    if (!picked || picked.side === side) {
      setPicked({ side, pair });
      return;
    }

    if (picked.pair === pair) {
      const next = [...locked, pair];
      setLocked(next);
      setPicked(null);
      onProgress(next.length, total);
      if (next.length === total) onComplete(next.length, total);
      return;
    }

    // WHY: the wrong pair stays on screen for one short moment so the learner
    // sees which two they joined, then both clear. No score is kept against
    // them: the card is judged once, at the end.
    setWrong({
      left: picked.side === "left" ? picked.pair : pair,
      right: picked.side === "left" ? pair : picked.pair,
    });
    setPicked(null);
    clearWrong.current = setTimeout(() => setWrong(null), 420);
  };

  const state = (side: "left" | "right", pair: number) => {
    if (locked.includes(pair)) return "locked";
    if (wrong && wrong[side] === pair) return "wrong";
    if (picked?.side === side && picked.pair === pair) return "picked";
    return "idle";
  };

  return (
    <div className="match-board" data-frozen={frozen ? "true" : "false"}>
      <div className="match-column" role="group" aria-label="Words">
        {left.map((pair) => (
          <button
            key={`left-${pair}`}
            className="match-item"
            type="button"
            data-state={state("left", pair)}
            disabled={frozen || locked.includes(pair)}
            onClick={() => choose("left", pair)}
          >
            {pairs[pair].target}
          </button>
        ))}
      </div>
      <div className="match-column" role="group" aria-label="Meanings">
        {right.map((pair) => (
          <button
            key={`right-${pair}`}
            className="match-item"
            type="button"
            data-state={state("right", pair)}
            disabled={frozen || locked.includes(pair)}
            onClick={() => choose("right", pair)}
          >
            {pairs[pair].meaning}
          </button>
        ))}
      </div>
    </div>
  );
}
