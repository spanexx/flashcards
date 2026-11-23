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
  return (
    <section className="card">
      <div className="split-head">
        <h2 style={{ margin: 0 }}>Your learning modes</h2>
        <span className="pill">Built-ins first, then by name</span>
      </div>
      {modes.length === 0 ? <p className="muted">No learning modes are installed yet.</p> : null}
      <div className="stack" style={{ marginTop: 12 }}>
        {modes.map((mode) => (
          <div className="row" key={mode.id} style={{ alignItems: "center", padding: "12px 0", borderBottom: "1px solid #ccd3dc" }}>
            <div style={{ flex: 1 }}>
              <strong>{mode.name}</strong>
              <div className="muted">{mode.description}</div>
              <span className="pill">{mode.version}</span>
              {mode.isBuiltIn ? (
                <span className="pill">built-in</span>
              ) : (
                <span className="pill">your copy</span>
              )}
            </div>
            <div className="row">
              {mode.isBuiltIn ? (
                <button type="button" onClick={() => onDuplicate(mode)}>
                  Duplicate &amp; Customize
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => onEdit(mode)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => onPreview(mode)}>
                    Test preview
                  </button>
                  {canDeleteMode(mode) ? (
                    <button className="btn danger" type="button" onClick={() => onDelete(mode)}>
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
