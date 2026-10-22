"use client";

// WHY: A pack or deck can hold a lot of learner work, so removal is not a
// single click. This dialog makes the learner type the visible name and keeps
// the last deck in a pack from taking the pack's only home with it.
// PACK: library-create-flow
// 2026-10-21 opencode: created for typed-name pack and deck deletion [pack: library-create-flow]

import { useEffect, useRef, useState } from "react";
import { deleteName, type DeleteTarget } from "./library-utils";

/** What the dialog needs to ask, block, or perform one removal. */
interface DeleteDialogProps {
  target: DeleteTarget;
  blockedReason?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteDialog({ target, blockedReason, onClose, onConfirm }: DeleteDialogProps) {
  const wanted = deleteName(target);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The confirmation field is the only thing to do here, so it takes focus.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape closes without touching data, matching the Cancel button.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const matches = typed === wanted;
  const canDelete = matches && !blockedReason && !busy;

  // A failed remove keeps the dialog open so the learner sees the reason.
  const remove = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The item could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-wrap" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete {target.kind}?</h2>
        <p className="muted">
          {target.kind === "pack"
            ? "This removes the pack, its decks, its cards and their record."
            : "This removes the deck, its cards and their record. The pack stays."}{" "}
          Type <strong>{wanted}</strong> to confirm.
        </p>
        <label className="stack" style={{ gap: 4 }}>
          <span className="muted">Name</span>
          <input
            ref={inputRef}
            className="field"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void remove();
            }}
            aria-label={`Type ${wanted} to confirm`}
          />
        </label>
        {blockedReason ? <div className="notice error">{blockedReason}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn danger" type="button" onClick={() => void remove()} disabled={!canDelete}>
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
