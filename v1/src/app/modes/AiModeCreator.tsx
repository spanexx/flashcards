"use client";

// WHY: The AI draft route prepares and sends a prompt but never saves. This
// screen shows the exact prompt, lets the learner copy it, and hands the
// returned mode to the editor as an unsaved draft.
// PACK: mode-studio-ui
// 2026-11-23 opencode: created for Track 4 AI creation. [pack: mode-studio-ui]

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client/api";
import { MODE_DRAFT_VERSION } from "@/lib/browser/mode-draft";
import type { LearningMode, ProviderStatus } from "@/lib/shared/types";

interface AiModeCreatorProps {
  onDraft: (mode: LearningMode) => void;
  onNotice: (message: string | null) => void;
  onCancel: () => void;
}

/** Prepare, review and send one mode draft. Nothing here writes a mode row. */
export default function AiModeCreator({ onDraft, onNotice, onCancel }: AiModeCreatorProps) {
  const [instruction, setInstruction] = useState("");
  const [prepared, setPrepared] = useState<{ requestId: string; prompt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const prepare = async () => {
    setBusy(true);
    setError(null);
    try {
      const settings = await apiGet<{ provider: ProviderStatus }>("/api/settings");
      if (!settings.provider?.configured || !settings.provider?.hasKey) {
        onNotice("Connect a provider and add a key before drafting a mode.");
        return;
      }
      const result = await apiSend<{ requestId: string; prompt: string }>("/api/modes/draft", "POST", {
        instruction,
      });
      setPrepared(result);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The draft could not be prepared.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText(prepared.prompt);
      onNotice("Prompt copied. It is exactly what leaves this device.");
    } catch {
      // WHY: clipboard access is not available on every host; the prompt is
      // still selectable in the read-only box, so no data is lost.
      onNotice("Select the prompt text to copy it.");
    }
  };

  const send = async () => {
    if (!prepared) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiSend<{ mode: LearningMode }>("/api/modes/draft/send", "POST", {
        requestId: prepared.requestId,
      });
      onDraft(result.mode);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The answer was not a usable mode.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-wrap">
      <div className="modal" role="dialog" aria-modal="true" aria-label="AI mode creator">
        <div className="split-head">
          <h2 style={{ margin: 0 }}>Create a mode with AI</h2>
          <span className="pill">draft {MODE_DRAFT_VERSION}</span>
        </div>
        <label className="field-label" style={{ marginTop: 12 }}>
          What should this mode teach?
          <textarea
            className="field"
            rows={2}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
          />
        </label>
        {prepared ? (
          <>
            <pre className="dict-prompt">{prepared.prompt}</pre>
            <p className="brief-note">This is the prompt that is sent. Nothing is saved yet.</p>
          </>
        ) : null}
        {error ? <div className="notice error">{error}</div> : null}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          {prepared ? (
            <>
              <button type="button" onClick={() => void copy()}>
                Copy prompt
              </button>
              <button className="btn primary" type="button" onClick={() => void send()} disabled={busy}>
                Send and open editor
              </button>
            </>
          ) : (
            <button className="btn primary" type="button" onClick={() => void prepare()} disabled={busy}>
              {busy ? "Preparing..." : "Prepare prompt"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
