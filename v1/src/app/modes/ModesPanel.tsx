"use client";

// WHY: The list decides which actions a mode offers. Built-ins can be copied,
// learner-owned rows can be edited, tested and deleted; the router stays the
// real guard for built-in writes.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created for the Track 4 list. [pack: mode-studio-ui]

import type { LearningMode } from "@/lib/shared/types";
import { canDeleteMode } from "@/app/library/mode-studio-utils";

interface ModesPanelProps {
  modes: LearningMode[];
  onDuplicate: (mode: LearningMode) => void;
  onEdit: (mode: LearningMode) => void;
  onPreview: (mode: LearningMode) => void;
  onDelete: (mode: LearningMode) => void;
}

/** One row per mode, with only the actions that shape allows. */
export default function ModesPanel({ modes, onDuplicate, onEdit, onPreview, onDelete }: ModesPanelProps) {
  const custom = modes.filter((mode) => !mode.isBuiltIn).length;
  return (
    <section className="modes-surface">
      <div className="modes-surface-head">
        <span className="cap">Your modes</span>
        <span className="modes-count mono">{modes.length} · {custom} yours</span>
      </div>
      {modes.length === 0 ? <p className="muted modes-empty">No learning modes are installed yet.</p> : null}
      <div className="modes-list">
        {modes.map((mode) => (
          <div className="mode-item" key={mode.id}>
            <div className="mode-info">
              <span className="mode-name">{mode.name}</span>
              <span className="mode-description">{mode.description}</span>
              <span className="mode-meta mono">
                {mode.version} · {mode.isBuiltIn ? "built-in" : "your copy"}
              </span>
            </div>
            <div className="mode-actions">
              {mode.isBuiltIn ? (
                <button type="button" className="mode-action" onClick={() => onDuplicate(mode)}>
                  Duplicate
                </button>
              ) : (
                <>
                  <button type="button" className="mode-action" onClick={() => onEdit(mode)}>Edit</button>
                  <button type="button" className="mode-action" onClick={() => onPreview(mode)}>Preview</button>
                  {canDeleteMode(mode) ? (
                    <button type="button" className="mode-action danger" onClick={() => onDelete(mode)}>
                      Delete
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
