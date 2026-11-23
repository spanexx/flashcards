"use client";

// WHY: Saving a mode is a write through the existing router. This editor only
// owns the draft and the inline, field-named feedback; it never invents a route.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created for Track 4 editing. [pack: mode-studio-ui]

import { useEffect, useState } from "react";
import { apiSend } from "@/lib/client/api";
import { learningModeIssues } from "@/lib/browser/modes";
import { ANSWER_MODES, type AnswerMode, type LearningMode } from "@/lib/shared/types";
import { modeIssueLines, modeSaveRequest } from "@/app/library/mode-studio-utils";

interface ModeEditorProps {
  mode: LearningMode;
  /** A drafted mode has no stored row yet, so Save must create it. */
  isNew?: boolean;
  onSaved: (mode: LearningMode) => void;
  onCancel: () => void;
}

/** Edit one learner-owned mode, checking it before the router is called. */
export default function ModeEditor({ mode, isNew = false, onSaved, onCancel }: ModeEditorProps) {
  const [draft, setDraft] = useState<LearningMode>(mode);
  const [exampleText, setExampleText] = useState(JSON.stringify(mode.canonicalExample, null, 2));
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // WHY: Escape closes every dialog in this app, not just the delete one.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const toggleMix = (value: AnswerMode) => {
    const next = draft.defaultCardMix.includes(value)
      ? draft.defaultCardMix.filter((item) => item !== value)
      : [...draft.defaultCardMix, value];
    setDraft({ ...draft, defaultCardMix: next });
  };

  const save = async () => {
    let example: unknown;
    try {
      example = JSON.parse(exampleText);
    } catch {
      setIssues(["canonicalExample: this must be JSON"]);
      return;
    }
    const candidate = { ...draft, canonicalExample: example };
    const problems = learningModeIssues(candidate);
    if (problems.length > 0) {
      setIssues(problems.map((issue) => `${issue.field}: ${issue.message}`));
      return;
    }
    setBusy(true);
    setIssues([]);
    try {
      const request = modeSaveRequest(candidate, isNew);
      const saved = await apiSend<{ mode: LearningMode }>(request.url, request.method, request.body);
      onSaved(saved.mode);
    } catch (problem) {
      // WHY: a field-named server refusal is more useful than the banner alone.
      const lines = modeIssueLines(problem);
      setIssues(lines.length > 0 ? lines : [problem instanceof Error ? problem.message : "Save failed."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-wrap">
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Edit ${mode.name}`}>
        <div className="split-head">
          <h2 style={{ margin: 0 }}>Edit {mode.name}</h2>
          <span className="pill">stored when you press Save</span>
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field-label">
            Name
            <input className="field" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label className="field-label">
            Version
            <input className="field" value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} />
          </label>
        </div>
        <label className="field-label">
          Description
          <input className="field" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </label>
        <div className="field-label">
          Card mix
          <div className="row" style={{ marginTop: 6 }}>
            {ANSWER_MODES.map((value) => (
              <label className="pill" key={value} style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={draft.defaultCardMix.includes(value)} onChange={() => toggleMix(value)} /> {value}
              </label>
            ))}
          </div>
        </div>
        <label className="field-label">
          <input
            type="checkbox"
            checked={draft.usesWordStages}
            onChange={(event) => setDraft({ ...draft, usesWordStages: event.target.checked })}
          />{" "}
          Uses word stages
        </label>
        <label className="field-label">
          Skill instructions (Markdown)
          <textarea
            className="field"
            rows={5}
            value={draft.skillInstructions}
            onChange={(event) => setDraft({ ...draft, skillInstructions: event.target.value })}
          />
        </label>
        <label className="field-label">
          Canonical example JSON
          <textarea
            className="field"
            rows={9}
            value={exampleText}
            onChange={(event) => setExampleText(event.target.value)}
          />
        </label>
        {issues.length > 0 ? (
          <div className="notice error">
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" type="button" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving..." : "Save mode"}
          </button>
        </div>
      </div>
    </div>
  );
}
