"use client";

// WHY: One shell owns the mode list and the small amount of screen state: which
// dialog is open and what notice to show. Each dialog owns its own form.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created for the Track 4 route. [pack: mode-studio-ui]

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import type { LearningMode } from "@/lib/shared/types";
import { modeDeleteName, modeExportText, modeImportBody } from "@/app/library/mode-studio-utils";
import AiModeCreator from "./AiModeCreator";
import ModeDeleteDialog from "./ModeDeleteDialog";
import ModeEditor from "./ModeEditor";
import ModePreview from "./ModePreview";
import ModesPanel from "./ModesPanel";

/** The whole Learning modes screen, with no Library tab and no router edits. */
export default function ModesClient() {
  const [modes, setModes] = useState<LearningMode[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<LearningMode | null>(null);
  const [editingNew, setEditingNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<LearningMode | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [deleting, setDeleting] = useState<LearningMode | null>(null);

  const load = useCallback(async () => {
    try {
      const answer = await apiGet<{ modes: LearningMode[] }>("/api/modes");
      setModes(answer.modes);
      setMessage(null);
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "The modes could not be read.");
    }
  }, []);

  useEffect(() => {
    const pending = Promise.resolve().then(() => load());
    return () => {
      void pending;
    };
  }, [load]);

  const duplicate = async (mode: LearningMode) => {
    if (busy) return;
    setBusy(true);
    try {
      const created = await apiSend<{ mode: LearningMode }>("/api/modes", "POST", {
        sourceModeId: mode.id,
        name: `${mode.name} copy`,
      });
      await load();
      setEditingNew(false);
      setEditing(created.mode);
      setNotice("The copy is yours. Nothing else changed.");
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "The mode could not be copied.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (mode: LearningMode) => {
    try {
      await apiSend(`/api/modes/${encodeURIComponent(mode.id)}`, "DELETE");
      setDeleting(null);
      await load();
      setNotice(`${mode.name} was deleted.`);
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "The mode could not be deleted.");
      // WHY: the dialog owns the visible refusal; the banner behind it is not
      // readable while the full-screen overlay is open.
      throw problem;
    }
  };

  const exportModes = () => {
    // WHY: the browser can download a blob without a new route or dependency.
    const blob = new Blob([modeExportText(modes)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "learning-modes.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importModes = async (file: File) => {
    if (busy) return;
    setBusy(true);
    try {
      const body = modeImportBody(await file.text());
      for (const mode of body.modes) {
        await apiSend("/api/modes", "POST", mode);
      }
      await load();
      setNotice("Modes were imported. Built-ins were left alone.");
    } catch (problem) {
      setMessage(problem instanceof Error ? problem.message : "The file was not a mode export.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="stack" style={{ padding: 24, maxWidth: 980 }}>
      <div className="split-head">
        <div>
          <h1 style={{ margin: 0 }}>Learning modes</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Pick how the AI writes cards. Built-ins can be copied; your copies can be edited.
          </p>
        </div>
        <div className="row">
          <button type="button" onClick={() => setAiOpen(true)}>
            Create with AI
          </button>
          <button type="button" onClick={exportModes}>
            Export
          </button>
          <label className="btn" style={{ display: "inline-flex", alignItems: "center" }}>
            Import
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importModes(file);
              }}
            />
          </label>
        </div>
      </div>

      {message ? <div className="notice error">{message}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <ModesPanel
        modes={modes}
        onDuplicate={(mode) => void duplicate(mode)}
        onEdit={(mode) => {
          setEditingNew(false);
          setEditing(mode);
        }}
        onPreview={setPreview}
        onDelete={setDeleting}
      />

      {editing ? (
        <ModeEditor
          mode={editing}
          isNew={editingNew}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            void load();
            setNotice(`${saved.name} was saved.`);
          }}
        />
      ) : null}
      {preview ? <ModePreview mode={preview} onClose={() => setPreview(null)} /> : null}
      {aiOpen ? (
        <AiModeCreator
          onCancel={() => setAiOpen(false)}
          onNotice={setNotice}
          onDraft={(drafted) => {
            setAiOpen(false);
            setEditingNew(true);
            setEditing(drafted);
          }}
        />
      ) : null}
      {deleting ? (
        <ModeDeleteDialog
          modeName={modeDeleteName(deleting)}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
        />
      ) : null}
    </main>
  );
}
