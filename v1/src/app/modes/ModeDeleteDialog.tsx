"use client";

// WHY: A learning mode is deleted by typing its visible name, just like a pack.
// Keeping this dialog with the modes screen leaves the Library's shared delete
// target untouched, so the two flows can change independently.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created for Track 4 deletion. [pack: mode-studio-ui]

import { useEffect, useRef, useState } from "react";

interface ModeDeleteDialogProps {
  modeName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

/** Typed-name confirmation for one learner-owned learning mode. */
export default function ModeDeleteDialog({ modeName, onClose, onConfirm }: ModeDeleteDialogProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const matches = typed === modeName;
  const remove = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (problem) {
      // WHY: a failed delete keeps the dialog open so the reason stays visible.
      setError(problem instanceof Error ? problem.message : "The mode could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-wrap" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Delete ${modeName}`}>
        <h2>Delete {modeName}?</h2>
        <p className="muted">
          This removes your copy of the mode. Built-in modes are never removed. Type <strong>{modeName}</strong> to
          confirm.
        </p>
        <input
          ref={inputRef}
          className="field"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          aria-label={`Type ${modeName} to confirm`}
        />
        {error ? <div className="notice error">{error}</div> : null}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn danger" type="button" onClick={() => void remove()} disabled={!matches || busy}>
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
